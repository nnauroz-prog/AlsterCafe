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
    if (window.alsterDb) await window.alsterDb.ready();
    if (await isAuthenticated()) await showDashboard();
    else showLogin();
  } catch (err) {
    console.error('Admin-Init fehlgeschlagen, zeige Login:', err);
    showLogin();
  }
  document.body.classList.add('is-ready');

  // Login
  dom.loginForm.addEventListener('submit', onLogin);
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

  // Wochenplan
  dom.menuForm.addEventListener('submit', onSaveWeek);
  dom.weekPrev.addEventListener('click', () => changeWeek(-7));
  dom.weekNext.addEventListener('click', () => changeWeek(7));
  dom.weekToday.addEventListener('click', () => {
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
  dom.noticeForm.addEventListener('submit', onSaveNotice);
  dom.noticeClear.addEventListener('click', onClearNotice);

  // Speisekarte
  dom.menuCardsForm.addEventListener('submit', onSaveMenu);
  dom.menuReset.addEventListener('click', onResetMenu);
  dom.menuAddSection?.addEventListener('click', () => addMenuSection());
  dom.menuPdf?.addEventListener('click', downloadMenuPdf);

  // Öffnungszeiten
  dom.hoursForm.addEventListener('submit', onSaveHours);
  dom.hoursAdd.addEventListener('click', () => addHourRow());
  dom.hoursReset.addEventListener('click', onResetHours);

  // Brötchen-Sorten
  dom.broetchenForm?.addEventListener('submit', onSaveBroetchen);
  dom.broetchenAdd?.addEventListener('click', () => addBroetchenRow());
  dom.broetchenReset?.addEventListener('click', onResetBroetchen);

  // Account
  dom.resetAll.addEventListener('click', onResetAll);
  document.getElementById('reset-content')?.addEventListener('click', onResetContent);
  dom.passwordForm?.addEventListener('submit', onChangePassword);
  dom.inviteForm?.addEventListener('submit', onInviteUser);

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
    hoursStatus:  document.getElementById('hours-status'),
    hoursReset:   document.getElementById('hours-reset'),
    // Account
    resetAll:     document.getElementById('reset-all'),
    accountEmail: document.getElementById('account-email'),
    passwordForm: document.getElementById('password-form'),
    newPassword:  document.getElementById('new-password'),
    newPasswordConfirm: document.getElementById('new-password-confirm'),
    passwordStatus: document.getElementById('password-status'),
    inviteForm:   document.getElementById('invite-form'),
    inviteEmail:  document.getElementById('invite-email'),
    invitePassword: document.getElementById('invite-password'),
    inviteStatus: document.getElementById('invite-status'),
    userList:     document.getElementById('user-list'),
    year:         document.getElementById('year'),
    // Overview / Workspace
    overviewView: document.getElementById('overview-view'),
    workspaceView: document.getElementById('workspace-view'),
    overviewCards: document.querySelectorAll('.overview-card[data-tab]'),
    backToOverview: document.getElementById('back-to-overview'),
    // Anfragen
    anfragenList:  document.getElementById('anfragen-list'),
    anfragenCount: document.getElementById('anfragen-count'),
    anfragenBadge: document.getElementById('overview-anfragen-badge'),
    tabAnfragenBadge: document.getElementById('tab-anfragen-badge'),
    // Bestellungen (belegte Brötchen)
    ordersList:    document.getElementById('orders-list'),
    ordersCount:   document.getElementById('orders-count'),
    ordersBadge:   document.getElementById('overview-orders-badge'),
    tabOrdersBadge: document.getElementById('tab-orders-badge'),
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
  await window.alsterDb.auth.signOut();
  showLogin();
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
  await renderUserList();
  // Default-Landing: Overview. Tab-Inhalte werden lazy beim Klick aktiv.
  showOverview();
  renderWeek();
  renderNotice();
  renderMenuEditor();
  renderHoursEditor();
  renderDesignEditor();
  renderActivityLog();
  renderBroetchenEditor();
  refreshAnfragen();
  refreshOrders();
  // Live-Update wenn ueber das oeffentliche Formular etwas reinkommt
  window.alsterDb?.subscribe?.((key) => {
    if (key === 'reservations') refreshAnfragen();
    if (key === 'orders') refreshOrders();
  });
}

/* ---------- Tabs ---------- */

function showOverview() {
  if (dom.overviewView) dom.overviewView.hidden = false;
  if (dom.workspaceView) dom.workspaceView.hidden = true;
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
}

function switchTab(name) {
  const apply = () => {
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
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
    // Beim Wechsel auf Mittagsmenue: heutigen Tag in den Sichtbereich
    // rollen (renderWeek hat diese Logik gegen das Flag).
    if (name === 'week') { pendingScrollOnRender = true; renderWeek(); }
  };
  // Smooth Tab-Wechsel via View-Transitions API (Chromium); Fallback: direkt
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.startViewTransition(apply);
  } else {
    apply();
  }
}

/* ---------- Wochenplan ---------- */

function changeWeek(deltaDays) {
  sundaySpillover = false; // Manueller Wochen-Wechsel deaktiviert Spillover
  const d = new Date(currentMonday);
  d.setDate(d.getDate() + deltaDays);
  currentMonday = mondayOf(d);
  pendingScrollOnRender = true;
  renderWeek();
}

function onResetWeek() {
  if (!confirm('Möchten Sie alle Eingaben für diese Woche entfernen?')) return;
  const all = loadAll();
  delete all[isoDate(currentMonday)];
  saveAll(all);
  renderWeek();
  setStatus(dom.saveStatus, 'Woche zurückgesetzt.', 'ok');
}

function onCopyFromPrevious() {
  const prevMonday = new Date(currentMonday);
  prevMonday.setDate(prevMonday.getDate() - 7);
  const all = loadAll();
  const prev = all[isoDate(prevMonday)];
  if (!prev || !prev.days || !Object.keys(prev.days).length) {
    setStatus(dom.saveStatus, 'Keine Daten in der Vorwoche gefunden.', 'error');
    return;
  }
  if (!confirm('Eintraege der Vorwoche in die aktuelle Woche kopieren?')) return;
  all[isoDate(currentMonday)] = {
    weekStart: isoDate(currentMonday),
    updatedAt: new Date().toISOString(),
    days: JSON.parse(JSON.stringify(prev.days))
  };
  saveAll(all);
  renderWeek();
  setStatus(dom.saveStatus, 'Vorwoche kopiert. Bitte ggf. anpassen und speichern.', 'ok');
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

function onSaveWeek(e) {
  e.preventDefault();
  const all = loadAll();

  // Aktuelle Woche aus den 7 Standard-Karten lesen
  const week = readFormToWeek();
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
    const closed = data.get('spillover-sun-closed') === 'on';
    const today = new Date();
    const prevMonday = mondayOf(new Date(today.getTime() - 7 * 86400000));
    const prevKey = isoDate(prevMonday);
    const prevWeek = all[prevKey] || { weekStart: prevKey, days: {} };
    if (dish || side || closed) {
      prevWeek.days = prevWeek.days || {};
      prevWeek.days.sun = { dish, side, closed };
      prevWeek.updatedAt = new Date().toISOString();
      all[prevKey] = prevWeek;
    }
  }

  saveAll(all);
  renderWeek();
  setStatus(dom.saveStatus, `Gespeichert · ${formatTime(new Date())}`, 'ok');
  if (typeof logActivity === 'function') logActivity('Wochenplan gespeichert');
}

function renderWeek() {
  const weekKw = isoWeek(currentMonday);
  const sunday = new Date(currentMonday); sunday.setDate(sunday.getDate() + 6);
  dom.weekKw.textContent = sundaySpillover ? `Heute + KW ${weekKw}` : `KW ${weekKw}`;
  dom.weekRange.textContent = `${formatShort(currentMonday)} – ${formatShort(sunday)}`;

  const all = loadAll();
  const stored = all[isoDate(currentMonday)] || { days: {} };

  dom.dayGrid.innerHTML = '';

  // Sonntag-Spillover: heute (laufender Sonntag) als erste Karte rendern
  // Daten kommen aus der Vorwoche
  if (sundaySpillover) {
    const todaySunday = new Date();
    const prevMonday = mondayOf(new Date(todaySunday.getTime() - 7 * 86400000));
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
    <label class="day-toggle">
      <input type="checkbox" name="${fieldPrefix}-closed" ${saved.closed ? 'checked' : ''} />
      <span class="day-toggle-track"><span class="day-toggle-thumb"></span></span>
      <span class="day-toggle-text">An diesem Tag geschlossen</span>
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
    const closed = data.get(`${day.key}-closed`) === 'on';
    if (dish || side || closed) week[day.key] = { dish, side, closed };
  });
  return week;
}

/* ---------- Notice ---------- */

function renderNotice() {
  const text = loadNotice();
  if (dom.noticeInput) dom.noticeInput.value = text;
  setStatus(dom.noticeStatus, text ? 'Banner ist aktiv.' : 'Kein Banner aktiv.');
}

function onSaveNotice(e) {
  e.preventDefault();
  const text = (dom.noticeInput.value || '').trim();
  saveNotice(text);
  setStatus(dom.noticeStatus, text ? 'Hinweis gespeichert. Banner ist sichtbar.' : 'Banner ausgeblendet.', 'ok');
}

function onClearNotice() {
  dom.noticeInput.value = '';
  saveNotice('');
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
  block.querySelector('.menu-section-remove').addEventListener('click', () => {
    if (confirm('Diese ganze Kategorie mit allen Gerichten entfernen?')) block.remove();
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
  const sections = [];
  dom.menuSections.querySelectorAll('.menu-section').forEach(block => {
    const title = block.querySelector('.menu-section-title').value.trim();
    const icon  = block.querySelector('.menu-section-icon').value;
    const note  = block.querySelector('.menu-section-note').value.trim();
    const items = [];
    block.querySelectorAll('.menu-item-row').forEach(row => {
      const name  = row.querySelector('.menu-item-name').value.trim();
      const price = row.querySelector('.menu-item-price').value.trim();
      const desc  = row.querySelector('.menu-item-desc').value.trim();
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
  return {
    intro:    (dom.menuIntro?.value || '').trim(),
    sections,
    footnote: (dom.menuFootnote?.value || '').trim()
  };
}

function onSaveMenu(e) {
  e.preventDefault();
  const data = collectMenuData();
  if (!data.sections.length) {
    setStatus(dom.menuStatus, 'Mindestens eine Kategorie mit einem Gericht nötig.', 'error');
    return;
  }
  window.alsterDb.set('menu', data).then(ok => {
    setStatus(dom.menuStatus,
      ok ? `Gespeichert · ${formatTime(new Date())} — jetzt auf der Webseite sichtbar.` : 'Speichern fehlgeschlagen.',
      ok ? 'ok' : 'error');
    if (ok) logActivity('Speisekarte gespeichert');
  });
}

function onResetMenu() {
  if (!confirm('Speisekarte auf die Original-Frühstückskarte zurücksetzen? Ihre Änderungen gehen verloren.')) return;
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

  // Druck über ein verstecktes, gleich-Ursprung-Iframe statt window.open().
  // Grund: window.open('', '_blank') wird auf Handys — vor allem iOS Safari —
  // lautlos vom Popup-Blocker geschluckt, dann "passiert nichts". Ein Iframe,
  // das ein Blob-Dokument lädt, umgeht den Blocker komplett; das eingebettete
  // Skript ruft window.print() aus seinem EIGENEN Fenster auf und druckt so
  // zuverlässig genau diese Karte (nicht die Admin-Seite).
  try {
    document.getElementById('menu-print-frame')?.remove();
    const html = buildMenuPrintHtml(data);
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
        if (w && !w.__alsterPrinted) { w.__alsterPrinted = true; w.focus(); w.print(); }
      } catch (e) {}
      setTimeout(cleanup, 60000); // Spätestens nach 1 min Blob freigeben.
    });

    setStatus(dom.menuStatus, 'Druckansicht geöffnet — wählen Sie „Als PDF speichern".', 'ok');
  } catch (e) {
    setStatus(dom.menuStatus, 'PDF konnte nicht erzeugt werden. Bitte erneut versuchen.', 'error');
  }
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
  setStatus(dom.hoursStatus, 'Bereit zum Bearbeiten.');
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
  row.querySelector('.hours-remove').addEventListener('click', () => row.remove());
  dom.hoursRows.appendChild(row);
}

function onSaveHours(e) {
  e.preventDefault();
  const rows = [];
  dom.hoursRows.querySelectorAll('.hours-row').forEach(r => {
    const label = r.querySelector('.hours-label').value.trim();
    const time  = r.querySelector('.hours-time').value.trim();
    if (label || time) rows.push({ label, time });
  });
  window.alsterDb.set('hours', rows).then(ok => {
    setStatus(dom.hoursStatus,
      ok ? `Gespeichert · ${formatTime(new Date())}` : 'Speichern fehlgeschlagen.',
      ok ? 'ok' : 'error');
    if (ok) logActivity('Öffnungszeiten gespeichert');
  });
}

function onResetHours() {
  if (!confirm('Öffnungszeiten auf Standardwerte zurücksetzen?')) return;
  window.alsterDb.remove('hours').then(() => {
    renderHoursEditor();
    setStatus(dom.hoursStatus, 'Auf Standardwerte zurückgesetzt.', 'ok');
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
  colorInput?.addEventListener('input', (e) => setAccentColor(e.target.value));

  // Reset all design
  document.getElementById('design-reset')?.addEventListener('click', async () => {
    if (!confirm('Alle Design-Anpassungen (Logo, Bilder, Galerie, Farbe) entfernen?')) return;
    await window.alsterDb.remove('design');
    renderDesignEditor();
    flashDesignStatus('Auf Standard zurückgesetzt.');
  });
}

function renderDesignEditor() {
  const design = loadDesign();
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
    tile.innerHTML = `
      <img src="${src}" alt="" />
      <button type="button" class="gallery-remove" aria-label="Bild entfernen">
        <svg class="ico ico-sm"><use href="#i-x"/></svg>
      </button>
    `;
    tile.querySelector('.gallery-remove').addEventListener('click', () => {
      const d = loadDesign();
      d.gallery = (d.gallery || []).filter((_, i) => i !== idx);
      saveDesign(d);
      renderGalleryEdit();
      flashDesignStatus('Bild entfernt.');
    });
    attachDragHandlers(tile, '.gallery-tile-edit');
    grid.appendChild(tile);
  });
  // Nach Drop: Reihenfolge speichern
  grid.addEventListener('drop', () => {
    setTimeout(() => {
      const newOrder = Array.from(grid.querySelectorAll('.gallery-tile-edit'))
        .map(t => gallery[parseInt(t.dataset.idx, 10)])
        .filter(Boolean);
      const d = loadDesign();
      d.gallery = newOrder;
      saveDesign(d);
      flashDesignStatus('Reihenfolge gespeichert.');
      renderGalleryEdit();
    }, 50);
  });
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
  if (!confirm('Alle bearbeiteten Webseiten-Texte zurücksetzen? Wochenplan, Speisekarte und Design bleiben erhalten.')) return;
  await window.alsterDb.remove('content');
  alert('Texte wurden auf den Original-Zustand zurückgesetzt.');
}

async function onResetAll() {
  if (!confirm('Möchten Sie wirklich ALLE Daten löschen (Wochenplan, Speisekarte, Öffnungszeiten, Banner, Design)?')) return;
  await Promise.all([
    window.alsterDb.remove('weekly-menu'),
    window.alsterDb.remove('notice'),
    window.alsterDb.remove('menu'),
    window.alsterDb.remove('hours'),
    window.alsterDb.remove('design'),
    window.alsterDb.remove('content')
  ]);
  renderWeek();
  renderNotice();
  renderMenuEditor();
  renderHoursEditor();
  renderDesignEditor();
  alert('Alle Daten wurden gelöscht.');
}

/* ---------- Storage ---------- */

function loadAll() {
  return window.alsterDb?.get('weekly-menu') || {};
}
function saveAll(obj) {
  window.alsterDb?.set('weekly-menu', obj).catch(e =>
    setStatus(dom.saveStatus, 'Speichern fehlgeschlagen: ' + e.message, 'error')
  );
  logActivity('Wochenplan gespeichert');
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
function saveNotice(text) {
  if (text) {
    window.alsterDb?.set('notice', text);
    logActivity('Hinweis-Banner aktualisiert');
  } else {
    window.alsterDb?.remove('notice');
    logActivity('Hinweis-Banner ausgeblendet');
  }
}

/* ---------- Konto: Passwort & Mitarbeiter ---------- */

async function onChangePassword(e) {
  e.preventDefault();
  const a = dom.newPassword.value;
  const b = dom.newPasswordConfirm.value;
  if (a.length < 8) {
    setStatus(dom.passwordStatus, 'Mindestens 8 Zeichen erforderlich.', 'error');
    return;
  }
  if (a !== b) {
    setStatus(dom.passwordStatus, 'Die Passwörter stimmen nicht überein.', 'error');
    return;
  }
  setStatus(dom.passwordStatus, 'Wird gespeichert …');
  const result = await window.alsterDb.auth.updatePassword(a);
  if (result.ok) {
    dom.passwordForm.reset();
    setStatus(dom.passwordStatus, 'Passwort wurde geändert.', 'ok');
  } else {
    setStatus(dom.passwordStatus, result.error || 'Speichern fehlgeschlagen.', 'error');
  }
}

async function onInviteUser(e) {
  e.preventDefault();
  const email = dom.inviteEmail.value.trim();
  const password = dom.invitePassword.value;
  if (!email || password.length < 8) {
    setStatus(dom.inviteStatus, 'E-Mail und Passwort (mind. 8 Zeichen) erforderlich.', 'error');
    return;
  }
  setStatus(dom.inviteStatus, 'Konto wird angelegt …');
  const result = await window.alsterDb.auth.inviteUser(email, password);
  if (result.ok) {
    dom.inviteForm.reset();
    setStatus(dom.inviteStatus,
      `Zugang für ${email} wurde angelegt.`,
      'ok');
    await renderUserList();
  } else {
    setStatus(dom.inviteStatus, result.error || 'Anlegen fehlgeschlagen.', 'error');
  }
}

async function renderUserList() {
  if (!dom.userList) return;
  const users = await (window.alsterDb?.auth.listUsers?.() || []);
  const currentEmail = await window.alsterDb?.auth.getEmail();
  if (!users.length) {
    dom.userList.innerHTML = '';
    return;
  }
  dom.userList.innerHTML = users.map(u => {
    const isMe = u.email.toLowerCase() === (currentEmail || '').toLowerCase();
    return `
      <li class="user-list-item">
        <div class="user-list-info">
          <span class="user-list-email">${escapeHtml(u.email)}</span>
          ${isMe ? '<span class="user-list-tag">Sie</span>' : ''}
        </div>
        ${isMe ? '' : `<button type="button" class="btn-icon user-remove" data-email="${escapeAttr(u.email)}" aria-label="Mitarbeiter entfernen" title="Mitarbeiter entfernen">
          <svg class="ico ico-sm"><use href="#i-x"/></svg>
        </button>`}
      </li>
    `;
  }).join('');
  dom.userList.querySelectorAll('.user-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const email = btn.dataset.email;
      if (!confirm(`Zugang für ${email} entfernen?`)) return;
      await window.alsterDb.auth.removeUser(email);
      await renderUserList();
    });
  });
}

/* ---------- Helpers ---------- */

function setStatus(el, msg, kind = '') {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('ok', 'error');
  if (kind) el.classList.add(kind);
}

/* ---------- Anfragen (Reservierungen) ---------- */

async function refreshAnfragen() {
  try {
    await window.alsterDb?.listReservations();   // schreibt in Cache
  } catch {}
  renderAnfragen();
}

function renderAnfragen() {
  const list = window.alsterDb?.get('reservations') || [];
  const items = Array.isArray(list) ? list : [];
  const newCount = items.filter(r => r.status !== 'done').length;

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
  dom.anfragenList.innerHTML = items.map(r => buildAnfrageItem(r)).join('');
  dom.anfragenList.querySelectorAll('[data-mark]').forEach(b => b.addEventListener('click', () => onMarkAnfrage(b.dataset.mark)));
  dom.anfragenList.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => onDeleteAnfrage(b.dataset.del)));
}

function buildAnfrageItem(r) {
  const rec = r.receivedAt ? formatRelative(new Date(r.receivedAt)) : '';
  const dateLabel = formatAnfrageDate(r.date, r.time);
  const isDone = r.status === 'done';
  const tel = r.phone ? `tel:${r.phone.replace(/\s+/g,'')}` : '';
  const mailSubject = encodeURIComponent(`Ihre Reservierungsanfrage – Alstercafé`);
  const mailBody = encodeURIComponent(`Guten Tag ${r.name || ''},\n\nvielen Dank für Ihre Anfrage. \n\nHerzliche Grüße\nAlstercafé`);
  const mailLink = r.email
    ? `mailto:${escapeAttr(r.email)}?subject=${mailSubject}&body=${mailBody}`
    : '';

  return `
    <li class="anfrage-item ${isDone ? 'is-done' : ''}">
      <div class="anfrage-head">
        <div>
          <span class="anfrage-name">${escapeHtml(r.name || 'Ohne Namen')}</span>
          ${r.persons ? `<span class="anfrage-pers">· ${escapeHtml(r.persons)} ${Number(r.persons) === 1 ? 'Person' : 'Personen'}</span>` : ''}
        </div>
        ${isDone
          ? '<span class="anfrage-tag">Erledigt</span>'
          : '<span class="anfrage-tag is-new">Neu</span>'}
      </div>
      <p class="anfrage-when">${escapeHtml(dateLabel)}${pickupBadgeHtml(r.date)}</p>
      <div class="anfrage-contact">
        ${r.phone ? `<a href="${escapeAttr(tel)}">${escapeHtml(r.phone)}</a>` : ''}
        ${r.email ? `<a href="${mailLink}">${escapeHtml(r.email)}</a>` : ''}
      </div>
      ${r.message ? `<p class="anfrage-msg">${escapeHtml(r.message)}</p>` : ''}
      <div class="anfrage-meta">
        <span class="anfrage-rec">Eingegangen ${escapeHtml(rec)}</span>
        <div class="anfrage-actions">
          ${isDone
            ? `<button type="button" class="anfrage-btn anfrage-btn-mark" data-mark="${escapeAttr(r.id)}">Erneut öffnen</button>`
            : `<button type="button" class="anfrage-btn anfrage-btn-mark is-primary" data-mark="${escapeAttr(r.id)}">
                <svg class="ico ico-sm" aria-hidden="true"><use href="#i-check"/></svg>
                Als erledigt markieren
              </button>`}
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

function onMarkAnfrage(id) {
  const list = window.alsterDb?.get('reservations') || [];
  const current = (Array.isArray(list) ? list : []).find(r => r.id === id);
  const nextStatus = current?.status === 'done' ? 'new' : 'done';
  // db.js aktualisiert in-memory + localStorage synchron, also vor dem render aufrufen.
  window.alsterDb?.updateReservationStatus(id, nextStatus).finally(() => refreshAnfragen());
  renderAnfragen();
}

function onDeleteAnfrage(id) {
  if (!confirm('Diese Anfrage wirklich löschen?')) return;
  window.alsterDb?.deleteReservation(id).finally(() => refreshAnfragen());
  renderAnfragen();
}

/* ---------- Bestellungen (belegte Brötchen) ---------- */

async function refreshOrders() {
  try { await window.alsterDb?.listOrders(); } catch {}
  renderOrders();
}

function renderOrders() {
  const list = window.alsterDb?.get('orders') || [];
  const items = Array.isArray(list) ? list : [];
  const newCount = items.filter(o => o.status !== 'done').length;

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
  dom.ordersList.innerHTML = items.map(o => buildOrderItem(o)).join('');
  dom.ordersList.querySelectorAll('[data-mark]').forEach(b => b.addEventListener('click', () => onMarkOrder(b.dataset.mark)));
  dom.ordersList.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => onDeleteOrder(b.dataset.del)));
}

function buildOrderItem(o) {
  const rec = o.receivedAt ? formatRelative(new Date(o.receivedAt)) : '';
  const dateLabel = formatAnfrageDate(o.pickupDate, o.pickupTime);
  const isDone = o.status === 'done';
  const tel = o.phone ? `tel:${o.phone.replace(/\s+/g,'')}` : '';
  const mailSubject = encodeURIComponent('Ihre Brötchen-Bestellung – Alstercafé');
  const mailBody = encodeURIComponent(`Guten Tag ${o.name || ''},\n\nvielen Dank für Ihre Bestellung. Wir haben sie notiert.\n\nHerzliche Grüße\nAlstercafé`);
  const mailLink = o.email ? `mailto:${escapeAttr(o.email)}?subject=${mailSubject}&body=${mailBody}` : '';
  const itemsList = (Array.isArray(o.items) ? o.items : [])
    .map(it => `<li><span class="order-line-qty">${escapeHtml(String(it.qty))}×</span> ${escapeHtml(it.name)}</li>`)
    .join('');

  return `
    <li class="anfrage-item order-item ${isDone ? 'is-done' : ''}">
      <div class="anfrage-head">
        <div>
          <span class="anfrage-name">${escapeHtml(o.name || 'Ohne Namen')}</span>
          <span class="anfrage-pers">· ${escapeHtml(String(o.totalCount || 0))} Brötchen</span>
        </div>
        ${isDone
          ? '<span class="anfrage-tag">Erledigt</span>'
          : '<span class="anfrage-tag is-new">Neu</span>'}
      </div>
      <p class="anfrage-when">Abholung: ${escapeHtml(dateLabel)}${pickupBadgeHtml(o.pickupDate)}</p>
      <ul class="order-line-list">${itemsList}</ul>
      <div class="anfrage-contact">
        ${o.phone ? `<a href="${escapeAttr(tel)}">${escapeHtml(o.phone)}</a>` : ''}
        ${o.email ? `<a href="${mailLink}">${escapeHtml(o.email)}</a>` : ''}
      </div>
      ${o.notes ? `<p class="anfrage-msg">${escapeHtml(o.notes)}</p>` : ''}
      <div class="anfrage-meta">
        <span class="anfrage-rec">Eingegangen ${escapeHtml(rec)}</span>
        <div class="anfrage-actions">
          ${isDone
            ? `<button type="button" class="anfrage-btn anfrage-btn-mark" data-mark="${escapeAttr(o.id)}">Erneut öffnen</button>`
            : `<button type="button" class="anfrage-btn anfrage-btn-mark is-primary" data-mark="${escapeAttr(o.id)}">
                <svg class="ico ico-sm" aria-hidden="true"><use href="#i-check"/></svg>
                Als erledigt markieren
              </button>`}
          <button type="button" class="anfrage-btn anfrage-btn-del" data-del="${escapeAttr(o.id)}" aria-label="Bestellung löschen">
            <svg class="ico ico-sm" aria-hidden="true"><use href="#i-trash"/></svg>
            Löschen
          </button>
        </div>
      </div>
    </li>
  `;
}

function onMarkOrder(id) {
  const list = window.alsterDb?.get('orders') || [];
  const current = (Array.isArray(list) ? list : []).find(o => o.id === id);
  const nextStatus = current?.status === 'done' ? 'new' : 'done';
  window.alsterDb?.updateOrderStatus(id, nextStatus).finally(() => refreshOrders());
  renderOrders();
}

function onDeleteOrder(id) {
  if (!confirm('Diese Bestellung wirklich löschen?')) return;
  window.alsterDb?.deleteOrder(id).finally(() => refreshOrders());
  renderOrders();
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
      <label class="broetchen-edit-veg"><input type="checkbox" ${data.veg ? 'checked' : ''} /> vegetarisch</label>
    </div>
    <button type="button" class="broetchen-edit-remove" aria-label="Sorte entfernen">
      <svg class="ico ico-sm"><use href="#i-x"/></svg>
    </button>
  `;
  row.querySelector('.broetchen-edit-remove').addEventListener('click', () => {
    row.remove();
    setStatus(dom.broetchenStatus, 'Nicht vergessen: „Sorten speichern" klicken.', '');
  });
  dom.broetchenEditor.appendChild(row);
  if (!skipStatus) setStatus(dom.broetchenStatus, 'Nicht vergessen: „Sorten speichern" klicken.', '');
}

function readBroetchenForm() {
  const rows = Array.from(dom.broetchenEditor.querySelectorAll('.broetchen-edit-row'));
  const out = [];
  rows.forEach(row => {
    const name = row.querySelector('.broetchen-edit-name').value.trim();
    const desc = row.querySelector('.broetchen-edit-desc').value.trim();
    const veg  = row.querySelector('.broetchen-edit-veg input').checked;
    if (name) out.push(veg ? { name, desc, veg: true } : { name, desc });
  });
  return out;
}

function onSaveBroetchen(e) {
  e.preventDefault();
  const items = readBroetchenForm();
  if (!items.length) {
    setStatus(dom.broetchenStatus, 'Bitte mindestens eine Sorte angeben.', 'error');
    return;
  }
  window.alsterDb?.set('broetchen-items', items).then(ok => {
    setStatus(dom.broetchenStatus,
      ok === false ? 'Speichern fehlgeschlagen.' : `Gespeichert · ${items.length} Sorten`,
      ok === false ? 'error' : 'ok');
  });
  if (typeof logActivity === 'function') logActivity('Brötchen-Sorten aktualisiert');
}

function onResetBroetchen() {
  if (!confirm('Sorten auf die Standard-Auswahl zurücksetzen?')) return;
  window.alsterDb?.remove('broetchen-items').then(() => {
    renderBroetchenEditor();
    setStatus(dom.broetchenStatus, 'Auf Standard zurückgesetzt.', 'ok');
  });
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
