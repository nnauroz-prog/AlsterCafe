/* Alstercafé · Mitgliederbereich */

const STORAGE_KEY    = 'alstercafe.weekly-menu';
const NOTICE_KEY     = 'alstercafe.notice';
const MENU_KEY       = 'alstercafe.menu';
const HOURS_KEY      = 'alstercafe.hours';
const DESIGN_KEY     = 'alstercafe.design';
const AUTH_KEY       = 'alstercafe.auth';
const ACTIVE_TAB_KEY = 'alstercafe.admin.tab';

const MAX_IMAGE_PX = { logo: 480, heroImage: 1400, aboutImage: 1400, gallery: 1200 };
const GALLERY_MAX = 6;

/* Verfuegbare Icons fuer Karten-Kategorien (Dropdown im Editor) */
const MENU_ICONS = [
  { id: 'i-bread', label: 'Brot' },
  { id: 'i-cup',   label: 'Tasse' },
  { id: 'i-wheat', label: 'Ähre' },
  { id: 'i-leaf',  label: 'Blatt' }
];

const DEFAULT_HOURS = [
  { label: 'Mo – Fr',  time: '06:30 – 15:00' },
  { label: 'Samstag',  time: '07:30 – 15:00' },
  { label: 'Sonntag',  time: '07:30 – 15:00' }
];

// Anzeige-Fallback fuer das User-Badge, falls die echte E-Mail (aus
// Supabase) noch nicht geladen ist. Kein Geheimnis — nur eine Adresse.
// (Die frueheren VALID_USERNAMES/VALID_PASSWORD-Konstanten waren toter
// Code mit einem Klartext-Passwort und wurden entfernt — die echte
// Anmeldung laeuft ausschliesslich ueber Supabase-Auth in db.js.)
const DISPLAY_USER = 'inhaber@alstercafe.de';

const DAYS = [
  { key: 'mon', label: 'Montag' },
  { key: 'tue', label: 'Dienstag' },
  { key: 'wed', label: 'Mittwoch' },
  { key: 'thu', label: 'Donnerstag' },
  { key: 'fri', label: 'Freitag' },
  { key: 'sat', label: 'Samstag' },
  { key: 'sun', label: 'Sonntag' }
];

const dom = {};
let currentMonday = mondayOf(new Date());
// Flag: beim naechsten renderWeek() zu heute/Day-Grid-Anfang scrollen.
// Gesetzt von switchTab('week') und changeWeek(), bewusst NICHT von
// onSaveWeek (sonst springt der Viewport beim Speichern zurueck).
let pendingScrollOnRender = false;

// Sonntag-Modus: zeigt heutigen Sonntag + naechste Woche (8 Tage)
// Aktiv wenn der Inhaber sonntags den Admin oeffnet — er kann den
// laufenden Sonntag ueberarbeiten UND die naechste Woche planen.
let sundaySpillover = false;
function maybeEnableSundaySpillover() {
  const today = new Date();
  if (today.getDay() === 0) {
    // Sonntag: zeige naechste Woche, aber mit Sonntag oben
    const nextMonday = new Date(today);
    nextMonday.setDate(nextMonday.getDate() + 1);
    currentMonday = mondayOf(nextMonday);
    sundaySpillover = true;
  }
}
maybeEnableSundaySpillover();

document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheDom();
  if (dom.year) dom.year.textContent = new Date().getFullYear();

  // Sicherstellen, dass auch bei Fehlern immer der Login sichtbar ist
  try {
    // true = immer frischen Stand holen (Inhaber bearbeitet Inhalte).
    if (window.alsterDb) await window.alsterDb.ready(true);
    if (await isAuthenticated()) await showDashboard();
    else showLogin();
  } catch (err) {
    console.error('Admin-Init fehlgeschlagen, zeige Login:', err);
    showLogin();
  }
  document.body.classList.add('is-ready');

  // Login
  dom.loginForm.addEventListener('submit', onLogin);
  initCalendar();
  initFormGuards();
  // Bleibt der Mitgliederbereich über Nacht offen: neuen Tag übernehmen (Heute, Woche,
  // Zähler, Kalender) – aber nie mitten in ungespeicherten Eingaben
  let shownDay = isoDate(new Date());
  setInterval(() => {
    const now = isoDate(new Date());
    if (now === shownDay || dirtyForms.size || dom.dashboard?.hidden) return;
    shownDay = now;
    sundaySpillover = false;
    currentMonday = mondayOf(new Date());
    maybeEnableSundaySpillover();
    calMonday = mondayOf(new Date());
    renderWeek(); renderOverviewSummary(); renderOwnerCalendar(); renderAnfragen(); renderOrders();
    if (dom.welcome) {
      const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
      dom.welcome.innerHTML = `Moin! <span class="welcome-date">${escapeHtml(today)}</span>`;
    }
  }, 5 * 60 * 1000);
  dom.pwToggle.addEventListener('click', onPwToggle);
  dom.logoutBtn.addEventListener('click', onLogout);

  // Tabs
  dom.tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  // Overview-Karten und Back-Button
  dom.overviewCards.forEach(c => c.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab(c.dataset.tab);
  }));
  dom.backToOverview?.addEventListener('click', () => showOverview());
  initBottomBar();
  initOverviewArt();

  // Übersicht-Zähler: Klick springt in den passenden Bereich
  dom.summaryStats.forEach(s => s.addEventListener('click', () => switchTab(s.dataset.tab)));

  // Suche in Anfragen / Bestellungen
  dom.anfragenSearch?.addEventListener('input', () => renderAnfragen());
  dom.ordersSearch?.addEventListener('input', () => renderOrders());

  // Wochenplan
  dom.menuForm.addEventListener('submit', (e) => { e.preventDefault(); runSave('menu-form', () => onSaveWeek(e)); });
  dom.weekPrev.addEventListener('click', () => changeWeek(-7));
  dom.weekNext.addEventListener('click', () => changeWeek(7));
  dom.weekToday.addEventListener('click', async () => {
    if (!(await confirmLeave(dom.menuForm))) return;
    sundaySpillover = false;
    currentMonday = mondayOf(new Date());
    maybeEnableSundaySpillover();
    pendingScrollOnRender = true;
    renderWeek();
  });
  dom.copyPrev.addEventListener('click', onCopyFromPrevious);
  dom.exportJson.addEventListener('click', onExportJson);
  dom.resetWeek.addEventListener('click', onResetWeek);

  // "Mehr"-Dropdown in Wochenplan-Toolbar: nach Menue-Klick und bei
  // Klick ausserhalb wieder schliessen, damit es nicht offen klebt.
  document.querySelectorAll('.toolbar-more').forEach(d => {
    d.querySelectorAll('.toolbar-more-menu button').forEach(b =>
      b.addEventListener('click', () => d.removeAttribute('open'))
    );
  });
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.toolbar-more[open]').forEach(d => {
      if (!d.contains(e.target)) d.removeAttribute('open');
    });
  });

  // Notice
  dom.noticeForm.addEventListener('submit', (e) => { e.preventDefault(); runSave('notice-form', () => onSaveNotice(e)); });
  dom.noticeClear.addEventListener('click', onClearNotice);

  // Speisekarte
  dom.menuCardsForm.addEventListener('submit', (e) => { e.preventDefault(); runSave('menu-cards-form', () => onSaveMenu(e)); });
  const spForm = document.getElementById('specials-form');
  spForm?.addEventListener('submit', (e) => { e.preventDefault(); runSave('specials-form', () => onSaveSpecials()); });
  document.getElementById('specials-add-section')?.addEventListener('click', () => {
    const box = document.getElementById('specials-sections');
    const block = buildMenuSection({ title: '', icon: 'i-cup', items: [{ name: '', desc: '', price: '' }] });
    box?.appendChild(block); block.querySelector('.menu-section-title')?.focus();
  });
  document.getElementById('specials-reset')?.addEventListener('click', onResetSpecials);
  dom.menuReset.addEventListener('click', onResetMenu);
  dom.menuAddSection?.addEventListener('click', () => addMenuSection());
  dom.menuPdf?.addEventListener('click', downloadMenuPdf);
  document.getElementById('week-poster')?.addEventListener('click', printWeekPoster);
  document.getElementById('week-insta')?.addEventListener('click', makeWeekImage);

  // Öffnungszeiten
  dom.hoursForm.addEventListener('submit', (e) => { e.preventDefault(); runSave('hours-form', () => onSaveHours(e)); });
  dom.hoursAdd.addEventListener('click', () => addHourRow());
  dom.hoursReset.addEventListener('click', onResetHours);

  // Urlaub & Feiertage
  dom.holidaysForm?.addEventListener('submit', (e) => { e.preventDefault(); runSave('holidays-form', () => onSaveHolidays(e)); });
  dom.holidaysAdd?.addEventListener('click', () => addHolidayRow());
  dom.holidaysClear?.addEventListener('click', onClearHolidays);
  document.getElementById('holiday-range-add')?.addEventListener('click', onAddHolidayRange);
  document.getElementById('holidays-hh')?.addEventListener('click', onAddHamburgHolidays);
  document.getElementById('holidays-past')?.addEventListener('click', onRemovePastHolidays);

  // Brötchen-Sorten
  dom.broetchenForm?.addEventListener('submit', (e) => { e.preventDefault(); runSave('broetchen-form', () => onSaveBroetchen(e)); });
  dom.broetchenAdd?.addEventListener('click', () => addBroetchenRow());
  dom.broetchenReset?.addEventListener('click', onResetBroetchen);

  // Berliner-Vorbestellung
  document.getElementById('berliner-settings-form')?.addEventListener('submit', (e) => { e.preventDefault(); runSave('berliner-settings-form', () => onSaveBerlinerSettings(e)); });
  document.getElementById('berliner-switch')?.addEventListener('click', onToggleBerliner);
  document.getElementById('berliner-items-form')?.addEventListener('submit', (e) => { e.preventDefault(); runSave('berliner-items-form', () => onSaveBerlinerItems(e)); });
  document.getElementById('berliner-add')?.addEventListener('click', () => addBerlinerRow());

  // Account
  dom.resetAll.addEventListener('click', onResetAll);
  document.getElementById('reset-content')?.addEventListener('click', onResetContent);
  dom.passwordForm?.addEventListener('submit', onChangePassword);

  // Design
  initDesignEditor();
}

function cacheDom() {
  Object.assign(dom, {
    // Login
    loginView:    document.getElementById('login-view'),
    loginForm:    document.getElementById('login-form'),
    loginStatus:  document.getElementById('login-status'),
    pwInput:      document.getElementById('pw-input'),
    pwToggle:     document.getElementById('pw-toggle'),
    // Header / Dashboard
    dashboard:    document.getElementById('dashboard-view'),
    actions:      document.getElementById('admin-actions'),
    logoutBtn:    document.getElementById('logout-btn'),
    welcome:      document.getElementById('welcome-name'),
    userBadge:    document.getElementById('user-badge'),
    syncPill:     document.getElementById('sync-pill'),
    // Tabs
    tabs:         document.querySelectorAll('.admin-tab'),
    panels:       document.querySelectorAll('.admin-panel'),
    // Week
    menuForm:     document.getElementById('menu-form'),
    dayGrid:      document.getElementById('day-grid'),
    saveStatus:   document.getElementById('save-status'),
    weekKw:       document.getElementById('week-kw'),
    weekRange:    document.getElementById('week-range'),
    weekPrev:     document.getElementById('week-prev'),
    weekNext:     document.getElementById('week-next'),
    weekToday:    document.getElementById('week-today'),
    copyPrev:     document.getElementById('copy-prev'),
    exportJson:   document.getElementById('export-json'),
    resetWeek:    document.getElementById('reset-week'),
    // Notice
    noticeForm:   document.getElementById('notice-form'),
    noticeInput:  document.getElementById('notice-input'),
    noticeStatus: document.getElementById('notice-status'),
    noticeClear:  document.getElementById('notice-clear'),
    // Speisekarte
    menuCardsForm: document.getElementById('menu-cards-form'),
    menuSections:  document.getElementById('menu-sections'),
    menuIntro:     document.getElementById('menu-intro'),
    menuFootnote:  document.getElementById('menu-footnote'),
    menuAddSection: document.getElementById('menu-add-section'),
    menuPdf:       document.getElementById('menu-pdf'),
    menuStatus:    document.getElementById('menu-status'),
    menuReset:     document.getElementById('menu-reset'),
    // Öffnungszeiten
    hoursForm:    document.getElementById('hours-form'),
    hoursRows:    document.getElementById('hours-rows'),
    hoursAdd:     document.getElementById('hours-add'),
    // Urlaub & Feiertage
    holidaysForm:   document.getElementById('holidays-form'),
    holidaysRows:   document.getElementById('holidays-rows'),
    holidaysAdd:    document.getElementById('holidays-add'),
    holidaysClear:  document.getElementById('holidays-clear'),
    holidaysStatus: document.getElementById('holidays-status'),
    hoursStatus:  document.getElementById('hours-status'),
    hoursReset:   document.getElementById('hours-reset'),
    // Account
    resetAll:     document.getElementById('reset-all'),
    accountEmail: document.getElementById('account-email'),
    passwordForm: document.getElementById('password-form'),
    newPassword:  document.getElementById('new-password'),
    newPasswordConfirm: document.getElementById('new-password-confirm'),
    passwordStatus: document.getElementById('password-status'),
    year:         document.getElementById('year'),
    // Overview / Workspace
    overviewView: document.getElementById('overview-view'),
    workspaceView: document.getElementById('workspace-view'),
    overviewCards: document.querySelectorAll('.overview-card[data-tab]'),
    backToOverview: document.getElementById('back-to-overview'),
    // Übersicht-Zusammenfassung
    summaryStats:    document.querySelectorAll('.summary-stat[data-tab], .summary-today[data-tab]'),
    summaryAnfragen: document.getElementById('summary-anfragen'),
    summaryOrders:   document.getElementById('summary-orders'),
    summaryTodayDish: document.getElementById('summary-today-dish'),
    summaryNextRes:  document.getElementById('summary-next-res'),
    // Anfragen
    anfragenList:  document.getElementById('anfragen-list'),
    anfragenCount: document.getElementById('anfragen-count'),
    anfragenBadge: document.getElementById('overview-anfragen-badge'),
    tabAnfragenBadge: document.getElementById('tab-anfragen-badge'),
    anfragenSearch: document.getElementById('anfragen-search'),
    // Bestellungen (belegte Brötchen)
    ordersList:    document.getElementById('orders-list'),
    ordersCount:   document.getElementById('orders-count'),
    ordersBadge:   document.getElementById('overview-orders-badge'),
    tabOrdersBadge: document.getElementById('tab-orders-badge'),
    ordersSearch:  document.getElementById('orders-search'),
    // Brötchen-Sorten-Editor
    broetchenForm:   document.getElementById('broetchen-form'),
    broetchenEditor: document.getElementById('broetchen-editor'),
    broetchenAdd:    document.getElementById('broetchen-add'),
    broetchenReset:  document.getElementById('broetchen-reset'),
    broetchenStatus: document.getElementById('broetchen-status')
  });
}

/* ---------- Auth ---------- */

async function isAuthenticated() {
  try { return await window.alsterDb.auth.isAuthed(); }
  catch { return false; }
}

async function onLogin(e) {
  e.preventDefault();
  // Doppel-Submit-Schutz: Login-Knopf sofort sperren. Sonst koennte ein
  // Doppel-Tap zwei parallele Auth-Requests starten und das Konto
  // bei Supabase rate-limiten.
  const submitBtn = dom.loginForm.querySelector('button[type="submit"]');
  if (submitBtn?.disabled) return;
  if (submitBtn) submitBtn.disabled = true;

  const data = new FormData(dom.loginForm);
  const u = data.get('username');
  const p = data.get('password');

  setStatus(dom.loginStatus, 'Anmeldung läuft …');
  try {
    const result = await window.alsterDb.auth.signIn(u, p);
    if (result.ok) {
      setStatus(dom.loginStatus, '');
      // Bei "?next=edit": direkt zurück in den Bearbeitungsmodus
      const params = new URLSearchParams(window.location.search);
      if (params.get('next') === 'edit') {
        window.location.href = 'index.html?edit=1';
        return;
      }
      await showDashboard();
    } else {
      setStatus(dom.loginStatus,
        result.error || 'Benutzername oder Passwort ist nicht korrekt.',
        'error');
      if (submitBtn) submitBtn.disabled = false;
    }
  } catch (err) {
    setStatus(dom.loginStatus, 'Anmeldung fehlgeschlagen — bitte erneut versuchen.', 'error');
    if (submitBtn) submitBtn.disabled = false;
  }
}

function onPwToggle() {
  const isHidden = dom.pwInput.type === 'password';
  dom.pwInput.type = isHidden ? 'text' : 'password';
  dom.pwToggle.setAttribute('aria-label', isHidden ? 'Passwort verbergen' : 'Passwort anzeigen');
  dom.pwToggle.querySelector('use').setAttribute('href', isHidden ? '#i-eye-off' : '#i-eye');
}

async function onLogout() {
  if (!(await confirmLeave())) return;
  await window.alsterDb.auth.signOut();
  // Gast-Daten (Namen, Telefon, E-Mail) nicht im Browser liegen lassen.
  try {
    ['reservations', 'orders', 'activity'].forEach(k => localStorage.removeItem('alstercafe.' + k));
  } catch (e) {}
  showLogin();
  location.reload();
}

function showLogin() {
  dom.loginView.hidden = false;
  dom.dashboard.hidden = true;
  dom.actions.hidden = true;
}

async function showDashboard() {
  dom.loginView.hidden = true;
  dom.dashboard.hidden = false;
  dom.actions.hidden = false;
  // Tatsaechliche E-Mail aus dem Backend (Demo: Default-Wert)
  const email = await (window.alsterDb?.auth.getEmail()) || DISPLAY_USER;
  if (dom.userBadge)    dom.userBadge.textContent = email;
  if (dom.accountEmail) dom.accountEmail.textContent = email;
  // Begrüßung: „Moin!“ + heutiges Datum (statt nur „Mitgliederbereich“)
  if (dom.welcome) {
    const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    dom.welcome.innerHTML = `Moin! <span class="welcome-date">${escapeHtml(today)}</span>`;
  }
  // Default-Landing: Overview. Tab-Inhalte werden lazy beim Klick aktiv.
  showOverview();
  renderWeek();
  renderOverviewSummary();
  renderNotice();
  renderMenuEditor();
  renderSpecialsEditor();
  renderHoursEditor();
  renderHolidaysEditor();
  renderDesignEditor();
  renderActivityLog();
  renderBroetchenEditor();
  renderBerlinerAdmin();
  renderOwnerCalendar();
  renderStaffAccessState();
  refreshAnfragen();
  refreshOrders();
  // Live-Update wenn ueber das oeffentliche Formular etwas reinkommt
  if (!window.__alsterInboxSubscribed) {
    window.__alsterInboxSubscribed = true;
    window.alsterDb?.subscribe?.(async (key) => {
      // Inhalte wurden auf einem anderen Gerät geändert → Editor auffrischen,
      // aber nie über ungespeicherte Eingaben hinweg
      const editors = {
        'weekly-menu': ['menu-form', () => { renderWeek(); renderOverviewSummary(); }],
        'menu': ['menu-cards-form', () => renderMenuEditor()],
        'specials': ['specials-form', () => renderSpecialsEditor()],
        'hours': ['hours-form', () => renderHoursEditor()],
        'holidays': ['holidays-form', () => { renderHolidaysEditor(); renderOwnerCalendar(); }],
        'notice': ['notice-form', () => renderNotice()],
        'broetchen-items': ['broetchen-form', () => renderBroetchenEditor()],
        'berliner-settings': ['berliner-settings-form', () => renderBerlinerAdmin()],
        'berliner-items': ['berliner-items-form', () => renderBerlinerAdmin()],
        'design': [null, () => renderDesignEditor()]
      };
      if (editors[key]) {
        const [formId, fn] = editors[key];
        const busy = formId && (dirtyForms.has(formId) || (key.startsWith('berliner') && (dirtyForms.has('berliner-settings-form') || dirtyForms.has('berliner-items-form'))));
        if (!busy) { try { fn(); } catch (e) { console.warn(e); } }
        return;
      }
      if (key !== 'reservations' && key !== 'orders') return;
      // Vorher bekannte Einträge merken → nur wirklich neue melden
      const ids = (() => { const l = window.alsterDb?.get(key); return new Set((Array.isArray(l) ? l : []).map(x => x.id)); })();
      if (key === 'reservations') await refreshAnfragen(); else await refreshOrders();
      const list = window.alsterDb?.get(key);
      const fresh = (Array.isArray(list) ? list : []).filter(x => x && !ids.has(x.id) && x.status !== 'done');
      if (fresh.length) announceNewEntries(key, fresh);
    });
  }
  // Sichtbare Anzeige, ob die Live-Verbindung steht (Aenderungen erscheinen
  // dann sofort auf allen Geraeten). Gibt der Inhaberin Gewissheit.
  window.alsterDb?.onSyncStatus?.(updateSyncPill);
}

/* Spiegelt den Live-Verbindungsstatus in die Header-Pille.
   Statuswerte kommen aus db.js (Supabase-Channel + 'LOCAL'). */
function updateSyncPill(status) {
  const el = dom.syncPill;
  if (!el) return;
  // Im lokalen Modus (keine Supabase-Verbindung) gibt es kein Geraete-Sync
  // zu melden — Pille ausblenden statt Verwirrung zu stiften.
  if (status === 'LOCAL') { el.hidden = true; return; }
  let cls, label;
  if (status === 'SUBSCRIBED') {
    cls = 'is-live';
    label = 'Live verbunden';
    el.title = 'Live verbunden — Änderungen erscheinen sofort auf allen Geräten.';
  } else if (status === 'CONNECTING') {
    cls = 'is-connecting';
    label = 'Verbinde …';
    el.title = 'Verbindung zur Datenbank wird aufgebaut …';
  } else {
    cls = 'is-offline';
    label = 'Nicht live';
    el.title = 'Keine Live-Verbindung zum Server — Änderungen erscheinen erst nach dem Neuladen. Bitte Internetverbindung prüfen.';
  }
  el.hidden = false;
  el.innerHTML = '<span class="sync-dot"></span><span class="sync-text"></span>';
  el.querySelector('.sync-text').textContent = label;
  el.classList.remove('is-live', 'is-connecting', 'is-offline');
  el.classList.add(cls);
}

/* ---------- Kalender (Inhaber) + Mitarbeiter-Code ----------
   Darstellung kommt aus calendar.js (gemeinsam mit kalender.html, dem
   Mitarbeiter-Kalender mit 6-stelligem Code, ohne Kontaktdaten). */
let calMonday = mondayOf(new Date());

function initCalendar() {
  const on = (id, ev, fn) => document.getElementById(id)?.addEventListener(ev, fn);
  const shift = (d) => { calMonday = new Date(calMonday); calMonday.setDate(calMonday.getDate() + d); calMonday = mondayOf(calMonday); renderOwnerCalendar(); };
  on('cal-prev', 'click', () => shift(-7));
  on('cal-next', 'click', () => shift(7));
  on('cal-today', 'click', () => { calMonday = mondayOf(new Date()); renderOwnerCalendar(); });
  on('staff-code-form', 'submit', onSaveStaffCode);
  on('staff-code-off', 'click', async () => {
    if (!(await askConfirm('Der bisherige Code gilt dann nicht mehr. Mitarbeiter sehen den Kalender erst wieder mit einem neuen Code.', { title: 'Kalender-Code ausschalten?', ok: 'Ausschalten' }))) return;
    const res = await window.alsterDb?.setStaffCode('');
    const el = document.getElementById('staff-code-status');
    if (res?.ok) setStatus(el, 'Mitarbeiter-Zugang ist ausgeschaltet.', 'ok');
    else setStatus(el, staffSetupText(res?.error), 'error');
    renderStaffAccessState();
  });
}

let spotlight = { id: null, until: 0 };
const spotClass = (id) => (spotlight.id === id && Date.now() < spotlight.until) ? ' is-spotlit' : '';
/* Kalender-Eintrag antippen → passende Karte öffnen, hinscrollen, kurz hervorheben */
async function openEntryCard(kind, id) {
  const tab = kind === 'order' ? 'bestellungen' : 'anfragen';
  await switchTab(tab);
  const panel = document.getElementById('panel-' + tab);
  // Der Bereichswechsel läuft ggf. als View-Transition: kurz warten, bis er sichtbar ist
  for (let i = 0; i < 20 && panel && panel.hidden; i++) await new Promise(res => setTimeout(res, 40));
  if (!panel || panel.hidden) return;
  const search = document.getElementById(kind === 'order' ? 'orders-search' : 'anfragen-search');
  if (search && search.value) { search.value = ''; search.dispatchEvent(new Event('input', { bubbles: true })); }
  const card = document.querySelector(`[data-mark="${CSS.escape(id)}"]`)?.closest('.anfrage-item');
  if (!card) return;
  const pastList = card.closest('details');
  if (pastList && !pastList.open) pastList.open = true;
  card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  spotlight = { id, until: Date.now() + 2400 };
  card.classList.add('is-spotlit');
}

function staffSetupText(err) {
  return err === 'setup'
    ? 'Der Mitarbeiter-Zugang ist in der Datenbank noch nicht eingerichtet (SQL-Schritt fehlt).'
    : 'Speichern fehlgeschlagen' + (err ? `: ${err}` : '.');
}

function renderOwnerCalendar() {
  const el = document.getElementById('owner-cal');
  if (!el || !window.AlsterCalendar) return;
  const lbl = window.AlsterCalendar.weekLabel(calMonday);
  const kw = document.getElementById('cal-kw'); if (kw) kw.textContent = lbl.kw;
  const range = document.getElementById('cal-range'); if (range) range.textContent = lbl.range;
  const res = window.alsterDb?.get('reservations') || [];
  const ord = window.alsterDb?.get('orders') || [];
  window.AlsterCalendar.render(el, { reservations: Array.isArray(res) ? res : [], orders: Array.isArray(ord) ? ord : [] }, calMonday, { onOpen: openEntryCard });
}

async function renderStaffAccessState() {
  const el = document.getElementById('staff-access-state');
  if (!el) return;
  const active = await window.alsterDb?.isStaffCodeSet();
  if (active === null || active === undefined) {
    el.textContent = 'Noch nicht eingerichtet: Bitte einmal den SQL-Schritt „Mitarbeiter-Kalender“ in Supabase ausführen. Danach hier einen Code festlegen.';
  } else if (active) {
    el.innerHTML = 'Der Zugang ist <strong>aktiv</strong>. Mitarbeiter öffnen <strong>alstercafe.de/kalender.html</strong> und geben den 6-stelligen Code ein. Sie sehen Namen, Uhrzeiten und Bestellungen – keine Telefonnummern oder E-Mails.';
  } else {
    el.textContent = 'Der Zugang ist ausgeschaltet. Legen Sie einen 6-stelligen Code fest, um ihn einzuschalten.';
  }
}

async function onSaveStaffCode(e) {
  e.preventDefault();
  const input = document.getElementById('staff-code-new');
  const status = document.getElementById('staff-code-status');
  const code = (input.value || '').trim();
  if (!/^\d{6}$/.test(code)) { setStatus(status, 'Bitte genau 6 Ziffern eingeben (nur Zahlen).', 'error'); return; }
  if (/^(\d)\1+$/.test(code) || '01234567890'.includes(code) || '98765432109'.includes(code)) {
    setStatus(status, 'Bitte keinen zu einfachen Code wie 111111 oder 123456 wählen.', 'error'); return;
  }
  const res = await window.alsterDb?.setStaffCode(code);
  if (res?.ok) {
    input.value = '';
    setStatus(status, `Gespeichert. Der neue Code ist ${code} – bitte den Mitarbeitern persönlich sagen. Der alte Code gilt nicht mehr.`, 'ok');
  } else {
    setStatus(status, staffSetupText(res?.error), 'error');
  }
  renderStaffAccessState();
}

/* ---------- Formular-System ----------
   Jedes Bearbeitungs-Formular meldet ungespeicherte Änderungen. Wer den Bereich
   verlässt (Tab, „Zurück“, andere Woche, Abmelden, Seite schließen), wird gefragt.
   Speichern läuft über runSave: Knopf gesperrt, kein Doppel-Speichern, erst nach
   Erfolg gilt das Formular als gespeichert. */
const GUARDED_FORMS = {
  'menu-form': 'Mittagstisch',
  'menu-cards-form': 'Speisekarte',
  'specials-form': 'Sommer-Specials',
  'hours-form': 'Öffnungszeiten',
  'holidays-form': 'Schließtage',
  'notice-form': 'Hinweis-Banner',
  'broetchen-form': 'Brötchen-Sorten',
  'berliner-settings-form': 'Berliner-Aktion',
  'berliner-items-form': 'Berliner-Sorten'
};
const dirtyForms = new Set();

function initFormGuards() {
  Object.keys(GUARDED_FORMS).forEach(id => {
    const f = document.getElementById(id);
    if (!f || f.dataset.guarded) return;
    f.dataset.guarded = '1';
    const mark = (e) => {
      if (e.target.closest('[data-no-dirty]')) return;
      if (e.type === 'click' && !e.target.closest('button[type="button"]')) return;
      markDirty(id);
    };
    f.addEventListener('input', mark);
    f.addEventListener('change', mark);
    f.addEventListener('click', mark);
  });
  window.addEventListener('beforeunload', (e) => {
    if (!dirtyForms.size) return;
    e.preventDefault();
    e.returnValue = '';
  });
}

/* Einheitliche Rückmeldung in jeder Speichern-Leiste */
function formStatusEl(id) { return document.getElementById(id)?.querySelector('.save-status'); }
const nowHM = () => new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
function markDirty(id) {
  if (!GUARDED_FORMS[id]) return;
  const first = !dirtyForms.has(id);
  dirtyForms.add(id);
  document.getElementById(id)?.classList.add('is-dirty');
  const st = formStatusEl(id);
  if (first && st && !st.classList.contains('error')) { st.textContent = 'Nicht gespeicherte Änderungen'; st.classList.remove('ok'); st.classList.add('is-pending'); }
}
function markClean(id) {
  dirtyForms.delete(id);
  document.getElementById(id)?.classList.remove('is-dirty');
  formStatusEl(id)?.classList.remove('is-pending');
}
/* Erfolgs-Moment: goldener Haken zeichnet sich in der Speichern-Leiste */
function celebrateSave(form) {
  const bar = form.querySelector('.save-bar');
  if (!bar) return;
  let tick = bar.querySelector('.save-tick');
  if (!tick) {
    tick = document.createElement('span');
    tick.className = 'save-tick'; tick.setAttribute('aria-hidden', 'true');
    tick.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5" pathLength="1"/><path d="M7 12.5l3.2 3.2L17 9" pathLength="1"/></svg>';
    bar.prepend(tick);
  }
  tick.classList.remove('is-on'); void tick.offsetWidth; tick.classList.add('is-on');
}

async function runSave(id, fn) {
  const f = document.getElementById(id);
  if (!f || f.dataset.saving) return;
  f.dataset.saving = '1';
  const btns = Array.from(f.querySelectorAll('button[type="submit"]'));
  btns.forEach(b => { b.disabled = true; b.setAttribute('aria-busy', 'true'); });
  const st = f.querySelector('.save-status');
  if (st) { st.textContent = 'Wird gespeichert …'; st.classList.remove('ok', 'error', 'is-pending'); }
  try {
    const ok = await fn();
    if (ok !== false) {
      markClean(id);
      if (st && (st.textContent === 'Wird gespeichert …' || !st.textContent.trim())) setStatus(st, `Gespeichert · ${nowHM()} Uhr`, 'ok');
      if (st && st.classList.contains('ok')) celebrateSave(f);
    } else if (st && st.textContent === 'Wird gespeichert …') {
      setStatus(st, 'Fehler – nicht gespeichert. Bitte erneut versuchen.', 'error');
    }
  } catch (err) {
    console.error('Speichern fehlgeschlagen', err);
    warnWriteFailed();
  } finally {
    delete f.dataset.saving;
    btns.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); });
  }
}

/* Schönes Auswahlfenster statt grauem Browser-Fenster. Liefert den value des Knopfs, null bei Abbruch. */
function askChoice({ title, text, actions }) {
  return new Promise(resolve => {
    const dlg = document.createElement('dialog');
    if (typeof dlg.showModal !== 'function') { resolve(confirm(`${title}\n\n${text}`) ? actions[actions.length - 1].value : null); return; }
    dlg.className = 'confirm-dialog';
    dlg.innerHTML = `
      <div class="confirm-dialog-form">
        <h3 class="confirm-dialog-title">${escapeHtml(title)}</h3>
        <p class="confirm-dialog-hint">${escapeHtml(text)}</p>
        <div class="confirm-dialog-actions">
          ${actions.map((a, i) => `<button type="button" class="btn ${a.kind === 'primary' ? 'btn-primary' : a.kind === 'danger-solid' ? 'btn-primary btn-danger' : a.kind === 'danger' ? 'btn-link danger' : 'btn-link'}" data-i="${i}">${escapeHtml(a.label)}</button>`).join('')}
        </div>
      </div>`;
    document.body.appendChild(dlg);
    let result = null;
    dlg.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { result = actions[+b.dataset.i].value; dlg.close(); }));
    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
    dlg.showModal();
    // Gefährliche Aktionen nie vorauswählen: Fokus dann auf „Abbrechen“
    (dlg.querySelector('.btn-danger') ? dlg.querySelector('[data-i="0"]') : dlg.querySelector('.btn-primary, [data-i]'))?.focus();
  });
}

/* Einheitliche Sicherheitsabfrage (statt grauem Browser-Fenster). true = bestätigt. */
async function askConfirm(text, { title = 'Sind Sie sicher?', ok = 'Ja, fortfahren', danger = true } = {}) {
  const v = await askChoice({ title, text, actions: [
    { label: 'Abbrechen', value: 'no' },
    { label: ok, value: 'yes', kind: danger ? 'danger-solid' : 'primary' }
  ] });
  return v === 'yes';
}
/* Hinweis mit nur einem Knopf (statt alert) */
function askNotice(title, text) {
  return askChoice({ title, text, actions: [{ label: 'Verstanden', value: 'ok', kind: 'primary' }] });
}

/* Vor dem Verlassen: ungespeicherte Formulare (optional nur in einem Bereich) abfragen.
   true = weiter (gespeichert oder verworfen), false = bleiben. */
async function confirmLeave(scopeEl) {
  const ids = Array.from(dirtyForms).filter(id => !scopeEl || scopeEl.contains(document.getElementById(id)));
  if (!ids.length) return true;
  const names = ids.map(id => GUARDED_FORMS[id]).join(', ');
  const choice = await askChoice({
    title: 'Ungespeicherte Änderungen',
    text: `In „${names}“ gibt es Änderungen, die noch nicht gespeichert sind.`,
    actions: [
      { label: 'Weiter bearbeiten', value: 'stay' },
      { label: 'Verwerfen', value: 'discard', kind: 'danger' },
      { label: 'Speichern', value: 'save', kind: 'primary' }
    ]
  });
  if (choice === 'save') {
    for (const id of ids) {
      const f = document.getElementById(id);
      if (f) f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable: true }));
    }
    // kurz warten, bis die Speicherung durch ist
    for (let i = 0; i < 40 && ids.some(id => document.getElementById(id)?.dataset.saving); i++) await new Promise(r => setTimeout(r, 100));
    return !ids.some(id => dirtyForms.has(id));
  }
  if (choice === 'discard') {
    ids.forEach(id => { markClean(id); rerenderForm(id); });
    return true;
  }
  return false;
}
function rerenderForm(id) {
  ({
    'menu-form': () => renderWeek(),
    'menu-cards-form': () => renderMenuEditor(),
    'specials-form': () => renderSpecialsEditor(),
    'hours-form': () => renderHoursEditor(),
    'holidays-form': () => renderHolidaysEditor(),
    'notice-form': () => renderNotice(),
    'broetchen-form': () => renderBroetchenEditor(),
    'berliner-settings-form': () => renderBerlinerAdmin(),
    'berliner-items-form': () => renderBerlinerAdmin()
  }[id] || (() => {}))();
}
function activePanel() {
  if (dom.workspaceView?.hidden) return null;
  return Array.from(dom.panels || []).find(p => !p.hidden) || null;
}

/* ---------- Tabs ---------- */

async function showOverview() {
  const panel = activePanel();
  if (panel && !(await confirmLeave(panel))) return;
  dom.dashboard?.classList.remove('is-working');
  if (dom.overviewView) dom.overviewView.hidden = false;
  if (dom.workspaceView) dom.workspaceView.hidden = true;
  setBottomBarActive('overview');
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
}

async function switchTab(name) {
  const panel = activePanel();
  if (panel && panel.id !== `panel-${name}` && !(await confirmLeave(panel))) return;
  const apply = () => {
    dom.dashboard?.classList.add('is-working');
    if (dom.overviewView) dom.overviewView.hidden = true;
    if (dom.workspaceView) dom.workspaceView.hidden = false;
    dom.tabs.forEach(t => {
      const active = t.dataset.tab === name;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', String(active));
    });
    dom.panels.forEach(p => {
      const active = p.id === `panel-${name}`;
      p.classList.toggle('is-active', active);
      p.hidden = !active;
    });
    try { sessionStorage.setItem(ACTIVE_TAB_KEY, name); } catch {}
    setBottomBarActive(name);
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
    // Beim Wechsel auf Mittagsmenue: heutigen Tag in den Sichtbereich
    // rollen (renderWeek hat diese Logik gegen das Flag).
    if (name === 'week' && !dirtyForms.has('menu-form')) { pendingScrollOnRender = true; renderWeek(); }
  };
  // Smooth Tab-Wechsel via View-Transitions API (Chromium); Fallback: direkt
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.startViewTransition(apply);
  } else {
    apply();
  }
}

/* ---------- Wochenplan ---------- */

async function changeWeek(deltaDays) {
  if (!(await confirmLeave(dom.menuForm))) return;
  sundaySpillover = false; // Manueller Wochen-Wechsel deaktiviert Spillover
  const d = new Date(currentMonday);
  d.setDate(d.getDate() + deltaDays);
  currentMonday = mondayOf(d);
  pendingScrollOnRender = true;
  renderWeek();
}

async function onResetWeek() {
  if (!(await askConfirm('Alle Gerichte dieser Woche werden entfernt.', { title: 'Woche leeren?', ok: 'Woche leeren' }))) return;
  const all = loadAll();
  delete all[isoDate(currentMonday)];
  const ok = await saveAll(all);
  renderWeek();
  reportWeekSave(ok, 'Woche zurückgesetzt.');
  if (ok) { logActivity('Woche zurückgesetzt'); renderOverviewSummary(); }
}

async function onCopyFromPrevious() {
  if (!(await confirmLeave(dom.menuForm))) return;
  const prevMonday = new Date(currentMonday);
  prevMonday.setDate(prevMonday.getDate() - 7);
  const all = loadAll();
  const prev = all[isoDate(prevMonday)];
  if (!prev || !prev.days || !Object.keys(prev.days).length) {
    setStatus(dom.saveStatus, 'Keine Daten in der Vorwoche gefunden.', 'error');
    return;
  }
  if (!(await askConfirm('Die Einträge dieser Woche werden dabei ersetzt und sofort gespeichert.', { title: 'Vorwoche übernehmen?', ok: 'Übernehmen', danger: false }))) return;
  all[isoDate(currentMonday)] = {
    weekStart: isoDate(currentMonday),
    updatedAt: new Date().toISOString(),
    days: JSON.parse(JSON.stringify(prev.days))
  };
  const ok = await saveAll(all);
  renderWeek();
  reportWeekSave(ok, `Vorwoche übernommen und gespeichert · ${formatTime(new Date())}. Änderungen danach bitte erneut speichern.`);
  if (ok) { logActivity('Vorwoche übernommen'); renderOverviewSummary(); }
}

function onExportJson() {
  const all = loadAll();
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `alstercafe-wochenplan-${isoDate(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function onSaveWeek(e) {
  e.preventDefault();
  const all = loadAll();

  // Aktuelle Woche aus den 7 Standard-Karten lesen
  const week = readFormToWeek();
  // Beilage ohne Gericht würde auf der Webseite nie erscheinen → vorher melden
  const orphan = DAYS.filter(d => { const x = week[d.key]; return x && !x.closed && ((x.side && !x.dish && !x.dish2) || (x.side2 && !x.dish2)); }).map(d => d.label);
  if (orphan.length) {
    setStatus(dom.saveStatus, `Nicht gespeichert: Bei ${orphan.join(', ')} steht eine Beilage ohne Gericht. Bitte das Gericht ergänzen oder die Beilage löschen.`, 'error');
    return false;
  }
  all[isoDate(currentMonday)] = {
    weekStart: isoDate(currentMonday),
    updatedAt: new Date().toISOString(),
    days: week
  };

  // Sonntag-Spillover: Sonntag-Karte gehoert zur Vorwoche
  if (sundaySpillover) {
    const data = new FormData(dom.menuForm);
    const dish   = (data.get('spillover-sun-dish')   || '').toString().trim();
    const side   = (data.get('spillover-sun-side')   || '').toString().trim();
    const dish2  = (data.get('spillover-sun-dish2')  || '').toString().trim();
    const side2  = (data.get('spillover-sun-side2')  || '').toString().trim();
    const closed = data.get('spillover-sun-closed') === 'on';
    const today = new Date();
    // Woche, die den heutigen Sonntag enthaelt (mondayOf(heute)) — muss mit
    // dem Lade-Schluessel oben UND der Startseiten-Logik uebereinstimmen.
    const prevMonday = mondayOf(today);
    const prevKey = isoDate(prevMonday);
    const prevWeek = all[prevKey] || { weekStart: prevKey, days: {} };
    prevWeek.days = prevWeek.days || {};
    if (dish || side || dish2 || side2 || closed) {
      prevWeek.days.sun = { dish, side, closed };
      if (dish2 || side2) { prevWeek.days.sun.dish2 = dish2; prevWeek.days.sun.side2 = side2; }
    } else {
      // Karte geleert → Eintrag wirklich entfernen (sonst bliebe das alte Gericht online)
      delete prevWeek.days.sun;
    }
    prevWeek.updatedAt = new Date().toISOString();
    all[prevKey] = prevWeek;
  }

  const ok = await saveAll(all);
  renderWeek();
  reportWeekSave(ok, `Gespeichert · ${formatTime(new Date())}`);
  if (ok) { logActivity('Wochenplan gespeichert'); renderOverviewSummary(); }
  return ok;
}

function renderWeek() {
  markClean('menu-form');
  const weekKw = isoWeek(currentMonday);
  const sunday = new Date(currentMonday); sunday.setDate(sunday.getDate() + 6);
  dom.weekKw.textContent = sundaySpillover ? `Heute + KW ${weekKw}` : `KW ${weekKw}`;
  dom.weekRange.textContent = `${formatShort(currentMonday)} – ${formatShort(sunday)}`;

  const all = loadAll();
  const stored = all[isoDate(currentMonday)] || { days: {} };

  dom.dayGrid.innerHTML = '';

  // Sonntag-Spillover: heute (laufender Sonntag) als erste Karte rendern
  // Daten kommen aus der laufenden Woche (die Woche, die den heutigen
  // Sonntag enthaelt). WICHTIG: mondayOf(heute) — NICHT heute−7 Tage, sonst
  // landet man eine Woche zu frueh und die Startseite (liest mondayOf(heute))
  // findet den Eintrag nicht.
  if (sundaySpillover) {
    const todaySunday = new Date();
    const prevMonday = mondayOf(todaySunday);
    const prevWeekData = all[isoDate(prevMonday)] || { days: {} };
    const prevSundayEntry = prevWeekData.days.sun || {};
    dom.dayGrid.appendChild(buildDayCard({
      label: 'Heute · Sonntag',
      key: 'sun',
      date: todaySunday,
      saved: prevSundayEntry,
      isToday: true,
      weekKey: isoDate(prevMonday),
      isSpillover: true
    }));
  }

  DAYS.forEach((day, idx) => {
    const date = new Date(currentMonday); date.setDate(date.getDate() + idx);
    const saved = stored.days[day.key] || {};
    const isToday = isSameDay(date, new Date());
    dom.dayGrid.appendChild(buildDayCard({
      label: day.label,
      key: day.key,
      date,
      saved,
      isToday,
      weekKey: isoDate(currentMonday),
      isSpillover: false
    }));
  });

  dom.dayGrid.querySelectorAll('.day-toggle:not(.day-toggle-croque) input').forEach(cb => {
    const card = cb.closest('.day-card');
    cb.addEventListener('change', () => card.classList.toggle('is-closed', cb.checked));
  });

  // Wenn ein Scroll-Hinweis gesetzt ist: heutigen Tag oder Day-Grid-
  // Anfang in den Sichtbereich rollen. Wird vom Tab-Wechsel + von
  // Wochen-Navigation gesetzt — nicht aber nach jedem Speichern,
  // damit Maria nicht aus dem aktuellen Bearbeitungs-Kontext
  // gerissen wird.
  if (pendingScrollOnRender) {
    pendingScrollOnRender = false;
    requestAnimationFrame(() => {
      const todayCard = dom.dayGrid.querySelector('.day-card.is-today');
      if (todayCard) {
        todayCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        dom.dayGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  setStatus(dom.saveStatus,
    stored.updatedAt
      ? `Zuletzt gespeichert · ${formatDateTime(new Date(stored.updatedAt))}`
      : 'Noch nicht gespeichert.');
}

function buildDayCard({ label, key, date, saved, isToday, weekKey, isSpillover }) {
  const card = document.createElement('div');
  card.className = 'day-card'
    + (isToday ? ' is-today' : '')
    + (saved.closed ? ' is-closed' : '')
    + (isSpillover ? ' is-spillover' : '');
  card.dataset.weekKey = weekKey;
  card.dataset.dayKey  = key;
  // Spillover-Karten brauchen unique input-names damit sie nicht mit
  // den naechste-Woche-Karten kollidieren
  const fieldPrefix = isSpillover ? `spillover-${key}` : key;
  card.innerHTML = `
    <div class="day-card-head">
      <div>
        <span class="day-name">${escapeHtml(label)}</span>
        <span class="day-date">${formatShort(date)}</span>
      </div>
      ${isToday ? '<span class="day-pill">Heute</span>' : ''}
    </div>
    <label class="day-field">
      <span class="day-field-label">Hauptgericht</span>
      <textarea name="${fieldPrefix}-dish" rows="2" placeholder="z. B. Hähnchenschenkel mit Gemüse">${escapeHtml(saved.dish || '')}</textarea>
    </label>
    <label class="day-field">
      <span class="day-field-label">Beilage</span>
      <input type="text" name="${fieldPrefix}-side" placeholder="z. B. Reis und Salat" value="${escapeAttr(saved.side || '')}" />
    </label>
    <details class="day-alt"${saved.dish2 || saved.side2 ? ' open' : ''}>
      <summary><span class="day-alt-or">oder</span> Zweites Gericht zur Wahl (optional)</summary>
      <label class="day-field">
        <span class="day-field-label">2. Gericht</span>
        <textarea name="${fieldPrefix}-dish2" rows="2" placeholder="z. B. Gemüse-Curry (vegetarisch)">${escapeHtml(saved.dish2 || '')}</textarea>
      </label>
      <label class="day-field">
        <span class="day-field-label">Beilage zum 2. Gericht</span>
        <input type="text" name="${fieldPrefix}-side2" placeholder="z. B. Basmatireis" value="${escapeAttr(saved.side2 || '')}" />
      </label>
    </details>
    <label class="day-toggle">
      <input type="checkbox" name="${fieldPrefix}-closed" ${saved.closed ? 'checked' : ''} />
      <span class="day-toggle-track"><span class="day-toggle-thumb"></span></span>
      <span class="day-toggle-text">An diesem Tag kein Mittagstisch</span>
    </label>
    <label class="day-toggle day-toggle-croque">
      <input type="checkbox" name="${fieldPrefix}-croque" ${saved.croque ? 'checked' : ''} />
      <span class="day-toggle-track"><span class="day-toggle-thumb"></span></span>
      <span class="day-toggle-text">Croque-Tag (Croques statt Mittagstisch)</span>
    </label>
  `;
  return card;
}

function readFormToWeek() {
  const data = new FormData(dom.menuForm);
  const week = {};
  DAYS.forEach(day => {
    const dish = (data.get(`${day.key}-dish`) || '').toString().trim();
    const side = (data.get(`${day.key}-side`) || '').toString().trim();
    const dish2 = (data.get(`${day.key}-dish2`) || '').toString().trim();
    const side2 = (data.get(`${day.key}-side2`) || '').toString().trim();
    const closed = data.get(`${day.key}-closed`) === 'on';
    const croque = closed && data.get(`${day.key}-croque`) === 'on';
    if (dish || side || dish2 || side2 || closed) {
      week[day.key] = { dish, side, closed };
      if (croque) week[day.key].croque = true;
      // Zweites Gericht nur speichern, wenn eingetragen (ältere Einträge bleiben gleich)
      if (dish2 || side2) { week[day.key].dish2 = dish2; week[day.key].side2 = side2; }
    }
  });
  return week;
}

/* ---------- Notice ---------- */

function renderNotice() {
  markClean('notice-form');
  const text = loadNotice();
  if (dom.noticeInput) dom.noticeInput.value = text;
  setStatus(dom.noticeStatus, text ? 'Banner ist aktiv.' : 'Kein Banner aktiv.');
}

async function onSaveNotice(e) {
  e.preventDefault();
  const text = (dom.noticeInput.value || '').trim();
  const ok = await saveNotice(text);
  if (!ok) { setStatus(dom.noticeStatus, 'Speichern fehlgeschlagen.', 'error'); warnWriteFailed(); return false; }
  setStatus(dom.noticeStatus, text ? 'Hinweis gespeichert. Banner ist sichtbar.' : 'Banner ausgeblendet.', 'ok');
  return true;
}

async function onClearNotice() {
  dom.noticeInput.value = '';
  const ok = await saveNotice('');
  if (!ok) { setStatus(dom.noticeStatus, 'Speichern fehlgeschlagen.', 'error'); warnWriteFailed(); return; }
  setStatus(dom.noticeStatus, 'Banner ausgeblendet.', 'ok');
}

/* ---------- Speisekarte ---------- */

function loadMenuData() {
  const stored = window.alsterDb?.get('menu');
  if (stored && Array.isArray(stored.sections) && stored.sections.length) {
    return JSON.parse(JSON.stringify(stored));
  }
  if (window.ALSTERCAFE_MENU_DEFAULT) {
    return JSON.parse(JSON.stringify(window.ALSTERCAFE_MENU_DEFAULT));
  }
  return { intro: '', sections: [], footnote: '' };
}

function renderMenuEditor() {
  markClean('menu-cards-form');
  if (!dom.menuSections) return;
  const data = loadMenuData();
  if (dom.menuIntro) dom.menuIntro.value = data.intro || '';
  if (dom.menuFootnote) dom.menuFootnote.value = data.footnote || '';
  dom.menuSections.innerHTML = '';
  (data.sections || []).forEach(sec => dom.menuSections.appendChild(buildMenuSection(sec)));
  setStatus(dom.menuStatus, 'Bereit zum Bearbeiten.');
}

function buildMenuSection(sec) {
  const block = document.createElement('div');
  block.className = 'menu-section';
  const iconOptions = MENU_ICONS.map(ic =>
    `<option value="${ic.id}" ${sec.icon === ic.id ? 'selected' : ''}>${ic.label}</option>`
  ).join('');
  block.innerHTML = `
    <div class="menu-section-head">
      <input type="text" class="menu-section-title" value="${escapeAttr(sec.title || '')}" placeholder="Kategorie, z. B. Frühstück" />
      <select class="menu-section-icon" aria-label="Symbol für diese Kategorie">${iconOptions}</select>
      <button type="button" class="btn-icon menu-section-remove" aria-label="Ganze Kategorie entfernen" title="Ganze Kategorie entfernen"><svg class="ico ico-sm"><use href="#i-trash"/></svg></button>
    </div>
    <input type="text" class="menu-section-note" value="${escapeAttr(sec.note || '')}" placeholder="Hinweis (optional), z. B. Preis klein / groß" />
    <div class="menu-items"></div>
    <button type="button" class="btn btn-link menu-add-item">
      <svg class="ico ico-sm"><use href="#i-plus"/></svg> Gericht hinzufügen
    </button>
  `;
  const itemsBox = block.querySelector('.menu-items');
  (sec.items || []).forEach(it => itemsBox.appendChild(buildMenuItemRow(it)));
  block.querySelector('.menu-add-item').addEventListener('click', () => {
    itemsBox.appendChild(buildMenuItemRow({ name: '', desc: '', price: '' }));
  });
  block.querySelector('.menu-section-remove').addEventListener('click', async () => {
    if (await askConfirm('Die Kategorie mit allen Gerichten verschwindet aus dem Formular (erst „Speisekarte speichern“ übernimmt es).', { title: 'Kategorie entfernen?', ok: 'Entfernen' })) block.remove();
  });
  return block;
}

function buildMenuItemRow(item) {
  const row = document.createElement('div');
  row.className = 'menu-item-row';
  row.draggable = true;
  // Tag (z. B. "vegan") transparent erhalten — kein eigenes Feld noetig,
  // damit der Editor einfach bleibt (Name / Preis / Beschreibung).
  if (item.tag) row.dataset.tag = item.tag;
  row.innerHTML = `
    <span class="drag-handle" aria-label="Verschieben" title="Zum Sortieren ziehen">⠿</span>
    <div class="menu-item-fields">
      <input type="text" class="menu-item-name" value="${escapeAttr(item.name || '')}" placeholder="Gericht, z. B. Klassik" />
      <input type="text" class="menu-item-price" value="${escapeAttr(item.price || '')}" placeholder="Preis, z. B. 8,90 €" />
      <input type="text" class="menu-item-desc" value="${escapeAttr(item.desc || '')}" placeholder="Beschreibung (optional)" />
    </div>
    <button type="button" class="btn-icon menu-item-remove" aria-label="Gericht entfernen" title="Gericht entfernen"><svg class="ico ico-sm"><use href="#i-x"/></svg></button>
  `;
  row.querySelector('.menu-item-remove').addEventListener('click', () => row.remove());
  attachDragHandlers(row, '.menu-item-row');
  return row;
}

function addMenuSection() {
  if (!dom.menuSections) return;
  const block = buildMenuSection({ title: '', icon: 'i-bread', note: '', items: [{ name: '', desc: '', price: '' }] });
  dom.menuSections.appendChild(block);
  block.querySelector('.menu-section-title')?.focus();
}

/* ---------- Drag & Drop Sortierung ---------- */
let draggedEl = null;
function attachDragHandlers(el, siblingSelector) {
  el.addEventListener('dragstart', (e) => {
    draggedEl = el;
    el.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', ''); } catch {}
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('is-dragging');
    document.querySelectorAll('.is-drop-target').forEach(x => x.classList.remove('is-drop-target'));
    draggedEl = null;
  });
  el.addEventListener('dragover', (e) => {
    if (!draggedEl || draggedEl === el) return;
    if (draggedEl.parentElement !== el.parentElement) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    el.classList.add('is-drop-target');
  });
  el.addEventListener('dragleave', () => {
    el.classList.remove('is-drop-target');
  });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('is-drop-target');
    if (!draggedEl || draggedEl === el) return;
    const r = el.getBoundingClientRect();
    const insertBefore = (e.clientY - r.top) < r.height / 2;
    if (insertBefore) el.parentElement.insertBefore(draggedEl, el);
    else el.parentElement.insertBefore(draggedEl, el.nextSibling);
  });
}

/* Liest den Editor-Stand zurueck ins Daten-Modell. */
function collectMenuData() {
  return {
    intro:    (dom.menuIntro?.value || '').trim(),
    sections: collectSectionsFrom(dom.menuSections),
    footnote: (dom.menuFootnote?.value || '').trim()
  };
}
function collectSectionsFrom(container) {
  const sections = [];
  container.querySelectorAll('.menu-section').forEach(block => {
    const title = block.querySelector('.menu-section-title').value.trim();
    const icon  = block.querySelector('.menu-section-icon').value;
    const note  = block.querySelector('.menu-section-note').value.trim();
    const items = [];
    block.querySelectorAll('.menu-item-row').forEach(row => {
      const name  = row.querySelector('.menu-item-name').value.trim();
      const price = row.querySelector('.menu-item-price').value.trim();
      const desc  = row.querySelector('.menu-item-desc').value.trim();
      row.classList.toggle('is-invalid', !name && !!(price || desc));
      if (name || price || desc) {
        const it = { name };
        if (price) it.price = price;
        if (desc)  it.desc  = desc;
        if (row.dataset.tag) it.tag = row.dataset.tag;
        items.push(it);
      }
    });
    if (title || items.length) {
      const sec = { title, icon };
      if (note) sec.note = note;
      sec.items = items;
      sections.push(sec);
    }
  });
  return sections;
}

/* ---------- Sommer-Specials (eigener Block, ein-/ausschaltbar) ---------- */
function loadSpecialsData() {
  const stored = window.alsterDb?.get('specials');
  const base = (stored && Array.isArray(stored.sections)) ? stored : (window.ALSTERCAFE_SPECIALS_DEFAULT || { visible: true, title: 'Sommer-Specials', sections: [] });
  return JSON.parse(JSON.stringify(base));
}
function renderSpecialsEditor() {
  markClean('specials-form');
  const box = document.getElementById('specials-sections');
  if (!box) return;
  const d = loadSpecialsData();
  document.getElementById('specials-visible').checked = d.visible !== false;
  document.getElementById('specials-title').value = d.title || '';
  document.getElementById('specials-footnote').value = d.footnote || '';
  box.innerHTML = '';
  (d.sections || []).forEach(sec => box.appendChild(buildMenuSection(sec)));
  setStatus(document.getElementById('specials-status'), d.visible !== false ? 'Sichtbar auf Speisekarte und Startseite.' : 'Ausgeblendet – auf der Webseite nicht zu sehen.');
}
async function onSaveSpecials() {
  const box = document.getElementById('specials-sections');
  const st = document.getElementById('specials-status');
  const sections = collectSectionsFrom(box);
  const nameless = box.querySelectorAll('.menu-item-row.is-invalid');
  if (nameless.length) { setStatus(st, 'Nicht gespeichert: Ein Eintrag hat Preis oder Beschreibung, aber keinen Namen (rot markiert).', 'error'); return false; }
  const visible = document.getElementById('specials-visible').checked;
  if (visible && !sections.some(sec => sec.items.some(it => it.name))) { setStatus(st, 'Nicht gespeichert: Bitte mindestens ein Getränk eintragen oder den Schalter ausschalten.', 'error'); return false; }
  const data = { visible, title: (document.getElementById('specials-title').value || '').trim() || 'Sommer-Specials', sections, footnote: (document.getElementById('specials-footnote').value || '').trim() };
  const ok = await window.alsterDb.set('specials', data);
  if (!ok) { setStatus(st, 'Speichern fehlgeschlagen.', 'error'); warnWriteFailed(); return false; }
  setStatus(st, `Gespeichert · ${formatTime(new Date())} — ${visible ? 'auf der Webseite sichtbar' : 'auf der Webseite ausgeblendet'}.`, 'ok');
  logActivity(visible ? 'Sommer-Specials gespeichert' : 'Sommer-Specials ausgeblendet');
  return true;
}
async function onResetSpecials() {
  if (!(await askConfirm('Die Sommer-Specials gehen zurück auf den Stand der Tafel (alle Getränke und Preise).', { title: 'Auf Tafel-Stand zurücksetzen?', ok: 'Zurücksetzen' }))) return;
  const ok = await window.alsterDb.remove('specials');
  if (ok === false) { warnWriteFailed(); return; }
  renderSpecialsEditor();
  setStatus(document.getElementById('specials-status'), 'Auf Tafel-Stand zurückgesetzt.', 'ok');
}

function onSaveMenu(e) {
  e.preventDefault();
  const data = collectMenuData();
  if (!data.sections.length) {
    setStatus(dom.menuStatus, 'Mindestens eine Kategorie mit einem Gericht nötig.', 'error');
    return false;
  }
  const nameless = dom.menuSections.querySelectorAll('.menu-item-row.is-invalid');
  if (nameless.length) {
    setStatus(dom.menuStatus, `Nicht gespeichert: ${nameless.length === 1 ? 'ein Eintrag hat' : nameless.length + ' Einträge haben'} Preis oder Beschreibung, aber keinen Namen (rot markiert).`, 'error');
    nameless[0].querySelector('.menu-item-name')?.focus();
    return false;
  }
  const emptyCats = data.sections.filter(sec => !sec.items.some(it => it.name)).map(sec => sec.title || 'ohne Titel');
  if (emptyCats.length) {
    setStatus(dom.menuStatus, `Nicht gespeichert: Kategorie „${emptyCats.join('“, „')}“ hat noch kein Gericht – Gericht ergänzen oder Kategorie entfernen.`, 'error');
    return false;
  }
  return window.alsterDb.set('menu', data).then(ok => {
    setStatus(dom.menuStatus,
      ok ? `Gespeichert · ${formatTime(new Date())} — jetzt auf der Webseite sichtbar.` : 'Speichern fehlgeschlagen.',
      ok ? 'ok' : 'error');
    if (ok) logActivity('Speisekarte gespeichert'); else warnWriteFailed();
    return ok !== false;
  });
}

async function onResetMenu() {
  if (!(await askConfirm('Ihre Änderungen an der Speisekarte gehen verloren.', { title: 'Original-Speisekarte wiederherstellen?', ok: 'Zurücksetzen' }))) return;
  window.alsterDb.remove('menu').then(() => {
    renderMenuEditor();
    setStatus(dom.menuStatus, 'Auf Original zurückgesetzt.', 'ok');
  });
}

/* ---------- PDF-Export der Speisekarte ----------
   Nimmt den AKTUELLEN Editor-Stand (auch ungespeicherte Aenderungen),
   oeffnet eine eigenstaendige, druckfertige Karte in einem neuen
   Fenster und ruft den Druckdialog auf — dort waehlt Maria
   "Als PDF speichern". Eine Seite pro Kategorie, wie ihre
   Original-Karte. */
function downloadMenuPdf() {
  const data = collectMenuData();
  if (!data.sections.length) {
    setStatus(dom.menuStatus, 'Bitte zuerst Gerichte eintragen, dann als PDF speichern.', 'error');
    return;
  }

  printHtmlDocument(buildMenuPrintHtml(data), dom.menuStatus);
}

// Druck über ein verstecktes, gleich-Ursprung-Iframe statt window.open().
// Grund: window.open('', '_blank') wird auf Handys — vor allem iOS Safari —
// lautlos vom Popup-Blocker geschluckt, dann "passiert nichts". Ein Iframe,
// das ein Blob-Dokument lädt, umgeht den Blocker komplett; das eingebettete
// Skript ruft window.print() aus seinem EIGENEN Fenster auf und druckt so
// zuverlässig genau dieses Dokument (nicht die Admin-Seite).
function printHtmlDocument(html, statusEl) {
  try {
    document.getElementById('menu-print-frame')?.remove();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    const frame = document.createElement('iframe');
    frame.id = 'menu-print-frame';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    frame.src = url;
    document.body.appendChild(frame);

    // Aufräumen, nachdem gedruckt (oder abgebrochen) wurde.
    const cleanup = () => { URL.revokeObjectURL(url); setTimeout(() => frame.remove(), 500); };
    frame.addEventListener('load', () => {
      try { frame.contentWindow.addEventListener('afterprint', cleanup); } catch (e) {}
      // Belt-and-Suspenders: zusätzlich vom Eltern-Fenster aus auslösen,
      // falls das eingebettete Skript blockiert wurde. Das gemeinsame Flag
      // __alsterPrinted verhindert, dass der Dialog doppelt aufgeht.
      try {
        const w = frame.contentWindow;
        if (w && !w.__alsterPrinted && !w.__alsterWaitFonts) { w.__alsterPrinted = true; w.focus(); w.print(); }
      } catch (e) {}
      setTimeout(cleanup, 60000); // Spätestens nach 1 min Blob freigeben.
    });

    setStatus(statusEl, 'Druckansicht geöffnet — wählen Sie „Als PDF speichern“ oder Ihren Drucker.', 'ok');
  } catch (e) {
    setStatus(statusEl, 'Druckansicht konnte nicht erzeugt werden. Bitte erneut versuchen.', 'error');
  }
}

/* ---------- Wochenplan weitergeben: Aushang (A4) + Instagram-Bild ----------
   Beides nimmt den AKTUELLEN Formular-Stand (auch ungespeichert). */
function weekShareData() {
  const week = readFormToWeek();
  const days = DAYS.map((d, i) => {
    const date = new Date(currentMonday); date.setDate(date.getDate() + i);
    const e = week[d.key] || {};
    const dishes = [{ dish: e.dish, side: e.side }, { dish: e.dish2, side: e.side2 }]
      .map(x => ({ dish: String(x.dish || '').trim(), side: String(x.side || '').trim() }))
      .filter(x => x.dish);
    return { label: d.label, date, closed: !!e.closed, croque: !!(e.closed && e.croque), dishes: e.closed ? [] : dishes, weekend: i >= 5 };
  }).filter(d => !d.weekend || d.dishes.length);
  const sunday = new Date(currentMonday); sunday.setDate(sunday.getDate() + 6);
  const dm = d => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return {
    days,
    kw: isoWeek(currentMonday),
    range: `${dm(currentMonday)} – ${dm(sunday)}`,
    hasAny: days.some(d => d.dishes.length)
  };
}
// Beilage: „mit …“ nur voranstellen, wenn der Text nicht schon so anfängt
function shareSide(side) {
  const t = String(side || '').trim();
  if (!t) return '';
  return /^(mit|serviert|dazu|und|inkl|wahlweise|oder)\b/i.test(t) ? t : `mit ${t}`;
}
function weekShareStatus(msg, kind) { setStatus(document.getElementById('week-share-status'), msg, kind); }

function printWeekPoster() {
  const data = weekShareData();
  if (!data.hasAny) { weekShareStatus('Bitte zuerst Gerichte eintragen.', 'error'); return; }
  printHtmlDocument(buildWeekPosterHtml(data), document.getElementById('week-share-status'));
}

function buildWeekPosterHtml(data) {
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const origin = location.origin;
  // Grobe Füllmenge: Gerichte, Beilagen und lange Namen (Zeilenumbrüche)
  const load = data.days.reduce((a, d) => a + 1 + d.dishes.reduce((b, x) => b + 1 + (x.side ? .45 : 0) + (x.dish.length > 45 ? .8 : 0), 0) + Math.max(0, d.dishes.length - 1) * .4, 0);
  const density = load > 16 ? 'dense xdense' : load > 11 ? 'dense' : '';
  const rows = data.days.map(d => {
    let body;
    if (d.closed) body = `<p class="none">${d.croque ? 'Croque-Tag' : 'Kein Mittagstisch'}</p>`;
    else if (!d.dishes.length) body = '<p class="none">Folgt in Kürze</p>';
    else body = d.dishes.map(x => `<p class="dish">${esc(x.dish)}</p>${x.side ? `<p class="side">${esc(shareSide(x.side))}</p>` : ''}`)
      .join('<p class="or"><span>oder</span></p>');
    return `<div class="day"><div class="when"><span class="name">${esc(d.label)}</span><span class="date">${d.date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span></div><div class="what">${body}</div></div>`;
  }).join('');
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<title>Mittagstisch KW ${data.kw} · Alstercafé</title>
<link rel="stylesheet" href="${origin}/fonts.css">
<style>
  @page { size: A4; margin: 14mm 16mm; }
  * { box-sizing: border-box; font-style: normal !important; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; color: #2A1810; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { border: 1.5pt solid #B8893E; border-radius: 6mm; padding: 12mm 12mm 9mm; min-height: 265mm; display: flex; flex-direction: column; }
  header { text-align: center; margin-bottom: 8mm; }
  header img { width: 22mm; height: 22mm; display: block; margin: 0 auto 3mm; border-radius: 50%; }
  .brand { font-family: 'Fraunces', Georgia, serif; font-weight: 500; font-size: 30pt; margin: 0; color: #3D2415; }
  .kicker { margin: 3mm 0 0; font-size: 10pt; font-weight: 600; letter-spacing: 3pt; text-transform: uppercase; color: #8A6420; }
  .range { margin: 1.5mm 0 0; font-size: 10pt; color: #6b5a4a; }
  .days { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .day { display: grid; grid-template-columns: 36mm 1fr; gap: 6mm; padding: 4.5mm 0; border-top: 0.6pt solid #E3D4BB; break-inside: avoid; }
  .day:first-child { border-top: 0; }
  /* Volle Woche (viele Gerichte): kompakter, damit alles auf eine Seite passt */
  .dense header { margin-bottom: 5mm; } .dense header img { width: 16mm; height: 16mm; } .dense .brand { font-size: 25pt; }
  .dense .day { padding: 3mm 0; } .dense .dish { font-size: 14.5pt; } .dense .side { font-size: 9.5pt; } .dense .or { margin: 1.4mm 0; }
  .xdense .day { padding: 2.2mm 0; } .xdense .dish { font-size: 12.5pt; } .xdense .side { font-size: 9pt; margin-top: .6mm; } .xdense .or { margin: .8mm 0; font-size: 7.5pt; }
  .name { display: block; font-size: 11pt; font-weight: 700; letter-spacing: 1.2pt; text-transform: uppercase; color: #3D2415; }
  .date { display: block; font-size: 9.5pt; color: #8a7a68; margin-top: 1mm; }
  .dish { font-family: 'Fraunces', Georgia, serif; font-size: 17pt; line-height: 1.2; margin: 0; color: #2A1810; }
  .side { font-size: 10.5pt; color: #6b5a4a; margin: 1mm 0 0; }
  .or { margin: 2.2mm 0; font-size: 8.5pt; font-weight: 600; letter-spacing: 2pt; text-transform: uppercase; color: #B8893E; }
  .none { margin: 0; font-size: 11pt; color: #8a7a68; padding-top: 1mm; }
  footer { text-align: center; margin-top: 6mm; padding-top: 5mm; border-top: 1pt solid #B8893E; font-size: 10.5pt; color: #3D2415; line-height: 1.6; }
  footer strong { color: #8A6420; }
</style></head><body>
<div class="sheet ${density}">
  <header>
    <img src="${origin}/image-192.webp" alt="">
    <h1 class="brand">Alstercafé</h1>
    <p class="kicker">Mittagstisch · KW ${data.kw}</p>
    <p class="range">${esc(data.range)}</p>
  </header>
  <div class="days">${rows}</div>
  <footer><strong>Ab 12:00 Uhr</strong> · Beilage und Salat sind immer dabei<br>Ifflandstraße 45 · 040 – 22 69 28 91 · alstercafe.de</footer>
</div>
<script>
  /* Erst drucken, wenn Schriften und Logo geladen sind */
  window.__alsterWaitFonts = true;
  function alsterPrint(){ if (window.__alsterPrinted) return; window.__alsterPrinted = true; try { window.focus(); window.print(); } catch (e) {} }
  window.addEventListener('load', function(){
    var go = function(){ setTimeout(alsterPrint, 200); };
    try { document.fonts.ready.then(go, go); } catch (e) { go(); }
    setTimeout(alsterPrint, 3000);
  });
</script>
</body></html>`;
}

/* Instagram-Bild 1080×1350 (Hochformat-Post) per Canvas */
async function makeWeekImage() {
  const data = weekShareData();
  if (!data.hasAny) { weekShareStatus('Bitte zuerst Gerichte eintragen.', 'error'); return; }
  weekShareStatus('Bild wird erstellt …');
  try {
    await Promise.all([
      document.fonts.load('500 64px Fraunces'), document.fonts.load('400 40px Fraunces'),
      document.fonts.load('600 24px Inter'), document.fonts.load('400 24px Inter')
    ]);
  } catch (e) {}
  let logo = null;
  try {
    logo = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = 'image-192.webp'; });
  } catch (e) {}
  const canvas = drawWeekImage(data, logo);
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  if (!blob) { weekShareStatus('Bild konnte nicht erstellt werden.', 'error'); return; }
  weekShareStatus('');
  showWeekImageDialog(blob, `alstercafe-mittagstisch-KW${data.kw}.png`);
}

function drawWeekImage(data, logo) {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const C = { espresso: '#2A1810', bean: '#3D2415', gold: '#B8893E', goldSoft: '#D4B380', linen: '#F1E7D3' };
  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, C.bean); bg.addColorStop(1, C.espresso);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(212,179,128,.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(40, 40, W - 80, H - 80, 28) : ctx.rect(40, 40, W - 80, H - 80); ctx.stroke();
  const spacing = (px) => { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; };
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

  let y = 92;
  if (logo) {
    ctx.save(); ctx.beginPath(); ctx.arc(W / 2, y + 48, 48, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(logo, W / 2 - 48, y, 96, 96); ctx.restore();
    y += 96 + 66;
  } else y += 60;
  spacing(0); ctx.fillStyle = C.linen; ctx.font = '500 66px Fraunces, Georgia, serif';
  ctx.fillText('Alstercafé', W / 2, y);
  y += 54; spacing(6); ctx.fillStyle = C.goldSoft; ctx.font = '600 25px Inter, Arial, sans-serif';
  ctx.fillText(`MITTAGSTISCH · KW ${data.kw}`, W / 2, y);
  y += 40; spacing(1); ctx.fillStyle = 'rgba(241,231,211,.72)'; ctx.font = '400 24px Inter, Arial, sans-serif';
  ctx.fillText(data.range, W / 2, y);

  const top = y + 46, bottom = H - 150, left = 110, right = W - 110;
  const wrap = (text, maxW) => {
    const words = String(text).split(/\s+/); const lines = []; let cur = '';
    words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    return lines;
  };
  // Volle Woche: zwei Spalten (Tag über dem Gericht), sonst eine Spalte (Tag links)
  const totalDishes = data.days.reduce((a, d) => a + d.dishes.length, 0);
  const cols = (data.days.length > 5 || totalDishes > 7) ? 2 : 1;
  const colGap = 56;
  const cellW = cols === 2 ? (right - left - colGap) / 2 : right - left;
  const labelW = cols === 2 ? 0 : 210;
  const head = cols === 2 ? 44 : 0; // Platz für den Tag über dem Gericht
  const textW = cellW - labelW;
  const measure = (d, k) => {
    const dishPx = Math.round(40 * k), sidePx = Math.round(25 * Math.max(k, 0.8)), orPx = 19;
    const parts = [];
    if (!d.dishes.length) parts.push({ kind: 'none', text: d.closed ? (d.croque ? 'Croque-Tag' : 'Kein Mittagstisch') : 'Folgt in Kürze', h: 34 });
    d.dishes.forEach((x, i) => {
      if (i) parts.push({ kind: 'or', h: orPx + 18 });
      spacing(0); ctx.font = `400 ${dishPx}px Fraunces, Georgia, serif`;
      const lines = wrap(x.dish, textW);
      parts.push({ kind: 'dish', lines, h: lines.length * dishPx * 1.15 });
      if (x.side) {
        ctx.font = `400 ${sidePx}px Inter, Arial, sans-serif`;
        const sl = wrap(shareSide(x.side), textW);
        parts.push({ kind: 'side', lines: sl, h: 8 + sl.length * sidePx * 1.3 });
      }
    });
    return { d, parts, h: Math.max(cols === 2 ? 0 : 56, head + parts.reduce((a, p) => a + p.h, 0)) };
  };
  // Layout messen und bei Bedarf verkleinern, bis alles passt
  let layout;
  for (let k = 1; k >= 0.5; k -= 0.05) {
    const gap = Math.round(28 * Math.max(k, 0.7));
    const cells = data.days.map(d => measure(d, k));
    const rows = [];
    for (let i = 0; i < cells.length; i += cols) rows.push({ cells: cells.slice(i, i + cols), h: Math.max(...cells.slice(i, i + cols).map(c => c.h)) });
    const h = rows.reduce((a, r) => a + r.h + gap * 2, 0);
    layout = { rows, k, dishPx: Math.round(40 * k), sidePx: Math.round(25 * Math.max(k, 0.8)), orPx: 19, gap, h };
    if (h <= bottom - top) break;
  }
  let ry = top + Math.max(0, (bottom - top - layout.h) / 2);
  layout.rows.forEach((row, i) => {
    if (i) { ctx.strokeStyle = 'rgba(212,179,128,.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(left, ry); ctx.lineTo(right, ry); ctx.stroke(); }
    ry += layout.gap;
    row.cells.forEach((r, ci) => {
      const cx = left + ci * (cellW + colGap);
      const dateTxt = r.d.date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
      ctx.textAlign = 'left';
      spacing(3); ctx.fillStyle = C.goldSoft; ctx.font = '600 22px Inter, Arial, sans-serif';
      ctx.fillText(r.d.label.toUpperCase(), cx, ry + 26);
      if (cols === 2) {
        const lw = ctx.measureText(r.d.label.toUpperCase()).width;
        spacing(0); ctx.fillStyle = 'rgba(241,231,211,.6)'; ctx.font = '400 20px Inter, Arial, sans-serif';
        ctx.fillText(dateTxt, cx + lw + 14, ry + 26);
      } else {
        spacing(0); ctx.fillStyle = 'rgba(241,231,211,.6)'; ctx.font = '400 20px Inter, Arial, sans-serif';
        ctx.fillText(dateTxt, cx, ry + 54);
      }
      let ty = ry + head; const tx = cx + labelW;
      r.parts.forEach(p => {
        if (p.kind === 'none') { ctx.fillStyle = 'rgba(241,231,211,.6)'; ctx.font = '400 26px Inter, Arial, sans-serif'; ctx.fillText(p.text, tx, ty + 28); }
        if (p.kind === 'or') { spacing(4); ctx.fillStyle = C.gold; ctx.font = `600 ${layout.orPx}px Inter, Arial, sans-serif`; ctx.fillText('ODER', tx, ty + layout.orPx + 6); spacing(0); }
        if (p.kind === 'dish') { ctx.fillStyle = '#FFFCF4'; ctx.font = `400 ${layout.dishPx}px Fraunces, Georgia, serif`; p.lines.forEach((l, k) => ctx.fillText(l, tx, ty + layout.dishPx * (0.9 + k * 1.15))); }
        if (p.kind === 'side') { ctx.fillStyle = 'rgba(241,231,211,.75)'; ctx.font = `400 ${layout.sidePx}px Inter, Arial, sans-serif`; p.lines.forEach((l, k) => ctx.fillText(l, tx, ty + 8 + layout.sidePx * (1 + k * 1.3))); }
        ty += p.h;
      });
    });
    ry += row.h + layout.gap;
  });

  ctx.textAlign = 'center'; spacing(2);
  ctx.fillStyle = C.goldSoft; ctx.font = '600 25px Inter, Arial, sans-serif';
  ctx.fillText('AB 12:00 UHR', W / 2, H - 100);
  spacing(0); ctx.fillStyle = 'rgba(241,231,211,.8)'; ctx.font = '400 23px Inter, Arial, sans-serif';
  ctx.fillText('Ifflandstraße 45 · Hamburg-Hohenfelde · alstercafe.de', W / 2, H - 66);
  return c;
}

function showWeekImageDialog(blob, filename) {
  const url = URL.createObjectURL(blob);
  const file = (typeof File === 'function') ? new File([blob], filename, { type: 'image/png' }) : null;
  const canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
  const dlg = document.createElement('dialog');
  dlg.className = 'confirm-dialog week-image-dialog';
  dlg.innerHTML = `
    <div class="confirm-dialog-form">
      <h3 class="confirm-dialog-title">Bild für Instagram</h3>
      <img class="week-image-preview" src="${url}" alt="Vorschau: Mittagstisch der Woche als Bild" />
      <p class="confirm-dialog-hint">${canShare ? 'Tippen Sie auf „Teilen“ und wählen Sie Instagram, WhatsApp oder „Bild sichern“.' : 'Bild speichern und dann bei Instagram als Beitrag hochladen.'}</p>
      <div class="confirm-dialog-actions">
        <button type="button" class="btn btn-link" data-act="close">Schließen</button>
        <a class="btn ${canShare ? 'btn-link' : 'btn-primary'}" href="${url}" download="${filename}" data-act="save">Bild speichern</a>
        ${canShare ? '<button type="button" class="btn btn-primary" data-act="share">Teilen …</button>' : ''}
      </div>
    </div>`;
  document.body.appendChild(dlg);
  dlg.querySelector('[data-act="close"]').addEventListener('click', () => dlg.close());
  dlg.querySelector('[data-act="share"]')?.addEventListener('click', async () => {
    try { await navigator.share({ files: [file], title: 'Mittagstisch im Alstercafé' }); } catch (e) { /* abgebrochen */ }
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { dlg.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
}

function buildMenuPrintHtml(data) {
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const spaced = s => esc(s).split('').join(' ');
  const introHtml = data.intro
    ? `<p class="intro">${esc(data.intro)}</p>` : '';

  const pages = data.sections.map((sec, i) => {
    const items = (sec.items || []).map(it => `
      <div class="item">
        <div class="row">
          <span class="name">${esc(it.name)}${it.tag ? ` <em>${esc(it.tag)}</em>` : ''}</span>
          <span class="dots"></span>
          <span class="price">${esc(it.price || '')}</span>
        </div>
        ${it.desc ? `<p class="desc">${esc(it.desc)}</p>` : ''}
      </div>`).join('');
    const note = sec.note ? `<p class="note">${esc(sec.note)}</p>` : '';
    return `
      <section class="page">
        <div class="brand">www.alstercafe.de</div>
        <h1>${spaced(sec.title)}</h1>
        ${i === 0 ? introHtml : ''}
        ${note}
        <div class="items">${items}</div>
        ${i === data.sections.length - 1 && data.footnote ? `<p class="foot">${esc(data.footnote)}</p>` : ''}
      </section>`;
  }).join('');

  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<title>Speisekarte · Alstercafé</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #2a1810; }
  .page { page-break-after: always; padding-bottom: 8mm; }
  .page:last-child { page-break-after: auto; }
  .brand { text-align: center; font-size: 9pt; letter-spacing: 2.5px; color: #aaa; text-transform: lowercase; margin: 0 0 26pt; }
  h1 { text-align: center; font-size: 21pt; letter-spacing: 4px; font-weight: normal; text-transform: uppercase; margin: 0 0 16pt; color: #3d2415; }
  .intro { text-align: center; font-size: 9.5pt; color: #6b5a4a; max-width: 360pt; margin: 0 auto 22pt; line-height: 1.55; }
  .note { text-align: center; font-style: italic; font-size: 9pt; color: #8a7a68; margin: 0 0 16pt; }
  .items { max-width: 470pt; margin: 0 auto; }
  .item { margin-bottom: 13pt; }
  .row { display: flex; align-items: baseline; }
  .name { font-size: 12pt; font-weight: bold; }
  .name em { font-weight: normal; font-style: italic; color: #4a6f47; font-size: 8.5pt; }
  .dots { flex: 1 1 auto; border-bottom: 1px dotted #c9bda9; margin: 0 7pt; height: 9pt; }
  .price { font-size: 12pt; color: #b8893e; white-space: nowrap; font-weight: bold; }
  .desc { font-size: 9pt; color: #6b5a4a; margin: 3pt 0 0; line-height: 1.45; max-width: 400pt; }
  .foot { text-align: center; font-size: 7.5pt; color: #aaa; margin-top: 22pt; padding-top: 10pt; border-top: 1px solid #e8ddca; line-height: 1.5; }
</style></head><body>${pages}
<script>
  /* Sobald das Dokument steht, den Druckdialog aus dem EIGENEN Fenster
     heraus öffnen. So druckt der Browser zuverlässig genau diese Karte —
     auch im Iframe und auf iOS Safari. */
  function alsterPrint(){ if (window.__alsterPrinted) return; window.__alsterPrinted = true; try { window.focus(); window.print(); } catch (e) {} }
  if (document.readyState === 'complete') { setTimeout(alsterPrint, 250); }
  else { window.addEventListener('load', function(){ setTimeout(alsterPrint, 250); }); }
</script>
</body></html>`;
}

/* ---------- Öffnungszeiten ---------- */

function renderHoursEditor() {
  markClean('hours-form');
  if (!dom.hoursRows) return;
  let hours = DEFAULT_HOURS;
  try {
    const raw = localStorage.getItem(HOURS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) hours = parsed;
    }
  } catch {}
  dom.hoursRows.innerHTML = '';
  hours.forEach(h => addHourRow(h.label, h.time));
  setStatus(dom.hoursStatus, '');
}

/* Zeigt unter jeder Zeile, wie die Webseite sie versteht (gleiche Regeln wie die Webseite) */
function checkHourRows() {
  const rows = Array.from(dom.hoursRows.querySelectorAll('.hours-row'));
  const data = rows.map(r => ({ label: r.querySelector('.hours-label').value, time: r.querySelector('.hours-time').value }));
  const res = window.AlsterRules.checkHours(data);
  rows.forEach((r, i) => {
    const c = res.rows[i];
    let hint = r.nextElementSibling && r.nextElementSibling.classList.contains('hours-hint') ? r.nextElementSibling : null;
    if (!hint) { hint = document.createElement('p'); hint.className = 'hours-hint'; r.after(hint); }
    hint.className = 'hours-hint' + (c.empty ? '' : c.ok ? (c.warn ? ' is-warn' : ' is-ok') : ' is-error');
    hint.textContent = c.empty ? '' : c.ok ? (c.warn ? `⚠ ${c.warn}` : `✓ ${c.message}`) : `✗ ${c.message}`;
    r.classList.toggle('is-invalid', !c.ok);
  });
  return res;
}

function addHourRow(label = '', time = '') {
  const row = document.createElement('div');
  row.className = 'hours-row';
  row.innerHTML = `
    <input type="text" class="hours-label" value="${escapeAttr(label)}" placeholder="z. B. Mo – Fr" />
    <input type="text" class="hours-time"  value="${escapeAttr(time)}"  placeholder="z. B. 06:30 – 15:00" />
    <button type="button" class="btn-icon hours-remove" aria-label="Zeile entfernen">
      <svg class="ico ico-sm"><use href="#i-x"/></svg>
    </button>
  `;
  row.querySelector('.hours-remove').addEventListener('click', () => {
    const hint = row.nextElementSibling;
    if (hint && hint.classList.contains('hours-hint')) hint.remove();
    row.remove();
    checkHourRows();
  });
  row.querySelectorAll('input').forEach(i => i.addEventListener('input', () => checkHourRows()));
  dom.hoursRows.appendChild(row);
  checkHourRows();
}

function onSaveHours(e) {
  e.preventDefault();
  const rows = [];
  dom.hoursRows.querySelectorAll('.hours-row').forEach(r => {
    const label = r.querySelector('.hours-label').value.trim();
    const time  = r.querySelector('.hours-time').value.trim();
    if (label || time) rows.push({ label, time });
  });
  // Erst prüfen, dann speichern: unlesbare Zeiten würden sonst Reservierungen sperren
  const check = checkHourRows();
  const bad = check.rows.filter(r => !r.ok);
  if (bad.length) {
    setStatus(dom.hoursStatus, `Nicht gespeichert: ${bad.length === 1 ? '1 Zeile ist' : bad.length + ' Zeilen sind'} nicht lesbar (rot markiert).`, 'error');
    dom.hoursRows.querySelector('.hours-row.is-invalid input')?.focus();
    return false;
  }
  if (!rows.length) {
    setStatus(dom.hoursStatus, 'Bitte mindestens eine Zeile eintragen – sonst gelten die Standardzeiten.', 'error');
    return false;
  }
  if (!check.week.some(Boolean)) {
    setStatus(dom.hoursStatus, 'So wäre das Café an allen Tagen geschlossen. Bitte Zeiten prüfen.', 'error');
    return false;
  }
  return window.alsterDb.set('hours', rows).then(ok => {
    setStatus(dom.hoursStatus,
      ok ? `Gespeichert · ${formatTime(new Date())}` : 'Speichern fehlgeschlagen.',
      ok ? 'ok' : 'error');
    if (ok) logActivity('Öffnungszeiten gespeichert'); else warnWriteFailed();
    return ok !== false;
  });
}

async function onResetHours() {
  if (!(await askConfirm('Die eingetragenen Zeiten werden durch die Standardzeiten ersetzt.', { title: 'Öffnungszeiten zurücksetzen?', ok: 'Zurücksetzen' }))) return;
  window.alsterDb.remove('hours').then(() => {
    renderHoursEditor();
    setStatus(dom.hoursStatus, 'Auf Standardwerte zurückgesetzt.', 'ok');
  });
}

/* ---------- Urlaub & Feiertage (Schließtage) ----------
   Gespeichert als Content-Key 'holidays' = [{date:'YYYY-MM-DD', label}].
   Die öffentliche Seite zeigt an solchen Tagen automatisch „Heute geschlossen“. */
function renderHolidaysEditor() {
  markClean('holidays-form');
  if (!dom.holidaysRows) return;
  const stored = window.alsterDb?.get('holidays');
  const holidays = Array.isArray(stored) ? stored : [];
  dom.holidaysRows.innerHTML = '';
  holidays
    .slice()
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    .forEach(h => addHolidayRow(h.date, h.label));
  if (dom.holidaysStatus) setStatus(dom.holidaysStatus, 'Bereit zum Bearbeiten.');
}

function addHolidayRow(date = '', label = '') {
  if (!dom.holidaysRows) return;
  const row = document.createElement('div');
  row.className = 'hours-row holiday-row';
  row.innerHTML = `
    <input type="date" class="holiday-date" value="${escapeAttr(date)}" aria-label="Datum" />
    <span class="holiday-weekday" aria-hidden="true"></span>
    <input type="text" class="holiday-label" value="${escapeAttr(label)}" placeholder="Grund (optional), z. B. Betriebsurlaub" aria-label="Grund" />
    <button type="button" class="btn-icon holiday-remove" aria-label="Zeile entfernen">
      <svg class="ico ico-sm"><use href="#i-x"/></svg>
    </button>
  `;
  const dateInput = row.querySelector('.holiday-date');
  const update = () => markHolidayRow(row);
  dateInput.addEventListener('change', update);
  row.querySelector('.holiday-remove').addEventListener('click', () => row.remove());
  dom.holidaysRows.appendChild(row);
  update();
}

/* Wochentag neben dem Datum anzeigen, vergangene Tage dämpfen */
function markHolidayRow(row) {
  const v = row.querySelector('.holiday-date').value;
  const wd = row.querySelector('.holiday-weekday');
  const d = v ? new Date(v + 'T12:00:00') : null;
  wd.textContent = d && !isNaN(d) ? d.toLocaleDateString('de-DE', { weekday: 'short' }) : '';
  row.classList.toggle('is-past', !!v && v < isoDate(new Date()));
}

function holidayToolStatus(msg, kind) { setStatus(document.getElementById('holiday-tools-status'), msg, kind); }
function existingHolidayDates() {
  return new Set(Array.from(dom.holidaysRows?.querySelectorAll('.holiday-date') || []).map(i => i.value).filter(Boolean));
}
function sortHolidayRows() {
  const rows = Array.from(dom.holidaysRows.querySelectorAll('.holiday-row'));
  rows.sort((a, b) => (a.querySelector('.holiday-date').value || '9999').localeCompare(b.querySelector('.holiday-date').value || '9999'))
    .forEach(r => dom.holidaysRows.appendChild(r));
}

/* Zeitraum (von–bis) → eine Zeile pro Tag, ohne Doppelte */
function onAddHolidayRange() {
  const from = document.getElementById('holiday-range-from').value;
  const to = document.getElementById('holiday-range-to').value || from;
  const label = document.getElementById('holiday-range-label').value.trim();
  if (!from) { holidayToolStatus('Bitte ein Startdatum („von“) wählen.', 'error'); return; }
  if (to < from) { holidayToolStatus('„bis“ liegt vor „von“ – bitte prüfen.', 'error'); return; }
  if (to < isoDate(new Date())) { holidayToolStatus('Dieser Zeitraum liegt komplett in der Vergangenheit – bitte Datum prüfen.', 'error'); return; }
  const have = existingHolidayDates();
  const d = new Date(from + 'T12:00:00'), end = new Date(to + 'T12:00:00');
  let added = 0, skipped = 0, count = 0;
  while (d <= end && count < 60) {
    const iso = isoDate(d);
    if (have.has(iso)) skipped++; else { addHolidayRow(iso, label); added++; }
    d.setDate(d.getDate() + 1); count++;
  }
  sortHolidayRows();
  const more = d <= end ? ' (höchstens 60 Tage auf einmal)' : '';
  holidayToolStatus(`${added} ${added === 1 ? 'Tag' : 'Tage'} eingetragen${skipped ? `, ${skipped} schon vorhanden` : ''}${more}. Jetzt unten „Schließtage speichern“.`, 'ok');
}

/* Gesetzliche Feiertage in Hamburg (Ostern nach Gauß / Meeus) */
function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12);
}
function hamburgHolidays(year) {
  const e = easterSunday(year);
  const rel = (n) => { const d = new Date(e); d.setDate(d.getDate() + n); return isoDate(d); };
  const fix = (m, day) => isoDate(new Date(year, m - 1, day, 12));
  return [
    [fix(1, 1), 'Neujahr'], [rel(-2), 'Karfreitag'], [rel(1), 'Ostermontag'], [fix(5, 1), 'Tag der Arbeit'],
    [rel(39), 'Christi Himmelfahrt'], [rel(50), 'Pfingstmontag'], [fix(10, 3), 'Tag der Deutschen Einheit'],
    [fix(10, 31), 'Reformationstag'], [fix(12, 25), '1. Weihnachtstag'], [fix(12, 26), '2. Weihnachtstag']
  ];
}
function onAddHamburgHolidays() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const until = new Date(today); until.setFullYear(until.getFullYear() + 1);
  const a = isoDate(today), b = isoDate(until);
  const have = existingHolidayDates();
  let added = 0;
  [today.getFullYear(), today.getFullYear() + 1].forEach(y => hamburgHolidays(y).forEach(([iso, name]) => {
    if (iso >= a && iso < b && !have.has(iso)) { addHolidayRow(iso, name); have.add(iso); added++; }
  }));
  sortHolidayRows();
  holidayToolStatus(added
    ? `${added} Feiertage eingetragen. Bitte prüfen: Nur speichern, wenn das Café an diesen Tagen geschlossen ist.`
    : 'Alle Feiertage der nächsten 12 Monate sind schon eingetragen.', 'ok');
}
function onRemovePastHolidays() {
  const today = isoDate(new Date());
  let n = 0;
  dom.holidaysRows.querySelectorAll('.holiday-row').forEach(r => {
    const v = r.querySelector('.holiday-date').value;
    if (v && v < today) { r.remove(); n++; }
  });
  holidayToolStatus(n ? `${n === 1 ? '1 vergangener Tag' : `${n} vergangene Tage`} entfernt. Jetzt unten „Schließtage speichern“.` : 'Es gibt keine vergangenen Tage.', 'ok');
}

async function onSaveHolidays(e) {
  e.preventDefault();
  const rows = [];
  const seen = new Set();
  let missing = 0, dupes = 0;
  dom.holidaysRows.querySelectorAll('.holiday-row').forEach(r => {
    const date  = r.querySelector('.holiday-date').value.trim();
    const label = r.querySelector('.holiday-label').value.trim();
    r.classList.remove('is-invalid');
    if (!date) { if (label) { missing++; r.classList.add('is-invalid'); } return; }
    if (seen.has(date)) { dupes++; return; }
    seen.add(date);
    rows.push({ date, label });
  });
  if (missing) {
    setStatus(dom.holidaysStatus, `Nicht gespeichert: ${missing === 1 ? 'eine Zeile hat' : missing + ' Zeilen haben'} einen Grund, aber kein Datum (rot markiert).`, 'error');
    return false;
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  // Warnen, wenn an neuen Schließtagen schon Reservierungen oder Abholungen stehen
  const before = new Set((window.alsterDb?.get('holidays') || []).map(h => h && h.date));
  const added = rows.filter(r => !before.has(r.date)).map(r => r.date);
  if (added.length) {
    const res = (window.alsterDb?.get('reservations') || []).filter(x => added.includes(x.date) && x.status !== 'done');
    const ord = (window.alsterDb?.get('orders') || []).filter(x => added.includes(x.pickupDate) && x.status !== 'done');
    if (res.length || ord.length) {
      const go = await askChoice({
        title: 'Achtung: Es gibt schon Termine',
        text: `An den neuen Schließtagen ${res.length + ord.length === 1 ? 'steht' : 'stehen'} schon ${[res.length ? (res.length === 1 ? 'eine Reservierung' : res.length + ' Reservierungen') : '', ord.length ? (ord.length === 1 ? 'eine Abholung' : ord.length + ' Abholungen') : ''].filter(Boolean).join(' und ')}. Bitte die Gäste informieren. Trotzdem als geschlossen speichern?`,
        actions: [{ label: 'Abbrechen', value: false }, { label: 'Trotzdem speichern', value: true, kind: 'primary' }]
      });
      if (!go) return false;
    }
  }
  return window.alsterDb.set('holidays', rows).then(ok => {
    if (ok && dupes) { renderHolidaysEditor(); }
    renderOwnerCalendar();
    setStatus(dom.holidaysStatus,
      ok ? `Gespeichert · ${formatTime(new Date())}${dupes ? ` · ${dupes} doppelte${dupes === 1 ? 'r Tag' : ' Tage'} zusammengefasst` : ''}` : 'Speichern fehlgeschlagen.',
      ok ? 'ok' : 'error');
    if (ok) logActivity('Schließtage gespeichert'); else warnWriteFailed();
    return ok !== false;
  });
}

async function onClearHolidays() {
  if (!(await askConfirm('Alle eingetragenen Schließtage werden gelöscht.', { title: 'Alle Schließtage entfernen?', ok: 'Alle entfernen' }))) return;
  window.alsterDb.remove('holidays').then(() => {
    renderHolidaysEditor();
    setStatus(dom.holidaysStatus, 'Alle Schließtage entfernt.', 'ok');
  });
}

/* ============================================================
   Design-Studio — Logo, Bilder, Galerie, Akzentfarbe
   ============================================================ */

function initDesignEditor() {
  // Slot-Inputs (Logo, Hero, About)
  document.querySelectorAll('.image-slot').forEach(slot => {
    const key = slot.dataset.designKey;
    const fileInput = slot.querySelector('input[type="file"]');
    const removeBtn = slot.querySelector('.image-remove');
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Visuelles Loading direkt am Slot — sonst sieht Maria sekunden-
      // lang nichts, waehrend Canvas-Kompression + Upload laufen, und
      // tippt evtl. erneut.
      slot.classList.add('is-uploading');
      flashDesignStatus('Bild wird hochgeladen …');
      try {
        const url = await window.alsterDb.uploadImage(file, key);
        const design = loadDesign();
        design[key] = url;
        saveDesign(design);
        renderImageSlot(slot, url);
        flashDesignStatus('Bild gespeichert.');
      } catch (err) {
        flashDesignStatus('Fehler beim Upload: ' + err.message, 'error');
      } finally {
        slot.classList.remove('is-uploading');
        fileInput.value = '';
      }
    });
    removeBtn.addEventListener('click', () => {
      const design = loadDesign();
      delete design[key];
      saveDesign(design);
      renderImageSlot(slot, null);
      flashDesignStatus('Bild entfernt.');
    });
  });

  // Galerie-Upload
  const galleryInput = document.getElementById('gallery-upload-input');
  const galleryUploadBtn = document.getElementById('gallery-upload-btn');
  galleryInput?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    galleryUploadBtn?.classList.add('is-uploading');
    flashDesignStatus(`${files.length} Bild(er) werden hochgeladen …`);
    const design = loadDesign();
    const gallery = Array.isArray(design.gallery) ? design.gallery.slice() : [];
    let added = 0;
    let skipped = 0;
    for (const file of files) {
      if (gallery.length >= GALLERY_MAX) { skipped++; continue; }
      try {
        const url = await window.alsterDb.uploadImage(file, 'gallery');
        gallery.push(url);
        added++;
      } catch (err) { console.warn('Upload skipped', err); skipped++; }
    }
    design.gallery = gallery;
    saveDesign(design);
    renderGalleryEdit();
    galleryUploadBtn?.classList.remove('is-uploading');
    const msg = skipped > 0
      ? `${added} Bild(er) hinzugefügt, ${skipped} übersprungen (Max ${GALLERY_MAX} oder Fehler).`
      : `${added} Bild(er) hinzugefügt.`;
    flashDesignStatus(msg, added > 0 ? 'ok' : 'error');
    galleryInput.value = '';
  });

  // Color-Presets + Custom
  document.querySelectorAll('.color-chip').forEach(chip => {
    chip.addEventListener('click', () => setAccentColor(chip.dataset.color));
  });
  const colorInput = document.getElementById('color-input');
  // Beim Ziehen nur Vorschau, gespeichert wird beim Loslassen (sonst Dutzende Speicherungen)
  colorInput?.addEventListener('input', (e) => document.documentElement.style.setProperty('--gold', e.target.value));
  colorInput?.addEventListener('change', (e) => setAccentColor(e.target.value));

  // Reset all design
  document.getElementById('design-reset')?.addEventListener('click', async () => {
    if (!(await askConfirm('Logo, Bilder, Galerie und Farbe gehen zurück auf den Standard.', { title: 'Alle Bilder & Farben zurücksetzen?', ok: 'Zurücksetzen' }))) return;
    const ok = await window.alsterDb.remove('design');
    renderDesignEditor();
    if (ok === false) { flashDesignStatus('Zurücksetzen fehlgeschlagen.', 'error'); warnWriteFailed(); }
    else flashDesignStatus('Auf Standard zurückgesetzt.');
  });
}

function renderDesignEditor() {
  const design = loadDesign();
  const vis = document.getElementById('gallery-visible');
  if (vis) {
    vis.checked = design.galleryVisible === true;
    if (!vis.dataset.bound) {
      vis.dataset.bound = '1';
      vis.addEventListener('change', () => {
        const d = loadDesign();
        d.galleryVisible = vis.checked;
        saveDesign(d);
        flashDesignStatus(vis.checked ? 'Fotos werden auf der Startseite gezeigt.' : 'Fotos sind auf der Startseite ausgeblendet.');
      });
    }
  }
  document.querySelectorAll('.image-slot').forEach(slot => {
    const key = slot.dataset.designKey;
    renderImageSlot(slot, design[key] || null);
  });
  renderGalleryEdit();
  // Color
  const accent = design.accentColor || '#B8893E';
  const colorInput = document.getElementById('color-input');
  if (colorInput) colorInput.value = accent;
  document.querySelectorAll('.color-chip').forEach(chip => {
    chip.classList.toggle('is-active', chip.dataset.color.toLowerCase() === accent.toLowerCase());
  });
}

function renderImageSlot(slot, dataUrl) {
  const preview = slot.querySelector('.image-preview');
  const removeBtn = slot.querySelector('.image-remove');
  const key = slot.dataset.designKey;
  const aspect = parseFloat(slot.dataset.aspect || '1');
  preview.style.aspectRatio = String(aspect);

  // Fallback fuer Standard-Logo
  const fallbacks = { logo: 'image.png' };
  const fallbackSrc = fallbacks[key];

  if (dataUrl) {
    preview.innerHTML = `<img src="${dataUrl}" alt="" />`;
    removeBtn.hidden = false;
  } else if (fallbackSrc) {
    preview.innerHTML = `
      <img src="${fallbackSrc}" alt="" />
      <span class="image-default-tag">Standard-Logo</span>
    `;
    removeBtn.hidden = true;
  } else {
    const empty = slot.querySelector('.image-empty')?.textContent || 'Kein Bild';
    preview.innerHTML = `<span class="image-empty">${empty}</span>`;
    removeBtn.hidden = true;
  }
}

function renderGalleryEdit() {
  const grid = document.getElementById('gallery-grid-edit');
  const counter = document.getElementById('gallery-counter');
  const uploadBtn = document.getElementById('gallery-upload-btn');
  if (!grid) return;
  const design = loadDesign();
  const gallery = Array.isArray(design.gallery) ? design.gallery : [];
  grid.innerHTML = '';
  gallery.forEach((src, idx) => {
    const tile = document.createElement('div');
    tile.className = 'gallery-tile-edit';
    tile.draggable = true;
    tile.dataset.idx = idx;
    tile.dataset.src = src;
    tile.innerHTML = `
      <img src="${src}" alt="" />
      <button type="button" class="gallery-remove" aria-label="Bild entfernen">
        <svg class="ico ico-sm"><use href="#i-x"/></svg>
      </button>
    `;
    tile.querySelector('.gallery-remove').addEventListener('click', () => {
      const d = loadDesign();
      // nach Bildadresse entfernen (nicht nach Position – die kann sich verschoben haben)
      d.gallery = (d.gallery || []).filter(g => g !== src);
      saveDesign(d);
      renderGalleryEdit();
      flashDesignStatus('Bild entfernt.');
    });
    attachDragHandlers(tile, '.gallery-tile-edit');
    grid.appendChild(tile);
  });
  // Nach Drop: Reihenfolge speichern. Nur EINMAL binden und die Reihenfolge aus den
  // aktuell angezeigten Bildern lesen – sonst speicherten alte Listener eine leere Galerie.
  if (!grid.dataset.dropBound) {
    grid.dataset.dropBound = '1';
    grid.addEventListener('drop', () => {
      setTimeout(() => {
        const newOrder = Array.from(grid.querySelectorAll('.gallery-tile-edit'))
          .map(t => t.dataset.src)
          .filter(Boolean);
        const d = loadDesign();
        const current = Array.isArray(d.gallery) ? d.gallery : [];
        // Sicherheitsnetz: nie Bilder verlieren – nur speichern, wenn dieselben Bilder umsortiert wurden
        if (newOrder.length !== current.length || newOrder.some(x => !current.includes(x))) { renderGalleryEdit(); return; }
        d.gallery = newOrder;
        saveDesign(d);
        flashDesignStatus('Reihenfolge gespeichert.');
        renderGalleryEdit();
      }, 50);
    });
  }
  if (counter) counter.textContent = `${gallery.length} / ${GALLERY_MAX}`;
  if (uploadBtn) uploadBtn.style.display = gallery.length >= GALLERY_MAX ? 'none' : '';
}

function setAccentColor(hex) {
  if (!hex) return;
  const design = loadDesign();
  design.accentColor = hex;
  saveDesign(design);
  document.documentElement.style.setProperty('--gold', hex);
  document.querySelectorAll('.color-chip').forEach(chip => {
    chip.classList.toggle('is-active', chip.dataset.color.toLowerCase() === hex.toLowerCase());
  });
  const colorInput = document.getElementById('color-input');
  if (colorInput) colorInput.value = hex;
  flashDesignStatus('Akzentfarbe übernommen.');
}

function loadDesign() {
  return window.alsterDb?.get('design') || {};
}
function saveDesign(obj) {
  window.alsterDb?.set('design', obj).then(ok => {
    if (!ok) flashDesignStatus('Speichern fehlgeschlagen.', 'error');
    else logActivity('Design aktualisiert');
  }).catch(err => flashDesignStatus('Fehler: ' + err.message, 'error'));
}

function flashDesignStatus(msg, kind = 'ok') {
  const el = document.getElementById('design-status');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('ok', 'error');
  if (kind) el.classList.add(kind);
  clearTimeout(flashDesignStatus._t);
  flashDesignStatus._t = setTimeout(() => {
    el.textContent = 'Änderungen werden automatisch übernommen.';
    el.classList.remove('ok', 'error');
  }, 2400);
}

/* ---------- Account ---------- */

async function onResetContent() {
  if (!(await askConfirm('Wochenplan, Speisekarte und Bilder bleiben erhalten.', { title: 'Bearbeitete Texte zurücksetzen?', ok: 'Zurücksetzen' }))) return;
  const ok = await window.alsterDb.remove('content');
  if (ok === false) { warnWriteFailed(); return; }
  showToast('Texte wurden auf den Original-Zustand zurückgesetzt.');
}

async function onResetAll() {
  const ok1 = await askChoice({
    title: 'Alle Inhalte zurücksetzen?',
    text: 'Gelöscht werden: Mittagstisch (alle Wochen), Speisekarte, Öffnungszeiten, Schließtage, Hinweis-Banner, Bilder & Farben, Webseiten-Texte, Brötchen-Sorten und die Berliner-Aktion (wird ausgeschaltet). Reservierungen, Bestellungen und Ihr Konto bleiben erhalten. Das lässt sich nicht rückgängig machen.',
    actions: [{ label: 'Abbrechen', value: false }, { label: 'Alles zurücksetzen', value: true, kind: 'danger' }]
  });
  if (!ok1) return;
  const keys = ['weekly-menu', 'notice', 'menu', 'specials', 'hours', 'holidays', 'design', 'content', 'broetchen-items', 'berliner-items', 'berliner-settings'];
  const results = await Promise.all(keys.map(k => window.alsterDb.remove(k).catch(() => false)));
  Object.keys(GUARDED_FORMS).forEach(markClean);
  renderWeek();
  renderNotice();
  renderMenuEditor();
  renderSpecialsEditor();
  renderHoursEditor();
  renderHolidaysEditor();
  renderDesignEditor();
  renderBroetchenEditor();
  renderBerlinerAdmin();
  renderOverviewSummary();
  if (results.some(r => r === false)) { warnWriteFailed(); return; }
  logActivity('Alle Inhalte zurückgesetzt');
  showToast('✓ Alle Inhalte wurden auf Standard zurückgesetzt.');
}


/* ---------- Storage ---------- */

function loadAll() {
  return window.alsterDb?.get('weekly-menu') || {};
}
// Liefert true/false (dbSet wirft nicht, sondern meldet Fehler per false).
async function saveAll(obj) {
  try {
    const ok = await window.alsterDb?.set('weekly-menu', obj);
    return ok !== false;
  } catch (e) {
    console.error('Speichern fehlgeschlagen', e);
    return false;
  }
}
function reportWeekSave(ok, okText) {
  if (ok) { setStatus(dom.saveStatus, okText, 'ok'); return; }
  setStatus(dom.saveStatus, 'Speichern fehlgeschlagen. Bitte erneut versuchen.', 'error');
  warnWriteFailed();
}

/* ---------- Aktivitätslog ---------- */
const ACTIVITY_KEY = 'alstercafe.activity';
function logActivity(action) {
  let log = [];
  try { log = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]'); } catch {}
  log.unshift({ at: new Date().toISOString(), who: dom.userBadge?.textContent || 'Inhaber', action });
  log = log.slice(0, 30);
  try { localStorage.setItem(ACTIVITY_KEY, JSON.stringify(log)); } catch {}
  renderActivityLog();
}
function renderActivityLog() {
  const ul = document.getElementById('activity-log');
  if (!ul) return;
  let log = [];
  try { log = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]'); } catch {}
  if (!log.length) {
    ul.innerHTML = '<li class="activity-empty">Noch keine Aktivität.</li>';
    return;
  }
  ul.innerHTML = log.map(item => {
    const d = new Date(item.at);
    const rel = formatRelative(d);
    return `
      <li class="activity-item">
        <span class="activity-when">${rel}</span>
        <span class="activity-action">${escapeHtml(item.action)}</span>
        <span class="activity-who">${escapeHtml(item.who)}</span>
      </li>`;
  }).join('');
}
function loadNotice() {
  return window.alsterDb?.get('notice') || '';
}
async function saveNotice(text) {
  let ok;
  try {
    ok = text ? await window.alsterDb?.set('notice', text) : await window.alsterDb?.remove('notice');
  } catch (e) { ok = false; }
  if (ok === false) return false;
  logActivity(text ? 'Hinweis-Banner aktualisiert' : 'Hinweis-Banner ausgeblendet');
  return true;
}

/* ---------- Konto: Passwort & Mitarbeiter ---------- */

async function onChangePassword(e) {
  e.preventDefault();
  const a = dom.newPassword.value;
  const b = dom.newPasswordConfirm.value;
  if (a !== a.trim()) {
    setStatus(dom.passwordStatus, 'Bitte keine Leerzeichen am Anfang oder Ende des Passworts.', 'error');
    return;
  }
  if (a.length < 10 || !/\S/.test(a)) {
    setStatus(dom.passwordStatus, 'Bitte mindestens 10 Zeichen verwenden.', 'error');
    return;
  }
  if (a !== b) {
    setStatus(dom.passwordStatus, 'Die Passwörter stimmen nicht überein.', 'error');
    return;
  }
  setStatus(dom.passwordStatus, 'Wird gespeichert …');
  const btn = dom.passwordForm.querySelector('button[type="submit"]');
  if (btn?.disabled) return;
  if (btn) btn.disabled = true;
  const result = await window.alsterDb.auth.updatePassword(a).finally(() => { if (btn) btn.disabled = false; });
  if (result.ok) {
    dom.passwordForm.reset();
    setStatus(dom.passwordStatus, 'Passwort wurde geändert.', 'ok');
  } else {
    setStatus(dom.passwordStatus, result.error || 'Speichern fehlgeschlagen.', 'error');
  }
}

/* ---------- Helpers ---------- */

function setStatus(el, msg, kind = '') {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('ok', 'error', 'is-pending');
  if (kind) el.classList.add(kind);
}

/* ---------- Übersicht auf einen Blick ---------- */
// Fuellt die Zusammenfassungs-Kacheln auf der Startansicht aus dem Cache:
// offene Reservierungen/Bestellungen, heutiges Mittagsgericht, naechste
// Reservierung. Wird nach jedem Laden/Realtime-Event aktualisiert.
function renderOverviewSummary() {
  const resArr = (() => { const l = window.alsterDb?.get('reservations'); return Array.isArray(l) ? l : []; })();
  const ordArr = (() => { const l = window.alsterDb?.get('orders'); return Array.isArray(l) ? l : []; })();
  const newRes = resArr.filter(r => isOpenEntry(r, 'date')).length;
  const newOrd = ordArr.filter(o => isOpenEntry(o, 'pickupDate')).length;
  // Offene Anfragen im Browser-Tab sichtbar, z. B. „(2) Mitgliederbereich · Alstercafé“
  const openTotal = newRes + newOrd;
  document.title = (openTotal ? `(${openTotal}) ` : '') + 'Mitgliederbereich · Alstercafé';
  countTo(dom.summaryAnfragen, newRes);
  countTo(dom.summaryOrders, newOrd);
  setBottomBadge('anfragen', newRes);
  setBottomBadge('bestellungen', newOrd);
  // Offene Einträge golden hervorheben (Facelift)
  dom.summaryAnfragen?.closest('.summary-stat')?.classList.toggle('has-open', newRes > 0);
  dom.summaryOrders?.closest('.summary-stat')?.classList.toggle('has-open', newOrd > 0);

  // Heutiges Mittagsgericht aus dem Wochenplan
  if (dom.summaryTodayDish) {
    const all = loadAll();
    const today = new Date();
    const wk = all[isoDate(mondayOf(today))];
    const dayKey = DAYS[(today.getDay() + 6) % 7].key;
    const day = wk && wk.days ? wk.days[dayKey] : null;
    const dish = [day?.dish, day?.dish2].map(d => (d || '').trim()).filter(Boolean).join('  ·  oder  ·  ');
    dom.summaryTodayDish.textContent = (day && day.closed)
      ? 'Heute kein Mittagstisch'
      : (dish || 'Noch nichts eingetragen');
  }

  // Heute: Tische und Abholungen (Kurzfassung des Kalenders)
  const todayText = document.getElementById('summary-today-text');
  if (todayText) {
    const t = isoDate(new Date());
    const nRes = resArr.filter(r => r.date === t).length;
    const nOrd = ordArr.filter(o => o.pickupDate === t).length;
    todayText.textContent = (nRes || nOrd)
      ? `Heute: ${nRes} ${nRes === 1 ? 'Tisch' : 'Tische'} · ${nOrd} ${nOrd === 1 ? 'Abholung' : 'Abholungen'}`
      : 'Heute: keine Reservierungen oder Abholungen';
  }

  // Naechste kommende, offene Reservierung
  if (dom.summaryNextRes) {
    const todayIso = isoDate(new Date());
    const upcoming = resArr
      .filter(r => r.date && r.date >= todayIso && r.status !== 'done')
      .sort((a, b) => ((a.date || '') + (a.time || '')).localeCompare((b.date || '') + (b.time || '')));
    const n = upcoming[0];
    dom.summaryNextRes.textContent = n
      ? `${formatAnfrageDate(n.date, n.time)}${n.name ? ' · ' + n.name : ''}`
      : 'keine';
  }
}

/* ---------- Anfragen (Reservierungen) ---------- */

async function refreshAnfragen() {
  try {
    await window.alsterDb?.listReservations();   // schreibt in Cache
  } catch {}
  renderAnfragen();
  renderOverviewSummary();
  renderOwnerCalendar();
}

/* Während der Inhaber in einem Notizfeld tippt, nicht neu rendern (sonst geht der
   noch nicht gespeicherte Text verloren). Neu gerendert wird nach dem Verlassen. */
function deferRenderWhileTyping(listId, fn) {
  const a = document.activeElement;
  if (a && a.matches && a.matches('[data-note]') && a.closest('#' + listId)) {
    if (!a.dataset.renderPending) {
      a.dataset.renderPending = '1';
      a.addEventListener('blur', () => setTimeout(fn, 0), { once: true });
    }
    return true;
  }
  return false;
}

function renderAnfragen() {
  if (deferRenderWhileTyping('anfragen-list', renderAnfragen)) return;
  const list = window.alsterDb?.get('reservations') || [];
  const items = Array.isArray(list) ? list : [];
  const newCount = items.filter(r => isOpenEntry(r, 'date')).length;

  if (dom.anfragenBadge) {
    dom.anfragenBadge.hidden = newCount === 0;
    dom.anfragenBadge.textContent = newCount > 0 ? String(newCount) : '';
  }
  if (dom.tabAnfragenBadge) {
    dom.tabAnfragenBadge.hidden = newCount === 0;
    dom.tabAnfragenBadge.textContent = newCount > 0 ? String(newCount) : '';
  }
  if (dom.anfragenCount) {
    dom.anfragenCount.hidden = items.length === 0;
    dom.anfragenCount.textContent = items.length === 1 ? '1 Anfrage' : `${items.length} Anfragen`;
  }
  if (!dom.anfragenList) return;

  if (items.length === 0) {
    dom.anfragenList.innerHTML = '<li class="anfragen-empty">Hier erscheinen Reservierungsanfragen, sobald jemand das Formular auf der Webseite ausfüllt.</li>';
    return;
  }
  const hasQuery = !!(dom.anfragenSearch && dom.anfragenSearch.value.trim());
  const { upcoming, past } = splitByDate(items, dom.anfragenSearch?.value, 'date');
  let html = upcoming.length
    ? upcoming.map(r => buildAnfrageItem(r)).join('')
    : `<li class="anfragen-empty">${hasQuery ? 'Keine Treffer bei den kommenden Anfragen.' : 'Keine kommenden Anfragen.'}</li>`;
  if (past.length) {
    const wasOpen = !!dom.anfragenList.querySelector('.anfragen-past details')?.open;
    html += `<li class="anfragen-past"><details${hasQuery || wasOpen ? ' open' : ''}>
      <summary>Vergangene (${past.length})</summary>
      <ul class="anfragen-sublist">${past.map(r => buildAnfrageItem(r)).join('')}</ul>
    </details></li>`;
  }
  dom.anfragenList.innerHTML = html;
  bindInboxHandlers(dom.anfragenList, {
    onMark: onMarkAnfrage, onDel: onDeleteAnfrage, onNote: onSaveAnfrageNote
  });
}

/* Teilt + filtert Inbox-Einträge: Suche nach Name/Telefon/E-Mail/Datum und
   Aufteilung in kommende (heute/zukünftig/ohne Datum) vs. vergangene. */
/* Eine Definition für „offen“ überall (Übersicht, Kachel, Reiter, Browser-Tab):
   noch nicht erledigt UND Termin heute oder später (vergangene zählen nicht mehr). */
function isOpenEntry(it, dateKey) {
  if (!it || it.status === 'done') return false;
  const ds = it[dateKey];
  return !ds || ds >= isoDate(new Date());
}

// "2026-10-24" → "24.10.2026" (für die Suche nach deutschem Datum)
function deDate(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

function splitByDate(items, query, dateKey) {
  const q = (query || '').trim().toLowerCase();
  const filtered = q ? items.filter(it =>
    (it.name  || '').toLowerCase().includes(q) ||
    (it.phone || '').toLowerCase().includes(q) ||
    (it.email || '').toLowerCase().includes(q) ||
    (it[dateKey] || '').toLowerCase().includes(q) ||
    deDate(it[dateKey]).includes(q)
  ) : items.slice();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = [], past = [];
  filtered.forEach(it => {
    const ds = it[dateKey];
    let diff = null;
    if (ds) { const d = new Date(ds + 'T00:00:00'); if (!isNaN(d)) diff = Math.round((d - today) / 86400000); }
    if (diff !== null && diff < 0) past.push(it); else upcoming.push(it);
  });
  const t = x => (x.time || x.pickupTime || '');
  upcoming.sort((a, b) => ((a[dateKey] || '9999-99-99') + t(a)).localeCompare((b[dateKey] || '9999-99-99') + t(b)));
  past.sort((a, b) => ((b[dateKey] || '') + t(b)).localeCompare((a[dateKey] || '') + t(a)));
  return { upcoming, past };
}

/* Bindet Mark/Löschen/Notiz-Handler innerhalb eines Listen-Containers. */
function bindInboxHandlers(container, { onMark, onDel, onNote }) {
  container.querySelectorAll('[data-mark]').forEach(b => b.addEventListener('click', () => onMark(b.dataset.mark)));
  container.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => onDel(b.dataset.del)));
  container.querySelectorAll('[data-note]').forEach(t => t.addEventListener('change', () => onNote(t.dataset.note, t.value)));
  container.querySelectorAll('[data-confirm]').forEach(b => b.addEventListener('click', () => onSendConfirmation(b.dataset.confirm, b.dataset.ctype)));
}

/* Schönes deutsches Datum für die Bestätigungs-Mail. */
function niceDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return iso; }
}

/* Bestätigungs-E-Mail an den Gast senden (ein Knopf, eine Bestätigung). */
/* Fenster vor dem Versand der Bestätigung: optionale persönliche Nachricht an den
   Gast. Liefert den (getrimmten) Text, "" für ohne Nachricht, oder null bei Abbruch. */
const PERSONAL_MESSAGE_MAX = 1000;
function askPersonalMessage(email) {
  return new Promise(resolve => {
    const dlg = document.createElement('dialog');
    if (typeof dlg.showModal !== 'function') {
      // Sehr alte Browser ohne <dialog>: einfache Abfrage als Ersatz.
      const v = prompt(`Bestätigung an ${email} senden.\n\nPersönliche Nachricht (optional, leer lassen für ohne):`, '');
      resolve(v === null ? null : v.trim().slice(0, PERSONAL_MESSAGE_MAX));
      return;
    }
    dlg.className = 'confirm-dialog';
    dlg.innerHTML = `
      <form method="dialog" class="confirm-dialog-form">
        <h3 class="confirm-dialog-title">Bestätigung senden</h3>
        <p class="confirm-dialog-to">An: <strong>${escapeHtml(email)}</strong></p>
        <label class="confirm-dialog-label" for="confirm-dialog-msg">Persönliche Nachricht an den Gast <span>(optional)</span></label>
        <textarea id="confirm-dialog-msg" class="confirm-dialog-msg" rows="4" maxlength="${PERSONAL_MESSAGE_MAX}"
          placeholder="z. B. Wir haben Ihnen einen Tisch am Fenster reserviert."></textarea>
        <p class="confirm-dialog-hint">Bleibt das Feld leer, geht die Bestätigung ganz normal raus.</p>
        <div class="confirm-dialog-actions">
          <button type="button" class="btn btn-link" data-act="cancel">Abbrechen</button>
          <button type="submit" class="btn btn-primary" data-act="send">
            <svg class="ico ico-sm" aria-hidden="true"><use href="#i-bell"/></svg>
            Jetzt senden
          </button>
        </div>
      </form>`;
    document.body.appendChild(dlg);
    const ta = dlg.querySelector('textarea');
    let result = null;
    const close = (val) => { result = val; dlg.close(); };
    dlg.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
    dlg.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      close(ta.value.trim().slice(0, PERSONAL_MESSAGE_MAX));
    });
    dlg.addEventListener('cancel', () => { result = null; }); // Esc
    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
    dlg.showModal();
    ta.focus();
  });
}

/* Ein Status für alle Karten: Neu → Bestätigt → Erledigt */
function entryStage(x) {
  if (x && x.status === 'done') return 'done';
  if (x && x.confirmedAt) return 'confirmed';
  return 'new';
}
function statusTagHtml(x) {
  const st = entryStage(x);
  if (st === 'done') return '<span class="anfrage-tag is-stage-done">Erledigt</span>';
  if (st === 'confirmed') return '<span class="anfrage-tag is-stage-confirmed">Bestätigt</span>';
  return '<span class="anfrage-tag is-new">Neu</span>';
}
/* Ohne E-Mail: klarer Hinweis statt fehlendem Knopf */
function noMailHintHtml(x) {
  if (!x || x.email || x.status === 'done') return '';
  const tel = x.phone ? ` <a href="tel:${escapeAttr(String(x.phone).replace(/\s+/g, ''))}">${escapeHtml(x.phone)} anrufen</a>` : '';
  return `<p class="anfrage-nomail">Keine E-Mail-Adresse – bitte telefonisch bestätigen.${tel}</p>`;
}

/* Verlauf an der Karte: wann bestätigt (Mail) und wann erledigt */
function formatStamp(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const day = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time} Uhr`;
}
function historyHtml(x) {
  const rows = [];
  if (x.confirmedAt) rows.push(`<span class="anfrage-hist is-confirmed"><svg class="ico ico-sm" aria-hidden="true"><use href="#i-check"/></svg> Bestätigung gesendet · ${escapeHtml(formatStamp(x.confirmedAt))}</span>`);
  if (x.status === 'done' && x.doneAt) rows.push(`<span class="anfrage-hist is-done"><svg class="ico ico-sm" aria-hidden="true"><use href="#i-check"/></svg> Erledigt · ${escapeHtml(formatStamp(x.doneAt))}</span>`);
  return rows.join('');
}

const confirmSending = new Set();
async function onSendConfirmation(id, ctype) {
  if (confirmSending.has(id)) return; // läuft schon, kein Doppelversand
  const key = ctype === 'order' ? 'orders' : 'reservations';
  const list = window.alsterDb?.get(key) || [];
  const it = (Array.isArray(list) ? list : []).find(x => x.id === id);
  if (!it) return;
  if (!it.email) { showToast('Für diese Anfrage ist keine E-Mail-Adresse hinterlegt – bitte telefonisch bestätigen.', { tone: 'error' }); return; }
  const message = await askPersonalMessage(it.email);
  if (message === null) return; // abgebrochen

  const payload = ctype === 'order'
    ? { type: 'order', name: it.name, email: it.email, pickupDate: niceDate(it.pickupDate), pickupTime: it.pickupTime, total: it.totalCount, items: it.items }
    : { type: 'reservation', name: it.name, email: it.email, date: niceDate(it.date), time: it.time, persons: it.persons };
  if (message) payload.message = message;

  confirmSending.add(id);
  const btns = Array.from(document.querySelectorAll(`[data-confirm="${CSS.escape(id)}"]`));
  const labels = btns.map(b => b.innerHTML);
  btns.forEach(b => { b.disabled = true; b.textContent = 'Wird gesendet …'; });
  let res;
  try { res = await window.alsterDb?.sendConfirmation(payload); }
  finally {
    confirmSending.delete(id);
    btns.forEach((b, i) => { b.disabled = false; b.innerHTML = labels[i]; });
  }
  if (res && res.ok) {
    await window.alsterDb?.markConfirmed?.(key, id);
    if (ctype === 'order') renderOrders(); else renderAnfragen();
    showToast(`✓ Bestätigung an ${it.email} gesendet`);
  } else {
    askNotice('Bestätigung nicht gesendet', 'Die E-Mail konnte nicht verschickt werden: ' + ((res && res.error) || 'unbekannter Fehler') +
      '. Bitte später erneut versuchen oder den Gast anrufen.');
  }
}

async function onSaveAnfrageNote(id, note) {
  const ok = await window.alsterDb?.updateReservationNote(id, note);
  if (ok === false) warnWriteFailed();
}

function buildAnfrageItem(r) {
  const rec = r.receivedAt ? formatRelative(new Date(r.receivedAt)) : '';
  const dateLabel = formatAnfrageDate(r.date, r.time);
  const isDone = r.status === 'done';
  const tel = r.phone ? `tel:${r.phone.replace(/\s+/g,'')}` : '';
  const mailSubject = encodeURIComponent(`Ihre Reservierungsanfrage – Alstercafé`);
  const mailBody = encodeURIComponent(`Guten Tag ${r.name || ''},\n\nvielen Dank für Ihre Anfrage. \n\nHerzliche Grüße\nAlstercafé`);
  const mailLink = r.email
    ? `mailto:${escapeAttr(encodeURIComponent(r.email).replace(/%40/g, '@'))}?subject=${mailSubject}&body=${mailBody}`
    : '';

  return `
    <li class="anfrage-item ${isDone ? 'is-done' : ''}${spotClass(r.id)}">
      <div class="anfrage-head">
        <div>
          <span class="anfrage-name">${escapeHtml(r.name || 'Ohne Namen')}</span>
          ${r.persons ? `<span class="anfrage-pers">· ${escapeHtml(String(r.persons).trim())}${/^\d+$/.test(String(r.persons).trim()) ? (Number(r.persons) === 1 ? ' Person' : ' Personen') : ''}</span>` : ''}
        </div>
        ${statusTagHtml(r)}
      </div>
      <p class="anfrage-when">${escapeHtml(dateLabel)}${pickupBadgeHtml(r.date)}</p>
      <div class="anfrage-contact">
        ${r.phone ? `<a href="${escapeAttr(tel)}">${escapeHtml(r.phone)}</a>` : ''}
        ${r.email ? `<a href="${mailLink}">${escapeHtml(r.email)}</a>` : ''}
      </div>
      ${r.message ? `<p class="anfrage-msg">${escapeHtml(r.message)}</p>` : ''}
      <label class="anfrage-note">
        <span class="anfrage-note-label">Notiz (intern)</span>
        <textarea class="anfrage-note-input" data-note="${escapeAttr(r.id)}" rows="1" placeholder="z. B. angerufen, Tisch am Fenster …">${escapeHtml(r.note || '')}</textarea>
      </label>
      ${noMailHintHtml(r)}
      <div class="anfrage-meta">
        <span class="anfrage-rec">Eingegangen ${escapeHtml(rec)}${historyHtml(r)}</span>
        <div class="anfrage-actions">
          ${isDone
            ? `<button type="button" class="anfrage-btn anfrage-btn-mark" data-mark="${escapeAttr(r.id)}">Erneut öffnen</button>`
            : `<button type="button" class="anfrage-btn anfrage-btn-mark is-primary" data-mark="${escapeAttr(r.id)}">
                <svg class="ico ico-sm" aria-hidden="true"><use href="#i-check"/></svg>
                Als erledigt markieren
              </button>`}
          ${r.email ? `<button type="button" class="anfrage-btn anfrage-btn-confirm" data-confirm="${escapeAttr(r.id)}" data-ctype="reservation">
            <svg class="ico ico-sm" aria-hidden="true"><use href="#i-bell"/></svg>
            ${r.confirmedAt ? 'Bestätigung erneut senden' : 'Bestätigung senden'}
          </button>` : ''}
          <button type="button" class="anfrage-btn anfrage-btn-del" data-del="${escapeAttr(r.id)}" aria-label="Anfrage löschen">
            <svg class="ico ico-sm" aria-hidden="true"><use href="#i-trash"/></svg>
            Löschen
          </button>
        </div>
      </div>
    </li>
  `;
}

function formatAnfrageDate(date, time) {
  if (!date) return time ? `Uhrzeit ${time}` : 'Datum offen';
  try {
    const d = new Date(date + 'T00:00:00');
    if (isNaN(d)) return time ? `${date} · ${time} Uhr` : String(date);
    const opts = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
    const datePart = d.toLocaleDateString('de-DE', opts);
    return time ? `${datePart} · ${time} Uhr` : datePart;
  } catch { return time ? `${date} · ${time}` : date; }
}

/* Gibt eine Dringlichkeits-Pille zurueck: Heute / Morgen / Vergangen */
function pickupBadgeHtml(dateStr) {
  if (!dateStr) return '';
  let diff;
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return '';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    diff = Math.round((d - today) / 86400000);
  } catch { return ''; }
  if (diff === 0)  return '<span class="pickup-badge is-today">Heute</span>';
  if (diff === 1)  return '<span class="pickup-badge is-soon">Morgen</span>';
  if (diff < 0)    return '<span class="pickup-badge is-past">Vergangen</span>';
  return '';
}

async function onMarkAnfrage(id) {
  const list = window.alsterDb?.get('reservations') || [];
  const current = (Array.isArray(list) ? list : []).find(r => r.id === id);
  const nextStatus = current?.status === 'done' ? 'new' : 'done';
  // db.js aktualisiert den Cache synchron beim Aufruf → erst aufrufen, dann sofort rendern.
  const pending = window.alsterDb?.updateReservationStatus(id, nextStatus);
  renderAnfragen();
  if (nextStatus === 'done') sparkleCard(id);
  const ok = await pending;
  if (ok === false) warnWriteFailed();
  await refreshAnfragen();
}

async function onDeleteAnfrage(id) {
  if (!(await askConfirm('Die Reservierung wird dauerhaft gelöscht. Tipp: „Als erledigt markieren“ behält sie im Verlauf.', { title: 'Reservierung löschen?', ok: 'Löschen' }))) return;
  const pending = window.alsterDb?.deleteReservation(id);
  renderAnfragen();
  const ok = await pending;
  if (ok === false) warnWriteFailed();
  await refreshAnfragen();
}

/* Dezente Erfolgsmeldung unten (statt Pop-up). Fehler bleiben als deutliches Fenster. */
function showToast(msg, opts = {}) {
  let el = document.getElementById('admin-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'admin-toast';
    el.className = 'admin-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.addEventListener('click', () => { if (el._onClick) { el._onClick(); el.classList.remove('is-shown'); } });
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.toggle('is-error', opts.tone === 'error');
  el._onClick = opts.onClick || null;
  el.classList.toggle('is-clickable', !!opts.onClick);
  el.classList.add('is-shown');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('is-shown'), opts.duration || 3800);
}

/* Neue Reservierung/Bestellung kam live rein: kurz einblenden, Antippen öffnet den Bereich */
function announceNewEntries(key, items) {
  const it = items[0];
  const more = items.length > 1 ? ` (+${items.length - 1} weitere)` : '';
  let msg;
  if (key === 'reservations') {
    msg = `Neue Reservierung: ${it.name || 'ohne Namen'} · ${formatAnfrageDate(it.date, it.time)}${more} – antippen zum Ansehen`;
  } else {
    const berliner = Array.isArray(it.items) && it.items.some(x => x && x.kind === 'berliner');
    msg = `Neue ${berliner ? 'Berliner-' : ''}Bestellung: ${it.name || 'ohne Namen'} · ${it.totalCount || 0} Stück${more} – antippen zum Ansehen`;
  }
  showToast('🔔 ' + msg, { duration: 9000, onClick: () => switchTab(key === 'reservations' ? 'anfragen' : 'bestellungen') });
}

// Gemeinsame Fehlermeldung, wenn Supabase eine Aenderung ablehnt (z. B. wenn die
// Datenbank nur-lesend ist oder die Schreibrechte fehlen). Ohne diesen Hinweis
// wuerde der Eintrag beim naechsten Laden einfach wieder auftauchen — verwirrend.
function warnWriteFailed() {
  const detail = (window.alsterDb?.writeError && window.alsterDb.writeError()) || '';
  askNotice('Nicht gespeichert',
    'Die Datenbank nimmt gerade keine Änderungen an – beim Neuladen erscheint wieder der Server-Stand. ' +
    'Bitte Internetverbindung prüfen und erneut speichern.' +
    (detail ? ' (Technischer Hinweis: ' + detail + ')' : ''));
}

/* ---------- Bestellungen (belegte Brötchen) ---------- */

async function refreshOrders() {
  try { await window.alsterDb?.listOrders(); } catch {}
  renderOrders();
  renderOverviewSummary();
  renderOwnerCalendar();
}

function renderOrders() {
  if (deferRenderWhileTyping('orders-list', renderOrders)) return;
  const list = window.alsterDb?.get('orders') || [];
  const items = Array.isArray(list) ? list : [];
  const newCount = items.filter(o => isOpenEntry(o, 'pickupDate')).length;

  if (dom.ordersBadge) {
    dom.ordersBadge.hidden = newCount === 0;
    dom.ordersBadge.textContent = newCount > 0 ? String(newCount) : '';
  }
  if (dom.tabOrdersBadge) {
    dom.tabOrdersBadge.hidden = newCount === 0;
    dom.tabOrdersBadge.textContent = newCount > 0 ? String(newCount) : '';
  }
  if (dom.ordersCount) {
    dom.ordersCount.hidden = items.length === 0;
    dom.ordersCount.textContent = items.length === 1 ? '1 Bestellung' : `${items.length} Bestellungen`;
  }
  if (!dom.ordersList) return;

  if (items.length === 0) {
    dom.ordersList.innerHTML = '<li class="orders-empty">Hier erscheinen Brötchen-Bestellungen, sobald die ersten über den Brötchen-Service eingehen.</li>';
    return;
  }
  const hasQuery = !!(dom.ordersSearch && dom.ordersSearch.value.trim());
  const { upcoming, past } = splitByDate(items, dom.ordersSearch?.value, 'pickupDate');
  let html = upcoming.length
    ? upcoming.map(o => buildOrderItem(o)).join('')
    : `<li class="orders-empty">${hasQuery ? 'Keine Treffer bei den kommenden Bestellungen.' : 'Keine kommenden Bestellungen.'}</li>`;
  if (past.length) {
    const wasOpen = !!dom.ordersList.querySelector('.anfragen-past details')?.open;
    html += `<li class="anfragen-past"><details${hasQuery || wasOpen ? ' open' : ''}>
      <summary>Vergangene (${past.length})</summary>
      <ul class="anfragen-sublist">${past.map(o => buildOrderItem(o)).join('')}</ul>
    </details></li>`;
  }
  dom.ordersList.innerHTML = html;
  bindInboxHandlers(dom.ordersList, {
    onMark: onMarkOrder, onDel: onDeleteOrder, onNote: onSaveOrderNote
  });
}

async function onSaveOrderNote(id, note) {
  const ok = await window.alsterDb?.updateOrderNote(id, note);
  if (ok === false) warnWriteFailed();
}

function buildOrderItem(o) {
  const rec = o.receivedAt ? formatRelative(new Date(o.receivedAt)) : '';
  const dateLabel = formatAnfrageDate(o.pickupDate, o.pickupTime);
  const isDone = o.status === 'done';
  const tel = o.phone ? `tel:${o.phone.replace(/\s+/g,'')}` : '';
  const isBerliner = Array.isArray(o.items) && o.items.some(it => it && it.kind === 'berliner');
  const unit = isBerliner ? 'Berliner' : 'Brötchen';
  const mailSubject = encodeURIComponent(`Ihre ${unit}-Bestellung – Alstercafé`);
  const mailBody = encodeURIComponent(`Guten Tag ${o.name || ''},\n\nvielen Dank für Ihre Bestellung. Wir haben sie notiert.\n\nHerzliche Grüße\nAlstercafé`);
  const mailLink = o.email ? `mailto:${escapeAttr(encodeURIComponent(o.email).replace(/%40/g, '@'))}?subject=${mailSubject}&body=${mailBody}` : '';
  const lineItems = Array.isArray(o.items) ? o.items : [];
  const fmtEuro = n => Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  const priced = lineItems.filter(it => typeof it.price === 'number' && it.price > 0);
  const sumCents = priced.reduce((s, it) => s + Math.round(it.price * 100) * (parseInt(it.qty, 10) || 0), 0);
  const itemsList = lineItems
    .map(it => {
      const p = (typeof it.price === 'number' && it.price > 0)
        ? ` <span class="order-line-price">${fmtEuro(it.price * (parseInt(it.qty, 10) || 0))}</span>` : '';
      return `<li><span class="order-line-qty">${escapeHtml(String(it.qty))}×</span> ${escapeHtml(it.name)}${p}</li>`;
    })
    .join('')
    + (priced.length ? `<li class="order-line-total">Summe${priced.length < lineItems.length ? ' (ohne Sorten ohne Preis)' : ''} <span class="order-line-price">${fmtEuro(sumCents / 100)}</span></li>` : '');

  return `
    <li class="anfrage-item order-item ${isDone ? 'is-done' : ''}${spotClass(o.id)}">
      <div class="anfrage-head">
        <div>
          <span class="anfrage-name">${escapeHtml(o.name || 'Ohne Namen')}</span>
          <span class="anfrage-pers">· ${escapeHtml(String(o.totalCount || 0))} ${unit}</span>
          ${isBerliner ? '<span class="anfrage-tag is-berliner">Berliner</span>' : ''}
        </div>
        ${statusTagHtml(o)}
      </div>
      <p class="anfrage-when">Abholung: ${escapeHtml(dateLabel)}${pickupBadgeHtml(o.pickupDate)}</p>
      <ul class="order-line-list">${itemsList}</ul>
      <div class="anfrage-contact">
        ${o.phone ? `<a href="${escapeAttr(tel)}">${escapeHtml(o.phone)}</a>` : ''}
        ${o.email ? `<a href="${mailLink}">${escapeHtml(o.email)}</a>` : ''}
      </div>
      ${o.notes ? `<p class="anfrage-msg">${escapeHtml(o.notes)}</p>` : ''}
      <label class="anfrage-note">
        <span class="anfrage-note-label">Notiz (intern)</span>
        <textarea class="anfrage-note-input" data-note="${escapeAttr(o.id)}" rows="1" placeholder="z. B. vorbereitet, bezahlt …">${escapeHtml(o.note || '')}</textarea>
      </label>
      ${noMailHintHtml(o)}
      <div class="anfrage-meta">
        <span class="anfrage-rec">Eingegangen ${escapeHtml(rec)}${historyHtml(o)}</span>
        <div class="anfrage-actions">
          ${isDone
            ? `<button type="button" class="anfrage-btn anfrage-btn-mark" data-mark="${escapeAttr(o.id)}">Erneut öffnen</button>`
            : `<button type="button" class="anfrage-btn anfrage-btn-mark is-primary" data-mark="${escapeAttr(o.id)}">
                <svg class="ico ico-sm" aria-hidden="true"><use href="#i-check"/></svg>
                Als erledigt markieren
              </button>`}
          ${o.email ? `<button type="button" class="anfrage-btn anfrage-btn-confirm" data-confirm="${escapeAttr(o.id)}" data-ctype="order">
            <svg class="ico ico-sm" aria-hidden="true"><use href="#i-bell"/></svg>
            ${o.confirmedAt ? 'Bestätigung erneut senden' : 'Bestätigung senden'}
          </button>` : ''}
          <button type="button" class="anfrage-btn anfrage-btn-del" data-del="${escapeAttr(o.id)}" aria-label="Bestellung löschen">
            <svg class="ico ico-sm" aria-hidden="true"><use href="#i-trash"/></svg>
            Löschen
          </button>
        </div>
      </div>
    </li>
  `;
}

async function onMarkOrder(id) {
  const list = window.alsterDb?.get('orders') || [];
  const current = (Array.isArray(list) ? list : []).find(o => o.id === id);
  const nextStatus = current?.status === 'done' ? 'new' : 'done';
  const pending = window.alsterDb?.updateOrderStatus(id, nextStatus);
  renderOrders();
  if (nextStatus === 'done') sparkleCard(id);
  const ok = await pending;
  if (ok === false) warnWriteFailed();
  await refreshOrders();
}

async function onDeleteOrder(id) {
  if (!(await askConfirm('Die Bestellung wird dauerhaft gelöscht. Tipp: „Als erledigt markieren“ behält sie im Verlauf.', { title: 'Bestellung löschen?', ok: 'Löschen' }))) return;
  const pending = window.alsterDb?.deleteOrder(id);
  renderOrders();
  const ok = await pending;
  if (ok === false) warnWriteFailed();
  await refreshOrders();
}

/* ---------- Brötchen-Sorten-Editor ---------- */

const DEFAULT_BROETCHEN = [
  { name: 'Käse',                desc: 'Gouda & Bergkäse, Salatblatt, Butter' },
  { name: 'Schinken',            desc: 'Gekochter Schinken, Ei, Gurke' },
  { name: 'Salami',              desc: 'Edelsalami, Käse, Salat' },
  { name: 'Frischkäse & Gurke',  desc: 'Kräuterfrischkäse, Gurke, Radieschen', veg: true },
  { name: 'Ei',                  desc: 'Spiegel- oder Rührei, Schnittlauch' },
  { name: 'Lachs',               desc: 'Räucherlachs, Meerrettich-Frischkäse, Dill' },
  { name: 'Bunt gemischt',       desc: 'Wir stellen eine ausgewogene Auswahl zusammen' }
];

function renderBroetchenEditor() {
  markClean('broetchen-form');
  if (!dom.broetchenEditor) return;
  let items = window.alsterDb?.get('broetchen-items');
  if (!Array.isArray(items) || !items.length) items = DEFAULT_BROETCHEN;
  dom.broetchenEditor.innerHTML = '';
  items.forEach(it => addBroetchenRow(it, true));
  setStatus(dom.broetchenStatus, '');
}

function addBroetchenRow(item, skipStatus) {
  if (!dom.broetchenEditor) return;
  const data = item || { name: '', desc: '', veg: false };
  const row = document.createElement('div');
  row.className = 'broetchen-edit-row';
  row.innerHTML = `
    <div class="broetchen-edit-fields">
      <input type="text" class="broetchen-edit-name" placeholder="Sorte (z. B. Käse)" value="${escapeAttr(data.name || '')}" />
      <input type="text" class="broetchen-edit-desc" placeholder="Beschreibung (z. B. Gouda, Salat, Butter)" value="${escapeAttr(data.desc || '')}" />
      <input type="text" class="broetchen-edit-price" inputmode="decimal" placeholder="Preis €" value="${escapeAttr(data.price || '')}" aria-label="Preis pro Brötchen" />
      <label class="broetchen-edit-veg"><input type="checkbox" ${data.veg ? 'checked' : ''} /> vegetarisch</label>
    </div>
    <button type="button" class="broetchen-edit-remove" aria-label="Sorte entfernen">
      <svg class="ico ico-sm"><use href="#i-x"/></svg>
    </button>
  `;
  row.querySelector('.broetchen-edit-remove').addEventListener('click', () => {
    row.remove();
    setStatus(dom.broetchenStatus, 'Nicht vergessen: „Sorten speichern“ klicken.', '');
  });
  dom.broetchenEditor.appendChild(row);
  if (!skipStatus) setStatus(dom.broetchenStatus, 'Nicht vergessen: „Sorten speichern“ klicken.', '');
}

/* Preise prüfen und einheitlich schreiben ("2.5 €" → "2,50"). Ungültige Felder rot markieren.
   Gleiche Regeln wie die Webseite (rules.js). Liefert die Zahl fehlerhafter Felder. */
function normalizePriceFields(container) {
  let bad = 0;
  container?.querySelectorAll('.broetchen-edit-price').forEach(inp => {
    const raw = inp.value.trim();
    inp.classList.remove('is-invalid');
    inp.removeAttribute('aria-invalid');
    if (!raw) return;
    const n = window.AlsterRules.parseEuro(raw);
    if (n === null) { bad++; inp.classList.add('is-invalid'); inp.setAttribute('aria-invalid', 'true'); }
    else inp.value = window.AlsterRules.euroText(n);
  });
  return bad;
}
function priceErrorText(bad) {
  return `Nicht gespeichert: ${bad === 1 ? '1 Preis ist' : bad + ' Preise sind'} ungültig (rot markiert). Bitte z. B. „2,50“ eintragen – ohne Minus, größer als 0.`;
}

function readBroetchenForm() {
  const rows = Array.from(dom.broetchenEditor.querySelectorAll('.broetchen-edit-row'));
  const out = [];
  rows.forEach(row => {
    const name = row.querySelector('.broetchen-edit-name').value.trim();
    const desc = row.querySelector('.broetchen-edit-desc').value.trim();
    const veg  = row.querySelector('.broetchen-edit-veg input').checked;
    const price = (row.querySelector('.broetchen-edit-price')?.value || '').trim();
    if (!name) return;
    const it = { name, desc };
    if (price) it.price = price;
    if (veg) it.veg = true;
    out.push(it);
  });
  return out;
}

function onSaveBroetchen(e) {
  e.preventDefault();
  const badPrices = normalizePriceFields(dom.broetchenEditor);
  if (badPrices) { setStatus(dom.broetchenStatus, priceErrorText(badPrices), 'error'); dom.broetchenEditor.querySelector('.is-invalid')?.focus(); return false; }
  const items = readBroetchenForm();
  if (!items.length) {
    setStatus(dom.broetchenStatus, 'Bitte mindestens eine Sorte angeben.', 'error');
    return false;
  }
  return window.alsterDb?.set('broetchen-items', items).then(ok => {
    setStatus(dom.broetchenStatus,
      ok === false ? 'Speichern fehlgeschlagen.' : `Gespeichert · ${items.length} Sorten`,
      ok === false ? 'error' : 'ok');
    if (ok === false) { warnWriteFailed(); return false; }
    logActivity('Brötchen-Sorten aktualisiert');
    return true;
  });
}

async function onResetBroetchen() {
  if (!(await askConfirm('Ihre eingetragenen Sorten und Preise werden ersetzt.', { title: 'Brötchen-Sorten zurücksetzen?', ok: 'Zurücksetzen' }))) return;
  window.alsterDb?.remove('broetchen-items').then(() => {
    renderBroetchenEditor();
    setStatus(dom.broetchenStatus, 'Auf Standard zurückgesetzt.', 'ok');
  });
}

/* ---------- Berliner-Vorbestellung (Saison-Aktion) ---------- */
const DEFAULT_BERLINER = [
  { name: 'Klassisch', desc: 'Mit Konfitüre gefüllt, mit Zucker' },
  { name: 'Vanille',   desc: 'Mit Vanillecreme gefüllt' },
  { name: 'Schoko',    desc: 'Mit Schokocreme gefüllt' }
];
const bEl = id => document.getElementById(id);
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtIsoDe = iso => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
};

function renderBerlinerAdmin() {
  markClean('berliner-settings-form'); markClean('berliner-items-form');
  const st = window.alsterDb?.get('berliner-settings') || {};
  if (bEl('berliner-active')) bEl('berliner-active').checked = !!st.active;
  updateBerlinerSwitch(!!st.active);
  [['berliner-order-from', 'orderFrom'], ['berliner-order-to', 'orderTo'],
   ['berliner-pickup-from', 'pickupFrom'], ['berliner-pickup-to', 'pickupTo'],
   ['berliner-title', 'title'], ['berliner-text', 'text']].forEach(([id, k]) => {
    if (bEl(id)) bEl(id).value = st[k] || '';
  });
  updateBerlinerLive(st);
  const ed = bEl('berliner-editor');
  if (ed) {
    let items = window.alsterDb?.get('berliner-items');
    if (!Array.isArray(items) || !items.length) items = DEFAULT_BERLINER;
    ed.innerHTML = '';
    items.forEach(it => addBerlinerRow(it, true));
  }
  setStatus(bEl('berliner-settings-status'), '');
  setStatus(bEl('berliner-items-status'), '');
}

// Zeigt verständlich, ob die Aktion JETZT auf der Webseite sichtbar ist.
function updateBerlinerLive(st) {
  const { msg, live } = berlinerLiveState(st);
  const el = bEl('berliner-live');
  if (el) { el.textContent = msg; el.classList.toggle('is-live', live); }
  const badge = bEl('overview-berliner-badge');
  if (badge) badge.hidden = !live;
}
/* Eine Quelle für „ist die Aktion gerade auf der Webseite?“ – Anzeige und Speichern-Meldung */
function berlinerLiveState(st) {
  const today = todayIso();
  let msg, live = false;
  if (!st.active) msg = 'Aus — nur hier im Mitgliederbereich, auf der Webseite nicht sichtbar.';
  else if (st.orderFrom && today < st.orderFrom) msg = `Eingeschaltet — erscheint ab ${fmtIsoDe(st.orderFrom)} auf der Webseite.`;
  else if (st.orderTo && today > st.orderTo) msg = `Bestellzeitraum ist am ${fmtIsoDe(st.orderTo)} abgelaufen — nicht mehr sichtbar.`;
  else { live = true; msg = `Jetzt sichtbar: Menüpunkt „Berliner-Bestellservice“ und Hinweis auf der Startseite${st.orderTo ? ` (bis ${fmtIsoDe(st.orderTo)})` : ''}.`; }
  return { msg, live };
}

function addBerlinerRow(item, skipStatus) {
  const ed = bEl('berliner-editor');
  if (!ed) return;
  const data = item || { name: '', desc: '' };
  const row = document.createElement('div');
  row.className = 'broetchen-edit-row';
  row.innerHTML = `
    <div class="broetchen-edit-fields">
      <input type="text" class="broetchen-edit-name" placeholder="Sorte (z. B. Klassisch)" value="${escapeAttr(data.name || '')}" />
      <input type="text" class="broetchen-edit-desc" placeholder="Beschreibung (z. B. Pflaumenmus)" value="${escapeAttr(data.desc || '')}" />
      <input type="text" class="broetchen-edit-price" inputmode="decimal" placeholder="Preis €" value="${escapeAttr(data.price || '')}" aria-label="Preis pro Berliner" />
    </div>
    <button type="button" class="broetchen-edit-remove" aria-label="Sorte entfernen">
      <svg class="ico ico-sm"><use href="#i-x"/></svg>
    </button>
  `;
  row.querySelector('.broetchen-edit-remove').addEventListener('click', () => {
    row.remove();
    setStatus(bEl('berliner-items-status'), 'Nicht vergessen: „Sorten speichern“ klicken.', '');
  });
  ed.appendChild(row);
  if (!skipStatus) setStatus(bEl('berliner-items-status'), 'Nicht vergessen: „Sorten speichern“ klicken.', '');
}

function updateBerlinerSwitch(active) {
  const btn = bEl('berliner-switch');
  if (!btn) return;
  btn.textContent = active ? 'Auf der Webseite deaktivieren' : 'Auf der Webseite aktivieren';
  btn.classList.toggle('is-on', active);
  btn.setAttribute('aria-pressed', String(active));
}

// Ein Knopfdruck: an/aus umschalten und sofort speichern (inkl. eingetragener Daten).
let berlinerToggling = false;
async function onToggleBerliner() {
  const box = bEl('berliner-active');
  if (!box || berlinerToggling) return; // kein Doppelklick (an → sofort wieder aus)
  const next = !box.checked;
  if (next && !(await askConfirm('Dann erscheinen der Menüpunkt und der Hinweis auf der Startseite (im eingestellten Zeitraum).', { title: 'Berliner-Vorbestellung aktivieren?', ok: 'Aktivieren', danger: false }))) return;
  berlinerToggling = true;
  const sw = bEl('berliner-switch'); if (sw) sw.disabled = true;
  box.checked = next;
  try {
    const ok = await onSaveBerlinerSettings();
    if (ok === false) { box.checked = !next; } else markClean('berliner-settings-form');
  } finally {
    berlinerToggling = false;
    if (sw) sw.disabled = false;
  }
  updateBerlinerSwitch(box.checked);
}

async function onSaveBerlinerSettings(e) {
  e?.preventDefault();
  const st = {
    active:     !!bEl('berliner-active')?.checked,
    orderFrom:  bEl('berliner-order-from')?.value || '',
    orderTo:    bEl('berliner-order-to')?.value || '',
    pickupFrom: bEl('berliner-pickup-from')?.value || '',
    pickupTo:   bEl('berliner-pickup-to')?.value || '',
    title:      (bEl('berliner-title')?.value || '').trim().slice(0, 80),
    text:       (bEl('berliner-text')?.value || '').trim().slice(0, 300)
  };
  const status = bEl('berliner-settings-status');
  if (st.orderFrom && st.orderTo && st.orderFrom > st.orderTo) {
    setStatus(status, '„Bestellbar ab“ liegt nach „Bestellbar bis“.', 'error'); return false;
  }
  if (st.pickupFrom && st.pickupTo && st.pickupFrom > st.pickupTo) {
    setStatus(status, '„Abholung von“ liegt nach „Abholung bis“.', 'error'); return false;
  }
  // Abholung muss nach Bestellbeginn und in der Zukunft liegen – sonst kann niemand bestellen
  const today = todayIso();
  if (st.pickupTo && st.pickupTo < today) {
    setStatus(status, `„Abholung bis“ (${fmtIsoDe(st.pickupTo)}) liegt in der Vergangenheit – so kann niemand bestellen.`, 'error'); return false;
  }
  if (st.pickupTo && st.orderFrom && st.pickupTo < st.orderFrom) {
    setStatus(status, '„Abholung bis“ liegt vor „Bestellbar ab“ – bitte Zeiträume prüfen.', 'error'); return false;
  }
  if (st.pickupFrom && st.orderFrom && st.pickupFrom < st.orderFrom) {
    setStatus(status, '„Abholung von“ liegt vor „Bestellbar ab“ – Abholung muss nach Bestellbeginn sein.', 'error'); return false;
  }
  const ok = await window.alsterDb?.set('berliner-settings', st);
  if (ok === false) { setStatus(status, 'Speichern fehlgeschlagen.', 'error'); warnWriteFailed(); return false; }
  updateBerlinerLive(st);
  setStatus(status, `Gespeichert · ${berlinerLiveState(st).msg}`, 'ok');
  if (typeof logActivity === 'function') logActivity(st.active ? 'Berliner-Vorbestellung eingeschaltet' : 'Berliner-Vorbestellung ausgeschaltet');
  return true;
}

async function onSaveBerlinerItems(e) {
  e.preventDefault();
  const status = bEl('berliner-items-status');
  const badPrices = normalizePriceFields(bEl('berliner-editor'));
  if (badPrices) { setStatus(status, priceErrorText(badPrices), 'error'); bEl('berliner-editor').querySelector('.is-invalid')?.focus(); return false; }
  const items = Array.from(bEl('berliner-editor')?.querySelectorAll('.broetchen-edit-row') || [])
    .map(row => {
      const name = row.querySelector('.broetchen-edit-name').value.trim();
      const desc = row.querySelector('.broetchen-edit-desc').value.trim();
      const price = (row.querySelector('.broetchen-edit-price')?.value || '').trim();
      if (!name) return null;
      const it = { name, desc };
      if (price) it.price = price;
      return it;
    })
    .filter(Boolean);
  if (!items.length) { setStatus(status, 'Bitte mindestens eine Sorte angeben.', 'error'); return false; }
  const ok = await window.alsterDb?.set('berliner-items', items);
  if (ok === false) { setStatus(status, 'Speichern fehlgeschlagen.', 'error'); warnWriteFailed(); return false; }
  const noPrice = items.filter(it => !it.price).length;
  setStatus(status, `Gespeichert · ${items.length} Sorten${noPrice ? ` (${noPrice} ohne Preis — bitte Preise ergänzen)` : ''}`, noPrice ? '' : 'ok');
  if (typeof logActivity === 'function') logActivity('Berliner-Sorten aktualisiert');
  return true;
}

function mondayOf(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
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
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const diff = (d - firstThursday) / 86400000;
  return 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}
function formatShort(d) { return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function formatTime(d)  { return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); }
function formatDateTime(d) { return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function formatRelative(d) {
  if (!(d instanceof Date) || isNaN(d)) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)    return 'gerade eben';
  if (diff < 3600)  return `vor ${Math.floor(diff/60)} Min.`;
  if (diff < 86400) return `vor ${Math.floor(diff/3600)} Std.`;
  return formatShort(d);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }


/* ---------- Stufe 2: untere Leiste am Handy, Zähler, Wow-Übersicht ---------- */
const BOTTOM_ITEMS = [
  { tab: 'overview', label: 'Übersicht', icon: 'i-home' },
  { tab: 'anfragen', label: 'Reservierungen', icon: 'i-inbox' },
  { tab: 'bestellungen', label: 'Bestellungen', icon: 'i-bag' },
  { tab: 'week', label: 'Mittagstisch', icon: 'i-fork' },
  { tab: 'kalender', label: 'Kalender', icon: 'i-clock' }
];
function initBottomBar() {
  if (!dom.dashboard || document.getElementById('admin-bottombar')) return;
  const nav = document.createElement('nav');
  nav.id = 'admin-bottombar';
  nav.className = 'admin-bottombar';
  nav.setAttribute('aria-label', 'Schnellwahl');
  const hasIcon = (id) => !!document.getElementById(id);
  nav.innerHTML = '<span class="bb-glow" aria-hidden="true"></span>' + BOTTOM_ITEMS.map(it => `
    <button type="button" class="bb-item" data-bb="${it.tab}">
      <span class="bb-ico" aria-hidden="true">${hasIcon(it.icon) ? `<svg class="ico"><use href="#${it.icon}"/></svg>` : (it.tab === 'overview' ? '<svg class="ico" viewBox="0 0 24 24"><path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' : '')}</span>
      <span class="bb-label">${it.label}</span>
      <span class="bb-badge" hidden></span>
    </button>`).join('');
  dom.dashboard.appendChild(nav);
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-bb]');
    if (!b) return;
    if (b.dataset.bb === 'overview') showOverview(); else switchTab(b.dataset.bb);
  });
  setBottomBarActive(dom.workspaceView && !dom.workspaceView.hidden ? (activePanel()?.id || '').replace('panel-', '') : 'overview');
  try { renderOverviewSummary(); } catch {}
}
function setBottomBarActive(tab) {
  const nav = document.getElementById('admin-bottombar');
  if (!nav) return;
  let idx = -1;
  nav.querySelectorAll('.bb-item').forEach((b, i) => {
    const on = b.dataset.bb === tab;
    b.classList.toggle('is-active', on);
    if (on) { b.setAttribute('aria-current', 'page'); idx = i; } else b.removeAttribute('aria-current');
  });
  nav.style.setProperty('--bb-i', String(Math.max(idx, 0)));
  nav.classList.toggle('has-active', idx >= 0);
}
function setBottomBadge(tab, n) {
  const b = document.querySelector(`#admin-bottombar [data-bb="${tab}"] .bb-badge`);
  if (!b) return;
  b.hidden = !n;
  b.textContent = n > 9 ? '9+' : String(n);
}
/* Zahl zählt sanft hoch (nur Anzeige) */
function countTo(el, n) {
  if (!el) return;
  const from = parseInt(el.textContent, 10) || 0;
  if (from === n || matchMedia('(prefers-reduced-motion: reduce)').matches || dom.overviewView?.hidden) { el.textContent = String(n); return; }
  const t0 = performance.now(), dur = 650;
  cancelAnimationFrame(el._cnt);
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = String(Math.round(from + (n - from) * (1 - Math.pow(1 - k, 3))));
    if (k < 1) el._cnt = requestAnimationFrame(step);
  };
  el._cnt = requestAnimationFrame(step);
}
/* Übersicht: goldene Tasse + Goldstaub in der „Heute auf einen Blick“-Karte */
function initOverviewArt() {
  const box = document.getElementById('overview-summary');
  if (!box || box.querySelector('.summary-art')) return;
  const art = document.createElement('div');
  art.className = 'summary-art'; art.setAttribute('aria-hidden', 'true');
  art.innerHTML = '<svg viewBox="0 0 240 220"><path class="art-steam" pathLength="1" d="M102 84 C90 68 114 58 102 40 C94 28 106 18 102 8"/><path class="art-steam" pathLength="1" d="M121 82 C109 64 135 54 121 34"/><path class="art-steam" pathLength="1" d="M140 84 C128 68 152 58 140 40 C134 30 142 22 140 14"/><path class="art-line" pathLength="1" d="M28 190 C28 172 212 172 212 190 C212 208 28 208 28 190 Z"/><path class="art-line" pathLength="1" d="M60 104 C62 140 70 170 96 182 C110 188 130 188 144 182 C170 170 178 140 180 104"/><path class="art-line" pathLength="1" d="M60 104 C60 90 180 90 180 104 C180 118 60 118 60 104 Z"/><path class="art-line" pathLength="1" d="M178 120 C208 112 216 152 168 162"/></svg>';
  box.prepend(art);
  const dust = document.createElement('div');
  dust.className = 'summary-dust'; dust.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 10; i++) {
    const p = document.createElement('i');
    p.style.setProperty('--x', (5 + Math.random() * 90).toFixed(1) + '%');
    p.style.setProperty('--d', (9 + Math.random() * 8).toFixed(1) + 's');
    p.style.setProperty('--dl', (-Math.random() * 16).toFixed(1) + 's');
    dust.appendChild(p);
  }
  box.prepend(dust);
}
/* „Erledigt“: kurzer Gold-Funkenregen an der Karte */
function sparkleCard(id) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  requestAnimationFrame(() => {
    const card = document.querySelector(`[data-mark="${CSS.escape(id)}"]`)?.closest('.anfrage-item');
    if (!card) return;
    card.classList.add('just-done');
    const burst = document.createElement('span');
    burst.className = 'done-burst'; burst.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('i');
      const a = (Math.PI * 2 * i) / 12;
      p.style.setProperty('--tx', Math.round(Math.cos(a) * (40 + Math.random() * 30)) + 'px');
      p.style.setProperty('--ty', Math.round(Math.sin(a) * (30 + Math.random() * 24)) + 'px');
      burst.appendChild(p);
    }
    card.appendChild(burst);
    setTimeout(() => { burst.remove(); card.classList.remove('just-done'); }, 1200);
  });
}
