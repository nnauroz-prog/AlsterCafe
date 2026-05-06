/* Alstercafé · Mitgliederbereich */

const STORAGE_KEY  = 'alstercafe.weekly-menu';
const NOTICE_KEY   = 'alstercafe.notice';
const AUTH_KEY     = 'alstercafe.auth';
const ACTIVE_TAB_KEY = 'alstercafe.admin.tab';

const VALID_USERNAMES = ['inhaber@alstercafe.de', 'inhaber'];
const VALID_PASSWORD  = 'IfflandStr45!';
const DISPLAY_USER    = 'inhaber@alstercafe.de';

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

document.addEventListener('DOMContentLoaded', init);

function init() {
  cacheDom();
  if (dom.year) dom.year.textContent = new Date().getFullYear();

  if (isAuthenticated()) showDashboard();
  else showLogin();

  // Login
  dom.loginForm.addEventListener('submit', onLogin);
  dom.pwToggle.addEventListener('click', onPwToggle);
  dom.logoutBtn.addEventListener('click', onLogout);

  // Tabs
  dom.tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  // Wochenplan
  dom.menuForm.addEventListener('submit', onSaveWeek);
  dom.weekPrev.addEventListener('click', () => changeWeek(-7));
  dom.weekNext.addEventListener('click', () => changeWeek(7));
  dom.weekToday.addEventListener('click', () => { currentMonday = mondayOf(new Date()); renderWeek(); });
  dom.copyPrev.addEventListener('click', onCopyFromPrevious);
  dom.exportJson.addEventListener('click', onExportJson);
  dom.resetWeek.addEventListener('click', onResetWeek);

  // Notice
  dom.noticeForm.addEventListener('submit', onSaveNotice);
  dom.noticeClear.addEventListener('click', onClearNotice);

  // Account
  dom.resetAll.addEventListener('click', onResetAll);
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
    // Stats
    statFilled:   document.getElementById('stat-filled'),
    statWeek:     document.getElementById('stat-week'),
    statSaved:    document.getElementById('stat-saved'),
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
    // Account
    resetAll:     document.getElementById('reset-all'),
    year:         document.getElementById('year')
  });
}

/* ---------- Auth ---------- */

function isAuthenticated() {
  try { return sessionStorage.getItem(AUTH_KEY) === '1'; }
  catch { return false; }
}

function tryLogin(username, password) {
  const u = String(username || '').trim().toLowerCase();
  const p = String(password || '').trim();
  return VALID_USERNAMES.includes(u) && p === VALID_PASSWORD;
}

function onLogin(e) {
  e.preventDefault();
  const data = new FormData(dom.loginForm);
  const u = data.get('username');
  const p = data.get('password');

  if (tryLogin(u, p)) {
    sessionStorage.setItem(AUTH_KEY, '1');
    setStatus(dom.loginStatus, '');
    showDashboard();
  } else {
    setStatus(dom.loginStatus,
      'Benutzername oder Passwort ist nicht korrekt.',
      'error');
  }
}

function onPwToggle() {
  const isHidden = dom.pwInput.type === 'password';
  dom.pwInput.type = isHidden ? 'text' : 'password';
  dom.pwToggle.setAttribute('aria-label', isHidden ? 'Passwort verbergen' : 'Passwort anzeigen');
  dom.pwToggle.querySelector('use').setAttribute('href', isHidden ? '#i-eye-off' : '#i-eye');
}

function onLogout() {
  sessionStorage.removeItem(AUTH_KEY);
  showLogin();
}

function showLogin() {
  dom.loginView.hidden = false;
  dom.dashboard.hidden = true;
  dom.actions.hidden = true;
}

function showDashboard() {
  dom.loginView.hidden = true;
  dom.dashboard.hidden = false;
  dom.actions.hidden = false;
  if (dom.userBadge) dom.userBadge.textContent = DISPLAY_USER;
  const lastTab = (() => {
    try { return sessionStorage.getItem(ACTIVE_TAB_KEY) || 'week'; }
    catch { return 'week'; }
  })();
  switchTab(lastTab);
  renderWeek();
  renderNotice();
}

/* ---------- Tabs ---------- */

function switchTab(name) {
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
}

/* ---------- Wochenplan ---------- */

function changeWeek(deltaDays) {
  const d = new Date(currentMonday);
  d.setDate(d.getDate() + deltaDays);
  currentMonday = mondayOf(d);
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
  const week = readFormToWeek();
  const all = loadAll();
  all[isoDate(currentMonday)] = {
    weekStart: isoDate(currentMonday),
    updatedAt: new Date().toISOString(),
    days: week
  };
  saveAll(all);
  renderWeek();
  setStatus(dom.saveStatus, `Gespeichert · ${formatTime(new Date())}`, 'ok');
}

function renderWeek() {
  const weekKw = isoWeek(currentMonday);
  const sunday = new Date(currentMonday); sunday.setDate(sunday.getDate() + 6);
  dom.weekKw.textContent = `KW ${weekKw}`;
  dom.weekRange.textContent = `${formatShort(currentMonday)} – ${formatShort(sunday)}`;
  if (dom.statWeek) dom.statWeek.textContent = `KW ${weekKw}`;

  const all = loadAll();
  const stored = all[isoDate(currentMonday)] || { days: {} };
  const filledCount = Object.values(stored.days || {}).filter(d => (d.dish && !d.closed) || d.closed).length;
  if (dom.statFilled) dom.statFilled.textContent = String(filledCount);
  if (dom.statSaved) dom.statSaved.textContent = stored.updatedAt
    ? formatRelative(new Date(stored.updatedAt))
    : '–';

  dom.dayGrid.innerHTML = '';
  DAYS.forEach((day, idx) => {
    const date = new Date(currentMonday); date.setDate(date.getDate() + idx);
    const saved = stored.days[day.key] || {};
    const isToday = isSameDay(date, new Date());

    const card = document.createElement('div');
    card.className = 'day-card' + (isToday ? ' is-today' : '') + (saved.closed ? ' is-closed' : '');
    card.innerHTML = `
      <div class="day-card-head">
        <div>
          <span class="day-name">${day.label}</span>
          <span class="day-date">${formatShort(date)}</span>
        </div>
        ${isToday ? '<span class="day-pill">Heute</span>' : ''}
      </div>
      <label class="day-field">
        <span>Hauptgericht</span>
        <textarea name="${day.key}-dish" rows="2" placeholder="z. B. Hähnchenschenkel oder gebackener Schafskäse mit Gemüse">${escapeHtml(saved.dish || '')}</textarea>
      </label>
      <label class="day-field">
        <span>Beilagen / Zusatz</span>
        <input type="text" name="${day.key}-side" placeholder="z. B. Bulgur oder Reis, Salat" value="${escapeAttr(saved.side || '')}" />
      </label>
      <label class="day-toggle">
        <input type="checkbox" name="${day.key}-closed" ${saved.closed ? 'checked' : ''} />
        <span>Kein Mittagstisch / Geschlossen</span>
      </label>
    `;
    dom.dayGrid.appendChild(card);
  });

  dom.dayGrid.querySelectorAll('.day-toggle input').forEach(cb => {
    const card = cb.closest('.day-card');
    cb.addEventListener('change', () => card.classList.toggle('is-closed', cb.checked));
  });

  setStatus(dom.saveStatus,
    stored.updatedAt
      ? `Zuletzt gespeichert · ${formatDateTime(new Date(stored.updatedAt))}`
      : 'Noch nicht gespeichert.');
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

/* ---------- Account ---------- */

function onResetAll() {
  if (!confirm('Möchten Sie wirklich ALLE lokal gespeicherten Daten löschen (alle Wochen + Banner)?')) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(NOTICE_KEY);
  } catch {}
  renderWeek();
  renderNotice();
  alert('Alle Daten wurden lokal gelöscht.');
}

/* ---------- Storage ---------- */

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveAll(obj) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); }
  catch (e) { setStatus(dom.saveStatus, 'Speichern fehlgeschlagen: ' + e.message, 'error'); }
}
function loadNotice() {
  try { return localStorage.getItem(NOTICE_KEY) || ''; }
  catch { return ''; }
}
function saveNotice(text) {
  try {
    if (text) localStorage.setItem(NOTICE_KEY, text);
    else localStorage.removeItem(NOTICE_KEY);
  } catch {}
}

/* ---------- Helpers ---------- */

function setStatus(el, msg, kind = '') {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('ok', 'error');
  if (kind) el.classList.add(kind);
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
