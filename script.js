/* Alstercafé – Landingpage */

document.addEventListener('DOMContentLoaded', () => {
  /* Footer Jahr */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* Mobile-Menü */
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('primary-nav');
  if (toggle && nav) {
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

  /* Datum-Default: morgen */
  const dateInput = document.querySelector('input[name="Datum"]');
  if (dateInput) {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    const iso = t.toISOString().slice(0, 10);
    dateInput.min = new Date().toISOString().slice(0, 10);
    if (!dateInput.value) dateInput.value = iso;
  }

  /* Reservierungs-Formular */
  const form = document.getElementById('reservation-form');
  if (!form) return;

  const status = form.querySelector('.form-status');

  const setStatus = (msg, kind = '') => {
    if (!status) return;
    status.textContent = msg;
    status.classList.remove('ok', 'error');
    if (kind) status.classList.add(kind);
  };

  form.addEventListener('submit', (e) => {
    if (!form.checkValidity()) {
      e.preventDefault();
      const firstInvalid = form.querySelector(':invalid');
      if (firstInvalid) firstInvalid.focus();
      setStatus('Bitte füllen Sie alle Pflichtfelder (*) aus.', 'error');
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
    const mailto = `mailto:hallo@alstercafe.de?subject=${encodeURIComponent(subject)}&body=${body}`;

    e.preventDefault();
    window.location.href = mailto;
    setStatus('Ihr E-Mail-Programm wurde geöffnet. Bitte senden Sie die Anfrage ab – wir bestätigen schnellstmöglich.', 'ok');
  });
});
