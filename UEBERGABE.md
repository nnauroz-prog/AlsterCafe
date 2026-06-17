# Alstercafé · Übergabe-Dokumentation

Diese Datei beschreibt, was vor dem produktiven Einsatz noch zu tun ist und wie der Mitgliederbereich genutzt wird.

## 📋 Kurz-Übersicht

Drei Dokumente für drei Zwecke:

| Datei | Für wen | Wozu |
|---|---|---|
| **UEBERGABE.md** (diese) | Verkäufer + Dev | Einmaliges Setup |
| [**MARIA-ROUTINE.md**](MARIA-ROUTINE.md) | Maria | Tägliche 5-Minuten-Routine (Druckkarte) |
| [**PHOTOS.md**](PHOTOS.md) | Maria | Welche Fotos sie knipsen und wie hochladen |
| [**CUSTOM-DOMAIN.md**](CUSTOM-DOMAIN.md) | Dev | DNS-Konfiguration alstercafe.de |
| [**WHATSAPP-SETUP.md**](WHATSAPP-SETUP.md) | Dev | Optionale WhatsApp-Notifications |

## Live-Adresse (Stand heute)
```
https://nnauroz-prog.github.io/AlsterCafe/
```
Auf der eigenen Domain `alstercafe.de` läuft die Seite, sobald die DNS-Umstellung gemacht ist — Anleitung in [`CUSTOM-DOMAIN.md`](CUSTOM-DOMAIN.md).

Jede Änderung am Code geht automatisch innerhalb von ~1 Minute auf die Live-Adresse — kein manuelles Hochladen.

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
Die Seite läuft bereits auf **GitHub Pages** (kostenlos, automatisch).
Der Branch `gh-pages` wird per GitHub Action automatisch aktualisiert
sobald auf den Feature-Branch gepusht wird — Sie selbst müssen nichts
deployen.

**Eigene Domain `alstercafe.de` anbinden:**
1. Bei Ihrem Domain-Anbieter (z. B. IONOS, Strato, GoDaddy) anmelden
2. DNS-Einträge gemäß [`CUSTOM-DOMAIN.md`](CUSTOM-DOMAIN.md) setzen
3. HTTPS aktiviert sich automatisch via Let's Encrypt

Alternative Hosts (Netlify, Vercel) sind möglich — `netlify.toml` und
`_headers` sind im Repo, falls der Wechsel später gewünscht ist.

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
Nach dem Login sehen Sie große Karten. Jede führt zu einem Bereich:

- **Mittagsmenü bearbeiten** — Tagesgerichte für die Woche
- **Speisekarte pflegen** — Frühstück, Backwaren, Getränke
- **Hinweisbanner aktivieren** — Brückentage, Sonderaktionen
- **Anfragen ansehen** — eingegangene Reservierungen (Badge zeigt Anzahl)
- **Brötchen-Bestellungen** — Vorbestellungen für belegte Brötchen (Badge zeigt Anzahl)
- **Bilder hochladen** — Logo, Bilder, Galerie, Akzentfarbe
- **Öffnungszeiten ändern** — Tage und Zeiten

Mit „Zurück zur Übersicht" oben links kommen Sie immer wieder zurück.
Bei Bestellungen und Reservierungen zeigt eine Pille **„Heute"** oder **„Morgen"** an,
was als nächstes ansteht — so sehen Sie auf einen Blick, was vorzubereiten ist.

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

### Brötchen-Bestellungen
- Kunden bestellen belegte Brötchen über die Seite **Brötchen-Service** (ab 10 Stück).
- Oben im Bereich **„Bestellbare Brötchen-Sorten"** legen Sie selbst fest, welche
  Sorten zur Auswahl stehen (Name, Beschreibung, „vegetarisch"). Speichern nicht vergessen.
- Darunter unter **„Eingegangene Bestellungen"** sehen Sie jede Bestellung mit
  allen Positionen (z. B. 5× Käse, 3× Lachs), Abholtermin, Telefon und E-Mail.
- Wie bei den Anfragen: „Als erledigt markieren" und „Löschen".

---

## 3. Sicherheits-Hinweise

- Das Passwort niemals weitergeben. Für Mitarbeiter im „Konto"-Tab eigene Zugänge anlegen.
- Wenn Sie ein Passwort vergessen: Supabase-Dashboard → „Authentication" → „Users" → den Benutzer wählen → „..." → „Send password recovery"
- Alle Anfragen werden in Deutschland gehostet (Supabase EU-Region). Datenschutzerklärung der Seite ist entsprechend formuliert.

---

## 3b. Optional: WhatsApp-Benachrichtigung aufs Handy

Auf Wunsch bekommt der Inhaber bei jeder neuen Bestellung und Reservierung
sofort eine WhatsApp-Nachricht — ganz ohne Mitgliederbereich-öffnen.
Die Nachricht enthält keine Kundendaten (nur Anzahl + Termin), die Details
stehen weiterhin sicher im Mitgliederbereich.

Einrichtung (einmalig, ca. 15 Min.): siehe **WHATSAPP-SETUP.md**.

---

## 4. Wartung

- **Inhalte ändern:** alles im Mitgliederbereich. Keine Programmierkenntnisse nötig.
- **Technische Wartung:** nicht erforderlich. Die Seite ist statisch und läuft ohne Server-Wartung.
- **Backups:** Supabase macht automatische Tages-Backups. Zusätzlich können Sie im Wochenplan-Tab unter „Export" jederzeit eine JSON-Datei der Woche herunterladen.

---

## 5. Bei Fragen

| Anliegen | Kontakt |
|---|---|
| Allgemeine Fragen / Inhalte / Bedienung | _Verkäufer-Kontaktdaten hier eintragen_ |
| Technisch (Supabase-Login vergessen, Domain-Probleme) | _Dev-Kontaktdaten hier eintragen_ |
| Supabase-Support (Backend) | support@supabase.io |
| Domain-Provider (DNS) | _Ihr Domain-Provider-Support_ |

---

## 6. Wichtige Quick-Links

- **Live-Site:** https://alstercafe.de (sobald DNS umgestellt)
- **Mitgliederbereich:** https://alstercafe.de/admin.html
- **Webshop Croquenoah:** https://croquenoah.simplywebshop.de/storedata/listStore
- **Supabase-Dashboard:** https://supabase.com (Login mit Inhaber-E-Mail)
- **GitHub-Repo (Code):** _Repo-URL hier eintragen_
