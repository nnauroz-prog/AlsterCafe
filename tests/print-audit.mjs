/**
 * Druck-Schranke: Jeder Druck-Knopf im Mitgliederbereich muss wirklich drucken.
 *
 * Hintergrund: Alle fünf Druck-Knöpfe (Tagesliste, Speisekarte, Mittagstisch-Aushang,
 * Bewertungs-Aushang, Berliner-Backliste) blieben auf der Live-Seite ohne Wirkung, weil das
 * Druck-Dokument in einem versteckten blob:-Rahmen lag und die Sicherheits-Kopfzeile der Seite
 * (Content-Security-Policy, frame-src) solche Rahmen blockiert. Lokal fiel das nie auf – dort
 * fehlte die Kopfzeile. Dieses Skript liefert die Seite deshalb mit GENAU der Kopfzeile aus
 * vercel.json aus und prüft für jeden Druck-Knopf, bei Handy- und Computer-Breite:
 *
 *   1. window.print() der Seite wird genau einmal aufgerufen – direkt im Klick (ohne Wartezeit,
 *      nur so öffnet sich der Druckdialog am iPhone verlässlich).
 *   2. Im Druckbild ist ausschließlich das Druck-Dokument sichtbar (kein Rest des
 *      Mitgliederbereichs, keine Copyright-Zeile, weißer Grund).
 *   3. Die Seitenzahl stimmt (Aushang: ein Blatt je Seite, nichts läuft über).
 *   4. Nach dem nächsten Tipp ist alles wieder aufgeräumt.
 *   5. Die Sicherheits-Kopfzeile wurde dabei nirgends verletzt.
 *
 * Dazu eine Prüfung des Instagram-Bildes: Auch eine Woche mit sehr langen Texten passt auf
 * ein Bild, ohne in die Fußzeile zu laufen.
 *
 * Lauf:  npm test   (oder: npm run test:print)
 * Exit:  0 = sauber, 1 = mindestens eine Prüfung fehlgeschlagen.
 * Nur Testdaten (Name „Test“), lokaler Modus, keine Datenbank.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8139;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

// Die Sicherheits-Kopfzeile genau so, wie die Live-Seite sie sendet.
function liveCsp() {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  for (const block of cfg.headers || []) {
    for (const h of block.headers || []) if (/^content-security-policy$/i.test(h.key)) return h.value;
  }
  return '';
}
const CSP = liveCsp();

function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel === '/') rel = '/index.html';
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      const head = { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' };
      if (CSP) head['content-security-policy'] = CSP;
      res.writeHead(200, head);
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(PORT, () => resolve(srv));
  });
}

// Feste Uhr: Dienstag, 10.11.2026 – die Testdaten liegen in dieser Woche.
const NOW = '2026-11-10T10:00:00';
const TODAY = '2026-11-10', TOMORROW = '2026-11-11', MONDAY = '2026-11-09';
const RES = [
  { id: 't1', name: 'Test', phone: '040 000001', email: 'test1@example.com', date: TODAY, time: '12:00', persons: '4 Personen', message: 'Test-Nachricht', status: 'new', confirmedAt: '2026-11-09T12:00:00', receivedAt: '2026-11-10T08:10:00' },
  { id: 't2', name: 'Test', phone: '040 000002', email: '', date: TODAY, time: '13:30', persons: '2 Personen', message: '', status: 'new', receivedAt: '2026-11-09T18:00:00' },
];
const ORD = [
  { id: 'o1', name: 'Test', phone: '040 000009', email: 'test9@example.com', pickupDate: TODAY, pickupTime: '08:00', totalCount: 12, items: [{ name: 'Käse', qty: 12 }], status: 'new', receivedAt: '2026-11-10T07:00:00' },
  { id: 'o2', name: 'Test', phone: '040 000008', email: 'test8@example.com', pickupDate: TOMORROW, pickupTime: '07:30', totalCount: 24, items: [{ name: 'Berliner Test', qty: 24, kind: 'berliner' }], status: 'new', receivedAt: '2026-11-09T07:00:00' },
];
// Eine Woche mit sehr langen (erfundenen) Gerichte-Texten: der Härtefall für Aushang und Bild.
const SIDE = 'serviert mit frischem Taboulé-Bulgursalat oder Mix Salat';
const LONG = [
  ['Test-Tagliatelle Bolognese Feine Bandnudeln mit herzhafter Sauce aus Rinderhackfleisch', 'Feine Test-Bandnudeln mit einer fruchtigen Tomatensauce nach italienischer Art.'],
  ['Test-Kartoffelgratin mit Hähnchenbrust mit Käse goldgelb überbacken', 'Test-Kartoffelgratin mit Gemüse mit Käse goldgelb überbacken'],
  ['Knusprige Test-Hähnchenschenkel Serviert mit aromatischem türkischem Reis oder frisch gekochtem Bulgur.', 'Vegetarischer Test-Hirtenkäse Serviert mit aromatischem türkischem Reis oder frisch gekochtem Bulgur. Die vegetarische Variante wird mit würzigem Hirtenkäse aus Kuhmilch zubereitet.'],
  ['Test-Lasagne, Klassischer Nudelauflauf mit herzhaftem Rinderragout, Béchamelsauce und goldbrauner Käsekruste oder auch als Gemüse-Lasagne', 'Test-Lasagne, Klassischer Nudelauflauf mit Gemüse, Béchamelsauce und goldbrauner Käsekruste'],
  ['Gebratenes Test-Fischfilet auf Blattspinat mit Petersilienkartoffeln und einer leichten Zitronen-Buttersauce', 'Test-Gemüsecurry mit Kichererbsen, Kokosmilch und duftendem Basmatireis, mild gewürzt'],
];
const WEEK = { [MONDAY]: { weekStart: MONDAY, days: Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri'].map((k, i) => [k, { dish: LONG[i][0], side: SIDE, dish2: LONG[i][1], side2: SIDE, price2: 8.5 }])) } };

const pdfPages = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

// Die fünf Druck-Wege. `run` löst den Druck im Seitenkontext aus und meldet, wie oft print() schon
// WÄHREND des Klicks lief; `pages` nennt die erwartete Seitenzahl.
const DOCS = [
  { name: 'Tagesliste', tab: null, run: () => { const n = window.__prints; document.querySelector('[data-ov-print]').click(); return window.__prints - n; }, pages: () => 1 },
  { name: 'Speisekarte', tab: 'menu', run: () => { const n = window.__prints; document.getElementById('menu-pdf').click(); return window.__prints - n; },
    pages: (root) => root.querySelectorAll('.page').length },
  { name: 'Mittagstisch-Aushang', tab: 'week', run: () => { const n = window.__prints; document.getElementById('week-poster').click(); return window.__prints - n; },
    pages: (root) => root.querySelectorAll('.sheet').length },
  { name: 'Bewertungs-Aushang', tab: null, run: () => { const n = window.__prints; printReviewPoster('https://g.page/r/TESTTESTTEST/review', null); return window.__prints - n; }, pages: () => 1 },
  { name: 'Berliner-Backliste', tab: 'berliner', run: () => { const n = window.__prints; document.getElementById('berliner-print').click(); return window.__prints - n; }, pages: () => 1 },
];

const failures = [];
let checks = 0;
const check = (ok, label, detail = '') => { checks++; if (!ok) { failures.push(`${label}${detail ? ' — ' + detail : ''}`); console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); } };

const srv = await startServer();
const base = `http://localhost:${PORT}`;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });

try {
  check(/frame-src/.test(CSP), 'vercel.json enthält eine Content-Security-Policy mit frame-src', 'sonst prüft dieser Test nicht unter Live-Bedingungen');

  for (const vp of [{ width: 390, height: 844, mobile: true }, { width: 1280, height: 900, mobile: false }]) {
    const tag = `${vp.width}px`;
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, isMobile: vp.mobile, hasTouch: vp.mobile, locale: 'de-DE', timezoneId: 'Europe/Berlin', reducedMotion: 'reduce' });
    await context.clock.install({ time: new Date(NOW) });
    // Wie im Layout-Test: nichts nach außen, supabase-js blocken → lokaler Modus ohne Datenbank.
    await context.route('**/*', (r) => {
      const u = r.request().url();
      if (u.includes('/vendor/supabase-js')) return r.abort();
      return (u.includes('localhost') || u.startsWith('data:') || u.startsWith('blob:')) ? r.continue() : r.abort();
    });
    await context.addInitScript(([res, ord, week]) => {
      window.__prints = 0; window.__printFrames = 0;
      window.print = function () { if (window === window.top) window.__prints++; else window.top.__printFrames++; };
      if (window !== window.top || sessionStorage.getItem('print-audit')) return;
      sessionStorage.setItem('print-audit', '1');
      localStorage.setItem('alstercafe.auth', '1');
      localStorage.setItem('alstercafe.reservations', JSON.stringify(res));
      localStorage.setItem('alstercafe.orders', JSON.stringify(ord));
      localStorage.setItem('alstercafe.weekly-menu', JSON.stringify(week));
    }, [RES, ORD, WEEK]);
    const page = await context.newPage();
    const cspHits = []; const pageErrors = [];
    page.on('console', (m) => { if (/Content Security Policy|violates the following/i.test(m.text())) cspHits.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(`${base}/admin.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2800);   // Anmeldung + Vorwärmen der Druck-Schriften und -Logos (läuft 1,5 s danach)
    const title = await page.title();

    for (const doc of DOCS) {
      const label = `[${tag}] ${doc.name}`;
      // Ohne Rückgabewert aufrufen: auf das Ende eines Bereichswechsels wird hier nicht gewartet.
      if (doc.tab) { await page.evaluate((t) => { switchTab(t); }, doc.tab); await page.waitForTimeout(600); }
      else { await page.evaluate(() => { showOverview(); }); await page.waitForTimeout(400); }
      if (doc.tab === 'week') await page.fill('#week-price', '9,90');
      const before = await page.evaluate(() => window.__prints);
      let inClick;
      try { inClick = await page.evaluate(doc.run); }
      catch (e) { check(false, `${label}: Druck lässt sich auslösen`, e.message.split('\n')[0]); continue; }
      await page.waitForTimeout(1400);
      const total = (await page.evaluate(() => window.__prints)) - before;
      check(inClick === 1, `${label}: print() läuft direkt im Klick`, `im Klick ${inClick}×`);
      check(total === 1, `${label}: print() läuft genau einmal`, `${total}×`);
      check((await page.evaluate(() => window.__printFrames)) === 0, `${label}: kein Druck aus einem Rahmen`);

      // Druckbild
      await page.setViewportSize({ width: 794, height: 1123 });
      await page.emulateMedia({ media: 'print' });
      await page.waitForTimeout(200);
      const pr = await page.evaluate((expr) => {
        const host = document.getElementById('print-host'); const root = host && host.shadowRoot;
        const others = [...document.body.children].filter((e) => e !== host && getComputedStyle(e).display !== 'none').map((e) => e.tagName + (e.id ? '#' + e.id : ''));
        const sheets = root ? [...root.querySelectorAll('.sheet')].map((s) => Math.round(s.getBoundingClientRect().height / 3.7795)) : [];
        return {
          mounted: !!(root && root.querySelector('body') && root.querySelector('body').children.length),
          hostDisplay: host ? getComputedStyle(host).display : 'fehlt', others,
          after: getComputedStyle(document.body, '::after').content,
          bg: getComputedStyle(document.documentElement).backgroundColor + ' / ' + getComputedStyle(document.body).backgroundColor,
          expected: root ? (0, eval)('(' + expr + ')')(root) : 0, sheets, scripts: root ? root.querySelectorAll('script').length : 0,
        };
      }, doc.pages.toString());
      check(pr.mounted && pr.hostDisplay === 'block', `${label}: Druck-Dokument steht im Druckbild`, `Host ${pr.hostDisplay}`);
      check(pr.others.length === 0, `${label}: sonst nichts vom Mitgliederbereich im Druckbild`, pr.others.join(', '));
      check(/none/.test(pr.after), `${label}: keine angehängte Copyright-Zeile`, pr.after);
      check(/^rgb\(255, 255, 255\) \/ rgb\(255, 255, 255\)$/.test(pr.bg), `${label}: weißer Grund`, pr.bg);
      check(pr.scripts === 0, `${label}: keine Skripte im Druck-Dokument`);
      const pdf = await page.pdf({ preferCSSPageSize: true });
      check(pdfPages(pdf) === pr.expected, `${label}: Seitenzahl`, `${pdfPages(pdf)} statt ${pr.expected}`);
      if (pr.sheets.length) check(pr.sheets.every((h) => h <= 266), `${label}: jedes Blatt passt auf eine A4-Seite`, `Höhen ${pr.sheets.join(', ')} mm`);

      // Aufräumen beim nächsten Tipp
      await page.emulateMedia({ media: 'screen' });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.mouse.click(3, 3);
      await page.waitForTimeout(150);
      const clean = await page.evaluate(() => ({ cls: document.documentElement.classList.contains('has-print-doc'), kids: document.getElementById('print-host')?.shadowRoot?.childNodes.length ?? -1, style: !!document.getElementById('print-page-style'), title: document.title }));
      check(!clean.cls && clean.kids === 0 && !clean.style, `${label}: nach dem nächsten Tipp aufgeräumt`);
      check(clean.title === title, `${label}: Seitentitel wieder wie vorher`, clean.title);
    }

    // Instagram-Bild: die Woche mit den langen Texten passt auf ein Bild
    await page.evaluate(() => { switchTab('week'); }); await page.waitForTimeout(500);
    const img = await page.evaluate(async () => {
      const data = weekShareData();
      const text = data.days.map((d) => d.dishes.map((x) => x.dish + ' ' + x.side).join(' ')).join(' ');
      await Promise.all(['400 40px Fraunces', '500 64px Fraunces', '400 24px Inter', '600 24px Inter'].map((f) => document.fonts.load(f, text)));
      const r = drawWeekImage(data, null);
      return { days: data.days.length, w: r.canvas.width, h: r.canvas.height, tier: r.tier, px: r.px, used: r.used, avail: r.avail, squeeze: r.squeeze };
    });
    check(img.w === 1080 && img.h === 1350, `[${tag}] Instagram-Bild: 1080 × 1350`);
    check(img.days === 5 && img.used <= img.avail, `[${tag}] Instagram-Bild: alle Tage passen in die Inhaltszone`, `${img.used} von ${img.avail} px`);
    check(img.px >= 26 && img.squeeze === 1, `[${tag}] Instagram-Bild: Schrift mindestens 26 px`, `${img.px} px, Stufe ${img.tier}`);

    check(cspHits.length === 0, `[${tag}] keine Verletzung der Sicherheits-Kopfzeile`, cspHits[0] || '');
    check(pageErrors.length === 0, `[${tag}] keine Skriptfehler`, pageErrors[0] || '');
    await context.close();
  }
} finally {
  await browser.close();
  srv.close();
}

console.log(`\n${checks} Druck-Prüfungen über 2 Breiten.`);
if (failures.length) {
  console.log(`❌ ${failures.length} fehlgeschlagen:`);
  failures.forEach((f) => console.log('   - ' + f));
  process.exit(1);
}
console.log('✅ Alle Druck-Knöpfe drucken – auch unter der Sicherheits-Kopfzeile der Live-Seite.');
