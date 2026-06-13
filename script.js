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
  ['logo','heroImage','aboutImage','accentColor'].forEach(k => {
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
  safeRun(initStickyToday);
  safeRun(initCounters);
  safeRun(initMagnetic);
  safeRun(initPremiumPolish);
  safeRun(initReservationForm);
  safeRun(initOrderForm);
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
  let raw = {};
  try { raw = JSON.parse(localStorage.getItem(STORAGE_CONTENT) || '{}'); } catch {}
  const content = validateContent(raw) || {};
  document.querySelectorAll('[data-editable]').forEach(el => {
    const key = el.dataset.editable;
    if (typeof content[key] === 'string' && content[key].length < 5000) {
      el.innerHTML = content[key];
    }
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
  // Premium-Stempel braucht ~1.4s zum Einzeichnen — wir warten,
  // damit Maria's Brand-Mark sich ruhig setzen kann
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dwell = reduceMotion ? 0 : 1400;
  setTimeout(() => {
    splash.classList.add('is-leaving');
    setTimeout(() => splash.remove(), 600);
  }, dwell);
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
      </div>
    `;
    // Reihenfolge: Galerie kommt VOR dem Closer mit "Fin.",
    // sonst macht das Schlusszeichen keinen Sinn.
    const closer = document.querySelector('.landing-closer');
    const reservation = document.getElementById('reservierung');
    if (closer) closer.parentElement.insertBefore(section, closer);
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
      <span class="gallery-empty-desc">Bis zu 6 Bilder hochladen — Eckcafé, Croques, Brötchen, Innenraum. Im Mitgliederbereich unter „Bilder hochladen".</span>
      <span class="gallery-empty-link">Zum Mitgliederbereich →</span>
    `;
    grid.appendChild(ph);
    return;
  }

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
  const setOpen = (open) => {
    nav.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
  };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));
  // ESC schließt das Menü
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.classList.contains('open')) setOpen(false);
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
  // Sunday-Spillover (spiegelt admin.js maybeEnableSundaySpillover):
  // Am Sonntag traegt der Inhaber die kommende Woche ein — die Wochenliste
  // zeigt sie daher sonntags an. Das heutige Sonntags-Gericht wird weiterhin
  // aus der laufenden Woche geladen (dort speichert admin den Spillover).
  const isSunday = today.getDay() === 0;
  const displayMonday = isSunday
    ? mondayOf(new Date(today.getTime() + 86400000))
    : mondayOf(today);
  const todayWeekData   = loadCurrentWeek(mondayOf(today));
  const displayWeekData = loadCurrentWeek(displayMonday);
  renderWeekMeta(displayMonday);
  renderTodayLunch(todayWeekData, today);
  renderWeekList(displayWeekData, displayMonday, today);
}

/* Today-Feature-Block auf der Home-Page:
   - Vor 15:00 (Schliesszeit): heutiges Tagesgericht
   - Ab 15:00 (Cafe geschlossen): Vorschau auf morgen */
function initLandingTeaser() {
  const block    = document.getElementById('today-feature');
  const prefixEl = document.getElementById('today-feature-prefix');
  const dayEl    = document.getElementById('today-feature-day');
  const kickerEl = document.getElementById('today-feature-kicker');
  const dishEl   = document.getElementById('today-feature-dish');
  const sideEl   = document.getElementById('today-feature-side');
  if (!block || !dishEl) return;

  const now = new Date();
  const showTomorrow = now.getHours() >= 15;
  const targetDate = new Date(now);
  if (showTomorrow) targetDate.setDate(targetDate.getDate() + 1);

  const monday = mondayOf(targetDate);
  const weekData = loadCurrentWeek(monday);
  const dayIdx = (targetDate.getDay() + 6) % 7;
  const dayKey = DAY_KEYS[dayIdx];
  const entry  = weekData?.days?.[dayKey];

  if (prefixEl) prefixEl.textContent = showTomorrow ? 'Morgen' : 'Heute';
  if (dayEl)    dayEl.textContent    = DAY_LABELS[dayIdx];

  if (entry?.dish && !entry.closed) {
    block.dataset.state = 'open';
    if (kickerEl) kickerEl.textContent = showTomorrow
      ? 'Morgen mittag bei uns'
      : 'Heute mittag bei uns';
    dishEl.textContent = entry.dish;
    if (sideEl) {
      sideEl.textContent = entry.side ? `mit ${entry.side}` : '';
      sideEl.hidden = !entry.side;
    }
  } else if (entry?.closed) {
    block.dataset.state = 'closed';
    if (kickerEl) kickerEl.textContent = showTomorrow
      ? 'Morgen geschlossen'
      : 'Wir machen heute Pause';
    dishEl.textContent = showTomorrow
      ? 'Übermorgen geht es weiter — wir freuen uns auf Sie.'
      : 'Bis morgen — wir freuen uns auf Sie.';
    if (sideEl) sideEl.hidden = true;
  } else {
    block.dataset.state = 'empty';
    if (kickerEl) kickerEl.textContent = showTomorrow
      ? `Morgen · ${DAY_LABELS[dayIdx]}`
      : 'Schauen Sie einfach vorbei';
    dishEl.textContent = showTomorrow
      ? 'Eintrag folgt in Kürze.'
      : 'Frische Brötchen, Croques und Kaffee — den ganzen Tag.';
    if (sideEl) sideEl.hidden = true;
  }
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
    const fmt = now.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    editionDate.textContent = fmt;
  }
  const editionNo = document.getElementById('edition-no');
  if (editionNo) {
    // No. = Tag im Jahr (1..366) — wie eine Tageszeitung
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = (now - start) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
    const dayOfYear = Math.floor(diff / 86400000);
    editionNo.textContent = String(dayOfYear).padStart(3, '0');
  }
  const heroToday = document.getElementById('hero-coord-today');
  if (heroToday) {
    const now = new Date();
    const wd = now.toLocaleDateString('de-DE', { weekday: 'long' });
    const dayIdx = now.getDay(); // 0=So, 1=Mo, ..., 6=Sa
    // Mo-Fr: 06:30-15:00, Sa/So: 07:30-15:00
    const hours = (dayIdx >= 1 && dayIdx <= 5) ? '06:30 – 15:00' : '07:30 – 15:00';
    heroToday.textContent = `${wd} · ${hours}`;
  }

  // 4. Custom Cursor · Dot + Ring, magnetisch auf CTAs
  initCustomCursor(reduceMotion);

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
    const wd = now.toLocaleDateString('de-DE', { weekday: 'short' });
    const next = `${wd}, ${hh}:${mm}`;
    if (next !== lastText) {
      timeEl.textContent = next;
      if (lastText) {
        timeEl.classList.add('is-tick');
        setTimeout(() => timeEl.classList.remove('is-tick'), 700);
      }
      lastText = next;
    }

    // Closed-Status
    const dayIdx = now.getDay();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const open = (dayIdx >= 1 && dayIdx <= 5) ? 390 : 450;
    const close = 900;
    const isOpen = minutes >= open && minutes < close;
    clock.classList.toggle('is-closed', !isOpen);
  };
  update();
  setInterval(update, 30 * 1000);
}

function injectReservationTips() {
  const intro = document.querySelector('.reservation-intro');
  if (!intro) return;
  if (intro.querySelector('.reservation-tips')) return;

  const tips = document.createElement('aside');
  tips.className = 'reservation-tips';
  tips.innerHTML = `
    <p class="reservation-tips-eyebrow">Gut zu wissen</p>
    <ul class="reservation-tips-list">
      <li data-mark="·">Sonntag- und Samstagvormittag ist <em>am stärksten</em> nachgefragt.</li>
      <li data-mark="·">Größere Gruppen (ab 6 Pers.) bitte einen Tag <em>vorher</em>.</li>
      <li data-mark="·">Wir melden uns am <em>gleichen Tag</em> per Anruf oder Mail zurück.</li>
    </ul>
  `;
  intro.appendChild(tips);
}

function injectTopbarLiveStatus() {
  const topbar = document.querySelector('.topbar-inner');
  if (!topbar) return;
  if (topbar.querySelector('.topbar-live')) return;

  // Live-Status berechnen (parallel zur grossen Hero-Pille)
  const now = new Date();
  const dayIdx = now.getDay(); // 0=So, 1=Mo, ..., 6=Sa
  const minutes = now.getHours() * 60 + now.getMinutes();
  // Mo-Fr: 06:30-15:00 = 390-900, Sa/So: 07:30-15:00 = 450-900
  const open = (dayIdx >= 1 && dayIdx <= 5) ? 390 : 450;
  const close = 900;
  const isOpen = minutes >= open && minutes < close;

  const formatHour = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const el = document.createElement('span');
  el.className = 'topbar-live' + (isOpen ? '' : ' is-closed');
  if (isOpen) {
    el.innerHTML = `Geöffnet bis <em>${formatHour(close)}</em>`;
  } else if (minutes < open) {
    el.innerHTML = `Heute ab <em>${formatHour(open)}</em>`;
  } else {
    // Nach 15:00 — morgen früh
    const tomorrow = (dayIdx + 1) % 7;
    const tomorrowOpen = (tomorrow >= 1 && tomorrow <= 5) ? 390 : 450;
    el.innerHTML = `Morgen ab <em>${formatHour(tomorrowOpen)}</em>`;
  }

  // Vor dem ersten Separator einsetzen (am Anfang der Inner-Row)
  const firstSep = topbar.querySelector('.topbar-sep');
  if (firstSep) {
    const sepClone = firstSep.cloneNode(true);
    topbar.insertBefore(el, topbar.firstChild);
    topbar.insertBefore(sepClone, el.nextSibling);
  } else {
    topbar.insertBefore(el, topbar.firstChild);
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
              font-family="'Fraunces', serif" font-style="italic"
              font-size="78" font-weight="400">A</text>
      </g>
      <text class="splash-est-arc">
        <textPath href="#splash-arc" startOffset="50%" text-anchor="middle">
          EST · 2010 · HOHENFELDE · HAMBURG ·
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
  const fmt = now.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
  header.innerHTML = `
    <p class="reservation-form-coupon-eyebrow">Ausgegeben am <em>${fmt}</em></p>
    <span class="reservation-form-coupon-stamp">№ Reservierung</span>
  `;
  form.insertBefore(header, form.firstChild);
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

  // Hours- und Address-Spalten zusammenstellen
  const adresseCol = document.createElement('div');
  adresseCol.className = 'footer-col footer-col-adresse';
  adresseCol.innerHTML = `
    <p class="footer-col-label">Besuch</p>
    <a href="https://www.google.com/maps/search/?api=1&query=Ifflandstra%C3%9Fe+45+22087+Hamburg" target="_blank" rel="noopener">Ifflandstraße 45</a>
    <a href="https://www.google.com/maps/search/?api=1&query=Ifflandstra%C3%9Fe+45+22087+Hamburg" target="_blank" rel="noopener">22087 Hamburg</a>
    <a href="tel:+494022692891">040 – 22 69 28 91</a>
    <a href="mailto:info@alstercafe.de">info@alstercafe.de</a>
  `;

  const hoursCol = document.createElement('div');
  hoursCol.className = 'footer-col footer-col-hours';
  hoursCol.innerHTML = `
    <p class="footer-col-label">Geöffnet</p>
    <div class="footer-line"><span>Mo – Fr</span><span class="time">06:30 – 15:00</span></div>
    <div class="footer-line"><span>Samstag</span><span class="time">07:30 – 15:00</span></div>
    <div class="footer-line"><span>Sonntag</span><span class="time">07:30 – 15:00</span></div>
  `;

  // Neue Reihenfolge: brand | adresse | hours
  grid.innerHTML = '';
  if (brand) grid.appendChild(brand);
  grid.appendChild(adresseCol);
  grid.appendChild(hoursCol);

  // Nav-Reihe wird unter dem Grid eingesetzt als eigener Block
  if (navHtml) {
    const navWrap = document.createElement('div');
    navWrap.className = 'footer-nav-wrap container';
    navWrap.innerHTML = `
      <p class="footer-col-label" style="margin-bottom:14px">Index</p>
      ${navHtml}
    `;
    // Footer-Credit (von injectFooterCredit) bleibt darunter
    footer.querySelector('.container').insertAdjacentElement('afterend', navWrap);
  }

  // Bottom-Strip mit Edition-Vol + Meta
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = (now - start) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
  const dayOfYear = Math.floor(diff / 86400000);
  const strip = document.createElement('div');
  strip.className = 'footer-bottom-strip container';
  strip.innerHTML = `
    <span>© ${year} <em>Alstercafé</em> · Croquenoah Cafe</span>
    <span>Vol. <em>XVI</em> · No. <em>${String(dayOfYear).padStart(3, '0')}</em></span>
  `;
  footer.appendChild(strip);
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
    // Inner-HTML in Wort- und Char-Spans aufteilen, em-Tags bewahren
    const walk = (node) => {
      if (node.nodeType === 3) {
        // Text-Knoten: jeden Char in ein span wrappen
        const frag = document.createDocumentFragment();
        const text = node.textContent;
        let charIdx = 0;
        for (const ch of text) {
          if (ch === ' ') {
            frag.appendChild(document.createTextNode(' '));
            continue;
          }
          const span = document.createElement('span');
          span.className = 'hero-char';
          span.style.setProperty('--char-i', charIdx);
          span.textContent = ch;
          frag.appendChild(span);
          charIdx++;
        }
        node.replaceWith(frag);
      } else if (node.nodeType === 1) {
        // Element: rekursiv reinwandern
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
  credit.innerHTML = 'Eine Familien-Backstube — <em>seit 2010 in Hohenfelde.</em>';
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
  const fmt = now.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = (now - start) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
  const dayOfYear = Math.floor(diff / 86400000);

  strip.innerHTML = `
    <div class="container edition-inner">
      <span class="edition-cell edition-date">${fmt}</span>
      <span class="edition-cell edition-vol">Vol. <em>XVI</em> &middot; No. <em>${String(dayOfYear).padStart(3, '0')}</em></span>
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

  // Fade-In beim Laden
  document.documentElement.animate(
    [
      { opacity: 0.001, transform: 'translateY(6px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ],
    { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }
  );

  // Fade-Out bei internem Link-Klick
  const sameOrigin = (href) => {
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
    try { return new URL(href, location.href).origin === location.origin; } catch { return false; }
  };

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    if (a.target === '_blank') return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (e.button !== 0) return;
    const href = a.getAttribute('href');
    if (!sameOrigin(href)) return;
    if (a.hasAttribute('download')) return;

    // Edge-Cases auf gleicher Seite skippen
    const url = new URL(href, location.href);
    if (url.pathname === location.pathname) {
      // Hash-Link → Browser/Smooth-Scroll uebernimmt
      if (url.hash) return;
      // Exact same URL inkl. Query → einfach Top-Scroll, kein Reload
      if (url.search === location.search) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    e.preventDefault();
    document.documentElement.animate(
      [
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0.001, transform: 'translateY(-4px)' }
      ],
      { duration: 240, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' }
    ).onfinish = () => { location.href = href; };
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

/* Counter-Animation: zaehlt hoch, wenn das Element ins Viewport kommt */
function initCounters() {
  const elements = document.querySelectorAll('.counter[data-counter-to]');
  if (!elements.length) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    elements.forEach(el => { el.textContent = el.dataset.counterTo; });
    return;
  }
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

/* Sticky-Today-Bar: erscheint beim Scrollen wenn ein Tagesgericht eingetragen ist */
function initStickyToday() {
  const bar = document.getElementById('sticky-today');
  const dishEl = document.getElementById('sticky-today-dish');
  const feature = document.getElementById('today-feature-dish');
  if (!bar || !dishEl || !feature) return;
  // Wenn vom User in dieser Session geschlossen, gar nicht zeigen
  try { if (sessionStorage.getItem('alstercafe.sticky-today.dismissed') === '1') return; } catch {}

  const featureSection = document.getElementById('today-feature');
  const updateContent = () => {
    // Nur anzeigen, wenn wirklich ein Tagesgericht eingetragen ist.
    // initLandingTeaser setzt data-state auf 'open' (Gericht), 'closed' oder 'empty'.
    const state = featureSection?.dataset.state;
    const dish = (feature.textContent || '').trim();
    if (state === 'open' && dish && dish !== '—' && dish.length < 200) {
      dishEl.textContent = dish;
      bar.dataset.ready = '1';
    } else {
      bar.dataset.ready = '';
    }
  };
  // Erstmal abwarten, bis initLandingTeaser den Text und data-state gesetzt hat
  setTimeout(updateContent, 500);
  // Bei spaeteren Aenderungen (Supabase-Subscribe) ebenfalls
  new MutationObserver(updateContent).observe(feature, { childList: true, characterData: true, subtree: true });
  if (featureSection) new MutationObserver(updateContent).observe(featureSection, { attributes: true, attributeFilter: ['data-state'] });

  const onScroll = () => {
    if (bar.dataset.ready !== '1') { bar.hidden = true; return; }
    const scrolled = window.scrollY || document.documentElement.scrollTop;
    const featureRect = document.getElementById('today-feature')?.getBoundingClientRect();
    // Bar einblenden sobald der Today-Feature-Block fast oben ist
    const featurePassed = featureRect && featureRect.bottom < window.innerHeight * 0.4;
    bar.hidden = !(scrolled > 400 && featurePassed);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  document.getElementById('sticky-today-close')?.addEventListener('click', () => {
    bar.hidden = true;
    try { sessionStorage.setItem('alstercafe.sticky-today.dismissed', '1'); } catch {}
  });
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
  const emptyText = document.querySelector('.lunch-empty-text');

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
  } else if (entry?.closed) {
    // Explizit als geschlossen markiert — bewusste Pause
    if (emptyText) emptyText.innerHTML = 'Heute servieren wir Frühstück &amp; Backwaren — kein Mittagstisch.';
    todayBox.hidden = true;
    emptyBox.hidden = false;
  } else {
    // Nicht eingetragen — ehrlich kommunizieren statt "kein Mittagstisch" zu behaupten
    if (emptyText) emptyText.innerHTML = 'Die heutige Karte wird gerade aktualisiert. <a href="tel:+494022692891">040 / 22 69 28 91</a> — wir verraten Ihnen das Tagesgericht gern.';
    todayBox.hidden = true;
    emptyBox.hidden = false;
  }
}

function renderWeekList(weekData, monday, today) {
  const list = document.getElementById('lunch-week-list');
  if (!list) return;
  list.innerHTML = '';

  // Wenn die gesamte Woche leer ist: konsolidierte Info statt 7x "folgt in Kürze"
  const days = weekData?.days || {};
  const hasAnyEntry = DAY_KEYS.some(k => days[k]?.dish || days[k]?.closed);
  if (!hasAnyEntry) {
    list.classList.add('lunch-week-empty');
    const li = document.createElement('li');
    li.className = 'lunch-week-empty-card';
    li.innerHTML = `
      <p class="lunch-week-empty-title">Die Wochenkarte wird gerade aktualisiert.</p>
      <p class="lunch-week-empty-text">Anrufen lohnt sich — wir verraten Ihnen das Tagesgericht gern direkt: <a href="tel:+494022692891">040 / 22 69 28 91</a>.</p>
    `;
    list.appendChild(li);
    return;
  }
  list.classList.remove('lunch-week-empty');

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

/* Baut eine Brötchen-Sorten-Zeile (für vom Inhaber gepflegte Sorten) */
function buildBroetchenRow(item) {
  const name = escapeHtml(item.name || '');
  const desc = escapeHtml(item.desc || '');
  const veg  = item.veg ? ' <span class="broetchen-badge">vegetarisch</span>' : '';
  return `
    <li class="broetchen-row" data-name="${escapeAttr(item.name || '')}">
      <div class="broetchen-info">
        <span class="broetchen-name">${name}${veg}</span>
        ${desc ? `<span class="broetchen-desc">${desc}</span>` : ''}
      </div>
      <div class="qty-stepper">
        <button type="button" class="qty-btn" data-step="-1" aria-label="Weniger ${name}">−</button>
        <span class="qty-value" aria-live="polite">0</span>
        <button type="button" class="qty-btn" data-step="1" aria-label="Mehr ${name}">+</button>
      </div>
    </li>`;
}

/* ---------- Bestellformular: belegte Brötchen ---------- */
function initOrderForm() {
  const form = document.getElementById('order-form');
  if (!form) return;
  const MIN_ORDER = 10;

  // Falls der Inhaber eigene Sorten gepflegt hat: Liste daraus neu aufbauen.
  // Sonst bleibt die statische Standard-Liste im HTML stehen.
  const sortListEl = document.getElementById('broetchen-list');
  let storedItems = null;
  try { storedItems = window.alsterDb?.get('broetchen-items'); } catch {}
  if (sortListEl && Array.isArray(storedItems) && storedItems.length) {
    const valid = storedItems.filter(it => it && typeof it.name === 'string' && it.name.trim());
    if (valid.length) sortListEl.innerHTML = valid.map(buildBroetchenRow).join('');
  }

  const rows = Array.from(document.querySelectorAll('.broetchen-row'));
  const countEl = document.getElementById('order-count');
  const listEl = document.getElementById('order-summary-list');
  const minNote = document.getElementById('order-min-note');
  const submitBtn = document.getElementById('order-submit');
  const status = document.getElementById('order-status');

  // Abholdatum: frühestens heute wählbar, Vorschlag = morgen (Vorlauf für Bulk)
  const dateInput = form.querySelector('input[name="Datum"]');
  const setDefaultDate = () => {
    if (!dateInput) return;
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.min = isoDate(today);
    dateInput.value = isoDate(tomorrow);
  };
  setDefaultDate();

  const getItems = () => rows
    .map(row => ({
      name: (row.dataset.name || '').replace(/&amp;/g, '&'),
      qty: parseInt(row.querySelector('.qty-value').textContent, 10) || 0
    }))
    .filter(it => it.qty > 0);

  const render = () => {
    const items = getItems();
    const total = items.reduce((s, it) => s + it.qty, 0);
    if (countEl) countEl.textContent = String(total);
    if (listEl) {
      listEl.innerHTML = items.length
        ? items.map(it => `<li><span>${escapeHtml(it.name)}</span><span class="order-summary-qty">${it.qty}×</span></li>`).join('')
        : '<li class="order-summary-empty">Noch nichts ausgewählt.</li>';
    }
    const ok = total >= MIN_ORDER;
    if (minNote) {
      if (total === 0) {
        minNote.textContent = `Mindestbestellung: ${MIN_ORDER} Brötchen.`;
        minNote.classList.remove('is-met', 'is-below');
      } else if (ok) {
        minNote.textContent = 'Mindestbestellung erreicht.';
        minNote.classList.add('is-met'); minNote.classList.remove('is-below');
      } else {
        minNote.textContent = `Noch ${MIN_ORDER - total} bis zur Mindestbestellung.`;
        minNote.classList.add('is-below'); minNote.classList.remove('is-met');
      }
    }
    if (submitBtn) submitBtn.disabled = !ok;
  };

  // Stepper-Buttons
  rows.forEach(row => {
    const valueEl = row.querySelector('.qty-value');
    row.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const step = parseInt(btn.dataset.step, 10) || 0;
        const next = Math.max(0, Math.min(200, (parseInt(valueEl.textContent, 10) || 0) + step));
        valueEl.textContent = String(next);
        row.classList.toggle('is-active', next > 0);
        // Nach einer erfolgreichen Bestellung den Erfolgs-Zustand zuruecksetzen
        submitBtn?.classList.remove('is-success');
        render();
      });
    });
  });
  render();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const items = getItems();
    const total = items.reduce((s, it) => s + it.qty, 0);
    if (total < MIN_ORDER) {
      setFormStatus(status, `Bitte wählen Sie mindestens ${MIN_ORDER} Brötchen.`, 'error');
      return;
    }
    if (!form.checkValidity()) {
      const firstInvalid = form.querySelector(':invalid');
      if (firstInvalid) firstInvalid.focus();
      setFormStatus(status, 'Bitte füllen Sie alle Pflichtfelder (*) aus.', 'error');
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

    if (submitBtn) { submitBtn.classList.add('is-loading'); submitBtn.disabled = true; }
    setFormStatus(status, 'Bestellung wird gesendet …');

    let saved = false;
    try { saved = !!(await window.alsterDb?.addOrder(entry)); }
    catch (err) { console.warn('Bestellung speichern fehlgeschlagen', err); }

    if (submitBtn) submitBtn.classList.remove('is-loading');
    if (saved) {
      if (submitBtn) submitBtn.classList.add('is-success');
      setFormStatus(status, `Vielen Dank! Ihre Bestellung über ${total} belegte Brötchen ist bei uns eingegangen. Wir bestätigen telefonisch oder per E-Mail.`, 'ok');
      try { form.reset(); } catch {}
      rows.forEach(row => { row.querySelector('.qty-value').textContent = '0'; row.classList.remove('is-active'); });
      setDefaultDate();
      render();
    } else {
      // Fallback: Mail-Programm
      const lines = items.map(it => `${it.qty}× ${it.name}`).join('\n');
      const subject = `Brötchen-Bestellung (${total} Stück) – ${entry.name}`;
      const body = encodeURIComponent(
        `Bestellung:\n${lines}\n\nGesamt: ${total} Brötchen\n` +
        `Abholung: ${entry.pickupDate} um ${entry.pickupTime}\n` +
        `Name: ${entry.name}\nTelefon: ${entry.phone}\nE-Mail: ${entry.email}\n\n` +
        `Wünsche:\n${entry.notes || '–'}`
      );
      window.location.href = `mailto:info@alstercafe.de?subject=${encodeURIComponent(subject)}&body=${body}`;
      setFormStatus(status, 'Bitte senden Sie die geöffnete E-Mail ab — wir bestätigen schnellstmöglich.', 'ok');
      render(); // Button-Status wiederherstellen, falls kein Mail-Programm vorhanden
    }
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
  form.addEventListener('submit', async e => {
    if (!form.checkValidity()) {
      e.preventDefault();
      const firstInvalid = form.querySelector(':invalid');
      if (firstInvalid) firstInvalid.focus();
      setFormStatus(status, 'Bitte füllen Sie alle Pflichtfelder (*) aus.', 'error');
      return;
    }
    e.preventDefault();
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

    if (submitBtn) {
      submitBtn.classList.add('is-loading');
      submitBtn.disabled = true;
    }
    setFormStatus(status, 'Anfrage wird gesendet …');

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
      setFormStatus(status, 'Vielen Dank! Ihre Anfrage ist bei uns eingegangen. Wir melden uns telefonisch oder per E-Mail.', 'ok');
      try { form.reset(); } catch {}
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
      setFormStatus(status, 'Bitte senden Sie die geöffnete E-Mail ab — wir bestätigen schnellstmöglich.', 'ok');
    }
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
