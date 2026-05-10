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

document.addEventListener('DOMContentLoaded', async () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Splash IMMER ausblenden, egal was passiert
  const safeRun = (fn) => { try { fn(); } catch (e) { console.warn('init err:', e); } };

  try {
    if (window.alsterDb) await window.alsterDb.ready();
  } catch (e) { console.warn('db ready err:', e); }

  safeRun(initDesign);
  safeRun(initContent);
  safeRun(initNav);
  safeRun(initStickyHeader);
  safeRun(initReveal);
  safeRun(initCookieBanner);
  safeRun(initNotice);
  safeRun(initMenu);
  safeRun(initHours);
  safeRun(initLunchWeek);
  safeRun(initLandingTeaser);
  safeRun(initReservationForm);
  safeRun(initLiveStatus);
  safeRun(initEditMode);
  safeRun(initServiceWorker);
  hideSplash();

  // Live-Sync: jede Aenderung im Backend (auch von einem anderen Geraet
  // des Inhabers) erscheint sofort auf dieser Seite
  window.alsterDb?.subscribe((key) => {
    switch (key) {
      case 'design':      initDesign(); break;
      case 'content':     initContent(); break;
      case 'notice':      initNotice(); break;
      case 'menu':        initMenu(); break;
      case 'hours':       initHours(); break;
      case 'weekly-menu': initLunchWeek(); break;
    }
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

/* ---------- Spotlight (subtiler Maus-Halo, nur Desktop) ---------- */
function initSpotlight() {
  if (matchMedia('(pointer: coarse)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const el = document.createElement('div');
  el.className = 'spotlight';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  let raf = 0, x = 0, y = 0;
  window.addEventListener('mousemove', (e) => {
    x = e.clientX; y = e.clientY;
    if (!raf) raf = requestAnimationFrame(() => {
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf = 0;
    });
  }, { passive: true });
}

/* ---------- Magnetic Buttons (subtile Maus-Anziehung) ---------- */
function initMagneticButtons() {
  if (matchMedia('(pointer: coarse)').matches) return; // nicht auf Touch-Geraeten
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('.btn-primary, .btn-gold, .nav-shop').forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      btn.style.transform = `translate(${x * 0.18}px, ${y * 0.18}px)`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  });
}

/* ---------- Loading-Splash beim ersten Laden ---------- */
function hideSplash() {
  const splash = document.getElementById('app-splash');
  if (!splash) return;
  splash.classList.add('is-leaving');
  setTimeout(() => splash.remove(), 600);
}

/* ---------- Live-Status-Pille ("Aktuell geöffnet") ---------- */
function initLiveStatus() {
  const el = document.getElementById('live-status');
  if (!el) return;
  const update = () => {
    const status = computeLiveStatus();
    if (!status) { el.hidden = true; return; }
    el.hidden = false;
    el.dataset.state = status.state;
    el.querySelector('.live-status-text').textContent = status.text;
  };
  update();
  // Jede Minute neu rechnen
  setInterval(update, 60_000);
}

function computeLiveStatus() {
  // Öffnungszeiten parsen — entweder aus dem Admin-Cache oder aus DOM
  const hours = parseHoursFromDom();
  if (!hours.length) return null;
  const now = new Date();
  const wd = (now.getDay() + 6) % 7; // 0 = Mo, 6 = So
  const today = hours[wd];
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  if (today && today.openMin != null && minutesNow >= today.openMin && minutesNow < today.closeMin) {
    const remaining = today.closeMin - minutesNow;
    return {
      state: 'open',
      text: remaining <= 60
        ? `Aktuell geöffnet · schließt in ${remaining} Min.`
        : `Aktuell geöffnet · bis ${formatMin(today.closeMin)}`
    };
  }
  // Geschlossen — nächsten Öffnungszeitpunkt finden
  for (let offset = 0; offset < 7; offset++) {
    const idx = (wd + offset) % 7;
    const day = hours[idx];
    if (!day || day.openMin == null) continue;
    if (offset === 0 && minutesNow < day.openMin) {
      return {
        state: 'closed',
        text: `Geschlossen · öffnet heute um ${formatMin(day.openMin)}`
      };
    }
    if (offset > 0) {
      const dayName = offset === 1 ? 'morgen'
                    : ['Mo','Di','Mi','Do','Fr','Sa','So'][idx];
      return {
        state: 'closed',
        text: `Geschlossen · öffnet ${dayName} um ${formatMin(day.openMin)}`
      };
    }
  }
  return { state: 'closed', text: 'Aktuell geschlossen' };
}

function parseHoursFromDom() {
  // Erstellt Array[7] mit {openMin, closeMin} aus der hours-list
  const items = document.querySelectorAll('#hours-list li');
  const out = new Array(7).fill(null);
  const dayMap = {
    'mo': [0], 'di': [1], 'mi': [2], 'do': [3], 'fr': [4], 'sa': [5], 'so': [6],
    'mo – fr': [0,1,2,3,4], 'mo–fr': [0,1,2,3,4], 'mo - fr': [0,1,2,3,4],
    'montag': [0], 'dienstag': [1], 'mittwoch': [2], 'donnerstag': [3],
    'freitag': [4], 'samstag': [5], 'sonntag': [6]
  };
  items.forEach(li => {
    const spans = li.querySelectorAll('span');
    if (spans.length < 2) return;
    const label = spans[0].textContent.trim().toLowerCase();
    const time = spans[1].textContent.trim();
    const match = time.match(/(\d{1,2}):(\d{2})\s*[–\-]\s*(\d{1,2}):(\d{2})/);
    if (!match) return;
    const openMin = parseInt(match[1]) * 60 + parseInt(match[2]);
    const closeMin = parseInt(match[3]) * 60 + parseInt(match[4]);
    const days = dayMap[label] || [];
    days.forEach(d => out[d] = { openMin, closeMin });
  });
  return out;
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

  // Hero-Bild
  const heroMark = document.querySelector('.hero-mark');
  const heroVisual = document.querySelector('.hero-visual');
  if (heroVisual) {
    let heroImg = heroVisual.querySelector('.hero-photo');
    if (design.heroImage) {
      if (heroMark) heroMark.style.display = 'none';
      if (!heroImg) {
        heroImg = document.createElement('div');
        heroImg.className = 'hero-photo';
        heroVisual.appendChild(heroImg);
      }
      heroImg.style.backgroundImage = `url("${design.heroImage}")`;
    } else {
      if (heroMark) heroMark.style.display = '';
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
  // Nur auf Mittagstisch-Seite aktiv
  if (!document.getElementById('lunch-today') && !document.getElementById('lunch-week-list')) return;
  const today = new Date();
  const monday = mondayOf(today);
  const weekData = loadCurrentWeek(monday);
  renderWeekMeta(monday);
  renderTodayLunch(weekData, today);
  renderWeekList(weekData, monday, today);
}

/* Today-Feature-Block auf der Home-Page: nur das heutige Tagesgericht */
function initLandingTeaser() {
  const block    = document.getElementById('today-feature');
  const dayEl    = document.getElementById('today-feature-day');
  const kickerEl = document.getElementById('today-feature-kicker');
  const dishEl   = document.getElementById('today-feature-dish');
  const sideEl   = document.getElementById('today-feature-side');
  if (!block || !dishEl) return;

  const today = new Date();
  const monday = mondayOf(today);
  const weekData = loadCurrentWeek(monday);
  const dayIdx = (today.getDay() + 6) % 7;
  const dayKey = DAY_KEYS[dayIdx];
  const entry  = weekData?.days?.[dayKey];

  if (dayEl) dayEl.textContent = DAY_LABELS[dayIdx];

  if (entry?.dish && !entry.closed) {
    block.dataset.state = 'open';
    if (kickerEl) kickerEl.textContent = 'Heute kochen wir für Sie';
    dishEl.textContent = entry.dish;
    if (sideEl) {
      sideEl.textContent = entry.side ? `mit ${entry.side}` : '';
      sideEl.hidden = !entry.side;
    }
  } else if (entry?.closed) {
    block.dataset.state = 'closed';
    if (kickerEl) kickerEl.textContent = 'Wir machen heute Pause';
    dishEl.textContent = 'Bis morgen — wir freuen uns auf Sie.';
    if (sideEl) sideEl.hidden = true;
  } else {
    block.dataset.state = 'empty';
    if (kickerEl) kickerEl.textContent = 'Schauen Sie einfach vorbei';
    dishEl.textContent = 'Frische Brötchen, Croques und Kaffee — den ganzen Tag.';
    if (sideEl) sideEl.hidden = true;
  }
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
  if (!todayBox || !emptyBox) return;
  const dayIdx = (today.getDay() + 6) % 7;
  const dayKey = DAY_KEYS[dayIdx];
  const dayLabel = DAY_LABELS[dayIdx];
  const entry = weekData?.days?.[dayKey];

  const nameEl = document.getElementById('today-name');
  if (nameEl) nameEl.textContent = dayLabel;

  if (entry?.dish && !entry.closed) {
    const dishEl = document.getElementById('today-dish');
    const sideEl = document.getElementById('today-side');
    if (dishEl) dishEl.textContent = entry.dish;
    if (sideEl) {
      sideEl.textContent = entry.side || '';
      sideEl.hidden = !entry.side;
    }
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
