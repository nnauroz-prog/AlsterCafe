/* ============================================================
   Alstercafé · Kalender-Darstellung (gemeinsam genutzt)
   ============================================================
   Mitgliederbereich (admin.html, Inhaber) und Mitarbeiter-Kalender
   (kalender.html, Zugang mit Code) zeigen dieselbe Wochenansicht:
   je Tag Reservierungen und Abholungen nach Uhrzeit.
   ============================================================ */
(function () {
  const DAYS = [
    { key: 'mon', label: 'Montag' }, { key: 'tue', label: 'Dienstag' },
    { key: 'wed', label: 'Mittwoch' }, { key: 'thu', label: 'Donnerstag' },
    { key: 'fri', label: 'Freitag' }, { key: 'sat', label: 'Samstag' },
    { key: 'sun', label: 'Sonntag' }
  ];
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function isoDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function mondayOf(date) {
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }
  function isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const diff = (d - firstThursday) / 86400000;
    return 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  }
  function weekLabel(monday) {
    const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
    const f = d => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return { kw: `KW ${isoWeek(monday)}`, range: `${f(monday)} – ${f(sunday)}` };
  }

  function render(el, data, monday) {
    if (!el) return;
    const todayIso = isoDate(new Date());
    const byDay = {};
    (data.reservations || []).forEach(r => { if (r.date) (byDay[r.date] = byDay[r.date] || []).push({ kind: 'res', time: r.time || '', r }); });
    (data.orders || []).forEach(o => { if (o.pickupDate) (byDay[o.pickupDate] = byDay[o.pickupDate] || []).push({ kind: 'order', time: o.pickupTime || '', o }); });
    let total = 0;
    const html = DAYS.map((d, i) => {
      const date = new Date(monday); date.setDate(date.getDate() + i);
      const iso = isoDate(date);
      const items = (byDay[iso] || []).sort((a, b) => String(a.time).localeCompare(String(b.time)));
      total += items.length;
      const nRes = items.filter(x => x.kind === 'res').length;
      const nOrd = items.length - nRes;
      const summary = items.length
        ? [nRes ? `${nRes} ${nRes === 1 ? 'Reservierung' : 'Reservierungen'}` : '', nOrd ? `${nOrd} ${nOrd === 1 ? 'Abholung' : 'Abholungen'}` : ''].filter(Boolean).join(' · ')
        : 'Nichts eingetragen';
      const rows = items.map(x => {
        if (x.kind === 'res') {
          const r = x.r;
          return `<li class="cal-item is-res${r.status === 'done' ? ' is-done' : ''}">
            <span class="cal-time">${escapeHtml(r.time || '–')}</span>
            <span class="cal-main"><span class="cal-type">Tisch</span> <strong>${escapeHtml(r.name || 'Ohne Namen')}</strong>${r.persons ? ` · ${escapeHtml(r.persons)}` : ''}</span>
            ${r.status === 'done' ? '<span class="cal-pill">erledigt</span>' : ''}
          </li>`;
        }
        const o = x.o;
        const its = Array.isArray(o.items) ? o.items : [];
        const berliner = its.some(it => it && it.kind === 'berliner');
        const list = its.filter(it => it && (parseInt(it.qty, 10) || 0) > 0).map(it => `${parseInt(it.qty, 10)}× ${escapeHtml(it.name || '')}`).join(', ');
        return `<li class="cal-item is-order${berliner ? ' is-berliner' : ''}${o.status === 'done' ? ' is-done' : ''}">
          <span class="cal-time">${escapeHtml(o.pickupTime || '–')}</span>
          <span class="cal-main"><span class="cal-type">${berliner ? 'Berliner' : 'Abholung'}</span> <strong>${escapeHtml(o.name || 'Ohne Namen')}</strong>${o.totalCount ? ` · ${o.totalCount} Stück` : ''}${list ? `<span class="cal-detail">${list}</span>` : ''}</span>
          ${o.status === 'done' ? '<span class="cal-pill">erledigt</span>' : ''}
        </li>`;
      }).join('');
      return `<section class="cal-day${iso === todayIso ? ' is-today' : ''}${iso < todayIso ? ' is-past' : ''}${items.length ? '' : ' is-empty'}">
        <header class="cal-day-head">
          <span class="cal-day-name">${d.label}</span>
          <span class="cal-day-date">${date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span>
          ${iso === todayIso ? '<span class="day-pill">Heute</span>' : ''}
          <span class="cal-day-sum">${summary}</span>
        </header>
        ${rows ? `<ul class="cal-list">${rows}</ul>` : ''}
      </section>`;
    }).join('');
    el.innerHTML = (total ? '' : '<p class="cal-empty-week">Diese Woche ist noch nichts eingetragen.</p>') + html;
  }



  window.AlsterCalendar = { render, mondayOf, weekLabel, isoDate };
})();
