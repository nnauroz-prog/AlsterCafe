// Supabase Edge Function: send-confirmation
// ---------------------------------------------------------------------------
// Wird vom Mitgliederbereich per Knopf aufgerufen ("Bestätigung senden") und
// schickt dem Gast eine professionell gestaltete HTML-Bestätigungsmail (mit
// Logo & Café-Branding) über das EIGENE STRATO-Postfach per SMTP.
//
// Nur für eingeloggte Inhaber: der Aufruf muss ein gültiges Supabase-User-
// Token (Authorization: Bearer …) mitbringen; das wird gegen die Auth-API
// geprüft. Der öffentliche anon-Key allein genügt NICHT.
//
// Versand per Nodemailer: smtp.strato.de, Port 465 (SSL/TLS), Login = volle Adresse +
// Postfach-Passwort. From MUSS = SMTP_USER (z. B. reservierung@alstercafe.de) sein.
// Secrets: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, [REPLY_TO].
// SUPABASE_URL / SUPABASE_ANON_KEY werden von Supabase automatisch bereitgestellt.
// ---------------------------------------------------------------------------

import nodemailer from "npm:nodemailer@6.9.16";

const SMTP_HOST = Deno.env.get("SMTP_HOST") || "smtp.strato.de";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USER = Deno.env.get("SMTP_USER") || "";
const SMTP_PASS = Deno.env.get("SMTP_PASS") || "";
const MAIL_FROM = Deno.env.get("MAIL_FROM") || "Alstercafé <info@alstercafe.de>";
// Antworten des Gastes auf die Bestätigungsmail sollen beim Inhaber landen.
// REPLY_TO setzen, sonst Fallback auf MAIL_TO; fehlt beides, wird kein reply_to gesetzt.
const REPLY_TO = Deno.env.get("REPLY_TO") || Deno.env.get("MAIL_TO") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

const LOGO = "https://alstercafe.de/image.png";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

// Einfache Text-Fassung der HTML-Mail (für Mailprogramme ohne HTML).
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
    .replace(/<\/(p|div|tr|h1)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
}

// Prüft, ob der Aufrufer ein echter eingeloggter Nutzer ist (nicht nur anon).
async function isOwner(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    if (!res.ok) return false;
    const u = await res.json();
    return !!(u && u.id && u.role === "authenticated");
  } catch { return false; }
}

// Professionell gestaltete HTML-Mail (Inline-Styles, Tabellen-Layout für
// E-Mail-Client-Kompatibilität, Logo oben, Café-Farben).
function renderEmail(type: string, d: any): { subject: string; html: string } {
  const BEAN = "#3D2415", GOLD = "#B8893E", CREAM = "#FFFCF4", PAPER = "#FBF7EE", INK = "#2A1810", MUTED = "#7A6152";
  const detailRow = (label: string, value: string) =>
    value ? `<tr>
      <td style="padding:4px 0;color:${MUTED};font-size:13px;width:140px;vertical-align:top;">${esc(label)}</td>
      <td style="padding:4px 0;color:${INK};font-size:15px;font-weight:600;">${esc(value)}</td>
    </tr>` : "";

  let title = "", intro = "", rows = "";
  const unit = Array.isArray(d.items) && d.items.some((it: any) => it && it.kind === "berliner") ? "Berliner" : "Brötchen";
  if (type === "order") {
    const { html: items, total, partial } = itemLines(d.items);
    title = "Ihre Bestellung ist bestätigt";
    intro = `vielen Dank für Ihre Vorbestellung. Wir haben sie fest eingeplant und freuen uns auf Sie.`;
    rows = detailRow("Abholung", `${d.pickupDate || ""} ${d.pickupTime ? d.pickupTime + " Uhr" : ""}`.trim())
      + detailRow("Anzahl", d.total ? `${d.total} ${unit}` : "")
      + (items ? `<tr><td style="padding:8px 0 4px;color:${MUTED};font-size:13px;vertical-align:top;">Bestellung</td><td style="padding:8px 0 4px;color:${INK};font-size:15px;line-height:1.6;">${items}</td></tr>` : "")
      + (total !== null ? detailRow("Summe", eur(total) + (partial ? " (ohne Sorten ohne Preis)" : "")) + detailRow("Bezahlung", "bei Abholung") : "");
  } else {
    title = "Ihre Reservierung ist bestätigt";
    intro = `vielen Dank für Ihre Reservierung. Ihr Tisch ist reserviert — wir freuen uns auf Ihren Besuch.`;
    rows = detailRow("Datum", d.date || "")
      + detailRow("Uhrzeit", d.time ? `${d.time} Uhr` : "")
      + detailRow("Personen", d.persons || "");
  }

  // Optionale persönliche Nachricht des Cafés (aus dem Fenster im Mitgliederbereich).
  // Leer → kein Kasten, die Mail bleibt unverändert.
  const note = String(d.message ?? "").trim().slice(0, 1000);
  const noteHtml = note
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
            <tr><td style="background:#FFF7E6;border-left:3px solid ${GOLD};border-radius:0 8px 8px 0;padding:14px 16px;">
              <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};font-weight:bold;margin:0 0 6px;">Persönliche Nachricht vom Alstercafé</div>
              <div style="font-size:15px;line-height:1.6;color:${INK};">${esc(note).replace(/\r?\n/g, "<br>")}</div>
            </td></tr>
          </table>`
    : "";

  const subject = type === "order" ? `Bestätigung Ihrer ${unit}-Bestellung – Alstercafé` : "Bestätigung Ihrer Reservierung – Alstercafé";
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:${CREAM};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #ECE3D4;border-radius:14px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:${BEAN};padding:26px 32px;text-align:center;">
          <img src="${LOGO}" width="52" height="52" alt="Alstercafé" style="display:inline-block;border-radius:50%;background:#fff;">
          <div style="color:${CREAM};font-family:Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:.5px;margin-top:8px;">Alstercafé</div>
          <div style="color:${GOLD};font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-top:4px;">Bäckerei · Café · Hohenfelde</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:34px 32px 28px;font-family:Arial,Helvetica,sans-serif;color:${INK};">
          <h1 style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;font-weight:normal;color:${BEAN};">${esc(title)}</h1>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${INK};">Moin ${esc(d.name) || "zusammen"},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${INK};">${intro}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};border:1px solid #ECE3D4;border-radius:10px;padding:16px 18px;margin:0 0 22px;">
            ${rows}
          </table>
          ${noteHtml}
          <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:${MUTED};">Sollte etwas nicht passen, rufen Sie uns gern kurz an — wir finden eine Lösung.</p>
        </td></tr>
        <!-- Footer -->
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
        Diese Nachricht bestätigt Ihre Anfrage beim Alstercafé. Sie haben uns dafür Ihre
        Kontaktdaten übermittelt; wir verwenden sie nur zur Bearbeitung Ihrer Anfrage.
      </div>
    </td></tr>
  </table>
</body></html>`;
  return { subject, html };
}

Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    console.error("Unerwarteter Fehler", e);
    return new Response(JSON.stringify({ error: "Unerwarteter Fehler: " + ((e && (e as any).message) || String(e)) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: CORS });

  if (!(await isOwner(req))) {
    return new Response(JSON.stringify({ error: "nicht angemeldet" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  if (!SMTP_USER || !SMTP_PASS) {
    return new Response(JSON.stringify({ error: "E-Mail-Versand noch nicht eingerichtet (SMTP_USER/SMTP_PASS fehlt)." }), { status: 503, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  let body: any;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "bad request" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }); }
  const to = String(body?.email || "").trim();
  if (!to.includes("@")) {
    return new Response(JSON.stringify({ error: "Keine gültige Gast-E-Mail vorhanden." }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const { subject, html } = renderEmail(body?.type === "order" ? "order" : "reservation", body);
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
      replyTo: REPLY_TO || undefined,
      subject,
      html,
      text: htmlToText(html),
    });
  } catch (e) {
    console.error("Versand fehlgeschlagen", e);
    return new Response(JSON.stringify({ error: "Versand fehlgeschlagen: " + ((e && (e as any).message) || String(e)) }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
}
