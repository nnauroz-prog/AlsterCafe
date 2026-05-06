/* Alstercafé · Mitgliederbereich */

const STORAGE_KEY = 'alstercafe.weekly-menu';
const AUTH_KEY    = 'alstercafe.auth';
const CREDENTIALS = { username: 'inhaber', password: 'alstercafe2026' };

const DAYS = [
  { key: 'mon', label: 'Montag' },
  { key: 'tue', label: 'Dienstag' },
  { key: 'wed', label: 'Mittwoch' },
  { key: 'thu', label: 'Donnerstag' },
  { key: 'fri', label: 'Freitag' },
  { key: 'sat', label: 'Samstag' },
  { key: 'sun', label: 'Sonntag' }
];

const dom = {
  loginView: document.getElementById('login-view'),
  loginForm: document.getElementById('login-form'),
  loginStatus: document.getElementById('login-status'),
  dashboard: document.getElementById('dashboard-view'),
  actions: document.getElementById('admin-actions'),
  logoutBtn: document.getElementById('logout-btn'),
  menuForm: document.getElementById('menu-form'),
  dayGrid: document.getElementById('day-grid'),
  saveStatus: document.getElementById('save-status'),
  resetBtn: document.getElementById('reset-week'),
  weekKw: document.getElementById('week-kw'),
  weekRange: document.getElementById('week-range'),
  weekPrev: document.getElementById('week-prev'),
  weekNext: document.getElementById('week-next'),
  year: document.getElementById('year')
};

let currentMonday = mondayOf(new Date());

document.addEventListener('DOMContentLoaded', init);

function init() {
  if (dom.year) dom.year.textContent = new Date().getFullYear();
  if (isAuthenticated()) showDashboard();
  else showLogin();

  dom.loginForm.addEventListener('submit', onLogin);
  dom.logoutBtn.addEventListener('click', onLogout);
  dom.menuForm.addEventListener('submit', onSave);
  dom.resetBtn.addEventListener('click', onResetWeek);
  dom.weekPrev.addEventListener('click', () => changeWeek(-7));
  dom.weekNext.addEventListener('click', () => changeWeek(7));
}

/* ---------- Auth ---------- */

function isAuthenticated() {
  try { return sessionStorage.getItem(AUTH_KEY) === '1'; }
  catch { return false; }
}

function onLogin(e) {
  e.preventDefault();
  const data = new FormData(dom.loginForm);
  const u = (data.get('username') || '').toString().trim().toLowerCase();
  const p = (data.get('password') || '').toString();
  if (u === CREDENTIALS.username && p === CREDENTIALS.password) {
    sessionStorage.setItem(AUTH_KEY, '1');
    setStatus(dom.loginStatus, '');
    showDashboard();
  } else {
    setStatus(dom.loginStatus, 'Benutzername oder Passwort ist nicht korrekt.', 'error');
  }
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
  renderWeek();
}

/* ---------- Week handling ---------- */

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

function onSave(e) {
  e.preventDefault();
  const week = readFormToWeek();
  const all = loadAll();
  all[isoDate(currentMonday)] = {
    weekStart: isoDate(currentMonday),
    updatedAt: new Date().toISOString(),
    days: week
  };
  saveAll(all);
  setStatus(dom.saveStatus, `Gespeichert · ${formatTime(new Date())}`, 'ok');
}

function renderWeek() {
  const weekKw = isoWeek(currentMonday);
  const sunday = new Date(currentMonday); sunday.setDate(sunday.getDate() + 6);
  dom.weekKw.textContent = `KW ${weekKw}`;
  dom.weekRange.textContent = `${formatShort(currentMonday)} – ${formatShort(sunday)}`;

  const all = loadAll();
  const stored = all[isoDate(currentMonday)] || { days: {} };

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

  // closed-toggle disables fields
  dom.dayGrid.querySelectorAll('.day-toggle input').forEach(cb => {
    const card = cb.closest('.day-card');
    const apply = () => card.classList.toggle('is-closed', cb.checked);
    cb.addEventListener('change', apply);
    apply();
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

/* ---------- Helpers ---------- */

function setStatus(el, msg, kind = '') {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('ok', 'error');
  if (kind) el.classList.add(kind);
}

function mondayOf(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}
function isoDate(d) { return d.toISOString().slice(0, 10); }
function isSameDay(a, b) { return isoDate(a) === isoDate(b); }
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const diff = (d - firstThursday) / 86400000;
  return 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}
function formatShort(d) {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatTime(d) {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
function formatDateTime(d) {
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
