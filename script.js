/* Alstercafé · Hauptseite */

const STORAGE_LUNCH    = 'alstercafe.weekly-menu';
const STORAGE_NOTICE   = 'alstercafe.notice';
const STORAGE_CONSENT  = 'alstercafe.consent';
const STORAGE_MENU     = 'alstercafe.menu';
const STORAGE_HOURS    = 'alstercafe.hours';
const STORAGE_DESIGN   = 'alstercafe.design';
const STORAGE_CONTENT  = 'alstercafe.content';

const DAY_KEYS   = ['mon','tue','wed','thu','fri','sat','sun'];
const DAY_LABELS = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];

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

document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  initDesign();
  initContent();
  initNav();
  initStickyHeader();
  initReveal();
  initCookieBanner();
  initNotice();
  initMenu();
  initHours();
  initLunchWeek();
  initReservationForm();
  initEditMode();
  // Cross-Tab Sync
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_DESIGN)  initDesign();
    if (e.key === STORAGE_CONTENT) initContent();
  });
});

/* ---------- Inhalts-Overrides (gespeicherte Custom-Texte) ---------- */
function initContent() {
  let content = {};
  try { content = JSON.parse(localStorage.getItem(STORAGE_CONTENT) || '{}'); } catch {}
  document.querySelectorAll('[data-editable]').forEach(el => {
    const key = el.dataset.editable;
    if (content[key] != null) el.innerHTML = content[key];
  });
}

/* ---------- Inline-Bearbeitungsmodus ---------- */
function initEditMode() {
  const params = new URLSearchParams(window.location.search);
  const isEdit = params.get('edit') === '1';
  if (!isEdit) return;

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

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'edit-toolbar';
  toolbar.innerHTML = `
    <div class="edit-toolbar-inner">
      <span class="edit-dot"></span>
      <div class="edit-info">
        <strong>Bearbeitungsmodus</strong>
        <small id="edit-status">Klicken Sie auf einen Text, um ihn zu ändern.</small>
      </div>
      <button type="button" class="btn btn-link danger" id="edit-reset" title="Originaltexte wiederherstellen">Zurücksetzen</button>
      <button type="button" class="btn btn-primary" id="edit-exit">Fertig</button>
    </div>
  `;
  document.body.appendChild(toolbar);

  document.getElementById('edit-exit').addEventListener('click', () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('edit');
    window.location.href = url.toString();
  });

  document.getElementById('edit-reset').addEventListener('click', () => {
    if (!confirm('Alle bearbeiteten Texte auf den Original-Zustand zurücksetzen?')) return;
    try { localStorage.removeItem(STORAGE_CONTENT); } catch {}
    location.reload();
  });
}

function onEditFocus(e) {
  e.currentTarget.dataset.editOriginal = e.currentTarget.innerHTML;
  setEditStatus('Tippen Sie Ihren Text – Speichern beim Verlassen des Feldes.');
}

function onEditBlur(e) {
  const el = e.currentTarget;
  const key = el.dataset.editable;
  const newValue = el.innerHTML.trim();
  const original = el.dataset.editOriginal || '';
  if (newValue === original) {
    setEditStatus('Keine Änderung.');
    return;
  }
  let content = {};
  try { content = JSON.parse(localStorage.getItem(STORAGE_CONTENT) || '{}'); } catch {}
  content[key] = newValue;
  try {
    localStorage.setItem(STORAGE_CONTENT, JSON.stringify(content));
    setEditStatus('Gespeichert · ' + new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), 'ok');
  } catch (err) {
    setEditStatus('Speicher voll: ' + err.message, 'error');
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

  // Hero-Bild
  const illust = document.querySelector('.illust-hero');
  const heroVisual = document.querySelector('.hero-visual');
  if (heroVisual) {
    let heroImg = heroVisual.querySelector('.hero-photo');
    if (design.heroImage) {
      if (illust) illust.style.display = 'none';
      if (!heroImg) {
        heroImg = document.createElement('div');
        heroImg.className = 'hero-photo';
        heroVisual.appendChild(heroImg);
      }
      heroImg.style.backgroundImage = `url("${design.heroImage}")`;
    } else {
      if (illust) illust.style.display = '';
      if (heroImg) heroImg.remove();
    }
  }

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
  if (!gallery.length) {
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
    const reservation = document.getElementById('reservierung');
    if (reservation) reservation.parentElement.insertBefore(section, reservation);
    else document.querySelector('main').appendChild(section);
  }
  section.hidden = false;
  const grid = section.querySelector('.gallery-grid');
  grid.innerHTML = '';
  gallery.forEach((src, i) => {
    const item = document.createElement('figure');
    item.className = 'gallery-item' + (i === 0 ? ' is-feature' : '');
    item.innerHTML = `<img src="${src}" alt="" loading="lazy" />`;
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
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  nav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ---------- Reveal-on-Scroll ---------- */
function initReveal() {
  const reveals = document.querySelectorAll('.reveal');
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
      siblings.forEach((el, i) => el.style.setProperty('--reveal-delay', `${Math.min(i * 80, 320)}ms`));
    }
  });

  if (!('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  reveals.forEach(el => io.observe(el));
}

/* ---------- Cookie-Banner ---------- */
function initCookieBanner() {
  const banner   = document.getElementById('cookie-banner');
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
  const banner = document.getElementById('notice-banner');
  const text   = document.getElementById('notice-text');
  if (!banner || !text) return;
  let value = '';
  try { value = (localStorage.getItem(STORAGE_NOTICE) || '').trim(); } catch {}
  if (value) {
    text.textContent = value;
    banner.hidden = false;
  }
}

/* ---------- Speisekarte ----------
   HTML enthaelt Standard-Inhalte. JS ueberschreibt nur, wenn der
   Inhaber im Mitgliederbereich eigene Inhalte gespeichert hat. */
function initMenu() {
  const root = document.getElementById('menu-cols');
  if (!root) return;

  let stored = null;
  try {
    const raw = localStorage.getItem(STORAGE_MENU);
    if (raw) stored = JSON.parse(raw);
  } catch {}
  if (!stored || typeof stored !== 'object') return; // Standard-HTML beibehalten

  const data = mergeMenu(stored);
  const hasItems = ['fruehstueck','backwaren','getraenke']
    .some(k => data[k] && Array.isArray(data[k].items) && data[k].items.length);
  if (!hasItems) return;

  root.innerHTML = '';
  ['fruehstueck','backwaren','getraenke'].forEach(key => {
    const cat = data[key];
    if (!cat || !Array.isArray(cat.items) || !cat.items.length) return;
    const col = document.createElement('div');
    col.className = 'menu-col reveal in';
    col.innerHTML = `
      <div class="menu-col-head">
        <svg class="ico"><use href="#${escapeAttr(cat.icon || DEFAULT_MENU[key].icon)}"/></svg>
        <h3>${escapeHtml(cat.title || DEFAULT_MENU[key].title)}</h3>
      </div>
      <ul class="menu-list">
        ${cat.items.map(it => `
          <li>
            <strong>${escapeHtml(it.name || '')}</strong>
            <span>${escapeHtml(it.description || '')}</span>
          </li>
        `).join('')}
      </ul>
    `;
    root.appendChild(col);
  });
}

function mergeMenu(stored) {
  const out = JSON.parse(JSON.stringify(DEFAULT_MENU));
  Object.keys(out).forEach(k => {
    if (stored[k]) {
      out[k].title = stored[k].title || out[k].title;
      out[k].icon  = stored[k].icon  || out[k].icon;
      if (Array.isArray(stored[k].items)) out[k].items = stored[k].items;
    }
  });
  return out;
}

/* ---------- Öffnungszeiten ----------
   HTML enthaelt Standard-Werte. JS ueberschreibt nur bei Custom-Daten. */
function initHours() {
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
  const today = new Date();
  const monday = mondayOf(today);
  const weekData = loadCurrentWeek(monday);
  renderWeekMeta(monday);
  renderTodayLunch(weekData, today);
  renderWeekList(weekData, monday, today);
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
  el.textContent = `KW ${isoWeek(monday)} · ${formatShort(monday)} – ${formatShort(sunday)}`;
}

function renderTodayLunch(weekData, today) {
  const todayBox = document.getElementById('lunch-today');
  const emptyBox = document.getElementById('lunch-empty');
  const dayIdx = (today.getDay() + 6) % 7;
  const dayKey = DAY_KEYS[dayIdx];
  const dayLabel = DAY_LABELS[dayIdx];
  const entry = weekData?.days?.[dayKey];

  document.getElementById('today-name').textContent = dayLabel;

  if (entry?.dish && !entry.closed) {
    document.getElementById('today-dish').textContent = entry.dish;
    const sideEl = document.getElementById('today-side');
    sideEl.textContent = entry.side || '';
    sideEl.hidden = !entry.side;
    todayBox.hidden = false;
    emptyBox.hidden = true;
  } else {
    todayBox.hidden = true;
    emptyBox.hidden = false;
  }
}

function renderWeekList(weekData, monday, today) {
  const list = document.getElementById('lunch-week-list');
  if (!list) return;
  list.innerHTML = '';
  DAY_KEYS.forEach((key, idx) => {
    const date = new Date(monday); date.setDate(date.getDate() + idx);
    const entry = weekData?.days?.[key];
    const isToday = isSameDay(date, today);
    const li = document.createElement('li');
    li.className = 'lunch-day' + (isToday ? ' is-today' : '');
    let body;
    if (entry?.closed) {
      body = '<span class="lunch-closed">Kein Mittagstisch</span>';
    } else if (entry?.dish) {
      body = `<span class="lunch-day-dish">${escapeHtml(entry.dish)}</span>`;
      if (entry.side) body += `<span class="lunch-day-side">${escapeHtml(entry.side)}</span>`;
    } else {
      body = '<span class="lunch-pending">— folgt in Kürze —</span>';
    }
    li.innerHTML = `
      <div class="lunch-day-head">
        <span class="lunch-day-name">${DAY_LABELS[idx]}</span>
        <span class="lunch-day-date">${formatDay(date)}</span>
      </div>
      <div class="lunch-day-body">${body}</div>
    `;
    list.appendChild(li);
  });
}

/* ---------- Reservierungs-Formular ---------- */
function initReservationForm() {
  const form = document.getElementById('reservation-form');
  if (!form) return;
  const status = form.querySelector('.form-status');
  const dateInput = form.querySelector('input[name="Datum"]');
  if (dateInput) {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.min = isoDate(new Date());
    if (!dateInput.value) dateInput.value = isoDate(tomorrow);
  }
  const submitBtn = form.querySelector('.form-submit');
  form.addEventListener('submit', e => {
    if (!form.checkValidity()) {
      e.preventDefault();
      const firstInvalid = form.querySelector(':invalid');
      if (firstInvalid) firstInvalid.focus();
      setFormStatus(status, 'Bitte füllen Sie alle Pflichtfelder (*) aus.', 'error');
      return;
    }
    const data = new FormData(form);
    const subject = `Reservierungsanfrage – ${data.get('Name') || ''}`;
    const lines = [
      `Name: ${data.get('Name') || ''}`,
      `Telefon: ${data.get('Telefon') || ''}`,
      `E-Mail: ${data.get('E-Mail') || ''}`,
      `Datum: ${data.get('Datum') || ''}`,
      `Uhrzeit: ${data.get('Uhrzeit') || ''}`,
      `Personen: ${data.get('Personen') || ''}`,
      '',
      'Nachricht:',
      data.get('Nachricht') || '–'
    ];
    const body = encodeURIComponent(lines.join('\n'));
    e.preventDefault();

    if (submitBtn) {
      submitBtn.classList.add('is-loading');
      submitBtn.disabled = true;
    }
    setFormStatus(status, 'Anfrage wird vorbereitet …');

    setTimeout(() => {
      window.location.href = `mailto:info@alstercafe.de?subject=${encodeURIComponent(subject)}&body=${body}`;
      if (submitBtn) {
        submitBtn.classList.remove('is-loading');
        submitBtn.classList.add('is-success');
        submitBtn.disabled = false;
      }
      setFormStatus(status, 'Ihr E-Mail-Programm wurde geöffnet. Bitte senden Sie die Anfrage ab — wir bestätigen schnellstmöglich.', 'ok');
    }, 600);
  });
}

function setFormStatus(el, msg, kind = '') {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('ok', 'error');
  if (kind) el.classList.add(kind);
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
