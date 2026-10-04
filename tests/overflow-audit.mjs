/**
 * Layout-Schranke: horizontaler Overflow darf NIRGENDS auftreten.
 *
 * Hintergrund: Ein seitlich überlaufender Admin-Header hat es einmal bis
 * aufs Handy geschafft, weil nur visuell und nur in zwei Breiten geprüft
 * wurde. Dieses Skript prüft jede Seite, jeden eingeloggten Admin-Bereich
 * und die wichtigsten Zwischenzustände (mobiles Menü offen, Hinweis-Banner
 * sichtbar) über eine ganze Reihe von Gerätebreiten — und schlägt fehl,
 * sobald `documentElement.scrollWidth > clientWidth` ist (= die Seite lässt
 * sich seitlich scrollen). Genau dieser Wert ist das verlässliche Signal:
 * dekorative Elemente, die bewusst über den Rand ragen aber von einem
 * `overflow:hidden`-Vorfahren beschnitten werden, lösen ihn nicht aus.
 *
 * Lauf:  npm test      (startet einen lokalen Server und prüft alles)
 * Exit:  0 = sauber, 1 = mindestens ein Overflow gefunden.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8137;
const TOLERANCE = 1; // 1px Sub-Pixel-Toleranz

// Breiten-Matrix: vom kleinsten verbreiteten Handy bis zum großen Desktop.
const WIDTHS = [320, 360, 375, 390, 414, 430, 480, 540, 600, 768, 834, 1024, 1280, 1440];

// Alle ausgelieferten Seiten.
const PAGES = [
  'index.html', 'speisekarte.html', 'broetchen.html', 'mittagstisch.html',
  'reservierung.html', 'kontakt.html', 'ueber-uns.html',
  'impressum.html', 'datenschutz.html', '404.html',
];

const ADMIN_PANELS = ['week', 'anfragen', 'bestellungen', 'menu', 'design', 'notice', 'hours', 'account'];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
};

// Winziger statischer Server — keine externen Abhängigkeiten, läuft auch in CI.
function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel === '/') rel = '/index.html';
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(PORT, () => resolve(srv));
  });
}

// Misst die Seite und liefert bei Overflow die schuldigen Elemente zurück.
const MEASURE = () => {
  const de = document.documentElement;
  const over = de.scrollWidth - de.clientWidth;
  const culprits = [];
  if (over > 1) {
    const cw = de.clientWidth;
    const seen = new Set();
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right > cw + 1 && r.width > 0) {
        if (getComputedStyle(el).position === 'fixed') return;
        const cls = (el.className && el.className.toString().slice(0, 50)) || el.tagName.toLowerCase();
        if (seen.has(cls)) return; seen.add(cls);
        culprits.push({ cls, right: Math.round(r.right), w: Math.round(r.width) });
      }
    });
    culprits.sort((a, b) => b.right - a.right);
  }
  return { scroll: de.scrollWidth, client: de.clientWidth, over, culprits: culprits.slice(0, 5) };
};

// Blendet den eingeloggten Admin-Arbeitsbereich ein und aktiviert ein Panel.
function revealAdminPanel(panel) {
  const a = document.getElementById('admin-actions'); if (a) a.hidden = false;
  document.querySelectorAll('#login-view, .admin-login').forEach((el) => { el.hidden = true; });
  const ov = document.getElementById('overview-view'); if (ov) ov.hidden = true;
  const ws = document.getElementById('workspace-view'); if (ws) ws.hidden = false;
  try {
    if (window.ALSTERCAFE_MENU_DEFAULT && typeof renderMenuEditor === 'function') {
      renderMenuEditor(window.ALSTERCAFE_MENU_DEFAULT);
    }
  } catch (e) { /* Editor evtl. nicht global — Struktur reicht für die Messung */ }
  document.querySelectorAll('.admin-panel').forEach((el) => { el.hidden = true; el.classList.remove('is-active'); });
  const pan = document.getElementById('panel-' + panel);
  if (pan) { pan.hidden = false; pan.classList.add('is-active'); }
}

const failures = [];
let activeTag = '';
function record(label, w, m) {
  if (m.over > TOLERANCE) {
    const full = activeTag ? `[${activeTag}] ${label}` : label;
    failures.push({ label: full, w, over: m.over, culprits: m.culprits });
    console.log(`  ✗ ${full} @${w}px  OVERFLOW +${m.over}px  ${JSON.stringify(m.culprits)}`);
  }
}

const srv = await startServer();
const base = `http://localhost:${PORT}`;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
let checks = 0;

// Beide Sprachen prüfen — englischer Text hat andere Längen und könnte
// eigene Overflows auslösen (der Grund, warum es diese Schranke gibt).
const LANGS = ['de', 'en'];

try {
 for (const lang of LANGS) {
  const context = await browser.newContext();
  await context.addInitScript((l) => { try { localStorage.setItem('alstercafe.lang', l); } catch (e) {} }, lang);
  activeTag = lang.toUpperCase();
  for (const w of WIDTHS) {
    const page = await context.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1, isMobile: w < 700 });
    // Externe Requests (Fonts, Supabase) abklemmen — wir testen Layout, nicht Netzwerk.
    await page.route('**/*', (r) => {
      const u = r.request().url();
      return (u.includes('localhost') || u.startsWith('data:')) ? r.continue() : r.abort();
    });

    for (const pg of PAGES) {
      await page.goto(`${base}/${pg}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(400);
      record(pg, w, await page.evaluate(MEASURE)); checks++;

      // Zustand: Hinweis-Banner sichtbar (falls vorhanden).
      const hasNotice = await page.evaluate(() => {
        const n = document.getElementById('notice-banner');
        if (!n) return false;
        n.hidden = false; const t = document.getElementById('notice-text');
        if (t) t.textContent = 'Am 1. Mai geschlossen — wir wünschen schöne Feiertage!';
        return true;
      });
      if (hasNotice) { record(`${pg} [Hinweis-Banner]`, w, await page.evaluate(MEASURE)); checks++; }

      // Zustand: mobiles Menü offen (nur dort, wo der Toggle sichtbar ist).
      if (w < 980) {
        const opened = await page.evaluate(() => {
          const btn = document.querySelector('.nav-toggle');
          if (!btn || getComputedStyle(btn).display === 'none') return false;
          btn.click(); return true;
        });
        if (opened) {
          await page.waitForTimeout(350);
          record(`${pg} [Menü offen]`, w, await page.evaluate(MEASURE)); checks++;
          await page.evaluate(() => { const b = document.querySelector('.nav-toggle'); if (b) b.click(); });
        }
      }
    }

    // Admin: jedes Panel im eingeloggten Zustand.
    await page.goto(`${base}/admin.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(500);
    record('admin.html [Login]', w, await page.evaluate(MEASURE)); checks++;
    for (const panel of ADMIN_PANELS) {
      await page.evaluate(revealAdminPanel, panel);
      await page.waitForTimeout(200);
      record(`admin.html [${panel}]`, w, await page.evaluate(MEASURE)); checks++;
    }

    await page.close();
  }
  await context.close();
 }
} finally {
  await browser.close();
  srv.close();
}

console.log(`\n${checks} Prüfungen über ${WIDTHS.length} Breiten × ${LANGS.length} Sprachen.`);
if (failures.length) {
  console.error(`\n❌ ${failures.length} Overflow-Fehler gefunden. Seite darf so nicht live gehen.`);
  process.exit(1);
}
console.log('✅ Kein horizontaler Overflow — alle Seiten und Zustände sauber.');
