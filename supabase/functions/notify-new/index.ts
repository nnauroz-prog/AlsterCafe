// Supabase Edge Function: notify-new
// ---------------------------------------------------------------------------
// Wird per Database-Webhook bei INSERT in `reservations` / `orders` aufgerufen
// und verschickt zwei Mails:
//   1. Benachrichtigung an den Inhaber (MAIL_TO) mit allen Daten.
//   2. Eingangsbestätigung an den Gast (record.email, falls angegeben):
//      "Wir haben Ihre Anfrage erhalten" im Café-Design. Ausdrücklich noch
//      KEINE Zusage; die verbindliche Bestätigung schickt der Inhaber per
//      Knopf im Mitgliederbereich (Edge Function 'send-confirmation').
//
// Versand über das eigene STRATO-Postfach per SMTP mit Nodemailer:
//   smtp.strato.de, Port 465 (SSL/TLS), Login = volle Adresse + Postfach-Passwort.
// Secrets: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
//   MAIL_FROM (From MUSS = SMTP_USER sein), MAIL_TO, REPLY_TO, optional WEBHOOK_SECRET.
//
// Robust: ein fehlgeschlagener Mailversand wird nur geloggt, nie geworfen.
// Die Anfrage selbst liegt bereits sicher in der Datenbank.
// ---------------------------------------------------------------------------

import nodemailer from "npm:nodemailer@6.9.16";

const SMTP_HOST = Deno.env.get("SMTP_HOST") || "smtp.strato.de";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USER = Deno.env.get("SMTP_USER") || "";
const SMTP_PASS = Deno.env.get("SMTP_PASS") || "";
const MAIL_FROM = Deno.env.get("MAIL_FROM") || "Alstercafé <info@alstercafe.de>";
const MAIL_TO = Deno.env.get("MAIL_TO") || "info@alstercafe.de";
const REPLY_TO = Deno.env.get("REPLY_TO") || MAIL_TO;
// Optionaler Schutz: wenn gesetzt, muss der Webhook den Header
// "x-webhook-secret" mit genau diesem Wert senden.
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") || "";
// Von Supabase automatisch bereitgestellt. Damit lesen wir den Datensatz
// selbst aus der Datenbank nach, statt dem mitgeschickten Inhalt zu trauen.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
// Nur ganz frische Einträge lösen Mails aus (Webhook feuert sofort).
const MAX_AGE_MS = 3 * 60 * 1000;

const LOGO = "https://alstercafe.de/image.png";
const ADMIN = "Im Mitgliederbereich ansehen: https://alstercafe.de/admin.html";

// Berliner-Vorbestellungen landen in derselben Tabelle; erkennbar am Feld kind.
function isBerlinerOrder(r: any): boolean {
  return Array.isArray(r?.items) && r.items.some((it: any) => it && it.kind === "berliner");
}

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

// "2026-10-19" -> "Montag, 19. Oktober 2026"; alles andere unverändert.
function niceDate(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  try {
    return new Date(s + "T12:00:00Z").toLocaleDateString("de-DE", {
      weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin",
    });
  } catch { return s; }
}

// Bestellpositionen mit Preis (falls bei der Bestellung gespeichert) + Summe.
function eur(n: number): string {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}
function itemLines(items: unknown): { html: string; total: number | null; partial: boolean } {
  const list = Array.isArray(items) ? items : [];
  let cents = 0, priced = 0;
  const html = list.map((it: any) => {
    const q = parseInt(it?.qty, 10) || 0;
    const p = typeof it?.price === "number" && it.price > 0 ? it.price : null;
    if (p) { cents += Math.round(p * 100) * q; priced++; }
    return `${esc(it?.qty)}× ${esc(it?.name)}${p ? ` · ${eur(p * q)}` : ""}`;
  }).join("<br>");
  return { html, total: priced ? cents / 100 : null, partial: priced > 0 && priced < list.length };
}

function htmlToText(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h1|h2)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
}

async function sendMail(to: string, subject: string, html: string, replyTo?: string): Promise<void> {
  if (!SMTP_USER || !SMTP_PASS) { console.error("SMTP-Zugang (SMTP_USER/SMTP_PASS) fehlt – kein Versand"); return; }
  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    await transporter.sendMail({
      from: MAIL_FROM,
      to,
      replyTo: (replyTo && replyTo.includes("@")) ? replyTo : undefined,
      subject,
      html,
      text: htmlToText(html),
    });
    console.log("Mail gesendet an", to);
  } catch (e) {
    console.error("Mailversand fehlgeschlagen an", to, e);
  }
}

// Eingangsbestätigung für den Gast, im selben Design wie die Bestätigungsmail.
function renderReceipt(table: string, r: any): { subject: string; html: string } {
  const BEAN = "#3D2415", GOLD = "#B8893E", CREAM = "#FFFCF4", PAPER = "#FBF7EE", INK = "#2A1810", MUTED = "#7A6152";
  const row = (label: string, value: string) =>
    value ? `<tr>
      <td style="padding:4px 0;color:${MUTED};font-size:13px;width:140px;vertical-align:top;">${esc(label)}</td>
      <td style="padding:4px 0;color:${INK};font-size:15px;font-weight:600;">${esc(value)}</td>
    </tr>` : "";

  let title = "", intro = "", rows = "", subject = "";
  if (table === "orders") {
    const { html: items, total, partial } = itemLines(r.items);
    const unit = isBerlinerOrder(r) ? "Berliner" : "Brötchen";
    subject = `Wir haben Ihre ${unit}-Bestellung erhalten – Alstercafé`;
    title = "Ihre Bestellung ist bei uns eingegangen";
    intro = "vielen Dank für Ihre Vorbestellung! Wir prüfen sie umgehend und senden Ihnen in Kürze eine Bestätigung.";
    rows = row("Abholung", `${niceDate(r.pickup_date)} ${r.pickup_time ? r.pickup_time + " Uhr" : ""}`.trim())
      + row("Anzahl", r.total_count ? `${r.total_count} ${unit}` : "")
      + (items ? `<tr><td style="padding:8px 0 4px;color:${MUTED};font-size:13px;vertical-align:top;">Bestellung</td><td style="padding:8px 0 4px;color:${INK};font-size:15px;line-height:1.6;">${items}</td></tr>` : "")
      + (total !== null ? row("Summe", eur(total) + (partial ? " (ohne Sorten ohne Preis)" : "")) + row("Bezahlung", "bei Abholung") : "");
  } else {
    subject = "Wir haben Ihre Reservierungsanfrage erhalten – Alstercafé";
    title = "Ihre Anfrage ist bei uns eingegangen";
    intro = "vielen Dank für Ihre Reservierungsanfrage! Wir prüfen umgehend, ob der gewünschte Tisch verfügbar ist, und senden Ihnen in Kürze eine verbindliche Bestätigung.";
    rows = row("Datum", niceDate(r.date))
      + row("Uhrzeit", r.time ? `${r.time} Uhr` : "")
      + row("Personen", r.persons ? String(r.persons) : "");
  }

  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:${CREAM};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #ECE3D4;border-radius:14px;overflow:hidden;">
        <tr><td style="background:${BEAN};padding:26px 32px;text-align:center;">
          <img src="${LOGO}" width="52" height="52" alt="Alstercafé" style="display:inline-block;border-radius:50%;background:#fff;">
          <div style="color:${CREAM};font-family:Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:.5px;margin-top:8px;">Alstercafé</div>
          <div style="color:${GOLD};font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-top:4px;">Bäckerei · Café · Hohenfelde</div>
        </td></tr>
        <tr><td style="padding:34px 32px 28px;font-family:Arial,Helvetica,sans-serif;color:${INK};">
          <h1 style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;font-weight:normal;color:${BEAN};">${esc(title)}</h1>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${INK};">Moin ${esc(r.name) || "zusammen"},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${INK};">${intro}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};border:1px solid #ECE3D4;border-radius:10px;padding:16px 18px;margin:0 0 18px;">
            ${rows}
          </table>
          <p style="margin:0 0 18px;padding:10px 14px;background:#FFF7E6;border-left:3px solid ${GOLD};font-size:13px;line-height:1.6;color:${INK};">Bitte beachten Sie: Dies ist eine <strong>Eingangsbestätigung</strong>, noch keine verbindliche Zusage.</p>
          <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:${MUTED};">Haben Sie Fragen oder eilt es? Antworten Sie einfach auf diese Mail oder rufen Sie uns kurz an.</p>
        </td></tr>
        <tr><td style="background:${PAPER};padding:20px 32px;border-top:1px solid #ECE3D4;font-family:Arial,sans-serif;">
          <div style="font-size:13px;color:${BEAN};font-weight:bold;">Alstercafé</div>
          <div style="font-size:13px;color:${MUTED};line-height:1.7;">
            Ifflandstraße 45 · 22087 Hamburg<br>
            Tel. <a href="tel:+494022692891" style="color:${GOLD};text-decoration:none;">040 – 22 69 28 91</a> ·
            <a href="https://alstercafe.de" style="color:${GOLD};text-decoration:none;">alstercafe.de</a>
          </div>
        </td></tr>
      </table>
      <div style="max-width:560px;margin:14px auto 0;font-family:Arial,sans-serif;font-size:11px;color:#B3A694;text-align:center;line-height:1.5;">
        Sie erhalten diese Nachricht, weil Sie auf alstercafe.de eine Anfrage gestellt haben.
        Wir verwenden Ihre Kontaktdaten nur zur Bearbeitung Ihrer Anfrage.
      </div>
    </td></tr>
  </table>
</body></html>`;
  return { subject, html };
}

Deno.serve(async (req) => {
  if (WEBHOOK_SECRET && req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 401 });
  }
  let payload: any;
  try { payload = await req.json(); } catch { return new Response("bad request", { status: 400 }); }

  const table = payload?.table;
  if (payload?.type !== "INSERT" || (table !== "reservations" && table !== "orders")) {
    return new Response("ignored", { status: 200 });
  }

  // Schutz gegen Missbrauch: Die Funktion ist mit dem öffentlichen Schlüssel
  // aufrufbar. Damit niemand über sie Mails an beliebige Adressen auslöst,
  // zählt nur ein Datensatz, der wirklich gerade in der Datenbank angelegt wurde.
  const id = String(payload?.record?.id ?? "");
  if (!id || !SUPABASE_URL || !SERVICE_KEY) {
    console.warn("notify-new: ohne id oder Server-Schlüssel – ignoriert");
    return new Response("ignored", { status: 200 });
  }
  let r: any = null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const rows = res.ok ? await res.json() : [];
    r = Array.isArray(rows) ? rows[0] : null;
  } catch (e) {
    console.error("notify-new: Datensatz nicht lesbar", e);
  }
  const age = r ? Date.now() - new Date(r.received_at).getTime() : Infinity;
  if (!r || !(age >= -60000 && age <= MAX_AGE_MS)) {
    console.warn("notify-new: Datensatz fehlt oder ist nicht frisch – keine Mail", id);
    return new Response("ignored", { status: 200 });
  }

  let ownerSubject = "", ownerHtml = "";
  if (table === "reservations") {
    ownerSubject = `Neue Reservierungsanfrage – ${r.name || "ohne Name"}`;
    ownerHtml = `
      <h2>Neue Reservierungsanfrage</h2>
      <p><strong>Name:</strong> ${esc(r.name)}<br>
      <strong>Datum / Uhrzeit:</strong> ${esc(niceDate(r.date))} ${esc(r.time)}<br>
      <strong>Personen:</strong> ${esc(r.persons)}<br>
      <strong>Telefon:</strong> ${esc(r.phone)}<br>
      <strong>E-Mail:</strong> ${esc(r.email)}<br>
      <strong>Nachricht:</strong> ${esc(r.message) || "—"}</p>
      <p>${ADMIN}</p>`;
  } else {
    const { html: items, total, partial } = itemLines(r.items);
    const unit = isBerlinerOrder(r) ? "Berliner" : "Brötchen";
    ownerSubject = `Neue ${unit}-Bestellung (${r.total_count || 0}) – ${r.name || "ohne Name"}`;
    ownerHtml = `
      <h2>Neue ${unit}-Bestellung</h2>
      <p><strong>Name:</strong> ${esc(r.name)}<br>
      <strong>Abholung:</strong> ${esc(niceDate(r.pickup_date))} ${esc(r.pickup_time)}<br>
      <strong>Anzahl:</strong> ${esc(r.total_count)} ${unit}<br>
      <strong>Telefon:</strong> ${esc(r.phone)}<br>
      <strong>E-Mail:</strong> ${esc(r.email)}</p>
      <p><strong>Bestellung:</strong><br>${items}</p>
      ${total !== null ? `<p><strong>Summe:</strong> ${eur(total)}${partial ? " (ohne Sorten ohne Preis)" : ""}</p>` : ""}
      <p><strong>Hinweis:</strong> ${esc(r.notes) || "—"}</p>
      <p>${ADMIN}</p>`;
  }

  const guestEmail = typeof r.email === "string" && r.email.includes("@") ? r.email.trim() : "";
  const jobs: Promise<void>[] = [
    // An den Inhaber; "Antworten" geht direkt an den Gast.
    sendMail(MAIL_TO, ownerSubject, ownerHtml, guestEmail || undefined),
  ];
  if (guestEmail) {
    const { subject, html } = renderReceipt(table, r);
    // An den Gast; "Antworten" geht an das Café.
    jobs.push(sendMail(guestEmail, subject, html, REPLY_TO));
  }
  await Promise.allSettled(jobs);
  return new Response("ok", { status: 200 });
});
