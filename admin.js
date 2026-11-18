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


  // Suche in Anfragen / Bestellungen
  dom.anfragenSearch?.addEventListener('input', () => renderAnfragen());
  document.getElementById('anfragen-add')?.addEventListener('click', () => onAddRes());
  dom.ordersSearch?.addEventListener('input', () => renderOrders());
  document.getElementById('orders-filter')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-kind]'); if (!b) return;
    document.querySelectorAll('#orders-filter [data-kind]').forEach(x => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    renderOrders();
  });

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
  document.getElementById('jobs-form')?.addEventListener('submit', (e) => { e.preventDefault(); runSave('jobs-form', () => onSaveJobs(e)); });

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
  document.getElementById('berliner-print')?.addEventListener('click', printBerlinerBake);
  document.getElementById('berliner-include-done')?.addEventListener('change', renderBerlinerBake);
  // Live-Vorschau der Prüfliste beim Tippen (ohne zu speichern)
  document.getElementById('berliner-settings-form')?.addEventListener('input', () => renderBerlinerChecklist(readBerlinerForm()));

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
  // Einmal pro Sitzung: Überbleibsel früherer Versionen (Reservierungs-/Bestellkopien) aus der
  // öffentlichen Inhalts-Tabelle entfernen – passiert still beim normalen Login.
  try { if (!sessionStorage.getItem('alstercafe.legacy-clean')) { sessionStorage.setItem('alstercafe.legacy-clean', '1'); window.alsterDb?.removeLegacyContent?.(['reservations', 'orders']); } } catch (e) {}
  // Schriften und Logos der Druck-Dokumente vorab laden – dann startet jeder Druck direkt im Tipp
  setTimeout(prewarmPrintAssets, 1500);
  window.addEventListener('pointerdown', prewarmPrintAssets, { once: true, capture: true });   // spätestens bei der ersten Berührung
  // Default-Landing: Overview. Tab-Inhalte werden lazy beim Klick aktiv.
  showOverview();
  renderWeek();
  renderOverviewSummary();
  renderNotice();
  renderJobs();
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
        'notice-until': ['notice-form', () => renderNotice()],
        'jobs': ['jobs-form', () => renderJobs()],
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
      if (key === 'reservations') await refreshAnfragen(); else { await refreshOrders(); try { renderBerlinerBake(); updateBerlinerLive(window.alsterDb?.get('berliner-settings') || {}); } catch {} }
      const list = window.alsterDb?.get(key);
      const fresh = (Array.isArray(list) ? list : []).filter(x => x && !ids.has(x.id) && x.status !== 'done'
        && !(key === 'reservations' && (resIsAccepted(x) || selfAddedRes.has(x.id))));   // selbst Eingetragenes ist keine neue Anfrage
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
  on('cal-print', 'click', () => printDayList(calendarPrintDay(), document.getElementById('staff-code-status')));
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
  if (kind === 'order') resetOrdersView();
  const card = kind === 'order'
    ? document.querySelector(`[data-mark="${CSS.escape(id)}"]`)?.closest('.anfrage-item')
    : document.querySelector(`#anfragen-list [data-res-row="${CSS.escape(id)}"]`);
  if (!card) return;
  if (kind !== 'order') {
    // Zeile im Tagesplan aufklappen; liegt sie unter „Vergangene“, diese Gruppe öffnen
    const own = card.querySelector(':scope > details');
    if (own) { anfragenOpen.add(id); own.open = true; }
    const pastList = card.parentElement?.closest('details');
    if (pastList && !pastList.open) pastList.open = true;
  } else {
    const pastList = card.closest('details');
    if (pastList && !pastList.open) pastList.open = true;
  }
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
  const hol = window.alsterDb?.get('holidays');
  window.AlsterCalendar.render(el, { reservations: Array.isArray(res) ? res : [], orders: Array.isArray(ord) ? ord : [], holidays: Array.isArray(hol) ? hol : [] }, calMonday, { onOpen: openEntryCard, resStatus: true });
}

/* ---------- Tagesliste drucken (Reservierungen + Abholungen eines Tages, A4) ---------- */
function dayEntries(iso) {
  const res = (window.alsterDb?.get('reservations') || []).filter(r => r && r.date === iso).map(r => ({ kind: 'res', time: r.time || '', x: r }));
  const ord = (window.alsterDb?.get('orders') || []).filter(o => o && o.pickupDate === iso).map(o => ({ kind: 'order', time: o.pickupTime || '', x: o }));
  return [...res, ...ord].sort((a, b) => String(a.time).localeCompare(String(b.time)));
}
function orderLine(o) {
  return (Array.isArray(o.items) ? o.items : []).filter(it => it && (parseInt(it.qty, 10) || 0) > 0).map(it => `${parseInt(it.qty, 10)}× ${it.name || ''}`).join(', ');
}
function printDayList(iso, statusEl) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  const label = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const list = dayEntries(iso);
  const hol = (window.alsterDb?.get('holidays') || []).find(h => h && h.date === iso);
  const rows = list.map(e => {
    const x = e.x;
    const what = e.kind === 'res'
      ? `Tisch · ${escapeHtml(x.persons || '')}`
      : `${(x.items || []).some(it => it && it.kind === 'berliner') ? 'Berliner' : 'Abholung'} · ${escapeHtml(orderLine(x))}`;
    const note = [x.message || x.notes || '', x.note ? 'Notiz: ' + x.note : ''].filter(Boolean).map(escapeHtml).join('<br>');
    const st = e.kind === 'res' ? (resIsAccepted(x) ? 'zugesagt' : 'neu – noch offen')
      : (entryStage(x) === 'done' ? 'erledigt' : entryStage(x) === 'confirmed' ? 'bestätigt' : 'neu');
    return `<tr${e.kind === 'order' && entryStage(x) === 'done' ? ' class="done"' : ''}><td class="t">${escapeHtml(e.time || '–')}</td><td><strong>${escapeHtml(x.name || 'Ohne Namen')}</strong>${x.phone ? `<br><span class="ph">${escapeHtml(x.phone)}</span>` : ''}</td><td>${what}${note ? `<div class="note">${note}</div>` : ''}</td><td class="st">${st}</td></tr>`;
  }).join('');
  const nRes = list.filter(e => e.kind === 'res').length, nOrd = list.length - nRes;
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Tagesliste ${escapeHtml(label)} · Alstercafé</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #2a1810; margin: 0; }
  .k { font: 600 9pt Arial, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: #8A6420; margin: 0 0 2mm; }
  h1 { font-weight: 400; font-size: 20pt; margin: 0 0 1mm; }
  .sum { font: 10pt Arial, sans-serif; color: #5C3C20; margin: 0 0 6mm; }
  .closed { font: 600 10pt Arial, sans-serif; color: #b3382c; margin: 0 0 4mm; }
  table { width: 100%; border-collapse: collapse; font: 10pt Arial, sans-serif; }
  th { text-align: left; font-size: 8.5pt; letter-spacing: .08em; text-transform: uppercase; color: #8A6420; border-bottom: 1px solid #B8893E; padding: 2mm 2mm 2mm 0; }
  td { vertical-align: top; border-bottom: 1px solid #e6dccb; padding: 2.5mm 2mm 2.5mm 0; }
  td.t { width: 16mm; font-weight: 700; font-variant-numeric: tabular-nums; }
  td.st { width: 18mm; color: #6F5C4E; font-size: 9pt; }
  .ph { color: #6F5C4E; font-size: 9pt; }
  .note { margin-top: 1mm; color: #5C3C20; font-size: 9pt; }
  tr.done td { color: #8a7a6c; }
  .empty { font: 11pt Arial, sans-serif; color: #6F5C4E; }
  .foot { margin-top: 8mm; font: 8.5pt Arial, sans-serif; color: #8a7a6c; }
</style></head><body>
<p class="k">Alstercafé · Tagesliste</p>
<h1>${escapeHtml(label)}</h1>
<p class="sum">${nRes} ${nRes === 1 ? 'Reservierung' : 'Reservierungen'} · ${nOrd} ${nOrd === 1 ? 'Abholung' : 'Abholungen'}</p>
${hol ? `<p class="closed">Schließtag${hol.label ? ' · ' + escapeHtml(hol.label) : ''}</p>` : ''}
${list.length ? `<table><thead><tr><th>Uhrzeit</th><th>Name</th><th>Was</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="empty">Für diesen Tag ist nichts eingetragen.</p>'}
<p class="foot">Gedruckt am ${new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr</p>
</body></html>`;
  printHtmlDocument(html, statusEl);
  logActivity('Tagesliste gedruckt');
}
/* Kalender: Tagesliste für heute (wenn die gezeigte Woche heute enthält), sonst den ersten Tag
   der gezeigten Woche mit Einträgen bzw. den Montag */
function calendarPrintDay() {
  const today = isoDate(new Date());
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(calMonday); d.setDate(d.getDate() + i); return isoDate(d); });
  if (days.includes(today)) return today;
  return days.find(iso => dayEntries(iso).length) || days[0];
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
  'jobs-form': 'Wir suchen Verstärkung',
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
    'jobs-form': () => renderJobs(),
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
  try { renderOverviewSummary(); } catch (e) {}   // Stand von jetzt (Datum, Bestätigtes, Wochenplan)
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
    days: JSON.parse(JSON.stringify(prev.days)),
    // Wochenangaben (Preis / Mittagstisch bis) wandern mit
    ...(prev.price != null ? { price: prev.price } : {}),
    ...(prev.until ? { until: prev.until } : {})
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

  // Preisfelder (Wochenpreis + Abweichungen) wie bei den Brötchen prüfen – ungültig = nicht speichern
  const badPrices = checkLunchPriceFields();
  if (badPrices) {
    setStatus(dom.saveStatus, priceErrorText(badPrices), 'error');
    dom.menuForm.querySelector('input.is-invalid')?.focus();
    return false;
  }
  const facts = readWeekFacts();
  if (facts.untilInvalid) {
    setStatus(dom.saveStatus, 'Nicht gespeichert: „Mittagstisch bis“ bitte als Uhrzeit eintragen, z. B. 14:30 – oder leer lassen.', 'error');
    document.getElementById('week-until')?.focus();
    return false;
  }

  // Aktuelle Woche aus den 7 Standard-Karten lesen
  const week = readFormToWeek();
  // Beilage ohne Gericht würde auf der Webseite nie erscheinen → vorher melden
  const orphan = DAYS.filter(d => { const x = week[d.key]; return x && !x.closed && ((x.side && !x.dish && !x.dish2) || (x.side2 && !x.dish2)); }).map(d => d.label);
  if (orphan.length) {
    setStatus(dom.saveStatus, `Nicht gespeichert: Bei ${orphan.join(', ')} steht eine Beilage ohne Gericht. Bitte das Gericht ergänzen oder die Beilage löschen.`, 'error');
    return false;
  }
  const entry = {
    weekStart: isoDate(currentMonday),
    updatedAt: new Date().toISOString(),
    days: week
  };
  // Optionale Wochenangaben nur speichern, wenn gepflegt (leer = auf der Webseite nicht zu sehen)
  if (facts.price != null) entry.price = facts.price;
  if (facts.until) entry.until = facts.until;
  all[isoDate(currentMonday)] = entry;

  // Sonntag-Spillover: Sonntag-Karte gehoert zur Vorwoche
  if (sundaySpillover) {
    const data = new FormData(dom.menuForm);
    const dish   = (data.get('spillover-sun-dish')   || '').toString().trim();
    const side   = (data.get('spillover-sun-side')   || '').toString().trim();
    const dish2  = (data.get('spillover-sun-dish2')  || '').toString().trim();
    const side2  = (data.get('spillover-sun-side2')  || '').toString().trim();
    const closed = data.get('spillover-sun-closed') === 'on';
    const price  = window.AlsterRules.parseEuro(data.get('spillover-sun-price')  || '');
    const price2 = window.AlsterRules.parseEuro(data.get('spillover-sun-price2') || '');
    const veg  = data.get('spillover-sun-veg') === 'on';
    const veg2 = data.get('spillover-sun-veg2') === 'on';
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
      if (veg) prevWeek.days.sun.veg = true;
      if (dish2 && veg2) prevWeek.days.sun.veg2 = true;
      if (price != null) prevWeek.days.sun.price = price;
      if (price2 != null) prevWeek.days.sun.price2 = price2;
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

  // Wochenangaben (Preis / Mittagstisch bis): gespeicherter Stand – bei einer noch nicht
  // gespeicherten Woche vorbelegt mit der zuletzt gespeicherten Woche davor
  const facts = stored.updatedAt ? stored : (lastSavedWeekBefore(all, currentMonday) || {});
  const priceEl = document.getElementById('week-price');
  const untilEl = document.getElementById('week-until');
  if (priceEl) { priceEl.value = priceInputText(facts.price); priceEl.classList.remove('is-invalid'); }
  if (untilEl) untilEl.value = facts.until || '';

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
    const card = buildDayCard({
      label: day.label,
      key: day.key,
      date,
      saved,
      isToday,
      weekKey: isoDate(currentMonday),
      isSpillover: false
    });
    // Vergangene Tage der Woche ruhiger darstellen (bleiben bearbeitbar)
    if (isoDate(date) < isoDate(new Date())) card.classList.add('is-past');
    dom.dayGrid.appendChild(card);
  });
  attachDishSuggestions();

  dom.dayGrid.querySelectorAll('.day-toggle input').forEach(cb => {
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

/* Frühere Gerichte/Beilagen als Vorschläge: Beilagen per <datalist>, Gerichte (mehrzeilig)
   als kleine Vorschlagsliste unter dem Feld. Nur Anzeige, keine Datenänderung. */
function pastDishStats() {
  const count = { dish: new Map(), side: new Map() };
  const add = (map, v) => { const t = String(v || '').trim(); if (t.length > 2) map.set(t, (map.get(t) || 0) + 1); };
  Object.values(loadAll() || {}).forEach(w => Object.values((w && w.days) || {}).forEach(d => {
    if (!d) return; add(count.dish, d.dish); add(count.dish, d.dish2); add(count.side, d.side); add(count.side, d.side2);
  }));
  const top = m => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de')).slice(0, 60).map(e => e[0]);
  return { dishes: top(count.dish), sides: top(count.side) };
}
function attachDishSuggestions() {
  const { dishes, sides } = pastDishStats();
  const dl = document.getElementById('side-suggestions');
  if (dl) dl.innerHTML = sides.map(v => `<option value="${escapeAttr(v)}"></option>`).join('');
  dom.dayGrid?.querySelectorAll('input[name$="-side"], input[name$="-side2"]').forEach(i => i.setAttribute('list', 'side-suggestions'));
  if (!dishes.length) return;
  dom.dayGrid?.querySelectorAll('textarea[name$="-dish"], textarea[name$="-dish2"]').forEach(ta => {
    if (ta.dataset.suggest) return;
    ta.dataset.suggest = '1';
    const box = document.createElement('ul');
    box.className = 'dish-suggest'; box.hidden = true;
    box.setAttribute('aria-label', 'Frühere Gerichte');
    ta.after(box);
    const show = () => {
      const q = ta.value.trim().toLowerCase();
      const hits = q.length < 2 ? [] : dishes.filter(d => d.toLowerCase().includes(q) && d.toLowerCase() !== q).slice(0, 5);
      box.innerHTML = hits.map(h => `<li><button type="button" class="dish-suggest-item">${escapeHtml(h)}</button></li>`).join('');
      box.hidden = !hits.length;
    };
    ta.addEventListener('input', show);
    ta.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 150));
    box.addEventListener('mousedown', e => e.preventDefault());
    box.addEventListener('click', e => {
      const b = e.target.closest('.dish-suggest-item'); if (!b) return;
      ta.value = b.textContent; box.hidden = true;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      box.hidden = true; ta.focus();
    });
  });
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
    <label class="day-field day-field-price">
      <span class="day-field-label">Abweichender Preis (optional)</span>
      <input type="text" name="${fieldPrefix}-price" inputmode="decimal" placeholder="z. B. 9,90" value="${escapeAttr(priceInputText(saved.price))}" />
    </label>
    <label class="day-check">
      <input type="checkbox" name="${fieldPrefix}-veg" ${saved.veg ? 'checked' : ''} />
      <span>Vegetarisch (erscheint als kleines Kennzeichen neben dem Gericht)</span>
    </label>
    <details class="day-alt"${saved.dish2 || saved.side2 || saved.price2 != null ? ' open' : ''}>
      <summary><span class="day-alt-or">oder</span> Zweites Gericht zur Wahl (optional)</summary>
      <label class="day-field">
        <span class="day-field-label">2. Gericht</span>
        <textarea name="${fieldPrefix}-dish2" rows="2" placeholder="z. B. Gemüse-Curry (vegetarisch)">${escapeHtml(saved.dish2 || '')}</textarea>
      </label>
      <label class="day-field">
        <span class="day-field-label">Beilage zum 2. Gericht</span>
        <input type="text" name="${fieldPrefix}-side2" placeholder="z. B. Basmatireis" value="${escapeAttr(saved.side2 || '')}" />
      </label>
      <label class="day-field day-field-price">
        <span class="day-field-label">Abweichender Preis zum 2. Gericht (optional)</span>
        <input type="text" name="${fieldPrefix}-price2" inputmode="decimal" placeholder="z. B. 11,90" value="${escapeAttr(priceInputText(saved.price2))}" />
      </label>
      <label class="day-check">
        <input type="checkbox" name="${fieldPrefix}-veg2" ${saved.veg2 ? 'checked' : ''} />
        <span>2. Gericht vegetarisch</span>
      </label>
    </details>
    <label class="day-toggle">
      <input type="checkbox" name="${fieldPrefix}-closed" ${saved.closed ? 'checked' : ''} />
      <span class="day-toggle-track"><span class="day-toggle-thumb"></span></span>
      <span class="day-toggle-text">An diesem Tag kein Mittagstisch</span>
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
    if (dish || side || dish2 || side2 || closed) {
      week[day.key] = { dish, side, closed };
      // Zweites Gericht nur speichern, wenn eingetragen (ältere Einträge bleiben gleich)
      if (dish2 || side2) { week[day.key].dish2 = dish2; week[day.key].side2 = side2; }
      // Abweichende Preise als Zahl, nur wenn eingetragen und gültig (Prüfung: checkLunchPriceFields)
      const price  = window.AlsterRules.parseEuro(data.get(`${day.key}-price`)  || '');
      const price2 = window.AlsterRules.parseEuro(data.get(`${day.key}-price2`) || '');
      if (price != null) week[day.key].price = price;
      if (price2 != null) week[day.key].price2 = price2;
      // Vegetarisch-Kennzeichen nur speichern, wenn gesetzt (ältere Einträge bleiben gleich)
      if (data.get(`${day.key}-veg`) === 'on') week[day.key].veg = true;
      if (dish2 && data.get(`${day.key}-veg2`) === 'on') week[day.key].veg2 = true;
    }
  });
  return week;
}

/* ---------- Mittagstisch: optionaler Preis / Ausgabe-Ende ----------
   Wochenfeld price (Zahl) und until („14:30“) im Key 'weekly-menu', je Gericht optional
   price/price2. Leer = auf der Webseite nicht zu sehen; ältere Wochen bleiben gültig. */
// Zahl → Eingabetext „9,90“; alte Text-Einträge bleiben wie getippt
function priceInputText(v) {
  if (v == null || v === '') return '';
  return typeof v === 'number' ? window.AlsterRules.euroText(v) : String(v);
}
// Wochenangaben aus den Feldern über dem Tagesraster
function readWeekFacts() {
  const rawPrice = (document.getElementById('week-price')?.value || '').trim();
  const rawUntil = (document.getElementById('week-until')?.value || '').trim();
  const m = rawUntil.match(/^(\d{1,2})[:.](\d{2})$/);
  const untilOk = !!(m && +m[1] < 24 && +m[2] < 60);
  return {
    price: rawPrice ? window.AlsterRules.parseEuro(rawPrice) : null,
    until: untilOk ? `${m[1].padStart(2, '0')}:${m[2]}` : '',
    untilInvalid: !!rawUntil && !untilOk
  };
}
// Alle Preisfelder des Wochenplans prüfen: ungültige rot markieren, Anzahl zurückgeben
function checkLunchPriceFields() {
  let bad = 0;
  dom.menuForm.querySelectorAll('#week-price, input[name$="-price"], input[name$="-price2"]').forEach(inp => {
    const raw = inp.value.trim();
    const ok = !raw || window.AlsterRules.parseEuro(raw) != null;
    inp.classList.toggle('is-invalid', !ok);
    if (!ok) bad++;
  });
  return bad;
}
// Zuletzt gespeicherte Woche vor „monday“ (für die Vorbelegung einer neuen Woche)
function lastSavedWeekBefore(all, monday) {
  const key = isoDate(monday);
  const prev = Object.keys(all || {}).filter(k => k < key && all[k] && all[k].updatedAt).sort();
  return prev.length ? all[prev[prev.length - 1]] : null;
}

/* ---------- Notice ---------- */

function noticeUntil() {
  const u = window.alsterDb?.get('notice-until');
  return typeof u === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(u) ? u : '';
}
function noticeStateText(text, until) {
  if (!text) return 'Kein Banner aktiv.';
  if (!until) return 'Banner ist aktiv.';
  return until < isoDate(new Date()) ? `Banner ist abgelaufen am ${fmtIsoDe(until)} – auf der Webseite nicht mehr sichtbar.` : `Banner ist aktiv – sichtbar bis ${fmtIsoDe(until)}.`;
}
function renderNotice() {
  markClean('notice-form');
  const text = loadNotice();
  if (dom.noticeInput) dom.noticeInput.value = text;
  const u = document.getElementById('notice-until');
  if (u) { u.value = noticeUntil(); u.min = isoDate(new Date()); }
  setStatus(dom.noticeStatus, noticeStateText(text, noticeUntil()));
}

async function onSaveNotice(e) {
  e.preventDefault();
  const text = (dom.noticeInput.value || '').trim();
  const until = (document.getElementById('notice-until')?.value || '').trim();
  if (until && until < isoDate(new Date())) { setStatus(dom.noticeStatus, '„Anzeigen bis“ liegt in der Vergangenheit – bitte ein heutiges oder späteres Datum wählen oder das Feld leeren.', 'error'); return false; }
  const ok = await saveNotice(text);
  let okU = true;
  try { okU = (text && until) ? await window.alsterDb?.set('notice-until', until) : await window.alsterDb?.remove('notice-until'); } catch (e) { okU = false; }
  if (!ok || okU === false) { setStatus(dom.noticeStatus, 'Speichern fehlgeschlagen.', 'error'); warnWriteFailed(); return false; }
  setStatus(dom.noticeStatus, text ? (until ? `Hinweis gespeichert. Sichtbar bis ${fmtIsoDe(until)}.` : 'Hinweis gespeichert. Banner ist sichtbar.') : 'Banner ausgeblendet.', 'ok');
  return true;
}

/* „Wir suchen Verstärkung“ (Key jobs: { active, title, text }) – aus = auf der Webseite unsichtbar */
function renderJobs() {
  markClean('jobs-form');
  const j = window.alsterDb?.get('jobs');
  const d = (j && typeof j === 'object') ? j : {};
  const act = document.getElementById('jobs-active'), title = document.getElementById('jobs-title'), text = document.getElementById('jobs-text');
  if (act) act.checked = !!d.active;
  if (title) title.value = d.title || '';
  if (text) text.value = d.text || '';
  setStatus(document.getElementById('jobs-status'), d.active && (d.text || '').trim() ? 'Wird auf der Webseite gezeigt.' : (d.active ? 'Eingeschaltet, aber ohne Text – auf der Webseite erscheint nichts.' : 'Ausgeschaltet – auf der Webseite nicht zu sehen.'));
}
async function onSaveJobs(e) {
  e?.preventDefault();
  const status = document.getElementById('jobs-status');
  const j = {
    active: !!document.getElementById('jobs-active')?.checked,
    title: (document.getElementById('jobs-title')?.value || '').trim().slice(0, 60),
    text: (document.getElementById('jobs-text')?.value || '').trim().slice(0, 600)
  };
  if (j.active && !j.text) { setStatus(status, 'Bitte einen Text eintragen – oder den Schalter ausschalten.', 'error'); return false; }
  const ok = await window.alsterDb?.set('jobs', j);
  if (ok === false) { setStatus(status, 'Speichern fehlgeschlagen.', 'error'); warnWriteFailed(); return false; }
  setStatus(status, j.active ? 'Gespeichert · wird auf der Webseite gezeigt.' : 'Gespeichert · ausgeschaltet.', 'ok');
  logActivity(j.active ? '„Wir suchen Verstärkung“ eingeschaltet' : '„Wir suchen Verstärkung“ ausgeschaltet');
  return true;
}

async function onClearNotice() {
  dom.noticeInput.value = '';
  const u = document.getElementById('notice-until'); if (u) u.value = '';
  try { await window.alsterDb?.remove('notice-until'); } catch (e) {}
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
  // Kennzeichen: „vegetarisch“/„vegan“ per Auswahl; ein anderer vorhandener Tag bleibt
  // unverändert erhalten (Auswahl „–“ zeigt ihn dann nur nicht an).
  if (item.tag) row.dataset.tag = item.tag;
  const tagLc = String(item.tag || '').trim().toLowerCase();
  const diet = tagLc === 'vegan' ? 'vegan' : tagLc === 'vegetarisch' ? 'vegetarisch' : '';
  row.innerHTML = `
    <span class="drag-handle" aria-label="Verschieben" title="Zum Sortieren ziehen">⠿</span>
    <div class="menu-item-fields">
      <input type="text" class="menu-item-name" value="${escapeAttr(item.name || '')}" placeholder="Gericht, z. B. Klassik" />
      <input type="text" class="menu-item-price" value="${escapeAttr(item.price || '')}" placeholder="Preis, z. B. 8,90 €" />
      <input type="text" class="menu-item-desc" value="${escapeAttr(item.desc || '')}" placeholder="Beschreibung (optional)" />
      <select class="menu-item-diet" aria-label="Kennzeichen" title="Kennzeichen (vegetarisch / vegan)">
        <option value=""${diet ? '' : ' selected'}>Kein Kennzeichen</option>
        <option value="vegetarisch"${diet === 'vegetarisch' ? ' selected' : ''}>vegetarisch</option>
        <option value="vegan"${diet === 'vegan' ? ' selected' : ''}>vegan</option>
      </select>
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
        const diet = row.querySelector('.menu-item-diet')?.value || '';
        const oldTag = row.dataset.tag || '';
        const oldIsDiet = /^(vegetarisch|vegan)$/i.test(oldTag);
        // Auswahl gewinnt; „Kein Kennzeichen“ entfernt vegetarisch/vegan, lässt andere Tags stehen
        if (diet) it.tag = diet; else if (oldTag && !oldIsDiet) it.tag = oldTag;
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
const isoDateOk = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const isoToDe = iso => { const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}.${m[2]}.${m[1]}` : ''; };
/* Statuszeile je nach Schalter und Zeitraum („Zeigen ab/bis“, leer = immer) */
function specialsStateText(d) {
  if (d.visible === false) return 'Ausgeblendet – auf der Webseite nicht zu sehen.';
  const today = isoDate(new Date());
  if (isoDateOk(d.showTo) && today > d.showTo) return 'Zeitraum ist abgelaufen – auf der Webseite nicht zu sehen. Datum anpassen oder Specials für die neue Saison überarbeiten.';
  if (isoDateOk(d.showFrom) && today < d.showFrom) return `Erscheint ab ${isoToDe(d.showFrom)}.`;
  return 'Sichtbar auf Speisekarte und Startseite' + (isoDateOk(d.showTo) ? ` – bis ${isoToDe(d.showTo)}.` : '.');
}
function renderSpecialsEditor() {
  markClean('specials-form');
  const box = document.getElementById('specials-sections');
  if (!box) return;
  const d = loadSpecialsData();
  document.getElementById('specials-visible').checked = d.visible !== false;
  document.getElementById('specials-title').value = d.title || '';
  document.getElementById('specials-footnote').value = d.footnote || '';
  // Optionaler Zeitraum (leer = immer sichtbar, wie bisher)
  const fromEl = document.getElementById('specials-from'), toEl = document.getElementById('specials-to');
  if (fromEl) fromEl.value = isoDateOk(d.showFrom) ? d.showFrom : '';
  if (toEl) toEl.value = isoDateOk(d.showTo) ? d.showTo : '';
  box.innerHTML = '';
  (d.sections || []).forEach(sec => box.appendChild(buildMenuSection(sec)));
  setStatus(document.getElementById('specials-status'), specialsStateText(d));
}
async function onSaveSpecials() {
  const box = document.getElementById('specials-sections');
  const st = document.getElementById('specials-status');
  const sections = collectSectionsFrom(box);
  const nameless = box.querySelectorAll('.menu-item-row.is-invalid');
  if (nameless.length) { setStatus(st, 'Nicht gespeichert: Ein Eintrag hat Preis oder Beschreibung, aber keinen Namen (rot markiert).', 'error'); return false; }
  const visible = document.getElementById('specials-visible').checked;
  if (visible && !sections.some(sec => sec.items.some(it => it.name))) { setStatus(st, 'Nicht gespeichert: Bitte mindestens ein Getränk eintragen oder den Schalter ausschalten.', 'error'); return false; }
  const showFrom = document.getElementById('specials-from')?.value || '';
  const showTo = document.getElementById('specials-to')?.value || '';
  if (showFrom && showTo && showFrom > showTo) { setStatus(st, 'Nicht gespeichert: „Zeigen ab“ liegt nach „Zeigen bis“.', 'error'); document.getElementById('specials-from')?.focus(); return false; }
  const data = { visible, title: (document.getElementById('specials-title').value || '').trim() || 'Sommer-Specials', showFrom, showTo, sections, footnote: (document.getElementById('specials-footnote').value || '').trim() };
  const ok = await window.alsterDb.set('specials', data);
  if (!ok) { setStatus(st, 'Speichern fehlgeschlagen.', 'error'); warnWriteFailed(); return false; }
  // Rückmeldung nennt den tatsächlichen Zustand (Schalter + Zeitraum)
  const state = specialsStateText(data);
  setStatus(st, `Gespeichert · ${formatTime(new Date())} — ${state.charAt(0).toLowerCase() + state.slice(1)}`, 'ok');
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
   baut daraus eine druckfertige Karte und ruft den Druckdialog auf —
   dort waehlt Maria "Als PDF speichern". Eine Seite pro Kategorie,
   wie ihre Original-Karte. */
function downloadMenuPdf() {
  const data = collectMenuData();
  if (!data.sections.length) {
    setStatus(dom.menuStatus, 'Bitte zuerst Gerichte eintragen, dann als PDF speichern.', 'error');
    return;
  }

  printHtmlDocument(buildMenuPrintHtml(data), dom.menuStatus);
}

/* ---------- Drucken ----------
   Gedruckt wird die Seite selbst. Das Druck-Dokument liegt – am Bildschirm unsichtbar – im Shadow-Root von
   #print-host; im Druck blendet styles.css alles andere aus. So greifen die Stile des Mitgliederbereichs nicht
   ins Druckbild und umgekehrt.
   Warum kein verstecktes Iframe und kein neues Fenster: Die Live-Seite erlaubt per Sicherheits-Kopfzeile
   (frame-src) keine blob:-Rahmen – der Druck blieb dadurch auf jedem Gerät ohne Wirkung –, iPhones drucken
   versteckte Rahmen nicht verlässlich, und window.open schluckt dort der Popup-Blocker. window.print() der
   Seite selbst, direkt im Tipp, funktioniert überall. */
const PRINT_FONTS = ['400 16px Inter', '500 16px Inter', '600 16px Inter', '700 16px Inter', '400 16px Fraunces', '500 16px Fraunces', '600 16px Fraunces'];
const printImgPool = {};       // Adresse → fertig geladene <img>-Elemente (Vorrat für die Druck-Dokumente)
let printWarm = null;          // Promise: Schriften und Logos der Druck-Dokumente sind geladen
let printWarmDone = false;
let printDocState = null;      // gesetzt, solange ein Druck-Dokument eingehängt ist

/* Schriften und Logos der Druck-Dokumente vorab laden, damit der Druck ohne Wartezeit im Tipp starten kann.
   Die Logos liegen als fertig geladene <img>-Elemente bereit und werden beim Druck selbst eingesetzt –
   ob ein Browser ein frisch erzeugtes <img> sofort aus seinem Zwischenspeicher füllt, ist nämlich je nach
   Browser und Version verschieden. Das Aushang-Logo gibt es mehrfach (ein Aushang kann mehrere Blätter haben). */
function prewarmPrintAssets() {
  if (printWarm) return printWarm;
  let fonts = Promise.resolve();
  try { fonts = Promise.all(PRINT_FONTS.map(f => document.fonts.load(f, 'Aä€ā').catch(() => {}))); } catch (e) {}
  const imgs = [[`${location.origin}/image-192.webp`, 8], [new URL('image.png', location.href).href, 1]].map(([src, count]) => {
    printImgPool[src] = [];
    return Promise.all(Array.from({ length: count }, () => new Promise(res => {
      const im = new Image();
      im.onload = () => { printImgPool[src].push(im); res(); };
      im.onerror = () => res();
      im.src = src;
    })));
  });
  printWarm = Promise.all([fonts, ...imgs]).then(() => {
    printWarmDone = true;
    document.documentElement.dataset.printReady = '1';   // Signal für tests/print-audit.mjs
  });
  return printWarm;
}

/* Ersetzt die <img> eines Druck-Dokuments durch fertig geladene Elemente aus dem Vorrat (soweit vorhanden). */
function usePrintImages(scope) {
  scope.querySelectorAll('img').forEach(im => {
    let url = ''; try { url = new URL(im.getAttribute('src') || '', location.href).href; } catch (e) {}
    const pool = printImgPool[url];
    if (!pool || pool.includes(im)) return;
    const ready = pool.find(el => !el.parentNode);
    if (!ready) return;   // Vorrat aufgebraucht: dieses Bild lädt selbst, der Druck wartet dann kurz darauf
    Array.from(ready.attributes).forEach(a => { if (a.name !== 'src') ready.removeAttribute(a.name); });
    Array.from(im.attributes).forEach(a => { if (a.name !== 'src') ready.setAttribute(a.name, a.value); });
    im.replaceWith(ready);
  });
}
/* Gibt die Vorrats-Bilder eines Teilbaums wieder frei (bevor er verworfen wird). */
function releasePrintImages(scope) {
  scope.querySelectorAll('img').forEach(im => {
    if (Object.values(printImgPool).some(pool => pool.includes(im))) im.remove();
  });
}

function ensurePrintHost() {
  let host = document.getElementById('print-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'print-host';
    host.setAttribute('aria-hidden', 'true');
    host.style.display = 'none';   // am Bildschirm unsichtbar, auch falls styles.css einmal älter ist als dieses Skript
    document.body.appendChild(host);
  }
  if (!host.shadowRoot) host.attachShadow({ mode: 'open' });
  return host;
}

/* Hängt ein vollständiges HTML-Dokument (String) als Druck-Dokument ein und gibt den Shadow-Root zurück. */
function mountPrintDoc(html) {
  unmountPrintDoc();
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  doc.querySelectorAll('script, link, base').forEach(n => n.remove());   // Skripte laufen hier nicht; Schriften kommen von der Seite
  const title = (doc.title || '').trim();
  let pageCss = '';
  const styles = Array.from(doc.querySelectorAll('style')).map(s => {
    const css = s.textContent || '';
    // @page wirkt im Shadow-Root nicht → in den Kopf der Seite übernehmen
    (css.match(/@page\b[^{]*\{[^{}]*\}/g) || []).forEach(rule => { pageCss += rule + '\n'; });
    const el = document.createElement('style'); el.textContent = css; s.remove(); return el;
  });
  const root = ensurePrintHost().shadowRoot;
  // Echte html-/body-Elemente: so gelten alle Selektoren der Dokumente unverändert (per Parser ginge das nicht).
  const h = document.createElement('html'); h.lang = doc.documentElement.lang || 'de';
  const b = document.createElement('body'); b.innerHTML = doc.body ? doc.body.innerHTML : '';
  usePrintImages(b);
  h.appendChild(b);
  root.replaceChildren(...styles, h);
  const pageStyle = document.createElement('style');
  pageStyle.id = 'print-page-style';
  // erst die Seitenränder der Webseite zurücksetzen, dann gilt das @page des Dokuments (oder die Browser-Vorgabe)
  pageStyle.textContent = '@page { size: auto; margin: auto; }\n' + pageCss;
  document.head.appendChild(pageStyle);
  printDocState = { prevTitle: document.title, docTitle: title, off: null };
  if (title) document.title = title;   // wird der vorgeschlagene Dateiname bei „Als PDF sichern“
  document.documentElement.classList.add('has-print-doc');
  return root;
}

function unmountPrintDoc() {
  const st = printDocState;
  if (!st) return;
  printDocState = null;
  if (st.off) st.off();
  document.documentElement.classList.remove('has-print-doc');
  document.getElementById('print-page-style')?.remove();
  const root = document.getElementById('print-host')?.shadowRoot;
  if (root) { releasePrintImages(root); root.replaceChildren(); }
  if (st.docTitle && document.title === st.docTitle) document.title = st.prevTitle;
}

/* Aufräumen erst beim nächsten Tipp oder Tastendruck: Am iPhone kehrt print() sofort zurück, und die
   Druckvorschau baut sich bei jeder Options-Änderung neu auf – bis dahin muss das Dokument stehen bleiben. */
function armPrintCleanup() {
  const st = printDocState;
  if (!st) return;
  const done = (e) => {
    if (e && e.type === 'keydown' && e.repeat) return;   // gehaltene Taste (die den Druck ausgelöst hat) räumt nicht auf
    if (printDocState === st) unmountPrintDoc();
  };
  let armed = false;
  const timer = setTimeout(() => {
    armed = true;
    window.addEventListener('pointerdown', done, true);
    window.addEventListener('keydown', done, true);
    window.addEventListener('pagehide', done);
  }, 0);
  st.off = () => {
    clearTimeout(timer);
    if (!armed) return;
    window.removeEventListener('pointerdown', done, true);
    window.removeEventListener('keydown', done, true);
    window.removeEventListener('pagehide', done);
  };
}

/* Fehlt dem eingehängten Dokument noch ein Bild oder eine Schrift? Liefert ein Promise darauf – oder null, wenn alles da ist. */
function printDocPending(root) {
  const waits = [];
  root.querySelectorAll('img').forEach(im => {
    if (im.complete && im.naturalWidth > 0) return;
    waits.push(new Promise(res => { im.addEventListener('load', res, { once: true }); im.addEventListener('error', res, { once: true }); }));
  });
  if (!printWarmDone) {
    const css = Array.from(root.querySelectorAll('style')).map(s => s.textContent).join('\n');
    if (/Fraunces|Inter/.test(css)) waits.push(prewarmPrintAssets());   // Web-Schriften noch nicht vorgeladen
  }
  return waits.length ? Promise.all(waits) : null;
}

/* Druckt ein vollständiges HTML-Dokument. opts.fit(root) darf das eingehängte Dokument vor dem Druck einpassen. */
function printHtmlDocument(html, statusEl, opts = {}) {
  let root;
  try { root = mountPrintDoc(html); }
  catch (e) {
    unmountPrintDoc();
    setStatus(statusEl, 'Druckansicht konnte nicht erzeugt werden. Bitte erneut versuchen.', 'error');
    return;
  }
  const st = printDocState;
  const soon = (pending, next) => Promise.race([pending, new Promise(res => setTimeout(res, 1200))]).then(next, next);
  const fire = () => {
    if (printDocState !== st) return;   // inzwischen wurde etwas anderes gedruckt oder aufgeräumt
    armPrintCleanup();
    const t0 = performance.now();
    try { window.focus(); window.print(); } catch (e) {}
    // Am Computer hält print() das Skript an, bis der Druckdialog zu ist – dann gleich aufräumen (Titel, Druckbild).
    // Am iPhone kehrt print() sofort zurück; dort bleibt das Dokument bis zum nächsten Tipp stehen.
    if (performance.now() - t0 > 500 && printDocState === st) unmountPrintDoc();
  };
  const go = () => {
    if (printDocState !== st) return;
    try { if (opts.fit) opts.fit(root); } catch (e) { console.warn('Einpassen fehlgeschlagen', e); }
    const late = opts.fit ? printDocPending(root) : null;   // z. B. Logos zusätzlicher Blätter über den Vorrat hinaus
    if (!late) fire(); else soon(late, fire);
  };
  // Meldung vor dem Druckaufruf: am Computer hält der Druckdialog das Skript an.
  setStatus(statusEl, 'Druckansicht geöffnet — wählen Sie „Als PDF speichern“ oder Ihren Drucker.', 'ok');
  const pending = printDocPending(root);
  if (!pending) go();   // Regelfall: direkt im Tipp
  else soon(pending, go);
}

/* ---------- Wochenplan weitergeben: Aushang (A4) + Instagram-Bild ----------
   Beides nimmt den AKTUELLEN Formular-Stand (auch ungespeichert). */
function weekShareData() {
  const week = readFormToWeek();
  const facts = readWeekFacts();
  // Preis je Gericht: Abweichung, sonst Wochenpreis, sonst null (dann steht keiner dabei)
  const priceOf = (p) => (p != null ? p : facts.price);
  const days = DAYS.map((d, i) => {
    const date = new Date(currentMonday); date.setDate(date.getDate() + i);
    const e = week[d.key] || {};
    const vegText = (dish, veg) => (veg && dish && !/vegetarisch|vegan|veggie|fleischlos/i.test(dish)) ? `${dish} (vegetarisch)` : dish;
    const dishes = [{ dish: vegText(e.dish, e.veg), side: e.side, price: e.price }, { dish: vegText(e.dish2, e.veg2), side: e.side2, price: e.price2 }]
      .map(x => ({ dish: String(x.dish || '').trim(), side: String(x.side || '').trim(), price: priceOf(x.price) }))
      .filter(x => x.dish);
    return { label: d.label, date, closed: !!e.closed, dishes: e.closed ? [] : dishes, weekend: i >= 5 };
  }).filter(d => !d.weekend || d.dishes.length);
  const sunday = new Date(currentMonday); sunday.setDate(sunday.getDate() + 6);
  const dm = d => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return {
    days,
    kw: isoWeek(currentMonday),
    range: `${dm(currentMonday)} – ${dm(sunday)}`,
    hasAny: days.some(d => d.dishes.length),
    until: facts.until
  };
}
// „9,90 €“ für Aushang und Bild
function sharePrice(p) { return p == null ? '' : window.AlsterRules.euroText(p) + ' €'; }
// Beilage: „mit …“ nur voranstellen, wenn der Text nicht schon so anfängt
function shareSide(side) {
  const t = String(side || '').trim();
  if (!t) return '';
  return /^(mit|serviert|dazu|und|inkl|wahlweise|oder)\b/i.test(t) ? t : `mit ${t}`;
}
function weekShareStatus(msg, kind) { setStatus(document.getElementById('week-share-status'), msg, kind); }

// Schriften fürs Druckfenster: dieselbe fonts.css-Adresse wie diese Seite (inkl. ?v=),
// damit nach einem Update keine veraltete, lange gecachte Fassung geladen wird.
function pageFontsHref() {
  const link = document.querySelector('link[rel="stylesheet"][href*="fonts.css"]');
  return link ? link.href : `${location.origin}/fonts.css`;
}

function printWeekPoster() {
  const data = weekShareData();
  if (!data.hasAny) { weekShareStatus('Bitte zuerst Gerichte eintragen.', 'error'); return; }
  printHtmlDocument(buildWeekPosterHtml(data), document.getElementById('week-share-status'), { fit: fitWeekPoster });
}

/* Passt den eingehängten Aushang vor dem Druck ein: Erst wird gemessen, dann die größte Schriftstufe genommen,
   bei der das Blatt auf eine A4-Seite passt (bei Bedarf rückt der Preis neben das Gericht). Reicht auch die
   kleinste Stufe nicht, wird die Woche auf zwei (oder mehr) Blätter verteilt – gekürzt wird nichts. */
function fitWeekPoster(root) {
  const host = document.getElementById('print-host');
  const first = root.querySelector('.sheet');
  if (!host || !first) return;
  const LEVELS = ['', 'pside', 'dense', 'dense pside', 'dense xdense', 'dense xdense pside', 'dense xdense xxdense pside'];
  const MAX = 265 * 96 / 25.4 + 0.5;   // 265 mm in px (Blatt samt Rahmen; die Seite hat 269 mm Platz)
  const prevStyle = host.getAttribute('style') || '';
  // Zum Messen so darstellen wie im Druck: A4-Breite abzüglich der Seitenränder, ohne geerbte Stile der Seite
  // (text-size-adjust: iPhones vergrößern Schrift in breiten Blöcken sonst von selbst – das verfälscht die Messung)
  host.style.cssText = 'all: initial; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; display: block; position: absolute; left: -10000px; top: 0; width: 178mm; visibility: hidden;';
  try {
    const body = first.parentNode;
    const days = Array.from(first.querySelectorAll('.day'));
    if (!days.length) return;
    const rangeText = first.querySelector('.range')?.textContent || '';
    const blank = first.cloneNode(true); blank.querySelector('.days').replaceChildren();
    first.className = 'sheet dense';
    const heights = days.map(d => d.getBoundingClientRect().height);
    // Aufeinanderfolgende Tage so auf n Blätter verteilen, dass das vollste Blatt möglichst leer bleibt
    const split = (n) => {
      const N = days.length, pre = [0]; heights.forEach(h => pre.push(pre[pre.length - 1] + h));
      const best = Array.from({ length: n + 1 }, () => Array(N + 1).fill(Infinity));
      const cut = Array.from({ length: n + 1 }, () => Array(N + 1).fill(0));
      best[0][0] = 0;
      for (let k = 1; k <= n; k++) for (let i = k; i <= N; i++) for (let j = k - 1; j < i; j++) {
        const v = Math.max(best[k - 1][j], pre[i] - pre[j]);
        if (v <= best[k][i]) { best[k][i] = v; cut[k][i] = j; }   // bei Gleichstand das vordere Blatt voller
      }
      const groups = []; let i = N;
      for (let k = n; k >= 1; k--) { const j = cut[k][i]; groups.unshift(days.slice(j, i)); i = j; }
      return groups;
    };
    for (let n = 1; n <= days.length; n++) {
      body.querySelectorAll('.sheet').forEach(s => { if (s !== first) { releasePrintImages(s); s.remove(); } });
      const sheets = split(n).map((group, i) => {
        const s = i === 0 ? first : blank.cloneNode(true);
        if (i) usePrintImages(s);   // fertig geladenes Logo statt eines frisch geklonten
        s.querySelector('.days').replaceChildren(...group);
        const r = s.querySelector('.range');
        if (r) r.textContent = n > 1 ? `${rangeText} · Blatt ${i + 1} von ${n}` : rangeText;
        if (i) body.appendChild(s);
        return s;
      });
      const fits = LEVELS.some(cls => {
        sheets.forEach(s => { s.className = ('sheet ' + cls).trim(); });
        return sheets.every(s => s.getBoundingClientRect().height <= MAX);
      });
      if (fits) return;
      // Nach dem Durchlauf steht die kleinste Stufe. Sind jetzt nur noch Blätter zu hoch, die aus einem einzigen
      // Tag bestehen, hilft weiteres Aufteilen nicht – dieser Tag läuft dann eben über zwei Seiten.
      if (sheets.every(s => s.getBoundingClientRect().height <= MAX || s.querySelectorAll('.day').length === 1)) return;
    }
  } finally {
    host.setAttribute('style', prevStyle);
  }
}

function buildWeekPosterHtml(data) {
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const origin = location.origin;
  // Grobe Füllmenge: Gerichte, Beilagen und lange Namen (Zeilenumbrüche)
  const load = data.days.reduce((a, d) => a + 1 + d.dishes.reduce((b, x) => b + 1 + (x.side ? .45 : 0) + (x.price != null ? .3 : 0) + (x.dish.length > 45 ? .8 : 0), 0) + Math.max(0, d.dishes.length - 1) * .4, 0);
  const density = load > 16 ? 'dense xdense' : load > 11 ? 'dense' : '';
  const rows = data.days.map(d => {
    let body;
    if (d.closed) body = '<p class="none">Kein Mittagstisch</p>';
    else if (!d.dishes.length) body = '<p class="none">Folgt in Kürze</p>';
    else body = d.dishes.map(x => `<div class="item"><p class="dish">${esc(x.dish)}</p>${x.side ? `<p class="side">${esc(shareSide(x.side))}</p>` : ''}${x.price != null ? `<p class="price">${esc(sharePrice(x.price))}</p>` : ''}</div>`)
      .join('<p class="or"><span>oder</span></p>');
    return `<div class="day"><div class="when"><span class="name">${esc(d.label)}</span><span class="date">${d.date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span></div><div class="what">${body}</div></div>`;
  }).join('');
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<title>Mittagstisch KW ${data.kw} · Alstercafé</title>
<link rel="stylesheet" href="${esc(pageFontsHref())}">
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
  /* Sehr volle Woche: kleinste Stufe (wird nur von der Einpassung vor dem Druck gewählt) */
  .xxdense header { margin-bottom: 3.5mm; } .xxdense header img { width: 13mm; height: 13mm; margin-bottom: 2mm; } .xxdense .brand { font-size: 21pt; } .xxdense .kicker { margin-top: 2mm; }
  .xxdense .day { padding: 1.7mm 0; gap: 4mm; grid-template-columns: 32mm 1fr; } .xxdense .name { font-size: 9.5pt; } .xxdense .date { font-size: 8.5pt; margin-top: .5mm; }
  .xxdense .dish { font-size: 11.5pt; line-height: 1.18; } .xxdense .side { font-size: 8.5pt; margin-top: .4mm; } .xxdense .price { font-size: 9pt; } .xxdense .or { margin: .5mm 0; font-size: 7pt; }
  .xxdense footer { margin-top: 3mm; padding-top: 3mm; font-size: 9.5pt; line-height: 1.45; }
  /* Preis rechts neben dem Gericht statt darunter – spart je Gericht eine Zeile */
  .pside .item { display: grid; grid-template-columns: 1fr auto; column-gap: 5mm; align-items: baseline; }
  .pside .item .side { grid-column: 1 / -1; }
  .pside .item .price { grid-column: 2; grid-row: 1; margin: 0; white-space: nowrap; }
  /* Mehrere Blätter: jedes beginnt auf einer neuen Seite */
  .sheet + .sheet { break-before: page; page-break-before: always; }
  .name { display: block; font-size: 11pt; font-weight: 700; letter-spacing: 1.2pt; text-transform: uppercase; color: #3D2415; }
  .date { display: block; font-size: 9.5pt; color: #8a7a68; margin-top: 1mm; }
  .dish { font-family: 'Fraunces', Georgia, serif; font-size: 17pt; line-height: 1.2; margin: 0; color: #2A1810; }
  .side { font-size: 10.5pt; color: #6b5a4a; margin: 1mm 0 0; }
  .price { font-size: 10.5pt; font-weight: 600; color: #8A6420; margin: 1mm 0 0; font-variant-numeric: tabular-nums; }
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
  <footer><strong>${data.until ? `12:00 – ${esc(data.until)} Uhr` : 'Ab 12:00 Uhr'}</strong> · Beilage und Salat sind immer dabei<br>Ifflandstraße 45 · 040 – 22 69 28 91 · alstercafe.de</footer>
</div>
</body></html>`;
}

/* Instagram-Bild 1080×1350 (Hochformat-Post) per Canvas */
async function makeWeekImage() {
  const data = weekShareData();
  if (!data.hasAny) { weekShareStatus('Bitte zuerst Gerichte eintragen.', 'error'); return; }
  weekShareStatus('Bild wird erstellt …');
  // Schriften mit dem tatsächlichen Text laden – sonst fehlt bei Sonderzeichen der passende Schnitt
  const allText = data.days.map(d => d.dishes.map(x => `${x.dish} ${x.side}`).join(' ')).join(' ') + ' AlstercaféMITTAGSTISCHKWODER€';
  try {
    await Promise.all([
      document.fonts.load('500 64px Fraunces', allText), document.fonts.load('400 40px Fraunces', allText),
      document.fonts.load('600 24px Inter', allText), document.fonts.load('400 24px Inter', allText)
    ]);
  } catch (e) {}
  let logo = null;
  try {
    logo = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = 'image-192.webp'; });
  } catch (e) {}
  const img = drawWeekImage(data, logo);
  const blob = await new Promise(r => img.canvas.toBlob(r, 'image/png'));
  if (!blob) { weekShareStatus('Bild konnte nicht erstellt werden.', 'error'); return; }
  weekShareStatus('');
  const note = img.tier >= 2 ? 'Damit alles lesbar auf ein Bild passt, stehen die Beilagen nicht dabei und sehr lange Gerichte sind gekürzt. Der volle Text steht auf der Webseite und im Aushang.'
    : img.tier === 1 ? 'Damit alles lesbar auf ein Bild passt, stehen die Beilagen diesmal nicht dabei. Der volle Text steht auf der Webseite und im Aushang.' : '';
  showWeekImageDialog(blob, `alstercafe-mittagstisch-KW${data.kw}.png`, note);
}

/* Zeichnet den Wochenplan auf ein Bild. Immer genau ein Bild, nie Überlappung:
   Erst wird die Schrift verkleinert (bis 26 px) und der Preis neben statt unter das Gericht gesetzt,
   dann stufenweise gekürzt –
   Stufe 0 voller Text · 1 ohne Beilagen · 2 Gerichte höchstens 3 Zeilen · 3 höchstens 2 · 4 eine Zeile.
   Liefert { canvas, tier, px }. */
function drawWeekImage(data, logo) {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const C = { espresso: '#2A1810', bean: '#3D2415', gold: '#B8893E', goldSoft: '#D4B380', linen: '#F1E7D3' };
  const spacing = (px) => { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; };
  const left = 110, right = W - 110, bottom = H - 150, colGap = 56;
  const SIZES = [40, 38, 36, 34, 32, 30, 28, 26];
  const SIZES_CUT = [30, 28, 26];   // wird gekürzt, zählt mehr Text als größere Schrift
  const MAX_LINES = [Infinity, Infinity, 3, 2, 1];
  const hasPrices = data.days.some(d => d.dishes.some(x => x.price != null));
  const dishFont = (px) => `400 ${px}px Fraunces, Georgia, serif`;
  const textFont = (px, weight = 400) => `${weight} ${px}px Inter, Arial, sans-serif`;
  const sideSize = (px) => Math.max(21, Math.round(px * 0.62));
  const wide = (t) => ctx.measureText(t).width;

  // Umbruch nach Wörtern; ein Wort, das allein breiter ist als die Spalte, wird geteilt
  // (bevorzugt hinter „-“ oder „/“, sonst mit Trennstrich) – keine Zeile ragt über die Spalte.
  const splitLong = (word, maxW) => {
    const out = []; let rest = word;
    while (rest.length > 1 && wide(rest) > maxW) {
      let n = rest.length - 1;   // mindestens ein Zeichen je Durchlauf, sonst käme die Schleife nie ans Ende
      while (n > 1 && wide(rest.slice(0, n) + '-') > maxW) n--;
      if (rest.length - n < 4 && n > 6) n = rest.length - 4;   // keinen Rest von zwei, drei Buchstaben stehen lassen
      const cut = Math.max(rest.lastIndexOf('-', n - 1), rest.lastIndexOf('/', n - 1));
      if (cut > 0) { out.push(rest.slice(0, cut + 1)); rest = rest.slice(cut + 1); }
      else { out.push(rest.slice(0, n) + '-'); rest = rest.slice(n); }
    }
    if (rest) out.push(rest);
    return out;
  };
  const wrapText = (text, maxW) => {
    maxW = Math.max(40, maxW);
    const lines = []; let cur = '';
    String(text).split(/\s+/).filter(Boolean).forEach(word => {
      const bits = wide(word) > maxW ? splitLong(word, maxW) : [word];
      bits.forEach((bit, i) => {
        const t = cur ? cur + ' ' + bit : bit;
        if (i === 0 && wide(t) <= maxW) { cur = t; return; }
        if (cur) lines.push(cur);
        cur = bit;
      });
    });
    if (cur) lines.push(cur);
    return lines;
  };
  // Auf n Zeilen begrenzen; die letzte endet dann mit „…“ – an einer Wortgrenze („Wort …“) oder,
  // wenn schon das eine Wort zu lang ist, mitten im Wort („Wor…“).
  const clampLines = (lines, n, maxW) => {
    if (lines.length <= n) return lines;
    const out = lines.slice(0, n);
    let last = out[n - 1], midWord = false;
    while (last && wide(last + (midWord ? '…' : ' …')) > maxW) {
      if (/\s/.test(last)) last = last.replace(/\s+\S+$/, '');
      else { last = last.slice(0, -1); midWord = true; }
    }
    last = last.replace(/[\s,;:.·–-]+$/, '');
    out[n - 1] = last + (midWord ? '…' : ' …');
    return out;
  };

  const headTop = (header) => header === 'full' ? (logo ? 394 : 292) : 214;   // Beginn der Tage unter dem Kopf
  const measureDay = (d, o) => {
    const cellW = o.cols === 2 ? (right - left - colGap) / 2 : right - left;
    const labelW = o.cols === 2 ? 0 : 210;
    const head = o.cols === 2 ? 44 : 0;   // Platz für den Tag über dem Gericht
    const textW = cellW - labelW, sidePx = sideSize(o.px);
    const parts = [];
    if (!d.dishes.length) parts.push({ kind: 'none', text: d.closed ? 'Kein Mittagstisch' : 'Folgt in Kürze', h: 34 });
    d.dishes.forEach((x, i) => {
      if (i) parts.push({ kind: 'or', h: 37 });
      const priceTxt = x.price != null ? sharePrice(x.price) : '';
      const beside = o.priceSide && !!priceTxt;   // Preis rechts neben dem Gericht (eigene schmale Spalte)
      const dishW = o.priceSide ? textW - o.priceCol : textW;
      spacing(0); ctx.font = dishFont(o.px);
      const lines = clampLines(wrapText(x.dish, dishW), MAX_LINES[o.tier], dishW);
      parts.push({ kind: 'dish', lines, h: lines.length * o.px * 1.15, price: beside ? priceTxt : '' });
      if (o.tier === 0 && x.side) {
        ctx.font = textFont(sidePx);
        const sl = wrapText(shareSide(x.side), textW);
        parts.push({ kind: 'side', lines: sl, h: 8 + sl.length * sidePx * 1.3 });
      }
      if (priceTxt && !beside) parts.push({ kind: 'price', text: priceTxt, h: 8 + sidePx * 1.3 });
    });
    return { d, parts, h: Math.max(o.cols === 2 ? 0 : 56, head + parts.reduce((a, p) => a + p.h, 0)) };
  };
  const measure = (o) => {
    if (o.priceSide) {   // Breite der Preis-Spalte: der breiteste Preis der Woche
      spacing(0); ctx.font = textFont(sideSize(o.px), 600);
      o.priceCol = Math.ceil(Math.max(0, ...data.days.flatMap(d => d.dishes.map(x => x.price != null ? wide(sharePrice(x.price)) : 0)))) + 22;
    }
    const gap = Math.max(18, Math.round(o.px * 0.7));
    const cells = data.days.map(d => measureDay(d, o));
    const rows = [];
    for (let i = 0; i < cells.length; i += o.cols) { const part = cells.slice(i, i + o.cols); rows.push({ cells: part, h: Math.max(...part.map(x => x.h)) }); }
    const top = headTop(o.header);
    const cellW = o.cols === 2 ? (right - left - colGap) / 2 : right - left;
    const labelW = o.cols === 2 ? 0 : 210;
    // Bleibt neben der Preis-Spalte zu wenig Platz für das Gericht (absurd langer Preis), taugt diese Anordnung nicht
    const tooNarrow = !!o.priceSide && (cellW - labelW - o.priceCol) < 150;
    return { ...o, rows, gap, top, tooNarrow, avail: bottom - top, h: rows.reduce((a, r) => a + r.h + gap * 2, 0),
      cellW, labelW, head: o.cols === 2 ? 44 : 0, textW: cellW - labelW, sidePx: sideSize(o.px), orPx: 19 };
  };

  // Die erste Kürzungsstufe, bei der etwas passt, gewinnt. Innerhalb der Stufe: größte Schrift –
  // der volle Kopf mit Logo ist dabei so viel wert wie 4 px Schrift, der Preis unter dem Gericht 2 px,
  // eine Spalte 1 px.
  let layout = null;
  for (let tier = 0; tier < MAX_LINES.length && !layout; tier++) {
    const sides = !hasPrices ? [false] : tier === 4 ? [true] : [false, true];
    for (const header of ['full', 'compact']) for (const cols of [1, 2]) for (const priceSide of sides) {
      for (const px of (tier >= 2 ? SIZES_CUT : SIZES)) {
        const L = measure({ tier, header, cols, priceSide, px });
        if (L.tooNarrow || L.h > L.avail) continue;
        L.score = px + (header === 'full' ? 4 : 0) + (priceSide ? 0 : 2) + (cols === 1 ? 1 : 0);
        if (!layout || L.score > layout.score) layout = L;
        break;   // größte passende Schrift dieser Kombination
      }
    }
  }
  // Notfall (praktisch nie): selbst die knappste Fassung ist zu hoch → den Block als Ganzes verkleinern
  let squeeze = 1;
  if (!layout) {
    layout = measure({ tier: 4, header: 'compact', cols: 2, priceSide: hasPrices, px: 26 });
    if (layout.tooNarrow) layout = measure({ tier: 4, header: 'compact', cols: 2, priceSide: false, px: 26 });
    squeeze = Math.min(1, layout.avail / layout.h);
  }

  // ----- Zeichnen -----
  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, C.bean); bg.addColorStop(1, C.espresso);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(212,179,128,.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(40, 40, W - 80, H - 80, 28) : ctx.rect(40, 40, W - 80, H - 80); ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if (layout.header === 'full') {
    let y = 92;
    if (logo) {
      ctx.save(); ctx.beginPath(); ctx.arc(W / 2, y + 48, 48, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(logo, W / 2 - 48, y, 96, 96); ctx.restore();
      y += 96 + 66;
    } else y += 60;
    spacing(0); ctx.fillStyle = C.linen; ctx.font = '500 66px Fraunces, Georgia, serif';
    ctx.fillText('Alstercafé', W / 2, y);
    y += 54; spacing(6); ctx.fillStyle = C.goldSoft; ctx.font = textFont(25, 600);
    ctx.fillText(`MITTAGSTISCH · KW ${data.kw}`, W / 2, y);
    y += 40; spacing(1); ctx.fillStyle = 'rgba(241,231,211,.72)'; ctx.font = textFont(24);
    ctx.fillText(data.range, W / 2, y);
  } else {
    // Kompakter Kopf für volle Wochen: Name, darunter Woche und Zeitraum in einer Zeile
    spacing(0); ctx.fillStyle = C.linen; ctx.font = '500 50px Fraunces, Georgia, serif';
    ctx.fillText('Alstercafé', W / 2, 124);
    spacing(4); ctx.fillStyle = C.goldSoft; ctx.font = textFont(23, 600);
    ctx.fillText(`MITTAGSTISCH · KW ${data.kw} · ${data.range}`, W / 2, 168);
  }

  // Die Tage: beschnitten auf ihren Bereich, damit nie etwas in die Fußzeile ragen kann
  ctx.save();
  ctx.beginPath(); ctx.rect(0, layout.top - 4, W, layout.avail + 8); ctx.clip();
  if (squeeze < 1) { ctx.translate(W / 2, layout.top); ctx.scale(squeeze, squeeze); ctx.translate(-W / 2, -layout.top); }
  let ry = layout.top + Math.max(0, (layout.avail - layout.h * Math.min(1, squeeze)) / 2);
  layout.rows.forEach((row, i) => {
    if (i) { ctx.strokeStyle = 'rgba(212,179,128,.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(left, ry); ctx.lineTo(right, ry); ctx.stroke(); }
    ry += layout.gap;
    row.cells.forEach((r, ci) => {
      const cx = left + ci * (layout.cellW + colGap);
      const dateTxt = r.d.date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
      ctx.textAlign = 'left';
      spacing(3); ctx.fillStyle = C.goldSoft; ctx.font = textFont(22, 600);
      ctx.fillText(r.d.label.toUpperCase(), cx, ry + 26);
      if (layout.cols === 2) {
        const lw = wide(r.d.label.toUpperCase());
        spacing(0); ctx.fillStyle = 'rgba(241,231,211,.6)'; ctx.font = textFont(20);
        ctx.fillText(dateTxt, cx + lw + 14, ry + 26);
      } else {
        spacing(0); ctx.fillStyle = 'rgba(241,231,211,.6)'; ctx.font = textFont(20);
        ctx.fillText(dateTxt, cx, ry + 54);
      }
      let ty = ry + layout.head; const tx = cx + layout.labelW;
      r.parts.forEach(p => {
        spacing(0); ctx.textAlign = 'left';
        if (p.kind === 'none') { ctx.fillStyle = 'rgba(241,231,211,.6)'; ctx.font = textFont(26); ctx.fillText(p.text, tx, ty + 28); }
        if (p.kind === 'or') { spacing(4); ctx.fillStyle = C.gold; ctx.font = textFont(layout.orPx, 600); ctx.fillText('ODER', tx, ty + layout.orPx + 6); spacing(0); }
        if (p.kind === 'dish') {
          ctx.fillStyle = '#FFFCF4'; ctx.font = dishFont(layout.px);
          p.lines.forEach((l, k) => ctx.fillText(l, tx, ty + layout.px * (0.9 + k * 1.15)));
          if (p.price) { ctx.textAlign = 'right'; ctx.fillStyle = C.goldSoft; ctx.font = textFont(layout.sidePx, 600); ctx.fillText(p.price, tx + layout.textW, ty + layout.px * 0.9); ctx.textAlign = 'left'; }
        }
        if (p.kind === 'side') { ctx.fillStyle = 'rgba(241,231,211,.75)'; ctx.font = textFont(layout.sidePx); p.lines.forEach((l, k) => ctx.fillText(l, tx, ty + 8 + layout.sidePx * (1 + k * 1.3))); }
        if (p.kind === 'price') { ctx.fillStyle = C.goldSoft; ctx.font = textFont(layout.sidePx, 600); ctx.fillText(p.text, tx, ty + 8 + layout.sidePx); }
        ty += p.h;
      });
    });
    ry += row.h + layout.gap;
  });
  ctx.restore();

  ctx.textAlign = 'center'; spacing(2);
  ctx.fillStyle = C.goldSoft; ctx.font = textFont(25, 600);
  ctx.fillText(data.until ? `12:00 – ${data.until} UHR` : 'AB 12:00 UHR', W / 2, H - 100);
  spacing(0); ctx.fillStyle = 'rgba(241,231,211,.8)'; ctx.font = textFont(23);
  ctx.fillText('Ifflandstraße 45 · Hamburg-Hohenfelde · alstercafe.de', W / 2, H - 66);
  return { canvas: c, tier: layout.tier, px: layout.px, cols: layout.cols, header: layout.header, squeeze, used: Math.round(layout.h), avail: layout.avail };
}

function showWeekImageDialog(blob, filename, note = '') {
  const url = URL.createObjectURL(blob);
  const file = (typeof File === 'function') ? new File([blob], filename, { type: 'image/png' }) : null;
  const canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
  const dlg = document.createElement('dialog');
  dlg.className = 'confirm-dialog week-image-dialog';
  dlg.setAttribute('aria-labelledby', 'week-image-title');
  dlg.innerHTML = `
    <div class="confirm-dialog-form">
      <h3 class="confirm-dialog-title" id="week-image-title">Bild für Instagram</h3>
      <img class="week-image-preview" src="${url}" alt="Vorschau: Mittagstisch der Woche als Bild" />
      <p class="confirm-dialog-hint">${canShare ? 'Tippen Sie auf „Teilen“ und wählen Sie Instagram, WhatsApp oder „Bild sichern“.' : 'Bild speichern und dann bei Instagram als Beitrag hochladen.'}</p>
      ${note ? `<p class="confirm-dialog-hint week-image-note">${escapeHtml(note)}</p>` : ''}
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
  // Fokus auf den Hauptknopf (sonst landet er auf „Schließen“)
  (dlg.querySelector('[data-act="share"]') || dlg.querySelector('[data-act="save"]'))?.focus({ preventScroll: true });
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
    hint.textContent = c.empty ? '' : c.ok ? (c.warn ? `Hinweis: ${c.warn}` : c.message) : `Fehler: ${c.message}`;
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
  renderGoogleReviewField(design);
  // Color
  const accent = design.accentColor || '#B8893E';
  const colorInput = document.getElementById('color-input');
  if (colorInput) colorInput.value = accent;
  document.querySelectorAll('.color-chip').forEach(chip => {
    chip.classList.toggle('is-active', chip.dataset.color.toLowerCase() === accent.toLowerCase());
  });
}

/* Google-Bewertungslink: Feld, „Link testen“, A6-Aushang mit QR-Code (vendor/qrcode-generator) */
function googleReviewOk(u) {
  return /^https:\/\/(g\.page\/|search\.google\.com\/|www\.google\.[a-z.]+\/|maps\.app\.goo\.gl\/|goo\.gl\/)/i.test(u);
}
function renderGoogleReviewField(design) {
  const input = document.getElementById('google-review-url');
  if (!input) return;
  const status = document.getElementById('google-review-status');
  const test = document.getElementById('google-review-test');
  const print = document.getElementById('google-review-print');
  const current = String(design.googleReviewUrl || '').trim();
  if (document.activeElement !== input) input.value = current;
  const show = (u) => {
    if (!u) { setStatus(status, 'Kein Link eingetragen – auf der Webseite erscheint nichts.'); }
    else if (googleReviewOk(u)) { setStatus(status, 'Link gespeichert – Zeile auf Startseite und Kontaktseite ist sichtbar.', 'ok'); }
    else { setStatus(status, 'Das sieht nicht wie ein Google-Bewertungslink aus (erwartet: https://g.page/… oder https://search.google.com/…). Nicht übernommen.', 'error'); }
    if (test) test.disabled = !googleReviewOk(u);
    if (print) print.disabled = !googleReviewOk(u);
  };
  show(current);
  if (input.dataset.bound) return;
  input.dataset.bound = '1';
  input.addEventListener('change', () => {
    const u = input.value.trim();
    if (u && !googleReviewOk(u)) { show(u); return; }
    const d = loadDesign();
    if (u) d.googleReviewUrl = u; else delete d.googleReviewUrl;
    saveDesign(d);
    show(u);
    flashDesignStatus(u ? 'Google-Bewertungslink übernommen.' : 'Google-Bewertungslink entfernt.');
  });
  test?.addEventListener('click', () => {
    const u = input.value.trim();
    if (googleReviewOk(u)) window.open(u, '_blank', 'noopener');
  });
  print?.addEventListener('click', () => printReviewPoster(input.value.trim(), status));
}
function printReviewPoster(url, statusEl) {
  if (!googleReviewOk(url)) { setStatus(statusEl, 'Bitte zuerst einen gültigen Google-Bewertungslink eintragen.', 'error'); return; }
  if (typeof qrcode !== 'function') { setStatus(statusEl, 'QR-Code-Modul nicht geladen – bitte Seite neu laden.', 'error'); return; }
  let svg = '';
  try {
    const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
    svg = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  } catch (e) { setStatus(statusEl, 'QR-Code konnte nicht erzeugt werden.', 'error'); return; }
  const logo = new URL('image.png', location.href).href;
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Bewertungs-Aushang · Alstercafé</title>
<style>
  @page { size: A6; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #3D2415; }
  .card { box-sizing: border-box; width: 105mm; height: 148mm; padding: 12mm 10mm; display: flex; flex-direction: column; align-items: center; text-align: center; border: 0.6mm solid #B8893E; }
  .logo { width: 16mm; height: 16mm; border-radius: 50%; object-fit: cover; margin-bottom: 4mm; }
  .brand { font-size: 13pt; letter-spacing: .08em; text-transform: uppercase; color: #8A6420; margin: 0 0 2mm; }
  h1 { font-size: 19pt; font-weight: 400; margin: 0 0 3mm; line-height: 1.15; }
  p { font-size: 10pt; line-height: 1.45; margin: 0 0 4mm; color: #5C3C20; }
  .qr { width: 46mm; height: 46mm; margin: 2mm auto 4mm; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .foot { margin-top: auto; font-size: 8.5pt; color: #8A6420; letter-spacing: .04em; }
  @media screen { body { background: #eee; padding: 20px; } .card { background: #fff; margin: 0 auto; box-shadow: 0 2px 14px rgba(0,0,0,.15); } }
</style></head><body>
<div class="card">
  <img class="logo" src="${logo}" alt="">
  <p class="brand">Alstercafé</p>
  <h1>Hat es Ihnen bei uns gefallen?</h1>
  <p>Eine Bewertung bei Google dauert eine Minute und hilft uns sehr. Einfach den Code mit der Handy-Kamera scannen.</p>
  <div class="qr">${svg}</div>
  <p>Vielen Dank – Ihr Alstercafé-Team</p>
  <p class="foot">Ifflandstraße 45 · 22087 Hamburg · alstercafe.de</p>
</div>
</body></html>`;
  printHtmlDocument(html, statusEl);
  logActivity('Bewertungs-Aushang gedruckt');
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
    text: 'Gelöscht werden: Mittagstisch (alle Wochen), Speisekarte, Öffnungszeiten, Schließtage, Hinweis-Banner, „Wir suchen Verstärkung“, Bilder & Farben, Webseiten-Texte, Brötchen-Sorten und die Berliner-Aktion (wird ausgeschaltet). Reservierungen, Bestellungen und Ihr Konto bleiben erhalten. Das lässt sich nicht rückgängig machen.',
    actions: [{ label: 'Abbrechen', value: false }, { label: 'Alles zurücksetzen', value: true, kind: 'danger' }]
  });
  if (!ok1) return;
  const keys = ['weekly-menu', 'notice', 'notice-until', 'jobs', 'menu', 'specials', 'hours', 'holidays', 'design', 'content', 'broetchen-items', 'berliner-items', 'berliner-settings'];
  const results = await Promise.all(keys.map(k => window.alsterDb.remove(k).catch(() => false)));
  Object.keys(GUARDED_FORMS).forEach(markClean);
  renderWeek();
  renderNotice();
  renderJobs();
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
  showToast('Alle Inhalte wurden auf Standard zurückgesetzt.');
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
/* Bestellungen ohne Einschränkung zeigen (Suche leer, Sorten-Filter „Alle“) – vor jedem Sprung dorthin,
   sonst kann die gesuchte Bestellung ausgeblendet sein. */
function resetOrdersView() {
  let changed = false;
  if (dom.ordersSearch && dom.ordersSearch.value) { dom.ordersSearch.value = ''; changed = true; }
  const chips = document.querySelectorAll('#orders-filter [data-kind]');
  const active = document.querySelector('#orders-filter .is-active');
  if (chips.length && active?.dataset.kind !== 'all') {
    chips.forEach(x => { const on = x.dataset.kind === 'all'; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', String(on)); });
    changed = true;
  }
  if (changed) renderOrders();
}

/* Mittagstisch eines Tages aus dem Wochenplan. null = für den Tag ist nichts vorgesehen
   (Wochenende ohne Eintrag). missing = Werktag ohne Gericht. */
function lunchFor(date) {
  const wk = loadAll()[isoDate(mondayOf(date))];
  const idx = (date.getDay() + 6) % 7;
  const day = wk && wk.days ? wk.days[DAYS[idx].key] : null;
  if (day && day.closed) return { closed: true, text: 'kein Mittagstisch' };
  const dish = [day?.dish, day?.dish2].map(d => (d || '').trim()).filter(Boolean).join('  ·  oder  ·  ');
  if (dish) return { text: dish };
  return idx <= 4 ? { missing: true, text: 'noch nichts eingetragen' } : null;
}

/* Tagesliste drucken; die Rückmeldung erscheint als kurze Einblendung dort, wo getippt wurde. */
function printDayWithToast(iso) {
  const note = document.createElement('p');
  new MutationObserver((_, mo) => {
    if (!note.textContent) return;
    mo.disconnect();
    showToast(note.textContent, note.classList.contains('error') ? { tone: 'error' } : {});
  }).observe(note, { childList: true, characterData: true, subtree: true });
  printDayList(iso, note);
}

/* Ein Tag in der Übersicht (heute / morgen): Summe, Mittagstisch, Einträge. */
function renderOverviewDay(key, iso, lunch, hol) {
  const sumEl = document.getElementById(`ov-${key}-sum`), body = document.getElementById(`ov-${key}-body`);
  if (!sumEl || !body) return;
  const entries = dayEntries(iso);
  // Summe wie im Tagesplan: zugesagte Tische und noch nicht abgeholte Bestellungen (die Zeilen darunter zeigen alles)
  const resRows = entries.filter(e => e.kind === 'res' && resIsAccepted(e.x)).map(e => e.x);   // zugesagte Tische
  const nOrd = entries.filter(e => e.kind === 'order' && e.x.status !== 'done').length;
  const parts = [];
  if (resRows.length) parts.push(tablesLabel(resRows));
  if (nOrd) parts.push(`${nOrd} ${nOrd === 1 ? 'Abholung' : 'Abholungen'}`);
  sumEl.textContent = hol
    ? `geschlossen${hol.label ? ' · ' + hol.label : ''}${parts.length ? ' · ' + parts.join(' · ') : ''}`
    : parts.join(' · ');   // ohne Einträge bleibt die Summe leer – der Satz darunter sagt es
  sumEl.classList.toggle('is-closed', !!hol);
  const lunchHtml = lunch ? `<button type="button" class="ov-lunch${lunch.missing ? ' is-missing' : ''}" data-ov-go="week">
      <span class="ov-lunch-label">Mittagstisch</span>
      <span class="ov-lunch-text">${escapeHtml(lunch.text)}</span>
      <span class="ov-go" aria-hidden="true">→</span>
    </button>` : '';
  const listHtml = entries.length ? `<ul class="today-list">${entries.map(e => {
      const x = e.x;
      const qty = e.kind === 'order' ? (x.totalCount || (x.items || []).reduce((n, it) => n + (parseInt(it?.qty, 10) || 0), 0)) : 0;
      const what = e.kind === 'res' ? (personsLabel(x.persons) || 'Tisch') : `${qty} ${(x.items || []).some(it => it && it.kind === 'berliner') ? 'Berliner' : 'Brötchen'}`;
      return `<li><button type="button" class="today-item${e.kind === 'order' && entryStage(x) === 'done' ? ' is-done' : ''}" data-open-kind="${e.kind}" data-open-id="${escapeAttr(x.id || '')}">
          <span class="today-time">${escapeHtml(e.time || '–')}</span>
          <span class="today-main"><strong>${escapeHtml(x.name || 'Ohne Namen')}</strong> · ${escapeHtml(what)}</span>
          ${statusTagHtml(x, e.kind)}
        </button></li>`;
    }).join('')}</ul>
    <button type="button" class="btn btn-link today-print" data-ov-print="${escapeAttr(iso)}">
      <svg class="ico ico-sm" aria-hidden="true"><use href="#i-print"/></svg>
      Tagesliste drucken
    </button>` : '<p class="ov-day-empty">Keine Reservierungen oder Abholungen.</p>';
  body.innerHTML = lunchHtml + listHtml;
}

/* Übersicht: „Zu tun“ (nur, was wirklich ansteht), „Heute“ und „Morgen“. */
function renderOverviewSummary() {
  const resArr = (() => { const l = window.alsterDb?.get('reservations'); return Array.isArray(l) ? l : []; })();
  const ordArr = (() => { const l = window.alsterDb?.get('orders'); return Array.isArray(l) ? l : []; })();
  const resTodo = resArr.filter(r => needsConfirm(r, 'date')).length;
  const ordTodo = ordArr.filter(o => needsConfirm(o, 'pickupDate')).length;
  // Was zu bestätigen ist, steht auch im Browser-Tab, z. B. „(2) Mitgliederbereich · Alstercafé“
  const todoTotal = resTodo + ordTodo;
  document.title = (todoTotal ? `(${todoTotal}) ` : '') + 'Mitgliederbereich · Alstercafé';
  setBottomBadge('anfragen', resTodo);
  setBottomBadge('bestellungen', ordTodo);

  const board = document.getElementById('ov-board');
  if (!board) return;
  // Tastatur-Fokus merken (die Übersicht wird bei jeder Live-Änderung neu aufgebaut)
  const ae = document.activeElement && board.contains(document.activeElement) ? document.activeElement : null;
  const focusSel = !ae ? '' : ae.dataset.openId ? `#${ae.closest('.ov-day')?.id || 'ov-board'} [data-open-id="${CSS.escape(ae.dataset.openId)}"]`
    : ae.dataset.ovPrint ? `[data-ov-print="${CSS.escape(ae.dataset.ovPrint)}"]`
    : ae.classList.contains('ov-lunch') ? `#${ae.closest('.ov-day')?.id || 'ov-board'} .ov-lunch`
    : ae.dataset.ovGo ? `.ov-todo-item[data-ov-go="${ae.dataset.ovGo}"]` : '';
  const now = new Date();
  const todayIso = isoDate(now);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomIso = isoDate(tomorrow);
  const holidays = (() => { const l = window.alsterDb?.get('holidays'); return Array.isArray(l) ? l : []; })();
  const holOn = iso => holidays.find(h => h && h.date === iso) || null;
  const lunchToday = holOn(todayIso) ? null : lunchFor(now);
  const lunchTom = holOn(tomIso) ? null : lunchFor(tomorrow);

  // --- Zu tun ---
  const todo = [];
  if (resTodo) todo.push({ go: 'res', num: resTodo, text: resTodo === 1 ? 'neue Reservierung beantworten' : 'neue Reservierungen beantworten' });
  if (ordTodo) todo.push({ go: 'ord', num: ordTodo, text: ordTodo === 1 ? 'Bestellung bestätigen' : 'Bestellungen bestätigen' });
  if (lunchToday?.missing && now.getHours() < 15) todo.push({ go: 'week', text: 'Mittagstisch für heute fehlt' });
  if (lunchTom?.missing) todo.push({ go: 'week', text: 'Mittagstisch für morgen fehlt' });
  const todoList = document.getElementById('ov-todo-list');
  if (todoList) {
    todoList.innerHTML = todo.length
      ? todo.map(t => `<li><button type="button" class="ov-todo-item" data-ov-go="${t.go}">
          <span class="ov-todo-num${t.num ? '' : ' is-dot'}"${t.num ? '' : ' aria-hidden="true"'}>${t.num || ''}</span>
          <span class="ov-todo-text">${escapeHtml(t.text)}</span>
          <span class="ov-go" aria-hidden="true">→</span>
        </button></li>`).join('')
      : '<li class="ov-todo-empty"><svg class="ico ico-sm" aria-hidden="true"><use href="#i-check"/></svg> Alles erledigt – nichts zu tun.</li>';
    todoList.closest('.ov-todo')?.classList.toggle('is-clear', !todo.length);
  }

  // --- Heute und Morgen ---
  renderOverviewDay('today', todayIso, lunchToday, holOn(todayIso));
  renderOverviewDay('tomorrow', tomIso, lunchTom, holOn(tomIso));
  const tomTitle = document.getElementById('ov-tomorrow-title');
  if (tomTitle) tomTitle.innerHTML = `Morgen <span class="ov-title-date">${escapeHtml(tomorrow.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }))}</span>`;

  if (focusSel) (board.querySelector(focusSel) || board.querySelector('.ov-todo-item, .ov-lunch, .today-item'))?.focus({ preventScroll: true });

  if (!board.dataset.bound) {
    board.dataset.bound = '1';
    board.addEventListener('click', ev => {
      const open = ev.target.closest('[data-open-id]');
      if (open && open.dataset.openId) { openEntryCard(open.dataset.openKind, open.dataset.openId); return; }
      const pr = ev.target.closest('[data-ov-print]');
      if (pr) { printDayWithToast(pr.dataset.ovPrint); return; }
      const go = ev.target.closest('[data-ov-go]');
      if (!go) return;
      if (go.dataset.ovGo === 'res') {
        // „Neue Anfragen“ stehen dort ganz oben
        if (dom.anfragenSearch && dom.anfragenSearch.value) { dom.anfragenSearch.value = ''; renderAnfragen(); }
        switchTab('anfragen');
      } else if (go.dataset.ovGo === 'ord') {
        resetOrdersView();
        switchTab('bestellungen');
      } else {
        // immer die Woche zeigen, in der heute/morgen liegt – nicht eine zuvor aufgeblätterte
        if (!dirtyForms.has('menu-form')) {
          sundaySpillover = false;
          currentMonday = mondayOf(new Date());
          maybeEnableSundaySpillover();
        }
        switchTab('week');
      }
    });
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
      // kurz warten: der Klick, der das Feld verlässt (z. B. auf „Ändern“), soll seinen Knopf noch treffen
      a.addEventListener('blur', () => setTimeout(fn, 300), { once: true });
    }
    return true;
  }
  return false;
}

/* Reservierungen als einfacher Tagesplan. Zwei Fragen: „Wem muss ich antworten?“ (Neue Anfragen:
   Zusagen oder Absagen) und „Wer kommt wann?“ (Tagesplan der zugesagten Tische). Anrufe trägt der
   Inhaber mit „Reservierung eintragen“ selbst ein. Kein „Erledigt“: vergangene Tage rutschen von
   selbst nach unten. Gespeichert wird wie bisher – zugesagt heißt: Bestätigungs-Zeitpunkt gesetzt
   (oder früher als „erledigt“ markiert, damit alte Einträge richtig eingeordnet bleiben). */
const anfragenOpen = new Set();     // aufgeklappte Zeilen bleiben über jedes Neu-Rendern hinweg offen
const selfAddedRes = new Set();     // im Mitgliederbereich selbst eingetragen → zählt nie als „neue Anfrage“
const anfragenGroupOpen = { past: false };   // „Vergangene“ aufgeklappt?
/* Nach einer Aktion ordnet sich die Liste sofort neu – ein zweiter Tipp auf dieselbe Stelle träfe
   dann einen anderen Knopf. Deshalb zählt kurz danach kein weiterer Tipp auf einen Aktionsknopf. */
let anfragenActionAt = 0;
const anfragenTapGuard = () => Date.now() - anfragenActionAt < 700;
const resIsAccepted = (r) => !!(r && (r.confirmedAt || r.status === 'done'));
const RES_PERSONS = ['1 Person', '2 Personen', '3 Personen', '4 Personen', '5 Personen', '6 Personen', '7 Personen', '8 Personen', 'mehr als 8 Personen'];

function personsCount(p) {
  const str = String(p || '');
  if (/mehr als/i.test(str)) return { n: 9, plus: true };
  const m = str.match(/\d+/);
  return { n: m ? parseInt(m[0], 10) : 0, plus: false };
}
function personsLabel(p) {
  const str = String(p || '').trim();
  if (!str) return '';
  return /^\d+$/.test(str) ? `${str} ${Number(str) === 1 ? 'Person' : 'Personen'}` : str;
}
/* „2 Tische · 6 Personen“ (bei „mehr als 8“: „mind. …“) */
function tablesLabel(rows) {
  let n = 0, plus = false;
  rows.forEach(r => { const c = personsCount(r.persons); n += c.n; plus = plus || c.plus; });
  const t = `${rows.length} ${rows.length === 1 ? 'Tisch' : 'Tische'}`;
  return n ? `${t} · ${plus ? 'mind. ' : ''}${n} ${n === 1 ? 'Person' : 'Personen'}` : t;
}
function dayHead(iso) {
  if (!iso) return { lead: '', text: 'Ohne Datum' };
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return { lead: '', text: String(iso) };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  return {
    lead: diff === 0 ? 'Heute' : diff === 1 ? 'Morgen' : '',
    text: d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
  };
}
/* „Di., 10. Nov. · 12:00 Uhr“ */
function resWhenShort(r) {
  const d = r && r.date ? new Date(r.date + 'T00:00:00') : null;
  const day = d && !isNaN(d) ? d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }) : (r && r.date ? String(r.date) : 'Datum offen');
  return r && r.time ? `${day} · ${r.time} Uhr` : day;
}

function renderAnfragen() {
  if (deferRenderWhileTyping('anfragen-list', renderAnfragen)) return;
  const list = window.alsterDb?.get('reservations') || [];
  const items = Array.isArray(list) ? list : [];
  const newCount = items.filter(r => needsConfirm(r, 'date')).length;   // Zahl an Kachel und Reiter

  if (dom.anfragenBadge) {
    dom.anfragenBadge.hidden = newCount === 0;
    dom.anfragenBadge.textContent = newCount > 0 ? String(newCount) : '';
  }
  if (dom.tabAnfragenBadge) {
    dom.tabAnfragenBadge.hidden = newCount === 0;
    dom.tabAnfragenBadge.textContent = newCount > 0 ? String(newCount) : '';
  }
  if (dom.anfragenCount) dom.anfragenCount.hidden = true;
  if (!dom.anfragenList) return;

  // Fokus merken: nach dem Neu-Aufbau soll die Tastatur dort weitermachen, wo sie war
  const ae = document.activeElement;
  const focusRow = ae && dom.anfragenList.contains(ae) ? (ae.closest('[data-res-row]')?.dataset.resRow || '') : '';
  const hasQuery = !!(dom.anfragenSearch && dom.anfragenSearch.value.trim());

  if (items.length === 0) {
    dom.anfragenList.innerHTML = '<li class="anfragen-empty">Noch keine Reservierungen. Anfragen von der Webseite erscheinen hier von selbst – Anrufe tragen Sie oben mit „Reservierung eintragen“ ein.</li>';
    return;
  }
  const { upcoming, past } = splitByDate(items, dom.anfragenSearch?.value, 'date');
  const fresh = upcoming.filter(r => !resIsAccepted(r));   // wartet auf Antwort
  const plan = upcoming.filter(resIsAccepted);             // zugesagt

  let html = '';
  // 1 · Neue Anfragen
  if (fresh.length) {
    html += `<li class="res-block res-block-new">
      <h3 class="res-block-title">Neue Anfragen <span class="res-block-count">${fresh.length}</span></h3>
      <p class="res-block-sub">Bitte beantworten: zusagen oder absagen.</p>
      <ul class="res-new-list">${fresh.map(r => buildNewRequest(r)).join('')}</ul>
    </li>`;
  }
  // 2 · Tagesplan (splitByDate liefert schon nach Datum + Uhrzeit sortiert)
  const groups = [];
  plan.forEach(r => {
    const key = r.date || '';
    const g = groups.length && groups[groups.length - 1].iso === key ? groups[groups.length - 1] : (groups.push({ iso: key, rows: [] }), groups[groups.length - 1]);
    g.rows.push(r);
  });
  html += `<li class="res-block res-block-plan">
    <h3 class="res-block-title">Tagesplan</h3>
    ${groups.length ? groups.map(g => {
      const h = dayHead(g.iso);
      return `<div class="res-day">
        <div class="res-day-head">
          <h4 class="res-day-title">${h.lead ? `<span class="res-day-lead">${h.lead}</span> ` : ''}${escapeHtml(h.text)}</h4>
          <span class="res-day-sum">${escapeHtml(tablesLabel(g.rows))}</span>
          ${g.iso ? `<button type="button" class="res-day-print" data-print-day="${escapeAttr(g.iso)}"><svg class="ico ico-sm" aria-hidden="true"><use href="#i-print"/></svg> Liste drucken</button>` : ''}
        </div>
        <ul class="res-day-list">${g.rows.map(r => buildPlanRow(r)).join('')}</ul>
      </div>`;
    }).join('') : `<p class="anfragen-empty">${hasQuery ? 'Keine Treffer bei den kommenden Tischen.' : (fresh.length ? 'Noch nichts zugesagt.' : 'Keine kommenden Reservierungen.')}</p>`}
  </li>`;
  // 3 · Vergangene, eingeklappt
  if (past.length) {
    html += `<li class="anfragen-past"><details data-res-group="past"${hasQuery || anfragenGroupOpen.past ? ' open' : ''}>
      <summary>Vergangene (${past.length})</summary>
      <ul class="anfragen-sublist res-day-list">${past.map(r => buildPlanRow(r, { past: true })).join('')}</ul>
    </details></li>`;
  }
  dom.anfragenList.innerHTML = html;

  const on = (sel, fn) => dom.anfragenList.querySelectorAll(sel).forEach(el => el.addEventListener('click', () => fn(el)));
  on('[data-accept]', el => onAcceptRes(el.dataset.accept));
  on('[data-decline]', el => onDeclineRes(el.dataset.decline));
  on('[data-edit]', el => onEditRes(el.dataset.edit));
  on('[data-del]', el => onDeleteAnfrage(el.dataset.del));
  on('[data-confirm]', el => onSendConfirmation(el.dataset.confirm, 'reservation'));
  on('[data-print-day]', el => printDayWithToast(el.dataset.printDay));
  dom.anfragenList.querySelectorAll('[data-note]').forEach(t => t.addEventListener('change', () => onSaveAnfrageNote(t.dataset.note, t.value)));
  // Aufgeklappt bleibt aufgeklappt
  dom.anfragenList.querySelectorAll('details[data-res-id]').forEach(d => d.addEventListener('toggle', () => {
    if (d.open) anfragenOpen.add(d.dataset.resId); else anfragenOpen.delete(d.dataset.resId);
  }));
  // Bei der Suche ist „Vergangene“ nur vorübergehend offen – das soll den gemerkten Zustand nicht ändern
  if (!hasQuery) dom.anfragenList.querySelectorAll('details[data-res-group]').forEach(d => d.addEventListener('toggle', () => {
    anfragenGroupOpen[d.dataset.resGroup] = d.open;
  }));
  // Fokus zurück an den Eintrag (oder an „Vergangene“, wenn er dorthin gewandert und zugeklappt ist)
  if (focusRow) {
    const row = dom.anfragenList.querySelector(`[data-res-row="${CSS.escape(focusRow)}"]`);
    const grp = row?.closest('details[data-res-group]');
    const target = !row ? null : (grp && !grp.open) ? grp.querySelector(':scope > summary')
      : (row.querySelector(':scope > details > summary') || row.querySelector('button, a'));
    target?.focus({ preventScroll: true });
  }
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
/* „Zu bestätigen“: offen UND noch im Stand „Neu“. Diese Zahl steht an Kachel, Reiter, Handy-Leiste
   und im Browser-Tab – sie verschwindet, sobald alles bestätigt ist (passend zu „Zu tun“). */
function needsConfirm(it, dateKey) {
  return isOpenEntry(it, dateKey) && entryStage(it) === 'new';
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
function askPersonalMessage(email, ctype = 'order') {
  const word = ctype === 'reservation' ? 'Zusage' : 'Bestätigung';
  return new Promise(resolve => {
    const dlg = document.createElement('dialog');
    if (typeof dlg.showModal !== 'function') {
      // Sehr alte Browser ohne <dialog>: einfache Abfrage als Ersatz.
      const v = prompt(`${word} an ${email} senden.\n\nPersönliche Nachricht (optional, leer lassen für ohne):`, '');
      resolve(v === null ? null : v.trim().slice(0, PERSONAL_MESSAGE_MAX));
      return;
    }
    dlg.className = 'confirm-dialog';
    dlg.setAttribute('aria-labelledby', 'confirm-dialog-title');
    dlg.innerHTML = `
      <form method="dialog" class="confirm-dialog-form">
        <h3 class="confirm-dialog-title" id="confirm-dialog-title">${word} senden</h3>
        <p class="confirm-dialog-to">An: <strong>${escapeHtml(email)}</strong></p>
        <label class="confirm-dialog-label" for="confirm-dialog-msg">Persönliche Nachricht an den Gast <span>(optional)</span></label>
        <textarea id="confirm-dialog-msg" class="confirm-dialog-msg" rows="4" maxlength="${PERSONAL_MESSAGE_MAX}"
          placeholder="z. B. Wir haben Ihnen einen Tisch am Fenster reserviert."></textarea>
        <p class="confirm-dialog-hint">Bleibt das Feld leer, geht die ${word} ganz normal raus.</p>
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
function statusTagHtml(x, kind = 'order') {
  if (kind === 'res') {
    return resIsAccepted(x) ? '<span class="anfrage-tag is-stage-confirmed">Zugesagt</span>' : '<span class="anfrage-tag is-new">Neu</span>';
  }
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
const PHONE_OK_MARK = 'Telefonisch bestätigt';
/* Nur der von „Telefonisch bestätigt“ erzeugte Vermerk zählt („… am 10.11.“), nicht ein frei
   getippter Satz, in dem die Wörter zufällig vorkommen. */
const hasPhoneMark = (x) => /Telefonisch bestätigt am \d{2}\.\d{2}\./.test(String((x && x.note) || ''));
/* Verlauf an der Karte. Bestellungen: wie bisher „Bestätigung gesendet“. Reservierungen können auch
   telefonisch bestätigt sein; wie, steht nur im Vermerk der Notiz – fehlt er, steht neutral „Bestätigt“. */
function historyHtml(x, kind = 'order') {
  const rows = [];
  if (x.confirmedAt) {
    const label = kind !== 'res' ? 'Bestätigung gesendet' : (hasPhoneMark(x) ? 'Telefonisch zugesagt' : 'Zugesagt');
    rows.push(`<span class="anfrage-hist is-confirmed"><svg class="ico ico-sm" aria-hidden="true"><use href="#i-check"/></svg> ${label} · ${escapeHtml(formatStamp(x.confirmedAt))}</span>`);
  }
  if (kind !== 'res' && x.status === 'done' && x.doneAt) rows.push(`<span class="anfrage-hist is-done"><svg class="ico ico-sm" aria-hidden="true"><use href="#i-check"/></svg> Erledigt · ${escapeHtml(formatStamp(x.doneAt))}</span>`);
  return rows.join('');
}

const confirmSending = new Set();
async function onSendConfirmation(id, ctype, presetMessage) {
  if (confirmSending.has(id)) return; // läuft schon, kein Doppelversand
  const key = ctype === 'order' ? 'orders' : 'reservations';
  const list = window.alsterDb?.get(key) || [];
  const it = (Array.isArray(list) ? list : []).find(x => x.id === id);
  if (!it) return;
  if (!it.email) { showToast(`Für diese Anfrage ist keine E-Mail-Adresse hinterlegt – bitte telefonisch ${ctype === 'order' ? 'bestätigen' : 'zusagen'}.`, { tone: 'error' }); return; }
  const message = presetMessage !== undefined ? presetMessage : await askPersonalMessage(it.email, ctype);
  if (message === null) return; // abgebrochen

  const payload = ctype === 'order'
    ? { type: 'order', name: it.name, email: it.email, pickupDate: niceDate(it.pickupDate), pickupTime: it.pickupTime, total: it.totalCount, items: it.items }
    : { type: 'reservation', name: it.name, email: it.email, date: niceDate(it.date), time: it.time, persons: it.persons };
  if (message) payload.message = message;

  confirmSending.add(id);
  const btns = Array.from(document.querySelectorAll(`[data-confirm="${CSS.escape(id)}"], [data-accept="${CSS.escape(id)}"]`));
  const labels = btns.map(b => b.innerHTML);
  btns.forEach(b => { b.disabled = true; b.textContent = 'Wird gesendet …'; });
  let res;
  try { res = await window.alsterDb?.sendConfirmation(payload); }
  finally {
    confirmSending.delete(id);
    btns.forEach((b, i) => { b.disabled = false; b.innerHTML = labels[i]; });
  }
  if (res && res.ok) {
    const okMark = await window.alsterDb?.markConfirmed?.(key, id);
    if (ctype === 'order') { renderOrders(); showToast(`Bestätigung an ${it.email} gesendet`); }
    else { anfragenActionAt = Date.now(); renderAnfragen(); renderOverviewSummary(); showToast(`Zusage an ${it.email} gesendet`); }
    // Die E-Mail ist raus, aber der Vermerk ließ sich nicht speichern → sagen, sonst steht der Eintrag später wieder als „neu“ da
    if (okMark === false) warnWriteFailed();
  } else {
    askNotice(ctype === 'order' ? 'Bestätigung nicht gesendet' : 'Zusage nicht gesendet', 'Die E-Mail konnte nicht verschickt werden: ' + ((res && res.error) || 'unbekannter Fehler') +
      '. Bitte später erneut versuchen oder den Gast anrufen.');
  }
}

async function onSaveAnfrageNote(id, note) {
  const ok = await window.alsterDb?.updateReservationNote(id, note);
  if (ok === false) warnWriteFailed();
}

/* Neue Anfrage: alles Nötige steht offen da (wann, wer, wie viele, Nachricht, Kontakt) und es gibt
   genau zwei Knöpfe – Zusagen oder Absagen. */
function buildNewRequest(r) {
  const id = escapeAttr(r.id);
  const tel = r.phone ? `tel:${String(r.phone).replace(/\s+/g, '')}` : '';
  const rec = r.receivedAt ? formatRelative(new Date(r.receivedAt)) : '';
  const pers = personsLabel(r.persons);
  return `
    <li class="anfrage-item res-new${spotClass(r.id)}" data-res-row="${id}">
      <p class="res-new-when">${escapeHtml(resWhenShort(r))}${pickupBadgeHtml(r.date)}</p>
      <p class="res-new-who"><span class="anfrage-name">${escapeHtml(r.name || 'Ohne Namen')}</span>${pers ? `<span class="anfrage-pers">${escapeHtml(pers)}</span>` : ''}</p>
      ${r.message ? `<p class="anfrage-msg">${escapeHtml(r.message)}</p>` : ''}
      <div class="anfrage-contact">
        ${r.phone ? `<a href="${escapeAttr(tel)}">${escapeHtml(r.phone)}</a>` : ''}
        ${r.email ? `<span class="res-new-mail">${escapeHtml(r.email)}</span>` : '<span class="res-new-mail is-none">keine E-Mail angegeben</span>'}
      </div>
      <div class="res-new-actions">
        <button type="button" class="anfrage-btn res-btn-accept" data-accept="${id}" aria-label="${escapeAttr('Zusagen: ' + (r.name || 'Ohne Namen') + ', ' + resWhenShort(r))}">
          <svg class="ico ico-sm" aria-hidden="true"><use href="#i-check"/></svg>
          Zusagen
        </button>
        <button type="button" class="anfrage-btn res-btn-decline" data-decline="${id}" aria-label="${escapeAttr('Absagen: ' + (r.name || 'Ohne Namen') + ', ' + resWhenShort(r))}">Absagen</button>
        ${rec ? `<span class="res-new-rec">Eingegangen ${escapeHtml(rec)}</span>` : ''}
      </div>
    </li>
  `;
}

/* Zugesagter Tisch als Zeile im Tagesplan: Uhrzeit, Name, Personen und der Anfang von Notiz/Nachricht.
   Antippen zeigt Kontakt, Nachricht, Notiz sowie „Ändern“ und „Absagen“. */
function buildPlanRow(r, opts = {}) {
  const id = escapeAttr(r.id);
  const tel = r.phone ? `tel:${String(r.phone).replace(/\s+/g, '')}` : '';
  const mailSubject = encodeURIComponent(`Ihre Reservierung – Alstercafé`);
  const mailBody = encodeURIComponent(`Guten Tag ${r.name || ''},\n\n\n\nHerzliche Grüße\nAlstercafé`);
  const mailLink = r.email ? `mailto:${escapeAttr(encodeURIComponent(r.email).replace(/%40/g, '@'))}?subject=${mailSubject}&body=${mailBody}` : '';
  const isOpen = anfragenOpen.has(r.id) || (spotlight.id === r.id && Date.now() < spotlight.until);
  let when = r.time || '–';
  if (opts.past) {
    const d = r.date ? new Date(r.date + 'T00:00:00') : null;
    const short = d && !isNaN(d) ? d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }) : (r.date || 'Datum offen');
    when = r.time ? `${short} · ${r.time}` : short;
  }
  // Vorschau: die eigene Notiz zuerst, dann die Nachricht des Gastes
  const preview = [r.note ? 'Notiz: ' + r.note : '', r.message ? String(r.message) : ''].filter(Boolean).join(' · ');
  const pers = personsLabel(r.persons);
  const mailSent = !!r.confirmedAt && !hasPhoneMark(r);
  const rec = r.receivedAt ? formatRelative(new Date(r.receivedAt)) : '';
  const actions = opts.past
    ? `<button type="button" class="anfrage-btn anfrage-btn-del" data-del="${id}">
         <svg class="ico ico-sm" aria-hidden="true"><use href="#i-trash"/></svg>
         Entfernen
       </button>`
    : `<button type="button" class="anfrage-btn res-btn-edit" data-edit="${id}">Ändern</button>
       ${r.email ? `<button type="button" class="anfrage-btn anfrage-btn-confirm" data-confirm="${id}" data-ctype="reservation">
         <svg class="ico ico-sm" aria-hidden="true"><use href="#i-bell"/></svg>
         ${mailSent ? 'Zusage erneut senden' : 'Zusage per E-Mail senden'}
       </button>` : ''}
       <button type="button" class="anfrage-btn res-btn-decline" data-decline="${id}">Absagen</button>`;
  return `
    <li class="anfrage-item res-row${spotClass(r.id)}" data-res-row="${id}">
      <details class="res-details" data-res-id="${id}"${isOpen ? ' open' : ''}>
        <summary class="res-sum">
          <span class="res-time">${escapeHtml(when)}</span>
          <span class="res-main">
            <span class="res-who"><span class="anfrage-name">${escapeHtml(r.name || 'Ohne Namen')}</span>${pers ? `<span class="anfrage-pers">${escapeHtml(pers)}</span>` : ''}</span>
            ${preview ? `<span class="res-preview">${escapeHtml(preview)}</span>` : ''}
          </span>
          ${opts.past && !resIsAccepted(r) ? '<span class="anfrage-tag">unbeantwortet</span>' : ''}
          <span class="res-chev" aria-hidden="true"></span>
        </summary>
        <div class="res-body">
          <div class="anfrage-contact">
            ${r.phone ? `<a href="${escapeAttr(tel)}">${escapeHtml(r.phone)}</a>` : ''}
            ${r.email ? `<a href="${mailLink}">${escapeHtml(r.email)}</a>` : ''}
          </div>
          ${r.message ? `<p class="anfrage-msg">${escapeHtml(r.message)}</p>` : ''}
          <label class="anfrage-note">
            <span class="anfrage-note-label">Notiz (intern)</span>
            <textarea class="anfrage-note-input" data-note="${id}" rows="1" placeholder="z. B. Tisch am Fenster, Kinderstuhl …">${escapeHtml(r.note || '')}</textarea>
          </label>
          <div class="anfrage-meta">
            <span class="anfrage-rec">${rec ? 'Eingegangen ' + escapeHtml(rec) : ''}${historyHtml(r, 'res')}</span>
            <div class="anfrage-actions">${actions}</div>
          </div>
        </div>
      </details>
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

/* Fenster „Zusagen“ (Gast hat eine E-Mail-Adresse): Zusage senden – wahlweise mit persönlicher
   Nachricht – oder ohne E-Mail zusagen. Liefert { mail: true, message }, { mail: false } oder null. */
function askAccept(r) {
  return new Promise(resolve => {
    const dlg = document.createElement('dialog');
    if (typeof dlg.showModal !== 'function') {
      resolve(confirm(`Zusage per E-Mail an ${r.email} senden?`) ? { mail: true, message: '' } : null);
      return;
    }
    dlg.className = 'confirm-dialog';
    dlg.setAttribute('aria-labelledby', 'accept-dialog-title');
    dlg.innerHTML = `
      <form method="dialog" class="confirm-dialog-form">
        <h3 class="confirm-dialog-title" id="accept-dialog-title">Zusagen</h3>
        <p class="confirm-dialog-to">${escapeHtml(resWhenShort(r))}${r.persons ? ' · ' + escapeHtml(personsLabel(r.persons)) : ''}<br>An: <strong>${escapeHtml(r.email)}</strong></p>
        <label class="confirm-dialog-label" for="accept-dialog-msg">Persönliche Nachricht an den Gast <span>(freiwillig)</span></label>
        <textarea id="accept-dialog-msg" class="confirm-dialog-msg" rows="3" maxlength="${PERSONAL_MESSAGE_MAX}"
          placeholder="z. B. Wir haben Ihnen einen Tisch am Fenster reserviert."></textarea>
        <p class="confirm-dialog-hint">Der Gast bekommt die Zusage per E-Mail. Haben Sie schon telefoniert, genügt „Ohne E-Mail zusagen“.</p>
        <div class="confirm-dialog-actions">
          <button type="button" class="btn btn-link" data-act="cancel">Abbrechen</button>
          <button type="button" class="btn btn-link" data-act="nomail">Ohne E-Mail zusagen</button>
          <button type="submit" class="btn btn-primary" data-act="send">
            <svg class="ico ico-sm" aria-hidden="true"><use href="#i-bell"/></svg>
            Zusage senden
          </button>
        </div>
      </form>`;
    document.body.appendChild(dlg);
    const ta = dlg.querySelector('textarea');
    let result = null;
    const close = (val) => { result = val; dlg.close(); };
    dlg.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
    dlg.querySelector('[data-act="nomail"]').addEventListener('click', () => close({ mail: false }));
    dlg.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); close({ mail: true, message: ta.value.trim().slice(0, PERSONAL_MESSAGE_MAX) }); });
    dlg.addEventListener('cancel', () => { result = null; });
    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
    dlg.showModal();
    dlg.querySelector('[data-act="send"]').focus();
  });
}

/* Zusagen: mit E-Mail über das Fenster, ohne E-Mail genügt ein Tipp (Vermerk in der Notiz). */
async function onAcceptRes(id) {
  if (anfragenTapGuard()) return;
  const list = window.alsterDb?.get('reservations') || [];
  const it = (Array.isArray(list) ? list : []).find(r => r.id === id);
  if (!it || resIsAccepted(it)) return;
  if (!it.email) { await onPhoneConfirmed(id); return; }
  const choice = await askAccept(it);   // danach keine Tipp-Sperre mehr: die Antwort im Fenster ist eine bewusste Wahl
  if (!choice) return;
  if (choice.mail) await onSendConfirmation(id, 'reservation', choice.message);
  else await onPhoneConfirmed(id);
}

/* Absagen: Rückfrage mit dem Weg, dem Gast Bescheid zu sagen – dann wird die Reservierung entfernt. */
function askDecline(r) {
  return new Promise(resolve => {
    const dlg = document.createElement('dialog');
    if (typeof dlg.showModal !== 'function') { resolve(confirm('Reservierung absagen und aus der Liste nehmen?')); return; }
    const tel = r.phone ? `tel:${String(r.phone).replace(/\s+/g, '')}` : '';
    const subject = encodeURIComponent('Ihre Reservierungsanfrage – Alstercafé');
    const body = encodeURIComponent(`Guten Tag ${r.name || ''},\n\nvielen Dank für Ihre Anfrage. Leider können wir Ihnen am ${niceDate(r.date)}${r.time ? ' um ' + r.time + ' Uhr' : ''} keinen Tisch anbieten.\n\nHerzliche Grüße\nAlstercafé`);
    const mail = r.email ? `mailto:${escapeAttr(encodeURIComponent(r.email).replace(/%40/g, '@'))}?subject=${subject}&body=${body}` : '';
    dlg.className = 'confirm-dialog';
    dlg.setAttribute('aria-labelledby', 'decline-dialog-title');
    dlg.innerHTML = `
      <div class="confirm-dialog-form">
        <h3 class="confirm-dialog-title" id="decline-dialog-title">Absagen?</h3>
        <p class="confirm-dialog-to"><strong>${escapeHtml(r.name || 'Ohne Namen')}</strong> · ${escapeHtml(resWhenShort(r))}${r.persons ? ' · ' + escapeHtml(personsLabel(r.persons)) : ''}</p>
        <p class="confirm-dialog-hint">Die Reservierung wird aus der Liste genommen.${tel || mail ? ' Bitte sagen Sie dem Gast vorher Bescheid:' : ''}</p>
        ${tel || mail ? `<p class="res-decline-contact">
          ${tel ? `<a class="anfrage-btn" href="${escapeAttr(tel)}">${escapeHtml(r.phone)} anrufen</a>` : ''}
          ${mail ? `<a class="anfrage-btn" href="${mail}">E-Mail schreiben</a>` : ''}
        </p>` : ''}
        <div class="confirm-dialog-actions">
          <button type="button" class="btn btn-link" data-act="cancel">Abbrechen</button>
          <button type="button" class="btn btn-primary btn-danger" data-act="ok">Absagen und entfernen</button>
        </div>
      </div>`;
    document.body.appendChild(dlg);
    let result = false;
    dlg.querySelector('[data-act="cancel"]').addEventListener('click', () => { result = false; dlg.close(); });
    dlg.querySelector('[data-act="ok"]').addEventListener('click', () => { result = true; dlg.close(); });
    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
    dlg.showModal();
    dlg.querySelector('[data-act="cancel"]').focus();   // nie die Absage vorauswählen
  });
}
/* Nach dem Entfernen einer Zeile geht der Tastatur-Fokus an die Nachbarzeile (sonst an „Reservierung eintragen“). */
function resNeighborId(id) {
  const rows = Array.from(dom.anfragenList?.querySelectorAll('[data-res-row]') || []).filter(r => r.getClientRects().length);
  const i = rows.findIndex(r => r.dataset.resRow === id);
  return i < 0 ? '' : ((rows[i + 1] || rows[i - 1])?.dataset.resRow || '');
}
function focusAfterRemoval(neighborId) {
  if (document.activeElement && document.activeElement !== document.body) return;   // Fokus sitzt schon irgendwo Sinnvollem
  const row = neighborId ? dom.anfragenList?.querySelector(`[data-res-row="${CSS.escape(neighborId)}"]`) : null;
  const target = row && row.getClientRects().length
    ? (row.querySelector(':scope > details > summary') || row.querySelector('button, a'))
    : document.getElementById('anfragen-add');
  target?.focus({ preventScroll: true });
}
async function onDeclineRes(id) {
  if (anfragenTapGuard()) return;
  const list = window.alsterDb?.get('reservations') || [];
  const it = (Array.isArray(list) ? list : []).find(r => r.id === id);
  if (!it) return;
  if (!(await askDecline(it))) return;
  anfragenActionAt = Date.now();
  anfragenOpen.delete(id);
  const neighbor = resNeighborId(id);
  const pending = window.alsterDb?.deleteReservation(id);
  renderAnfragen();
  renderOverviewSummary();
  focusAfterRemoval(neighbor);
  const ok = await pending;
  if (ok === false) warnWriteFailed(); else { showToast('Abgesagt und entfernt'); logActivity('Reservierung abgesagt'); }
  await refreshAnfragen();
}

/* Fenster zum Eintragen (Anruf, Gast am Tresen) oder Ändern einer Reservierung.
   Liefert { date, time, persons, name, phone, note } oder null. */
function askReservationForm(existing) {
  return new Promise(resolve => {
    const dlg = document.createElement('dialog');
    if (typeof dlg.showModal !== 'function') { showToast('Dieses Gerät unterstützt das Eintragen hier leider nicht.', { tone: 'error' }); resolve(null); return; }
    const x = existing || {};
    const persons = RES_PERSONS.includes(x.persons) || !x.persons ? RES_PERSONS : [x.persons, ...RES_PERSONS];
    const selPersons = x.persons || '2 Personen';
    dlg.className = 'confirm-dialog res-form-dialog';
    dlg.setAttribute('aria-labelledby', 'res-form-title');
    dlg.innerHTML = `
      <form method="dialog" class="confirm-dialog-form res-form" novalidate>
        <h3 class="confirm-dialog-title" id="res-form-title">${existing ? 'Reservierung ändern' : 'Reservierung eintragen'}</h3>
        ${existing ? '' : '<p class="confirm-dialog-hint">Für Anrufe und Gäste am Tresen. Der Tisch steht danach sofort im Tagesplan.</p>'}
        <div class="res-form-row">
          <label class="res-form-field"><span>Datum</span><input type="date" name="date" required value="${escapeAttr(x.date || isoDate(new Date()))}"></label>
          <label class="res-form-field"><span>Uhrzeit</span><input type="time" name="time" required step="300" value="${escapeAttr(x.time || '')}"></label>
        </div>
        <label class="res-form-field"><span>Personen</span>
          <select name="persons" required>${persons.map(p => `<option value="${escapeAttr(p)}"${p === selPersons ? ' selected' : ''}>${escapeHtml(personsLabel(p))}</option>`).join('')}</select>
        </label>
        <label class="res-form-field"><span>Name</span><input type="text" name="name" required autocomplete="off" value="${escapeAttr(x.name || '')}"></label>
        <label class="res-form-field"><span>Telefon <em>(freiwillig)</em></span><input type="tel" name="phone" autocomplete="off" value="${escapeAttr(x.phone || '')}"></label>
        <label class="res-form-field"><span>Notiz <em>(freiwillig)</em></span><textarea name="note" rows="2" placeholder="z. B. Geburtstag, Kinderstuhl, Tisch am Fenster">${escapeHtml(x.note || '')}</textarea></label>
        <p class="res-form-error" role="alert" hidden></p>
        <div class="confirm-dialog-actions">
          <button type="button" class="btn btn-link" data-act="cancel">Abbrechen</button>
          <button type="submit" class="btn btn-primary" data-act="save">${existing ? 'Änderung speichern' : 'Eintragen'}</button>
        </div>
      </form>`;
    document.body.appendChild(dlg);
    const form = dlg.querySelector('form'), err = dlg.querySelector('.res-form-error');
    let result = null;
    dlg.querySelector('[data-act="cancel"]').addEventListener('click', () => { result = null; dlg.close(); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = Object.fromEntries(['date', 'time', 'persons', 'name', 'phone', 'note'].map(k => [k, String(form.elements[k].value || '').trim()]));
      const miss = !/^\d{4}-\d{2}-\d{2}$/.test(v.date) ? 'date' : !/^\d{2}:\d{2}$/.test(v.time) ? 'time' : !v.persons ? 'persons' : !v.name ? 'name' : '';
      if (miss) {
        err.textContent = { date: 'Bitte ein Datum wählen.', time: 'Bitte eine Uhrzeit eintragen.', persons: 'Bitte die Personenzahl wählen.', name: 'Bitte einen Namen eintragen.' }[miss];
        err.hidden = false;
        form.elements[miss].focus();
        return;
      }
      result = v; dlg.close();
    });
    dlg.addEventListener('cancel', () => { result = null; });
    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
    dlg.showModal();
    form.elements.time.focus();
  });
}

/* „Reservierung eintragen“: sofort als zugesagt im Tagesplan. */
async function onAddRes() {
  const v = await askReservationForm(null);
  if (!v) return;
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  selfAddedRes.add(id);   // die Live-Meldung „Neue Reservierung“ gilt nur für Anfragen von der Webseite
  // Zusage und Notiz gehen gleich mit: so steht der Eintrag nie – auch nicht kurz – unter „Neue Anfragen“
  const ok = await window.alsterDb?.addReservation({ id, name: v.name, phone: v.phone, email: '', date: v.date, time: v.time, persons: v.persons, message: '', status: 'new', confirmedAt: new Date().toISOString(), note: v.note });
  if (ok === false) { warnWriteFailed(); return; }
  // ältere Datenbank (ok === 'basic'): Zusage und Notiz einzeln nachtragen
  const ok2 = ok === 'basic' ? await window.alsterDb?.markConfirmed?.('reservations', id) : true;
  const ok3 = ok === 'basic' && v.note ? await window.alsterDb?.updateReservationNote(id, v.note) : true;
  await refreshAnfragen();
  if (ok2 === false || ok3 === false) warnWriteFailed();
  else { showToast('Reservierung eingetragen'); logActivity('Reservierung eingetragen'); }
  // die neue Zeile zeigen
  spotlight = { id, until: Date.now() + 2400 };
  const row = document.querySelector(`[data-res-row="${CSS.escape(id)}"]`);
  if (row) {
    // Nachtrag für einen vergangenen Tag: die Gruppe „Vergangene“ aufklappen, sonst sieht man ihn nicht
    const grp = row.closest('details[data-res-group]');
    if (grp && !grp.open) grp.open = true;
    row.classList.add('is-spotlit');
    row.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  }
}

/* „Ändern“: Datum, Uhrzeit, Personen, Name, Telefon, Notiz. */
async function onEditRes(id) {
  const list = window.alsterDb?.get('reservations') || [];
  const it = (Array.isArray(list) ? list : []).find(r => r.id === id);
  if (!it) return;
  const v = await askReservationForm(it);
  if (!v) return;
  const goneNotice = () => askNotice('Reservierung nicht mehr vorhanden', 'Diese Reservierung wurde inzwischen entfernt – die Änderung wurde nicht gespeichert.');
  const still = (window.alsterDb?.get('reservations') || []);
  if (!(Array.isArray(still) ? still : []).some(r => r.id === id)) { goneNotice(); return; }   // z. B. auf einem anderen Gerät abgesagt
  anfragenActionAt = Date.now();
  // db.js aktualisiert den Cache synchron beim Aufruf → erst aufrufen, dann sofort rendern.
  const p1 = window.alsterDb?.updateReservation?.(id, { date: v.date, time: v.time, persons: v.persons, name: v.name, phone: v.phone });
  const p2 = v.note !== String(it.note || '') ? window.alsterDb?.updateReservationNote(id, v.note) : true;
  renderAnfragen();
  renderOverviewSummary();
  const [a, b] = await Promise.all([p1, p2]);
  if (a === 'gone') goneNotice();
  else if (a === false || b === false || a === undefined) warnWriteFailed();
  else { showToast('Reservierung geändert'); logActivity('Reservierung geändert'); }
  await refreshAnfragen();
}

/* Ohne E-Mail zusagen (nach einem Anruf, oder wenn der Gast keine Adresse angegeben hat). Der Vermerk
   steht zusätzlich in der internen Notiz, damit später klar ist, wie zugesagt wurde. */
const phoneOkBusy = new Set();
async function onPhoneConfirmed(id) {
  if (phoneOkBusy.has(id)) return;
  const list = window.alsterDb?.get('reservations') || [];
  const it = (Array.isArray(list) ? list : []).find(r => r.id === id);
  if (!it || resIsAccepted(it)) return;
  phoneOkBusy.add(id);
  anfragenActionAt = Date.now();
  document.querySelectorAll(`[data-accept="${CSS.escape(id)}"]`).forEach(b => { b.disabled = true; });
  try {
    const stamp = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    // Erst der Vermerk: scheitert er, bleibt die Anfrage „Neu“ und der Knopf steht weiter bereit.
    if (!hasPhoneMark(it)) {
      const note = [String(it.note || '').trim(), `${PHONE_OK_MARK} am ${stamp}`].filter(Boolean).join(' · ');
      const okNote = await window.alsterDb?.updateReservationNote(id, note);
      if (okNote === false) { warnWriteFailed(); return; }
    }
    const ok = await window.alsterDb?.markConfirmed?.('reservations', id);
    anfragenActionAt = Date.now();   // die Liste ordnet sich jetzt neu
    renderAnfragen();
    renderOverviewSummary();
    if (ok === false) warnWriteFailed(); else showToast('Zugesagt – steht jetzt im Tagesplan');
  } finally {
    phoneOkBusy.delete(id);
    await refreshAnfragen();
  }
}

async function onDeleteAnfrage(id) {
  if (anfragenTapGuard()) return;
  if (!(await askConfirm('Die Reservierung wird dauerhaft aus der Liste entfernt.', { title: 'Reservierung entfernen?', ok: 'Entfernen' }))) return;
  anfragenOpen.delete(id);
  const neighbor = resNeighborId(id);
  const pending = window.alsterDb?.deleteReservation(id);
  renderAnfragen();
  focusAfterRemoval(neighbor);
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
  if (opts.icon === 'bell') el.insertAdjacentHTML('afterbegin', '<svg class="ico ico-sm toast-ico" aria-hidden="true"><use href="#i-bell"/></svg>');
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
  showToast(msg, { duration: 9000, icon: 'bell', onClick: () => switchTab(key === 'reservations' ? 'anfragen' : 'bestellungen') });
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
  const newCount = items.filter(o => needsConfirm(o, 'pickupDate')).length;   // Zahl an Kachel und Reiter

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
  const kind = document.querySelector('#orders-filter .is-active')?.dataset.kind || 'all';
  const isB = o => Array.isArray(o.items) && o.items.some(it => it && it.kind === 'berliner');
  const kindItems = kind === 'berliner' ? items.filter(isB) : kind === 'broetchen' ? items.filter(o => !isB(o)) : items;
  const { upcoming, past } = splitByDate(kindItems, dom.ordersSearch?.value, 'pickupDate');
  const openUp = upcoming.filter(o => o.status !== 'done'), doneUp = upcoming.filter(o => o.status === 'done');
  let html = openUp.length
    ? openUp.map(o => buildOrderItem(o)).join('')
    : `<li class="orders-empty">${hasQuery ? 'Keine Treffer bei den kommenden Bestellungen.' : (doneUp.length ? 'Alles erledigt – keine offenen Bestellungen.' : 'Keine kommenden Bestellungen.')}</li>`;
  if (doneUp.length) {
    const wasOpenDone = !!dom.ordersList.querySelector('.anfragen-done details')?.open;
    html += `<li class="anfragen-past anfragen-done"><details${hasQuery || wasOpenDone ? ' open' : ''}>
      <summary>Erledigt (${doneUp.length})</summary>
      <ul class="anfragen-sublist">${doneUp.map(o => buildOrderItem(o)).join('')}</ul>
    </details></li>`;
  }
  if (past.length) {
    const wasOpen = !!dom.ordersList.querySelector('.anfragen-past:not(.anfragen-done) details')?.open;
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
  try { renderBerlinerBake(); } catch {}
}

async function onDeleteOrder(id) {
  if (!(await askConfirm('Die Bestellung wird dauerhaft gelöscht. Tipp: „Als erledigt markieren“ behält sie im Verlauf.', { title: 'Bestellung löschen?', ok: 'Löschen' }))) return;
  const pending = window.alsterDb?.deleteOrder(id);
  renderOrders();
  const ok = await pending;
  if (ok === false) warnWriteFailed();
  await refreshOrders();
  try { renderBerlinerBake(); } catch {}
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
   ['berliner-title', 'title'], ['berliner-text', 'text'],
   ['berliner-min', 'minQty'], ['berliner-time-from', 'pickupTimeFrom'], ['berliner-time-to', 'pickupTimeTo']].forEach(([id, k]) => {
    if (bEl(id)) bEl(id).value = st[k] || '';
  });
  if (bEl('berliner-lead')) bEl('berliner-lead').value = String(berlinerLeadDays(st));
  if (bEl('berliner-announce')) bEl('berliner-announce').value = String([7, 14].includes(parseInt(st.announceDays, 10)) ? parseInt(st.announceDays, 10) : 0);
  updateBerlinerLive(st);
  renderBerlinerChecklist(st);
  renderBerlinerBake();
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
  const { phase } = berlinerLiveState(st);
  if (badge) { badge.hidden = !(phase === 'live' || phase === 'planned'); badge.textContent = phase === 'live' ? 'läuft' : 'geplant'; }
  const desc = bEl('overview-berliner-desc');
  if (desc) {
    const n = berlinerOrders(false).length;
    desc.textContent = phase === 'live' ? `Läuft${st.pickupTo ? ' · Abholung bis ' + fmtIsoDe(st.pickupTo) : ''}${n ? ` · ${n} offene Bestellung${n > 1 ? 'en' : ''}` : ''}`
      : phase === 'planned' ? `Geplant – ab ${fmtIsoDe(st.orderFrom)} auf der Webseite`
      : phase === 'over' ? 'Beendet – Sorten, Zeitraum und Einschalten für die nächste Aktion'
      : 'Aktion an/aus, Zeitraum und Sorten';
  }
}
/* Eine Quelle für „ist die Aktion gerade auf der Webseite?“ – Anzeige und Speichern-Meldung */
function getWeekHoursAdmin() {
  try {
    const rows = window.alsterDb?.get('hours');
    if (Array.isArray(rows) && rows.length && window.AlsterRules) return window.AlsterRules.checkHours(rows).week;
  } catch {}
  return null; // keine eigenen Zeiten → Standard (alle Tage offen) → keine Warnung
}
function berlinerLeadDays(st) {
  const n = parseInt(st && st.leadDays, 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 7) : 1;
}
function addDaysIsoAdmin(iso, n) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(+m[1], +m[2] - 1, +m[3]); d.setDate(d.getDate() + n);
  return isoDate(d);
}
function berlinerLiveState(st) {
  const today = todayIso();
  const lead = berlinerLeadDays(st);
  let msg, live = false, phase = 'off';
  if (!st.active) { msg = 'Aus — nur hier im Mitgliederbereich, auf der Webseite nicht sichtbar.'; }
  else if (st.orderFrom && today < st.orderFrom) {
    phase = 'planned';
    const n = [7, 14].includes(parseInt(st.announceDays, 10)) ? parseInt(st.announceDays, 10) : 0;
    const announceFrom = n ? addDaysIsoAdmin(st.orderFrom, -n) : '';
    msg = n
      ? (announceFrom <= today
          ? `Geplant — Vorankündigung läuft auf der Startseite („Vorbestellbar ab ${fmtIsoDe(st.orderFrom)}“), bestellbar ab ${fmtIsoDe(st.orderFrom)}.`
          : `Geplant — Vorankündigung ab ${fmtIsoDe(announceFrom)}, bestellbar ab ${fmtIsoDe(st.orderFrom)}.`)
      : `Geplant — erscheint ab ${fmtIsoDe(st.orderFrom)} auf der Webseite.`;
  }
  else if (st.orderTo && today > st.orderTo) { phase = 'over'; msg = `Beendet — Bestellzeitraum ist am ${fmtIsoDe(st.orderTo)} abgelaufen, nicht mehr sichtbar.`; }
  else if (st.pickupTo && today > st.pickupTo) { phase = 'over'; msg = `Beendet — letzter Abholtag war der ${fmtIsoDe(st.pickupTo)}, nicht mehr sichtbar.`; }
  else if (st.pickupTo && lead > 0 && addDaysIsoAdmin(today, lead) > st.pickupTo) { phase = 'over'; msg = `Beendet — mit ${lead} Tag${lead > 1 ? 'en' : ''} Vorlauf ist kein Abholtag mehr erreichbar (letzter: ${fmtIsoDe(st.pickupTo)}).`; }
  else {
    live = true; phase = 'live';
    const until = st.orderTo ? `bestellbar bis ${fmtIsoDe(st.orderTo)}` : (st.pickupTo ? `bestellbar bis ${fmtIsoDe(addDaysIsoAdmin(st.pickupTo, -lead))}` : 'ohne Ende');
    const pick = (st.pickupFrom || st.pickupTo) ? `Abholung ${fmtIsoDe(st.pickupFrom || st.pickupTo)}${st.pickupTo && st.pickupTo !== (st.pickupFrom || st.pickupTo) ? ` bis ${fmtIsoDe(st.pickupTo)}` : ''}` : 'Abholung jederzeit';
    msg = `Läuft — ${until} · ${pick}. Menüpunkt, Startseiten-Hinweis und Formular sind sichtbar.`;
  }
  return { msg, live, phase };
}
/* Alle Berliner-Bestellungen (nicht gelöscht); optional ohne Erledigte */
function berlinerOrders(includeDone) {
  const list = window.alsterDb?.get('orders') || [];
  return (Array.isArray(list) ? list : []).filter(o => Array.isArray(o.items) && o.items.some(it => it && it.kind === 'berliner') && (includeDone || o.status !== 'done'));
}
function berlinerTotals(orders) {
  return orders.reduce((s, o) => s + (o.items || []).filter(it => it && it.kind === 'berliner').reduce((t, it) => t + (parseInt(it.qty, 10) || 0), 0), 0);
}
/* Vorab-Prüfung: Pflichtpunkte (blockieren das Einschalten) und Hinweise */
function berlinerChecklist(st, items) {
  const out = [];
  const today = todayIso();
  const ok = (text) => out.push({ ok: true, text });
  const warn = (text) => out.push({ ok: false, warn: true, text });
  const fail = (text) => out.push({ ok: false, text });
  const named = (items || []).filter(it => it && it.name);
  if (named.length) ok(`${named.length} Sorte${named.length > 1 ? 'n' : ''} eingetragen`); else fail('Noch keine Sorte eingetragen (Schritt 1)');
  const noPrice = named.filter(it => !it.price).length;
  if (named.length && noPrice) warn(`${noPrice} Sorte${noPrice > 1 ? 'n' : ''} ohne Preis – Kunden sehen dann keine Summe`); else if (named.length) ok('Alle Sorten mit Preis');
  if (!st.pickupFrom && !st.pickupTo) fail('Abholzeitraum fehlt (Schritt 2: „Abholung von/bis“)');
  else if (st.pickupTo && st.pickupTo < today) fail(`Abholzeitraum liegt in der Vergangenheit (bis ${fmtIsoDe(st.pickupTo)})`);
  else {
    // Schließtage im Abholzeitraum
    const hol = (window.alsterDb?.get('holidays') || []).filter(h => h && h.date);
    const from = st.pickupFrom || st.pickupTo, to = st.pickupTo || st.pickupFrom;
    const closed = [], open = [];
    let d = from;
    for (let i = 0; i < 62 && d <= to; i++) {
      const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const date = new Date(+m[1], +m[2] - 1, +m[3]);
      const h = hol.find(x => x.date === d);
      const week = (typeof getWeekHoursAdmin === 'function') ? getWeekHoursAdmin() : null;
      const dayOpen = week ? !!week[(date.getDay() + 6) % 7] : true;
      if (h || !dayOpen) closed.push(fmtIsoDe(d).slice(0, 6) + (h && h.label ? ` (${h.label})` : h ? ' (Schließtag)' : ' (Ruhetag)')); else open.push(d);
      d = addDaysIsoAdmin(d, 1);
    }
    if (!open.length) fail(`An allen Abholtagen ist geschlossen (${closed.join(', ')}) – so kann niemand abholen`);
    else if (closed.length) warn(`Keine Abholung am ${closed.join(', ')} – die übrigen Tage sind buchbar`);
    else ok(`Abholung ${fmtIsoDe(from)}${to !== from ? ` bis ${fmtIsoDe(to)}` : ''} – alle Tage geöffnet`);
  }
  const lead = berlinerLeadDays(st);
  if (st.orderTo && st.pickupTo && st.orderTo > st.pickupTo) warn(`„Bestellbar bis“ (${fmtIsoDe(st.orderTo)}) liegt nach dem letzten Abholtag – die Aktion endet automatisch mit dem Abholtag`);
  if (st.pickupTo && st.pickupFrom && lead > 0 && addDaysIsoAdmin(st.pickupFrom, -lead) < today && addDaysIsoAdmin(today, lead) > st.pickupTo) fail(`Mit ${lead} Tag${lead > 1 ? 'en' : ''} Vorlauf ist kein Abholtag mehr erreichbar`);
  else ok(lead ? `Bestellvorlauf: ${lead} Tag${lead > 1 ? 'e' : ''} vorher` : 'Bestellung am Abholtag möglich');
  if (st.pickupTimeFrom && st.pickupTimeTo && st.pickupTimeFrom >= st.pickupTimeTo) fail('Abholzeit „von“ liegt nicht vor „bis“');
  if (!(st.title || '').trim()) warn('Keine Überschrift – die Webseite nutzt „Berliner für Silvester vorbestellen“');
  return out;
}
const CHK_OK = '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHK_WARN = '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M12 6v8M12 18v.01" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
const CHK_FAIL = '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
function renderBerlinerChecklist(st) {
  const ul = bEl('berliner-checklist');
  if (!ul) return;
  const items = window.alsterDb?.get('berliner-items');
  const list = berlinerChecklist(st, Array.isArray(items) && items.length ? items : DEFAULT_BERLINER);
  ul.innerHTML = list.map(x => `<li class="${x.ok ? 'is-ok' : x.warn ? 'is-warn' : 'is-fail'}"><span class="chk-ico" aria-hidden="true">${x.ok ? CHK_OK : x.warn ? CHK_WARN : CHK_FAIL}</span>${escapeHtml(x.text)}</li>`).join('');
  const blocked = list.some(x => !x.ok && !x.warn);
  const sw = bEl('berliner-switch'), hint = bEl('berliner-switch-hint');
  if (sw && !st.active) sw.disabled = blocked;
  if (hint) hint.textContent = st.active ? 'Die Aktion ist eingeschaltet. Derselbe Knopf schaltet sie wieder aus.' : (blocked ? 'Einschalten ist erst möglich, wenn die rot markierten Punkte behoben sind.' : 'Alles bereit – mit einem Tipp erscheint die Aktion auf der Webseite.');
}
/* Backliste: Abholtag × Sorte → Stück */
function berlinerBakeData() {
  const includeDone = !!bEl('berliner-include-done')?.checked;
  const orders = berlinerOrders(includeDone);
  const sorts = [], days = {};
  orders.forEach(o => {
    const day = o.pickupDate || 'ohne Datum';
    days[day] = days[day] || { total: 0, by: {}, orders: 0 };
    days[day].orders++;
    (o.items || []).filter(it => it && it.kind === 'berliner').forEach(it => {
      const q = parseInt(it.qty, 10) || 0; if (!q) return;
      if (!sorts.includes(it.name)) sorts.push(it.name);
      days[day].by[it.name] = (days[day].by[it.name] || 0) + q;
      days[day].total += q;
    });
  });
  return { sorts, days: Object.keys(days).sort().map(d => ({ date: d, ...days[d] })), orders: orders.length, total: berlinerTotals(orders) };
}
function renderBerlinerBake() {
  const el = bEl('berliner-bake');
  if (!el) return;
  const { sorts, days, orders, total } = berlinerBakeData();
  const num = bEl('berliner-numbers');
  if (num) num.textContent = orders ? `${orders} Bestellung${orders > 1 ? 'en' : ''} · ${total} Berliner` : 'Noch keine Bestellungen.';
  if (!days.length) { el.innerHTML = '<p class="berliner-bake-empty">Sobald Bestellungen eingehen, steht hier die Stückzahl je Sorte und Abholtag.</p>'; return; }
  const head = `<tr><th>Abholtag</th>${sorts.map(s => `<th>${escapeHtml(s)}</th>`).join('')}<th>Gesamt</th></tr>`;
  const rows = days.map(d => `<tr><td>${escapeHtml(d.date === 'ohne Datum' ? d.date : `${fmtIsoDe(d.date)} (${d.orders})`)}</td>${sorts.map(s => `<td>${d.by[s] || '–'}</td>`).join('')}<td><strong>${d.total}</strong></td></tr>`).join('');
  const sum = `<tr class="is-sum"><td>Gesamt</td>${sorts.map(s => `<td>${days.reduce((t, d) => t + (d.by[s] || 0), 0)}</td>`).join('')}<td><strong>${total}</strong></td></tr>`;
  el.innerHTML = `<div class="berliner-bake-scroll"><table class="berliner-bake-table">${head}${rows}${sum}</table></div>`;
}
function printBerlinerBake() {
  const { sorts, days, orders, total } = berlinerBakeData();
  if (!days.length) { showToast('Noch keine Berliner-Bestellungen.'); return; }
  const includeDone = !!bEl('berliner-include-done')?.checked;
  const orderRows = berlinerOrders(includeDone).sort((a, b) => ((a.pickupDate || '') + (a.pickupTime || '')).localeCompare((b.pickupDate || '') + (b.pickupTime || '')))
    .map(o => `<tr><td>${escapeHtml(fmtIsoDe(o.pickupDate) || '–')} ${escapeHtml(o.pickupTime || '')}</td><td>${escapeHtml(o.name || '')}</td><td>${(o.items || []).filter(it => it && it.kind === 'berliner').map(it => `${parseInt(it.qty, 10) || 0}× ${escapeHtml(it.name || '')}`).join(', ')}</td><td>${o.status === 'done' ? 'erledigt' : (o.confirmedAt ? 'bestätigt' : 'neu')}</td></tr>`).join('');
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Backliste Berliner</title>
<style>body{font:14px/1.45 -apple-system,Segoe UI,Arial,sans-serif;color:#222;margin:28px}h1{font-size:22px;margin:0 0 4px}p{margin:0 0 18px;color:#555}table{border-collapse:collapse;width:100%;margin-bottom:26px}th,td{border:1px solid #bbb;padding:7px 9px;text-align:left}th{background:#f3eee4}td:not(:first-child),th:not(:first-child){text-align:right}.is-sum td{font-weight:700;background:#faf6ef}.orders td:nth-child(3){text-align:left}.orders td:last-child{text-align:left}@media print{body{margin:12mm}}</style></head><body>
<h1>Backliste Berliner</h1><p>Stand ${new Date().toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })} · ${orders} Bestellungen · ${total} Berliner${includeDone ? ' (inkl. erledigte)' : ''}</p>
<table><tr><th>Abholtag</th>${sorts.map(s => `<th>${escapeHtml(s)}</th>`).join('')}<th>Gesamt</th></tr>
${days.map(d => `<tr><td>${escapeHtml(d.date === 'ohne Datum' ? d.date : fmtIsoDe(d.date))}</td>${sorts.map(s => `<td>${d.by[s] || '–'}</td>`).join('')}<td>${d.total}</td></tr>`).join('')}
<tr class="is-sum"><td>Gesamt</td>${sorts.map(s => `<td>${days.reduce((t, d) => t + (d.by[s] || 0), 0)}</td>`).join('')}<td>${total}</td></tr></table>
<h1 style="font-size:17px">Einzelne Bestellungen</h1>
<table class="orders"><tr><th>Abholung</th><th>Name</th><th>Bestellung</th><th>Status</th></tr>${orderRows}</table>
</body></html>`;
  printHtmlDocument(html, bEl('berliner-items-status'));
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
  if (next) {
    const items = window.alsterDb?.get('berliner-items');
    const blocked = berlinerChecklist(window.alsterDb?.get('berliner-settings') || {}, Array.isArray(items) && items.length ? items : DEFAULT_BERLINER).some(x => !x.ok && !x.warn);
    if (blocked) { showToast('Bitte zuerst die rot markierten Punkte beheben.', { tone: 'error' }); return; }
  }
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

function readBerlinerForm() {
  return {
    active:     !!bEl('berliner-active')?.checked,
    orderFrom:  bEl('berliner-order-from')?.value || '', orderTo: bEl('berliner-order-to')?.value || '',
    pickupFrom: bEl('berliner-pickup-from')?.value || '', pickupTo: bEl('berliner-pickup-to')?.value || '',
    title: (bEl('berliner-title')?.value || '').trim(), text: (bEl('berliner-text')?.value || '').trim(),
    leadDays: parseInt(bEl('berliner-lead')?.value, 10) || 0, minQty: (bEl('berliner-min')?.value || '').trim(),
    pickupTimeFrom: bEl('berliner-time-from')?.value || '', pickupTimeTo: bEl('berliner-time-to')?.value || '',
    announceDays: parseInt(bEl('berliner-announce')?.value, 10) || 0
  };
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
    text:       (bEl('berliner-text')?.value || '').trim().slice(0, 300),
    leadDays:   Math.max(0, Math.min(7, parseInt(bEl('berliner-lead')?.value, 10) || 0)),
    minQty:     (bEl('berliner-min')?.value || '').trim(),
    pickupTimeFrom: bEl('berliner-time-from')?.value || '',
    pickupTimeTo:   bEl('berliner-time-to')?.value || '',
    announceDays:   [7, 14].includes(parseInt(bEl('berliner-announce')?.value, 10)) ? parseInt(bEl('berliner-announce').value, 10) : 0
  };
  const status = bEl('berliner-settings-status');
  if (st.minQty && !/^\d{1,3}$/.test(st.minQty)) { setStatus(status, 'Mindestmenge: bitte eine ganze Zahl (z. B. 6) oder leer lassen.', 'error'); return false; }
  if (st.minQty === '0') st.minQty = '';
  if (st.pickupTimeFrom && st.pickupTimeTo && st.pickupTimeFrom >= st.pickupTimeTo) { setStatus(status, 'Abholzeit „von“ muss vor „bis“ liegen.', 'error'); return false; }
  if (st.pickupTo && st.leadDays > 0 && addDaysIsoAdmin(todayIso(), st.leadDays) > st.pickupTo && (!st.orderFrom || st.orderFrom <= todayIso())) {
    setStatus(status, `Mit ${st.leadDays} Tag${st.leadDays > 1 ? 'en' : ''} Vorlauf ist der letzte Abholtag (${fmtIsoDe(st.pickupTo)}) nicht mehr erreichbar.`, 'error'); return false;
  }
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
  renderBerlinerChecklist(st);
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
  renderBerlinerChecklist(window.alsterDb?.get('berliner-settings') || {});
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
  const t0 = performance.now(), dur = 450;
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
