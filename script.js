/* Alstercafé · Hauptseite */

const STORAGE_LUNCH    = 'alstercafe.weekly-menu';
const STORAGE_NOTICE   = 'alstercafe.notice';
const STORAGE_CONSENT  = 'alstercafe.consent';
const STORAGE_MENU     = 'alstercafe.menu';
const STORAGE_HOURS    = 'alstercafe.hours';
const STORAGE_DESIGN   = 'alstercafe.design';
const STORAGE_CONTENT  = 'alstercafe.content';

/* ---------- Globale Fehler-Sicherung ----------
   Faengt jeden uncaughten Fehler ab und sorgt dafuer, dass die
   Seite nie kaputt aussieht. Splash wird notfalls weggenommen. */
(function setupErrorBoundary() {
  function rescueSplash() {
    const s = document.getElementById('app-splash');
    if (s) { s.classList.add('is-leaving'); setTimeout(() => s.remove(), 500); }
  }
  window.addEventListener('error', (e) => {
    console.warn('[caught]', e.message);
    rescueSplash();
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.warn('[promise]', e.reason);
    rescueSplash();
  });
})();

/* Schema-Validatoren: stellen sicher dass localStorage-Daten
   die erwartete Form haben. Wenn nicht, wird der Eintrag
   ignoriert (statt einen Fehler auszuloesen). */
function isObject(x) { return x && typeof x === 'object' && !Array.isArray(x); }
function isArray(x)  { return Array.isArray(x); }
function isString(x) { return typeof x === 'string'; }

function validateContent(c) {
  if (!isObject(c)) return null;
  const out = {};
  Object.keys(c).forEach(k => { if (isString(c[k])) out[k] = c[k]; });
  return out;
}
function validateDesign(d) {
  if (!isObject(d)) return {};
  const out = {};
  ['logo','aboutImage','accentColor'].forEach(k => {
    if (isString(d[k])) out[k] = d[k];
  });
  if (isArray(d.gallery)) out.gallery = d.gallery.filter(isString).slice(0, 6);
  return out;
}
function validateHours(h) {
  if (!isArray(h)) return null;
  return h.filter(r => isObject(r) && isString(r.label) && isString(r.time)).slice(0, 10);
}
function validateMenu(m) {
  if (!isObject(m)) return null;
  const out = {};
  ['fruehstueck','backwaren','getraenke'].forEach(k => {
    if (isObject(m[k])) {
      const items = isArray(m[k].items)
        ? m[k].items.filter(i => isObject(i) && isString(i.name)).slice(0, 50)
        : [];
      out[k] = { title: isString(m[k].title) ? m[k].title : '', items };
    }
  });
  return out;
}

const DAY_KEYS   = ['mon','tue','wed','thu','fri','sat','sun'];
const DAY_LABELS = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
const DAY_LABELS_EN = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
/* Sprache aus localStorage (von i18n.js gesetzt). Bestimmt, in welcher
   Sprache die dynamisch erzeugten Datums-/Status-Texte gerendert werden. */
function alsterLang() { try { return localStorage.getItem('alstercafe.lang') === 'en' ? 'en' : 'de'; } catch (e) { return 'de'; } }
function dateLocale() { return alsterLang() === 'en' ? 'en-GB' : 'de-DE'; }
function dayLabels() { return alsterLang() === 'en' ? DAY_LABELS_EN : DAY_LABELS; }

const DEFAULT_HOURS = [
  { label: 'Mo – Fr',  time: '06:30 – 15:00' },
  { label: 'Samstag',  time: '07:30 – 15:00' },
  { label: 'Sonntag',  time: '07:30 – 15:00' }
];

/* Standard-Sorten für den Brötchen-Service.
   Der Inhaber kann sie im Mitgliederbereich überschreiben (Key: broetchen-items). */
const DEFAULT_BROETCHEN = [
  { name: 'Käse',                desc: 'Gouda & Bergkäse, Salatblatt, Butter' },
  { name: 'Schinken',            desc: 'Gekochter Schinken, Ei, Gurke' },
  { name: 'Salami',              desc: 'Edelsalami, Käse, Salat' },
  { name: 'Frischkäse & Gurke',  desc: 'Kräuterfrischkäse, Gurke, Radieschen', veg: true },
  { name: 'Ei',                  desc: 'Spiegel- oder Rührei, Schnittlauch' },
  { name: 'Lachs',               desc: 'Räucherlachs, Meerrettich-Frischkäse, Dill' },
  { name: 'Bunt gemischt',       desc: 'Wir stellen eine ausgewogene Auswahl zusammen' }
];

/* Berliner-Vorbestellung (z. B. Silvester). Der Inhaber schaltet sie im
   Mitgliederbereich an/aus und legt fest, von wann bis wann bestellt werden
   kann (Key: berliner-settings) und welche Sorten es gibt (Key: berliner-items). */
const DEFAULT_BERLINER = [
  { name: 'Klassisch',  desc: 'Mit Konfitüre gefüllt, mit Zucker' },
  { name: 'Vanille',    desc: 'Mit Vanillecreme gefüllt' },
  { name: 'Schoko',     desc: 'Mit Schokocreme gefüllt' }
];
function berlinerSettings() {
  let s = null;
  try { s = window.alsterDb?.get('berliner-settings'); } catch {}
  return (s && typeof s === 'object') ? s : {};
}
// Sichtbar = eingeschaltet UND heute innerhalb des Bestellzeitraums
// (leere Grenzen = offen). Datumsvergleich als ISO-Text (YYYY-MM-DD).
function berlinerState() {
  const st = berlinerSettings();
  const today = isoLocal(new Date());
  if (!st.active) return { visible: false, reason: 'off', st };
  if (st.orderFrom && today < st.orderFrom) return { visible: false, reason: 'soon', st };
  if (st.orderTo && today > st.orderTo) return { visible: false, reason: 'over', st };
  return { visible: true, st };
}
function formatDateLong(iso, en) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(en ? 'en-GB' : 'de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

/* Menüpunkt + Ankündigung auf der Startseite — nur solange die Aktion läuft. */
function initBerlinerPromo() {
  const { visible, st } = berlinerState();
  const en = alsterLang() === 'en';
  const onPage = /berliner\.html$/.test(location.pathname);

  // Menüpunkt (Kopfzeile, auch mobil) direkt hinter dem Brötchen-Service
  document.querySelectorAll('.primary-nav').forEach(nav => {
    let link = nav.querySelector('.nav-berliner');
    if (!visible) { link?.remove(); return; }
    if (!link) {
      link = document.createElement('a');
      link.className = 'nav-berliner';
      link.href = 'berliner.html';
      // Desktop: kurz „Berliner“ (Menüleiste ist sonst zu voll), mobil voller Name
      link.innerHTML = '<span class="nav-berliner-long">Berliner-Bestellservice</span><span class="nav-berliner-short">Berliner</span>';
      const after = nav.querySelector('a[href="broetchen.html"]');
      after ? after.after(link) : nav.prepend(link);
    }
    link.classList.toggle('is-active', onPage);
  });

  // Ankündigung auf der Startseite (unter dem Hero)
  const hero = document.querySelector('.hero-landing');
  let promo = document.getElementById('berliner-promo');
  if (!visible || !hero) { promo?.remove(); return; }
  const title = (st.title || '').trim() || 'Berliner für Silvester vorbestellen';
  const text = (st.text || '').trim() || 'Frisch aus unserer Backstube — jetzt vorbestellen und zur Abholung bereitlegen lassen.';
  const until = st.orderTo ? (en ? `Orders until ${formatDateLong(st.orderTo, true)}` : `Bestellbar bis ${formatDateLong(st.orderTo)}`) : '';
  const html = `
    <div class="container berliner-promo-inner">
      <div>
        <p class="berliner-promo-kicker">${en ? 'Pre-order now' : 'Jetzt vorbestellen'}</p>
        <h2 class="berliner-promo-title">${escapeHtml(title)}</h2>
        <p class="berliner-promo-text">${escapeHtml(text)}</p>
        ${until ? `<p class="berliner-promo-until">${escapeHtml(until)}</p>` : ''}
      </div>
      <a class="btn btn-gold" href="berliner.html">${en ? 'Pre-order doughnuts' : 'Berliner vorbestellen'} <svg class="ico ico-sm"><use href="#i-arrow"/></svg></a>
    </div>`;
  if (!promo) {
    promo = document.createElement('section');
    promo.id = 'berliner-promo';
    promo.className = 'berliner-promo';
    promo.setAttribute('data-no-i18n', '');
    hero.after(promo);
  }
  if (promo.dataset.html !== html) { promo.innerHTML = html; promo.dataset.html = html; }
}

/* Berliner-Seite: geschlossen/offen umschalten, Texte und Zeitraum anzeigen. */
function initBerlinerPage() {
  const form = document.getElementById('order-form');
  if (!form || form.dataset.kind !== 'berliner') return;
  const { visible, reason, st } = berlinerState();
  const en = alsterLang() === 'en';
  const orderSec = document.getElementById('berliner-order');
  const closed = document.getElementById('berliner-closed');
  const closedText = document.getElementById('berliner-closed-text');
  const win = document.getElementById('berliner-window');
  if (orderSec) orderSec.hidden = !visible;
  if (closed) closed.hidden = visible;
  if (closedText) {
    closedText.textContent = reason === 'soon' && st.orderFrom
      ? (en ? `Pre-orders open on ${formatDateLong(st.orderFrom, true)}.` : `Vorbestellungen sind ab ${formatDateLong(st.orderFrom)} möglich.`)
      : (en ? 'Check back soon or give us a call.' : 'Schauen Sie bald wieder vorbei oder rufen Sie uns an.');
  }
  const lead = document.getElementById('berliner-lead');
  if (lead && (st.text || '').trim()) lead.textContent = st.text.trim();
  if (win) {
    const parts = [];
    if (visible && st.orderTo) parts.push(en ? `Orders until ${formatDateLong(st.orderTo, true)}` : `Bestellbar bis ${formatDateLong(st.orderTo)}`);
    if (st.pickupFrom || st.pickupTo) {
      const a = formatDateLong(st.pickupFrom || st.pickupTo, en), b = formatDateLong(st.pickupTo || st.pickupFrom, en);
      parts.push(a === b ? (en ? `Pick-up on ${a}` : `Abholung am ${a}`) : (en ? `Pick-up ${a} – ${b}` : `Abholung ${a} bis ${b}`));
    }
    win.textContent = parts.join(' · ');
    win.hidden = !parts.length;
  }
  const date = form.querySelector('input[name="Datum"]');
  if (date) {
    const today = isoLocal(new Date());
    const min = st.pickupFrom && st.pickupFrom > today ? st.pickupFrom : today;
    date.min = min;
    if (st.pickupTo) date.max = st.pickupTo; else date.removeAttribute('max');
    if (!date.value || date.value < min || (st.pickupTo && date.value > st.pickupTo)) date.value = min;
  }
}

// Rechtstexte (Impressum, Datenschutz) gibt es nur auf Deutsch: auf der
// englischen Seite einen kurzen Hinweis oben einblenden.
function noteGermanOnlyLegal() {
  if (alsterLang() !== 'en') return;
  const art = document.querySelector('.legal-article');
  if (!art || art.querySelector('.legal-lang-note')) return;
  const p = document.createElement('p');
  p.className = 'legal-lang-note';
  p.setAttribute('data-no-i18n', '');
  p.textContent = 'This legal text is only available in German.';
  const h1 = art.querySelector('h1');
  (h1 || art.firstChild) && art.insertBefore(p, h1 ? h1.nextSibling : art.firstChild);
}

document.addEventListener('DOMContentLoaded', async () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const safeRun = (fn) => { try { fn(); } catch (e) { console.warn('init err:', e); } };

  // 1) Visuelles Grundgerüst SOFORT aufbauen — bewusst VOR dem Warten auf das
  //    Backend. Reveal, Zähler, Navigation, Splash usw. hängen nur vom DOM ab,
  //    nicht von Supabase. So erscheint die Seite nie leer oder bleibt im
  //    Splash hängen, selbst wenn das Backend langsam oder offline ist.
  safeRun(initYears);
  safeRun(initNav);
  safeRun(noteGermanOnlyLegal);
  safeRun(initStickyHeader);
  safeRun(initReveal);
  safeRun(initCounters);
  safeRun(initMagnetic);
  safeRun(initPremiumPolish);
  safeRun(initCookieBanner);
  safeRun(initReservationForm);
  safeRun(initOrderForm);
  safeRun(initEditMode);
  safeRun(initServiceWorker);
  hideSplash();

  // 2) Erst jetzt aufs Backend warten — und nur die DATEN-abhängigen Teile
  //    danach rendern (Speisekarte, Öffnungszeiten, Mittagstisch, Hinweis,
  //    hochgeladene Bilder/Texte, Live-Status).
  try {
    if (window.alsterDb) await window.alsterDb.ready();
  } catch (e) { console.warn('db ready err:', e); }

  safeRun(initDesign);
  safeRun(initContent);
  safeRun(initNotice);
  safeRun(initHolidays);
  safeRun(initMenu);
  safeRun(initHours);
  safeRun(initLunchWeek);
  safeRun(initLandingTeaser);
  safeRun(initLiveStatus);
  // Brötchen-Sorten jetzt mit dem hydratisierten Stand neu aufbauen (die erste
  // Darstellung lief vor dem Backend und zeigte ggf. noch die Standard-Liste).
  safeRun(() => { if (refreshOrderSorts) refreshOrderSorts(); });
  safeRun(initBerlinerPromo);
  safeRun(initBerlinerPage);
  // Bestellzeitraum kann um Mitternacht beginnen/enden
  setInterval(() => { safeRun(initBerlinerPromo); safeRun(initBerlinerPage); }, 5 * 60 * 1000);

  // Live-Sync: jede Aenderung im Backend (auch von einem anderen Geraet
  // des Inhabers) erscheint sofort auf dieser Seite
  // Nur die content-Tabelle beobachten — Reservierungen/Bestellungen sind
  // nur fuer den Inhaber-Bereich relevant (spart unnoetige Realtime-Events).
  window.alsterDb?.subscribe((key) => {
    switch (key) {
      case 'design':      initDesign(); break;
      case 'content':     initContent(); break;
      case 'notice':      initNotice(); break;
      case 'holidays':    initHolidays(); updateLiveStatus(); break;
      case 'menu':        initMenu(); break;
      case 'hours':       initHours(); updateLiveStatus(); break;
      case 'weekly-menu': initLunchWeek(); break;
      case 'broetchen-items':
      case 'berliner-items': if (refreshOrderSorts) refreshOrderSorts(); break;
      case 'berliner-settings': initBerlinerPromo(); initBerlinerPage(); break;
    }
  }, ['content']);
});

/* ---------- Inhalts-Overrides (gespeicherte Custom-Texte) ---------- */
function initContent() {
  let raw = {};
  try { raw = JSON.parse(localStorage.getItem(STORAGE_CONTENT) || '{}'); } catch {}
  const content = validateContent(raw) || {};
  document.querySelectorAll('[data-editable]').forEach(el => {
    const key = el.dataset.editable;
    // Nur uebernehmen, wenn auch tatsaechlicher Text drinsteht. Schuetzt
    // gegen versehentliches Leeren im Edit-Modus — sonst waere der Hero
    // ploetzlich komplett leer.
    if (typeof content[key] === 'string'
        && content[key].trim().length > 0
        && content[key].length < 5000) {
      el.innerHTML = content[key];
    }
  });
}

/* Hinweis: initSpotlight() und initMagneticButtons() wurden entfernt —
   sie waren definiert aber nie aufgerufen. initMagnetic() (weiter
   unten) ist die aktive Variante mit translate3d/RAF. */

/* ---------- Loading-Splash beim ersten Laden ---------- */
function hideSplash() {
  const splash = document.getElementById('app-splash');
  if (!splash) return;
  // Knappes Dwell — Maria's Kunden sollen die Seite schnell sehen,
  // nicht auf einen Stempel warten. War 1400ms (Editorial-Flair),
  // jetzt 350ms (genug fuer das Logo-Fade).
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dwell = reduceMotion ? 0 : 350;
  setTimeout(() => {
    splash.classList.add('is-leaving');
    setTimeout(() => splash.remove(), 600);
  }, dwell);
}

/* ---------- Urlaub / Feiertage (Schließtage) ---------- */
// Gespeichert als Content-Key 'holidays' = [{date:'YYYY-MM-DD', label}].
// Oeffentliche Info (Schließtage) — darf in der oeffentlich lesbaren
// content-Tabelle liegen.
function getHolidays() {
  try {
    const v = JSON.parse(localStorage.getItem('alstercafe.holidays') || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function todayIsoLocal() {
  const t = new Date();
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
}
function todayHoliday() {
  const iso = todayIsoLocal();
  return getHolidays().find(h => h && h.date === iso) || null;
}

/* ---------- Live-Status-Pille ("Aktuell geöffnet") ---------- */
let liveStatusTimer = null;
// Erneut aufrufbare Funktion, die die Brötchen-Sorten aus den Inhaber-Daten
// aufbaut (nach Backend-Hydration + bei Live-Änderungen). Wird in initOrderForm gesetzt.
let refreshOrderSorts = null;
function initLiveStatus() {
  updateLiveStatus();
  // Jede Minute neu rechnen (nur ein Timer, auch bei erneutem Aufruf)
  if (liveStatusTimer) clearInterval(liveStatusTimer);
  liveStatusTimer = setInterval(updateLiveStatus, 60_000);
}
// Aktualisiert ALLE Stellen, die "geöffnet/geschlossen" zeigen, aus einer Quelle.
function updateLiveStatus() {
  const status = computeLiveStatus();
  const el = document.getElementById('live-status');
  if (el) {
    if (!status) { el.hidden = true; }
    else {
      el.hidden = false;
      el.dataset.state = status.state;
      el.querySelector('.live-status-text').textContent = status.text;
    }
  }
  try { updateTopbarLive(status); } catch (e) {}
  try { updateHeroToday(); } catch (e) {}
  const clock = document.querySelector('.hero-coord-clock');
  if (clock && status) clock.classList.toggle('is-closed', status.state !== 'open');
}

/* Öffnungszeiten als Array[7] (0 = Mo … 6 = So) mit {openMin, closeMin} bzw. null.
   Quelle sind die im Mitgliederbereich gepflegten Zeiten (Key 'hours'), sonst die
   Standardzeiten — nicht der angezeigte Text, der auf der englischen Seite übersetzt ist. */
const WEEKDAY_KEYS = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
const WEEKDAY_ALIASES = { tu: 1, we: 2, th: 3, su: 6, mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
function weekdayIndex(word) {
  const w = String(word || '').toLowerCase().replace(/[^a-zäöü]/g, '');
  if (!w) return -1;
  const de = WEEKDAY_KEYS.indexOf(w.slice(0, 2));   // mo di mi do fr sa so (auch Langform)
  if (de >= 0) return de;
  return WEEKDAY_ALIASES[w.slice(0, 3)] ?? WEEKDAY_ALIASES[w.slice(0, 2)] ?? -1;  // englisch
}
// "Mo – Fr", "Mo-Fr", "Sa & So", "Sa, So", "Samstag", "täglich", "Mo bis Sa" …
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
function getWeekHours() {
  let rows = null;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_HOURS) || 'null');
    if (Array.isArray(parsed) && parsed.length) rows = parsed;
  } catch {}
  if (!rows) rows = DEFAULT_HOURS;
  const out = new Array(7).fill(null);
  rows.forEach(r => {
    // Akzeptiert alle gängigen Trenner (Bindestrich, Gedankenstrich, Minus, "bis").
    const m = String(r && r.time || '').match(/(\d{1,2})[:.](\d{2})\s*(?:[‐-―−\-]|bis)\s*(\d{1,2})[:.](\d{2})/i);
    if (!m) return; // z. B. "geschlossen" → Tag bleibt zu
    const openMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    const closeMin = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
    parseDayLabel(r.label).forEach(d => { out[d] = { openMin, closeMin }; });
  });
  return out;
}
// Kompatibilität: frühere Aufrufer
function parseHoursFromDom() { return getWeekHours(); }

function isoLocal(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function holidayOn(d) {
  const iso = isoLocal(d);
  return getHolidays().find(h => h && h.date === iso) || null;
}
// Öffnungszeit für ein Datum (berücksichtigt Schließtage) → {openMin, closeMin} oder null.
function openingFor(d) {
  if (holidayOn(d)) return null;
  return getWeekHours()[(d.getDay() + 6) % 7] || null;
}

function computeLiveStatus() {
  const en = alsterLang() === 'en';
  // Schließtag (Urlaub/Feiertag) hat Vorrang vor den regulären Zeiten
  const hol = todayHoliday();
  if (hol) {
    const suffix = hol.label ? ' · ' + hol.label : '';
    const st = { state: 'closed', text: (en ? 'Closed today' : 'Heute geschlossen') + suffix, holiday: true };
    const next = nextOpening(new Date(), en);
    if (next) st.next = next;
    return st;
  }
  const hours = getWeekHours();
  if (!hours.some(Boolean)) return null;
  const now = new Date();
  const today = hours[(now.getDay() + 6) % 7];
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  if (today && minutesNow >= today.openMin && minutesNow < today.closeMin) {
    const remaining = today.closeMin - minutesNow;
    return {
      state: 'open', closeMin: today.closeMin,
      text: remaining <= 60
        ? (en ? `Open now · closes in ${remaining} min` : `Aktuell geöffnet · schließt in ${remaining} Min.`)
        : (en ? `Open now · until ${formatMin(today.closeMin)}` : `Aktuell geöffnet · bis ${formatMin(today.closeMin)}`)
    };
  }
  const next = nextOpening(now, en);
  if (!next) return { state: 'closed', text: en ? 'Currently closed' : 'Aktuell geschlossen' };
  return { state: 'closed', next, text: (en ? 'Closed · opens ' : 'Geschlossen · öffnet ') + next.text };
}

// Nächster Öffnungszeitpunkt ab "from" (überspringt Schließtage). → {offset, openMin, text}
function nextOpening(from, en) {
  const minutesNow = from.getHours() * 60 + from.getMinutes();
  for (let offset = 0; offset < 21; offset++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
    const day = openingFor(d);
    if (!day) continue;
    if (offset === 0 && minutesNow >= day.openMin) continue;
    const idx = (d.getDay() + 6) % 7;
    const when = offset === 0 ? (en ? 'today' : 'heute')
               : offset === 1 ? (en ? 'tomorrow' : 'morgen')
               : offset < 7 ? (en ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][idx] : ['Mo','Di','Mi','Do','Fr','Sa','So'][idx])
               : d.toLocaleDateString(en ? 'en-GB' : 'de-DE', { day: 'numeric', month: 'short' });
    return { offset, openMin: day.openMin, when, text: en ? `${when} at ${formatMin(day.openMin)}` : `${when} um ${formatMin(day.openMin)}` };
  }
  return null;
}

function formatMin(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/* ---------- Service Worker ---------- */
/* Aktuell deaktiviert. Wenn ein alter SW noch installiert ist,
   sorgt er fuer Cache-Probleme. Wir registrieren keinen neuen,
   und ein evtl. existierender wird hier zwangsweise entfernt. */
function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister().catch(() => {}));
  }).catch(() => {});
  if (window.caches && caches.keys) {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
  }
}

/* ---------- Inline-Bearbeitungsmodus ---------- */
async function initEditMode() {
  const params = new URLSearchParams(window.location.search);
  const isEdit = params.get('edit') === '1';
  if (!isEdit) return;

  // Auth-Pflicht: Bearbeiten nur fuer eingeloggte Inhaber
  let authed = false;
  try { authed = await window.alsterDb?.auth.isAuthed(); } catch {}
  if (!authed) {
    window.location.replace('admin.html?next=edit');
    return;
  }

  document.body.classList.add('is-editing');

  const editables = document.querySelectorAll('[data-editable]');
  editables.forEach(el => {
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'true');
    el.addEventListener('focus', onEditFocus);
    el.addEventListener('blur', onEditBlur);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') el.blur();
      if (e.key === 'Enter' && !e.shiftKey && el.tagName !== 'P') {
        e.preventDefault();
        el.blur();
      }
    });
  });

  // Floating-Toolbar unten rechts (verbraucht keinen Layout-Platz)
  const toolbar = document.createElement('div');
  toolbar.className = 'edit-fab';
  toolbar.innerHTML = `
    <button type="button" class="edit-fab-trigger" id="edit-fab-trigger" aria-label="Bearbeitungsoptionen">
      <span class="edit-dot"></span>
      <span class="edit-fab-label">Bearbeiten</span>
    </button>
    <div class="edit-fab-menu" id="edit-fab-menu" hidden>
      <p class="edit-fab-status" id="edit-status">Klicken Sie auf einen Text auf der Seite, um ihn zu ändern.</p>
      <div class="edit-fab-actions">
        <button type="button" class="btn btn-link" id="edit-reset">Texte zurücksetzen</button>
        <button type="button" class="btn btn-primary" id="edit-exit">Fertig</button>
      </div>
    </div>
  `;
  document.body.appendChild(toolbar);

  const trigger = document.getElementById('edit-fab-trigger');
  const menu = document.getElementById('edit-fab-menu');
  trigger.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
  });

  document.getElementById('edit-exit').addEventListener('click', () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('edit');
    window.location.href = url.toString();
  });

  document.getElementById('edit-reset').addEventListener('click', async () => {
    if (!confirm('Alle bearbeiteten Texte auf den Original-Zustand zurücksetzen?')) return;
    await window.alsterDb?.remove('content');
    location.reload();
  });
}

function onEditFocus(e) {
  e.currentTarget.dataset.editOriginal = e.currentTarget.innerHTML;
  setEditStatus('Tippen Sie Ihren Text – Speichern beim Verlassen des Feldes.');
}

async function onEditBlur(e) {
  const el = e.currentTarget;
  const key = el.dataset.editable;
  const newValue = el.innerHTML.trim();
  const original = el.dataset.editOriginal || '';
  if (newValue === original) {
    setEditStatus('Keine Änderung.');
    return;
  }
  // Versehentliches Leeren verhindern — Text muss tatsaechlich Inhalt haben.
  // Sonst wuerde der Standard-Text der Seite ueberschrieben durch nichts.
  if (newValue.replace(/<[^>]*>/g, '').trim().length === 0) {
    el.innerHTML = original;
    setEditStatus('Feld darf nicht leer sein — Original wiederhergestellt.', 'error');
    return;
  }
  const content = window.alsterDb?.get('content') || {};
  content[key] = newValue;
  setEditStatus('Speichern …');
  const ok = await window.alsterDb?.set('content', content);
  if (ok) {
    setEditStatus('Gespeichert · ' + new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), 'ok');
  } else {
    setEditStatus('Speichern fehlgeschlagen.', 'error');
  }
}

function setEditStatus(msg, kind = '') {
  const s = document.getElementById('edit-status');
  if (!s) return;
  s.textContent = msg;
  s.dataset.kind = kind;
}

/* ---------- Design (Logo, Bilder, Galerie, Akzentfarbe) ---------- */
function initDesign() {
  let design = {};
  try { design = JSON.parse(localStorage.getItem(STORAGE_DESIGN) || '{}'); } catch {}

  // Akzentfarbe
  if (design.accentColor) {
    document.documentElement.style.setProperty('--gold', design.accentColor);
  }

  // Logo (Header + Footer + Brand-Logo überall)
  if (design.logo) {
    document.querySelectorAll('img.brand-logo').forEach(img => { img.src = design.logo; });
  }

  // (Hinweis: Es gibt bewusst KEIN Hero-Bild mehr — der Startseiten-Hero ist
  //  ein reines Text-/Cinematic-Layout. Der frühere heroImage-Slot wurde aus
  //  dem Mitgliederbereich entfernt, weil er nirgends angezeigt wurde.)

  // About-Bild
  const aboutAside = document.querySelector('.about-aside');
  if (aboutAside) {
    let aboutImg = aboutAside.querySelector('.about-photo');
    if (design.aboutImage) {
      if (!aboutImg) {
        aboutImg = document.createElement('div');
        aboutImg.className = 'about-photo';
        aboutAside.insertBefore(aboutImg, aboutAside.firstChild);
      }
      aboutImg.style.backgroundImage = `url("${design.aboutImage}")`;
    } else if (aboutImg) {
      aboutImg.remove();
    }
  }

  // Galerie
  renderHomeGallery(design.gallery);
}

function renderHomeGallery(images) {
  const gallery = Array.isArray(images) ? images.filter(Boolean) : [];
  let section = document.getElementById('galerie');

  // Owner-Hinweis (nur im Bearbeitungs-Modus): leere Galerie zeigt sichtbaren
  // CTA zum Hochladen. Fuer normale Besucher bleibt die Sektion versteckt.
  const isEditing = (() => {
    try {
      if (new URLSearchParams(location.search).get('edit') === '1') return true;
      if (localStorage.getItem('alstercafe.auth') === '1') return true;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
          try {
            const v = JSON.parse(localStorage.getItem(k) || 'null');
            if (v && v.access_token) return true;
          } catch {}
        }
      }
    } catch {}
    return false;
  })();

  if (!gallery.length && !isEditing) {
    if (section) section.hidden = true;
    return;
  }

  if (!section) {
    section = document.createElement('section');
    section.id = 'galerie';
    section.className = 'section gallery';
    section.innerHTML = `
      <div class="container">
        <div class="section-head reveal">
          <p class="eyebrow"><span class="num">·</span> Galerie</p>
          <h2>Eindrücke aus<br/>unserem Café</h2>
        </div>
        <div class="gallery-grid"></div>
      </div>
    `;
    // Reihenfolge: Galerie kommt VOR dem Closer mit "Fin.",
    // sonst macht das Schlusszeichen keinen Sinn.
    const closer = document.querySelector('.landing-closer');
    const reservation = document.getElementById('reservierung');
    if (closer) closer.parentElement.insertBefore(section, closer);
    else if (reservation) reservation.parentElement.insertBefore(section, reservation);
    else document.querySelector('main').appendChild(section);
  }
  section.hidden = false;
  const grid = section.querySelector('.gallery-grid');
  grid.innerHTML = '';

  if (!gallery.length) {
    // Owner sieht einen Platzhalter mit klarer Handlungsaufforderung
    const ph = document.createElement('a');
    ph.className = 'gallery-empty-cta';
    ph.href = 'admin.html';
    ph.innerHTML = `
      <span class="gallery-empty-icon" aria-hidden="true">+</span>
      <span class="gallery-empty-title">Hier fehlen noch Fotos</span>
      <span class="gallery-empty-desc">Bis zu 6 Bilder hochladen — Eckcafé, Croques, Brötchen, Innenraum. Im Mitgliederbereich unter „Bilder hochladen".</span>
      <span class="gallery-empty-link">Zum Mitgliederbereich →</span>
    `;
    grid.appendChild(ph);
    return;
  }

  gallery.forEach((src, i) => {
    const item = document.createElement('figure');
    item.className = 'gallery-item' + (i === 0 ? ' is-feature' : '');
    // Galerie-Photos haben (noch) keine individuellen Alt-Texte.
    // Generischer aber sinnvoller Text fuer Screen-Reader bis Maria
    // im Admin Captions hinterlegen kann.
    item.innerHTML = `<img src="${src}" alt="Eindruck aus dem Alstercafé in Hamburg-Hohenfelde" loading="lazy" />`;
    grid.appendChild(item);
  });
}

/* ---------- Scroll-Aware Header ---------- */
function initStickyHeader() {
  const header = document.querySelector('.site-header, .admin-header');
  if (!header) return;
  let ticking = false;
  const update = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
  update();
}

/* ---------- Navigation ---------- */
function initNav() {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('primary-nav');
  if (!toggle || !nav) return;
  const setOpen = (open) => {
    nav.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', alsterLang() === 'en' ? (open ? 'Close menu' : 'Open menu') : (open ? 'Menü schließen' : 'Menü öffnen'));
  };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));
  // ESC schließt das Menü
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.classList.contains('open')) setOpen(false);
  });
}

/* ---------- Reveal-on-Scroll ---------- */
function initReveal() {
  const reveals = Array.from(document.querySelectorAll('.reveal'));
  if (!reveals.length) return;

  // Geschwister bekommen gestaffelte Delays fuer eleganten Reveal
  const groups = new Map();
  reveals.forEach(el => {
    const parent = el.parentElement;
    if (!groups.has(parent)) groups.set(parent, []);
    groups.get(parent).push(el);
  });
  groups.forEach(siblings => {
    if (siblings.length > 1) {
      siblings.forEach((el, i) => el.style.setProperty('--reveal-delay', `${Math.min(i * 70, 210)}ms`));
    }
  });

  const show = el => el.classList.add('in');

  // Ohne IntersectionObserver: alles sofort zeigen (nie leer).
  if (!('IntersectionObserver' in window)) {
    reveals.forEach(show);
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        show(e.target);
        io.unobserve(e.target);
      }
    });
    // Positiver unterer rootMargin: Abschnitte blenden ein, BEVOR sie ins
    // Sichtfeld scrollen — so wirkt nie ein Kasten „leer".
  }, { rootMargin: '0px 0px 20% 0px', threshold: 0 });
  reveals.forEach(el => io.observe(el));

  // --- Robustheit, damit NIE ein Abschnitt leer bleibt ---
  // iOS Safari loest den Observer an der unteren Kante gelegentlich zu spaet
  // (oder gar nicht) aus. Darum zusaetzlich: alles, was schon im/nahe am
  // Sichtfeld ist, beim Scrollen direkt zeigen — plus ein Sicherheitsnetz.
  const revealInView = () => {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    for (let i = reveals.length - 1; i >= 0; i--) {
      const el = reveals[i];
      if (el.classList.contains('in')) { reveals.splice(i, 1); continue; }
      const r = el.getBoundingClientRect();
      if (r.top < vh * 1.15 && r.bottom > -vh * 0.15) { show(el); io.unobserve(el); }
    }
  };
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; revealInView(); });
  };
  revealInView();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  window.addEventListener('load', revealInView);
  // Letztes Sicherheitsnetz: nach 2,5 s alles zeigen, was noch haengt —
  // so bleibt garantiert kein Kasten dauerhaft leer, egal was der Browser macht.
  setTimeout(() => {
    document.querySelectorAll('.reveal:not(.in)').forEach(show);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  }, 2500);
}

/* ---------- Cookie-Banner ---------- */
function initCookieBanner() {
  // Wenn kein Banner im HTML ist (Sub-Pages haben ihn nicht): injizieren.
  // Sonst kann der Besucher von Sub-Pages aus weder Consent geben noch
  // ueber den "Cookies anpassen"-Link das Consent zuruecksetzen.
  let banner = document.getElementById('cookie-banner');
  if (!banner && !document.body.classList.contains('admin-body')) {
    banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.id = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie-Hinweis');
    banner.hidden = true;
    banner.innerHTML = `
      <div class="container cookie-inner">
        <div class="cookie-text">
          <strong>Wir respektieren Ihre Privatsphäre.</strong>
          Wir verwenden nur technisch notwendige Speicherfunktionen. „Alle akzeptieren" lädt zusätzlich die Google-Karte auf der Kontaktseite — die setzt eigene Cookies. Mehr in der <a href="datenschutz.html">Datenschutzerklärung</a>.
        </div>
        <div class="cookie-actions">
          <button type="button" class="btn btn-link cookie-decline" id="cookie-decline">Nur notwendige</button>
          <button type="button" class="btn btn-primary cookie-accept" id="cookie-accept">Alle akzeptieren</button>
        </div>
      </div>
    `;
    document.body.appendChild(banner);
  }

  const accept   = document.getElementById('cookie-accept');
  const decline  = document.getElementById('cookie-decline');
  if (!banner) return;

  const consent = readConsent();
  if (!consent) banner.hidden = false;
  if (consent === 'accepted') loadMap();

  accept?.addEventListener('click', () => {
    writeConsent('accepted');
    banner.hidden = true;
    loadMap();
  });
  decline?.addEventListener('click', () => {
    writeConsent('declined');
    banner.hidden = true;
  });

  const mapLoadBtn = document.getElementById('map-load');
  mapLoadBtn?.addEventListener('click', () => {
    writeConsent('accepted');
    loadMap();
  });

  const cookieReset = document.getElementById('cookie-reset');
  cookieReset?.addEventListener('click', (e) => {
    e.preventDefault();
    try { localStorage.removeItem(STORAGE_CONSENT); } catch {}
    banner.hidden = false;
    banner.scrollIntoView({ behavior: 'smooth', block: 'end' });
  });

  // Event-Delegation: enhanceFooterEditorial baut den Footer neu auf
  // und ersetzt #cookie-reset durch ein NEUES Element. Der oben
  // angeheftete Handler haengt dann an einem detached Element.
  // Mit Delegation auf document fangen wir Clicks unabhaengig vom
  // Zeitpunkt der Element-Erzeugung ab.
  document.addEventListener('click', (e) => {
    const target = e.target.closest('#cookie-reset');
    if (!target) return;
    e.preventDefault();
    try { localStorage.removeItem(STORAGE_CONSENT); } catch {}
    banner.hidden = false;
    banner.scrollIntoView({ behavior: 'smooth', block: 'end' });
  });
}

function readConsent() {
  try { return localStorage.getItem(STORAGE_CONSENT); }
  catch { return null; }
}
function writeConsent(value) {
  try { localStorage.setItem(STORAGE_CONSENT, value); } catch {}
}

function loadMap() {
  const placeholder = document.getElementById('map-placeholder');
  const iframe = document.getElementById('map-iframe');
  if (!iframe) return;
  // Stelle sicher, dass src nur einmal gesetzt wird
  if (iframe.dataset.src && iframe.getAttribute('src') !== iframe.dataset.src) {
    iframe.setAttribute('src', iframe.dataset.src);
  }
  iframe.removeAttribute('hidden');
  iframe.style.display = 'block';
  if (placeholder) {
    placeholder.style.display = 'none';
  }
}

/* ---------- Hinweis-Banner ---------- */
function initNotice() {
  let banner = document.getElementById('notice-banner');

  // Auf Sub-Pages (Speisekarte, Kontakt, Reservierung etc.) fehlt der Banner
  // im HTML — injizieren, damit Brueckentag-Hinweise UEBERALL erscheinen,
  // nicht nur auf der Startseite. Admin-Body wird ausgenommen.
  if (!banner && !document.body.classList.contains('admin-body')) {
    banner = document.createElement('div');
    banner.className = 'notice-banner';
    banner.id = 'notice-banner';
    banner.hidden = true;
    banner.innerHTML = `
      <div class="container notice-inner">
        <span class="notice-tag">Hinweis</span>
        <p id="notice-text"></p>
      </div>
    `;
    // Direkt OBERHALB der Topbar einsetzen — entspricht der Position
    // auf index.html (wo der Banner statisch im HTML sitzt).
    const topbar = document.querySelector('.topbar');
    if (topbar && topbar.parentNode) {
      topbar.parentNode.insertBefore(banner, topbar);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }
  }

  const text = banner?.querySelector('#notice-text');
  if (!banner || !text) return;
  let value = '';
  try { value = (localStorage.getItem(STORAGE_NOTICE) || '').trim(); } catch {}
  if (value) {
    text.textContent = value;
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }
}

/* ---------- Urlaub/Feiertag-Banner ----------
   Zeigt an jedem Schließtag (aus dem Content-Key 'holidays') auf allen
   Seiten einen klaren „Heute geschlossen"-Hinweis. Nutzt die Notice-Optik. */
function initHolidays() {
  if (document.body.classList.contains('admin-body')) return;
  let banner = document.getElementById('holiday-banner');
  const hol = todayHoliday();
  if (!hol) { if (banner) banner.hidden = true; return; }
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'notice-banner holiday-banner';
    banner.id = 'holiday-banner';
    banner.hidden = true;
    banner.innerHTML = `
      <div class="container notice-inner">
        <span class="notice-tag">Geschlossen</span>
        <p id="holiday-text"></p>
      </div>`;
    const topbar = document.querySelector('.topbar');
    if (topbar && topbar.parentNode) topbar.parentNode.insertBefore(banner, topbar);
    else document.body.insertBefore(banner, document.body.firstChild);
  }
  const en = alsterLang() === 'en';
  const txt = banner.querySelector('#holiday-text');
  if (txt) txt.textContent = (en ? 'Closed today' : 'Heute geschlossen') + (hol.label ? ' — ' + hol.label : '');
  banner.hidden = false;
}

/* ---------- Speisekarte ----------
   Rendert die Karte aus der geteilten Datenbasis (menudata.js).
   Vorrang: vom Inhaber gespeicherte Daten (Supabase/localStorage),
   sonst der Default aus window.ALSTERCAFE_MENU_DEFAULT.
   So sind Webseite, Admin-Editor und PDF immer synchron.
   Die statische Karte im HTML ist nur no-JS-Fallback. */
function getMenuData() {
  // 1. Vom Inhaber gespeicherte Karte (via db.js / Supabase-Cache)
  let stored = null;
  try { stored = window.alsterDb?.get('menu'); } catch {}
  if (!stored) {
    try {
      const raw = localStorage.getItem(STORAGE_MENU);
      if (raw) stored = JSON.parse(raw);
    } catch {}
  }
  if (stored && Array.isArray(stored.sections) && stored.sections.length) return stored;
  // 2. Default aus der geteilten Datei
  if (window.ALSTERCAFE_MENU_DEFAULT) return window.ALSTERCAFE_MENU_DEFAULT;
  return null;
}

function initMenu() {
  const mount = document.getElementById('karte-mount');
  if (!mount) return;
  const data = getMenuData();
  if (!data || !Array.isArray(data.sections) || !data.sections.length) return;
  mount.innerHTML = renderKarteHtml(data);
  injectMenuSchema(data);
}

/* Schema.org/Menu fuer Google Rich Results — aus denselben Daten.
   So koennen Gerichte + Preise in der Google-Suche erscheinen. */
function injectMenuSchema(data) {
  try {
    const parsePrice = (p) => {
      // "8,90 €" -> "8.90"; "2,80 / 3,80 €" -> "2.80" (kleiner Preis)
      const m = String(p || '').match(/(\d+)[,.](\d{2})/);
      return m ? `${m[1]}.${m[2]}` : null;
    };
    const sections = data.sections.filter(s => s && Array.isArray(s.items) && s.items.length);
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Menu',
      name: 'Frühstückskarte',
      inLanguage: 'de',
      hasMenuSection: sections.map(sec => ({
        '@type': 'MenuSection',
        name: sec.title || '',
        hasMenuItem: sec.items.filter(it => it.name).map(it => {
          const item = { '@type': 'MenuItem', name: it.name };
          if (it.desc) item.description = it.desc;
          const price = parsePrice(it.price);
          if (price) item.offers = { '@type': 'Offer', price, priceCurrency: 'EUR' };
          if (it.tag && /vegan/i.test(it.tag)) item.suitableForDiet = 'https://schema.org/VeganDiet';
          return item;
        })
      }))
    };
    let el = document.getElementById('menu-schema');
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = 'menu-schema';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(schema);
  } catch (e) { /* Schema ist optional — niemals die Seite blockieren */ }
}

/* Baut das Karten-HTML — gleiche CSS-Klassen wie die statische Karte,
   damit Default-Anblick und Override pixelgleich sind. */
function renderKarteHtml(data) {
  const sections = data.sections.filter(s => s && Array.isArray(s.items) && s.items.length);
  const blocks = sections.map(sec => {
    const compact = sec.items.every(it => !it.desc);
    const note = sec.note ? `<p class="karte-block-note">${escapeHtml(sec.note)}</p>` : '';
    const items = sec.items.map(it => {
      const tag = it.tag ? ` <span class="karte-tag">${escapeHtml(it.tag)}</span>` : '';
      const preis = it.price ? `<span class="karte-preis">${escapeHtml(it.price)}</span>` : '';
      if (compact) {
        return `<li class="karte-row"><span class="karte-name">${escapeHtml(it.name || '')}${tag}</span>${preis}</li>`;
      }
      const desc = it.desc ? `<p class="karte-desc">${escapeHtml(it.desc)}</p>` : '';
      return `<li><div class="karte-row"><span class="karte-name">${escapeHtml(it.name || '')}${tag}</span>${preis}</div>${desc}</li>`;
    }).join('');
    return `
      <div class="karte-block reveal in">
        <div class="karte-block-head"><svg class="ico"><use href="#${escapeAttr(sec.icon || 'i-bread')}"/></svg><h2>${escapeHtml(sec.title || '')}</h2></div>
        ${note}
        <ul class="karte-list${compact ? ' karte-list-compact' : ''}">${items}</ul>
      </div>`;
  }).join('');
  const foot = data.footnote ? `<p class="karte-fussnote">${escapeHtml(data.footnote)}</p>` : '';
  return `<div class="karte-grid">${blocks}</div>${foot}`;
}

/* ---------- Öffnungszeiten ----------
   HTML enthaelt Standard-Werte. JS ueberschreibt nur bei Custom-Daten. */
function initHours() {
  renderFooterHours();
  const root = document.getElementById('hours-list');
  if (!root) return;
  let hours = null;
  try {
    const raw = localStorage.getItem(STORAGE_HOURS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) hours = parsed;
    }
  } catch {}
  if (!hours) return; // Standard-HTML beibehalten
  root.innerHTML = hours.map(h => `
    <li><span>${escapeHtml(h.label || '')}</span><span class="time">${escapeHtml(h.time || '')}</span></li>
  `).join('');
}

/* ---------- Mittagstisch (Wochenplan) ---------- */
function initLunchWeek() {
  // Nur auf Mittagstisch-Seite aktiv
  if (!document.getElementById('lunch-today') && !document.getElementById('lunch-week-list')) return;
  const today = new Date();
  // Sunday-Spillover (spiegelt admin.js maybeEnableSundaySpillover):
  // Am Sonntag traegt der Inhaber die kommende Woche ein — die Wochenliste
  // zeigt sie daher sonntags an. Das heutige Sonntags-Gericht wird weiterhin
  // aus der laufenden Woche geladen (dort speichert admin den Spillover).
  const isSunday = today.getDay() === 0;
  const displayMonday = isSunday
    ? mondayOf(new Date(today.getTime() + 86400000))
    : mondayOf(today);
  const todayWeekData   = loadCurrentWeek(mondayOf(today));
  const displayWeekData = loadCurrentWeek(displayMonday);
  renderWeekMeta(displayMonday);
  renderTodayLunch(todayWeekData, today);
  renderWeekList(displayWeekData, displayMonday, today);
}

/* Today-Feature-Block auf der Home-Page:
   - Vor 15:00 (Schliesszeit): heutiges Tagesgericht
   - Ab 15:00 (Cafe geschlossen): Vorschau auf morgen */
/* Zwei Gerichte pro Tag ("entweder … oder …"): liefert die eingetragenen
   Gerichte als Liste [{ dish, side }] — leere werden ausgelassen. */
function dayDishes(entry) {
  if (!entry || entry.closed) return [];
  return [{ dish: entry.dish, side: entry.side }, { dish: entry.dish2, side: entry.side2 }]
    .map(d => ({ dish: String(d.dish || '').trim(), side: String(d.side || '').trim() }))
    .filter(d => d.dish);
}
// HTML-Trenner "oder" zwischen zwei Gerichten
function orDividerHtml(en, cls = 'dish-or') {
  return `<span class="${cls}" aria-hidden="false"><span>${en ? 'or' : 'oder'}</span></span>`;
}
// Zweites Gericht unter einem großen Tagesgericht (Startseite / Mittagstisch-Seite)
function renderAltDish(afterEl, entry, en, withMit) {
  if (!afterEl) return;
  const host = afterEl.parentElement;
  let alt = host.querySelector(':scope > .dish-alt');
  const list = dayDishes(entry);
  if (list.length < 2) { alt?.remove(); return; }
  if (!alt) {
    alt = document.createElement('div');
    alt.className = 'dish-alt';
    alt.setAttribute('data-no-i18n', '');
    afterEl.after(alt);
  }
  const d = list[1];
  const side = d.side ? (withMit ? sideText(d.side, en) : d.side) : '';
  // Gleiche Gestaltung wie das erste Gericht (beide Optionen auf Augenhöhe)
  const dishCls = (host.querySelector('[id$="-dish"]')?.className || '').replace(/\bis-tappable\b|\breveal\b|\bin\b/g, '').trim();
  const sideCls = (host.querySelector('[id$="-side"]')?.className || '').replace(/\bis-tappable\b|\breveal\b|\bin\b/g, '').trim();
  alt.innerHTML = `${orDividerHtml(en)}<p class="dish-alt-name ${dishCls}">${escapeHtml(d.dish)}</p>${side ? `<p class="dish-alt-side ${sideCls}">${escapeHtml(side)}</p>` : ''}`;
}

/* Beilage: "mit …" nur voranstellen, wenn der Text nicht schon so anfängt
   (sonst entstand "mit serviert mit einem Beilagensalat"). */
function sideText(side, en) {
  const t = String(side || '').trim();
  if (!t) return '';
  if (/^(mit|serviert|dazu|und|inkl|wahlweise|oder|with|served|and|or)\b/i.test(t)) return t;
  return en ? `with ${t}` : `mit ${t}`;
}

/* Mittagsmenü der Woche als Fenster (Tipp aufs Tagesgericht auf der Startseite). */
function openLunchSheet(refDate) {
  const en = alsterLang() === 'en';
  const monday = mondayOf(refDate || new Date());
  const week = loadCurrentWeek(monday);
  const todayIso = isoLocal(new Date());
  // Hervorgehoben wird der Tag, den die Startseite gerade zeigt (heute oder ab 15 Uhr morgen)
  const focusIso = isoLocal(refDate || new Date());
  const focusLabel = focusIso === todayIso ? (en ? 'Today' : 'Heute') : (en ? 'Tomorrow' : 'Morgen');
  const labels = dayLabels();
  const rows = DAY_KEYS.map((key, i) => {
    const d = new Date(monday); d.setDate(d.getDate() + i);
    const entry = week?.days?.[key];
    // Wochenende nur zeigen, wenn dort wirklich etwas eingetragen ist
    if (i >= 5 && !dayDishes(entry).length) return '';
    const iso = isoLocal(d);
    const isToday = iso === focusIso;
    const past = iso < todayIso;
    let body;
    if (entry?.closed) body = `<span class="lunch-sheet-closed">${en ? 'No lunch' : 'Kein Mittagstisch'}</span>`;
    else if (dayDishes(entry).length) body = dayDishes(entry).map(d =>
      `<span class="lunch-sheet-dish">${escapeHtml(d.dish)}</span>${d.side ? `<span class="lunch-sheet-side">${escapeHtml(sideText(d.side, en))}</span>` : ''}`
    ).join(orDividerHtml(en, 'lunch-sheet-or'));
    else body = `<span class="lunch-sheet-pending">${en ? 'Coming soon' : 'Folgt in Kürze'}</span>`;
    return `
      <li class="lunch-sheet-day${isToday ? ' is-today' : ''}${past ? ' is-past' : ''}">
        <div class="lunch-sheet-when">
          <span class="lunch-sheet-name">${labels[i]}</span>
          <span class="lunch-sheet-date">${formatDay(d)}</span>
          ${isToday ? `<span class="lunch-sheet-today">${focusLabel}</span>` : ''}
        </div>
        <div class="lunch-sheet-body">${body}</div>
      </li>`;
  }).join('');
  const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);

  let dlg = document.getElementById('lunch-sheet');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'lunch-sheet';
    dlg.className = 'lunch-sheet';
    dlg.setAttribute('data-no-i18n', '');
    document.body.appendChild(dlg);
    // Tipp auf den abgedunkelten Hintergrund schließt
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => document.body.classList.remove('sheet-open'));
  }
  dlg.setAttribute('aria-label', en ? 'Lunch menu this week' : 'Mittagsmenü dieser Woche');
  dlg.innerHTML = `
    <div class="lunch-sheet-card">
      <button type="button" class="lunch-sheet-close" aria-label="${en ? 'Close' : 'Schließen'}">×</button>
      <p class="lunch-sheet-kicker">${en ? 'Lunch · from 12:00' : 'Mittagstisch · ab 12:00 Uhr'}</p>
      <h2 class="lunch-sheet-title">${en ? 'This week' : 'Diese Woche'}</h2>
      <p class="lunch-sheet-range">${(en ? 'Week ' : 'KW ') + isoWeek(monday)} · ${formatShort(monday)} – ${formatShort(sunday)}</p>
      <ul class="lunch-sheet-list">${rows}</ul>
      <div class="lunch-sheet-cta">
        <a class="btn btn-gold" href="reservierung.html">${en ? 'Book a table' : 'Tisch reservieren'}</a>
        <a class="btn btn-link" href="tel:+494022692891"><svg class="ico ico-sm"><use href="#i-phone"/></svg> 040 – 22 69 28 91</a>
      </div>
      <a class="lunch-sheet-more" href="mittagstisch.html">${en ? 'Go to the lunch page →' : 'Zur Mittagstisch-Seite →'}</a>
    </div>`;
  dlg.querySelector('.lunch-sheet-close').addEventListener('click', () => dlg.close());
  document.body.classList.add('sheet-open');
  if (typeof dlg.showModal === 'function') dlg.showModal(); else location.href = 'mittagstisch.html';
  // Heutigen Tag in den sichtbaren Bereich holen
  dlg.querySelector('.is-today')?.scrollIntoView({ block: 'nearest' });
}

function initLandingTeaser() {
  const block    = document.getElementById('today-feature');
  const prefixEl = document.getElementById('today-feature-prefix');
  const dayEl    = document.getElementById('today-feature-day');
  const kickerEl = document.getElementById('today-feature-kicker');
  const dishEl   = document.getElementById('today-feature-dish');
  const sideEl   = document.getElementById('today-feature-side');
  if (!block || !dishEl) return;

  const now = new Date();
  const showTomorrow = now.getHours() >= 15;
  const targetDate = new Date(now);
  if (showTomorrow) targetDate.setDate(targetDate.getDate() + 1);

  const monday = mondayOf(targetDate);
  const weekData = loadCurrentWeek(monday);
  const dayIdx = (targetDate.getDay() + 6) % 7;
  const dayKey = DAY_KEYS[dayIdx];
  const entry  = weekData?.days?.[dayKey];

  const en = alsterLang() === 'en';
  // Tipp aufs Gericht (oder auf "Ganze Woche ansehen") öffnet das Mittagsmenü
  if (!dishEl.dataset.sheetWired) {
    dishEl.dataset.sheetWired = '1';
    const open = () => openLunchSheet(targetDate);
    [dishEl, sideEl].forEach(el => {
      if (!el) return;
      el.classList.add('is-tappable');
      el.addEventListener('click', open);
    });
    dishEl.setAttribute('role', 'button');
    dishEl.setAttribute('tabindex', '0');
    dishEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    const hint = document.createElement('button');
    hint.type = 'button';
    hint.className = 'today-feature-week';
    hint.addEventListener('click', open);
    (sideEl || dishEl).after(hint);
  }
  // Info-Karte im Hero: Zeile „Mittag“ mit dem Tagesgericht (öffnet das Wochen-Fenster)
  const heroLunch = document.getElementById('hero-coord-lunch');
  if (heroLunch) {
    const lbl = document.getElementById('hero-coord-lunch-label');
    if (lbl) lbl.textContent = showTomorrow ? (en ? 'Tomorrow' : 'Morgen mittag') : (en ? 'Lunch' : 'Mittag');
    const list = dayDishes(entry);
    // Bei zwei Gerichten beide kurz anzeigen (sonst schnitt die Karte mitten im Text ab)
    const short = (t, n) => t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + ' …' : t;
    heroLunch.textContent = list.length
      ? (list.length > 1 ? list.map(d => short(d.dish, 24)).join(en ? ' or ' : ' oder ') : list[0].dish)
      : entry?.closed ? (en ? 'No lunch' : 'Kein Mittagstisch') : (en ? 'Menu coming soon' : 'Karte folgt');
    if (!heroLunch.dataset.wired) {
      heroLunch.dataset.wired = '1';
      heroLunch.addEventListener('click', () => openLunchSheet(targetDate));
    }
  }
  const hintEl = block.querySelector('.today-feature-week');
  if (hintEl) hintEl.textContent = en ? 'See the whole week ›' : 'Ganze Woche ansehen ›';
  dishEl.setAttribute('aria-haspopup', 'dialog');
  if (prefixEl) prefixEl.textContent = showTomorrow ? (en ? 'Tomorrow' : 'Morgen') : (en ? 'Today' : 'Heute');
  if (dayEl)    dayEl.textContent    = dayLabels()[dayIdx];

  if (dayDishes(entry).length) {
    block.dataset.state = 'open';
    if (kickerEl) kickerEl.textContent = showTomorrow
      ? (en ? 'Tomorrow at midday' : 'Morgen mittag bei uns')
      : (en ? 'At midday today' : 'Heute mittag bei uns');
    dishEl.textContent = entry.dish;
    if (sideEl) {
      sideEl.textContent = entry.side ? sideText(entry.side, en) : '';
      sideEl.hidden = !entry.side;
    }
    // Hauptgericht leer, nur 2. Gericht eingetragen → das 2. als Hauptgericht zeigen
    if (!String(entry.dish || '').trim()) {
      const only = dayDishes(entry)[0];
      dishEl.textContent = only.dish;
      if (sideEl) { sideEl.textContent = only.side ? sideText(only.side, en) : ''; sideEl.hidden = !only.side; }
    }
    renderAltDish(sideEl || dishEl, entry, en, true);
  } else if (entry?.closed) {
    block.dataset.state = 'closed';
    renderAltDish(sideEl || dishEl, null, en);
    if (kickerEl) kickerEl.textContent = showTomorrow
      ? (en ? 'Closed tomorrow' : 'Morgen geschlossen')
      : (en ? 'Closed today' : 'Wir machen heute Pause');
    dishEl.textContent = showTomorrow
      ? (en ? 'Back the day after — we look forward to seeing you.' : 'Übermorgen geht es weiter — wir freuen uns auf Sie.')
      : (en ? 'See you tomorrow — we look forward to your visit.' : 'Bis morgen — wir freuen uns auf Sie.');
    if (sideEl) sideEl.hidden = true;
  } else {
    block.dataset.state = 'empty';
    renderAltDish(sideEl || dishEl, null, en);
    if (kickerEl) kickerEl.textContent = showTomorrow
      ? (en ? 'Menu coming soon' : 'Karte folgt in Kürze')
      : (en ? 'Just drop by' : 'Schauen Sie einfach vorbei');
    dishEl.textContent = showTomorrow
      ? (en ? 'Details coming soon.' : 'Eintrag folgt in Kürze.')
      : (en ? 'Fresh rolls, Croques and coffee — all day long.' : 'Frische Brötchen, Croques und Kaffee — den ganzen Tag.');
    if (sideEl) sideEl.hidden = true;
  }
}

/* Magnetic Hover: Primary-CTAs ziehen den Mauspointer leicht an (Desktop) */
function initMagnetic() {
  if (matchMedia('(pointer: coarse)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('.btn-stamp, .btn-gold, .btn-primary').forEach(el => {
    let raf = 0;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top  + r.height / 2)) / r.height;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `translate3d(${dx * 8}px, ${dy * 8}px, 0)`;
      });
    };
    const onLeave = () => {
      if (raf) cancelAnimationFrame(raf);
      el.style.transform = '';
    };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
  });
}

/* ---------- Premium-Polish: Scroll-Progress + Hero-Parallax ----------
   Bringt zwei ruhige Mikro-Details auf die Seite, die nur dann
   wirken, wenn sie unauffaellig sind: Scroll-Hairline ganz oben
   plus subtiles Watermark-Parallax am Hero. */
function initPremiumPolish() {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Scroll-Progress-Hairline (auf allen Seiten ausser admin.html)
  if (!document.body.classList.contains('admin-body')) {
    let bar = document.querySelector('.scroll-progress');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'scroll-progress';
      bar.setAttribute('aria-hidden', 'true');
      const fill = document.createElement('div');
      fill.className = 'scroll-progress-fill';
      bar.appendChild(fill);
      document.body.appendChild(bar);
    }
    const fill = bar.querySelector('.scroll-progress-fill');
    let rafProg = 0;
    const updateProgress = () => {
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const pct = Math.min(100, Math.max(0, (window.scrollY / max) * 100));
      fill.style.width = pct.toFixed(2) + '%';
      rafProg = 0;
    };
    window.addEventListener('scroll', () => {
      if (!rafProg) rafProg = requestAnimationFrame(updateProgress);
    }, { passive: true });
    updateProgress();
  }

  // 2. Hero-Watermark-Parallax + Sub-Page-Watermarks (nur Desktop)
  const wmarks = document.querySelectorAll('.hero-est, .page-hero-watermark');
  if (wmarks.length && !reduceMotion && !matchMedia('(pointer: coarse)').matches) {
    let rafPar = 0;
    const updatePar = () => {
      const y = Math.min(60, window.scrollY * 0.18);
      wmarks.forEach(el => el.style.setProperty('--hero-parallax-y', `${y}px`));
      rafPar = 0;
    };
    window.addEventListener('scroll', () => {
      if (!rafPar) rafPar = requestAnimationFrame(updatePar);
    }, { passive: true });
    updatePar();
  }

  // 3. Edition-Strip · Datum, Volume, Heute
  const editionDate = document.getElementById('edition-date');
  if (editionDate) {
    const now = new Date();
    const fmt = now.toLocaleDateString(dateLocale(), { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    editionDate.textContent = fmt;
  }
  // Vol/No-Element wurde entfernt — editoriales Magazintheater ohne
  // realen Bezug zur Baeckerei. Datum + Standort sind genug.
  updateHeroToday();

  // 4. Eigener Mauszeiger (Dot + Ring) bewusst DEAKTIVIERT — der normale
  //    System-Mauszeiger ist am Laptop erwartbar und ruhiger. Die Funktion
  //    bleibt im Code, wird aber nicht aufgerufen.
  // initCustomCursor(reduceMotion);

  // 5. Edition-Strip auf allen Seiten ausser Admin
  injectEditionStripIfMissing();

  // 6. Page-Transition · sanftes Fade beim Wechsel zwischen Seiten
  initPageTransitions(reduceMotion);

  // 7. Scroll-Hint am Hero · floating "scrollen"-Marker
  initHeroScrollHint();

  // 8. Char-by-Char-Reveal auf der Hero-H1
  initHeroCharReveal(reduceMotion);

  // 9. Footer-Credit-Zeile injizieren
  injectFooterCredit();

  // 10. Chapter-Rail · floating Magazin-Index rechts
  initChapterRail();

  // 11. SVG-Flourish-Dividers in existierende ornament-Boxen einsetzen
  initFlourishDividers();

  // 12. Chapter-Marks beim Sichtbarwerden einblenden
  initChapterMarkReveal();

  // 13. Closer-em-Highlight beim Sichtbarwerden zeichnen
  initEmHighlightReveal();

  // 14. H2-Line-Reveal ueber die ganze Seite
  initH2LineReveal();

  // 15. Footer-Umbau zu 3-Spalten-Editorial-Standfuss
  enhanceFooterEditorial();

  // 16. Splash-Screen-Markenstempel als SVG-Animation
  enhanceSplashMark();

  // 17. Reservation-Form: Coupon-Header voranstellen
  enhanceReservationCoupon();

  // 18. Topbar-Live-Status injizieren
  injectTopbarLiveStatus();

  // 19. Speisekarte-TOC Sidebar
  initMenuTOC();

  // 20. Hero-Coord Live-Clock
  initHeroCoordClock();

  // 21. Reservation-Tipp-Karte
  injectReservationTips();

  // 22. Brand-Wordmark Letter-by-Letter-Animation
  initBrandWordmarkReveal(reduceMotion);
}

function initBrandWordmarkReveal(reduceMotion) {
  if (reduceMotion) return;
  // Beim ersten Paint pro Session — nicht jedes Mal nach Navigation
  if (sessionStorage.getItem('alstercafe.wordmark-seen') === '1') return;

  document.querySelectorAll('.brand-name').forEach(el => {
    if (el.dataset.wordmarkReady === '1') return;
    el.dataset.wordmarkReady = '1';
    const text = el.textContent;
    let html = '';
    let charIdx = 0;
    for (const ch of text) {
      if (ch === ' ') { html += ' '; continue; }
      html += `<span class="bn-char" style="--bn-i:${charIdx}">${ch}</span>`;
      charIdx++;
    }
    el.innerHTML = html;
  });
  try { sessionStorage.setItem('alstercafe.wordmark-seen', '1'); } catch {}
}

function initMenuTOC() {
  const menuCols = document.querySelector('.menu-cols');
  if (!menuCols) return;
  if (document.querySelector('.menu-toc')) return;
  const cols = menuCols.querySelectorAll('.menu-col');
  if (cols.length < 2) return;

  const toc = document.createElement('aside');
  toc.className = 'menu-toc';
  toc.setAttribute('aria-label', 'Kategorien');

  let items = '<p class="menu-toc-label">Karte</p>';
  cols.forEach((col, i) => {
    if (!col.id) col.id = 'menu-col-' + (i + 1);
    const h3 = col.querySelector('h3');
    const title = h3 ? h3.textContent.trim() : ('Kategorie ' + (i + 1));
    const num = String(i + 1).padStart(2, '0');
    items += `<a href="#${col.id}" data-num="${num}" data-target="${col.id}">${title}</a>`;
  });
  toc.innerHTML = items;

  // Wrapper um TOC + bestehendes menu-cols-Element
  const wrap = document.createElement('div');
  wrap.className = 'menu-toc-wrap container';
  menuCols.parentNode.insertBefore(wrap, menuCols);
  wrap.appendChild(toc);
  wrap.appendChild(menuCols);
  // Ueberblendung: das menu-cols-Element verliert sein eigenes container
  // (es ist jetzt im Wrap). Falls menu-cols selbst kein container war,
  // gibt es kein Problem. Wenn doch, behalten wir die Padding.
  menuCols.classList.remove('container');

  // Aktive Section per IntersectionObserver
  if ('IntersectionObserver' in window) {
    const links = toc.querySelectorAll('a');
    const map = new Map();
    cols.forEach((col, i) => map.set(col, links[i]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const link = map.get(e.target);
        if (!link) return;
        links.forEach(l => l.classList.toggle('is-active', l === link));
      });
    }, { rootMargin: '-30% 0px -50% 0px', threshold: 0 });
    cols.forEach(c => io.observe(c));
  }
}

function updateHeroToday() {
  const heroToday = document.getElementById('hero-coord-today');
  if (!heroToday) return;
  const now = new Date();
  const wd = now.toLocaleDateString(dateLocale(), { weekday: 'long' });
  const day = openingFor(now);
  heroToday.textContent = day
    ? `${wd} · ${formatMin(day.openMin)} – ${formatMin(day.closeMin)}`
    : `${wd} · ${alsterLang() === 'en' ? 'closed' : 'geschlossen'}`;
}

function initHeroCoordClock() {
  const aside = document.querySelector('.hero-coord');
  if (!aside) return;
  if (aside.querySelector('.hero-coord-clock')) return;

  const clock = document.createElement('div');
  clock.className = 'hero-coord-clock';
  clock.innerHTML = `
    <span class="hero-coord-clock-label">Gerade jetzt</span>
    <span class="hero-coord-clock-time" id="hero-clock-time">—</span>
  `;
  aside.insertBefore(clock, aside.firstChild);

  const timeEl = clock.querySelector('#hero-clock-time');
  let lastText = '';
  const update = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const wd = now.toLocaleDateString(dateLocale(), { weekday: 'short' });
    const next = `${wd}, ${hh}:${mm}`;
    if (next !== lastText) {
      timeEl.textContent = next;
      if (lastText) {
        timeEl.classList.add('is-tick');
        setTimeout(() => timeEl.classList.remove('is-tick'), 700);
      }
      lastText = next;
    }

    // Geöffnet/geschlossen aus der zentralen Öffnungszeiten-Logik
    const st = computeLiveStatus();
    clock.classList.toggle('is-closed', !st || st.state !== 'open');
  };
  update();
  setInterval(update, 30 * 1000);
}

function injectReservationTips() {
  const intro = document.querySelector('.reservation-intro');
  if (!intro) return;
  if (intro.querySelector('.reservation-tips')) return;

  const tips = document.createElement('aside');
  tips.className = 'reservation-tips';
  tips.innerHTML = `
    <p class="reservation-tips-eyebrow">Gut zu wissen</p>
    <ul class="reservation-tips-list">
      <li data-mark="·">Sonntag- und Samstagvormittag ist <em>am stärksten</em> nachgefragt.</li>
      <li data-mark="·">Größere Gruppen (ab 6 Pers.) bitte einen Tag <em>vorher</em>.</li>
    </ul>
  `;
  intro.appendChild(tips);
}

function injectTopbarLiveStatus() {
  const topbar = document.querySelector('.topbar-inner');
  if (!topbar) return;
  if (topbar.querySelector('.topbar-live')) return;
  const el = document.createElement('span');
  el.className = 'topbar-live';
  // Vor dem ersten Separator einsetzen (am Anfang der Inner-Row)
  const firstSep = topbar.querySelector('.topbar-sep');
  topbar.insertBefore(el, topbar.firstChild);
  if (firstSep) topbar.insertBefore(firstSep.cloneNode(true), el.nextSibling);
  updateTopbarLive(computeLiveStatus());
}
function updateTopbarLive(status) {
  const el = document.querySelector('.topbar-live');
  if (!el) return;
  const en = alsterLang() === 'en';
  if (!status) { el.hidden = true; return; }
  el.hidden = false;
  el.classList.toggle('is-closed', status.state !== 'open');
  if (status.state === 'open') {
    el.innerHTML = (en ? 'Open until ' : 'Geöffnet bis ') + `<em>${formatMin(status.closeMin)}</em>`;
  } else if (status.holiday) {
    el.textContent = en ? 'Closed today' : 'Heute geschlossen';
  } else if (status.next) {
    const n = status.next;
    const lead = n.offset === 0 ? (en ? 'Today from ' : 'Heute ab ')
               : n.offset === 1 ? (en ? 'Tomorrow from ' : 'Morgen ab ')
               : (en ? `${n.when} from ` : `${n.when} ab `);
    el.innerHTML = lead + `<em>${formatMin(n.openMin)}</em>`;
  } else {
    el.textContent = en ? 'Closed' : 'Geschlossen';
  }
}

function enhanceSplashMark() {
  const splash = document.getElementById('app-splash');
  if (!splash) return;
  const oldLogo = splash.querySelector('img.app-splash-logo');
  if (!oldLogo) return;

  const mark = document.createElement('div');
  mark.className = 'app-splash-mark';
  mark.innerHTML = `
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <path id="splash-arc" d="M 100,100 m -78,0 a 78,78 0 1,1 156,0 a 78,78 0 1,1 -156,0" fill="none"/>
      </defs>
      <circle class="splash-ring" cx="100" cy="100" r="96"/>
      <circle class="splash-ring-inner" cx="100" cy="100" r="86"/>
      <g class="splash-mono">
        <text x="100" y="120" text-anchor="middle"
              font-family="'Fraunces', serif"
              font-size="78" font-weight="400">A</text>
      </g>
      <text class="splash-est-arc">
        <textPath href="#splash-arc" startOffset="50%" text-anchor="middle">
          EST · 2004 · HOHENFELDE · HAMBURG ·
        </textPath>
      </text>
    </svg>
  `;
  oldLogo.replaceWith(mark);
}

function enhanceReservationCoupon() {
  const form = document.querySelector('.reservation-form');
  if (!form) return;
  if (form.querySelector('.reservation-form-coupon-header')) return;

  const header = document.createElement('div');
  header.className = 'reservation-form-coupon-header';
  const now = new Date();
  const fmt = now.toLocaleDateString(dateLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
  header.innerHTML = `
    <p class="reservation-form-coupon-eyebrow">${alsterLang() === 'en' ? 'Issued on' : 'Ausgegeben am'} <em>${fmt}</em></p>
    <span class="reservation-form-coupon-stamp">${alsterLang() === 'en' ? '№ Reservation' : '№ Reservierung'}</span>
  `;
  form.insertBefore(header, form.firstChild);
}

/* Zahlungsarten fürs Footer (vom Inhaber bestätigt: bar, EC, alle Kreditkarten
   inkl. AMEX, Apple Pay, Google Pay). Vereinfachte Marken-Badges als inline-SVG. */
const PAYMENT_BADGES = [
  { label: 'Barzahlung', svg: '<svg viewBox="0 0 48 30" aria-hidden="true"><rect width="48" height="30" rx="4" fill="#fff"/><rect x="7" y="8" width="34" height="14" rx="2" fill="#2E7D4F"/><circle cx="24" cy="15" r="4" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="11.5" cy="15" r="1.2" fill="#fff"/><circle cx="36.5" cy="15" r="1.2" fill="#fff"/></svg>' },
  { label: 'girocard (EC-Karte)', svg: '<svg viewBox="0 0 48 30" aria-hidden="true"><rect width="48" height="30" rx="4" fill="#fff"/><rect x="4" y="6" width="40" height="18" rx="3" fill="#1D3C8F"/><text x="24" y="18.2" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="8" font-weight="700" fill="#fff">girocard</text></svg>' },
  { label: 'Visa', svg: '<svg viewBox="0 0 48 30" aria-hidden="true"><rect width="48" height="30" rx="4" fill="#fff"/><text x="24" y="20" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="900" font-style="italic" fill="#1A1F71" letter-spacing=".3">VISA</text></svg>' },
  { label: 'Mastercard', svg: '<svg viewBox="0 0 48 30" aria-hidden="true"><rect width="48" height="30" rx="4" fill="#fff"/><circle cx="19.5" cy="15" r="8" fill="#EB001B"/><circle cx="28.5" cy="15" r="8" fill="#F79E1B"/><path d="M24 8.4a8 8 0 0 1 0 13.2a8 8 0 0 1 0-13.2z" fill="#FF5F00"/></svg>' },
  { label: 'American Express', svg: '<svg viewBox="0 0 48 30" aria-hidden="true"><rect width="48" height="30" rx="4" fill="#016FD0"/><text x="24" y="18.8" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="10" font-weight="900" fill="#fff" letter-spacing=".4">AMEX</text></svg>' },
  { label: 'Apple Pay', svg: '<svg viewBox="0 0 48 30" aria-hidden="true"><rect width="48" height="30" rx="4" fill="#000"/><path d="M15.6 10.3c.5-.6.8-1.4.7-2.2-.7 0-1.6.5-2.1 1.1-.5.5-.9 1.4-.8 2.2.8.1 1.6-.4 2.2-1.1zm.7 1.2c-1.2-.1-2.2.7-2.8.7-.6 0-1.4-.6-2.4-.6-1.2 0-2.3.7-3 1.8-1.3 2.2-.3 5.5.9 7.3.6.9 1.3 1.8 2.3 1.8.9 0 1.2-.6 2.3-.6s1.4.6 2.4.6 1.6-.9 2.2-1.8c.7-1 1-2 1-2.1 0 0-1.9-.7-1.9-2.9 0-1.8 1.5-2.7 1.6-2.7-.9-1.3-2.2-1.4-2.6-1.5z" fill="#fff"/><text x="31" y="19.6" text-anchor="middle" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="11" font-weight="600" fill="#fff">Pay</text></svg>' },
  { label: 'Google Pay', svg: '<svg viewBox="0 0 48 30" aria-hidden="true"><rect width="48" height="30" rx="4" fill="#fff"/><text x="9" y="19.6" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="700"><tspan fill="#4285F4">G</tspan></text><text x="31" y="19.6" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="600" fill="#5F6368">Pay</text></svg>' }
];

// Öffnungszeiten im Footer aus den gepflegten Zeiten (sonst Standard).
function renderFooterHours(root) {
  const box = (root || document).querySelector('.footer-hours-lines');
  if (!box) return;
  let rows = null;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_HOURS) || 'null');
    if (Array.isArray(parsed) && parsed.length) rows = parsed;
  } catch {}
  box.innerHTML = (rows || DEFAULT_HOURS).map(h =>
    `<div class="footer-line"><span>${escapeHtml(h.label || '')}</span><span class="time">${escapeHtml(h.time || '')}</span></div>`).join('');
}

function enhanceFooterEditorial() {
  const footer = document.querySelector('.site-footer');
  if (!footer) return;
  const grid = footer.querySelector('.footer-grid');
  if (!grid) return;
  if (grid.dataset.editorialReady === '1') return;
  grid.dataset.editorialReady = '1';

  // Sammle die existierende Navigation
  const oldNav = grid.querySelector('.footer-nav');
  const navHtml = oldNav ? oldNav.outerHTML : '';
  const oldMeta = grid.querySelector('.footer-meta');
  const metaText = oldMeta ? oldMeta.textContent.trim() : '';

  // Brand-Block bleibt erhalten — verbessern wir nur die Typo via CSS
  const brand = grid.querySelector('.footer-brand');

  // Hours- und Address-Spalten zusammenstellen
  const adresseCol = document.createElement('div');
  adresseCol.className = 'footer-col footer-col-adresse';
  adresseCol.innerHTML = `
    <p class="footer-col-label">Besuch</p>
    <a href="https://www.google.com/maps/search/?api=1&query=Ifflandstra%C3%9Fe+45+22087+Hamburg" target="_blank" rel="noopener">Ifflandstraße 45</a>
    <a href="https://www.google.com/maps/search/?api=1&query=Ifflandstra%C3%9Fe+45+22087+Hamburg" target="_blank" rel="noopener">22087 Hamburg</a>
    <a href="tel:+494022692891">040 – 22 69 28 91</a>
    <a href="mailto:info@alstercafe.de">info@alstercafe.de</a>
  `;

  const hoursCol = document.createElement('div');
  hoursCol.className = 'footer-col footer-col-hours';
  hoursCol.innerHTML = `<p class="footer-col-label">Geöffnet</p><div class="footer-hours-lines"></div>`;

  renderFooterHours(hoursCol);

  // Neue Reihenfolge: brand | adresse | hours
  grid.innerHTML = '';
  if (brand) grid.appendChild(brand);
  grid.appendChild(adresseCol);
  grid.appendChild(hoursCol);

  // Nav-Reihe wird unter dem Grid eingesetzt als eigener Block
  if (navHtml) {
    const navWrap = document.createElement('div');
    navWrap.className = 'footer-nav-wrap container';
    navWrap.innerHTML = `
      <p class="footer-col-label" style="margin-bottom:14px">Index</p>
      ${navHtml}
    `;
    // Footer-Credit (von injectFooterCredit) bleibt darunter
    footer.querySelector('.container').insertAdjacentElement('afterend', navWrap);
  }

  // Zahlungsarten als kleine Logos (inline-SVG, die CSP lässt keine fremden Bilder zu).
  const payWrap = document.createElement('div');
  payWrap.className = 'footer-pay container';
  payWrap.innerHTML = `
    <p class="footer-col-label">Wir akzeptieren</p>
    <ul class="footer-pay-list">${PAYMENT_BADGES.map(b =>
      `<li class="pay-badge" role="img" aria-label="${b.label}" title="${b.label}">${b.svg}</li>`).join('')}</ul>
  `;
  footer.appendChild(payWrap);

  // Bottom-Strip: Copyright + Inhaber. Vol/No-Theater entfernt.
  const year = new Date().getFullYear();
  const strip = document.createElement('div');
  strip.className = 'footer-bottom-strip container';
  strip.innerHTML = `<span>© ${year} <em>Alstercafé</em> · Croquenoah Cafe</span>`;
  footer.appendChild(strip);
}

function initH2LineReveal() {
  // Alle h2 in section-head, today-feature, landing-visit, etc.
  const heads = document.querySelectorAll(
    '.section-head h2, .landing-visit-inner h2, .menu-broetchen-cta h2, .menu-croque h2, .today-feature-inner h2, .lunch-head h2, .about-aside h2'
  );
  if (!heads.length) return;

  heads.forEach(h2 => {
    if (h2.classList.contains('h2-reveal')) return;
    // Inhalt in Lines aufteilen (durch <br> getrennt)
    const html = h2.innerHTML;
    const lines = html.split(/<br\s*\/?>/i);
    if (lines.length < 2) {
      // Keine <br> — eine einzelne Line erzeugen
      h2.innerHTML = `<span class="h2-line">${html}</span>`;
    } else {
      h2.innerHTML = lines.map(l => `<span class="h2-line">${l}</span>`).join('');
    }
    h2.classList.add('h2-reveal');
  });

  if (!('IntersectionObserver' in window)) {
    heads.forEach(h => h.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 });
  heads.forEach(h => io.observe(h));
}

function initFlourishDividers() {
  const ornaments = document.querySelectorAll('.ornament');
  if (!ornaments.length) return;

  const svgMarkup = `
    <svg class="flourish" viewBox="0 0 280 28" aria-hidden="true">
      <path d="M2 14 C 30 14, 60 20, 90 14 S 140 8, 175 14 S 230 20, 268 14 L 278 14"/>
      <path d="M134 8 C 138 10, 142 10, 146 8 M 138 18 C 140 16, 142 16, 142 16" opacity="0.6"/>
    </svg>
  `;

  ornaments.forEach(orn => {
    if (orn.querySelector('.flourish')) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = svgMarkup.trim();
    const flourish = tmp.firstElementChild;
    orn.insertBefore(flourish, orn.firstChild);
    const glyph = orn.querySelector('.ornament-glyph');
    if (glyph) glyph.style.display = 'none';
  });

  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.flourish').forEach(f => f.classList.add('is-drawn'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-drawn');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.2 });
  document.querySelectorAll('.flourish').forEach(f => io.observe(f));
}

function initChapterMarkReveal() {
  const chapters = document.querySelectorAll('.chapter');
  if (!chapters.length) return;
  if (!('IntersectionObserver' in window)) {
    chapters.forEach(c => c.classList.add('is-mark-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-mark-in');
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -15% 0px', threshold: 0.05 });
  chapters.forEach(c => io.observe(c));
}

function initEmHighlightReveal() {
  const closer = document.querySelector('.chapter-finis');
  if (!closer) return;
  if (!('IntersectionObserver' in window)) {
    closer.classList.add('is-em-drawn');
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-em-drawn');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.2 });
  io.observe(closer);
}

function initHeroCharReveal(reduceMotion) {
  if (reduceMotion) return;
  const h1 = document.querySelector('.hero-cinema-h1');
  if (!h1) return;
  if (h1.classList.contains('is-char-revealed')) return;

  const lines = h1.querySelectorAll('.head-1, .head-2, .head-3');
  lines.forEach(line => {
    // Text-Knoten in WORT-Spans aufteilen (nowrap), darin Char-Spans.
    // Ohne Word-Wrapper konnte die Zeile zwischen zwei beliebigen
    // Buchstaben brechen — "Kommen Sie vorbei" wurde zu "Kommen S\nie vorbei.".
    let charIdx = 0;
    const walk = (node) => {
      if (node.nodeType === 3) {
        const frag = document.createDocumentFragment();
        const parts = node.textContent.split(/(\s+)/);
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
            continue;
          }
          const wordSpan = document.createElement('span');
          wordSpan.className = 'hero-word';
          for (const ch of part) {
            const span = document.createElement('span');
            span.className = 'hero-char';
            span.style.setProperty('--char-i', charIdx);
            span.textContent = ch;
            wordSpan.appendChild(span);
            charIdx++;
          }
          frag.appendChild(wordSpan);
        }
        node.replaceWith(frag);
      } else if (node.nodeType === 1) {
        Array.from(node.childNodes).forEach(walk);
      }
    };
    Array.from(line.childNodes).forEach(walk);
  });
  h1.classList.add('is-char-revealed');
}

function initChapterRail() {
  if (document.body.classList.contains('admin-body')) return;
  if (document.querySelector('.chapter-rail')) return;

  const chapters = Array.from(document.querySelectorAll('[data-chapter]'));
  if (chapters.length < 2) return;

  // Jede Chapter braucht eine ID zum Springen
  chapters.forEach((sec, i) => {
    if (!sec.id) {
      const num = sec.getAttribute('data-chapter') || (i + 1);
      sec.id = `chapter-${String(num).toLowerCase()}`;
    }
  });

  const rail = document.createElement('aside');
  rail.className = 'chapter-rail';
  rail.setAttribute('aria-label', 'Inhalt');
  rail.innerHTML = chapters.map((sec, i) => {
    const num = sec.getAttribute('data-chapter') || String(i + 1);
    const safeId = sec.id.replace(/"/g, '');
    return `<a class="chapter-rail-item" href="#${safeId}" data-target="${safeId}">
      <span class="chapter-rail-label">${num}</span>
      <span class="chapter-rail-mark" aria-hidden="true"></span>
    </a>`;
  }).join('');
  document.body.appendChild(rail);

  // Sichtbar machen, sobald wir aus dem Hero raus sind
  let visible = false;
  const checkVisible = () => {
    const should = window.scrollY > 200;
    if (should !== visible) {
      visible = should;
      rail.classList.toggle('is-visible', visible);
    }
  };
  window.addEventListener('scroll', checkVisible, { passive: true });
  checkVisible();

  // Aktives Kapitel per IntersectionObserver
  const items = Array.from(rail.querySelectorAll('.chapter-rail-item'));
  if ('IntersectionObserver' in window) {
    const map = new Map(chapters.map((sec, i) => [sec, items[i]]));
    let lastActive = null;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const item = map.get(e.target);
        if (!item) return;
        items.forEach(x => x.classList.toggle('is-active', x === item));

        // Pulse beim Aktivwerden
        if (lastActive !== item) {
          item.classList.remove('is-pulse');
          // force reflow, dann wieder rein
          void item.offsetWidth;
          item.classList.add('is-pulse');
          setTimeout(() => item.classList.remove('is-pulse'), 720);
          lastActive = item;
        }

        // Dunkler Hintergrund? Rail invertieren
        const onDark = e.target.classList.contains('chapter-dark') ||
                       e.target.matches('.lunch, .reservation, .today-feature, .landing-visit-dark');
        rail.classList.toggle('is-on-dark', onDark);
      });
    }, { rootMargin: '-30% 0px -50% 0px', threshold: 0 });
    chapters.forEach(sec => io.observe(sec));
  }
}

function injectFooterCredit() {
  const footer = document.querySelector('.site-footer .container');
  if (!footer) return;
  if (footer.querySelector('.footer-credit')) return;

  const credit = document.createElement('p');
  credit.className = 'footer-credit';
  credit.innerHTML = alsterLang() === 'en'
    ? 'A family bakery — <em>in Hohenfelde since 2004.</em>'
    : 'Eine Familien-Backstube — <em>seit 2004 in Hohenfelde.</em>';
  // Nach dem footer-grid einsetzen
  const grid = footer.querySelector('.footer-grid');
  if (grid) {
    grid.insertAdjacentElement('afterend', credit);
  } else {
    footer.appendChild(credit);
  }
}

function injectEditionStripIfMissing() {
  if (document.body.classList.contains('admin-body')) return;
  if (document.querySelector('.edition-strip')) return;

  const strip = document.createElement('aside');
  strip.className = 'edition-strip';
  strip.setAttribute('aria-hidden', 'true');
  const now = new Date();
  const fmt = now.toLocaleDateString(dateLocale(), { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  strip.innerHTML = `
    <div class="container edition-inner">
      <span class="edition-cell edition-date">${fmt}</span>
      <span class="edition-cell edition-place">Ifflandstr. 45 &middot; Hamburg-Hohenfelde</span>
    </div>
  `;

  // Vor der Topbar einsetzen, oder hinter dem Notice-Banner wenn der existiert
  const notice = document.getElementById('notice-banner');
  const topbar = document.querySelector('.topbar');
  if (notice && notice.parentNode) {
    notice.parentNode.insertBefore(strip, notice.nextSibling);
  } else if (topbar && topbar.parentNode) {
    topbar.parentNode.insertBefore(strip, topbar);
  }
}

function initPageTransitions(reduceMotion) {
  if (reduceMotion) return;
  if (!('animate' in HTMLElement.prototype)) return;

  // Fade-In beim Laden
  document.documentElement.animate(
    [
      { opacity: 0.001, transform: 'translateY(6px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ],
    // fill 'backwards' statt 'both': ein dauerhaft gesetztes transform auf <html>
    // macht <html> zum Bezugsrahmen fuer position:fixed — dann oeffnete das
    // mobile Menue weiter unten auf der Seite ausserhalb des Bildschirms.
    { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' }
  );

  // Bewusst KEIN Ausblenden mehr beim Link-Klick: das Abfangen jedes Klicks
  // liess Seiten auf dem Handy haengen, und nach "Zurueck" (Browser-Cache)
  // blieb die Seite unsichtbar. Links oeffnen jetzt ganz normal und sofort.
  // Falls eine Seite doch einmal ausgeblendet aus dem Cache kommt: zuruecksetzen.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    try { document.documentElement.getAnimations().forEach(an => an.cancel()); } catch {}
    document.documentElement.style.opacity = '';
    document.body?.classList.remove('menu-open');
  });
}

function initHeroScrollHint() {
  const hero = document.querySelector('.hero-cinematic');
  if (!hero) return;
  if (document.querySelector('.hero-scroll-hint')) return;

  const hint = document.createElement('div');
  hint.className = 'hero-scroll-hint';
  hint.setAttribute('aria-hidden', 'true');
  hint.innerHTML = `
    <span class="hero-scroll-line"></span>
    <span class="hero-scroll-label">scrollen</span>
  `;
  hero.appendChild(hint);

  // Verschwindet sobald der User gescrollt hat
  let hidden = false;
  const onScroll = () => {
    if (hidden) return;
    if (window.scrollY > 120) {
      hint.classList.add('is-hidden');
      hidden = true;
      window.removeEventListener('scroll', onScroll);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
}

function initCustomCursor(reduceMotion) {
  if (reduceMotion) return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const dot  = document.createElement('div');
  const ring = document.createElement('div');
  dot.className  = 'custom-cursor';
  ring.className = 'custom-cursor-ring';
  dot.setAttribute('aria-hidden', 'true');
  ring.setAttribute('aria-hidden', 'true');
  document.body.appendChild(dot);
  document.body.appendChild(ring);
  document.body.classList.add('has-custom-cursor');

  let dx = 0, dy = 0, rx = 0, ry = 0, tx = 0, ty = 0;
  let raf = 0;

  const tick = () => {
    // Dot folgt schnell
    dx += (tx - dx) * 0.45;
    dy += (ty - dy) * 0.45;
    // Ring folgt traege
    rx += (tx - rx) * 0.18;
    ry += (ty - ry) * 0.18;
    dot.style.transform  = `translate3d(${dx}px, ${dy}px, 0) translate(-50%, -50%)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
    raf = requestAnimationFrame(tick);
  };

  document.addEventListener('mousemove', (e) => {
    tx = e.clientX;
    ty = e.clientY;
    if (!raf) raf = requestAnimationFrame(tick);

    // Dunkler Hintergrund erkennen → invertieren
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const onDark = el?.closest('.chapter-dark, .lunch, .reservation, .today-feature, .landing-visit-dark, .site-footer, .menu-broetchen-cta, .topbar, .order-summary-card, .nav-shop');
    dot.classList.toggle('is-on-dark', !!onDark);
    ring.classList.toggle('is-on-dark', !!onDark);
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    dot.style.opacity = '0';
    ring.style.opacity = '0';
  });
  document.addEventListener('mouseenter', () => {
    dot.style.opacity = '';
    ring.style.opacity = '';
  });

  // Hover-Boost auf interaktiven Elementen
  const onEnter = () => { dot.classList.add('is-hover'); ring.classList.add('is-hover'); };
  const onLeave = () => { dot.classList.remove('is-hover'); ring.classList.remove('is-hover'); };
  const wire = (el) => {
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
  };
  document.querySelectorAll('a, button, .teaser-card, .quote-card, .pullquote-small, label.checkbox, input, select, textarea, [role="button"]').forEach(wire);

  // Falls neue Elemente per JS reingerendert werden — Mutation-Observer
  const mo = new MutationObserver(muts => {
    muts.forEach(m => {
      m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.matches?.('a, button, .teaser-card, .quote-card, .pullquote-small, label.checkbox, input, select, textarea, [role="button"]')) wire(n);
        n.querySelectorAll?.('a, button, .teaser-card, .quote-card, .pullquote-small, label.checkbox, input, select, textarea, [role="button"]').forEach(wire);
      });
    });
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

/* Jahre seit Gründung (2004) automatisch berechnen, damit keine Zahl je
   veraltet. Füllt alle .js-years-Spans und setzt das Ziel des Jahres-
   Zählers ([data-counter-years]) dynamisch. Muss VOR initCounters laufen. */
const FOUNDED_YEAR = 2004;
function initYears() {
  const years = Math.max(1, new Date().getFullYear() - FOUNDED_YEAR);
  document.querySelectorAll('.js-years').forEach(el => { el.textContent = String(years); });
  document.querySelectorAll('.counter[data-counter-years]').forEach(el => {
    el.dataset.counterTo = String(years);
  });
}

/* Counter-Animation: zaehlt hoch, wenn das Element ins Viewport kommt */
function initCounters() {
  const elements = document.querySelectorAll('.counter[data-counter-to]');
  if (!elements.length) return;
  // Ohne IntersectionObserver oder bei reduzierter Bewegung direkt den
  // Zielwert zeigen — nie bei "0" hängenbleiben. Der HTML-Fallback (>22<)
  // deckt zusätzlich Besucher ganz ohne JS ab.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    elements.forEach(el => { el.textContent = el.dataset.counterTo; });
    return;
  }
  // Startwert für die Hochzähl-Animation setzen (Element ist unter dem Fold,
  // die "0" wird erst beim Heranscrollen sichtbar und zählt dann hoch).
  elements.forEach(el => { el.textContent = '0'; });
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const to = parseInt(el.dataset.counterTo, 10) || 0;
      const duration = 1400;
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(to * eased);
        if (t < 1) requestAnimationFrame(step);
        else el.textContent = to;
      };
      requestAnimationFrame(step);
      io.unobserve(el);
    });
  }, { threshold: 0.6 });
  elements.forEach(el => io.observe(el));
}

function loadCurrentWeek(monday) {
  try {
    const raw = localStorage.getItem(STORAGE_LUNCH);
    if (!raw) return null;
    const all = JSON.parse(raw);
    return all[isoDate(monday)] || null;
  } catch { return null; }
}

function renderWeekMeta(monday) {
  const el = document.getElementById('lunch-week');
  if (!el) return;
  const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
  el.textContent = (alsterLang() === 'en' ? 'Week ' : 'KW ') + `${isoWeek(monday)} · ${formatShort(monday)} – ${formatShort(sunday)}`;
}

function renderTodayLunch(weekData, today) {
  const todayBox = document.getElementById('lunch-today');
  const emptyBox = document.getElementById('lunch-empty');
  if (!todayBox || !emptyBox) return;
  const dayIdx = (today.getDay() + 6) % 7;
  const dayKey = DAY_KEYS[dayIdx];
  const dayLabel = dayLabels()[dayIdx];
  const entry = weekData?.days?.[dayKey];

  const nameEl = document.getElementById('today-name');
  if (nameEl) nameEl.textContent = dayLabel;
  const emptyText = document.querySelector('.lunch-empty-text');

  // Wenn die GANZE Woche leer ist: kein Today-Empty-State zeigen,
  // sonst kommt die Info zweimal (heute + Wochenkarte beide leer).
  const days = weekData?.days || {};
  const wholeWeekEmpty = !DAY_KEYS.some(k => dayDishes(days[k]).length || days[k]?.closed);

  if (dayDishes(entry).length) {
    const dishEl = document.getElementById('today-dish');
    const sideEl = document.getElementById('today-side');
    const first = dayDishes(entry)[0];
    if (dishEl) dishEl.textContent = first.dish;
    if (sideEl) {
      sideEl.textContent = first.side || '';
      sideEl.hidden = !first.side;
    }
    renderAltDish(sideEl || dishEl, entry, alsterLang() === 'en', false);
    todayBox.hidden = false;
    emptyBox.hidden = true;
  } else if (entry?.closed) {
    // Explizit als geschlossen markiert — bewusste Pause
    if (emptyText) emptyText.innerHTML = 'Heute servieren wir Frühstück &amp; Backwaren — kein Mittagstisch.';
    todayBox.hidden = true;
    emptyBox.hidden = false;
  } else if (wholeWeekEmpty) {
    // Ganze Woche leer → renderWeekList zeigt schon eine Konsolidierte
    // Karte. Today-Section nicht doppelt zeigen.
    todayBox.hidden = true;
    emptyBox.hidden = true;
  } else {
    // Heute nicht eingetragen, aber die Woche hat anderswo Eintraege —
    // ehrlich kommunizieren statt "kein Mittagstisch" zu behaupten.
    if (emptyText) emptyText.innerHTML = (alsterLang() === 'en')
      ? 'Today’s menu is being updated. <a href="tel:+494022692891">040 – 22 69 28 91</a> — we’ll gladly tell you today’s dish.'
      : 'Die heutige Karte wird gerade aktualisiert. <a href="tel:+494022692891">040 – 22 69 28 91</a> — wir verraten Ihnen das Tagesgericht gern.';
    todayBox.hidden = true;
    emptyBox.hidden = false;
  }
}

function renderWeekList(weekData, monday, today) {
  const list = document.getElementById('lunch-week-list');
  if (!list) return;
  list.innerHTML = '';

  // Wenn die gesamte Woche leer ist: konsolidierte Info statt 7x "folgt in Kürze"
  const days = weekData?.days || {};
  const hasAnyEntry = DAY_KEYS.some(k => dayDishes(days[k]).length || days[k]?.closed);
  if (!hasAnyEntry) {
    list.classList.add('lunch-week-empty');
    const li = document.createElement('li');
    li.className = 'lunch-week-empty-card';
    li.innerHTML = `
      <p class="lunch-week-empty-title">Die Wochenkarte wird gerade aktualisiert.</p>
      <p class="lunch-week-empty-text">Anrufen lohnt sich — wir verraten Ihnen das Tagesgericht gern direkt: <a href="tel:+494022692891">040 – 22 69 28 91</a>.</p>
    `;
    list.appendChild(li);
    return;
  }
  list.classList.remove('lunch-week-empty');

  DAY_KEYS.forEach((key, idx) => {
    const date = new Date(monday); date.setDate(date.getDate() + idx);
    const entry = weekData?.days?.[key];
    const isToday = isSameDay(date, today);
    const li = document.createElement('li');
    li.className = 'lunch-day' + (isToday ? ' is-today' : '');
    const en = alsterLang() === 'en';
    let body;
    if (entry?.closed) {
      body = `<span class="lunch-closed">${en ? 'No lunch today' : 'Kein Mittagstisch'}</span>`;
    } else if (dayDishes(entry).length) {
      body = dayDishes(entry).map(d =>
        `<span class="lunch-day-dish">${escapeHtml(d.dish)}</span>` + (d.side ? `<span class="lunch-day-side">${escapeHtml(d.side)}</span>` : '')
      ).join(orDividerHtml(en, 'lunch-day-or'));
    } else {
      body = `<span class="lunch-pending">${en ? '— coming soon —' : '— folgt in Kürze —'}</span>`;
    }
    li.innerHTML = `
      <div class="lunch-day-head">
        <span class="lunch-day-name">${dayLabels()[idx]}</span>
        <span class="lunch-day-date">${formatDay(date)}</span>
      </div>
      <div class="lunch-day-body">${body}</div>
    `;
    list.appendChild(li);
  });
}

/* Preis-Helfer für den Brötchen-Service.
   parseEuro: "2,50 €" / "2.5" / 2.5 -> 2.5 (Euro, auf Cent gerundet) oder null.
   formatEuro: 2.5 -> "2,50 €". */
function parseEuro(v) {
  if (typeof v === 'number') return isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
  const m = String(v || '').replace(/\s/g, '').replace(',', '.').match(/\d+(\.\d+)?/);
  const n = m ? parseFloat(m[0]) : NaN;
  return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}
function formatEuro(n) {
  return Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

/* Baut eine Brötchen-Sorten-Zeile (für vom Inhaber gepflegte Sorten) */
function buildBroetchenRow(item) {
  const name = escapeHtml(item.name || '');
  const desc = escapeHtml(item.desc || '');
  const veg  = item.veg ? ' <span class="broetchen-badge">vegetarisch</span>' : '';
  const price = parseEuro(item.price);
  return `
    <li class="broetchen-row" data-name="${escapeAttr(item.name || '')}"${price ? ` data-price="${price}"` : ''}>
      <div class="broetchen-info">
        <span class="broetchen-name">${name}${veg}</span>
        ${desc ? `<span class="broetchen-desc">${desc}</span>` : ''}
        ${price ? `<span class="broetchen-price">${formatEuro(price)}</span>` : ''}
      </div>
      <div class="qty-stepper">
        <button type="button" class="qty-btn" data-step="-1" aria-label="${alsterLang() === 'en' ? 'Fewer' : 'Weniger'} ${name}">−</button>
        <span class="qty-value" aria-live="polite">0</span>
        <button type="button" class="qty-btn" data-step="1" aria-label="${alsterLang() === 'en' ? 'More' : 'Mehr'} ${name}">+</button>
      </div>
    </li>`;
}

/* ---------- Bestellformular: belegte Brötchen ---------- */
function initOrderForm() {
  const form = document.getElementById('order-form');
  if (!form) return;
  // Keine Mindestmenge mehr (Wunsch des Inhabers): ab einem Brötchen bestellbar.
  const MIN_ORDER = 1;
  // Gleiches Formular für Brötchen-Service und Berliner-Vorbestellung
  const isBerliner = form.dataset.kind === 'berliner';
  const itemsKey = isBerliner ? 'berliner-items' : 'broetchen-items';
  const unitWord = (n, en) => isBerliner
    ? (en ? (n === 1 ? 'doughnut' : 'doughnuts') : 'Berliner')
    : (en ? (n === 1 ? 'filled roll' : 'filled rolls') : (n === 1 ? 'belegtes Brötchen' : 'belegte Brötchen'));

  const sortListEl = document.getElementById('broetchen-list');
  const countEl = document.getElementById('order-count');
  const listEl = document.getElementById('order-summary-list');
  const minNote = document.getElementById('order-min-note');
  const submitBtn = document.getElementById('order-submit');
  const status = document.getElementById('order-status');

  // Abholdatum: frühestens heute wählbar, Vorschlag = morgen (Vorlauf für Bulk)
  const dateInput = form.querySelector('input[name="Datum"]');
  const setDefaultDate = () => {
    if (!dateInput) return;
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    keepDateMinFresh(dateInput);
    dateInput.value = isoDate(tomorrow);
  };
  setDefaultDate();

  // Zeilen immer frisch abfragen (die Sorten-Liste kann neu aufgebaut werden,
  // wenn der Inhaber die Sorten ändert) — so bleibt getItems korrekt.
  const getRows = () => Array.from(document.querySelectorAll('.broetchen-row'));

  // Der Preis wird mit der Bestellung gespeichert (Stand zum Bestellzeitpunkt),
  // damit spätere Preisänderungen alte Bestellungen nicht verändern.
  const getItems = () => getRows()
    .map(row => {
      const it = {
        name: row.dataset.name || '',
        qty: parseInt(row.querySelector('.qty-value')?.textContent, 10) || 0
      };
      const price = parseEuro(row.dataset.price);
      if (price) it.price = price;
      if (isBerliner) it.kind = 'berliner';
      return it;
    })
    .filter(it => it.qty > 0);

  const render = () => {
    const items = getItems();
    const total = items.reduce((s, it) => s + it.qty, 0);
    if (countEl) countEl.textContent = String(total);
    if (listEl) {
      const priced = items.filter(it => it.price);
      const sum = priced.reduce((s, it) => s + Math.round(it.price * 100) * it.qty, 0) / 100;
      const sumLabel = alsterLang() === 'en' ? 'Total' : 'Summe';
      const sumNote = priced.length < items.length
        ? `<small class="order-summary-sum-note">${alsterLang() === 'en' ? 'excl. items without price' : 'ohne Sorten ohne Preis'}</small>`
        : '';
      listEl.innerHTML = items.length
        ? items.map(it => `<li><span>${escapeHtml(it.name)}</span><span class="order-summary-amount"><span class="order-summary-qty">${it.qty}×</span>${it.price ? `<span class="order-summary-price">${formatEuro(it.price * it.qty)}</span>` : ''}</span></li>`).join('')
          + (priced.length ? `<li class="order-summary-total"><span>${sumLabel}${sumNote}</span><span class="order-summary-price">${formatEuro(sum)}</span></li>` : '')
        : '<li class="order-summary-empty">Noch nichts ausgewählt.</li>';
    }
    const ok = total >= MIN_ORDER;
    if (minNote) {
      minNote.textContent = total === 0
        ? (alsterLang() === 'en'
            ? (isBerliner ? 'Choose your doughnuts above.' : 'Choose your rolls above.')
            : (isBerliner ? 'Wählen Sie oben Ihre Berliner aus.' : 'Wählen Sie oben Ihre Brötchen aus.'))
        : '';
      minNote.hidden = total > 0;
      minNote.classList.remove('is-met', 'is-below');
    }
    if (submitBtn) submitBtn.disabled = !ok;
  };

  // Mengen-Stepper per Event-Delegation auf der Liste — überlebt ein
  // Neu-Aufbauen der Sorten-Liste ohne doppelte Handler.
  if (sortListEl) {
    sortListEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.qty-btn');
      if (!btn || !sortListEl.contains(btn)) return;
      const row = btn.closest('.broetchen-row');
      const valueEl = row?.querySelector('.qty-value');
      if (!valueEl) return;
      const step = parseInt(btn.dataset.step, 10) || 0;
      const next = Math.max(0, Math.min(200, (parseInt(valueEl.textContent, 10) || 0) + step));
      valueEl.textContent = String(next);
      row.classList.toggle('is-active', next > 0);
      // Nach einer erfolgreichen Bestellung den Erfolgs-Zustand zuruecksetzen
      submitBtn?.classList.remove('is-success');
      render();
    });
  }

  // Sorten-Liste aus den (ggf. vom Inhaber gepflegten) Daten aufbauen.
  // Erneut aufrufbar: nach der Backend-Hydration und bei Live-Änderungen,
  // damit neue Besucher sofort die aktuellen Sorten sehen.
  const applySorts = () => {
    let items = null;
    try { items = window.alsterDb?.get(itemsKey); } catch {}
    if (isBerliner && (!Array.isArray(items) || !items.length)) items = DEFAULT_BERLINER;
    if (sortListEl && Array.isArray(items)) {
      const valid = items.filter(it => it && typeof it.name === 'string' && it.name.trim());
      if (valid.length) {
        const html = valid.map(buildBroetchenRow).join('');
        if (sortListEl.dataset.sortsHtml !== html) {
          // Bereits gewählte Mengen beim Neuaufbau erhalten (z. B. wenn die Daten
          // vom Server erst nach dem ersten Antippen eintreffen).
          const keep = {};
          getRows().forEach(row => {
            const q = parseInt(row.querySelector('.qty-value')?.textContent, 10) || 0;
            if (q > 0) keep[row.dataset.name] = q;
          });
          sortListEl.innerHTML = html;
          sortListEl.dataset.sortsHtml = html;
          getRows().forEach(row => {
            const q = keep[row.dataset.name];
            if (!q) return;
            const v = row.querySelector('.qty-value');
            if (v) v.textContent = String(q);
            row.classList.add('is-active');
          });
        }
      }
    }
    render();
  };
  refreshOrderSorts = applySorts;
  applySorts();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    // Sofort gegen Doppel-Submit sperren — vor jeder weiteren Logik,
    // sonst koennte ein Doppel-Tap zwei Bestellungen anlegen.
    if (submitBtn?.disabled) return;
    if (submitBtn) submitBtn.disabled = true;
    const items = getItems();
    const total = items.reduce((s, it) => s + it.qty, 0);
    const en = alsterLang() === 'en';
    if (isBerliner && !berlinerState().visible) {
      setFormStatus(status, en ? 'Pre-orders are currently closed.' : 'Die Berliner-Vorbestellung ist gerade nicht geöffnet.', 'error');
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    if (total < MIN_ORDER) {
      setFormStatus(status, isBerliner
        ? (en ? 'Please select at least one doughnut.' : 'Bitte wählen Sie mindestens einen Berliner.')
        : (en ? 'Please select at least one roll.' : 'Bitte wählen Sie mindestens ein Brötchen.'), 'error');
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    if (!form.checkValidity()) {
      setFormStatus(status, invalidFieldMessage(form, en), 'error');
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    if (isBerliner) {
      const { st } = berlinerState();
      const d = form.querySelector('input[name="Datum"]')?.value || '';
      if ((st.pickupFrom && d < st.pickupFrom) || (st.pickupTo && d > st.pickupTo)) {
        const a = formatDateLong(st.pickupFrom || st.pickupTo, en), b = formatDateLong(st.pickupTo || st.pickupFrom, en);
        const range = a === b ? a : `${a} – ${b}`;
        setFormStatus(status, en ? `Pick-up is possible on ${range}.` : `Abholung ist möglich: ${range}.`, 'error');
        if (submitBtn) submitBtn.disabled = false;
        return;
      }
    }
    const slotErr = slotProblem(form.querySelector('input[name="Datum"]')?.value, form.querySelector('input[name="Uhrzeit"]')?.value, en);
    if (slotErr) {
      setFormStatus(status, slotErr, 'error');
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    const data = new FormData(form);
    const entry = {
      name:       (data.get('Name')     || '').toString().trim(),
      phone:      (data.get('Telefon')  || '').toString().trim(),
      email:      (data.get('E-Mail')   || '').toString().trim(),
      pickupDate: (data.get('Datum')    || '').toString().trim(),
      pickupTime: (data.get('Uhrzeit')  || '').toString().trim(),
      notes:      (data.get('Nachricht')|| '').toString().trim(),
      items,
      status: 'new'
    };

    if (submitBtn) submitBtn.classList.add('is-loading');
    setFormStatus(status, en ? 'Sending order …' : 'Bestellung wird gesendet …');

    let saved = false;
    try { saved = !!(await window.alsterDb?.addOrder(entry)); }
    catch (err) { console.warn('Bestellung speichern fehlgeschlagen', err); }

    if (submitBtn) submitBtn.classList.remove('is-loading');
    if (saved) {
      if (submitBtn) submitBtn.classList.add('is-success');
      setFormStatus(status, en ? `Thank you! Your order of ${total} ${unitWord(total, true)} has reached us. We will confirm by phone or email.` : `Vielen Dank! Ihre Bestellung über ${total} ${unitWord(total, false)} ist bei uns eingegangen. Wir bestätigen telefonisch oder per E-Mail.`, 'ok');
      try { form.reset(); } catch {}
      getRows().forEach(row => { const v = row.querySelector('.qty-value'); if (v) v.textContent = '0'; row.classList.remove('is-active'); });
      setDefaultDate();
      if (isBerliner) initBerlinerPage();
      render();
    } else {
      // Fallback: Mail-Programm
      const lines = items.map(it => `${it.qty}× ${it.name}${it.price ? ` (${formatEuro(it.price * it.qty)})` : ''}`).join('\n');
      const subject = `${isBerliner ? 'Berliner-Vorbestellung' : 'Brötchen-Bestellung'} (${total} Stück) – ${entry.name}`;
      const body = encodeURIComponent(
        `Bestellung:\n${lines}\n\nGesamt: ${total} ${isBerliner ? 'Berliner' : 'Brötchen'}\n` +
        `Abholung: ${entry.pickupDate} um ${entry.pickupTime}\n` +
        `Name: ${entry.name}\nTelefon: ${entry.phone}\nE-Mail: ${entry.email}\n\n` +
        `Wünsche:\n${entry.notes || '–'}`
      );
      window.location.href = `mailto:info@alstercafe.de?subject=${encodeURIComponent(subject)}&body=${body}`;
      setFormStatus(status, en ? 'Please send the email that just opened — we will confirm as soon as possible.' : 'Bitte senden Sie die geöffnete E-Mail ab — wir bestätigen schnellstmöglich.', 'ok');
      render(); // Button-Status wiederherstellen, falls kein Mail-Programm vorhanden
    }
  });
}

/* ---------- Reservierungs-Formular ---------- */
/* Prüft Datum + Uhrzeit gegen Öffnungszeiten, Schließtage und "jetzt".
   Liefert eine verständliche Fehlermeldung (DE/EN) oder null, wenn alles passt. */
function slotProblem(dateStr, timeStr, en) {
  const dm = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = String(timeStr || '').match(/^(\d{1,2}):(\d{2})/);
  if (!dm || !tm) return null; // Pflichtfeld-Prüfung übernimmt der Browser
  const d = new Date(+dm[1], +dm[2] - 1, +dm[3]);
  const minutes = parseInt(tm[1], 10) * 60 + parseInt(tm[2], 10);
  const now = new Date();
  const dateLabel = d.toLocaleDateString(en ? 'en-GB' : 'de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  if (isoLocal(d) < isoLocal(now) || (isoLocal(d) === isoLocal(now) && minutes <= now.getHours() * 60 + now.getMinutes())) {
    return en ? 'This time is already in the past. Please choose a later time.'
              : 'Diese Uhrzeit liegt schon in der Vergangenheit. Bitte wählen Sie eine spätere Zeit.';
  }
  const hol = holidayOn(d);
  if (hol) {
    const why = hol.label ? ` (${hol.label})` : '';
    return en ? `We are closed on ${dateLabel}${why}. Please choose another day.`
              : `Am ${dateLabel} haben wir geschlossen${why}. Bitte wählen Sie einen anderen Tag.`;
  }
  const day = openingFor(d);
  if (!day) {
    return en ? `We are closed on ${dateLabel}. Please choose another day.`
              : `Am ${dateLabel} haben wir geschlossen. Bitte wählen Sie einen anderen Tag.`;
  }
  if (minutes < day.openMin || minutes >= day.closeMin) {
    const range = `${formatMin(day.openMin)} – ${formatMin(day.closeMin)}`;
    return en ? `On ${dateLabel} we are open ${range}. Please choose a time within our opening hours.`
              : `Am ${dateLabel} haben wir von ${formatMin(day.openMin)} bis ${formatMin(day.closeMin)} Uhr geöffnet. Bitte wählen Sie eine Uhrzeit in diesem Zeitraum.`;
  }
  return null;
}
// Hält "frühestens heute" aktuell (Seite kann über Mitternacht offen sein).
function keepDateMinFresh(input) {
  if (!input) return;
  const refresh = () => { input.min = isoDate(new Date()); };
  refresh();
  input.addEventListener('focus', refresh);
}

function initReservationForm() {
  const form = document.getElementById('reservation-form');
  if (!form) return;
  const status = form.querySelector('.form-status');
  const dateInput = form.querySelector('input[name="Datum"]');
  if (dateInput) {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    keepDateMinFresh(dateInput);
    if (!dateInput.value) dateInput.value = isoDate(tomorrow);
  }
  const submitBtn = form.querySelector('.form-submit');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    // Sofort gegen Doppel-Submit sperren — vor jeder weiteren Logik,
    // sonst koennte ein Doppel-Tap zwei Reservierungen anlegen.
    if (submitBtn?.disabled) return;
    if (submitBtn) submitBtn.disabled = true;
    const en = alsterLang() === 'en';
    if (!form.checkValidity()) {
      setFormStatus(status, invalidFieldMessage(form, en), 'error');
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    const slotErr = slotProblem(form.querySelector('input[name="Datum"]')?.value, form.querySelector('input[name="Uhrzeit"]')?.value, en);
    if (slotErr) {
      setFormStatus(status, slotErr, 'error');
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    const data = new FormData(form);
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      receivedAt: new Date().toISOString(),
      name:    (data.get('Name')     || '').toString().trim(),
      phone:   (data.get('Telefon')  || '').toString().trim(),
      email:   (data.get('E-Mail')   || '').toString().trim(),
      date:    (data.get('Datum')    || '').toString().trim(),
      time:    (data.get('Uhrzeit')  || '').toString().trim(),
      persons: (data.get('Personen') || '').toString().trim(),
      message: (data.get('Nachricht')|| '').toString().trim(),
      status:  'new'
    };

    if (submitBtn) submitBtn.classList.add('is-loading');
    setFormStatus(status, en ? 'Sending request …' : 'Anfrage wird gesendet …');

    let saved = false;
    try {
      saved = !!(await window.alsterDb?.addReservation(entry));
    } catch (err) { console.warn('Reservierung speichern fehlgeschlagen', err); }

    if (submitBtn) {
      submitBtn.classList.remove('is-loading');
      submitBtn.disabled = false;
    }
    if (saved) {
      if (submitBtn) submitBtn.classList.add('is-success');
      setFormStatus(status, en ? 'Thank you! Your request has reached us. We will get back to you by phone or email.' : 'Vielen Dank! Ihre Anfrage ist bei uns eingegangen. Wir melden uns telefonisch oder per E-Mail.', 'ok');
      try { form.reset(); } catch {}
    } else {
      // Fallback: Mail-Programm oeffnen
      const subject = `Reservierungsanfrage – ${entry.name}`;
      const body = encodeURIComponent([
        `Name: ${entry.name}`,
        `Telefon: ${entry.phone}`,
        `E-Mail: ${entry.email}`,
        `Datum: ${entry.date}`,
        `Uhrzeit: ${entry.time}`,
        `Personen: ${entry.persons}`,
        '', 'Nachricht:', entry.message || '–'
      ].join('\n'));
      window.location.href = `mailto:info@alstercafe.de?subject=${encodeURIComponent(subject)}&body=${body}`;
      setFormStatus(status, en ? 'Please send the email that just opened — we will confirm as soon as possible.' : 'Bitte senden Sie die geöffnete E-Mail ab — wir bestätigen schnellstmöglich.', 'ok');
    }
  });
}

function setFormStatus(el, msg, kind = '') {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('ok', 'error');
  if (kind) el.classList.add(kind);
}

/* Benennt das erste ungültige Pflichtfeld, springt hin und liefert eine
   klare, sprachbewusste Meldung. Von beiden Formularen genutzt. Am Handy
   wichtig, weil iOS-Safari oft keine native Hinweisblase zeigt. */
function invalidFieldMessage(form, en) {
  // Nur echte Formularfelder — NICHT <form>/<fieldset>, die :invalid ebenfalls
  // matchen können (sonst landet man beim Fieldset statt beim leeren Feld).
  const bad = form.querySelector('input:invalid, select:invalid, textarea:invalid');
  if (!bad) return en ? 'Please check your entries.' : 'Bitte prüfen Sie Ihre Eingaben.';
  const lbl = (bad.closest('label')?.querySelector('span')?.textContent) || '';
  const feld = lbl.replace(/\*/g, '').trim() || bad.name || (en ? 'field' : 'Feld');
  try { bad.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
  try { bad.focus({ preventScroll: true }); } catch (e) {}
  if (bad.type === 'checkbox') return en ? 'Please tick the consent box below.' : 'Bitte unten das Häkchen zur Einverständnis setzen.';
  if (bad.validity && bad.validity.valueMissing) return en ? `Please fill in “${feld}”.` : `Bitte „${feld}" ausfüllen.`;
  if (bad.type === 'email') return en ? 'Please enter a valid email address (e.g. name@mail.com).' : 'Bitte eine gültige E-Mail-Adresse eingeben (z. B. name@mail.de).';
  return en ? `Please check “${feld}”.` : `Bitte „${feld}" prüfen.`;
}

/* ---------- Helpers ---------- */
function mondayOf(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() - day);
  return d;
}
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function isSameDay(a, b) { return isoDate(a) === isoDate(b); }
function formatShort(d) { return d.toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit' }); }
function formatDay(d)   { return d.toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit' }); }
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const diff = (d - firstThursday) / 86400000;
  return 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
