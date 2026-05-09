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
  try { return localStorage.getItem(AUTH_KEY) === '1'; }
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
    try { localStorage.setItem(AUTH_KEY, '1'); } catch {}
    setStatus(dom.loginStatus, '');

    // Wenn der Login durch Edit-Mode-Aufruf ausgeloest wurde:
    // direkt zurueck in den Bearbeitungsmodus
    const params = new URLSearchParams(window.location.search);
    if (params.get('next') === 'edit') {
      window.location.href = 'index.html?edit=1';
      return;
    }
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
  try { localStorage.removeItem(AUTH_KEY); } catch {}
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
  renderDesignEditor();
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
      <label>
        <span>Bezeichnung</span>
        <input type="text" class="menu-item-name" value="${escapeAttr(item.name || '')}" placeholder="z. B. Cappuccino" />
      </label>
      <label>
        <span>Beschreibung</span>
        <input type="text" class="menu-item-desc" value="${escapeAttr(item.description || '')}" placeholder="z. B. Espresso mit feinem Milchschaum" />
      </label>
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
      try {
        const dataUrl = await compressImage(file, MAX_IMAGE_PX[key] || 1200, 0.85);
        const design = loadDesign();
        design[key] = dataUrl;
        saveDesign(design);
        renderImageSlot(slot, dataUrl);
        flashDesignStatus('Bild gespeichert.');
      } catch (err) {
        flashDesignStatus('Fehler: ' + err.message, 'error');
      } finally {
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
  galleryInput?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const design = loadDesign();
    const gallery = Array.isArray(design.gallery) ? design.gallery.slice() : [];
    for (const file of files) {
      if (gallery.length >= GALLERY_MAX) break;
      try {
        const dataUrl = await compressImage(file, MAX_IMAGE_PX.gallery, 0.82);
        gallery.push(dataUrl);
      } catch (err) { /* skip */ }
    }
    design.gallery = gallery;
    saveDesign(design);
    renderGalleryEdit();
    flashDesignStatus(`${files.length} Bild(er) hinzugefügt.`);
    galleryInput.value = '';
  });

  // Color-Presets + Custom
  document.querySelectorAll('.color-chip').forEach(chip => {
    chip.addEventListener('click', () => setAccentColor(chip.dataset.color));
  });
  const colorInput = document.getElementById('color-input');
  colorInput?.addEventListener('input', (e) => setAccentColor(e.target.value));

  // Reset all design
  document.getElementById('design-reset')?.addEventListener('click', () => {
    if (!confirm('Alle Design-Anpassungen (Logo, Bilder, Galerie, Farbe) entfernen?')) return;
    try { localStorage.removeItem(DESIGN_KEY); } catch {}
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
    grid.appendChild(tile);
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
  try { return JSON.parse(localStorage.getItem(DESIGN_KEY) || '{}'); }
  catch { return {}; }
}
function saveDesign(obj) {
  try { localStorage.setItem(DESIGN_KEY, JSON.stringify(obj)); }
  catch (err) { flashDesignStatus('Speicher voll: bitte weniger Bilder laden.', 'error'); }
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

/* Bildkompression via Canvas */
function compressImage(file, maxPx = 1400, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Keine Bilddatei'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
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
