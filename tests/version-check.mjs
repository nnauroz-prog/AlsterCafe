/**
 * Versions-Check für das Cache-Busting (reines Node, ohne Playwright, ohne git).
 *
 * Hintergrund: CSS und JS werden mit ?v=… ausgeliefert und auf Vercel ein
 * Jahr lang gecacht („immutable“). Bleibt beim Hochzählen eine Seite auf dem
 * alten Stand oder fehlt ?v= ganz, sehen Gäste nach einem Update eine
 * Mischung aus alter und neuer Fassung.
 *
 * Geprüft wird:
 *  1. Alle ?v=-Werte in den HTML-Seiten und alle V-Werte der Inline-Migration
 *     (var V='…') sind identisch.
 *  2. Jede lokale src=/href=-Angabe auf .css oder .js in den HTML-Seiten
 *     trägt ?v=. Ausnahme: vendor/ (Version steckt im Dateinamen).
 *  3. In den Skripten (z. B. Druckfenster in admin.js) wird kein lokales
 *     Stylesheet/Skript per href="…css"/src="…js" ohne ?v= eingebunden.
 *
 * Lauf:  node tests/version-check.mjs   (Teil von „npm test“)
 * Exit:  0 = sauber, 1 = mindestens ein Fund.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
const jsFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith('.js')).sort();

const problems = [];
const versions = new Map(); // Wert → [Fundstellen]
const note = (value, where) => {
  if (!versions.has(value)) versions.set(value, []);
  versions.get(value).push(where);
};
const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const isLocal = (url) => !/^(?:[a-z]+:)?\/\//i.test(url) && !url.startsWith('data:') && !url.startsWith('${');

for (const file of htmlFiles) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');

  // 1) ?v=-Werte und Inline-Migration (var V="…" bzw. var V='…')
  for (const m of text.matchAll(/\?v=([\w.-]+)/g)) note(m[1], `${file}:${lineOf(text, m.index)}`);
  for (const m of text.matchAll(/var\s+V\s*=\s*["']([\w.-]+)["']/g)) note(m[1], `${file}:${lineOf(text, m.index)} (var V)`);

  // 2) lokale .css/.js ohne ?v=
  for (const m of text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
    const url = m[1];
    if (!isLocal(url)) continue;
    const bare = url.split('#')[0];
    if (!/\.(css|js)(\?|$)/.test(bare)) continue;
    if (/(^|\/)vendor\//.test(bare)) continue;
    if (!/\?(.*&)?v=/.test(bare)) problems.push(`${file}:${lineOf(text, m.index)}  ohne ?v=: ${url}`);
  }
}

// 3) Skripte, die selbst HTML mit Stylesheets/Skripten erzeugen (z. B. Druckfenster)
for (const file of jsFiles) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const m of text.matchAll(/<(?:link|script)\b[^>]*\b(?:href|src)\s*=\s*["']([^"']+)["']/g)) {
    const url = m[1];
    // Template-Ausdrücke (${…}) ausblenden: gemeldet wird nur, was sichtbar auf .css/.js endet
    const bare = url.replace(/\$\{[^}]*\}/g, '');
    if (!/\.(css|js)(\?|$)/.test(bare)) continue;
    if (/(^|\/)vendor\//.test(bare)) continue;
    if (!/\?(.*&)?v=/.test(bare)) problems.push(`${file}:${lineOf(text, m.index)}  ohne ?v=: ${url}`);
  }
}

if (versions.size > 1) {
  problems.push(`Uneinheitliche Versions-Stempel (${versions.size} verschiedene Werte):`);
  for (const [value, where] of versions) {
    problems.push(`   ${value}  — ${where.length}× (z. B. ${where.slice(0, 4).join(', ')}${where.length > 4 ? ', …' : ''})`);
  }
}

const [only] = versions.keys();
if (problems.length) {
  console.error('❌ Versions-Check fehlgeschlagen:');
  problems.forEach((p) => console.error('  ' + p));
  console.error('\nBitte den Versions-Stempel in einem Zug über alle HTML-Seiten (inkl. var V der Inline-Migration) hochzählen.');
  process.exit(1);
}
console.log(`✅ Versions-Check: ${htmlFiles.length} HTML-Seiten, einheitlich ?v=${only ?? '(keiner)'}, keine lokale CSS/JS-Datei ohne ?v=.`);
