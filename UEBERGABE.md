# Alstercafé · Übergabe-Dokumentation

Diese Datei beschreibt, was vor dem produktiven Einsatz noch zu tun ist und wie der Mitgliederbereich genutzt wird.

## 1. Was Sie als Inhaberin tun müssen (einmalig, ca. 30 Minuten)

### Schritt 1 – Supabase-Konto vorbereiten
Im Supabase-Dashboard (https://supabase.com) anmelden, Projekt öffnen.

1. **SQL ausführen.** Im Menü links auf „SQL Editor" → „New query" → Inhalt von `setup.sql` einfügen → „Run".
2. **Inhaber-Konto anlegen.** „Authentication" → „Users" → „Add user" → „Create new user".
   - E-Mail: Ihre echte Adresse, z. B. `maria@alstercafe.de`
   - Passwort: mindestens 12 Zeichen, Buchstaben + Zahlen + Sonderzeichen
   - Häkchen „Auto Confirm User" setzen
3. **Site-URL setzen.** „Authentication" → „URL Configuration" → „Site URL" auf `https://alstercafe.de` setzen. Sonst gehen Passwort-Reset-Mails verloren.

### Schritt 2 – Konfiguration anpassen
In der Datei `config.js`:

- `ownerEmail`: auf Ihre echte E-Mail-Adresse setzen (die, die Sie eben in Supabase angelegt haben)

Alles andere bleibt wie es ist.

### Schritt 3 – Hosting
Die Seite ist statisches HTML und kann überall liegen, das einfachste ist **Netlify** (kostenlos):

1. Konto auf netlify.com anlegen
2. „Add new site" → „Deploy manually" → den Projektordner auf die Seite ziehen
3. Im Site-Settings die eigene Domain `alstercafe.de` verknüpfen und die angezeigten DNS-Einträge bei Ihrem Domain-Anbieter eintragen
4. HTTPS aktiviert sich automatisch

### Schritt 4 – Test
1. `https://alstercafe.de/admin.html` öffnen, mit Ihrer E-Mail + Passwort einloggen
2. Im Wochenplan eine Test-Eingabe machen, speichern
3. Auf der Startseite prüfen: erscheint das Tagesgericht?
4. Reservierungs-Formular ausfüllen und absenden
5. Im Mitgliederbereich → „Anfragen ansehen" sollte die Test-Reservierung erscheinen

---

## 2. So benutzen Sie den Mitgliederbereich

### Einloggen
`alstercafe.de/admin.html` aufrufen, E-Mail und Passwort eingeben.

### Übersicht
Nach dem Login sehen Sie 6 große Karten. Jede führt zu einem Bereich:

- **Mittagsmenü bearbeiten** — Tagesgerichte für die Woche
- **Speisekarte pflegen** — Frühstück, Backwaren, Getränke
- **Hinweisbanner aktivieren** — Brückentage, Sonderaktionen
- **Anfragen ansehen** — eingegangene Reservierungen (Badge zeigt Anzahl)
- **Bilder hochladen** — Logo, Bilder, Galerie, Akzentfarbe
- **Öffnungszeiten ändern** — Tage und Zeiten

Mit „Zurück zur Übersicht" oben links kommen Sie immer wieder zurück.

### Wochenplan
- Hauptgericht und Beilage je Tag eintragen
- „An diesem Tag geschlossen" zeigt den Tag als geschlossen an
- „Wochenplan speichern" ganz unten — wird automatisch auf alle Geräte synchronisiert
- **Sonntags-Trick:** Am Sonntag sehen Sie automatisch die kommende Woche. Damit können Sie schon die neue Woche einplanen, während heute (Sonntag) noch läuft.

### Anfragen
- Neue Anfragen erscheinen automatisch oben in der Liste, mit goldenem „Neu"-Tag
- Telefonnummer und E-Mail sind anklickbar — direkt anrufen oder antworten
- „Als erledigt markieren" wenn Sie sich gekümmert haben; die Anfrage bleibt erhalten, aber zählt nicht mehr im Badge
- „Löschen" entfernt die Anfrage endgültig

---

## 3. Sicherheits-Hinweise

- Das Passwort niemals weitergeben. Für Mitarbeiter im „Konto"-Tab eigene Zugänge anlegen.
- Wenn Sie ein Passwort vergessen: Supabase-Dashboard → „Authentication" → „Users" → den Benutzer wählen → „..." → „Send password recovery"
- Alle Anfragen werden in Deutschland gehostet (Supabase EU-Region). Datenschutzerklärung der Seite ist entsprechend formuliert.

---

## 4. Wartung

- **Inhalte ändern:** alles im Mitgliederbereich. Keine Programmierkenntnisse nötig.
- **Technische Wartung:** nicht erforderlich. Die Seite ist statisch und läuft ohne Server-Wartung.
- **Backups:** Supabase macht automatische Tages-Backups. Zusätzlich können Sie im Wochenplan-Tab unter „Export" jederzeit eine JSON-Datei der Woche herunterladen.

---

## 5. Bei Fragen
Verkäufer-Kontaktdaten hier eintragen.
