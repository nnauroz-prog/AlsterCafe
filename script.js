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
/* Sprache: zuerst der Link-Parameter ?lang=en|de (teilbare englische Seite),
   sonst localStorage (von i18n.js gesetzt). Bestimmt, in welcher Sprache die
   dynamisch erzeugten Datums-/Status-Texte gerendert werden. */
function alsterLang() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'en' || q === 'de') return q;
  } catch (e) {}
  try { return localStorage.getItem('alstercafe.lang') === 'en' ? 'en' : 'de'; } catch (e) { return 'de'; }
}
/* Bekannte Schließtag-Namen (Vorschläge aus dem Mitgliederbereich) auf der
   englischen Seite übersetzen. Frei eingegebene Gründe bleiben wie getippt. */
const HOLIDAY_EN = {
  'Neujahr': 'New Year’s Day', 'Karfreitag': 'Good Friday', 'Ostermontag': 'Easter Monday',
  'Tag der Arbeit': 'Labour Day', 'Christi Himmelfahrt': 'Ascension Day', 'Pfingstmontag': 'Whit Monday',
  'Tag der Deutschen Einheit': 'German Unity Day', 'Reformationstag': 'Reformation Day',
  '1. Weihnachtstag': 'Christmas Day', '2. Weihnachtstag': 'Boxing Day',
  'Betriebsurlaub': 'Annual holiday', 'Urlaub': 'Holiday', 'Feiertag': 'Public holiday'
};
function holidayLabel(label) {
  const l = String(label || '').trim();
  return alsterLang() === 'en' ? (HOLIDAY_EN[l] || l) : l;
}
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
  if (st.orderFrom && today < st.orderFrom) {
    // Vorankündigung: ab N Tagen vor Bestellbeginn erscheint der Hinweis ohne Bestellknopf
    const n = berlinerAnnounceDays(st);
    const announce = n > 0 && addDaysIso(today, n) >= st.orderFrom;
    return { visible: false, reason: 'soon', announce, st };
  }
  if (st.orderTo && today > st.orderTo) return { visible: false, reason: 'over', st };
  // Abholzeitraum vorbei → Aktion ist beendet, auch wenn „Bestellbar bis“ leer ist
  if (st.pickupTo && today > st.pickupTo) return { visible: false, reason: 'over', st };
  // Mit Vorlauf (z. B. 1 Tag vorher) ist nach dem letzten erreichbaren Abholtag Schluss
  if (st.pickupTo && berlinerLead(st) > 0 && addDaysIso(today, berlinerLead(st)) > st.pickupTo) return { visible: false, reason: 'over', st };
  return { visible: true, st };
}
// Vorankündigung in Tagen vor Bestellbeginn (0 = keine, sonst 7 oder 14)
function berlinerAnnounceDays(st) {
  const n = parseInt(st && st.announceDays, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 30) : 0;
}
// Bestellvorlauf in Tagen (0 = am selben Tag möglich, Standard 1)
function berlinerLead(st) {
  const n = parseInt(st && st.leadDays, 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 7) : 1;
}
function addDaysIso(iso, n) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(+m[1], +m[2] - 1, +m[3]); d.setDate(d.getDate() + n);
  return isoLocal(d);
}
// Frühester erlaubter Abholtag: heute + Vorlauf, nicht vor „Abholung von“, kein Schließtag
function berlinerFirstPickup(st) {
  let d = addDaysIso(isoLocal(new Date()), berlinerLead(st));
  if (st.pickupFrom && d < st.pickupFrom) d = st.pickupFrom;
  for (let i = 0; i < 31; i++) {
    if (st.pickupTo && d > st.pickupTo) return null;
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const date = new Date(+m[1], +m[2] - 1, +m[3]);
    if (openingFor(date)) return d;
    d = addDaysIso(d, 1);
  }
  return null;
}
// Kurzzeile mit den Regeln der Aktion (Abholung, Bestellschluss, Zeiten, Mindestmenge)
function berlinerRulesText(st, en) {
  const parts = [];
  if (st.pickupFrom || st.pickupTo) {
    const a = formatDateLong(st.pickupFrom || st.pickupTo, en), b = formatDateLong(st.pickupTo || st.pickupFrom, en);
    parts.push(a === b ? (en ? `Pick-up on ${a}` : `Abholung am ${a}`) : (en ? `Pick-up ${a} – ${b}` : `Abholung ${a} bis ${b}`));
  }
  if (st.pickupTimeFrom || st.pickupTimeTo) {
    parts.push(en ? `between ${st.pickupTimeFrom || ''}${st.pickupTimeFrom && st.pickupTimeTo ? ' and ' : ''}${st.pickupTimeTo || ''}` : `zwischen ${st.pickupTimeFrom || ''}${st.pickupTimeFrom && st.pickupTimeTo ? ' und ' : ''}${st.pickupTimeTo || ''} Uhr`);
  }
  const lead = berlinerLead(st);
  if (lead > 0) parts.push(en ? `order at least ${lead} day${lead > 1 ? 's' : ''} ahead` : `bitte ${lead === 1 ? 'einen Tag' : lead + ' Tage'} vorher bestellen`);
  const min = parseInt(st.minQty, 10);
  if (min > 1) parts.push(en ? `minimum ${min} pieces` : `mindestens ${min} Stück`);
  return parts.join(' · ');
}
function formatDateLong(iso, en) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(en ? 'en-GB' : 'de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

/* Menüpunkt + Ankündigung auf der Startseite — nur solange die Aktion läuft. */
function initBerlinerPromo() {
  const { visible, announce, st } = berlinerState();
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

  // Ankündigung auf der Startseite (unter dem Hero) – während der Aktion mit Bestellknopf,
  // in der Vorankündigung (announce) nur als Hinweis „Vorbestellbar ab …“
  const hero = document.querySelector('.hero-landing');
  let promo = document.getElementById('berliner-promo');
  if ((!visible && !announce) || !hero) { promo?.remove(); syncFooterExtras(); return; }
  const title = (st.title || '').trim() || 'Berliner für Silvester vorbestellen';
  const text = (st.text || '').trim() || 'Frisch aus unserer Backstube — jetzt vorbestellen und zur Abholung bereitlegen lassen.';
  const rules = berlinerRulesText(st, en);
  const soon = !visible && announce;
  const from = soon ? (en ? `Pre-orders open on ${formatDateLong(st.orderFrom, true)}` : `Vorbestellbar ab ${formatDateLong(st.orderFrom)}`) : '';
  const until = [st.orderTo ? (en ? `Orders until ${formatDateLong(st.orderTo, true)}` : `Bestellbar bis ${formatDateLong(st.orderTo)}`) : '', rules].filter(Boolean).join(' · ');
  const html = `
    <div class="container berliner-promo-inner">
      <div>
        <p class="berliner-promo-kicker">${soon ? (en ? 'Coming up' : 'Bald') : (en ? 'Pre-order now' : 'Jetzt vorbestellen')}</p>
        <h2 class="berliner-promo-title">${escapeHtml(title)}</h2>
        <p class="berliner-promo-text">${escapeHtml(text)}</p>
        ${soon ? `<p class="berliner-promo-until">${escapeHtml([from, rules].filter(Boolean).join(' · '))}</p>` : (until ? `<p class="berliner-promo-until">${escapeHtml(until)}</p>` : '')}
      </div>
      ${soon ? '' : `<a class="btn btn-gold" href="berliner.html">${en ? 'Pre-order doughnuts' : 'Berliner vorbestellen'} <svg class="ico ico-sm"><use href="#i-arrow"/></svg></a>`}
    </div>`;
  if (!promo) {
    promo = document.createElement('section');
    promo.id = 'berliner-promo';
    promo.className = 'berliner-promo';
    promo.setAttribute('data-no-i18n', '');
    hero.after(promo);
  }
  promo.classList.toggle('is-soon', soon);
  if (promo.dataset.html !== html) { promo.innerHTML = html; promo.dataset.html = html; }
  syncFooterExtras();
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
    const rules = berlinerRulesText(st, en);
    if (rules) parts.push(rules);
    win.textContent = parts.join(' · ');
    win.hidden = !parts.length;
  }
  const date = form.querySelector('input[name="Datum"]');
  if (date) {
    const first = berlinerFirstPickup(st);
    const min = first || addDaysIso(isoLocal(new Date()), berlinerLead(st));
    date.min = min;
    if (st.pickupTo) date.max = st.pickupTo; else date.removeAttribute('max');
    if (!date.value || date.value < min || (st.pickupTo && date.value > st.pickupTo)) date.value = min;
    date.dataset.berlinerMin = min;
  }
  const time = form.querySelector('input[name="Uhrzeit"]');
  if (time) {
    if (st.pickupTimeFrom) time.min = st.pickupTimeFrom; else time.removeAttribute('min');
    if (st.pickupTimeTo) time.max = st.pickupTimeTo; else time.removeAttribute('max');
    if (st.pickupTimeFrom && time.value && time.value < st.pickupTimeFrom) time.value = st.pickupTimeFrom;
    if (st.pickupTimeTo && time.value && time.value > st.pickupTimeTo) time.value = st.pickupTimeTo;
  }
}

// Lange Rechtstexte: aufklappbares Inhaltsverzeichnis mit Sprungmarken
function initLegalToc() {
  const art = document.querySelector('.legal-article');
  if (!art || art.querySelector('.legal-toc')) return;
  const heads = Array.from(art.querySelectorAll('section > h2'));
  if (heads.length < 6) return;
  const en = alsterLang() === 'en';
  const items = heads.map((h, i) => {
    const sec = h.closest('section');
    if (!sec.id) sec.id = 'abschnitt-' + (i + 1);
    return `<li><a href="#${sec.id}">${escapeHtml(h.textContent.trim())}</a></li>`;
  }).join('');
  const toc = document.createElement('details');
  toc.className = 'legal-toc';
  toc.setAttribute('data-no-i18n', '');
  // Am Computer offen, am Handy zugeklappt (sonst eine lange Liste vor dem Text)
  if (window.matchMedia('(min-width: 981px)').matches) toc.open = true;
  toc.innerHTML = `<summary>${en ? 'Contents' : 'Inhalt'} <span class="legal-toc-count">${heads.length} ${en ? 'sections' : 'Abschnitte'}</span></summary><ol>${items}</ol>`;
  const first = art.querySelector('section');
  first ? art.insertBefore(toc, first) : art.appendChild(toc);
}

// Deko-Schriftzüge (riesige, fast durchsichtige Wörter) sind reine Gestaltung:
// Text in data-text verschieben und per CSS anzeigen — so zählen sie nicht als
// lesbarer Text mit zu schwachem Kontrast.
function decorativeShouts() {
  document.querySelectorAll('.section-shout, .page-hero-watermark').forEach(el => {
    if (el.dataset.text || !el.textContent.trim()) return;
    el.dataset.text = el.textContent.trim();
    el.textContent = '';
    el.setAttribute('aria-hidden', 'true');
  });
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

/* Späte Backend-Daten (Antwort kam erst nach dem 2,5-s-Limit): nur die
   idempotenten Render-Funktionen erneut aufrufen — dieselben wie im
   subscribe-Switch unten. Bewusst NICHT erneut: initLiveStatus (Minuten-Timer),
   attachDateHints (Listener), setInterval und subscribe — die liefen bereits.
   Mengen und Eingaben in den Bestellformularen bleiben erhalten
   (refreshOrderSorts übernimmt gewählte Mengen, Datumsfelder bleiben gesetzt). */
function rerenderData() {
  const run = (fn) => { try { fn(); } catch (e) { console.warn('rerender err:', e); } };
  run(initDesign);
  // Texte nicht überschreiben, während der Inhaber gerade ein Feld bearbeitet
  run(() => { if (!document.activeElement?.closest?.('[data-editable]')) initContent(); });
  run(initNotice);
  run(initHolidays);
  run(initMenu);
  run(initSpecialsTeaser);
  run(initHours);
  run(updateLiveStatus);
  run(initNavExtra);
  run(initJobs);
  run(initLunchWeek);
  run(initLandingTeaser);
  run(() => { if (refreshOrderSorts) refreshOrderSorts(); });
  run(initBerlinerPromo);
  run(initBerlinerPage);
  run(syncBusinessSchema);
  // Datumshinweise nur aktualisieren (Öffnungszeiten/Schließtage können neu sein)
  run(() => document.querySelectorAll('input[name="Datum"]').forEach(i => { i.__dateHintUpdate?.(); i.__slotsUpdate?.(); }));
  run(() => document.getElementById('order-form')?.__updateEarliest?.());
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
  safeRun(initNavExtra);
  safeRun(initKarteJump);
  safeRun(initToTop);
  safeRun(initRouteLinks);
  safeRun(noteGermanOnlyLegal);
  safeRun(initLegalToc);
  safeRun(decorativeShouts);
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
  //    Höchstens 2,5 s warten: Hängt das Backend, zeigt die Seite den Stand aus
  //    dem Browser-Cache bzw. die Standardwerte. Kommen die Daten später doch an,
  //    baut rerenderData() die datenabhängigen Bereiche still neu auf.
  let hydrated = false;
  const readyP = (window.alsterDb
    ? Promise.resolve().then(() => window.alsterDb.ready())
    : Promise.resolve()
  ).catch(e => { console.warn('db ready err:', e); }).then(() => { hydrated = true; });
  await Promise.race([readyP, new Promise(r => setTimeout(r, 2500))]);
  if (!hydrated) readyP.then(() => safeRun(rerenderData));

  safeRun(initDesign);
  safeRun(initContent);
  safeRun(initNotice);
  safeRun(initHolidays);
  safeRun(initMenu);
  safeRun(initSpecialsTeaser);
  safeRun(initHours);
  safeRun(initLunchWeek);
  safeRun(initLandingTeaser);
  safeRun(initLiveStatus);
  // Brötchen-Sorten jetzt mit dem hydratisierten Stand neu aufbauen (die erste
  // Darstellung lief vor dem Backend und zeigte ggf. noch die Standard-Liste).
  safeRun(() => { if (refreshOrderSorts) refreshOrderSorts(); });
  safeRun(initBerlinerPromo);
  safeRun(initBerlinerPage);
  safeRun(initNavExtra);
  safeRun(syncBusinessSchema);
  safeRun(attachDateHints);
  safeRun(() => document.querySelectorAll('input[name="Datum"]').forEach(i => { i.__dateHintUpdate?.(); i.__slotsUpdate?.(); }));
  safeRun(() => document.getElementById('order-form')?.__updateEarliest?.());
  // Bestellzeitraum kann um Mitternacht beginnen/enden
  setInterval(() => { safeRun(initBerlinerPromo); safeRun(initBerlinerPage); }, 5 * 60 * 1000);
  // Nach Ladenschluss von „Heute“ auf „Morgen“ wechseln (Startseite + Mittagstisch-Seite) und
  // Schließtage-Hinweise nach Mitternacht nachziehen, auch wenn die Seite offen bleibt
  setInterval(() => {
    if (document.hidden) return;
    safeRun(initLandingTeaser); safeRun(initLunchWeek); safeRun(initHolidays);
  }, 5 * 60 * 1000);

  // Live-Sync: jede Aenderung im Backend (auch von einem anderen Geraet
  // des Inhabers) erscheint sofort auf dieser Seite
  // Nur die content-Tabelle beobachten — Reservierungen/Bestellungen sind
  // nur fuer den Inhaber-Bereich relevant (spart unnoetige Realtime-Events).
  window.alsterDb?.subscribe((key) => {
    switch (key) {
      case 'design':      initDesign(); break;
      case 'content':     initContent(); break;
      case 'notice':
      case 'notice-until': initNotice(); initHolidays(); break; // Vorab-Hinweis weicht dem Hinweis-Banner
      case 'holidays':    initHolidays(); updateLiveStatus(); initLunchWeek(); initLandingTeaser(); syncBusinessSchema(); break;
      case 'menu':        initMenu(); break;
      case 'specials':    initMenu(); initSpecialsTeaser(); break;
      case 'hours':       initHours(); updateLiveStatus(); initNavExtra(); syncBusinessSchema(); initLandingTeaser(); break;
      case 'weekly-menu': initLunchWeek(); initLandingTeaser(); break;
      case 'broetchen-items':
      case 'berliner-items': if (refreshOrderSorts) refreshOrderSorts(); break;
      case 'berliner-settings': initBerlinerPromo(); initBerlinerPage(); break;
      case 'jobs':        initJobs(); break;
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
  // Hero-Eyebrow: Trenner „·“ hängen per geschütztem Leerzeichen am Wort davor,
  // damit am Handy keine Zeile mit „·“ beginnt. Steht hier, weil hero.eyebrow
  // editierbar ist und oben per innerHTML ersetzt wird (auch nach dem Supabase-
  // Sync, case 'content'). Nur schreiben, wenn sich etwas ändert – sonst würde
  // der bereits übersetzte Textknoten (i18n) unnötig ersetzt.
  document.querySelectorAll('.hero-eyebrow').forEach(el => {
    const html = el.innerHTML;
    const fixed = html.replace(/\s+·\s+/g, '&nbsp;· ');
    if (fixed !== html) el.innerHTML = fixed;
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
/* Kommende Schließtage (gleicher Key 'holidays'): von morgen bis heute + days.
   Direkt aufeinanderfolgende Tage mit gleichem Grund werden zu einem Zeitraum
   {from, to, label} zusammengefasst (ISO-Datum, Grund wie eingetippt). */
function upcomingClosures(days = 21) {
  const today = isoLocal(new Date());
  const min = addDaysIso(today, 1), max = addDaysIso(today, days);
  const list = getHolidays()
    .filter(h => h && /^\d{4}-\d{2}-\d{2}$/.test(String(h.date || '')) && h.date >= min && h.date <= max)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const blocks = [];
  list.forEach(h => {
    const label = String(h.label || '').trim();
    const last = blocks[blocks.length - 1];
    if (last && last.to === h.date) return; // doppelt eingetragener Tag
    if (last && last.label === label && addDaysIso(last.to, 1) === h.date) { last.to = h.date; return; }
    blocks.push({ from: h.date, to: h.date, label });
  });
  return blocks;
}
// Kurzes Datum für Schließtage: DE „Do, 24.12.“, EN „Thu 24 Dec“
function closureDateText(iso, en) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  const wd = (en ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'])[(d.getDay() + 6) % 7];
  return en ? `${wd} ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}` : `${wd}, ${d.getDate()}.${d.getMonth() + 1}.`;
}
function closureRangeText(b, en) {
  return b.from === b.to ? closureDateText(b.from, en) : `${closureDateText(b.from, en)} – ${closureDateText(b.to, en)}`;
}
/* „Demnächst geschlossen: …“ unter den Öffnungszeiten (Startseite, Kontakt) und im Footer.
   Idempotent: vorhandene Zeilen werden entfernt und neu aufgebaut; ohne kommende
   Schließtage bleibt nichts stehen. Der Grund ist Inhaber-Eingabe → nur per textContent. */
function renderUpcomingClosures() {
  if (document.body.classList.contains('admin-body')) return;
  document.querySelectorAll('.hours-closures, .footer-closures').forEach(el => el.remove());
  const blocks = upcomingClosures(21);
  if (!blocks.length) return;
  const en = alsterLang() === 'en';
  const build = (tag, cls) => {
    const el = document.createElement(tag);
    el.className = cls;
    el.setAttribute('data-no-i18n', '');
    // Kein <span> als erstes Kind: die Punktlinie der Öffnungszeiten hängt an span:first-child
    const label = document.createElement('b');
    label.className = 'hours-closures-label';
    label.textContent = en ? 'Closed soon:' : 'Demnächst geschlossen:';
    el.appendChild(label);
    blocks.slice(0, 2).forEach((b, i) => {
      el.appendChild(document.createTextNode(i ? (en ? ' and ' : ' und ') : ' '));
      const item = document.createElement('span');
      item.className = 'hours-closures-item';
      item.textContent = closureRangeText(b, en) + (b.label ? ' · ' + holidayLabel(b.label) : '');
      el.appendChild(item);
    });
    if (blocks.length > 2) el.appendChild(document.createTextNode(en ? ' + more' : ' + weitere'));
    return el;
  };
  document.querySelectorAll('#hours-list').forEach(list => list.appendChild(build('li', 'hours-closures')));
  document.querySelectorAll('.footer-col-hours .footer-hours-lines').forEach(lines => lines.after(build('p', 'footer-closures')));
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
// Tage und Zeiten liest rules.js – dieselben Regeln prüft der Mitgliederbereich beim Speichern.
const weekdayIndex = (w) => window.AlsterRules.weekdayIndex(w);
const parseDayLabel = (l) => window.AlsterRules.parseDayLabel(l);
function getWeekHours() {
  let rows = null;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_HOURS) || 'null');
    if (Array.isArray(parsed) && parsed.length) rows = parsed;
  } catch {}
  if (!rows) rows = DEFAULT_HOURS;
  const out = new Array(7).fill(null);
  rows.forEach(r => {
    const days = parseDayLabel(r && r.label);
    if (/geschlossen|closed|ruhetag/i.test(String(r && r.time || ''))) { days.forEach(d => { out[d] = null; }); return; }
    const range = window.AlsterRules.parseTimeRange(r && r.time);
    if (!range || range.closeMin <= range.openMin) return; // unlesbar → Tag bleibt zu
    days.forEach(d => { out[d] = { openMin: range.openMin, closeMin: range.closeMin }; });
  });
  return out;
}
// Kompatibilität: frühere Aufrufer
function parseHoursFromDom() { return getWeekHours(); }

function isoLocal(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
// Ab 15 Uhr zeigt die Startseite den nächsten Tag → „Morgen“ statt „Heute“
/* „Tisch reservieren“ aus dem Mittagstisch: Formular mit dem Tag des Gerichts und 12:00 Uhr
   vorbelegen – nur wenn an dem Tag ein Gericht eingetragen ist (Inhaber-Entscheidung). */
function setReserveLink(a, date, hasDish) {
  if (!a) return;
  a.href = (hasDish && date) ? `reservierung.html?datum=${isoLocal(date)}&zeit=12:00` : 'reservierung.html';
}
const CROQUE_SHOP_URL = 'https://croquenoah.simplywebshop.de/storedata/listStore';
function setCroqueLink(after, on, en) {
  if (!after || !after.parentElement) return;
  let a = after.parentElement.querySelector(':scope > .croque-alt-link');
  if (!on) { a?.remove(); return; }
  if (!a) {
    a = document.createElement('a');
    a.className = 'croque-alt-link';
    a.target = '_blank'; a.rel = 'noopener noreferrer'; a.href = CROQUE_SHOP_URL;
    after.after(a);
  }
  a.textContent = en ? 'Order Croques →' : 'Croques bestellen →';
}

/* Kein Mittagstisch, aber das Café hat an dem Tag geöffnet (z. B. Samstag):
   im Wochenplan als „geschlossen“ markiert oder am Wochenende leer, kein Schließtag. */
function noLunchButOpen(entry, d) {
  if (!d || dayDishes(entry).length || (entry && entry.holiday !== undefined) || !openingFor(d)) return false;
  const weekend = d.getDay() === 0 || d.getDay() === 6;
  return !!(entry && entry.closed) || weekend;
}
/* Wochenplan-Eintrag (roh) für ein Datum */
function lunchEntryForDate(d) {
  const wk = loadCurrentWeek(mondayOf(d));
  return wk?.days?.[DAY_KEYS[(d.getDay() + 6) % 7]];
}
/* Nächster Tag mit Mittagstisch: erster folgender Tag mit Eintrag, sonst nächster offener Werktag */
function nextLunchDay(from) {
  const d = new Date(from);
  let fallback = null;
  for (let i = 1; i <= 14; i++) {
    d.setDate(d.getDate() + 1);
    if (!openingFor(d)) continue;
    const entry = lunchEntryFor(lunchEntryForDate(d), d);
    if (dayDishes(entry).length) return new Date(d);
    const wd = d.getDay();
    if (!fallback && wd >= 1 && wd <= 5 && !(entry && entry.closed)) fallback = new Date(d);
  }
  return fallback;
}

/* Mittagstisch-Eintrag eines Tages – an Schließtagen (Urlaub & Feiertage) immer „geschlossen“,
   auch wenn im Wochenplan ein Gericht steht. */
function lunchEntryFor(entry, d) {
  const h = d ? holidayOn(d) : null;
  return h ? { closed: true, holiday: holidayLabel(h.label) } : entry;
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
/* Welchen Tag Startseite und Mittagstisch-Seite als Tagesgericht zeigen: bis zur
   Schlusszeit (Öffnungszeiten des Tages, sonst 15:00) den heutigen Tag, danach den
   nächsten Kalendertag – abends schauen die Gäste schon nach dem Mittag von morgen. */
function lunchFocusDate(now = new Date()) {
  const close = openingFor(now)?.closeMin ?? 15 * 60;
  const m = now.getHours() * 60 + now.getMinutes();
  if (m < close) return now;
  const t = new Date(now); t.setDate(t.getDate() + 1);
  return t;
}
// Nächster Tag mit Öffnungszeiten nach „from“ (überspringt Schließtage), sonst null
function nextOpenDay(from) {
  const d = new Date(from);
  for (let i = 1; i <= 60; i++) { d.setDate(d.getDate() + 1); if (openingFor(d)) return new Date(d); }
  return null;
}

function computeLiveStatus() {
  const en = alsterLang() === 'en';
  // Schließtag (Urlaub/Feiertag) hat Vorrang vor den regulären Zeiten
  const hol = todayHoliday();
  if (hol) {
    const suffix = hol.label ? ' · ' + holidayLabel(hol.label) : '';
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
/* Google-Bewertungslink aus „Bilder & Farben“ (Mitgliederbereich): nur mit gültigem Link erscheint
   die Zeile unter den Bewertungskarten, der Link auf der Kontaktseite und in der Fußzeile. */
function googleReviewUrl() {
  let design = {};
  try { design = JSON.parse(localStorage.getItem(STORAGE_DESIGN) || '{}'); } catch {}
  const u = String(design.googleReviewUrl || '').trim();
  return /^https:\/\/(g\.page\/|search\.google\.com\/|www\.google\.[a-z.]+\/|maps\.app\.goo\.gl\/|goo\.gl\/)/i.test(u) ? u : '';
}
function initGoogleReview() {
  const url = googleReviewUrl();
  const en = alsterLang() === 'en';
  // Startseite: Zeile unter den Bewertungskarten
  const grid = document.querySelector('.reviews-cta-grid');
  if (grid) {
    let line = document.getElementById('reviews-google');
    if (!url) line?.remove();
    else {
      if (!line) {
        line = document.createElement('p');
        line.id = 'reviews-google'; line.className = 'reviews-google reveal in';
        line.setAttribute('data-no-i18n', '');
        grid.after(line);
      }
      line.innerHTML = `${en ? 'Enjoyed your visit?' : 'Hat es Ihnen bei uns gefallen?'} <a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${en ? 'Write a Google review' : 'Bewertung bei Google schreiben'} <svg class="ico ico-sm" aria-hidden="true"><use href="#i-ext"/></svg></a>`;
    }
  }
  // Kontaktseite: Link neben Instagram/Tripadvisor
  const social = document.querySelector('.contact .social');
  if (social) {
    let a = social.querySelector('.social-google');
    if (!url) a?.remove();
    else {
      if (!a) { a = document.createElement('a'); a.className = 'social-google'; a.target = '_blank'; a.rel = 'noopener noreferrer'; social.appendChild(a); }
      a.href = url; a.textContent = en ? 'Google review' : 'Google-Bewertung';
    }
  }
  // Fußzeile („Folgen Sie uns“)
  document.querySelectorAll('.footer-google-review').forEach(a => { a.hidden = !url; if (url) a.href = url; });
}

function initDesign() {
  let design = {};
  try { design = JSON.parse(localStorage.getItem(STORAGE_DESIGN) || '{}'); } catch {}
  initGoogleReview();

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

  // Galerie: nur, wenn der Inhaber sie im Mitgliederbereich eingeschaltet hat
  renderHomeGallery(design.galleryVisible === true ? design.gallery : null, design.galleryVisible === true);
}

function renderHomeGallery(images, enabled = true) {
  const gallery = Array.isArray(images) ? images.filter(Boolean) : [];
  let section = document.getElementById('galerie');
  // Ausgeschaltet: auch kein Platzhalter für den Inhaber
  if (!enabled) { if (section) section.hidden = true; return; }

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
        <div class="gallery-dots" aria-hidden="true"></div>
      </div>
    `;
    // Galerie direkt nach dem Tagesgericht: Fotos machen früh Appetit.
    // Fallback: VOR dem Closer mit "Fin.".
    const today = document.getElementById('today-feature');
    const closer = document.querySelector('.landing-closer');
    const reservation = document.getElementById('reservierung');
    if (today) today.after(section);
    else if (closer) closer.parentElement.insertBefore(section, closer);
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
      <span class="gallery-empty-desc">Bis zu 6 Bilder hochladen — Eckcafé, Croques, Brötchen, Innenraum. Im Mitgliederbereich unter „Bilder hochladen“.</span>
      <span class="gallery-empty-link">Zum Mitgliederbereich →</span>
    `;
    grid.appendChild(ph);
    return;
  }

  const en = alsterLang() === 'en';
  const dots = section.querySelector('.gallery-dots');
  if (dots) dots.innerHTML = gallery.length > 1 ? gallery.map((_, i) => `<span${i ? '' : ' class="is-active"'}></span>`).join('') : '';
  gallery.forEach((src, i) => {
    const item = document.createElement('figure');
    item.className = 'gallery-item' + (i === 0 ? ' is-feature' : '');
    // Galerie-Photos haben (noch) keine individuellen Alt-Texte.
    // Generischer aber sinnvoller Text fuer Screen-Reader bis Maria
    // im Admin Captions hinterlegen kann.
    item.innerHTML = `<button type="button" class="gallery-open" aria-label="${en ? `Enlarge photo ${i + 1} of ${gallery.length}` : `Foto ${i + 1} von ${gallery.length} vergrößern`}"><img src="${src}" alt="Eindruck aus dem Alstercafé in Hamburg-Hohenfelde" loading="lazy" decoding="async" /></button>`;
    item.querySelector('button').addEventListener('click', () => openGalleryLightbox(gallery, i));
    grid.appendChild(item);
  });
  // Handy: Punkte zeigen, welches Foto gerade in der Wischreihe steht
  if (dots && !grid.dataset.dotsBound) {
    grid.dataset.dotsBound = '1';
    let raf = 0;
    grid.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const items = grid.querySelectorAll('.gallery-item');
        if (!items.length) return;
        const step = items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : 1;
        const idx = Math.max(0, Math.min(items.length - 1, Math.round(grid.scrollLeft / (step || 1))));
        dots.querySelectorAll('span').forEach((d, i) => d.classList.toggle('is-active', i === idx));
      });
    }, { passive: true });
  }
}

/* Großansicht der Galerie-Fotos: blättern per Pfeil, Wischen, Pfeiltasten */
function openGalleryLightbox(images, start) {
  const en = alsterLang() === 'en';
  let idx = start || 0;
  let dlg = document.getElementById('gallery-lightbox');
  const opener = document.activeElement;
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'gallery-lightbox';
    dlg.className = 'gallery-lightbox';
    dlg.setAttribute('data-no-i18n', '');
    document.body.appendChild(dlg);
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.classList.contains('gallery-lightbox-stage')) dlg.close(); });
    dlg.addEventListener('close', () => {
      document.body.classList.remove('sheet-open');
      if (dlg._opener && document.contains(dlg._opener)) dlg._opener.focus({ preventScroll: true });
    });
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); dlg._go?.(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); dlg._go?.(-1); }
    });
    let x0 = null;
    dlg.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 45) dlg._go?.(dx < 0 ? 1 : -1);
    }, { passive: true });
  }
  dlg._opener = opener;
  const many = images.length > 1;
  dlg.setAttribute('aria-label', en ? 'Photo gallery' : 'Fotogalerie');
  dlg.innerHTML = `
    <div class="gallery-lightbox-stage">
      <img class="gallery-lightbox-img" alt="Eindruck aus dem Alstercafé in Hamburg-Hohenfelde" />
    </div>
    <button type="button" class="gallery-lightbox-close" aria-label="${en ? 'Close' : 'Schließen'}">×</button>
    ${many ? `
    <button type="button" class="gallery-lightbox-nav is-prev" aria-label="${en ? 'Previous photo' : 'Vorheriges Foto'}">‹</button>
    <button type="button" class="gallery-lightbox-nav is-next" aria-label="${en ? 'Next photo' : 'Nächstes Foto'}">›</button>` : ''}
    <p class="gallery-lightbox-count" aria-live="polite"></p>`;
  const img = dlg.querySelector('.gallery-lightbox-img');
  const count = dlg.querySelector('.gallery-lightbox-count');
  const show = () => {
    img.src = images[idx];
    count.textContent = many ? `${idx + 1} / ${images.length}` : '';
  };
  dlg._go = (d) => { if (!many) return; idx = (idx + d + images.length) % images.length; show(); };
  dlg.querySelector('.gallery-lightbox-close').addEventListener('click', () => dlg.close());
  dlg.querySelector('.is-prev')?.addEventListener('click', () => dlg._go(-1));
  dlg.querySelector('.is-next')?.addEventListener('click', () => dlg._go(1));
  show();
  if (typeof dlg.showModal !== 'function') { window.open(images[idx], '_blank', 'noopener'); return; }
  document.body.classList.add('sheet-open');
  dlg.showModal();
  dlg.querySelector('.gallery-lightbox-close').focus({ preventScroll: true });
}

/* „Route planen“ (Startseite, Kopfzeilen-Menü, Kontakt, Fußzeile): auf iPhone/iPad/Mac
   direkt Apple Karten, sonst Google Maps – jeweils die Navigation, nicht nur die Suche. */
function routeHref() {
  const ua = navigator.userAgent || '';
  const apple = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && !/Chrome|Firefox|Edg/.test(ua));
  return apple
    ? 'https://maps.apple.com/?daddr=Ifflandstra%C3%9Fe+45%2C+22087+Hamburg'
    : 'https://www.google.com/maps/dir/?api=1&destination=Ifflandstra%C3%9Fe+45%2C+22087+Hamburg';
}
function initRouteLinks() {
  const href = routeHref();
  document.querySelectorAll('a.js-route').forEach(a => { a.href = href; });
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
  // Beim offenen Handy-Menü bleibt der Rest der Seite für Tastatur und Vorlesen unerreichbar
  const outside = () => Array.from(document.querySelectorAll('body > :not(.site-header):not(script):not(style)'));
  const focusables = () => Array.from(nav.querySelectorAll('a[href], button:not([disabled])')).filter(el => el.offsetParent !== null || getComputedStyle(el).position === 'fixed');
  const setOpen = (open) => {
    const was = nav.classList.contains('open');
    nav.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', alsterLang() === 'en' ? (open ? 'Close menu' : 'Open menu') : (open ? 'Menü schließen' : 'Menü öffnen'));
    // Nur auf Handy-Breite (dort ist das Menü ein Overlay): Seite dahinter sperren, Fokus führen
    const mobile = matchMedia('(max-width: 980px)').matches;
    outside().forEach(el => {
      if (open && mobile) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); }
      else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }
    });
    if (open && mobile) {
      const first = focusables()[0];
      if (first) setTimeout(() => first.focus({ preventScroll: true }), 50);
    } else if (was && !open && mobile) {
      toggle.focus({ preventScroll: true });
    }
  };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));
  // ESC schließt das Menü; Tab bleibt im offenen Menü (Fokus-Falle zwischen Menü-Knopf und letztem Eintrag)
  document.addEventListener('keydown', e => {
    if (!nav.classList.contains('open')) return;
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key !== 'Tab' || !matchMedia('(max-width: 980px)').matches) return;
    const items = [toggle, ...focusables()];
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!items.includes(document.activeElement)) { e.preventDefault(); first.focus(); }
  });
  // Menü schließt beim Wechsel auf Computer-Breite (sonst bliebe die Seite gesperrt)
  matchMedia('(min-width: 981px)').addEventListener?.('change', ev => { if (ev.matches && nav.classList.contains('open')) setOpen(false); });
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
    // Sichtfeld scrollen — so wirkt nie ein Kasten „leer“.
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
          Wir verwenden nur technisch notwendige Speicherfunktionen. „Alle akzeptieren“ lädt zusätzlich die Google-Karte auf der Kontaktseite — die setzt eigene Cookies. Mehr in der <a href="datenschutz.html">Datenschutzerklärung</a>.
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
    // Direkt OBERHALB der Datumsleiste bzw. Topbar einsetzen — entspricht der
    // Reihenfolge auf index.html: Hinweis, Datumsleiste, Topbar.
    const topbar = document.querySelector('.edition-strip') || document.querySelector('.topbar');
    if (topbar && topbar.parentNode) {
      topbar.parentNode.insertBefore(banner, topbar);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }
  }

  const text = banner?.querySelector('#notice-text');
  if (!banner || !text) return;
  // Der Speicher legt Werte als JSON ab ("Text" mit Anführungszeichen) → sauber auslesen.
  // Ältere Einträge ohne JSON werden weiter verstanden.
  let value = '';
  try {
    const v = window.alsterDb?.get?.('notice');
    if (typeof v === 'string') value = v;
    else {
      const raw = localStorage.getItem(STORAGE_NOTICE) || '';
      try { const p = JSON.parse(raw); value = typeof p === 'string' ? p : raw; } catch { value = raw; }
    }
    value = String(value || '').trim();
    // „Anzeigen bis“ (Mitgliederbereich → Hinweis): nach diesem Tag automatisch ausblenden
    const until = window.alsterDb?.get?.('notice-until');
    if (value && typeof until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(until) && isoLocal(new Date()) > until) value = '';
  } catch {}
  if (value) {
    text.textContent = value;
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }
}

/* ---------- Urlaub/Feiertag-Banner ----------
   Zeigt an jedem Schließtag (aus dem Content-Key 'holidays') auf allen
   Seiten einen klaren „Heute geschlossen“-Hinweis. Nutzt die Notice-Optik. */
function initHolidays() {
  if (document.body.classList.contains('admin-body')) return;
  let banner = document.getElementById('holiday-banner');
  const en = alsterLang() === 'en';
  const hol = todayHoliday();
  // Vorab-Hinweis: beginnt in den nächsten 7 Tagen ein Schließtag, zeigt derselbe Banner
  // das schon an – aber nur, wenn gerade kein Hinweis-Banner des Inhabers sichtbar ist
  // (seine Notiz hat Vorrang, keine zwei Banner übereinander).
  const notice = document.getElementById('notice-banner');
  const soon = (!hol && (!notice || notice.hidden)) ? (upcomingClosures(7)[0] || null) : null;
  if (!hol && !soon) { if (banner) banner.hidden = true; renderUpcomingClosures(); return; }
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'notice-banner holiday-banner';
    banner.id = 'holiday-banner';
    banner.hidden = true;
    // Eigener Bereich für Hilfstechnik (sonst „Inhalt außerhalb eines Landmarks“)
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', en ? 'Closing days' : 'Schließtage');
    banner.innerHTML = `
      <div class="container notice-inner">
        <span class="notice-tag" data-no-i18n>Geschlossen</span>
        <p id="holiday-text" data-no-i18n></p>
      </div>`;
    const topbar = document.querySelector('.topbar');
    if (topbar && topbar.parentNode) topbar.parentNode.insertBefore(banner, topbar);
    else document.body.insertBefore(banner, document.body.firstChild);
  }
  const tag = banner.querySelector('.notice-tag');
  if (tag) tag.textContent = hol ? (en ? 'Closed' : 'Geschlossen') : (en ? 'Notice' : 'Vorab');
  const txt = banner.querySelector('#holiday-text');
  if (txt) {
    if (hol) txt.textContent = (en ? 'Closed today' : 'Heute geschlossen') + (hol.label ? ' — ' + holidayLabel(hol.label) : '');
    else {
      const lbl = soon.label ? ' · ' + holidayLabel(soon.label) : '';
      txt.textContent = (soon.from === soon.to
        ? (en ? `Closed on ${closureDateText(soon.from, en)}` : `Am ${closureDateText(soon.from, false)} geschlossen`)
        : (en ? `Closed from ${closureDateText(soon.from, en)} to ${closureDateText(soon.to, en)}` : `Vom ${closureDateText(soon.from, false)} bis ${closureDateText(soon.to, false)} geschlossen`)) + lbl;
    }
  }
  banner.hidden = false;
  renderUpcomingClosures();
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
  renderSpecialsBlock(mount);
  const sp = getSpecials();
  injectMenuSchema(sp ? { ...data, sections: [...sp.sections, ...data.sections] } : data);
  initKarteJump();
  if (location.hash === '#sommer' && !mount.dataset.jumped) {
    mount.dataset.jumped = '1';
    requestAnimationFrame(() => document.getElementById('sommer')?.scrollIntoView({ block: 'start' }));
  }
}

/* ---------- Sommer-Specials (saisonal, im Mitgliederbereich schaltbar) ---------- */
function getSpecials() {
  let stored = null;
  try { stored = window.alsterDb?.get('specials'); } catch {}
  if (!stored) { try { stored = JSON.parse(localStorage.getItem('alstercafe.specials') || 'null'); } catch {} }
  const data = (stored && Array.isArray(stored.sections)) ? stored : window.ALSTERCAFE_SPECIALS_DEFAULT;
  if (!data || data.visible === false) return null;
  // Optionaler Zeitraum „Zeigen ab/bis“ (Mitgliederbereich): leer = immer, sonst nur innerhalb
  const isoOk = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
  const today = isoLocal(new Date());
  if (isoOk(data.showFrom) && today < data.showFrom) return null;
  if (isoOk(data.showTo) && today > data.showTo) return null;
  const sections = (data.sections || []).filter(s => s && Array.isArray(s.items) && s.items.some(it => it && it.name));
  return sections.length ? { ...data, sections } : null;
}
// Auf der Speisekarte als erster, breiter Block „Sommer-Specials“
function renderSpecialsBlock(mount) {
  mount.querySelector('#sommer')?.remove();
  const sp = getSpecials();
  const grid = mount.querySelector('.karte-grid');
  if (!sp || !grid) return;
  const groups = sp.sections.map(sec => `
    <div class="specials-group">
      <h3 class="specials-group-title"><svg class="ico" aria-hidden="true"><use href="#${escapeAttr(sec.icon || 'i-cup')}"/></svg>${escapeHtml(sec.title || '')}</h3>
      <ul class="karte-list">${sec.items.filter(it => it && it.name).map(it => `
        <li><div class="karte-row"><span class="karte-name">${escapeHtml(it.name)}</span>${it.price ? `<span class="karte-preis">${escapeHtml(it.price)}</span>` : ''}</div>${it.desc ? `<p class="karte-desc">${escapeHtml(it.desc)}</p>` : ''}</li>`).join('')}
      </ul>
    </div>`).join('');
  const block = document.createElement('div');
  block.className = 'karte-block karte-block-specials reveal in';
  block.id = 'sommer';
  // Sonnen-Deko nur, solange die Überschrift „Sommer“ enthält (sonst ruhig ohne)
  block.innerHTML = `
    ${/sommer/i.test(sp.title || 'Sommer-Specials') ? '<span class="specials-sun" aria-hidden="true"></span>' : ''}
    <div class="karte-block-head"><svg class="ico"><use href="#i-leaf"/></svg><h2>${escapeHtml(sp.title || 'Sommer-Specials')}</h2></div>
    <div class="specials-groups">${groups}</div>
    ${sp.footnote ? `<p class="specials-foot">${escapeHtml(sp.footnote)}</p>` : ''}`;
  grid.prepend(block);
}
// Startseite: kleine Karte, die zur Speisekarte führt
function initSpecialsTeaser() {
  const wrap = document.getElementById('specials-teaser-wrap');
  if (!wrap) return;
  const sp = getSpecials();
  wrap.hidden = !sp;
  if (!sp) return;
  const t = document.getElementById('specials-teaser-title');
  if (t) t.textContent = sp.title || 'Sommer-Specials';
  // Eisgetränk-Zeichnung passt nur zu „Sommer“ – bei anderem Titel ohne Grafik
  const art = wrap.querySelector('.specials-art');
  if (art) art.hidden = !/sommer/i.test(sp.title || 'Sommer-Specials');
  const list = document.getElementById('specials-teaser-list');
  if (list) {
    const names = sp.sections.flatMap(s => s.items.filter(it => it && it.name).map(it => it.name));
    list.textContent = names.slice(0, 4).join(' · ') + (names.length > 4 ? ' …' : '');
  }
}

/* Speisekarte: Sprung-Knöpfe zu den Kategorien (mobil oben „klebend“,
   die aktuelle Kategorie wird hervorgehoben). Neu aufbauen, wenn sich die
   Karte ändert. */
let karteJumpObserver = null;
function initKarteJump() {
  const mount = document.getElementById('karte-mount');
  if (!mount) return;
  const blocks = Array.from(mount.querySelectorAll('.karte-block'));
  let nav = document.getElementById('karte-jump');
  if (blocks.length < 3) { nav?.remove(); return; }
  if (!nav) {
    nav = document.createElement('nav');
    nav.id = 'karte-jump';
    nav.className = 'karte-jump';
    mount.before(nav);
  }
  nav.setAttribute('aria-label', alsterLang() === 'en' ? 'Menu sections' : 'Kategorien der Speisekarte');
  // „Karte drucken“ (nur am Computer sichtbar, per CSS): druckt die Karte sauber auf A4
  if (!document.getElementById('karte-print')) {
    const pr = document.createElement('button');
    pr.type = 'button'; pr.id = 'karte-print'; pr.className = 'karte-print';
    pr.innerHTML = '<svg class="ico ico-sm" aria-hidden="true" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8V4h10v4"/><rect x="4" y="8" width="16" height="9" rx="2"/><path d="M7 14h10v6H7z"/></g></svg><span>Karte drucken</span>';
    pr.addEventListener('click', () => window.print());
    nav.after(pr);
  }
  nav.innerHTML = blocks.map((b, i) => {
    if (!b.id) b.id = 'karte-' + (i + 1);
    const label = b.querySelector('h2')?.textContent.trim() || '';
    return `<a href="#${b.id}" class="karte-jump-link" data-target="${b.id}">${escapeHtml(label)}</a>`;
  }).join('');
  // Gleitende Markierung (nur wenn genau eine Kategorie aktiv ist, s. update)
  const pill = document.createElement('span');
  pill.className = 'karte-jump-pill'; pill.setAttribute('aria-hidden', 'true');
  nav.prepend(pill);
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById(a.dataset.target)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }));
  // Aktuelle Kategorie hervorheben: die letzte, deren Anfang die Lesehöhe
  // (unter der klebenden Leiste) schon erreicht hat. Bewusst per Scroll-
  // Position statt IntersectionObserver — kurze Kategorien (Extras, Getränke)
  // liegen dicht beieinander, dort sprang die Hervorhebung sonst hin und her.
  if (karteJumpObserver) window.removeEventListener('scroll', karteJumpObserver);
  const links = Array.from(nav.querySelectorAll('a'));
  let current = '';
  let raf = 0;
  const update = () => {
    raf = 0;
    const line = nav.getBoundingClientRect().bottom + Math.min(140, window.innerHeight * 0.18);
    // Am Computer stehen zwei Kategorien nebeneinander → ganze Zeile markieren
    const tops = blocks.map(b => Math.round(b.getBoundingClientRect().top));
    const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    const passed = tops.filter(t => t <= line);
    const rowTop = atEnd ? Math.max(...tops) : (passed.length ? Math.max(...passed) : tops[0]);
    const ids = blocks.filter((b, i) => Math.abs(tops[i] - rowTop) < 6).map(b => b.id);
    const key = ids.join(' ');
    if (key === current) return;
    current = key;
    // Pille gleitet zur aktiven Kategorie; bei zwei aktiven (Computer) bleibt die alte Darstellung
    const solo = ids.length === 1 ? links.find(a => a.dataset.target === ids[0]) : null;
    nav.classList.toggle('has-pill', !!solo);
    if (solo) {
      const first = !pill.dataset.on;
      if (first) pill.style.transition = 'none';
      pill.style.width = solo.offsetWidth + 'px';
      pill.style.height = solo.offsetHeight + 'px';
      pill.style.transform = `translate(${solo.offsetLeft}px, ${solo.offsetTop}px)`;
      if (first) { pill.dataset.on = '1'; void pill.offsetWidth; pill.style.transition = ''; }
    }
    links.forEach(a => {
      const on = ids.includes(a.dataset.target);
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      // Nur die Leiste seitlich verschieben — nie die Seite selbst
      if (on && a.dataset.target === ids[0] && nav.scrollWidth > nav.clientWidth) {
        const left = a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2;
        nav.scrollTo({ left: Math.max(0, left), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    });
  };
  karteJumpObserver = () => { if (!raf) raf = requestAnimationFrame(update); };
  window.addEventListener('scroll', karteJumpObserver, { passive: true });
  update();
}

/* Google-Daten (JSON-LD) der Startseite mit den im Mitgliederbereich
   gepflegten Öffnungszeiten abgleichen — sonst stünden dort veraltete Zeiten. */
function syncBusinessSchema() {
  const el = document.getElementById('ld-business');
  if (!el) return;
  let data; try { data = JSON.parse(el.textContent); } catch { return; }
  const hours = getWeekHours();
  if (!Array.isArray(hours) || !hours.some(Boolean)) return;
  const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const groups = [];
  hours.forEach((h, i) => {
    if (!h) return;
    const opens = formatMin(h.openMin), closes = formatMin(h.closeMin);
    const g = groups.find(x => x.opens === opens && x.closes === closes);
    g ? g.dayOfWeek.push(names[i]) : groups.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: [names[i]], opens, closes });
  });
  data.openingHoursSpecification = groups;
  // Schließtage (Urlaub & Feiertage) der nächsten 60 Tage für Google
  try {
    const today = isoLocal(new Date());
    const limit = new Date(); limit.setDate(limit.getDate() + 60);
    const until = isoLocal(limit);
    const special = (getHolidays() || [])
      .filter(h => h && h.date && h.date >= today && h.date <= until)
      .map(h => ({ '@type': 'OpeningHoursSpecification', validFrom: h.date, validThrough: h.date, opens: '00:00', closes: '00:00' }));
    if (special.length) data.specialOpeningHoursSpecification = special;
    else delete data.specialOpeningHoursSpecification;
  } catch {}
  el.textContent = JSON.stringify(data, null, 2);
}

/* Mobiles Menü: unten Öffnungszeit heute, Telefon und Adresse */
function initNavExtra() {
  const nav = document.getElementById('primary-nav');
  if (!nav) return;
  const en = alsterLang() === 'en';
  let box = nav.querySelector('.nav-extra');
  if (!box) {
    box = document.createElement('div');
    box.className = 'nav-extra';
    box.setAttribute('data-no-i18n', '');
    nav.appendChild(box);
  }
  const st = computeLiveStatus();
  const day = openingFor(new Date());
  const hoursText = day
    ? (en ? `Today ${formatMin(day.openMin)} – ${formatMin(day.closeMin)}` : `Heute ${formatMin(day.openMin)} – ${formatMin(day.closeMin)} Uhr`)
    : (en ? 'Closed today' : 'Heute geschlossen');
  box.innerHTML = `
    <p class="nav-extra-status${st?.state === 'open' ? ' is-open' : ''}">${escapeHtml(st?.text || hoursText)}</p>
    <p class="nav-extra-hours">${escapeHtml(hoursText)}</p>
    <a class="nav-extra-call" href="tel:+494022692891"><svg class="ico ico-sm" aria-hidden="true"><use href="#i-phone"/></svg> 040 – 22 69 28 91</a>
    <a class="nav-extra-addr js-route" href="${routeHref()}" target="_blank" rel="noopener" title="${en ? 'Get directions' : 'Route planen'}">Ifflandstraße 45 · 22087 Hamburg</a>`;
}

/* „Nach oben“-Knopf auf langen Seiten (nur mobil sichtbar, per CSS) */
function initToTop() {
  if (document.body.classList.contains('admin-body') || document.getElementById('to-top')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'to-top';
  btn.className = 'to-top';
  btn.setAttribute('aria-label', alsterLang() === 'en' ? 'Back to top' : 'Nach oben');
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  document.body.appendChild(btn);
  let ticking = false;
  const update = () => {
    ticking = false;
    const long = document.documentElement.scrollHeight > window.innerHeight * 2.5;
    btn.classList.toggle('is-visible', long && window.scrollY > window.innerHeight * 1.2);
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
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
          else if (it.tag && /vegetarisch|vegetarian/i.test(it.tag)) item.suitableForDiet = 'https://schema.org/VegetarianDiet';
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

/* Heutigen Wochentag in allen Öffnungszeiten-Listen hervorheben
   (Fußzeile, Kontaktseite, Startseite). */
function markTodayInHours() {
  const today = (new Date().getDay() + 6) % 7;
  const en = alsterLang() === 'en';
  document.querySelectorAll('#hours-list li:not(.hours-closures), .landing-visit li:not(.hours-closures), .footer-hours-lines .footer-line').forEach(row => {
    const label = row.querySelector('span')?.textContent || '';
    const days = parseDayLabel(label);
    const isToday = Array.isArray(days) && days.includes(today);
    row.classList.toggle('is-today', isToday);
    let badge = row.querySelector('.hours-today');
    if (isToday && !badge) {
      badge = document.createElement('span');
      badge.className = 'hours-today';
      badge.setAttribute('data-no-i18n', '');
      row.appendChild(badge);
    }
    if (badge) { if (isToday) badge.textContent = en ? 'today' : 'heute'; else badge.remove(); }
  });
}

/* Hilfe unter Datumsfeldern: Wochentag + Öffnungszeit des gewählten Tages
   (z. B. „Mittwoch, 21. Oktober · geöffnet 06:30 – 15:00 Uhr“). */
function attachDateHints() {
  document.querySelectorAll('.reservation-form input[name="Datum"], .order-form input[name="Datum"]').forEach(input => {
    const label = input.closest('.form-row') || input.closest('label');
    if (!label || label.nextElementSibling?.classList.contains('date-hint')) return;
    const hint = document.createElement('p');
    hint.className = 'date-hint';
    hint.setAttribute('aria-live', 'polite');
    hint.setAttribute('data-no-i18n', '');
    label.after(hint);
    const update = () => {
      const en = alsterLang() === 'en';
      const m = String(input.value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) { hint.textContent = ''; hint.className = 'date-hint'; return; }
      const d = new Date(+m[1], +m[2] - 1, +m[3]);
      const name = d.toLocaleDateString(en ? 'en-GB' : 'de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
      const hol = holidayOn(d);
      const day = openingFor(d);
      if (hol || !day) {
        hint.textContent = `${name} · ${en ? 'closed' : 'geschlossen'}${hol?.label ? ' (' + holidayLabel(hol.label) + ')' : ''}`;
        hint.className = 'date-hint is-closed';
      } else {
        hint.textContent = `${name} · ${en ? 'open' : 'geöffnet'} ${formatMin(day.openMin)} – ${formatMin(day.closeMin)}${en ? '' : ' Uhr'}`;
        hint.className = 'date-hint';
      }
    };
    ['input', 'change'].forEach(ev => input.addEventListener(ev, update));
    update();
    input.__dateHintUpdate = update;
  });
}

/* ---------- Öffnungszeiten ----------
   HTML enthaelt Standard-Werte. JS ueberschreibt nur bei Custom-Daten. */
function initHours() {
  renderFooterHours();
  const root = document.getElementById('hours-list');
  if (!root) { markTodayInHours(); renderUpcomingClosures(); return; }
  let hours = null;
  try {
    const raw = localStorage.getItem(STORAGE_HOURS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) hours = parsed;
    }
  } catch {}
  if (hours) {
    root.innerHTML = hours.map(h => `
      <li><span>${escapeHtml(h.label || '')}</span><span class="time">${escapeHtml(h.time || '')}</span></li>
    `).join('');
  }
  markTodayInHours();
  renderUpcomingClosures();
}

/* ---------- Mittagstisch (Wochenplan) ---------- */
function initLunchWeek() {
  // Nur auf Mittagstisch-Seite aktiv
  if (!document.getElementById('lunch-today') && !document.getElementById('lunch-week-list')) return;
  const today = new Date();
  // Fokus-Tag: bis Ladenschluss heute, danach morgen (gleiche Regel wie die Startseite)
  const focus = lunchFocusDate(today);
  const isTomorrow = !isSameDay(focus, today);
  // Sunday-Spillover (spiegelt admin.js maybeEnableSundaySpillover):
  // Am Sonntag traegt der Inhaber die kommende Woche ein — die Wochenliste
  // zeigt sie daher sonntags an. Das Sonntags-Gericht selbst liegt weiterhin
  // in der laufenden Woche (dort speichert admin den Spillover).
  const isSunday = today.getDay() === 0;
  const displayMonday = isSunday
    ? mondayOf(new Date(today.getTime() + 86400000))
    : mondayOf(today);
  const focusWeekData   = loadCurrentWeek(mondayOf(focus));
  const displayWeekData = loadCurrentWeek(displayMonday);
  renderWeekMeta(displayMonday);
  renderTodayLunch(focusWeekData, focus, isTomorrow);
  // Markierung in der Liste wandert mit dem Fokus-Tag, sofern er in der gezeigten Woche liegt
  const focusShown = isSameDay(mondayOf(focus), displayMonday);
  renderWeekList(displayWeekData, displayMonday, focusShown ? focus : today);
  injectLunchSchema(displayWeekData, displayMonday);
}

/* Google: die Wochenkarte als strukturierte Speisekarte (Menu → MenuSection je Tag → MenuItem).
   Nur Tage mit eingetragenem Gericht; Schließtage/Leertage bleiben weg. Ein Preis (offers)
   steht nur dabei, wenn der Inhaber ihn im Wochenplan eingetragen hat. */
function injectLunchSchema(weekData, monday) {
  if (!document.getElementById('lunch-week-list')) return;
  try {
    const names = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    const sections = [];
    DAY_KEYS.forEach((key, i) => {
      const d = new Date(monday); d.setDate(d.getDate() + i);
      const entry = lunchEntryFor(weekData?.days?.[key], d);
      const dishes = dayDishes(entry);
      if (!dishes.length) return;
      sections.push({
        '@type': 'MenuSection',
        name: `${names[i]}, ${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`,
        hasMenuItem: dishes.map(x => {
          const item = { '@type': 'MenuItem', name: x.dish };
          if (x.side) item.description = x.side;
          if (x.veg) item.suitableForDiet = 'https://schema.org/VegetarianDiet';
          const price = lunchPriceFor(weekData, x);
          if (price != null) item.offers = { '@type': 'Offer', price: price.toFixed(2), priceCurrency: 'EUR' };
          return item;
        })
      });
    });
    let el = document.getElementById('lunch-schema');
    if (!sections.length) { el?.remove(); return; }
    if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.id = 'lunch-schema'; document.head.appendChild(el); }
    const lbl = typeof weekLabelFor === 'function' ? weekLabelFor(monday) : '';
    el.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'Menu',
      name: 'Mittagstisch' + (lbl ? ' · ' + lbl : ''),
      description: 'Werktags ab 12:00 Uhr – täglich wechselndes Gericht mit Beilage und Salat im Alstercafé, Hamburg-Hohenfelde.',
      inLanguage: 'de', url: 'https://www.alstercafe.de/mittagstisch.html',
      hasMenuSection: sections
    });
  } catch (e) { /* Schema ist optional */ }
}

/* Today-Feature-Block auf der Home-Page:
   - Vor 15:00 (Schliesszeit): heutiges Tagesgericht
   - Ab 15:00 (Cafe geschlossen): Vorschau auf morgen */
/* Zwei Gerichte pro Tag ("entweder … oder …"): liefert die eingetragenen
   Gerichte als Liste [{ dish, side }] — leere werden ausgelassen. */
function dayDishes(entry) {
  if (!entry || entry.closed) return [];
  // price = optionale Abweichung je Gericht (sonst gilt der Wochenpreis, siehe lunchPriceFor)
  return [{ dish: entry.dish, side: entry.side, price: entry.price, veg: entry.veg }, { dish: entry.dish2, side: entry.side2, price: entry.price2, veg: entry.veg2 }]
    .map(d => ({ dish: String(d.dish || '').trim(), side: String(d.side || '').trim(), price: lunchPriceNum(d.price), veg: !!d.veg }))
    .filter(d => d.dish);
}
/* „vegetarisch“-Kennzeichen (Häkchen im Wochenplan): als eigenes kleines Element neben dem
   Gericht – nicht, wenn der Inhaber es schon in den Text geschrieben hat. */
function dietLabel(d, en) {
  if (!d || !d.veg) return '';
  if (/vegetarisch|vegan|veggie|vegetarian|fleischlos/i.test(d.dish || '')) return '';
  return en ? 'vegetarian' : 'vegetarisch';
}
function dietBadgeHtml(d, en) {
  const t = dietLabel(d, en);
  return t ? ` <span class="diet-badge" data-no-i18n="">${t}</span>` : '';
}
function setDishText(el, d, en) {
  if (!el) return;
  el.textContent = d.dish;
  const t = dietLabel(d, en);
  if (t) {
    const b = document.createElement('span');
    b.className = 'diet-badge'; b.setAttribute('data-no-i18n', ''); b.textContent = t;
    el.append(' ', b);
  }
}

/* ---------- Mittagstisch: optionaler Preis und Ausgabe-Ende (Mitgliederbereich) ----------
   Gespeichert im Wochenplan ('weekly-menu'): je Woche price (Zahl) und until („14:30“),
   je Gericht optional price/price2 als Abweichung. Ohne Eintrag erscheint nichts –
   die Seite sieht dann aus wie bisher. */
function lunchPriceNum(v) {
  if (v == null || v === '') return null;
  return window.AlsterRules?.parseEuro ? window.AlsterRules.parseEuro(v) : null;
}
// Preis eines Gerichts: eigener Preis, sonst Wochenpreis, sonst null
function lunchPriceFor(weekData, dish) {
  return (dish && dish.price != null) ? dish.price : lunchPriceNum(weekData?.price);
}
function lunchPriceText(n) { return n == null ? '' : window.AlsterRules.euroText(n) + ' €'; }
// Ausgabe-Ende als „HH:MM“ (nur wenn gepflegt und lesbar)
function lunchUntil(weekData) {
  const m = String(weekData?.until || '').match(/^(\d{1,2})[:.](\d{2})$/);
  return (m && +m[1] < 24 && +m[2] < 60) ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}
// Zeile unter dem Tagesgericht, z. B. „12:00 – 14:30 Uhr · 9,90 €“ (Preis nur, wenn er für alle Gerichte gilt)
function lunchFactsText(weekData, dishes, en) {
  const parts = [];
  const until = lunchUntil(weekData);
  if (until) parts.push(en ? `12:00 – ${until}` : `12:00 – ${until} Uhr`);
  const prices = dishes.map(d => lunchPriceFor(weekData, d));
  if (prices.length && prices.every(p => p != null && p === prices[0])) parts.push(lunchPriceText(prices[0]));
  return parts.join(' · ');
}
// Preise einzeln je Gericht nur, wenn sie sich unterscheiden (sonst steht der Preis in der Zeile)
function lunchPricesDiffer(weekData, dishes) {
  const prices = dishes.map(d => lunchPriceFor(weekData, d));
  return prices.some(p => p != null) && !prices.every(p => p === prices[0]);
}
// Kleines Info-Element (Preis / Zeile) als Geschwister hinter „anchor“ – ein Element je Klasse und Elternteil
function setLunchInfo(host, anchor, cls, text) {
  if (!host || !anchor) return;
  let el = host.querySelector(`:scope > .${cls}`);
  if (!text) { el?.remove(); return; }
  if (!el) { el = document.createElement('p'); el.className = cls; el.setAttribute('data-no-i18n', ''); }
  anchor.after(el);
  el.textContent = text;
}
function clearLunchFacts(host) { host?.querySelectorAll(':scope > .lunch-facts, :scope > .lunch-price').forEach(el => el.remove()); }
/* Preis(e) und Infozeile unter dem großen Tagesgericht (Startseite + Mittagstisch-Seite).
   dishEl/sideEl = erstes Gericht; das zweite steht in .dish-alt (renderAltDish, vorher aufrufen). */
function renderDishPrices(dishEl, sideEl, entry, weekData, en) {
  const host = dishEl?.parentElement;
  if (!host) return;
  const dishes = dayDishes(entry);
  const first = (sideEl && !sideEl.hidden) ? sideEl : dishEl;
  const differ = dishes.length > 1 && lunchPricesDiffer(weekData, dishes);
  setLunchInfo(host, first, 'lunch-price', differ ? lunchPriceText(lunchPriceFor(weekData, dishes[0])) : '');
  const alt = host.querySelector(':scope > .dish-alt');
  if (alt) {
    const altAnchor = alt.querySelector('.dish-alt-side') || alt.querySelector('.dish-alt-name');
    setLunchInfo(alt, altAnchor, 'lunch-price', differ ? lunchPriceText(lunchPriceFor(weekData, dishes[1])) : '');
  }
  const last = alt || host.querySelector(':scope > .lunch-price') || first;
  setLunchInfo(host, last, 'lunch-facts', dishes.length ? lunchFactsText(weekData, dishes, en) : '');
}
// HTML-Trenner "oder" zwischen zwei Gerichten
function orDividerHtml(en, cls = 'dish-or') {
  return `<span class="${cls}" aria-hidden="false"><span>${en ? 'or' : 'oder'}</span></span>`;
}
/* Große Gerichts-Schrift passt sich der Textlänge an: kurze Namen bleiben groß,
   längere Texte (z. B. „Heute ist Croque-Tag! …“) werden kleiner statt riesig. */
function sizeDishText(el, text) {
  if (!el) return;
  const n = String(text ?? el.textContent ?? '').trim().length;
  el.classList.toggle('is-long', n > 26 && n <= 60);
  el.classList.toggle('is-xlong', n > 60);
}
/* Zwei Gerichte am selben Tag stehen gleichwertig untereinander: beide bekommen die
   Schriftgröße, die zum längeren Namen passt (Kennzeichen wie „vegetarisch“ zählen nicht). */
function unifyDishSizes(dishEl) {
  const host = dishEl?.parentElement;
  const alt = host?.querySelector(':scope > .dish-alt .dish-alt-name');
  if (!dishEl || !alt) return;
  const len = el => Array.from(el.childNodes).filter(n => !(n.nodeType === 1 && n.classList.contains('diet-badge'))).map(n => n.textContent).join('').trim().length;
  const n = Math.max(len(dishEl), len(alt));
  [dishEl, alt].forEach(el => { el.classList.toggle('is-long', n > 26 && n <= 60); el.classList.toggle('is-xlong', n > 60); });
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
  const dishCls = (host.querySelector('[id$="-dish"]')?.className || '').replace(/\bh2-reveal\b|\bis-tappable\b|\breveal\b|\bin\b|\bis-x?long\b/g, '').replace(/\s+/g, ' ').trim();
  const sideCls = (host.querySelector('[id$="-side"]')?.className || '').replace(/\bis-tappable\b|\breveal\b|\bin\b/g, '').trim();
  alt.innerHTML = `${orDividerHtml(en)}<p class="dish-alt-name ${dishCls}">${escapeHtml(d.dish)}${dietBadgeHtml(d, en)}</p>${side ? `<p class="dish-alt-side ${sideCls}">${escapeHtml(side)}</p>` : ''}`;
  sizeDishText(alt.querySelector('.dish-alt-name'), d.dish);
}

/* Beilage: "mit …" nur voranstellen, wenn der Text nicht schon so anfängt
   (sonst entstand "mit serviert mit einem Beilagensalat"). */
function sideText(side, en) {
  const t = String(side || '').trim();
  if (!t) return '';
  if (/^(mit|serviert|dazu|und|inkl|wahlweise|oder|with|served|and|or)\b/i.test(t)) return t;
  return en ? `with ${t}` : `mit ${t}`;
}

/* „Mit Kollegen teilen": Handy → Teilen-Menü des Geräts (WhatsApp, Signal, Mail …
   wählt der Gast selbst), Computer → Text in die Zwischenablage. */
const SHARE_ICON = '<svg class="ico ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>';
function lunchShareLabel(en) { return en ? 'Share with colleagues' : 'Mit Kollegen teilen'; }
function lunchShareButton(cls) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn btn-link lunch-share ${cls || ''}`.trim();
  btn.setAttribute('data-no-i18n', '');
  btn.addEventListener('click', () => shareLunch(btn));
  return btn;
}
function setLunchShare(btn, dishes, isTomorrow, en) {
  btn._share = { dishes, isTomorrow, en };
  btn.innerHTML = `${SHARE_ICON} <span>${lunchShareLabel(en)}</span>`;
  btn.hidden = !dishes.length;
}
async function shareLunch(btn) {
  const { dishes = [], isTomorrow, en } = btn._share || {};
  if (!dishes.length) return;
  const names = dishes.map(d => d.dish + (dietLabel(d, en) ? ` (${dietLabel(d, en)})` : '')).join(en ? ' or ' : ' oder ');
  const when = isTomorrow ? (en ? 'Tomorrow' : 'Morgen') : (en ? 'Today' : 'Heute');
  const text = en
    ? `${when} at Alstercafé: ${names} – from 12:00, Ifflandstraße 45.`
    : `${when} im Alstercafé: ${names} – ab 12 Uhr, Ifflandstraße 45.`;
  // Auf Englisch geteilt → der Link öffnet beim Empfänger auch die englische Seite
  const url = 'https://www.alstercafe.de/mittagstisch.html' + (en ? '?lang=en' : '');
  if (navigator.share) {
    try { await navigator.share({ title: en ? 'Lunch at Alstercafé' : 'Mittagstisch im Alstercafé', text, url }); } catch (e) { /* abgebrochen */ }
    return;
  }
  const label = btn.querySelector('span');
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    if (label) label.textContent = en ? 'Copied – paste it into your chat' : 'Kopiert – einfach in den Chat einfügen';
  } catch (e) {
    if (label) label.textContent = en ? 'Copying not possible' : 'Kopieren nicht möglich';
  }
  clearTimeout(btn._reset);
  btn._reset = setTimeout(() => { if (label) label.textContent = lunchShareLabel(en); }, 3200);
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
    const entry = lunchEntryFor(week?.days?.[key], d);
    // Wochenende nur zeigen, wenn dort wirklich etwas eingetragen ist
    if (i >= 5 && !dayDishes(entry).length) return '';
    const iso = isoLocal(d);
    const isToday = iso === focusIso;
    const past = iso < todayIso;
    let body;
    if (entry?.closed) body = `<span class="lunch-sheet-closed">${entry.holiday !== undefined ? (en ? 'Closed' : 'Geschlossen') + (entry.holiday ? ' · ' + escapeHtml(entry.holiday) : '') : (en ? 'No lunch' : 'Kein Mittagstisch')}</span>`;
    else if (dayDishes(entry).length) body = dayDishes(entry).map(d =>
      `<span class="lunch-sheet-dish">${escapeHtml(d.dish)}${dietBadgeHtml(d, en)}</span>${d.side ? `<span class="lunch-sheet-side">${escapeHtml(sideText(d.side, en))}</span>` : ''}`
      + (lunchPriceFor(week, d) != null ? `<span class="lunch-sheet-price">${lunchPriceText(lunchPriceFor(week, d))}</span>` : '')
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
      ${lunchUntil(week) ? `<p class="lunch-sheet-facts">${en ? `12:00 – ${lunchUntil(week)}` : `12:00 – ${lunchUntil(week)} Uhr`}</p>` : ''}
      <ul class="lunch-sheet-list">${rows}</ul>
      <div class="lunch-sheet-cta">
        <a class="btn btn-gold" href="${dayDishes(lunchEntryFor(week?.days?.[DAY_KEYS[(new Date(focusIso + 'T12:00:00').getDay() + 6) % 7]], new Date(focusIso + 'T12:00:00'))).length ? `reservierung.html?datum=${focusIso}&zeit=12:00` : 'reservierung.html'}">${en ? 'Book a table' : 'Tisch reservieren'}</a>
        <a class="btn btn-link" href="tel:+494022692891"><svg class="ico ico-sm"><use href="#i-phone"/></svg> 040 – 22 69 28 91</a>
      </div>
      <a class="lunch-sheet-more" href="mittagstisch.html">${en ? 'Go to the lunch page →' : 'Zur Mittagstisch-Seite →'}</a>
    </div>`;
  dlg.querySelector('.lunch-sheet-close').addEventListener('click', () => dlg.close());
  const focusEntry = lunchEntryFor(week?.days?.[DAY_KEYS[(new Date(focusIso + 'T12:00').getDay() + 6) % 7]], new Date(focusIso + 'T12:00'));
  const focusDishes = dayDishes(focusEntry);
  if (focusDishes.length) {
    const share = lunchShareButton();
    setLunchShare(share, focusDishes, focusIso !== todayIso, en);
    dlg.querySelector('.lunch-sheet-cta').appendChild(share);
  }
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
  // Gleiche Regel wie die Mittagstisch-Seite (lunchFocusDate): nach Ladenschluss morgen
  const targetDate = lunchFocusDate(now);
  const showTomorrow = !isSameDay(targetDate, now);

  const monday = mondayOf(targetDate);
  const weekData = loadCurrentWeek(monday);
  const dayIdx = (targetDate.getDay() + 6) % 7;
  const dayKey = DAY_KEYS[dayIdx];
  const entry  = lunchEntryFor(weekData?.days?.[dayKey], targetDate);

  const en = alsterLang() === 'en';
  block._targetDate = targetDate; // für Klicks nach dem 15-Uhr-Wechsel
  setReserveLink(block.querySelector('.today-feature-cta .btn-gold'), targetDate, dayDishes(entry).length > 0);
  // Tipp aufs Gericht (oder auf "Ganze Woche ansehen") öffnet das Mittagsmenü
  if (!dishEl.dataset.sheetWired) {
    dishEl.dataset.sheetWired = '1';
    const open = () => openLunchSheet(block._targetDate || new Date());
    [dishEl, sideEl].forEach(el => {
      if (!el) return;
      el.classList.add('is-tappable');
      el.addEventListener('click', open);
    });
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
      : (entry?.holiday !== undefined || !openingFor(targetDate)) ? (en ? 'Closed' : 'Geschlossen')
      : (entry?.closed || noLunchButOpen(entry, targetDate)) ? (en ? 'No lunch' : 'Kein Mittagstisch') : (en ? 'Menu coming soon' : 'Karte folgt');
    if (!heroLunch.dataset.wired) {
      heroLunch.dataset.wired = '1';
      heroLunch.addEventListener('click', () => openLunchSheet(block._targetDate || new Date()));
    }
  }
  // Hero: ruhige Textzeile „Heute mittag: …“ unter der Status-Pille (nicht klebend).
  // Gleiche Daten und gleicher Takt wie die Info-Karte; ausgeblendet ohne Gericht
  // (Schließtag, kein Mittagstisch, Karte folgt). Ein Tipp öffnet das Wochen-Fenster.
  const liveLunch = document.getElementById('live-lunch');
  if (liveLunch) {
    const list = dayDishes(entry);
    if (!list.length) liveLunch.hidden = true;
    else {
      const label = showTomorrow ? (en ? 'Tomorrow:' : 'Morgen mittag:') : (en ? 'Today:' : 'Heute mittag:');
      const names = list.map(d => d.dish).join(en ? ' or ' : ' oder ');
      const labelEl = liveLunch.querySelector('.live-lunch-label');
      const dishEl2 = liveLunch.querySelector('.live-lunch-dish');
      if (labelEl) labelEl.textContent = label;
      if (dishEl2) dishEl2.textContent = names;
      liveLunch.setAttribute('aria-label', `${label} ${names} – ${en ? 'open this week’s menu' : 'Wochenkarte öffnen'}`);
      liveLunch.hidden = false;
      if (!liveLunch.dataset.wired) {
        liveLunch.dataset.wired = '1';
        liveLunch.addEventListener('click', () => openLunchSheet(block._targetDate || new Date()));
      }
    }
  }
  const hintEl = block.querySelector('.today-feature-week');
  if (hintEl) hintEl.textContent = en ? 'See the whole week ›' : 'Ganze Woche ansehen ›';
  if (prefixEl) prefixEl.textContent = showTomorrow ? (en ? 'Tomorrow' : 'Morgen') : (en ? 'Today' : 'Heute');
  if (dayEl)    dayEl.textContent    = dayLabels()[dayIdx];

  setCroqueLink(sideEl || dishEl, false, en);
  if (dayDishes(entry).length) {
    block.dataset.state = 'open';
    if (kickerEl) kickerEl.textContent = showTomorrow
      ? (en ? 'Tomorrow at midday' : 'Morgen mittag bei uns')
      : (en ? 'At midday today' : 'Heute mittag bei uns');
    setDishText(dishEl, { dish: entry.dish, veg: entry.veg }, en);
    if (sideEl) {
      sideEl.textContent = entry.side ? sideText(entry.side, en) : '';
      sideEl.hidden = !entry.side;
    }
    // Hauptgericht leer, nur 2. Gericht eingetragen → das 2. als Hauptgericht zeigen
    if (!String(entry.dish || '').trim()) {
      const only = dayDishes(entry)[0];
      setDishText(dishEl, only, en);
      if (sideEl) { sideEl.textContent = only.side ? sideText(only.side, en) : ''; sideEl.hidden = !only.side; }
    }
    renderAltDish(sideEl || dishEl, entry, en, true);
    renderDishPrices(dishEl, sideEl, entry, weekData, en);
  } else if (noLunchButOpen(entry, targetDate)) {
    // Café hat offen, nur kein Mittagstisch (z. B. Wochenende) – nicht „geschlossen“ sagen
    block.dataset.state = 'closed';
    renderAltDish(sideEl || dishEl, null, en);
    clearLunchFacts(dishEl.parentElement);
    if (kickerEl) kickerEl.textContent = showTomorrow
      ? (en ? 'No lunch menu tomorrow' : 'Morgen kein Mittagstisch')
      : (en ? 'No lunch menu today' : 'Heute kein Mittagstisch');
    const nextLunch = nextLunchDay(targetDate);
    dishEl.textContent = (en ? 'Breakfast, rolls and Croques as usual – all day.' : 'Frühstück, Brötchen und Croques gibt es trotzdem – den ganzen Tag.')
      + (nextLunch ? (en ? ` Lunch is back on ${nextLunch.toLocaleDateString('en-GB', { weekday: 'long' })}.` : ` Mittagstisch wieder ab ${nextLunch.toLocaleDateString('de-DE', { weekday: 'long' })}.`) : '');
    if (sideEl) sideEl.hidden = true;
  } else if (entry?.closed || (!dayDishes(entry).length && !openingFor(targetDate))) {
    block.dataset.state = 'closed';
    renderAltDish(sideEl || dishEl, null, en);
    clearLunchFacts(dishEl.parentElement);
    if (kickerEl) kickerEl.textContent = showTomorrow
      ? (en ? 'Closed tomorrow' : 'Morgen geschlossen')
      : (en ? 'Closed today' : 'Wir machen heute Pause');
    if (entry?.holiday !== undefined || !openingFor(targetDate)) {
      // Schließtag (Urlaub/Feiertag): nächsten Öffnungstag nennen statt pauschal „bis morgen“
      if (kickerEl) kickerEl.textContent = (showTomorrow ? (en ? 'Closed tomorrow' : 'Morgen geschlossen') : (en ? 'Closed today' : 'Heute geschlossen')) + (entry?.holiday ? ' · ' + entry.holiday : '');
      const found = nextOpenDay(targetDate);
      dishEl.textContent = found
        ? (en ? `We are back on ${found.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}.`
              : `Ab ${found.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })} sind wir wieder für Sie da.`)
        : (en ? 'We look forward to seeing you again soon.' : 'Wir freuen uns, Sie bald wieder zu sehen.');
    } else dishEl.textContent = showTomorrow
      ? (en ? 'Back the day after — we look forward to seeing you.' : 'Übermorgen geht es weiter — wir freuen uns auf Sie.')
      : (en ? 'See you tomorrow — we look forward to your visit.' : 'Bis morgen — wir freuen uns auf Sie.');
    if (sideEl) sideEl.hidden = true;
  } else {
    block.dataset.state = 'empty';
    renderAltDish(sideEl || dishEl, null, en);
    clearLunchFacts(dishEl.parentElement);
    if (kickerEl) kickerEl.textContent = showTomorrow
      ? (en ? 'Menu coming soon' : 'Karte folgt in Kürze')
      : (en ? 'Just drop by' : 'Schauen Sie einfach vorbei');
    dishEl.textContent = showTomorrow
      ? (en ? 'Details coming soon.' : 'Eintrag folgt in Kürze.')
      : (en ? 'Fresh rolls, Croques and coffee — all day long.' : 'Frische Brötchen, Croques und Kaffee — den ganzen Tag.');
    if (sideEl) sideEl.hidden = true;
  }
  sizeDishText(dishEl);
  unifyDishSizes(dishEl);
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
  initJobs();
  initGoogleReview();

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
      timeEl.innerHTML = `<span class="clock-text">${escapeHtml(wd)}, ${hh}<span class="clock-colon">:</span>${mm}</span>`;
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

  const tips = document.createElement('div');
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
  // „Erstellt durch Sitalo.de“ wandert ganz nach unten
  const maker = grid.querySelector('.footer-maker');

  // Hours- und Address-Spalten zusammenstellen
  const adresseCol = document.createElement('div');
  adresseCol.className = 'footer-col footer-col-adresse';
  adresseCol.innerHTML = `
    <p class="footer-col-label">Besuch</p>
    <a class="js-route" href="${routeHref()}" target="_blank" rel="noopener">Ifflandstraße 45</a>
    <a class="js-route" href="${routeHref()}" target="_blank" rel="noopener">22087 Hamburg</a>
    <a href="tel:+494022692891">040 – 22 69 28 91</a>
    <a href="mailto:info@alstercafe.de">info@alstercafe.de</a>
  `;

  const hoursCol = document.createElement('div');
  hoursCol.className = 'footer-col footer-col-hours';
  hoursCol.innerHTML = `<p class="footer-col-label">Geöffnet</p><div class="footer-hours-lines"></div>`;

  renderFooterHours(hoursCol);

  // „Folgen Sie uns“: dieselben Adressen wie auf der Kontaktseite, als schlichte Textlinks
  const socialCol = document.createElement('div');
  socialCol.className = 'footer-col footer-col-social';
  socialCol.innerHTML = `
    <p class="footer-col-label">Folgen Sie uns</p>
    <a href="https://www.instagram.com/alstercafe/" target="_blank" rel="noopener noreferrer">Instagram</a>
    <a href="https://www.tripadvisor.de/Restaurant_Review-g187331-d5852030-Reviews-Alstercafe-Hamburg.html" target="_blank" rel="noopener noreferrer">Tripadvisor</a>
    <a class="footer-google-review" href="#" target="_blank" rel="noopener noreferrer" hidden>Google-Bewertung</a>
  `;

  // Neue Reihenfolge: brand | adresse | hours | folgen
  grid.innerHTML = '';
  if (brand) grid.appendChild(brand);
  grid.appendChild(adresseCol);
  grid.appendChild(hoursCol);
  grid.appendChild(socialCol);

  // Nav-Reihe wird unter dem Grid eingesetzt als eigener Block
  if (navHtml) {
    const navWrap = document.createElement('div');
    navWrap.className = 'footer-nav-wrap container';
    navWrap.innerHTML = `
      <p class="footer-col-label" style="margin-bottom:14px">Seiten</p>
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
      `<li class="pay-badge"><span role="img" aria-label="${b.label}" title="${b.label}">${b.svg}</span></li>`).join('')}</ul>
  `;
  footer.appendChild(payWrap);

  // Bottom-Strip: Copyright + Inhaber, dazu dezent die Pflicht-/Service-Links
  // (Impressum, Datenschutz, Cookies, Mitgliederbereich) — der „Index“ zeigt
  // dann nur noch die sechs Seiten des Cafés.
  const year = new Date().getFullYear();
  const strip = document.createElement('div');
  strip.className = 'footer-bottom-strip container';
  // „Erstellt durch Sitalo.de“ gehört zur ©-Zeile – gleiche Schrift, gleiche Dämpfung, kein eigener Block
  strip.innerHTML = `<span class="footer-bottom-meta">© ${year} <em>Alstercafé</em> · Croquenoah Cafe<span class="footer-made"><span class="footer-made-sep" aria-hidden="true">·</span><span class="footer-made-label">Erstellt durch</span> <a href="https://sitalo.de" target="_blank" rel="noopener">Sitalo.de</a></span></span><nav class="footer-legal" aria-label="${alsterLang() === 'en' ? 'Legal' : 'Rechtliches'}"></nav>`;
  footer.appendChild(strip);
  maker?.remove();
  const legal = strip.querySelector('.footer-legal');
  const navEl = footer.querySelector('.footer-nav-wrap .footer-nav');
  ['impressum.html', 'datenschutz.html', '#cookie-reset', 'admin.html'].forEach(sel => {
    const a = sel.startsWith('#') ? navEl?.querySelector(sel) : navEl?.querySelector(`a[href="${sel}"]`);
    if (a) legal.appendChild(a);
  });
  // Seitenliste vervollständigen: Häufig gefragt (FAQ), Webshop (extern); Berliner-Aktion und
  // „Wir suchen Verstärkung“ hängen syncFooterExtras/initJobs nur an, solange sie gelten.
  if (navEl && !navEl.querySelector('a[href="ueber-uns.html#faq"]')) {
    const faq = document.createElement('a');
    faq.href = 'ueber-uns.html#faq'; faq.textContent = 'Häufig gefragt';
    const after = navEl.querySelector('a[href="ueber-uns.html"]');
    after ? after.after(faq) : navEl.appendChild(faq);
    const shop = document.createElement('a');
    shop.href = 'https://croquenoah.simplywebshop.de/storedata/listStore';
    shop.target = '_blank'; shop.rel = 'noopener noreferrer'; shop.className = 'footer-shop-link';
    shop.textContent = 'Webshop';
    navEl.appendChild(shop);
  }
  syncFooterExtras();

  // Marken-Block: statt der Adresse (steht direkt daneben unter „Besuch“) kurz, was wir sind
  const brandP = brand?.querySelector('p');
  if (brandP) brandP.innerHTML = '<strong>Alstercafé</strong><br/>Bäckerei · Café · Mittagstisch';
}

/* „Wir suchen Verstärkung“ (Mitgliederbereich → Hinweis): Schalter aus = nichts zu sehen.
   An: Abschnitt auf „Über uns“ (nach den häufigen Fragen) und eine Zeile in der Fußzeile. */
function jobsData() {
  let j = null;
  try { j = window.alsterDb?.get('jobs'); } catch {}
  if (!j || typeof j !== 'object' || !j.active) return null;
  const text = String(j.text || '').trim();
  if (!text) return null;
  return { title: String(j.title || '').trim() || 'Wir suchen Verstärkung', text };
}
function initJobs() {
  const j = jobsData();
  const en = alsterLang() === 'en';
  // Fußzeile: Zeile in der Seitenliste
  const navEl = document.querySelector('.site-footer .footer-nav-wrap .footer-nav');
  if (navEl) {
    let a = navEl.querySelector('a.footer-jobs');
    if (!j) a?.remove();
    else if (!a) {
      a = document.createElement('a'); a.className = 'footer-jobs'; a.href = 'ueber-uns.html#jobs';
      a.setAttribute('data-no-i18n', '');
      navEl.appendChild(a);
    }
    if (j && a) a.textContent = j.title;
  }
  // „Über uns“: Abschnitt nach den häufigen Fragen
  const faq = document.getElementById('faq');
  if (!faq) return;
  let sec = document.getElementById('jobs');
  if (!j) { sec?.remove(); return; }
  if (!sec) {
    sec = document.createElement('section');
    sec.id = 'jobs'; sec.className = 'section jobs chapter';
    sec.setAttribute('data-chapter', 'III');
    sec.setAttribute('data-no-i18n', '');
    faq.after(sec);
  }
  const paras = j.text.split(/\n{2,}|\n/).map(t => t.trim()).filter(Boolean).map(t => `<p>${escapeHtml(t)}</p>`).join('');
  sec.innerHTML = `
    <span class="chapter-mark" aria-hidden="true">III</span>
    <div class="container jobs-inner">
      <div class="section-head">
        <p class="eyebrow"><span class="num">·</span> ${en ? 'Join our team' : 'Mitarbeiten'}</p>
        <h2>${escapeHtml(j.title)}</h2>
      </div>
      <div class="jobs-text">${paras}</div>
      <p class="jobs-contact">${en ? 'Interested? Get in touch:' : 'Interesse? Sprechen Sie uns an:'} <a href="mailto:info@alstercafe.de">info@alstercafe.de</a> · <a href="tel:+494022692891">040 – 22 69 28 91</a></p>
    </div>`;
}

/* Fußzeile: Link zur Berliner-Aktion nur, solange sie läuft (wird bei Live-Änderungen erneut geprüft) */
function syncFooterExtras() {
  const navEl = document.querySelector('.site-footer .footer-nav-wrap .footer-nav');
  if (!navEl) return;
  let link = navEl.querySelector('a[href="berliner.html"]');
  const { visible } = berlinerState();
  if (!visible) { link?.remove(); return; }
  if (!link) {
    link = document.createElement('a');
    link.href = 'berliner.html'; link.textContent = 'Berliner-Bestellservice';
    const after = navEl.querySelector('a[href="broetchen.html"]');
    after ? after.after(link) : navEl.prepend(link);
  }
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

  // Bewusst KEIN Einblenden der ganzen Seite mehr: <html> von fast unsichtbar
  // auf sichtbar zu animieren verzögerte den ersten sichtbaren Inhalt und zählte
  // für Google als Layout-Verschiebung (CLS ~0,13 auf der Startseite).

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

function renderTodayLunch(weekData, today, isTomorrow = false) {
  const todayBox = document.getElementById('lunch-today');
  const emptyBox = document.getElementById('lunch-empty');
  if (!todayBox || !emptyBox) return;
  const en = alsterLang() === 'en';
  const dayIdx = (today.getDay() + 6) % 7;
  const dayKey = DAY_KEYS[dayIdx];
  const dayLabel = dayLabels()[dayIdx];
  const entry = lunchEntryFor(weekData?.days?.[dayKey], today);
  const dishes = dayDishes(entry);

  // „Heute“ / „Morgen“ vor dem Wochentag – nach Ladenschluss zeigt die Seite morgen
  const prefixEl = document.getElementById('today-prefix');
  if (prefixEl) {
    prefixEl.setAttribute('data-no-i18n', '');
    prefixEl.textContent = isTomorrow ? (en ? 'Tomorrow' : 'Morgen') : (en ? 'Today' : 'Heute');
  }
  const nameEl = document.getElementById('today-name');
  if (nameEl) nameEl.textContent = dayLabel;
  // Die Sätze unten bringen ihre englische Fassung selbst mit → nicht zusätzlich übersetzen
  const emptyText = document.querySelector('.lunch-empty-text');
  if (emptyText) emptyText.setAttribute('data-no-i18n', '');
  const longDay = d => d.toLocaleDateString(en ? 'en-GB' : 'de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  // Wenn die GANZE Woche leer ist: kein Today-Empty-State zeigen,
  // sonst kommt die Info zweimal (heute + Wochenkarte beide leer).
  const days = weekData?.days || {};
  const wholeWeekEmpty = !DAY_KEYS.some(k => dayDishes(days[k]).length || days[k]?.closed);

  if (dishes.length) {
    const dishEl = document.getElementById('today-dish');
    const sideEl = document.getElementById('today-side');
    const first = dishes[0];
    if (dishEl) { setDishText(dishEl, first, en); sizeDishText(dishEl, first.dish); }
    if (sideEl) {
      sideEl.textContent = first.side || '';
      sideEl.hidden = !first.side;
    }
    renderAltDish(sideEl || dishEl, entry, en, false);
    unifyDishSizes(dishEl);
    renderDishPrices(dishEl, sideEl, entry, weekData, en);
    let share = todayBox.querySelector('.lunch-share');
    if (!share) { share = lunchShareButton('light'); todayBox.appendChild(share); }
    setLunchShare(share, dishes, isTomorrow, en);
    setReserveLink(todayBox.querySelector('.btn-gold'), today, true);
    todayBox.hidden = false;
    emptyBox.hidden = true;
  } else if (entry?.holiday !== undefined || !openingFor(today)) {
    // Schließtag (Urlaub/Feiertag) oder Ruhetag laut Öffnungszeiten: Satz wie bisher,
    // dazu der nächste Öffnungstag (gleiche Logik wie auf der Startseite)
    if (emptyText) {
      const lbl = entry?.holiday ? ' – ' + entry.holiday : '';
      let text = isTomorrow
        ? (en ? `We are closed tomorrow${lbl}.` : `Morgen ist das Café geschlossen${lbl}.`)
        : (en ? `We are closed today${lbl}.` : `Heute ist das Café geschlossen${lbl}.`);
      const next = nextOpenDay(today);
      if (next) text += en ? ` We are back on ${longDay(next)}.` : ` Ab ${longDay(next)} sind wir wieder für Sie da.`;
      emptyText.textContent = text;
    }
    clearLunchFacts(todayBox);
    todayBox.hidden = true;
    emptyBox.hidden = false;
  } else if (noLunchButOpen(entry, today)) {
    // Café geöffnet, aber kein Mittagstisch (Wochenende oder im Plan abgehakt) –
    // der vorhandene Satz, ergänzt um den nächsten Tag mit Mittagstisch
    if (emptyText) {
      let text = isTomorrow
        ? (en ? 'Tomorrow we serve breakfast & baked goods — no lunch.' : 'Morgen servieren wir Frühstück & Backwaren — kein Mittagstisch.')
        : (en ? 'Today we serve breakfast & baked goods — no lunch.' : 'Heute servieren wir Frühstück & Backwaren — kein Mittagstisch.');
      const nextLunch = nextLunchDay(today);
      if (nextLunch) text += en
        ? ` Lunch is back on ${nextLunch.toLocaleDateString('en-GB', { weekday: 'long' })}.`
        : ` Mittagstisch wieder ab ${nextLunch.toLocaleDateString('de-DE', { weekday: 'long' })}.`;
      emptyText.textContent = text;
    }
    clearLunchFacts(todayBox);
    todayBox.hidden = true;
    emptyBox.hidden = false;
  } else if (wholeWeekEmpty) {
    // Ganze Woche leer → renderWeekList zeigt schon eine Konsolidierte
    // Karte. Today-Section nicht doppelt zeigen.
    clearLunchFacts(todayBox);
    todayBox.hidden = true;
    emptyBox.hidden = true;
  } else {
    // Heute nicht eingetragen, aber die Woche hat anderswo Eintraege —
    // ehrlich kommunizieren statt "kein Mittagstisch" zu behaupten.
    if (emptyText) emptyText.innerHTML = en
      ? `${isTomorrow ? 'Tomorrow’s' : 'Today’s'} menu is being updated. <a href="tel:+494022692891">040 – 22 69 28 91</a> — we’ll gladly tell you the dish of the day.`
      : `Die ${isTomorrow ? 'Karte für morgen' : 'heutige Karte'} wird gerade aktualisiert. <a href="tel:+494022692891">040 – 22 69 28 91</a> — wir verraten Ihnen das Tagesgericht gern.`;
    clearLunchFacts(todayBox);
    todayBox.hidden = true;
    emptyBox.hidden = false;
  }
}

function renderWeekList(weekData, monday, today) {
  const list = document.getElementById('lunch-week-list');
  if (!list) return;
  list.innerHTML = ''; // entfernt auch den Platzhalter „Wochenkarte wird geladen …“
  list.removeAttribute('aria-busy');

  // Wenn die gesamte Woche leer ist: konsolidierte Info statt 7x "folgt in Kürze"
  const days = weekData?.days || {};
  const hasAnyEntry = DAY_KEYS.some(k => dayDishes(days[k]).length || days[k]?.closed);
  if (!hasAnyEntry) {
    list.classList.add('lunch-week-empty');
    list.classList.remove('lunch-week-compact-weekend');
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

  const en = alsterLang() === 'en';
  // „Vergangen“ meint den echten Kalendertag (nicht den Fokus-Tag „morgen“)
  const todayIso = isoLocal(new Date());
  DAY_KEYS.forEach((key, idx) => {
    const date = new Date(monday); date.setDate(date.getDate() + idx);
    const entry = lunchEntryFor(weekData?.days?.[key], date);
    const dishes = dayDishes(entry);
    const isToday = isSameDay(date, today);
    const past = isoLocal(date) < todayIso;
    const li = document.createElement('li');
    li.className = 'lunch-day'
      + (isToday ? ' is-today' : '')
      + (past ? ' is-past' : '')
      + (idx >= 5 && !dishes.length ? ' is-off' : ''); // leerer Wochenendtag (für die schmale Spalte)
    let body;
    if (entry?.closed) {
      body = `<span class="lunch-closed">${entry.holiday !== undefined ? (en ? 'Closed' : 'Geschlossen') + (entry.holiday ? ' · ' + escapeHtml(entry.holiday) : '') : (en ? 'No lunch today' : 'Kein Mittagstisch')}</span>`;
    } else if (dishes.length) {
      // Jedes Gericht als eigene Gruppe – am Computer stehen zwei Gerichte nebeneinander
      body = dishes.map(d =>
        `<span class="lunch-day-opt"><span class="lunch-day-dish">${escapeHtml(d.dish)}${dietBadgeHtml(d, en)}</span>`
        + (d.side ? `<span class="lunch-day-side">${escapeHtml(d.side)}</span>` : '')
        + (lunchPriceFor(weekData, d) != null ? `<span class="lunch-day-price">${lunchPriceText(lunchPriceFor(weekData, d))}</span>` : '')
        + '</span>'
      ).join(orDividerHtml(en, 'lunch-day-or'));
      if (dishes.length > 1) li.classList.add('has-two');
    } else if (!openingFor(date)) {
      // Ruhetag laut Öffnungszeiten
      body = `<span class="lunch-closed">${en ? 'Closed' : 'Geschlossen'}</span>`;
    } else if (noLunchButOpen(entry, date)) {
      // Café geöffnet, aber kein Mittagstisch (leeres Wochenende) – gleiches Label wie oben
      body = `<span class="lunch-closed">${en ? 'No lunch today' : 'Kein Mittagstisch'}</span>`;
    } else if (past) {
      // Vergangener Werktag ohne Eintrag: nichts mehr ankündigen
      body = `<span class="lunch-pending" aria-hidden="true">—</span><span class="sr-only">${en ? 'No entry' : 'Kein Eintrag'}</span>`;
    } else {
      body = `<span class="lunch-pending">${en ? '— coming soon —' : '— folgt in Kürze —'}</span>`;
    }
    li.innerHTML = `
      <div class="lunch-day-head">
        <span class="lunch-day-name">${dayLabels()[idx]}</span>
        <span class="lunch-day-date">${formatDay(date)}</span>
        ${isToday ? `<span class="lunch-day-now" data-no-i18n="">${isoLocal(date) === todayIso ? (en ? 'Today' : 'Heute') : (en ? 'Tomorrow' : 'Morgen')}</span>` : ''}
      </div>
      <div class="lunch-day-body">${body}</div>
    `;
    list.appendChild(li);
  });
  // Kopfzeile über der Liste: „Diese Woche“ + Kalenderwoche (nur am Computer sichtbar, per CSS)
  let head = list.previousElementSibling?.classList.contains('lunch-week-head') ? list.previousElementSibling : null;
  if (!head) { head = document.createElement('div'); head.className = 'lunch-week-head'; head.setAttribute('data-no-i18n', ''); head.setAttribute('aria-hidden', 'true'); list.before(head); }
  const sundayH = new Date(monday); sundayH.setDate(sundayH.getDate() + 6);
  head.innerHTML = `<span class="lunch-week-head-title">${en ? 'This week' : 'Diese Woche'}</span><span class="lunch-week-head-range">${(en ? 'Week ' : 'KW ') + isoWeek(monday)} · ${formatShort(monday)} – ${formatShort(sundayH)}</span>`;
  // Desktop: Sa und So ohne Gericht stapeln sich schmal in einer sechsten Spalte (CSS)
  list.classList.toggle('lunch-week-compact-weekend',
    !!(list.children[5]?.classList.contains('is-off') && list.children[6]?.classList.contains('is-off')));
}

/* Preis-Helfer für den Brötchen-Service.
   parseEuro: "2,50 €" / "2.5" / 2.5 -> 2.5 (Euro, auf Cent gerundet) oder null.
   formatEuro: 2.5 -> "2,50 €". */
function parseEuro(v) { return window.AlsterRules.parseEuro(v); }
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

  // Abholdatum: Brötchen frühestens morgen (Bestellschluss 18 Uhr am Vortag), Berliner laut Vorlauf
  const dateInput = form.querySelector('input[name="Datum"]');
  const earliestHint = (() => {
    if (!dateInput) return null;
    const row = dateInput.closest('.form-row') || dateInput.closest('label');
    let p = row?.parentElement?.querySelector(':scope > .order-earliest');
    if (!p) { p = document.createElement('p'); p.className = 'order-earliest'; p.setAttribute('aria-live', 'polite'); p.setAttribute('data-no-i18n', ''); row?.before(p); }
    return p;
  })();
  const updateEarliest = () => {
    if (!earliestHint) return;
    const en = alsterLang() === 'en';
    const iso = isBerliner ? (berlinerFirstPickup(berlinerState().st) || '') : broetchenEarliestIso();
    if (!iso) { earliestHint.textContent = ''; earliestHint.hidden = true; return; }
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    const day = openingFor(d);
    const label = d.toLocaleDateString(en ? 'en-GB' : 'de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    const st = isBerliner ? berlinerState().st : null;
    const from = st?.pickupTimeFrom || (day ? formatMin(day.openMin) : '');
    earliestHint.innerHTML = `<strong>${en ? 'Earliest pick-up' : 'Frühestens'}:</strong> ${escapeHtml(label)}${from ? (en ? `, from ${from}` : `, ab ${from} Uhr`) : ''}`
      + (isBerliner ? '' : ` · ${en ? 'Same-day orders by phone only' : 'Für heute nur telefonisch'}: <a href="tel:+494022692891">040 – 22 69 28 91</a>`);
    earliestHint.hidden = false;
  };
  const setDefaultDate = () => {
    if (!dateInput) return;
    if (!isBerliner) dateInput.dataset.earliest = broetchenEarliestIso();
    keepDateMinFresh(dateInput);
    if (!isBerliner) dateInput.value = dateInput.dataset.earliest;
    else { const t = new Date(); t.setDate(t.getDate() + 1); dateInput.value = isoDate(t); }
    dateInput.__dateHintUpdate?.();
    updateEarliest();
  };
  setDefaultDate();
  form.__updateEarliest = updateEarliest;

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

  // Zwischensumme unter der Sorten-Liste (nur am Handy sichtbar, per CSS)
  let tally = sortListEl?.parentElement?.querySelector(':scope > .order-tally');
  if (sortListEl && !tally) { tally = document.createElement('p'); tally.className = 'order-tally'; tally.setAttribute('aria-hidden', 'true'); tally.setAttribute('data-no-i18n', ''); sortListEl.after(tally); }
  // Beleg nach dem Absenden: solange er steht, überschreibt render() die Übersicht nicht
  let receiptActive = false;
  const render = () => {
    if (receiptActive) return;
    const items = getItems();
    const total = items.reduce((s, it) => s + it.qty, 0);
    if (countEl) countEl.textContent = String(total);
    if (tally) {
      const priced = items.filter(it => it.price);
      const sum = priced.reduce((s, it) => s + Math.round(it.price * 100) * it.qty, 0) / 100;
      tally.textContent = total ? `${total} ${unitWord(total, alsterLang() === 'en')}${priced.length ? ' · ' + formatEuro(sum) : ''}` : '';
      tally.hidden = !total;
    }
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
    const bMin = isBerliner ? (parseInt(berlinerSettings().minQty, 10) || 0) : 0;
    const ok = total >= MIN_ORDER && (!bMin || total >= bMin);
    if (minNote && isBerliner && bMin > 1 && total > 0 && total < bMin) {
      minNote.textContent = alsterLang() === 'en' ? `Minimum order: ${bMin} doughnuts (${bMin - total} more).` : `Mindestbestellung: ${bMin} Berliner (noch ${bMin - total}).`;
      minNote.hidden = false; minNote.classList.remove('is-met'); minNote.classList.add('is-below');
    } else if (minNote) {
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
      if (receiptActive) endReceipt();
      render();
    });
  }
  /* Beleg: Auswahl, Summe und Abholzeit bleiben nach dem Absenden sichtbar */
  const card = listEl?.closest('.order-summary-card');
  const endReceipt = () => {
    receiptActive = false;
    card?.classList.remove('is-receipt');
    card?.querySelector('.order-receipt-line')?.remove();
    card?.querySelector('.order-new')?.remove();
    if (status) setFormStatus(status, '');
    form.querySelector('.form-summary')?.remove();
    render();
  };
  const showReceipt = (items, total, pickupDate, pickupTime) => {
    if (!listEl || !card) return;
    const en = alsterLang() === 'en';
    receiptActive = true;
    card.classList.add('is-receipt');
    const priced = items.filter(it => it.price);
    const sum = priced.reduce((s, it) => s + Math.round(it.price * 100) * it.qty, 0) / 100;
    if (countEl) countEl.textContent = String(total);
    listEl.innerHTML = items.map(it => `<li><span>${escapeHtml(it.name)}</span><span class="order-summary-amount"><span class="order-summary-qty">${it.qty}×</span>${it.price ? `<span class="order-summary-price">${formatEuro(it.price * it.qty)}</span>` : ''}</span></li>`).join('')
      + (priced.length ? `<li class="order-summary-total"><span>${en ? 'Total' : 'Summe'}</span><span class="order-summary-price">${formatEuro(sum)}</span></li>` : '');
    const dm = String(pickupDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const when = dm ? new Date(+dm[1], +dm[2] - 1, +dm[3]).toLocaleDateString(en ? 'en-GB' : 'de-DE', { weekday: 'short', day: 'numeric', month: 'short' }) : pickupDate;
    const line = document.createElement('p');
    line.className = 'order-receipt-line'; line.setAttribute('data-no-i18n', '');
    line.textContent = `${en ? 'Pick-up' : 'Abholung'}: ${when}${pickupTime ? ` · ${pickupTime}${en ? '' : ' Uhr'}` : ''}`;
    listEl.after(line);
    if (minNote) { minNote.textContent = ''; minNote.hidden = true; }
    if (submitBtn) submitBtn.disabled = true;
    const again = document.createElement('button');
    again.type = 'button'; again.className = 'order-new'; again.setAttribute('data-no-i18n', '');
    again.textContent = en ? 'New order' : 'Neue Bestellung';
    again.addEventListener('click', () => { endReceipt(); submitBtn?.classList.remove('is-success'); });
    (submitBtn || line).after(again);
  };

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
          // Auch ohne Klammerzusatz zuordnen: die Zeilen im HTML heißen z. B.
          // „Käse (Gouda & Bergkäse)“, die Liste des Inhabers nur „Käse“.
          const baseName = (n) => String(n || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
          const keep = Object.create(null);
          getRows().forEach(row => {
            const q = parseInt(row.querySelector('.qty-value')?.textContent, 10) || 0;
            if (q <= 0) return;
            keep[row.dataset.name] = q;
            const base = baseName(row.dataset.name);
            if (!(base in keep)) keep[base] = q;
          });
          sortListEl.innerHTML = html;
          sortListEl.dataset.sortsHtml = html;
          getRows().forEach(row => {
            const q = keep[row.dataset.name] || keep[baseName(row.dataset.name)];
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
    clearFieldErrors(form);
    // Fehler: Statuszeile füllen, Feld markieren, Statuszeile ins Bild holen
    const fail = (msg, fieldName) => {
      setFormStatus(status, msg, 'error');
      if (fieldName) showFieldError(fieldFor(form, fieldName), msg);
      revealStatus(status);
      if (submitBtn) submitBtn.disabled = false;
    };
    if (isBerliner && !berlinerState().visible) {
      fail(en ? 'Pre-orders are currently closed.' : 'Die Berliner-Vorbestellung ist gerade nicht geöffnet.');
      return;
    }
    if (total < MIN_ORDER) {
      fail(isBerliner
        ? (en ? 'Please select at least one doughnut.' : 'Bitte wählen Sie mindestens einen Berliner.')
        : (en ? 'Please select at least one roll.' : 'Bitte wählen Sie mindestens ein Brötchen.'));
      return;
    }
    if (!isBerliner) {
      // Bestellschluss 18 Uhr am Vortag: frühester Abholtag laut broetchenEarliestIso()
      const d = form.querySelector('input[name="Datum"]')?.value || '';
      const earliest = broetchenEarliestIso();
      if (d && d < earliest) {
        fail(en ? `Online orders close at 6 pm the day before. The earliest pick-up day is ${formatDateLong(earliest, true)} – for today, please call us: 040 – 22 69 28 91.`
                : `Online-Bestellungen bis 18 Uhr am Vortag – der früheste Abholtag ist ${formatDateLong(earliest)}. Für heute rufen Sie uns bitte an: 040 – 22 69 28 91.`, 'Datum');
        return;
      }
    }
    if (isBerliner) {
      const { st } = berlinerState();
      const d = form.querySelector('input[name="Datum"]')?.value || '';
      const t = form.querySelector('input[name="Uhrzeit"]')?.value || '';
      const min = parseInt(st.minQty, 10);
      if (min > 1 && total < min) {
        fail(en ? `Please order at least ${min} doughnuts.` : `Bitte bestellen Sie mindestens ${min} Berliner.`);
        return;
      }
      const lead = berlinerLead(st);
      if (lead > 0 && d && d < addDaysIso(isoLocal(new Date()), lead)) {
        fail(en ? `Please order at least ${lead} day${lead > 1 ? 's' : ''} before pick-up.` : `Bitte ${lead === 1 ? 'einen Tag' : lead + ' Tage'} vor der Abholung bestellen – der früheste Abholtag ist ${formatDateLong(berlinerFirstPickup(st) || addDaysIso(isoLocal(new Date()), lead))}.`, 'Datum');
        return;
      }
      if (t && ((st.pickupTimeFrom && t < st.pickupTimeFrom) || (st.pickupTimeTo && t > st.pickupTimeTo))) {
        fail(en ? `Pick-up is possible between ${st.pickupTimeFrom || ''} and ${st.pickupTimeTo || ''}.` : `Abholung ist zwischen ${st.pickupTimeFrom || '…'} und ${st.pickupTimeTo || '…'} Uhr möglich.`, 'Uhrzeit');
        return;
      }
      if ((st.pickupFrom && d < st.pickupFrom) || (st.pickupTo && d > st.pickupTo)) {
        const a = formatDateLong(st.pickupFrom || st.pickupTo, en), b = formatDateLong(st.pickupTo || st.pickupFrom, en);
        const range = a === b ? a : `${a} – ${b}`;
        fail(en ? `Pick-up is possible on ${range}.` : `Abholung ist möglich: ${range}.`, 'Datum');
        return;
      }
    }
    if (!form.checkValidity()) {
      const msg = invalidFieldMessage(form, en);
      setFormStatus(status, msg, 'error'); showFieldError(form.__badField, msg);
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    const slotInfo = slotProblemInfo(form.querySelector('input[name="Datum"]')?.value, form.querySelector('input[name="Uhrzeit"]')?.value, en);
    if (slotInfo) {
      fail(slotInfo.msg, slotInfo.field);
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
      // Beleg zuerst (Auswahl, Summe, Abholzeit bleiben sichtbar), dann das Formular leeren
      const snapshot = items.map(it => ({ ...it }));
      try { form.reset(); } catch {}
      getRows().forEach(row => { const v = row.querySelector('.qty-value'); if (v) v.textContent = '0'; row.classList.remove('is-active'); });
      setDefaultDate();
      if (isBerliner) initBerlinerPage();
      render();
      showReceipt(snapshot, total, entry.pickupDate, entry.pickupTime);
      revealStatus(status);
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
function slotProblem(dateStr, timeStr, en) { return slotProblemInfo(dateStr, timeStr, en)?.msg || null; }
function slotProblemInfo(dateStr, timeStr, en) {
  const dm = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = String(timeStr || '').match(/^(\d{1,2}):(\d{2})/);
  if (!dm || !tm) return null; // Pflichtfeld-Prüfung übernimmt der Browser
  const d = new Date(+dm[1], +dm[2] - 1, +dm[3]);
  const minutes = parseInt(tm[1], 10) * 60 + parseInt(tm[2], 10);
  const now = new Date();
  const dateLabel = d.toLocaleDateString(en ? 'en-GB' : 'de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  if (isoLocal(d) < isoLocal(now) || (isoLocal(d) === isoLocal(now) && minutes <= now.getHours() * 60 + now.getMinutes())) {
    return { field: isoLocal(d) < isoLocal(now) ? 'Datum' : 'Uhrzeit', msg: en ? 'This time is already in the past. Please choose a later time.'
              : 'Diese Uhrzeit liegt schon in der Vergangenheit. Bitte wählen Sie eine spätere Zeit.' };
  }
  const hol = holidayOn(d);
  if (hol) {
    const why = hol.label ? ` (${holidayLabel(hol.label)})` : '';
    return { field: 'Datum', msg: en ? `We are closed on ${dateLabel}${why}. Please choose another day.`
              : `Am ${dateLabel} haben wir geschlossen${why}. Bitte wählen Sie einen anderen Tag.` };
  }
  const day = openingFor(d);
  if (!day) {
    return { field: 'Datum', msg: en ? `We are closed on ${dateLabel}. Please choose another day.`
              : `Am ${dateLabel} haben wir geschlossen. Bitte wählen Sie einen anderen Tag.` };
  }
  if (minutes < day.openMin || minutes >= day.closeMin) {
    const range = `${formatMin(day.openMin)} – ${formatMin(day.closeMin)}`;
    return { field: 'Uhrzeit', msg: en ? `On ${dateLabel} we are open ${range}. Please choose a time within our opening hours.`
              : `Am ${dateLabel} haben wir von ${formatMin(day.openMin)} bis ${formatMin(day.closeMin)} Uhr geöffnet. Bitte wählen Sie eine Uhrzeit in diesem Zeitraum.` };
  }
  return null;
}
/* Frühester Abholtag für den Brötchen-Service: Bestellschluss 18 Uhr am Vortag
   (Entscheidung des Inhabers). Vor 18 Uhr = morgen, danach = übermorgen; Schließtage
   werden übersprungen. */
const BROETCHEN_CUTOFF_MIN = 18 * 60;
function broetchenEarliestIso() {
  const now = new Date();
  let d = new Date(now); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((now.getHours() * 60 + now.getMinutes()) >= BROETCHEN_CUTOFF_MIN ? 2 : 1));
  for (let i = 0; i < 31; i++) {
    if (!holidayOn(d) && openingFor(d)) return isoDate(d);
    d.setDate(d.getDate() + 1);
  }
  return isoDate(d);
}
// Hält "frühestens heute" aktuell (Seite kann über Mitternacht offen sein).
function keepDateMinFresh(input) {
  if (!input) return;
  // Berliner-Seite: frühester Abholtag (Vorlauf) liegt in dataset.berlinerMin
  const refresh = () => { input.min = input.dataset.berlinerMin || input.dataset.earliest || isoDate(new Date()); };
  refresh();
  input.addEventListener('focus', refresh);
}

function initReservationForm() {
  const form = document.getElementById('reservation-form');
  if (!form) return;
  const status = form.querySelector('.form-status');
  const dateInput = form.querySelector('input[name="Datum"]');
  const timeSel = form.querySelector('select[name="Uhrzeit"]');
  const setDefaultDate = () => {
    if (!dateInput) return;
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    keepDateMinFresh(dateInput);
    if (!dateInput.value) dateInput.value = isoDate(tomorrow);
    dateInput.__dateHintUpdate?.();
    buildTimeSlots(timeSel, dateInput.value);
  };
  setDefaultDate();
  // Vorbelegung aus dem Mittagstisch (?datum=JJJJ-MM-TT&zeit=12:00) – nur gültige, künftige Werte
  try {
    const q = new URLSearchParams(location.search);
    const d = q.get('datum') || '', t = q.get('zeit') || '';
    const dm = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const dt = dm ? new Date(+dm[1], +dm[2] - 1, +dm[3]) : null;
    if (dateInput && dt && !isNaN(dt) && isoDate(dt) === d && d >= isoDate(new Date())) {
      dateInput.value = d;
      dateInput.__dateHintUpdate?.();
      buildTimeSlots(timeSel, d);
      // Uhrzeit nur wählen, wenn dieser Platz an dem Tag noch angeboten wird
      if (timeSel && /^\d{2}:\d{2}$/.test(t) && timeSel.querySelector(`option[value="${t}"]`)) timeSel.value = t;
    }
  } catch (e) { /* ohne Vorbelegung weiter */ }
  if (dateInput && timeSel) {
    const rebuild = () => buildTimeSlots(timeSel, dateInput.value);
    ['input', 'change'].forEach(ev => dateInput.addEventListener(ev, rebuild));
    timeSel.addEventListener('focus', rebuild);
    dateInput.__slotsUpdate = rebuild;
  }
  // Erfolgs-Zustand und Zusammenfassung verschwinden bei der nächsten Eingabe
  form.addEventListener('input', () => { form.querySelector('.form-submit')?.classList.remove('is-success'); form.querySelector('.form-summary')?.remove(); });
  const submitBtn = form.querySelector('.form-submit');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    // Sofort gegen Doppel-Submit sperren — vor jeder weiteren Logik,
    // sonst koennte ein Doppel-Tap zwei Reservierungen anlegen.
    if (submitBtn?.disabled) return;
    if (submitBtn) submitBtn.disabled = true;
    const en = alsterLang() === 'en';
    clearFieldErrors(form);
    form.querySelector('.form-summary')?.remove();
    const dVal = form.querySelector('[name="Datum"]')?.value, tVal = form.querySelector('[name="Uhrzeit"]')?.value;
    // Ohne wählbare Uhrzeit (Schließtag / Tag vorbei) zuerst die passende Datums-Meldung
    const noSlots = timeSel && !timeSel.querySelector('option[value]:not([value=""])');
    if (noSlots && dVal) {
      const info = slotProblemInfo(dVal, '12:00', en) || { field: 'Datum', msg: en ? 'No times are available on this day. Please choose another day.' : 'An diesem Tag ist keine Uhrzeit mehr frei. Bitte wählen Sie einen anderen Tag.' };
      setFormStatus(status, info.msg, 'error'); showFieldError(fieldFor(form, info.field), info.msg); revealStatus(status);
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    if (!form.checkValidity()) {
      const msg = invalidFieldMessage(form, en);
      setFormStatus(status, msg, 'error'); showFieldError(form.__badField, msg);
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    const slotInfo = slotProblemInfo(dVal, tVal, en);
    if (slotInfo) {
      setFormStatus(status, slotInfo.msg, 'error'); showFieldError(fieldFor(form, slotInfo.field), slotInfo.msg); revealStatus(status);
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
      // Datum steht nach dem Zurücksetzen wieder auf morgen, Hinweis und Uhrzeiten passen dazu
      setDefaultDate();
      // Kurze Zusammenfassung der Anfrage unter der Erfolgsmeldung
      const dm = entry.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (dm && status) {
        const when = new Date(+dm[1], +dm[2] - 1, +dm[3]).toLocaleDateString(en ? 'en-GB' : 'de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
        const sum = document.createElement('p');
        sum.className = 'form-summary';
        sum.setAttribute('data-no-i18n', '');
        const persons = en ? entry.persons.replace(/^(\d+) Person(en)?$/, (_, n) => `${n} ${n === '1' ? 'person' : 'people'}`).replace(/^mehr als 8 Personen$/, 'more than 8 people') : entry.persons;
        sum.textContent = `${when} · ${entry.time}${en ? '' : ' Uhr'} · ${persons}`;
        const route = document.createElement('a');
        route.className = 'js-route'; route.href = routeHref(); route.target = '_blank'; route.rel = 'noopener';
        route.textContent = en ? 'Get directions →' : 'Route planen →';
        sum.append(' · ', route);
        status.after(sum);
      }
      revealStatus(status);
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
/* Statuszeile ins Bild holen (am Handy liegt sie sonst unter dem Knopf außerhalb des Sichtfelds) */
function revealStatus(el) {
  if (!el) return;
  try { el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' }); } catch (e) {}
}
/* Fehlermeldung zusätzlich direkt am Feld (gleicher Wortlaut wie in der Statuszeile).
   Als <small> im Label, damit die label > span-Stile unberührt bleiben; verschwindet
   bei der nächsten Eingabe. */
function clearFieldErrors(form) {
  if (!form) return;
  form.querySelectorAll('.field-error').forEach(el => el.remove());
  form.querySelectorAll('[aria-invalid="true"]').forEach(f => {
    f.removeAttribute('aria-invalid');
    const ids = (f.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && !id.startsWith('fe-'));
    if (ids.length) f.setAttribute('aria-describedby', ids.join(' ')); else f.removeAttribute('aria-describedby');
  });
}
let fieldErrorSeq = 0;
function showFieldError(field, msg) {
  if (!field || !msg) return;
  const label = field.closest('label');
  if (!label) return;
  label.querySelector('.field-error')?.remove();
  const small = document.createElement('small');
  small.className = 'field-error';
  small.id = 'fe-' + (++fieldErrorSeq);
  small.setAttribute('aria-hidden', 'true'); // die Statuszeile (aria-live) liest die Meldung bereits vor
  small.setAttribute('data-no-i18n', '');
  small.textContent = msg;
  label.appendChild(small);
  field.setAttribute('aria-invalid', 'true');
  const ids = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
  ids.push(small.id);
  field.setAttribute('aria-describedby', ids.join(' '));
  const clear = () => {
    small.remove();
    field.removeAttribute('aria-invalid');
    const rest = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== small.id);
    if (rest.length) field.setAttribute('aria-describedby', rest.join(' ')); else field.removeAttribute('aria-describedby');
  };
  ['input', 'change'].forEach(ev => field.addEventListener(ev, clear, { once: true }));
}
/* Feld, das zu einer Datum/Uhrzeit-Meldung gehört (für die Meldung am Feld) */
function fieldFor(form, name) { return form?.querySelector(`[name="${name}"]`) || null; }

/* Reservierung: Uhrzeit als Auswahl aus den Öffnungszeiten des gewählten Tages
   (15-Minuten-Schritte, letzter Platz eine Stunde vor Ladenschluss, heute nur
   Zeiten mindestens 30 Minuten in der Zukunft). Nichts ist vorbelegt. */
const RES_LAST_SLOT_GAP = 60; // letzte Online-Reservierung eine Stunde vor Ladenschluss (Inhaber: 14:00 bei Schluss 15:00)
function buildTimeSlots(select, dateStr) {
  if (!select) return;
  const en = alsterLang() === 'en';
  const keep = select.value;
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const opts = [`<option value="">${en ? 'Please choose' : 'Bitte wählen'}</option>`];
  let slots = [];
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    const day = holidayOn(d) ? null : openingFor(d);
    if (day) {
      const now = new Date();
      const today = isoLocal(d) === isoLocal(now);
      const minToday = now.getHours() * 60 + now.getMinutes() + 30;
      for (let t = Math.ceil(day.openMin / 15) * 15; t <= day.closeMin - RES_LAST_SLOT_GAP; t += 15) {
        if (today && t < minToday) continue;
        slots.push(t);
      }
    }
  }
  if (m && !slots.length) opts.length = 0, opts.push(`<option value="">${en ? 'Closed' : 'Geschlossen'}</option>`);
  slots.forEach(t => opts.push(`<option value="${formatMin(t)}">${formatMin(t)}${en ? '' : ' Uhr'}</option>`));
  select.innerHTML = opts.join('');
  select.setAttribute('data-no-i18n', '');
  if (keep && slots.some(t => formatMin(t) === keep)) select.value = keep;
}

/* Benennt das erste ungültige Pflichtfeld, springt hin und liefert eine
   klare, sprachbewusste Meldung. Von beiden Formularen genutzt. Am Handy
   wichtig, weil iOS-Safari oft keine native Hinweisblase zeigt. */
function invalidFieldMessage(form, en) {
  // Nur echte Formularfelder — NICHT <form>/<fieldset>, die :invalid ebenfalls
  // matchen können (sonst landet man beim Fieldset statt beim leeren Feld).
  const bad = form.querySelector('input:invalid, select:invalid, textarea:invalid');
  form.__badField = bad || null;
  if (!bad) return en ? 'Please check your entries.' : 'Bitte prüfen Sie Ihre Eingaben.';
  const lbl = (bad.closest('label')?.querySelector('span')?.textContent) || '';
  const feld = lbl.replace(/\*/g, '').trim() || bad.name || (en ? 'field' : 'Feld');
  try { bad.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
  try { bad.focus({ preventScroll: true }); } catch (e) {}
  if (bad.type === 'checkbox') return en ? 'Please tick the consent box below.' : 'Bitte unten das Häkchen zur Einverständnis setzen.';
  if (bad.validity && bad.validity.valueMissing) return en ? `Please fill in “${feld}”.` : `Bitte „${feld}“ ausfüllen.`;
  if (bad.type === 'email') return en ? 'Please enter a valid email address (e.g. name@mail.com).' : 'Bitte eine gültige E-Mail-Adresse eingeben (z. B. name@mail.de).';
  return en ? `Please check “${feld}”.` : `Bitte „${feld}“ prüfen.`;
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

/* Facelift 4: Lichtkegel auf Karten folgt der Maus (nur echte Maus, ohne reduzierte Bewegung) */
(function initCardSpotlight() {
  if (document.body && document.body.classList.contains('admin-body')) return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const run = () => {
    document.querySelectorAll('.spread-card, .reviews-card').forEach(card => {
      if (card.classList.contains('has-spot')) return;
      const s = document.createElement('span');
      s.className = 'spot-light'; s.setAttribute('aria-hidden', 'true');
      card.prepend(s); card.classList.add('has-spot');
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }, { passive: true });
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(run, 400));
  else setTimeout(run, 400);
})();

/* Neuer Effekt: warmes Licht folgt der Maus in den dunklen Kapiteln (nur echte Maus, ohne reduzierte Bewegung) */
(function initChapterGlow() {
  if (document.body && document.body.classList.contains('admin-body')) return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const run = () => {
    document.querySelectorAll('.chapter-dark').forEach(sec => {
      if (sec.querySelector(':scope > .chapter-glow')) return;
      const glow = document.createElement('span');
      glow.className = 'chapter-glow'; glow.setAttribute('aria-hidden', 'true');
      sec.prepend(glow);
      let raf = 0, x = 0, y = 0;
      sec.addEventListener('pointermove', e => {
        const r = sec.getBoundingClientRect(); x = e.clientX - r.left; y = e.clientY - r.top;
        if (!raf) raf = requestAnimationFrame(() => { raf = 0; glow.style.setProperty('--gx', x + 'px'); glow.style.setProperty('--gy', y + 'px'); });
        sec.classList.add('is-lit');
      }, { passive: true });
      sec.addEventListener('pointerleave', () => sec.classList.remove('is-lit'), { passive: true });
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(run, 300));
  else setTimeout(run, 300);
})();

/* Facelift 5: Goldstaub in dunklen Kapiteln + Tasse im Kopf folgt leicht der Maus */
(function initGoldDustAndParallax() {
  if (document.body && document.body.classList.contains('admin-body')) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const run = () => {
    // Goldstaub: am Computer sieben Punkte, am Handy vier (ruhig)
    const dustCount = matchMedia('(min-width: 981px)').matches ? 7 : 4;
    document.querySelectorAll('.chapter-dark').forEach(sec => {
      if (sec.querySelector(':scope > .gold-dust')) return;
      const box = document.createElement('div');
      box.className = 'gold-dust'; box.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < dustCount; i++) {
        const p = document.createElement('i');
        p.style.setProperty('--x', (6 + Math.random() * 88).toFixed(1) + '%');
        p.style.setProperty('--s', (2 + Math.random() * 2).toFixed(1) + 'px');
        p.style.setProperty('--d', (16 + Math.random() * 10).toFixed(1) + 's');
        p.style.setProperty('--dl', (-Math.random() * 26).toFixed(1) + 's');
        box.appendChild(p);
      }
      sec.prepend(box);
    });
    const art = document.querySelector('.hero-cinematic > .hero-art');
    if (!art || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    // Tasse folgt der Maus nur minimal und weich (Trägheit statt Ruckeln)
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const tick = () => {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      const lift = Math.min(window.scrollY, 600) * -0.04;
      art.style.transform = `translate3d(${cx.toFixed(2)}px, ${(cy + lift).toFixed(2)}px, 0)`;
      raf = (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) ? requestAnimationFrame(tick) : 0;
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(tick); };
    window.addEventListener('pointermove', e => {
      tx = (e.clientX / window.innerWidth - 0.5) * 8;
      ty = (e.clientY / window.innerHeight - 0.5) * 6;
      queue();
    }, { passive: true });
    window.addEventListener('scroll', queue, { passive: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(run, 300));
  else setTimeout(run, 300);
})();

/* Facelift 8: Dauer-Animationen (Dampf, Ticker, Goldstaub, Lichtschein …)
   anhalten, solange ihr Abschnitt nicht zu sehen ist — spart Rechenzeit und
   Akku am Handy. Sichtbar ändert sich nichts: 150 px vor dem Hereinscrollen
   laufen sie wieder an. Die Pause setzt die Klasse .anim-paused (styles.css).
   Hintergrund-Tabs halten Browser ohnehin selbst an. */
(function initPauseOffscreenAnimations() {
  if (document.body && document.body.classList.contains('admin-body')) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;
  const run = () => {
    const targets = document.querySelectorAll('.hero-cinematic, .landing-closer, .chapter-dark, .page-hero-editorial');
    if (!targets.length) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => e.target.classList.toggle('anim-paused', !e.isIntersecting));
    }, { rootMargin: '150px 0px' });
    targets.forEach(el => io.observe(el));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();

/* Facelift 6: Stückzahl der Bestellung „springt“, wenn sie sich ändert */
(function initOrderCountPop() {
  const run = () => {
    const el = document.getElementById('order-count');
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let last = el.textContent;
    new MutationObserver(() => {
      if (el.textContent === last) return;
      last = el.textContent;
      el.classList.remove('is-pop'); void el.offsetWidth; el.classList.add('is-pop');
    }).observe(el, { childList: true, characterData: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();

/* Neue Effekte, Runde 2: Glanz beim Hereinscrollen, Zeilen-Kaskade, Laufband
   reagiert aufs Scrollen, Tipp-Welle, leichte 3D-Neigung. Alles nur bei
   erlaubter Bewegung und nie im Mitgliederbereich. */
(function initEffectsRound2() {
  if (document.body && document.body.classList.contains('admin-body')) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const hasIO = 'IntersectionObserver' in window;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Hauptknöpfe glänzen einmal, wenn sie ins Bild kommen
  const shineIO = hasIO ? new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      shineIO.unobserve(e.target);
      setTimeout(() => {
        e.target.classList.add('fx-shine');
        setTimeout(() => e.target.classList.remove('fx-shine'), 1400);
      }, 350);
    });
  }, { threshold: 0.9 }) : null;

  // Listen blenden Zeile für Zeile ein. Markiert wird nur, was noch unter dem
  // Sichtfeld liegt — Sichtbares bleibt unangetastet (kein Aufblitzen).
  const ROWS = '.karte-list > li, .lunch-week > li, .reviews-card, #hours-list > li, .broetchen-row, .faq-item, .footer-hours-lines .footer-line';
  const rowIO = hasIO ? new IntersectionObserver(entries => {
    const hits = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    hits.forEach((e, i) => {
      const el = e.target;
      rowIO.unobserve(el);
      const d = Math.min(i * 55, 440);
      el.style.setProperty('--fx-d', d + 'ms');
      el.classList.add('fx-row-in');
      setTimeout(() => { el.classList.remove('fx-row', 'fx-row-in'); el.style.removeProperty('--fx-d'); }, d + 900);
    });
  }, { rootMargin: '0px 0px -5% 0px', threshold: 0 }) : null;

  const scan = () => {
    if (shineIO) document.querySelectorAll('.btn-primary, .btn-gold, .btn-stamp').forEach(b => {
      if (b.dataset.fxShine || b.closest('.hero-cta')) return;
      b.dataset.fxShine = '1'; shineIO.observe(b);
    });
    if (rowIO) {
      const vh = window.innerHeight;
      document.querySelectorAll(ROWS).forEach(el => {
        if (el.dataset.fxRow) return;
        el.dataset.fxRow = '1';
        if (el.getBoundingClientRect().top < vh * 0.96) return;
        el.classList.add('fx-row'); rowIO.observe(el);
      });
    }
    // Karten wachsen beim Hereinscrollen an ihren Platz – nur, was beim Laden noch unter dem Bildschirm liegt
    document.querySelectorAll('.spread-card, .reviews-cta-grid, .karte-block, .contact-info-block, .map-card, .home-broetchen-wrap .container, .landing-greeting .container').forEach(el => {
      if (el.dataset.fxGrow) return;
      el.dataset.fxGrow = '1';
      if (el.getBoundingClientRect().top > window.innerHeight * 1.02) el.classList.add('fx-grow');
    });
    // Ofenwärme in den dunklen Kapiteln
    document.querySelectorAll('.chapter-dark').forEach(sec => {
      if (sec.querySelector(':scope > .fx-ember')) return;
      const ember = document.createElement('span');
      ember.className = 'fx-ember'; ember.setAttribute('aria-hidden', 'true');
      sec.prepend(ember);
    });
    if (finePointer) document.querySelectorAll('.spread-card-hero, .hero-coord').forEach(card => {
      if (card.classList.contains('fx-tilt')) return;
      card.classList.add('fx-tilt');
      let raf = 0, rx = 0, ry = 0;
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        ry = ((e.clientX - r.left) / r.width - 0.5) * 5;
        rx = (0.5 - (e.clientY - r.top) / r.height) * 4;
        if (!raf) raf = requestAnimationFrame(() => {
          raf = 0;
          card.style.setProperty('--tx', rx.toFixed(2) + 'deg');
          card.style.setProperty('--ty', ry.toFixed(2) + 'deg');
        });
      }, { passive: true });
      card.addEventListener('pointerleave', () => { card.style.setProperty('--tx', '0deg'); card.style.setProperty('--ty', '0deg'); }, { passive: true });
    });
  };

  // Tipp-Welle: weiches Licht breitet sich vom Berührungspunkt aus
  document.addEventListener('pointerdown', e => {
    const btn = e.target.closest && e.target.closest('.btn-primary, .btn-gold, .btn-stamp');
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'fx-ripple'; dot.setAttribute('aria-hidden', 'true');
    dot.style.setProperty('--rx', (e.clientX - r.left) + 'px');
    dot.style.setProperty('--ry', (e.clientY - r.top) + 'px');
    btn.appendChild(dot);
    setTimeout(() => dot.remove(), 800);
  }, { passive: true });

  // Laufband im Kopf wird beim Scrollen kurz schneller und beruhigt sich wieder
  const initTicker = () => {
    const track = document.querySelector('.hero-ticker-track');
    if (!track || !track.getAnimations) return;
    let boost = 1, raf = 0, lastY = window.scrollY;
    const tick = () => {
      const anim = track.getAnimations()[0];
      if (!anim) { raf = 0; return; }
      boost += (1 - boost) * 0.07;
      if (boost < 1.03) { anim.playbackRate = 1; raf = 0; return; }
      anim.playbackRate = boost;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('scroll', () => {
      const y = window.scrollY, v = Math.abs(y - lastY); lastY = y;
      if (y > window.innerHeight * 1.4) return;
      boost = Math.min(6, Math.max(boost, 1 + v / 10));
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
  };

  const run = () => { scan(); initTicker(); [900, 2200, 4000].forEach(t => setTimeout(scan, t)); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(run, 350));
  else setTimeout(run, 350);
})();

/* FX · Dampf: echter, langsam aufsteigender Dampf (kleiner WebGL-Shader) über den gezeichneten Tassen.
   Ersetzt dort die gestrichelten Dampflinien – aber nur, wenn er wirklich läuft. Ohne WebGL, bei
   „Bewegung reduzieren“, im Datensparmodus und im Adminbereich bleibt alles exakt wie bisher.
   Sparsam: kleine Zeichenfläche, höchstens ~30 Bilder/s, nur solange sichtbar und der Tab offen ist. */
(function fxDampf() {
  'use strict';
  if (!window.matchMedia || !window.requestAnimationFrame || !('IntersectionObserver' in window)) return;
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mqReduce.matches) return;
  var net = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (net && net.saveData) return;
  if (navigator.deviceMemory && navigator.deviceMemory < 2) return;

  // Wo Dampf aufsteigt. „drop“: wie weit (in Zeichnungs-Einheiten) unter dem Anfang der
  // gezeichneten Dampflinien der Dampf entsteht (bei der Tasse: an der Kaffee-Oberfläche).
  var TARGETS = [
    { sel: '.hero-cinematic > .hero-art', drop: 19, delay: 1.1 },
    { sel: '.landing-closer .closer-art', drop: 19, delay: 0.7 },
    { sel: '.page-hero-editorial > .page-art', drop: 7, delay: 1.1, soft: 0.86 }
  ];
  var MAX_CANVAS = 2, MAX_PIXELS = 70000, frameMs = 31;

  var VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';
  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform sampler2D uN;',
    'uniform vec2 uRes;',
    'uniform vec4 uGeo;',   // Ursprung x/y (px), Höhe der Fahne (px), halbe Breite am Fuß (Anteil der Höhe)
    'uniform vec4 uPh;',    // zwei Schwingphasen, zwei Aufstiegs-Versätze
    'uniform vec4 uDyn;',   // dritter Versatz, Neigung, Stärke (0..1), größte Deckkraft
    'uniform vec3 uCa;',
    'uniform vec3 uCb;',
    'vec2 n2(vec2 p){',
    '  vec2 i=floor(p),f=fract(p);',
    '  f=f*f*(3.0-2.0*f);',
    '  return texture2D(uN,(i+f+0.5)/64.0).rg;',
    '}',
    'void main(){',
    '  vec2 uv=gl_FragCoord.xy/uRes;',
    '  vec2 s=(gl_FragCoord.xy-uGeo.xy)/uGeo.z;',
    '  float h=s.y;',
    '  float gain=uDyn.z;',
    '  float hh=clamp(h,0.0,1.0);',
    '  float hn=clamp(h/mix(0.36,1.0,gain),0.0,1.0);',
    // Mittellinie: neigt sich mit der Höhe, schwingt sacht wie eine aufsteigende Welle
    '  float cx=uDyn.y*hh*hh*0.40',
    '    +sin(h*3.4-uPh.x)*0.036*hh',
    '    +sin(h*7.1-uPh.y+1.7)*0.014*hh;',
    '  vec2 q=vec2(s.x-cx,h);',
    // unten ruhig (laminar), nach oben zunehmend verwirbelt
    '  float turb=smoothstep(0.03,0.78,hh);',
    '  vec2 w1=n2(q*vec2(3.1,2.3)+vec2(1.7,-uPh.z))-0.5;',
    '  vec2 w2=n2(q*vec2(7.3,5.1)+vec2(8.2,-uPh.w)+w1*0.9)-0.5;',
    '  vec2 r=q+(w1*0.21+w2*0.08)*(0.16+turb);',
    // Fahne: am Rand der Tasse schmal, wird nach oben breiter
    '  float wd=uGeo.w*(1.0-0.2*smoothstep(0.0,0.22,hh))+0.165*pow(hh,1.25);',
    '  float x2=r.x*r.x;',
    '  float env=exp(-x2/(wd*wd));',
    '  float envR=exp(-x2/(wd*wd*1.8));',
    // Rauschfeld: in Strömungsrichtung gestreckt, wandert mit nach oben (zwei unabhängige Kanäle)
    '  vec2 u=r*vec2(5.3,2.05)+vec2(0.0,-uDyn.x);',
    '  vec2 nn=n2(u)*0.6+n2(u*2.0+vec2(13.3,7.7))*0.28+n2(u*4.0+vec2(5.1,21.9))*0.12;',
    // feine Dampffäden entlang der Höhenlinien des Feldes + ein zarter Schleier als Körper
    '  vec2 rb=smoothstep(vec2(0.066),vec2(0.0),abs(nn-vec2(0.61,0.40)));',
    '  float rib=(rb.x*rb.x+rb.y*rb.y*0.55)*envR;',
    '  float veil=env*mix(1.0,smoothstep(0.3,0.72,nn.x*0.6+nn.y*0.4),0.25+0.75*turb);',
    '  float rise=smoothstep(0.0,0.09,h);',
    '  float thin=pow(1.0-hn,1.2);',
    '  float sp=pow(uGeo.w/wd,0.45);',
    '  float d=(veil*0.44+rib*0.7)*rise*thin*sp;',
    // weiches Auslaufen an allen Kanten der Zeichenfläche – nie ein Rechteck
    '  float edge=smoothstep(0.0,0.17,uv.x)*smoothstep(0.0,0.17,1.0-uv.x)',
    '    *smoothstep(0.0,0.22,1.0-uv.y)*smoothstep(0.0,0.035,uv.y);',
    '  float a=(1.0-exp(-d*1.9))*uDyn.w*gain*edge;',
    '  a+=(texture2D(uN,gl_FragCoord.xy/64.0).b-0.5)*(1.4/255.0)*step(0.006,a);',
    '  a=clamp(a,0.0,1.0);',
    '  vec3 col=mix(uCa,uCb,smoothstep(0.04,0.8,d));',
    '  gl_FragColor=vec4(col*a,a);',
    '}'
  ].join('\n');

  var list = [], raf = 0, lastT = 0, T = 0, off = false, io = null;
  var quality = 1, ema = 0, slowFrames = 0;
  var ptrX = 0, ptrY = 0, hasPtr = false, scrY = 0, scrT = 0, gust = 0, gustTo = 0;
  var TAU = 6.283185307179586;

  // Dunkler oder heller Untergrund? (bestimmt die Farbe des Dampfs)
  function onDark(el) {
    if (el.closest && el.closest('.chapter-dark')) return true;
    for (var n = el; n && n !== document.documentElement; n = n.parentElement) {
      var c = getComputedStyle(n).backgroundColor || '';
      var m = c.match(/-?[\d.]+/g);
      if (!m || m.length < 3) continue;
      var k = c.indexOf('rgb') === 0 ? 1 : 255;
      if (m.length > 3 && parseFloat(m[3]) < 0.5) continue;
      return (0.2126 * m[0] * k + 0.7152 * m[1] * k + 0.0722 * m[2] * k) < 118;
    }
    return false;
  }

  function noiseTex(gl) {
    var data = new Uint8Array(64 * 64 * 4), s = 0x9E3779B9 | 0, i, t;
    for (i = 0; i < data.length; i++) {
      s = (s + 0x6D2B79F5) | 0; t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      data[i] = ((t ^ (t >>> 14)) >>> 0) & 255;
    }
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 64, 64, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return tex;
  }

  function initGL(o) {
    var gl = null, opts = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' };
    try { gl = o.cv.getContext('webgl', opts) || o.cv.getContext('experimental-webgl', opts); } catch (e) { gl = null; }
    if (!gl) return false;
    try {
      var mk = function (type, src) {
        var sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
        return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
      };
      var vs = mk(gl.VERTEX_SHADER, VERT), fs = mk(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return false;
      var pr = gl.createProgram();
      gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.bindAttribLocation(pr, 0, 'a'); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return false;
      gl.useProgram(pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      noiseTex(gl);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      o.u = {
        res: gl.getUniformLocation(pr, 'uRes'), geo: gl.getUniformLocation(pr, 'uGeo'),
        ph: gl.getUniformLocation(pr, 'uPh'), dyn: gl.getUniformLocation(pr, 'uDyn'),
        ca: gl.getUniformLocation(pr, 'uCa'), cb: gl.getUniformLocation(pr, 'uCb')
      };
      gl.uniform1i(gl.getUniformLocation(pr, 'uN'), 0);
      if (o.dark) { gl.uniform3f(o.u.ca, 0.886, 0.737, 0.478); gl.uniform3f(o.u.cb, 1.0, 0.975, 0.925); }
      else { gl.uniform3f(o.u.ca, 0.84, 0.71, 0.50); gl.uniform3f(o.u.cb, 0.70, 0.52, 0.24); }
      o.gl = gl;
      return true;
    } catch (e) { return false; }
  }

  // Lage und Größe der Zeichenfläche (nur bei Größenänderung / beim Hereinscrollen, nie pro Bild)
  function layout(o) {
    var el = o.el, cv = o.cv, W = el.offsetWidth, was = o.ok;
    o.ok = false;
    if (W && o.gl && !o.lost) {
      var unit = W / o.vbW, iconH = unit * o.vbH;
      var r = el.getBoundingClientRect();
      var docW = document.documentElement.clientWidth;
      var cxp = o.cx * unit, basep = o.base * unit;
      var top = -0.9 * iconH, bottom = basep + 0.04 * W;
      var b = o.bound ? o.bound.getBoundingClientRect() : null;
      // nie über den eigenen Abschnitt und nie über den Bildschirmrand hinaus
      if (b) top = Math.max(top, b.top - r.top);
      var half = Math.min(0.75 * W, 0.72 * (basep - top));
      var left = cxp - half, right = cxp + half;
      left = Math.max(left, 6 - r.left); right = Math.min(right, W + docW - r.right - 6);
      if (b) { left = Math.max(left, b.left - r.left); right = Math.min(right, W + b.right - r.right); }
      left = Math.ceil(left); top = Math.ceil(top); right = Math.floor(right); bottom = Math.floor(bottom);
      var cssW = right - left, cssH = bottom - top, plume = basep - top;
      if (cssW >= 48 && cssH >= 48 && plume >= iconH * 0.45 && cxp - left > cssW * 0.22 && right - cxp > cssW * 0.22) {
        var dpr = Math.min(window.devicePixelRatio || 1, 1.5) * quality;
        var cw = Math.round(cssW * dpr), ch = Math.round(cssH * dpr), cap = MAX_PIXELS * quality * quality;
        if (cw * ch > cap) { var k = Math.sqrt(cap / (cw * ch)); cw = Math.round(cw * k); ch = Math.round(ch * k); }
        cw = Math.max(24, cw); ch = Math.max(24, ch);
        if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
        cv.style.left = left + 'px'; cv.style.top = top + 'px';
        cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        var sx = cw / cssW, sy = ch / cssH;
        o.gl.viewport(0, 0, cw, ch);
        o.gl.uniform2f(o.u.res, cw, ch);
        o.gl.uniform4f(o.u.geo, (cxp - left) * sx, (bottom - basep) * sy, plume * sy, (o.w0 * unit) / plume);
        o.pcx = r.left + cxp; o.pcy = r.top + (window.pageYOffset || 0) + (top + basep) * 0.5; o.pH = plume;
        o.ok = true;
      }
    }
    if (o.ok) { if (o.vis) { draw(o, 0); kick(); } }
    else if (was || o.on) { o.on = false; el.classList.remove('fx-dampf-on'); }
  }

  function draw(o, dt) {
    var gl = o.gl;
    o.age += dt;
    var g = (o.age - o.delay) / 3.6; g = g < 0 ? 0 : g > 1 ? 1 : g; g = g * g * (3 - 2 * g);
    var to = gust * 0.5;
    if (hasPtr) {
      var dx = (ptrX - o.pcx) / o.pH, dy = (ptrY - (o.pcy - scrY)) / o.pH;
      to -= Math.max(-1, Math.min(1, dx * 2.4)) * Math.exp(-(dx * dx + dy * dy) * 1.2) * 0.85;
    }
    o.lean += (to - o.lean) * Math.min(1, dt * 1.8);
    var t = T + o.seed;
    gl.uniform4f(o.u.ph, (t * 0.46) % TAU, (t * 0.71) % TAU, (t * 0.21) % 64, (t * 0.5) % 64);
    gl.uniform4f(o.u.dyn, (t * 0.34) % 64, o.lean, g, o.alpha);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!o.on && g > 0) { o.on = true; o.el.classList.add('fx-dampf-on'); }
  }

  // Blendet sich die Zeichnung beim Hereinscrollen noch ein (leicht versetzt), kurz danach nachmessen
  function settle(o) {
    if (o.tm) clearTimeout(o.tm);
    o.tm = setTimeout(function () { o.tm = 0; if (!off && o.vis && list.indexOf(o) >= 0) layout(o); }, 1500);
  }

  function live(o) { return o.ok && o.vis && !o.lost; }

  function frame(now) {
    raf = 0;
    if (off || document.hidden) return;
    var i, any = false;
    for (i = 0; i < list.length; i++) if (live(list[i])) { any = true; break; }
    if (!any) return;
    raf = requestAnimationFrame(frame);
    if (!lastT) lastT = now - 33;
    var el = now - lastT;
    if (el < frameMs) return;
    lastT = now;
    var dt = Math.min(0.1, el / 1000);
    T += dt;
    gust += (gustTo - gust) * Math.min(1, dt * 3.5);
    gustTo *= Math.pow(0.03, dt);
    for (i = 0; i < list.length; i++) if (live(list[i])) draw(list[i], dt);
    // Kommt das Gerät dauerhaft nicht hinterher: gröber und seltener rechnen (zwei Stufen)
    if (T > 4 && quality > 0.5) {
      ema = ema ? ema + (el - ema) * 0.06 : el;
      if (++slowFrames > 70 && ema > 60) {
        slowFrames = 0; ema = 0; quality = quality > 0.75 ? 0.7 : 0.5;
        if (quality <= 0.5) frameMs = 47;
        for (i = 0; i < list.length; i++) layout(list[i]);
      }
    }
  }

  function kick() {
    if (raf || off || document.hidden) return;
    lastT = 0; ema = 0; slowFrames = 0;
    raf = requestAnimationFrame(frame);
  }

  function drop(o) {
    o.ok = false; o.lost = true;
    o.el.classList.remove('fx-dampf-on');
    if (io) { try { io.unobserve(o.cv); } catch (e) {} }
    if (o.cv.parentNode) o.cv.parentNode.removeChild(o.cv);
    var i = list.indexOf(o); if (i >= 0) list.splice(i, 1);
  }

  function shutdown() {
    off = true;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    list.slice().forEach(function (o) {
      try { var x = o.gl && o.gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) {}
      drop(o);
    });
  }

  function build(el, cfg) {
    var svg = el.querySelector('svg'), paths = el.querySelectorAll('.art-steam');
    if (!svg || !paths.length) return null;
    var xs = [], ys = [], i, m;
    for (i = 0; i < paths.length; i++) {
      m = /M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/i.exec(paths[i].getAttribute('d') || '');
      if (m) { xs.push(parseFloat(m[1])); ys.push(parseFloat(m[2])); }
    }
    if (!xs.length) return null;
    var vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(parseFloat);
    if (vb.length !== 4 || !(vb[2] > 0) || !(vb[3] > 0)) vb = [0, 0, 240, 220];
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var cv = document.createElement('canvas');
    cv.className = 'fx-dampf';
    cv.setAttribute('aria-hidden', 'true');
    cv.width = 24; cv.height = 24;
    var dark = onDark(el);
    var o = {
      el: el, cv: cv, gl: null, u: null, dark: dark, alpha: (dark ? 0.62 : 0.74) * (cfg.soft || 1),
      vbW: vb[2], vbH: vb[3],
      cx: (minX + maxX) / 2 - vb[0], base: Math.max.apply(null, ys) - vb[1] + cfg.drop, w0: (maxX - minX) / 2 + 7,
      bound: el.closest ? el.closest('section, header, main') : null,
      delay: cfg.delay, seed: list.length * 37.3, age: 0, lean: 0,
      ok: false, vis: false, lost: false, on: false, pcx: 0, pcy: 0, pH: 1, tm: 0
    };
    if (!initGL(o)) return null;
    cv.addEventListener('webglcontextlost', function (e) {
      e.preventDefault(); o.lost = true; o.ok = false; o.on = false; el.classList.remove('fx-dampf-on');
    }, false);
    cv.addEventListener('webglcontextrestored', function () {
      if (off) return;
      if (initGL(o)) { o.lost = false; o.age = 0; layout(o); kick(); } else drop(o);
    }, false);
    el.insertBefore(cv, el.firstChild);
    return o;
  }

  function start() {
    if (!document.body || document.body.classList.contains('admin-body')) return;
    if (mqReduce.matches) return;
    var i, j, els, o;
    for (i = 0; i < TARGETS.length && list.length < MAX_CANVAS; i++) {
      els = document.querySelectorAll(TARGETS[i].sel);
      for (j = 0; j < els.length && list.length < MAX_CANVAS; j++) {
        if (els[j].querySelector('.fx-dampf')) continue;
        o = build(els[j], TARGETS[i]);
        if (!o) { if (!list.length && els[j].querySelector('.art-steam')) return; continue; }
        list.push(o);
      }
    }
    if (!list.length) return;

    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        for (var k = 0; k < list.length; k++) if (list[k].cv === en.target) {
          var o = list[k], was = o.vis; o.vis = en.isIntersecting;
          if (en.isIntersecting && !was) { layout(o); settle(o); }
        }
      });
      kick();
    }, { rootMargin: '40px 0px' });
    list.forEach(function (x) { layout(x); io.observe(x.cv); });

    var rz = 0, relayout = function () { rz = 0; if (!off) list.forEach(layout); };
    var onResize = function () { if (rz) clearTimeout(rz); rz = setTimeout(relayout, 160); };
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });
    if (document.readyState !== 'complete') window.addEventListener('load', onResize, { once: true });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });

    scrY = window.pageYOffset || 0;
    window.addEventListener('scroll', function () {
      var y = window.pageYOffset || 0, now = performance.now();
      var v = (y - scrY) / Math.max(16, now - scrT);
      scrY = y; scrT = now;
      gustTo = Math.max(-1, Math.min(1, v * 0.3));
    }, { passive: true });
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      window.addEventListener('pointermove', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        ptrX = e.clientX; ptrY = e.clientY; hasPtr = true;
      }, { passive: true });
      document.addEventListener('mouseleave', function () { hasPtr = false; });
    }
    var onMq = function () { if (mqReduce.matches) shutdown(); };
    if (mqReduce.addEventListener) mqReduce.addEventListener('change', onMq);
    else if (mqReduce.addListener) mqReduce.addListener(onMq);
  }

  // Dampf ist nur Zierde – im Zweifel bleibt alles, wie es war
  var safeStart = function () { try { start(); } catch (e) { try { shutdown(); } catch (e2) {} } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeStart);
  else safeStart();
})();

/* Fensterlicht: weicher Lichtwurf eines Sprossenfensters hinter dem Startseiten-Kopf – Richtung, Länge und Farbe folgen der echten Uhrzeit, abends bleibt nur ein leiser Lampenschein. */
(function () {
  'use strict';
  var doc = document;
  if (!window.matchMedia || !window.requestAnimationFrame || !('IntersectionObserver' in window)) return;
  var mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  if (mqReduce.matches) return;
  var conn = navigator.connection;
  if (conn && conn.saveData) return;

  var VERT = 'attribute vec2 aPos;varying vec2 vUv;void main(){vUv=vec2(aPos.x*.5+.5,.5-aPos.y*.5);gl_Position=vec4(aPos,0.,1.);}';
  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'varying vec2 vUv;',
    'uniform vec2 uSc;',      // Fläche in Bezugseinheiten (Bezug = sichtbare Kopfhöhe)
    'uniform float uT;',      // Sekunden
    'uniform vec4 uWin;',     // Fenster: Mitte x, y · Breite · Höhe
    'uniform vec4 uSun;',     // Scherung · Halbschatten · Lichtstärke · Schattenstärke
    'uniform vec3 uTint;',    // Lichtfarbe
    'uniform vec4 uLamp;',    // Lampe: Mitte x, y · Radius x, y
    'uniform float uLampS;',  // Lampenstärke
    'uniform vec3 uShift;',   // Zeiger x, y · Scroll
    'float h12(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}',
    'float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);',
    '  return mix(mix(h12(i),h12(i+vec2(1.,0.)),f.x),mix(h12(i+vec2(0.,1.)),h12(i+vec2(1.,1.)),f.x),f.y);}',
    'float sm(float d,float s){return smoothstep(-s,s,d);}',
    'void main(){',
    '  vec2 P=vUv*uSc;',
    '  vec2 off=vec2(uShift.x,uShift.y+uShift.z);',
    '  vec2 q=P-uWin.xy-off;',
    '  float sh=uSun.x;',
    '  float an=sh*.11-.06,ca=cos(an),sa=sin(an);',          // leichte Schräge, auch mittags nie ganz gerade
    '  q=vec2(ca*q.x-sa*q.y,sa*q.x+ca*q.y);',
    '  q.x-=sh*q.y;',
    '  vec2 n=q/(.5*uWin.zw);',
    '  n.x/=mix(.93,1.1,clamp(n.y*.5+.5,0.,1.));',      // Lichtwurf weitet sich zum fernen Ende
    '  float far=clamp(n.y*.5+.5,0.,1.);',               // 0 = nah am Fenster, 1 = fernes Ende
    '  float sx=uSun.y*mix(.5,1.75,far);',               // Halbschatten wächst mit der Entfernung
    '  float sy=sx*uWin.z/uWin.w;',
    '  float ax=abs(n.x);',
    '  float cols=min(1.,sm(.292-ax,sx)+sm(.292-abs(ax-.708),sx));',   // drei Fensterflügel
    '  float rows=sm(1.-abs(n.y),sy);',
    '  float bd=n.y+.34;',                               // Quersprosse im oberen Drittel
    '  float bs=.026+sy*.6;',
    '  float bar=min(.7,exp(-bd*bd/(2.*bs*bs))*(.026/bs)*1.6);',
    '  float light=cols*rows*(1.-bar)*mix(1.,.8,far);',
    '#ifdef FX_LEAF',
    '  vec2 lp=(P-off*1.6)*5.2;',
    '  vec2 sw=vec2(sin(uT*.13)*.10+sin(uT*.05+1.7)*.16,cos(uT*.11)*.06)+uT*vec2(.006,.0025);',
    '  float f=vn(lp+sw)*.62+vn(lp*2.1-sw*1.3+7.3)*.38;',
    '  float leaf=smoothstep(.41,.64,f)*(.4+.6*smoothstep(-.6,.8,n.x));',
    '  light*=1.-.7*leaf;',
    '#endif',
    '  float inside=sm(1.-ax,sx*1.6)*sm(1.-abs(n.y),sy*1.6);',
    '  float halo=1.-smoothstep(.55,1.75,length(vec2(n.x*.62,n.y*.72)));',   // weicher, runder Schattenhof
    '  float aL=uSun.z*light;',
    '  float aS=uSun.w*(1.-light)*(mix(.24,.38,smoothstep(.5,1.5,uSc.x))*halo+.6*inside);',
    '  vec2 ld=(P-uLamp.xy-off*.6)/uLamp.zw;',
    '  float lg=exp(-dot(ld,ld)*1.5)*uLampS*(1.+.035*sin(uT*.37));',
    '  float edge=smoothstep(0.,.13,vUv.x)*smoothstep(0.,.13,1.-vUv.x)*smoothstep(0.,.07,vUv.y)*smoothstep(0.,.17,1.-vUv.y);',
    '  gl_FragColor=vec4(uTint*aL+vec3(.72,.60,.42)*aS+vec3(1.,.82,.55)*lg,aL+aS+lg)*edge;',
    '}'
  ].join('\n');

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mix(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  function boot() {
    var body = doc.body;
    if (!body || body.classList.contains('admin-body')) return;
    var hero = doc.querySelector('.hero-cinematic, .page-hero-editorial');   // Startseite und die Köpfe der Unterseiten
    if (!hero) return;
    var ticker = hero.querySelector('.hero-ticker');

    var canvas = doc.createElement('canvas');
    canvas.className = 'fx-licht';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.width = 2; canvas.height = 2;

    var gl = null, U = null;
    var attrs = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' };
    try { gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs); } catch (e) { gl = null; }
    if (!gl) return;

    function compile(type, src) {
      var s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
      return s;
    }
    // Programm bauen – auch nach einem wiederhergestellten Grafik-Kontext
    function setup() {
      try {
        var hp = gl.getShaderPrecisionFormat && gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
        var leaf = hp && hp.precision > 0 ? '#define FX_LEAF\n' : '';   // Blattschatten nur mit genauer Rechnung
        var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, leaf + FRAG);
        if (!vs || !fs) return false;
        var pr = gl.createProgram();
        gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return false;
        gl.useProgram(pr);
        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        var loc = gl.getAttribLocation(pr, 'aPos');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
        gl.clearColor(0, 0, 0, 0);
        U = {};
        ['uSc', 'uT', 'uWin', 'uSun', 'uTint', 'uLamp', 'uLampS', 'uShift'].forEach(function (k) { U[k] = gl.getUniformLocation(pr, k); });
        return true;
      } catch (e) { return false; }
    }
    if (!setup()) return;

    hero.insertBefore(canvas, hero.firstChild);

    var cssW = 0, cssH = 0, ref = 1, aspect = 1;
    var vw = window.innerWidth || 1, vh = window.innerHeight || 1;
    var running = false, raf = 0, onScreen = false, lost = false, dead = false, shown = false;
    var last = 0, t0 = 0, clockAt = -1e9, activeUntil = 0;
    var scrollPx = 0, scrollDirty = true;
    var tx = 0, ty = 0, cx = 0, cy = 0;
    var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

    // Größe: höchstens ein Drittel der Bildschirmpunkte und höchstens 520 breit – das Hochrechnen macht es weich
    function measure() {
      if (dead || lost) return;
      var w = hero.clientWidth;
      var h = ticker ? ticker.offsetTop : hero.clientHeight;
      vw = window.innerWidth || 1; vh = window.innerHeight || 1;
      if (w < 2 || h < 2 || (w === cssW && h === cssH)) return;
      cssW = w; cssH = h;
      ref = Math.min(h, Math.max(380, vh * 0.86));   // Bezug: der Teil des Kopfes, der beim Laden zu sehen ist
      aspect = w / ref;
      canvas.style.height = h + 'px';
      var sc = Math.min(1 / 3, 520 / w, 640 / h);
      canvas.width = Math.max(2, Math.round(w * sc));
      canvas.height = Math.max(2, Math.round(h * sc));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(U.uSc, aspect, h / ref);
      clockAt = -1e9; last = 0;
      start();
    }

    // Sonnenstand aus der Uhrzeit: morgens flach, lang und golden von rechts, mittags steil und blass, nachmittags bernsteinfarben von links
    function sky() {
      var d = new Date();
      var h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
      var day = smooth(5.7, 6.7, h) * (1 - smooth(17.8, 19.1, h));
      var s = clamp((h - 12.4) / 5.9, -1, 1);
      var e = Math.cos(s * Math.PI / 2);          // 0 = tief stehende Sonne, 1 = Mittag
      var low = (1 - e) * (1 - e);
      var wide = smooth(0.5, 1.5, aspect);        // 0 = Handy hochkant, 1 = breiter Bildschirm
      var shear = (s < 0 ? -1 : 1) * Math.pow(Math.abs(s), 0.85) * 1.05 * mix(0.5, 1, wide);
      var warm = s < 0 ? [1, 0.957, 0.824] : [1, 0.937, 0.79];
      var noon = [1, 0.98, 0.91], deep = [1, 0.925, 0.75];
      var tint = [0, 0, 0];
      for (var i = 0; i < 3; i++) tint[i] = mix(mix(noon[i], warm[i], 1 - e), deep[i], low * 0.5);
      gl.uniform4f(U.uWin, mix(0.55, 0.66, e) * aspect, mix(0.47, 0.35, e), mix(0.27, 0.46, wide) * mix(1.04, 0.92, e), mix(0.78, 0.5, e));
      gl.uniform4f(U.uSun, shear, mix(0.085, 0.06, e), 0.62 * day, 0.25 * day);
      gl.uniform3f(U.uTint, tint[0], tint[1], tint[2]);
      gl.uniform4f(U.uLamp, mix(0.56, 0.66, wide) * aspect, mix(0.34, 0.42, wide), mix(0.3, 0.52, wide), mix(0.27, 0.42, wide));
      gl.uniform1f(U.uLampS, (1 - day) * 0.2);
    }

    function frame(now) {
      raf = 0;
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (now - last < (now < activeUntil ? 31 : 48)) return;      // rund 30 Bilder/s bei Bewegung, sonst rund 20
      var dt = last ? Math.min(now - last, 200) : 33;
      last = now;
      if (!t0) t0 = now;
      if (now - clockAt > 20000) { clockAt = now; sky(); }
      if (scrollDirty) { scrollDirty = false; scrollPx = window.pageYOffset || 0; }
      var k = 1 - Math.exp(-dt / 280);
      cx += (tx - cx) * k; cy += (ty - cy) * k;
      if (Math.abs(tx - cx) > 0.0008 || Math.abs(ty - cy) > 0.0008) activeUntil = now + 200;
      gl.uniform3f(U.uShift, -cx * 0.018 * aspect, -cy * 0.018, clamp(scrollPx, 0, cssH) * 0.12 / ref);
      gl.uniform1f(U.uT, (now - t0) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!shown) { shown = true; canvas.classList.add('fx-licht-on'); }
    }
    function start() {
      if (running || dead || lost || !onScreen || doc.hidden || !cssW) return;
      running = true; last = 0;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    var io = new IntersectionObserver(function (entries) {
      onScreen = entries[entries.length - 1].isIntersecting;
      if (onScreen) start(); else stop();
    }, { rootMargin: '80px 0px' });
    io.observe(hero);

    function onVis() { if (doc.hidden) stop(); else { clockAt = -1e9; start(); } }
    function onScroll() { scrollDirty = true; activeUntil = performance.now() + 250; }
    function onMove(e) {
      tx = e.clientX / vw - 0.5; ty = e.clientY / vh - 0.5;
      activeUntil = performance.now() + 250;
    }
    var rzRaf = 0;
    function onResize() { if (!rzRaf) rzRaf = requestAnimationFrame(function () { rzRaf = 0; measure(); }); }

    doc.addEventListener('visibilitychange', onVis);
    window.addEventListener('scroll', onScroll, { passive: true });
    if (fine) window.addEventListener('pointermove', onMove, { passive: true });
    var ro = null;
    if ('ResizeObserver' in window) { ro = new ResizeObserver(onResize); ro.observe(hero); }
    window.addEventListener('resize', onResize, { passive: true });

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      lost = true; stop();
      shown = false; canvas.classList.remove('fx-licht-on');
    }, false);
    canvas.addEventListener('webglcontextrestored', function () {
      if (dead || !setup()) return;
      lost = false; cssW = 0; cssH = 0;
      measure();
    }, false);

    // Wird später „Bewegung reduzieren“ eingeschaltet, räumt sich der Effekt vollständig weg
    function destroy() {
      if (dead) return;
      dead = true; stop();
      io.disconnect(); if (ro) ro.disconnect();
      doc.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', onResize);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
    var onReduce = function () { if (mqReduce.matches) destroy(); };
    if (mqReduce.addEventListener) mqReduce.addEventListener('change', onReduce);
    else if (mqReduce.addListener) mqReduce.addListener(onReduce);

    measure();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})();

/* FX „Wechsel“: Seitenwechsel als Kreisblende – die nächste Seite öffnet sich vom angetippten Punkt aus (mit feinem Goldring). */
(function () {
  'use strict';
  try {
    if (!window.matchMedia || !document.body || !document.documentElement) return;
    if (document.body.classList.contains('admin-body')) return;
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;
    /* Datensparmodus: keine Kreisblende, nur der ruhige Wechsel (ohne Wartezeit) */
    var lite = !!(navigator.connection && navigator.connection.saveData);
    /* Nur Browser, die Seitenwechsel zwischen zwei Dokumenten animieren können */
    if (!('onpagereveal' in window)) return;

    var KEY = 'alstercafe.fx-wechsel';
    var FRESH = 6000;
    var root = document.documentElement;
    var clearTimer = 0;

    /* Echte Uhr, die auf beiden Seiten gleich läuft */
    function now() {
      try {
        if (window.performance && performance.timeOrigin) return performance.timeOrigin + performance.now();
      } catch (e) {}
      return Date.now();
    }
    function clamp01(n) { return n < 0 ? 0 : n > 1 ? 1 : n; }

    /* ---------- Zielseite: Tipp-Punkt lesen und die Kreisblende scharf schalten ---------- */
    function takePoint() {
      var raw = null;
      try { raw = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); } catch (e) { return null; }
      if (!raw) return null;
      var p = null;
      try { p = JSON.parse(raw); } catch (e) { return null; }
      if (!p || typeof p.x !== 'number' || typeof p.y !== 'number' || typeof p.t !== 'number') return null;
      var age = now() - p.t;
      if (!(age > -1000 && age < FRESH)) return null;
      return { x: clamp01(p.x), y: clamp01(p.y) };
    }
    function disarm() {
      clearTimeout(clearTimer);
      root.classList.remove('fx-iris-on');
      root.classList.remove('fx-ruhig-on');
      root.style.removeProperty('--fx-x');
      root.style.removeProperty('--fx-y');
      root.style.removeProperty('--fx-r');
    }
    function arm(vt) {
      var p = takePoint();
      clearTimeout(clearTimer);
      if (vt && vt.finished && typeof vt.finished.then === 'function') vt.finished.then(disarm, disarm);
      /* Sicherheitsnetz: aufräumen, sobald kein Seitenwechsel mehr läuft */
      clearTimer = setTimeout(tidy, 1500);
      if (!p || mq.matches || lite) {
        /* Kein Tipp-Punkt (z. B. Zurück-Taste): ruhiger Wechsel, sofort */
        root.classList.add('fx-ruhig-on');
        return;
      }
      var w = window.innerWidth || root.clientWidth || 1;
      var h = window.innerHeight || root.clientHeight || 1;
      var dx = Math.max(p.x, 1 - p.x) * w;
      var dy = Math.max(p.y, 1 - p.y) * h;
      /* Radius bis zur fernsten Ecke, mit etwas Reserve für Adressleisten am Handy */
      var r = Math.ceil(Math.sqrt(dx * dx + dy * dy) * 1.06) + 12;
      root.style.setProperty('--fx-x', (p.x * 100).toFixed(2) + '%');
      root.style.setProperty('--fx-y', (p.y * 100).toFixed(2) + '%');
      root.style.setProperty('--fx-r', r + 'px');
      root.classList.add('fx-iris-on');
    }
    function tidy() {
      var busy = false;
      try {
        var list = document.getAnimations();
        for (var i = 0; i < list.length; i++) {
          var ps = list[i] && list[i].effect && list[i].effect.pseudoElement;
          if (ps && ps.indexOf('::view-transition') === 0) { busy = true; break; }
        }
      } catch (e) {}
      if (busy) clearTimer = setTimeout(tidy, 500);
      else disarm();
    }

    /* „pagereveal“ kommt vor dem ersten Bild der neuen Seite – erreicht dieses Skript aber nur,
       wenn es schon geladen ist (z. B. zurück aus dem Seiten-Zwischenspeicher) */
    window.addEventListener('pagereveal', function (e) {
      try {
        if (e && e.viewTransition) arm(e.viewTransition);
      } catch (err) {}
    }, { passive: true });

    /* Regelfall: das Skript steht am Seitenende, „pagereveal“ ist dann schon vorbei.
       Solange hält das Stylesheet die alte Seite fest (höchstens 0,45 s) – in dieser Zeit
       wird hier nahtlos die Kreisblende (oder der ruhige Wechsel) gestartet.
       Kommt das Skript später, läuft der ruhige Wechsel von allein. */
    try {
      if (typeof document.getAnimations === 'function') {
        var running = document.getAnimations();
        for (var i = 0; i < running.length; i++) {
          var fx = running[i] && running[i].effect;
          if (!fx || fx.target !== root || fx.pseudoElement !== '::view-transition-new(root)') continue;
          var t = running[i].currentTime;
          if (typeof t === 'number' && t < 420) arm(document.activeViewTransition || null);
          else { try { sessionStorage.removeItem(KEY); } catch (e2) {} }
          break;
        }
      }
    } catch (err) {}

    /* ---------- Startseite des Wechsels: Tipp-Punkt merken ---------- */
    var mark = null;
    var markTimer = 0;
    function dropMark() {
      clearTimeout(markTimer);
      if (mark && mark.parentNode) mark.parentNode.removeChild(mark);
      mark = null;
    }

    document.addEventListener('click', function (e) {
      try {
        if (lite || mq.matches || e.defaultPrevented) return;
        if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if (!a || a.hasAttribute('download')) return;
        var target = (a.getAttribute('target') || '').toLowerCase();
        if (target && target !== '_self') return;
        var href = a.getAttribute('href') || '';
        if (!href || href.charAt(0) === '#') return;
        var u = new URL(a.href, location.href);
        if (u.protocol !== location.protocol || u.origin !== location.origin) return;   /* tel:, mailto:, fremde Seiten */
        if (u.pathname === location.pathname && u.search === location.search) return;   /* Sprungmarke auf derselben Seite */
        if (/\.(pdf|jpe?g|png|webp|avif|gif|svg|ics|vcf|zip)$/i.test(u.pathname)) return;

        var w = window.innerWidth || root.clientWidth || 1;
        var h = window.innerHeight || root.clientHeight || 1;
        var x = e.clientX, y = e.clientY;
        /* Tastatur (Enter): Mitte des Links nehmen */
        if (!e.detail || (!x && !y)) {
          var box = a.getBoundingClientRect();
          x = box.left + box.width / 2;
          y = box.top + box.height / 2;
        }
        x = Math.min(Math.max(x, 0), w);
        y = Math.min(Math.max(y, 0), h);
        sessionStorage.setItem(KEY, JSON.stringify({ x: x / w, y: y / h, t: now() }));

        /* Unsichtbarer Merkpunkt: gibt dem Goldring auf der nächsten Seite seinen Mittelpunkt */
        dropMark();
        mark = document.createElement('div');
        mark.className = 'fx-wechsel-punkt';
        mark.setAttribute('aria-hidden', 'true');
        mark.style.left = (x - 1) + 'px';
        mark.style.top = (y - 1) + 'px';
        document.body.appendChild(mark);
        markTimer = setTimeout(dropMark, FRESH);
      } catch (err) {}
    }, { passive: true });

    /* Zurück aus dem Seiten-Zwischenspeicher: alten Merkpunkt entfernen */
    window.addEventListener('pageshow', function (e) {
      if (e && e.persisted) dropMark();
    }, { passive: true });
  } catch (err) {}
})();

/* fx-staub: Goldstaub mit Tiefe in den dunklen Kapiteln – schwebt durch einen Lichtstrahl, wirbelt beim Scrollen auf, weicht der Maus aus und stiebt beim Fingertipp auseinander */
(function fxStaub() {
  'use strict';
  var W = window, D = document;

  function start() {
    try {
      if (!D.body || D.body.classList.contains('admin-body')) return;
      if (!W.matchMedia || W.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (navigator.connection && navigator.connection.saveData) return;
      if (!W.requestAnimationFrame || !W.IntersectionObserver) return;
      var probe = D.createElement('canvas');
      if (!probe.getContext || !probe.getContext('2d')) return;
      var secs = D.querySelectorAll('.chapter-dark');
      if (!secs.length) return;
      run(secs);
    } catch (e) { /* ohne Staub geht es auch */ }
  }

  function run(secs) {
    var PASSIVE = { passive: true };
    var TAU = Math.PI * 2;
    var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
    var rnd = Math.random;

    /* Lichtstrahl: gleicher Winkel wie der Verlauf in fx.css (112 Grad) */
    var BEAM = 112 * Math.PI / 180, BSIN = Math.sin(BEAM), BCOS = Math.cos(BEAM), BMID = 0.46, BWID = 0.17;

    /* weiche Staubkörner und unscharfe Lichtscheiben einmal vorzeichnen */
    var TINTS = [[226, 188, 122], [212, 179, 128], [243, 227, 191]];
    var MOTE = [[0, 1], [0.16, 0.9], [0.42, 0.26], [0.7, 0.06], [1, 0]];
    var BOKEH = [[0, 0.44], [0.58, 0.42], [0.8, 0.64], [0.9, 0.3], [1, 0]];
    function sprite(size, stops, rgb) {
      var c = D.createElement('canvas'); c.width = c.height = size;
      var g = c.getContext('2d'), h = size / 2, gr = g.createRadialGradient(h, h, 0, h, h, h);
      for (var i = 0; i < stops.length; i++) gr.addColorStop(stops[i][0], 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + stops[i][1] + ')');
      g.fillStyle = gr; g.fillRect(0, 0, size, size);
      return c;
    }
    var motes = TINTS.map(function (t) { return sprite(64, MOTE, t); });
    var bokehs = TINTS.map(function (t) { return sprite(128, BOKEH, t); });

    /* drei Tiefen: fern, mittel, nah */
    var PAR = [0.55, 0.85, 1.3];   // wie stark die Ebene mit dem Scrollen mitzieht
    var DK = [0.6, 1, 1.35];       // wie stark sie auf Wirbel reagiert
    var phoneMq = W.matchMedia('(max-width: 760px)');
    var fineMq = W.matchMedia('(hover: hover) and (pointer: fine)');

    function makeParticle(f, z) {
      var p = { z: z, x: rnd() * f.w, y: rnd() * f.h, vx: 0, vy: 0, glow: 0,
        t: rnd() < 0.45 ? 0 : rnd() < 0.55 ? 1 : 2,
        ws: 0.25 + rnd() * 0.5, wp: rnd() * TAU, tw: 0.7 + rnd() * 0.9, tp: rnd() * TAU, sw: (rnd() - 0.5) * 1.4 };
      if (z === 0) { p.d = 1.6 + rnd() * 1.9; p.a = 0.34 + rnd() * 0.32; p.rise = 5 + rnd() * 6; p.wa = 4 + rnd() * 5; }
      else if (z === 1) { p.d = 3 + rnd() * 3.6; p.a = 0.6 + rnd() * 0.4; p.rise = 9 + rnd() * 10; p.wa = 6 + rnd() * 9; }
      else { p.d = 14 + rnd() * 20; p.a = 0.09 + rnd() * 0.1; p.rise = 12 + rnd() * 12; p.wa = 8 + rnd() * 10; }
      p.s = z === 2 ? p.d * 1.12 : p.d * 3.2;   // gezeichnete Kantenlänge
      return p;
    }

    function layout(f) {
      f.dirty = false;
      var w = f.sec.offsetWidth, secH = f.sec.offsetHeight;
      var vh = W.innerHeight || D.documentElement.clientHeight || 800;
      var h = Math.min(secH, vh + 160);
      if (w < 40 || h < 40) { f.w = 0; return; }
      // Adressleiste am Handy blendet ein/aus: kleine Höhenänderungen nicht neu aufbauen
      if (w === f.w && secH === f.secH && h <= f.h && h >= f.h - 150) return;
      var ow = f.w, oh = f.h;
      f.phone = phoneMq.matches;
      var dpr = Math.min(W.devicePixelRatio || 1, f.phone ? 1.5 : 2);
      dpr = Math.min(dpr, Math.sqrt(3.2e6 / (w * h)));
      f.w = w; f.h = h; f.secH = secH; f.dpr = dpr;
      f.L = w * Math.abs(BSIN) + h * Math.abs(BCOS);
      f.cv.style.height = h + 'px';
      f.cv.width = Math.round(w * dpr); f.cv.height = Math.round(h * dpr);
      var n = f.phone ? clamp(Math.round(w * h / 6000), 44, 60) : clamp(Math.round(w * h / 11000), 70, 130);
      if (n !== f.parts.length) {
        var near = Math.round(n * 0.14), mid = Math.round(n * 0.36), far = n - near - mid, i;
        f.parts = [];
        for (i = 0; i < far; i++) f.parts.push(makeParticle(f, 0));
        for (i = 0; i < mid; i++) f.parts.push(makeParticle(f, 1));
        for (i = 0; i < near; i++) f.parts.push(makeParticle(f, 2));
      } else if (ow && oh) {
        for (var k = 0; k < f.parts.length; k++) { f.parts[k].x *= w / ow; f.parts[k].y *= h / oh; }
      }
      f.lastTop = null;
    }

    /* Fingertipp oder Klick: Staub stiebt weich nach außen */
    function puff(f, cx, cy) {
      if (!f.on || !f.w || f.lastTop === null) return;
      var x = cx - f.left, y = cy - f.lastTop, R = f.phone ? 170 : 210, i, p, dx, dy, d, q;
      for (i = 0; i < f.parts.length; i++) {
        p = f.parts[i]; dx = p.x - x; dy = p.y - y; d = Math.sqrt(dx * dx + dy * dy);
        if (d < R) {
          q = 1 - d / R; d = d || 1;
          p.vx += dx / d * q * 250 * DK[p.z]; p.vy += dy / d * q * 250 * DK[p.z];
          if (q > p.glow) p.glow = q;
        }
      }
      if (f.puffs.length > 40) return;
      for (i = 0; i < 10; i++) {
        var ang = rnd() * TAU, sp = 50 + rnd() * 150, life = 1 + rnd() * 0.9;
        f.puffs.push({ x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 14, life: life, max: life, d: 2 + rnd() * 2.6, t: (rnd() * 3) | 0, ring: false });
      }
      f.puffs.push({ x: x, y: y, vx: 0, vy: 0, life: 0.75, max: 0.75, d: 0, t: 2, ring: true });
    }

    function step(f, dt, t, dS, jump) {
      if (f.dirty) layout(f);
      if (!f.w) return;
      var r = f.sec.getBoundingClientRect();
      var off = f.secH > f.h ? Math.round(clamp(-r.top - 80, 0, f.secH - f.h)) : 0;
      if (off !== f.off) { f.off = off; f.cv.style.transform = off ? 'translate3d(0,' + off + 'px,0)' : ''; }
      var top = r.top + off;
      var dC = (f.lastTop === null || jump) ? 0 : top - f.lastTop;
      f.lastTop = top; f.left = r.left;
      if (jump) dS = 0;

      var w = f.w, h = f.h, dpr = f.dpr, ctx = f.ctx, secH = f.secH, L = f.L;
      f.energy = f.energy * Math.exp(-dt / 0.8) + Math.abs(dS);
      var boost = 1 + Math.min(f.energy / 1500, 1) * 0.3;
      var damp = Math.exp(-dt / 0.9), gdamp = Math.exp(-dt / 0.7);
      var hov = f.hov, hx = f.hx - r.left, hy = f.hy - top, HR = 170;
      var sh0 = -dS * PAR[0] - dC, sh1 = -dS * PAR[1] - dC, sh2 = -dS * PAR[2] - dC;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, f.cv.width, f.cv.height);
      ctx.globalCompositeOperation = 'lighter';

      var i, p, k, th, dx, dy, d, q, g, sp, mx, m, span, a, b, e, s, parts = f.parts;
      for (i = 0; i < parts.length; i++) {
        p = parts[i]; k = DK[p.z]; g = 0;
        if (dS) { // Wirbel: benachbarte Körner drehen gemeinsam, Stärke folgt dem Scrolltempo
          th = 2.2 * Math.sin(p.x * 0.0085 + t * 0.33 + f.seed) + 2.2 * Math.cos(p.y * 0.0105 - t * 0.29) + p.sw;
          p.vx += Math.cos(th) * dS * 0.5 * k;
          p.vy += Math.sin(th) * dS * 0.5 * k - dS * 0.2 * k;
        }
        if (hov) { // Maus: heller und sanft zur Seite
          dx = p.x - hx; dy = p.y - hy; d = dx * dx + dy * dy;
          if (d < HR * HR) {
            d = Math.sqrt(d) || 1; q = 1 - d / HR; q *= q; g = q;
            p.vx += dx / d * q * 150 * k * dt; p.vy += dy / d * q * 150 * k * dt;
          }
        }
        sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy); mx = 200 * k;
        if (sp > mx) { p.vx *= mx / sp; p.vy *= mx / sp; }
        p.x += (Math.sin(t * p.ws + p.wp) * p.wa + p.vx) * dt;
        p.y += (-p.rise + Math.cos(t * p.ws * 0.8 + p.wp * 1.7) * p.wa * 0.4 + p.vy) * dt + (p.z === 0 ? sh0 : p.z === 1 ? sh1 : sh2);
        p.vx *= damp; p.vy *= damp; p.glow *= gdamp;
        m = p.s * 0.5 + 2;
        span = w + 2 * m; p.x = ((p.x + m) % span + span) % span - m;
        span = h + 2 * m; p.y = ((p.y + m) % span + span) % span - m;

        b = (0.5 + ((p.x - w / 2) * BSIN - (p.y - h / 2) * BCOS) / L - BMID) / BWID; b = Math.exp(-b * b);
        if (p.glow > g) g = p.glow;
        a = p.a * (0.72 + 0.28 * Math.sin(t * p.tw + p.tp)) * (0.6 + 0.62 * b) * boost * (1 + (p.z === 2 ? 0.7 : 1.5) * g);
        e = p.y + off; if (secH - e < e) e = secH - e;      // Abstand zum Kapitelrand
        if (e < 40) a *= e <= 0 ? 0 : e / 40;
        if (a > 0.004) {
          ctx.globalAlpha = a > 1 ? 1 : a; s = p.s * dpr;
          ctx.drawImage(p.z === 2 ? bokehs[p.t] : motes[p.t], p.x * dpr - s / 2, p.y * dpr - s / 2, s, s);
        }
      }

      for (i = f.puffs.length - 1; i >= 0; i--) {
        p = f.puffs[i]; p.life -= dt;
        if (p.life <= 0) { f.puffs.splice(i, 1); continue; }
        q = p.life / p.max; p.y += sh1;
        if (p.ring) { // weicher Lichtfleck, der sich ausdehnt und vergeht
          s = (30 + (1 - q) * (1 - q * 0.4) * 190) * dpr; ctx.globalAlpha = 0.2 * q * q;
          ctx.drawImage(bokehs[2], p.x * dpr - s / 2, p.y * dpr - s / 2, s, s);
        } else {
          p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= damp * damp; p.vy *= damp * damp;
          s = p.d * 3.2 * dpr; ctx.globalAlpha = Math.min(1, 0.85 * q * Math.sqrt(q));
          ctx.drawImage(motes[p.t], p.x * dpr - s / 2, p.y * dpr - s / 2, s, s);
        }
      }
      ctx.globalAlpha = 1;
    }

    /* ein Staubfeld pro dunklem Kapitel */
    var fields = [];
    Array.prototype.forEach.call(secs, function (sec) {
      var cv = D.createElement('canvas'), ctx = cv.getContext('2d');
      if (!ctx) return;
      cv.className = 'fx-dust'; cv.setAttribute('aria-hidden', 'true');
      sec.insertBefore(cv, sec.firstChild);
      sec.classList.add('fx-has-dust');
      var f = { sec: sec, cv: cv, ctx: ctx, w: 0, h: 0, secH: 0, dpr: 1, L: 1, off: 0, left: 0, lastTop: null, parts: [], puffs: [],
        on: false, dirty: true, energy: 0, hov: false, hx: 0, hy: 0, dn: null, phone: false, seed: rnd() * 10 };
      fields.push(f);

      if (W.PointerEvent) {
        sec.addEventListener('pointerdown', function (ev) {
          if (ev.isPrimary === false) return;
          f.dn = { x: ev.clientX, y: ev.clientY, t: ev.timeStamp, id: ev.pointerId };
        }, PASSIVE);
        sec.addEventListener('pointerup', function (ev) {
          var d = f.dn; f.dn = null;
          if (!d || d.id !== ev.pointerId || ev.timeStamp - d.t > 600) return;
          if (Math.abs(ev.clientX - d.x) > 12 || Math.abs(ev.clientY - d.y) > 12) return;   // das war ein Wischen, kein Tipp
          var tg = ev.target;
          if (tg && tg.closest && tg.closest('a,button,input,select,textarea,label,summary,[role="button"]')) return;
          puff(f, ev.clientX, ev.clientY);
        }, PASSIVE);
        sec.addEventListener('pointercancel', function () { f.dn = null; }, PASSIVE);
        if (fineMq.matches) {
          sec.addEventListener('pointermove', function (ev) {
            if (ev.pointerType && ev.pointerType !== 'mouse') return;
            f.hx = ev.clientX; f.hy = ev.clientY; f.hov = true;
          }, PASSIVE);
          sec.addEventListener('pointerleave', function () { f.hov = false; }, PASSIVE);
        }
      }
    });
    if (!fields.length) return;

    /* gezeichnet wird nur, solange ein Kapitel im Bild und der Tab sichtbar ist */
    var raf = 0, last = 0, lastSy = 0;
    function active() { if (D.hidden) return false; for (var i = 0; i < fields.length; i++) if (fields[i].on) return true; return false; }
    function frame(now) {
      raf = 0;
      if (!active()) return;
      raf = W.requestAnimationFrame(frame);
      if (last && now - last < 14) return;                      // höchstens rund 60 Bilder pro Sekunde
      var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016; last = now;
      var sy = W.pageYOffset || 0, dS = sy - lastSy; lastSy = sy;
      var jump = Math.abs(dS) > 1400;                           // Sprung (Anker, Seitenanfang): kein Wirbelsturm
      dS = clamp(dS, -160, 160);
      for (var i = 0; i < fields.length; i++) if (fields[i].on) step(fields[i], dt, now / 1000, dS, jump);
    }
    function kick() {
      if (raf || !active()) return;
      last = 0; lastSy = W.pageYOffset || 0;
      raf = W.requestAnimationFrame(frame);
    }

    var io = new W.IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        for (var i = 0; i < fields.length; i++) {
          if (fields[i].sec !== en.target) continue;
          fields[i].on = en.isIntersecting;
          if (en.isIntersecting) { fields[i].lastTop = null; fields[i].sec.classList.add('fx-dust-on'); }
        }
      });
      kick();
    }, { rootMargin: '80px 0px' });
    fields.forEach(function (f) { io.observe(f.sec); });

    function markDirty() { for (var i = 0; i < fields.length; i++) fields[i].dirty = true; }
    W.addEventListener('resize', markDirty, PASSIVE);
    W.addEventListener('orientationchange', markDirty, PASSIVE);
    if (W.ResizeObserver) {
      var ro = new W.ResizeObserver(function (entries) {
        entries.forEach(function (en) { for (var i = 0; i < fields.length; i++) if (fields[i].sec === en.target) fields[i].dirty = true; });
      });
      fields.forEach(function (f) { ro.observe(f.sec); });
    }
    D.addEventListener('visibilitychange', kick, PASSIVE);
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', start, { passive: true, once: true });
  else start();
})();
