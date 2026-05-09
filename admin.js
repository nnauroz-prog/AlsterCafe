/* Alstercafé · Mitgliederbereich */

const STORAGE_KEY    = 'alstercafe.weekly-menu';
const NOTICE_KEY     = 'alstercafe.notice';
const MENU_KEY       = 'alstercafe.menu';
const HOURS_KEY      = 'alstercafe.hours';
const AUTH_KEY       = 'alstercafe.auth';
const ACTIVE_TAB_KEY = 'alstercafe.admin.tab';

const MENU_CATS = [
  { key: 'fruehstueck', label: 'Frühstück',     defaultIcon: 'i-bread' },
  { key: 'backwaren',   label: 'Backwaren',     defaultIcon: 'i-wheat' },
  { key: 'getraenke',   label: 'Heiße Getränke', defaultIcon: 'i-cup'   }
];

const DEFAULT_MENU = {
  fruehstueck: {
    title: 'Frühstück',
    icon: 'i-bread',
    items: [
      { name: 'Kleines Frühstück', description: 'Brötchen, Butter, Marmelade, Heißgetränk.' },
      { name: 'Großes Frühstück',  description: 'Brötchenkorb, Käse, Wurst, Ei, Heißgetränk.' },
      { name: 'Vegetarisch',       description: 'Frischkäse, Avocado, Gemüse, Heißgetränk.' }
    ]
  },
  backwaren: {
    title: 'Backwaren',
    icon: 'i-wheat',
    items: [
      { name: 'Brot & Brötchen',   description: 'Roggen, Dinkel, Vollkorn, Sauerteig.' },
      { name: 'Feines Gebäck',     description: 'Croissants, Franzbrötchen, Plunder.' },
      { name: 'Torten & Kuchen',   description: 'Hausgemacht, Festtagstorten auf Vorbestellung.' }
    ]
  },
  getraenke: {
    title: 'Heiße Getränke',
    icon: 'i-cup',
    items: [
      { name: 'Espresso · Cappuccino · Latte', description: 'Mocambo, frisch gemahlen.' },
      { name: 'Hauskaffee · Milchkaffee',      description: 'Traditionell gefiltert.' },
      { name: 'Kakao & Tee',                   description: 'Heiße Schokolade, Kräuter- und Früchtetees.' }
    ]
  }
};

const DEFAULT_HOURS = [
  { label: 'Mo – Fr',  time: '06:30 – 15:00' },
  { label: 'Samstag',  time: '07:30 – 15:00' },
  { label: 'Sonntag',  time: '07:30 – 15:00' }
];

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

  // Speisekarte
  dom.menuCardsForm.addEventListener('submit', onSaveMenu);
  dom.menuReset.addEventListener('click', onResetMenu);

  // Öffnungszeiten
  dom.hoursForm.addEventListener('submit', onSaveHours);
  dom.hoursAdd.addEventListener('click', () => addHourRow());
  dom.hoursReset.addEventListener('click', onResetHours);

  // Account
  dom.resetAll.addEventListener('click', onResetAll);

  // KI-Polish (delegiert für dynamisch erzeugte Buttons)
  document.addEventListener('click', onAiPolishClick);
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
    // Speisekarte
    menuCardsForm: document.getElementById('menu-cards-form'),
    menuCats:      document.getElementById('menu-cats'),
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
  renderMenuEditor();
  renderHoursEditor();
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
      <div class="day-field with-ai">
        <label>
          <span>Hauptgericht</span>
          <textarea name="${day.key}-dish" rows="2" placeholder="Kurz eintragen — KI verfeinert es">${escapeHtml(saved.dish || '')}</textarea>
        </label>
        <button type="button" class="ai-btn" data-ai-target="textarea[name='${day.key}-dish']" data-ai-context="dish" title="Mit KI verfeinern">
          <svg class="ico ico-sm"><use href="#i-sparkle"/></svg>
          <span>KI</span>
        </button>
      </div>
      <div class="day-field with-ai">
        <label>
          <span>Beilagen / Zusatz</span>
          <input type="text" name="${day.key}-side" placeholder="z. B. Bulgur oder Reis, Salat" value="${escapeAttr(saved.side || '')}" />
        </label>
        <button type="button" class="ai-btn" data-ai-target="input[name='${day.key}-side']" data-ai-context="side" title="Mit KI verfeinern">
          <svg class="ico ico-sm"><use href="#i-sparkle"/></svg>
        </button>
      </div>
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

/* ---------- Speisekarte ---------- */

function renderMenuEditor() {
  if (!dom.menuCats) return;
  const data = loadMenu();
  dom.menuCats.innerHTML = '';
  MENU_CATS.forEach(cat => {
    const stored = data[cat.key] || DEFAULT_MENU[cat.key];
    const block = document.createElement('div');
    block.className = 'menu-cat';
    block.dataset.key = cat.key;
    block.innerHTML = `
      <div class="menu-cat-head">
        <input type="text" class="menu-cat-title" value="${escapeAttr(stored.title || cat.label)}" />
      </div>
      <div class="menu-items"></div>
      <button type="button" class="btn btn-link menu-add">
        <svg class="ico ico-sm"><use href="#i-plus"/></svg>
        Eintrag hinzufügen
      </button>
    `;
    const itemsBox = block.querySelector('.menu-items');
    (stored.items || []).forEach(it => itemsBox.appendChild(buildMenuItemRow(it)));
    block.querySelector('.menu-add').addEventListener('click', () => {
      itemsBox.appendChild(buildMenuItemRow({ name: '', description: '' }));
    });
    dom.menuCats.appendChild(block);
  });
  setStatus(dom.menuStatus, 'Bereit zum Bearbeiten.');
}

function buildMenuItemRow(item) {
  const row = document.createElement('div');
  row.className = 'menu-item-row';
  row.innerHTML = `
    <div class="menu-item-fields">
      <div class="menu-item-cell with-ai">
        <label>
          <span>Bezeichnung</span>
          <input type="text" class="menu-item-name" value="${escapeAttr(item.name || '')}" placeholder="z. B. Cappuccino" />
        </label>
        <button type="button" class="ai-btn" data-ai-target=".menu-item-name" data-ai-context="name" title="Mit KI verfeinern">
          <svg class="ico ico-sm"><use href="#i-sparkle"/></svg>
        </button>
      </div>
      <div class="menu-item-cell with-ai">
        <label>
          <span>Beschreibung</span>
          <input type="text" class="menu-item-desc" value="${escapeAttr(item.description || '')}" placeholder="z. B. Espresso mit feinem Milchschaum" />
        </label>
        <button type="button" class="ai-btn" data-ai-target=".menu-item-desc" data-ai-context="description" title="Mit KI verfeinern">
          <svg class="ico ico-sm"><use href="#i-sparkle"/></svg>
        </button>
      </div>
    </div>
    <button type="button" class="btn-icon menu-item-remove" aria-label="Eintrag entfernen" title="Eintrag entfernen">
      <svg class="ico ico-sm"><use href="#i-x"/></svg>
    </button>
  `;
  row.querySelector('.menu-item-remove').addEventListener('click', () => row.remove());
  return row;
}

function onSaveMenu(e) {
  e.preventDefault();
  const data = {};
  dom.menuCats.querySelectorAll('.menu-cat').forEach(block => {
    const key = block.dataset.key;
    const title = block.querySelector('.menu-cat-title').value.trim() || DEFAULT_MENU[key].title;
    const items = [];
    block.querySelectorAll('.menu-item-row').forEach(row => {
      const name = row.querySelector('.menu-item-name').value.trim();
      const description = row.querySelector('.menu-item-desc').value.trim();
      if (name || description) items.push({ name, description });
    });
    data[key] = { title, icon: DEFAULT_MENU[key].icon, items };
  });
  try {
    localStorage.setItem(MENU_KEY, JSON.stringify(data));
    setStatus(dom.menuStatus, `Gespeichert · ${formatTime(new Date())}`, 'ok');
  } catch (err) {
    setStatus(dom.menuStatus, 'Speichern fehlgeschlagen: ' + err.message, 'error');
  }
}

function onResetMenu() {
  if (!confirm('Speisekarte auf Standardwerte zurücksetzen?')) return;
  try { localStorage.removeItem(MENU_KEY); } catch {}
  renderMenuEditor();
  setStatus(dom.menuStatus, 'Auf Standardwerte zurückgesetzt.', 'ok');
}

function loadMenu() {
  try {
    const raw = localStorage.getItem(MENU_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const out = JSON.parse(JSON.stringify(DEFAULT_MENU));
        Object.keys(out).forEach(k => {
          if (parsed[k]) {
            out[k].title = parsed[k].title || out[k].title;
            if (Array.isArray(parsed[k].items)) out[k].items = parsed[k].items;
          }
        });
        return out;
      }
    }
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_MENU));
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
  try {
    localStorage.setItem(HOURS_KEY, JSON.stringify(rows));
    setStatus(dom.hoursStatus, `Gespeichert · ${formatTime(new Date())}`, 'ok');
  } catch (err) {
    setStatus(dom.hoursStatus, 'Speichern fehlgeschlagen: ' + err.message, 'error');
  }
}

function onResetHours() {
  if (!confirm('Öffnungszeiten auf Standardwerte zurücksetzen?')) return;
  try { localStorage.removeItem(HOURS_KEY); } catch {}
  renderHoursEditor();
  setStatus(dom.hoursStatus, 'Auf Standardwerte zurückgesetzt.', 'ok');
}

/* ---------- Account ---------- */

function onResetAll() {
  if (!confirm('Möchten Sie wirklich ALLE lokal gespeicherten Daten löschen (Wochenplan, Speisekarte, Öffnungszeiten, Banner)?')) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(NOTICE_KEY);
    localStorage.removeItem(MENU_KEY);
    localStorage.removeItem(HOURS_KEY);
  } catch {}
  renderWeek();
  renderNotice();
  renderMenuEditor();
  renderHoursEditor();
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

/* ============================================================
   KI-Polish — verfeinert kurze Inhaber-Eingaben in markenkonforme Form
   ============================================================ */

/* Wörterbuch: häufige Schreibweisen → professionelle Form (Groß/Klein-blind) */
const POLISH_DICT = {
  'soße': 'Sauce',          'sosse': 'Sauce',          'sauce': 'Sauce',
  'pommes': 'Pommes frites', 'pommes frites': 'Pommes frites',
  'kartoffel': 'Kartoffel',  'kartoffeln': 'Kartoffeln',
  'gemüse': 'Gemüse',        'gemuese': 'Gemüse',
  'reis': 'Basmatireis',     'basmati': 'Basmatireis',
  'bulgur': 'Bulgur',        'cous cous': 'Couscous',   'couscous': 'Couscous',
  'nudel': 'Nudeln',         'nudeln': 'Nudeln',         'pasta': 'Pasta',
  'spaghetti': 'Spaghetti',  'lasagne': 'Lasagne',       'penne': 'Penne',
  'bolo': 'Bolognese',       'bolognese': 'Bolognese',   'carbonara': 'Carbonara',
  'hähnchen': 'Hähnchen',    'haehnchen': 'Hähnchen',    'huhn': 'Hähnchen',
  'schnitzel': 'Schnitzel',  'rindfleisch': 'Rindfleisch','schwein': 'Schwein',
  'fisch': 'Fisch',          'lachs': 'Lachs',           'thunfisch': 'Thunfisch',
  'schaferkäse': 'Schafskäse','schafskäse': 'Schafskäse','feta': 'Feta',
  'salat': 'Salat',          'salate': 'Salate',
  'suppe': 'Suppe',          'eintopf': 'Eintopf',
  'mit': 'mit', 'und': 'und', 'oder': 'oder',
  'frühstück': 'Frühstück',  'mittag': 'Mittag',         'kaffee': 'Kaffee',
  'cappuccino': 'Cappuccino','espresso': 'Espresso',     'latte': 'Latte Macchiato',
  'kakao': 'Kakao',          'tee': 'Tee',               'schoko': 'Schokolade',
  'vegetarisch': 'vegetarisch', 'vegan': 'vegan',
  'hausgemacht': 'hausgemacht', 'frisch': 'frisch'
};

/* Beilagen-Pattern: erkennt einfache Strukturen und reichert sanft an */
const ENRICH_PROTEIN = {
  'hähnchen':   ['Hähnchenfilet', 'knusprig gebraten'],
  'rindfleisch':['Rindfleisch',   'sanft geschmort'],
  'schwein':    ['Schweinefilet', 'in Pfeffersauce'],
  'lachs':      ['Lachsfilet',    'auf Limettenschaum'],
  'thunfisch':  ['Thunfischsteak','mediterran gewürzt'],
  'fisch':      ['Fischfilet',    'mit Zitronenbutter'],
  'schafskäse': ['Schafskäse',    'im Ofen gebacken'],
  'feta':       ['Feta',          'mit Honig glasiert']
};

const ENRICH_BASE = {
  'reis':       'Basmatireis',
  'kartoffel':  'cremige Kartoffeln',
  'kartoffeln': 'cremige Kartoffeln',
  'pommes':     'Pommes frites',
  'bulgur':     'aromatischer Bulgur',
  'couscous':   'mediterraner Couscous',
  'pasta':      'Pasta al dente',
  'nudeln':     'Pasta al dente',
  'spaghetti':  'Spaghetti'
};

/* Professionelle Adjektive für sehr kurze Eingaben */
const FILLER_ADJECTIVES = ['knusprig gebraten', 'frisch zubereitet', 'hausgemacht'];

/* Casual-Filler, die wir entfernen */
const CASUAL_FILLERS = /\b(halt|eben|irgendwie|vielleicht|so'?n|son|n'?|na ja|naja|so was|sowas)\b/gi;

function polishText(input, context = 'default') {
  if (!input) return '';
  let t = input.replace(/\s+/g, ' ').trim();
  if (!t) return '';

  // 1. Casual-Filler entfernen
  t = t.replace(CASUAL_FILLERS, ' ').replace(/\s+/g, ' ').trim();

  // 2. Wörterbuch-Mapping anwenden (längste Phrasen zuerst)
  const dictKeys = Object.keys(POLISH_DICT).sort((a, b) => b.length - a.length);
  dictKeys.forEach(key => {
    const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    t = t.replace(re, POLISH_DICT[key]);
  });

  // 3. Mehrfach-Leerzeichen, Komma-Spacing
  t = t.replace(/\s+/g, ' ').replace(/\s+([.,!?])/g, '$1').replace(/([.,])(\S)/g, '$1 $2').trim();

  // 4. Kontext-spezifische Verfeinerung
  if (context === 'dish') {
    t = enrichDish(t);
  } else if (context === 'name') {
    t = titleCase(t);
  } else if (context === 'description') {
    t = capitalizeFirst(t);
  } else if (context === 'side') {
    t = enrichSide(t);
  } else if (context === 'notice') {
    t = capitalizeFirst(t);
    if (!/[.!?]$/.test(t)) t += '.';
  } else {
    t = capitalizeFirst(t);
  }

  return t;
}

function enrichDish(text) {
  let t = capitalizeFirst(text);
  const lower = t.toLowerCase();
  const wordCount = t.split(/\s+/).length;

  // Sehr kurze Eingaben (<= 3 Wörter): mit erkanntem Protein anreichern
  if (wordCount <= 3) {
    for (const key of Object.keys(ENRICH_PROTEIN)) {
      if (lower.includes(key)) {
        const [proper, modifier] = ENRICH_PROTEIN[key];
        // Ersetze einfaches Wort durch professionelles Substantiv + Modifier
        if (!lower.includes('mit')) {
          t = `${proper} ${modifier}, dazu wechselnde Beilagen`;
          return t;
        }
      }
    }
  }

  // Mit "X mit Y" Struktur: Beilage hochwerten
  const matchMit = t.match(/^(.+?)\s+mit\s+(.+)$/i);
  if (matchMit) {
    const protein = polishProtein(matchMit[1].trim());
    const side    = polishSide(matchMit[2].trim());
    return `${capitalizeFirst(protein)} mit ${side}`;
  }

  return t;
}

function enrichSide(text) {
  let t = text.trim();
  if (!t) return '';
  const lower = t.toLowerCase();
  // Wenn die Beilage in unserer Liste ist, nutze die professionelle Variante
  for (const key of Object.keys(ENRICH_BASE)) {
    if (lower === key) return ENRICH_BASE[key];
  }
  // Komma-getrennte Beilagen normalisieren
  if (t.includes(',') || / oder /i.test(t)) {
    return t.split(/,| oder /i)
      .map(s => s.trim()).filter(Boolean)
      .map(s => ENRICH_BASE[s.toLowerCase()] || capitalizeFirst(s))
      .join(', ');
  }
  return capitalizeFirst(t);
}

function polishProtein(s) {
  const lower = s.toLowerCase();
  for (const key of Object.keys(ENRICH_PROTEIN)) {
    if (lower.includes(key)) {
      const [proper, modifier] = ENRICH_PROTEIN[key];
      // Wenn nur das Wort steht, mit Modifier anreichern
      if (lower.trim() === key) return `${modifier === 'knusprig gebraten' ? 'Knusprig gebratenes ' + proper : proper + ' ' + modifier}`;
      return s.replace(new RegExp(key, 'i'), proper);
    }
  }
  return s;
}

function polishSide(s) {
  const lower = s.toLowerCase();
  // Mehrere Beilagen?
  if (/\bund\b|,| oder /i.test(s)) {
    return s.split(/,| und | oder /i)
      .map(p => p.trim()).filter(Boolean)
      .map(p => ENRICH_BASE[p.toLowerCase()] || p.toLowerCase())
      .map(capitalizeFirst)
      .join(', ');
  }
  return ENRICH_BASE[lower] || capitalizeFirst(s);
}

function capitalizeFirst(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function titleCase(s) {
  if (!s) return '';
  const SMALL = new Set(['und','oder','mit','für','von','der','die','das','am','im']);
  return s.split(/\s+/).map((w, i) => {
    const lower = w.toLowerCase();
    if (i > 0 && SMALL.has(lower)) return lower;
    return capitalizeFirst(w);
  }).join(' ');
}

/* ---------- Click-Handler für KI-Buttons ---------- */
function onAiPolishClick(e) {
  const btn = e.target.closest('.ai-btn');
  if (!btn || btn.disabled) return;
  e.preventDefault();
  const targetSel = btn.dataset.aiTarget;
  const ctx = btn.dataset.aiContext || 'default';
  if (!targetSel) return;
  const target = btn.parentElement.querySelector(targetSel) || document.querySelector(targetSel);
  if (!target) return;

  const original = target.value || '';
  if (!original.trim()) {
    flashTooltip(btn, 'Bitte zuerst etwas eintragen');
    return;
  }

  // Pseudo-Processing-Delay für „AI-Feel"
  btn.classList.add('is-processing');
  btn.disabled = true;
  target.classList.add('ai-shimmer');

  const delay = 480 + Math.random() * 280;
  setTimeout(() => {
    const polished = polishText(original, ctx);
    if (polished && polished !== original) {
      target.dataset.aiOriginal = original;
      target.value = polished;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      flashTooltip(btn, 'Mit KI verfeinert', 'ok');
      maybeShowUndo(btn, target);
    } else {
      flashTooltip(btn, 'Bereits in optimaler Form', 'info');
    }
    btn.classList.remove('is-processing');
    btn.disabled = false;
    target.classList.remove('ai-shimmer');
  }, delay);
}

function flashTooltip(btn, msg, kind = '') {
  let tip = btn.parentElement.querySelector('.ai-tip');
  if (!tip) {
    tip = document.createElement('span');
    tip.className = 'ai-tip';
    btn.parentElement.appendChild(tip);
  }
  tip.textContent = msg;
  tip.dataset.kind = kind;
  tip.classList.add('is-visible');
  clearTimeout(tip._t);
  tip._t = setTimeout(() => tip.classList.remove('is-visible'), 2200);
}

function maybeShowUndo(btn, target) {
  let undo = btn.parentElement.querySelector('.ai-undo');
  if (!undo) {
    undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'ai-undo';
    undo.innerHTML = `<svg class="ico ico-sm"><use href="#i-undo"/></svg>`;
    undo.title = 'Original wiederherstellen';
    undo.addEventListener('click', () => {
      const orig = target.dataset.aiOriginal;
      if (orig != null) {
        target.value = orig;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        delete target.dataset.aiOriginal;
        undo.remove();
      }
    });
    btn.parentElement.appendChild(undo);
  }
  clearTimeout(undo._t);
  undo._t = setTimeout(() => undo.remove(), 8000);
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
