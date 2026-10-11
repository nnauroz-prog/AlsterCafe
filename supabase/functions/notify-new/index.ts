// Supabase Edge Function: notify-new
// ---------------------------------------------------------------------------
// Wird per Database-Webhook bei INSERT in `reservations` / `orders` aufgerufen
// und verschickt:
//   1. eine Benachrichtigung an den Inhaber (MAIL_TO)
//   2. eine automatische Eingangsbestätigung an den Gast (record.email), falls
//      vorhanden und die Absender-Domain in Resend verifiziert ist.
//
// Versand über Resend (https://resend.com). API-Key als Supabase-Secret
// RESEND_API_KEY. Absender/Empfänger über Secrets steuerbar (siehe unten).
//
// Robust: ein fehlgeschlagener Mailversand wird nur geloggt, nie geworfen —
// die Anfrage selbst liegt bereits sicher in der Datenbank.
// ---------------------------------------------------------------------------

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
// Stufe 1 (ohne verifizierte Domain): "Alstercafé <onboarding@resend.dev>".
// Stufe 2 (Domain alstercafe.de in Resend verifiziert): auf
// "Alstercafé <reservierung@alstercafe.de>" umstellen (nur dieses Secret ändern).
const MAIL_FROM = Deno.env.get("MAIL_FROM") || "Alstercafé <onboarding@resend.dev>";
const MAIL_TO = Deno.env.get("MAIL_TO") || "info@alstercafe.de";
// Optionaler Schutz: wenn gesetzt, muss der Webhook den Header
// "x-webhook-secret" mit genau diesem Wert senden.
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") || "";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

async function sendMail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) { console.error("RESEND_API_KEY fehlt – kein Versand"); return; }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html }),
    });
    if (!res.ok) console.error("Resend-Fehler", res.status, await res.text());
    else console.log("Mail gesendet an", to);
  } catch (e) {
    console.error("Mailversand fehlgeschlagen an", to, e);
  }
}

const FOOT = "Herzliche Grüße<br>Ihr Alstercafé · Ifflandstraße 45 · 22087 Hamburg · 040 – 22 69 28 91";
const ADMIN = "Im Mitgliederbereich ansehen: https://alstercafe.de/admin.html";

Deno.serve(async (req) => {
  if (WEBHOOK_SECRET && req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 401 });
  }
  let payload: any;
  try { payload = await req.json(); } catch { return new Response("bad request", { status: 400 }); }

  const table = payload?.table;
  const r = payload?.record ?? {};
  if (payload?.type !== "INSERT" || (table !== "reservations" && table !== "orders")) {
    return new Response("ignored", { status: 200 });
  }

  // Hinweis: Diese Funktion benachrichtigt NUR den Inhaber über eine neue
  // Anfrage. Die Bestätigung an den GAST verschickt der Inhaber bewusst manuell
  // per Knopf im Mitgliederbereich (Edge Function 'send-confirmation'), damit er
  // vorher die Verfügbarkeit prüfen kann.
  let ownerSubject = "", ownerHtml = "";

  if (table === "reservations") {
    ownerSubject = `Neue Reservierungsanfrage – ${r.name || "ohne Name"}`;
    ownerHtml = `
      <h2>Neue Reservierungsanfrage</h2>
      <p><strong>Name:</strong> ${esc(r.name)}<br>
      <strong>Datum / Uhrzeit:</strong> ${esc(r.date)} ${esc(r.time)}<br>
      <strong>Personen:</strong> ${esc(r.persons)}<br>
      <strong>Telefon:</strong> ${esc(r.phone)}<br>
      <strong>E-Mail:</strong> ${esc(r.email)}<br>
      <strong>Nachricht:</strong> ${esc(r.message) || "—"}</p>
      <p>${ADMIN}</p>`;
  } else {
    const items = Array.isArray(r.items)
      ? r.items.map((it: any) => `${esc(it.qty)}× ${esc(it.name)}`).join("<br>")
      : "";
    ownerSubject = `Neue Brötchen-Bestellung (${r.total_count || 0}) – ${r.name || "ohne Name"}`;
    ownerHtml = `
      <h2>Neue Brötchen-Bestellung</h2>
      <p><strong>Name:</strong> ${esc(r.name)}<br>
      <strong>Abholung:</strong> ${esc(r.pickup_date)} ${esc(r.pickup_time)}<br>
      <strong>Anzahl:</strong> ${esc(r.total_count)} Brötchen<br>
      <strong>Telefon:</strong> ${esc(r.phone)}<br>
      <strong>E-Mail:</strong> ${esc(r.email)}</p>
      <p><strong>Bestellung:</strong><br>${items}</p>
      <p><strong>Hinweis:</strong> ${esc(r.notes) || "—"}</p>
      <p>${ADMIN}</p>`;
  }

  await sendMail(MAIL_TO, ownerSubject, ownerHtml);
  return new Response("ok", { status: 200 });
});
