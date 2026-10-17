// Supabase Edge Function: notify-new
// ---------------------------------------------------------------------------
// Wird per Database-Webhook bei INSERT in `reservations` / `orders` aufgerufen
// und verschickt eine Benachrichtigung an den Inhaber (MAIL_TO).
//
// Versand über das EIGENE STRATO-Postfach per SMTP (kein Fremddienst):
//   smtp.strato.de, Port 465 (SSL/TLS), Login = volle Adresse + Postfach-Passwort.
// Dadurch kommt die Mail von info@alstercafe.de (offiziell, gute Zustellbarkeit
// über STRATOs eigenes SPF/DKIM) und es ist keine DNS-/Domain-Verifizierung nötig.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   SMTP_HOST (Standard smtp.strato.de), SMTP_PORT (Standard 465),
//   SMTP_USER = info@alstercafe.de, SMTP_PASS = Postfach-Passwort,
//   MAIL_FROM = "Alstercafé <info@alstercafe.de>" (From MUSS = SMTP_USER sein),
//   MAIL_TO = info@alstercafe.de, optional REPLY_TO, optional WEBHOOK_SECRET.
//
// Robust: ein fehlgeschlagener Mailversand wird nur geloggt, nie geworfen —
// die Anfrage selbst liegt bereits sicher in der Datenbank.
// ---------------------------------------------------------------------------

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SMTP_HOST = Deno.env.get("SMTP_HOST") || "smtp.strato.de";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USER = Deno.env.get("SMTP_USER") || "";
const SMTP_PASS = Deno.env.get("SMTP_PASS") || "";
const MAIL_FROM = Deno.env.get("MAIL_FROM") || "Alstercafé <info@alstercafe.de>";
const MAIL_TO = Deno.env.get("MAIL_TO") || "info@alstercafe.de";
// Optionaler Schutz: wenn gesetzt, muss der Webhook den Header
// "x-webhook-secret" mit genau diesem Wert senden.
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") || "";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

async function sendMail(subject: string, html: string, replyTo?: string): Promise<void> {
  if (!SMTP_USER || !SMTP_PASS) { console.error("SMTP-Zugang (SMTP_USER/SMTP_PASS) fehlt – kein Versand"); return; }
  const client = new SMTPClient({
    connection: { hostname: SMTP_HOST, port: SMTP_PORT, tls: true, auth: { username: SMTP_USER, password: SMTP_PASS } },
  });
  try {
    await client.send({
      from: MAIL_FROM,
      to: MAIL_TO,
      // reply_to = Gast-Adresse: der Inhaber kann in seinem Mailprogramm direkt
      // auf "Antworten" tippen und schreibt sofort an den Gast.
      replyTo: (replyTo && replyTo.includes("@")) ? replyTo : undefined,
      subject,
      content: "auto",
      html,
    });
    console.log("Mail gesendet an", MAIL_TO);
  } catch (e) {
    console.error("Mailversand fehlgeschlagen an", MAIL_TO, e);
  } finally {
    try { await client.close(); } catch (_) { /* ignore */ }
  }
}

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

  await sendMail(ownerSubject, ownerHtml, typeof r.email === "string" ? r.email : undefined);
  return new Response("ok", { status: 200 });
});
