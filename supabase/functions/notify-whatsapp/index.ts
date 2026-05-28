// ============================================================
// Alstercafé · WhatsApp-Benachrichtigung (Supabase Edge Function)
// ============================================================
// Wird per Database-Webhook bei jedem INSERT in die Tabellen
// `orders` (Brötchen-Bestellungen) und `reservations` aufgerufen
// und schickt dem Inhaber eine WhatsApp-Nachricht aufs Handy.
//
// DSGVO: Die Nachricht enthält KEINE Kundendaten (kein Name, keine
// Telefonnummer, keine E-Mail) — nur Anzahl, Datum und Uhrzeit.
// Die Details sieht der Inhaber im Mitgliederbereich.
//
// Versand über CallMeBot (kostenloser WhatsApp-Self-Notify-Dienst).
// Setup-Anleitung: siehe WHATSAPP-SETUP.md
// ============================================================

const PHONE  = Deno.env.get("WHATSAPP_PHONE")    ?? ""; // z. B. +4915112345678
const APIKEY = Deno.env.get("CALLMEBOT_APIKEY")  ?? "";
const SECRET = Deno.env.get("WEBHOOK_SECRET")    ?? ""; // gemeinsames Geheimnis mit dem Webhook

Deno.serve(async (req) => {
  // 1. Nur POST
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // 2. Absicherung gegen fremde Aufrufe der öffentlichen Funktion
  if (SECRET && req.headers.get("x-webhook-secret") !== SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

  // 3. Payload lesen (Supabase-DB-Webhook: { type, table, record, ... })
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const table = payload?.table;
  const row = payload?.record ?? payload?.new ?? {};
  const message = buildMessage(table, row);
  if (!message) return new Response("ignored", { status: 200 });

  if (!PHONE || !APIKEY) {
    console.error("WHATSAPP_PHONE oder CALLMEBOT_APIKEY fehlt als Secret.");
    return new Response("config missing", { status: 500 });
  }

  // 4. WhatsApp senden
  const url = "https://api.callmebot.com/whatsapp.php"
    + `?phone=${encodeURIComponent(PHONE)}`
    + `&apikey=${encodeURIComponent(APIKEY)}`
    + `&text=${encodeURIComponent(message)}`;

  try {
    const res = await fetch(url);
    const body = await res.text();
    return new Response(JSON.stringify({ ok: res.ok, status: res.status, body }), {
      status: res.ok ? 200 : 502,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("WhatsApp-Versand fehlgeschlagen:", err);
    return new Response("send failed", { status: 502 });
  }
});

// ---------- Nachricht bauen (ohne personenbezogene Daten) ----------
function buildMessage(table: string, row: Record<string, unknown>): string | null {
  if (table === "orders") {
    const count = Number(row.total_count ?? 0);
    const when = formatWhen(String(row.pickup_date ?? ""), String(row.pickup_time ?? ""));
    return `Alstercafé — neue Brötchen-Bestellung: ${count} Stück. Abholung: ${when}. Details im Mitgliederbereich.`;
  }
  if (table === "reservations") {
    const persons = String(row.persons ?? "").trim() || "Reservierung";
    const when = formatWhen(String(row.date ?? ""), String(row.time ?? ""));
    return `Alstercafé — neue Reservierung: ${persons}. Termin: ${when}. Details im Mitgliederbereich.`;
  }
  return null;
}

function formatWhen(date: string, time: string): string {
  if (!date) return time ? `${time} Uhr` : "offen";
  try {
    const d = new Date(date + "T00:00:00");
    const s = d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
    return time ? `${s} um ${time} Uhr` : s;
  } catch {
    return time ? `${date} ${time}` : date;
  }
}
