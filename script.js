/* Alstercafé · Hauptseite */

document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  initNav();
  initReveal();
  initNotice();
  initLunchWeek();
  initReservationForm();
});

/* ---------- Hinweis-Banner ---------- */
function initNotice() {
  const banner = document.getElementById('notice-banner');
  const text   = document.getElementById('notice-text');
  if (!banner || !text) return;
  let value = '';
  try { value = (localStorage.getItem('alstercafe.notice') || '').trim(); } catch {}
  if (value) {
    text.textContent = value;
    banner.hidden = false;
  }
}

/* ---------- Mobile-Navigation ---------- */
function initNav() {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('primary-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
  });
  nav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ---------- Scroll-Reveal ---------- */
function initReveal() {
  const reveals = document.querySelectorAll('.reveal');
  if (!reveals.length) return;
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
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  reveals.forEach(el => io.observe(el));
}

/* ---------- Mittagstisch (Wochenplan) ---------- */
const STORAGE_KEY = 'alstercafe.weekly-menu';
const DAY_KEYS = ['mon','tue','wed','thu','fri','sat','sun'];
const DAY_LABELS = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];

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
    const raw = localStorage.getItem(STORAGE_KEY);
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
  const todayBox  = document.getElementById('lunch-today');
  const emptyBox  = document.getElementById('lunch-empty');
  const dayIdx    = (today.getDay() + 6) % 7;
  const dayKey    = DAY_KEYS[dayIdx];
  const dayLabel  = DAY_LABELS[dayIdx];
  const entry     = weekData?.days?.[dayKey];

  document.getElementById('today-name').textContent = dayLabel;

  if (entry?.dish && !entry.closed) {
    document.getElementById('today-dish').textContent = entry.dish;
    const sideEl = document.getElementById('today-side');
    sideEl.textContent = entry.side ? entry.side : '';
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
    window.location.href = `mailto:hallo@alstercafe.de?subject=${encodeURIComponent(subject)}&body=${body}`;
    setFormStatus(status, 'Ihr E-Mail-Programm wurde geöffnet. Bitte senden Sie die Anfrage ab.', 'ok');
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
function isoDate(d) { return d.toISOString().slice(0,10); }
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
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
