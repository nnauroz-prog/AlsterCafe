/* ============================================================
   Alstercafé · Mitarbeiter-Kalender (kalender.html)
   ============================================================
   Zugang mit dem 6-stelligen Code, den der Inhaber im Mitglieder-
   bereich festlegt. Geprüft wird in der Datenbank
   (supabase/staff-calendar.sql); zurück kommen nur Datum, Uhrzeit,
   Name, Personen bzw. Bestellung — keine Kontaktdaten. Nur ansehen.
   ============================================================ */
(function () {
  const KEY = 'alstercafe.staff-code';
  const $ = id => document.getElementById(id);
  let monday = null;
  let timer = null;

  const getCode = () => {
    try { return sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || ''; } catch { return ''; }
  };
  const saveCode = (code, remember) => {
    try {
      sessionStorage.setItem(KEY, code);
      if (remember) localStorage.setItem(KEY, code); else localStorage.removeItem(KEY);
    } catch {}
  };
  const clearCode = () => { try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch {} };
  const setStatus = (el, msg, kind) => {
    if (!el) return;
    el.textContent = msg || '';
    el.classList.remove('ok', 'error');
    if (kind) el.classList.add(kind);
  };
  const errorText = (err) => {
    if (err === 'invalid') return 'Der Code stimmt nicht.';
    if (err === 'locked') return 'Zu viele Versuche. Bitte in 10 Minuten noch einmal.';
    if (err === 'setup') return 'Der Kalender ist noch nicht eingerichtet. Bitte beim Chef melden.';
    return 'Keine Verbindung. Bitte Internet prüfen und erneut versuchen.';
  };

  function showCodeView(msg) {
    clearInterval(timer);
    $('cal-view').hidden = true;
    $('staff-actions').hidden = true;
    $('code-view').hidden = false;
    $('staff-cal').innerHTML = '';
    if (msg) setStatus($('staff-status'), msg, 'error');
    setTimeout(() => $('staff-code')?.focus(), 50);
  }

  function renderWeek(data) {
    const lbl = window.AlsterCalendar.weekLabel(monday);
    $('staff-kw').textContent = lbl.kw;
    $('staff-range').textContent = lbl.range;
    window.AlsterCalendar.render($('staff-cal'), data, monday);
    const t = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    setStatus($('staff-cal-status'), `Stand ${t} Uhr · aktualisiert sich jede Minute`);
  }

  async function load(code) {
    return window.alsterDb ? window.alsterDb.staffAgenda(code, monday, 7) : { error: 'network' };
  }

  async function open(code, remember) {
    const data = await load(code);
    if (!data || data.error) return data?.error || 'network';
    saveCode(code, remember);
    $('code-view').hidden = true;
    $('cal-view').hidden = false;
    $('staff-actions').hidden = false;
    $('staff-today-label').textContent = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    renderWeek(data);
    clearInterval(timer);
    timer = setInterval(() => { if (!document.hidden) refresh(); }, 60000);
    return null;
  }

  async function refresh() {
    const code = getCode();
    if (!code) { showCodeView(); return; }
    const data = await load(code);
    if (!data || data.error) {
      if (data?.error === 'invalid') { clearCode(); showCodeView('Der Code wurde geändert. Bitte den neuen Code eingeben.'); return; }
      setStatus($('staff-cal-status'), errorText(data?.error), 'error');
      return;
    }
    renderWeek(data);
  }

  const shift = (days) => { monday = new Date(monday); monday.setDate(monday.getDate() + days); monday = window.AlsterCalendar.mondayOf(monday); refresh(); };

  async function submit() {
    const input = $('staff-code');
    const code = (input.value || '').replace(/\D/g, '');
    const status = $('staff-status');
    if (code.length !== 6) { setStatus(status, 'Bitte genau 6 Ziffern eingeben.', 'error'); return; }
    const btn = $('staff-form').querySelector('button[type="submit"]');
    if (btn.disabled) return;
    btn.disabled = true;
    setStatus(status, 'Wird geprüft …');
    const err = await open(code, $('staff-remember').checked);
    btn.disabled = false;
    if (err) { setStatus(status, errorText(err), 'error'); input.select(); }
    else { input.value = ''; setStatus(status, ''); }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const y = $('year'); if (y) y.textContent = new Date().getFullYear();
    monday = window.AlsterCalendar.mondayOf(new Date());
    $('staff-form').addEventListener('submit', (e) => { e.preventDefault(); submit(); });
    // Nach der 6. Ziffer automatisch öffnen
    $('staff-code').addEventListener('input', (e) => {
      const v = e.target.value.replace(/\D/g, '').slice(0, 6);
      if (v !== e.target.value) e.target.value = v;
      if (v.length === 6) submit();
    });
    $('staff-prev').addEventListener('click', () => shift(-7));
    $('staff-next').addEventListener('click', () => shift(7));
    $('staff-today').addEventListener('click', () => { monday = window.AlsterCalendar.mondayOf(new Date()); refresh(); });
    $('staff-logout').addEventListener('click', () => { clearCode(); showCodeView(); setStatus($('staff-status'), ''); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('cal-view').hidden) refresh(); });

    const saved = getCode();
    if (saved) {
      const err = await open(saved, (() => { try { return !!localStorage.getItem(KEY); } catch { return false; } })());
      if (err) { if (err === 'invalid') clearCode(); showCodeView(err === 'invalid' ? 'Der Code wurde geändert. Bitte den neuen Code eingeben.' : errorText(err)); }
    } else {
      showCodeView();
    }
    document.body.classList.add('is-ready');
  });
})();
