/* ============================================================
   Alstercafé · Gemeinsame Regeln (Webseite + Mitgliederbereich)
   ============================================================
   Eine Stelle, die festlegt, wie Öffnungszeiten und Preise gelesen
   werden. Die Webseite (script.js) und der Mitgliederbereich
   (admin.js, Prüfung beim Speichern) nutzen dieselben Funktionen –
   was der Mitgliederbereich als gültig annimmt, versteht auch die
   Webseite.
   ============================================================ */
(function () {
  const WEEKDAY_KEYS = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
  const WEEKDAY_ALIASES = { tu: 1, we: 2, th: 3, su: 6, mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
  const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  const DAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  function weekdayIndex(word) {
    const w = String(word || '').toLowerCase().replace(/[^a-zäöü]/g, '');
    if (!w) return -1;
    const de = WEEKDAY_KEYS.indexOf(w.slice(0, 2));   // mo di mi do fr sa so (auch Langform)
    if (de >= 0) return de;
    return WEEKDAY_ALIASES[w.slice(0, 3)] ?? WEEKDAY_ALIASES[w.slice(0, 2)] ?? -1;  // englisch
  }

  // "Mo – Fr", "Mo-Fr", "Sa & So", "Sa, So", "Samstag", "täglich", "Mo bis Sa" … → [0..6]
  function parseDayLabel(label) {
    const l = String(label || '').toLowerCase().trim();
    if (/t[äa]glich|jeden tag|every day|daily/.test(l)) return [0, 1, 2, 3, 4, 5, 6];
    const out = new Set();
    l.split(/,|&|\+|\bund\b|\band\b|\//).forEach(part => {
      const range = part.split(/\s*(?:[‐-―−\-]|\bbis\b|\bto\b)\s*/).map(x => x.trim()).filter(Boolean);
      if (range.length >= 2) {
        const a = weekdayIndex(range[0]), b = weekdayIndex(range[range.length - 1]);
        if (a < 0 || b < 0) return;
        for (let d = a; ; d = (d + 1) % 7) { out.add(d); if (d === b) break; }
      } else if (range.length === 1) {
        const d = weekdayIndex(range[0]);
        if (d >= 0) out.add(d);
      }
    });
    return [...out];
  }

  // "06:30 – 15:00", "6.30-15 Uhr", "6:30 bis 15:00" → { openMin, closeMin } | null
  function parseTimeRange(text) {
    const m = String(text || '').match(/(\d{1,2})(?:[:.](\d{2}))?\s*(?:uhr)?\s*(?:[‐-―−\-]|bis|to)\s*(\d{1,2})(?:[:.](\d{2}))?/i);
    if (!m) return null;
    const h1 = parseInt(m[1], 10), m1 = parseInt(m[2] || '0', 10);
    const h2 = parseInt(m[3], 10), m2 = parseInt(m[4] || '0', 10);
    if (h1 > 23 || h2 > 24 || m1 > 59 || m2 > 59) return null;
    return { openMin: h1 * 60 + m1, closeMin: h2 * 60 + m2 };
  }
  const fmtMin = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

  /* Prüft die Öffnungszeiten-Zeilen wie die Webseite sie liest.
     Liefert { week: Array[7], rows: [{ ok, days, range, message }] }. */
  function checkHours(rows) {
    const week = new Array(7).fill(null);
    const seen = new Map();
    const out = (rows || []).map((r, i) => {
      const label = String(r && r.label || '').trim();
      const time = String(r && r.time || '').trim();
      const days = parseDayLabel(label);
      if (!label && !time) return { ok: true, empty: true, days: [] };
      if (!days.length) return { ok: false, days, message: `Tag „${label || '–'}“ nicht erkannt. Bitte z. B. „Mo – Fr“, „Samstag“ oder „Sa & So“ eintragen.` };
      if (/geschlossen|closed|ruhetag/i.test(time)) {
        days.forEach(d => { week[d] = null; seen.set(d, i); });
        return { ok: true, days, closed: true, message: `${days.map(d => DAY_SHORT[d]).join(', ')}: geschlossen` };
      }
      const range = parseTimeRange(time);
      if (!range) return { ok: false, days, message: `Zeit „${time || '–'}“ nicht erkannt. Bitte z. B. „06:30 – 15:00“ oder „geschlossen“ eintragen.` };
      if (range.closeMin <= range.openMin) return { ok: false, days, message: `Bei „${label}“ liegt das Ende (${fmtMin(range.closeMin)}) nicht nach dem Beginn (${fmtMin(range.openMin)}).` };
      const dup = days.filter(d => seen.has(d));
      days.forEach(d => { week[d] = range; seen.set(d, i); });
      return {
        ok: true, days, range,
        warn: dup.length ? `${dup.map(d => DAY_NAMES[d]).join(', ')} steht schon in einer anderen Zeile – diese Zeile gilt.` : '',
        message: `${days.length === 7 ? 'Täglich' : days.map(d => DAY_SHORT[d]).join(', ')}: ${fmtMin(range.openMin)} – ${fmtMin(range.closeMin)} Uhr`
      };
    });
    return { week, rows: out };
  }

  /* Preis lesen: "2,50", "2,50 €", "€2.50", "1.234,50" → Zahl; ungültig/≤0 → null */
  function parseEuro(v) {
    if (typeof v === 'number') return isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
    let t = String(v || '').replace(/\s/g, '').replace(/€|eur(o)?/gi, '');
    if (!t || /^-/.test(t)) return null;
    if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');   // 1.234,50
    else if (t.includes(',')) t = t.replace(',', '.');                                     // 2,50
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');                      // 1.234
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
    const n = parseFloat(t);
    return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
  }
  // 2.5 → "2,50"
  function euroText(n) { return Number(n).toFixed(2).replace('.', ','); }

  window.AlsterRules = { weekdayIndex, parseDayLabel, parseTimeRange, checkHours, parseEuro, euroText, DAY_NAMES, DAY_SHORT };
})();
