/**
 * Layout-Sprünge (Cumulative Layout Shift) beim Laden messen.
 *
 * Hintergrund: Nachträglich eingefügte Blöcke (Datumsleiste, Wochenkarte),
 * spät geladene Schriften oder Inhalte ohne reservierte Höhe lassen die
 * Seite beim Laden „nachrutschen“. Dieses Skript misst den CLS jeder
 * öffentlichen Seite in drei Breiten, 2 s nach dem load-Ereignis, mit
 * abgeklemmtem Backend (wie der Overflow-Audit) — und schlägt fehl, sobald
 * ein Wert über der Google-Grenze für „gut“ (0,1) liegt.
 *
 * Bewusst getrennt vom Overflow-Audit (eigener Zweck, eigenes Kommando):
 * Lauf:  npm run test:cls
 * Exit:  0 = alle Seiten unter 0,1, 1 = mindestens eine darüber.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8138;
const LIMIT = 0.1;
const WIDTHS = [390, 768, 1440];
const PAGES = [
  'index.html', 'mittagstisch.html', 'speisekarte.html', 'broetchen.html', 'berliner.html',
  'reservierung.html', 'kontakt.html', 'ueber-uns.html', 'impressum.html', 'datenschutz.html', '404.html',
];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2',
};

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

const srv = await startServer();
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const failures = [];
const rows = [];
try {
  for (const w of WIDTHS) {
    const context = await browser.newContext({ viewport: { width: w, height: w < 700 ? 844 : 900 }, deviceScaleFactor: 1, isMobile: w < 700 });
    await context.addInitScript(() => {
      try {
        localStorage.setItem('alstercafe.consent', 'essential');   // kein Cookie-Hinweis
        sessionStorage.setItem('alstercafe.splash-seen', '1');      // kein Splash
      } catch (e) {}
      window.__cls = 0;
      new PerformanceObserver((list) => {
        list.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__cls += e.value; });
      }).observe({ type: 'layout-shift', buffered: true });
    });
    // Backend und externe Anfragen abklemmen (supabase-js liegt lokal unter vendor/)
    await context.route('**/*', (r) => {
      const u = r.request().url();
      if (u.includes('/vendor/supabase-js')) return r.abort();
      return u.startsWith(`http://localhost:${PORT}`) || u.startsWith('data:') ? r.continue() : r.abort();
    });
    for (const pg of PAGES) {
      const page = await context.newPage();
      await page.goto(`http://localhost:${PORT}/${pg}`, { waitUntil: 'load' }).catch(() => {});
      await page.waitForTimeout(2000);
      const cls = await page.evaluate(() => window.__cls);
      rows.push(`  ${pg.padEnd(20)} @${String(w).padEnd(5)} CLS ${cls.toFixed(3)}`);
      if (cls > LIMIT) failures.push(`${pg} @${w}px: ${cls.toFixed(3)}`);
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
  srv.close();
}
console.log(rows.join('\n'));
if (failures.length) {
  console.error(`\n❌ CLS über ${LIMIT}: ${failures.join(', ')}`);
  process.exit(1);
}
console.log(`\n✅ Alle ${PAGES.length} Seiten × ${WIDTHS.length} Breiten unter CLS ${LIMIT}.`);
