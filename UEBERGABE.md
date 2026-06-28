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
Nach dem Login sehen Sie zwei Gruppen großer Karten:

**Täglich** (das, was Sie morgens nutzen):
- **Mittagsmenü bearbeiten** — Tagesgerichte für die Woche
- **Reservierungsanfragen** — wer möchte einen Tisch? (Karte hebt sich gold ab, wenn Neue da sind, mit Anzahl)
- **Brötchen-Bestellungen** — Vorbestellungen für belegte Brötchen (gleicher Gold-Hinweis bei Neuen)

**Selten ändern** (Pflege und Einrichtung):
- **Speisekarte pflegen** — Frühstück, Backwaren, Getränke
- **Bilder hochladen** — Logo, Hero-Bild, Über-uns-Bild, Galerie (Akzentfarbe unter „selten nötig" eingeklappt)
- **Hinweisbanner aktivieren** — Brückentage, Sonderaktionen
- **Öffnungszeiten ändern** — Tage und Zeiten

Unter den Karten gibt es einen leisen Link „Texte direkt auf der Webseite ändern" — für den Fall, dass Sie Hero-Titel, „Über uns"-Absätze oder ähnliches anpassen möchten.

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
- Grüner Knopf **„Als erledigt markieren"** wenn Sie sich gekümmert haben; die Anfrage bleibt erhalten, aber zählt nicht mehr im Badge
- Roter Knopf **„Löschen"** entfernt die Anfrage endgültig (mit Rückfrage)

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

## 6. Hinweise für Dev / Code-Pflege

Diese vier Punkte sind nicht im Admin-Bereich änderbar — wer Code anfasst, sollte sie kennen.

### Cache-Buster (kritisch nach jeder CSS- oder JS-Änderung)
Browser cachen `styles.css`, `script.js`, `config.js`, `db.js` aggressiv. Damit Änderungen verlässlich bei allen Besuchern ankommen, trägt jede HTML-Datei einen Versions-Stempel an den Asset-URLs:

```html
<link rel="stylesheet" href="styles.css?v=2026-05-10-r81" />
<script src="script.js?v=2026-05-10-r81" defer></script>
```

Der gleiche Stempel steht zusätzlich in einem Inline-Script-Block, der bei Mismatch den LocalStorage-Cache verwirft. **Bei jeder Änderung an CSS oder JS:** den Stempel in allen 11 HTML-Dateien hochzählen (`r81` → `r82` …). Schnellkommando:

```bash
for f in *.html; do sed -i 's/2026-05-10-r81/2026-05-10-r82/g' "$f"; done
```

### Branch- & Deploy-Policy
- Entwickelt wird auf `claude/bakery-website-redesign-vyyXQ` (oder einem neuen Feature-Branch).
- Push auf den Feature-Branch ⇒ GitHub Action baut automatisch den `gh-pages`-Branch und Live-Site ist binnen ~60 s aktuell.
- Niemals direkt auf `main` oder `gh-pages` committen.

### Speisekarte: geteilte Datenbasis + Editor + PDF
Die Frühstückskarte (Stand: Maria's echte PDF, 6 Kategorien, 47 Gerichte) ist ein eigenes kleines System:

- **`menudata.js`** — eine einzige Quelle der Wahrheit: `window.ALSTERCAFE_MENU_DEFAULT = { intro, sections: [{ title, icon, note?, items: [{ name, desc?, price, tag? }] }], footnote }`. Wird von `speisekarte.html` und `admin.html` geladen (vor `script.js` bzw. `admin.js`).
- **Öffentliche Seite** (`script.js` → `getMenuData()` + `renderKarteHtml()`): rendert die Karte in `#karte-mount` aus dem gespeicherten Override (`alsterDb.get('menu')`) oder dem Default. Die statische Karte im HTML ist nur no-JS-Fallback + SEO.
- **Admin-Editor** (`admin.js` → `renderMenuEditor`/`buildMenuSection`/`collectMenuData`): Maria pflegt Kategorien + Gerichte selbst. Speichern schreibt nach `content`-Tabelle (id=`menu`), Realtime-Subscribe aktualisiert offene Webseiten-Tabs sofort.
- **PDF-Export** (`admin.js` → `downloadMenuPdf`/`buildMenuPrintHtml`): rein clientseitig via `window.print()` auf ein eigenständiges Druck-Fenster (eine Seite pro Kategorie). Keine externe Library. Maria wählt im Druckdialog „Als PDF speichern".
- **Preis-Modell bewusst als freier String** (`"8,90 €"` oder `"2,80 / 3,80 €"`), damit der Editor einfach bleibt (3 Felder: Name/Preis/Beschreibung). Der `tag` (z. B. „vegan") wird im Editor transparent über ein `data-tag`-Attribut erhalten.
- **Ändern der Default-Karte:** in `menudata.js` editieren. Solange Maria nichts im Admin gespeichert hat, gilt dieser Default überall.

### Design-Entscheidung: kein Kursiv
Maria wollte am 21.06.2026 weg von der geschwungenen italic-Schrift. Implementiert als **eine einzige Schluss-Regel** am Ende von `styles.css`:

```css
*, *::before, *::after { font-style: normal !important; }
```

Außerdem lädt die Google-Fonts-URL bewusst keine italic-Achse mehr (`Fraunces:opsz,wght@…`). Wer kursiv reaktivieren will, muss beides rückgängig machen.

### Gründungsdatum: 2013 (nicht 2010)
Nadims Recherche (Northdata + Webarchiv + KI-Verifikation am 21.06.2026) hat klar belegt:
- Das Alstercafé wurde **2013** in der Ifflandstraße 45 eröffnet.
- Davor (seit etwa 2004) war an gleicher Adresse der **Alstermarkt** — ein Getränkemarkt der gleichen Familie (OHG Ibrahim Bayrakcioglu). Der „Alster" im Namen ist von dort geblieben.
- Frühere „Est. 2010" / „seit über 15 Jahren"-Angaben waren nachprüfbar falsch und wurden konsistent korrigiert (Hero-Stempel, Splash-Ring, Footer-Credit, Hochzähl-Counter 0→12, JSON-LD `foundingDate: "2013"`).
- Wer die Zahl wieder ändert: bitte erst die Tripadvisor-Ersteinträge oder das Webarchiv von alstercafe.de prüfen. Im Zweifel: lieber konservativ („über 12 Jahre" passt bis Mitte 2026).

### Design-Entscheidungen im Mitgliederbereich
Maria hat gemeldet, dass die Formation des Admin-Bereichs „blöd" wirkte. Folgende Vereinfachungen wurden bewusst getroffen — vor dem Rückbau erst nachfragen:

- **Keine Setup-Gamification** (kein „Sie haben X von Y Schritten erledigt"-Fortschrittsbalken). Maria führt seit über zehn Jahren einen Laden, sie braucht kein Onboarding-Spiel.
- **Keine Dashboard-Stats** (kein „0 von 7 Tagen befüllt", keine KW-Anzeige, keine „Zuletzt gespeichert"-Pille). Saas-Theater hat im Bäckerei-Backend nichts verloren.
- **Tiles in zwei Gruppen** statt einem 7er-Raster: „Täglich" (3) vs. „Selten ändern" (4) — die drei oben sind die drei Aktionen, die Maria jeden Morgen macht.
- **Tab-Navigation auf Mobile ausgeblendet.** Maria nutzt den Tile-Picker statt eines zweiten Navigations-Layers. Auf Desktop bleibt die Tab-Leiste als Quick-Switcher.
- **„Texte bearbeiten" ist kein Header-Knopf**, sondern ein leiser Utility-Link unter dem Tile-Grid. Das ist ein Spezialfeature (`?edit=1`-Modus auf der Webseite), kein täglicher Workflow.
- **Brand im Admin-Header ist nicht klickbar.** Tap-Falle entfernt — „Vorschau" rechts erfüllt den „Webseite ansehen"-Bedarf gefahrlos im neuen Tab.
- **Aktionen auf Anfragen/Bestellungen sind echte Knöpfe** (grün für „Erledigt", rot für „Löschen"). Vorher waren beide winzige Text-Links nebeneinander — verwirrend und schlecht trefflich.
- **Akzentfarbe im Bilder-Panel eingeklappt.** Maria ändert das Brand-Gold praktisch nie.
- **Empty-States freundlich**, nicht klinisch („Hier erscheinen Anfragen, sobald jemand das Formular ausfüllt" statt „Noch keine Anfragen.").

### Performance-Hebel (falls die Seite mal langsam wirkt)
- **Splash-Screen-Dwell:** in `script.js` `hideSplash()` → 350 ms. Plus Safety-Net in `index.html` Inline-Script → 900 ms. Niemals beide deutlich hochschrauben — das war frühere Editorial-Spielerei mit 1400 ms / 2500 ms und fühlte sich direkt langsam an.
- **backdrop-filter** ist auf Mobile (`max-width: 760px`) für Topbar, Sticky-Header, Save-Bar, Cookie-Banner und Hero-Coord per `!important` ausgeschaltet (siehe Block am Ende von `styles.css`). GPU-Compositing kostet auf älteren iPhones echte Frames. Auf Desktop bleibt der Blur-Effekt erhalten.
- **Supabase-Preconnect** auf den 8 DB-nutzenden Seiten (index/mittagstisch/speisekarte/kontakt/reservierung/broetchen/ueber-uns/admin). Spart ~150-300 ms beim ersten Datenbank-Roundtrip. Hardcoded auf das aktuelle Projekt — bei Projekt-Wechsel anpassen.
- **Image-Upload-Kompression** läuft client-seitig (`db.js` `compressImageToBlob`): Logo 480 px, Hero/Über-uns 1400 px, Galerie 1200 px, alle als JPEG Q=0.85. Statt 10 MB iPhone-HEIC zu speichern, wird ein ~150-300 KB JPEG hochgeladen.
- **CSS-Größe** liegt bei ~248 KB (Stand r108). Bei jedem Cache-Buster-Bump muss Maria sie neu laden. Wenn du grössere visuelle Eingriffe machst, gleichzeitig orphan-CSS prüfen.

### Security-Header
- `Referrer-Policy: strict-origin-when-cross-origin` ist als `<meta name="referrer">` auf allen 11 Seiten gesetzt — wirkt unabhängig vom Host. Sorgt dafür, dass Maria's Kunden beim Anklicken externer Links (Tripadvisor, Google Maps, Croquenoah-Webshop) nicht den vollen Referrer leaken.
- `_headers` und `netlify.toml` definieren zusätzlich HSTS, X-Frame-Options, CSP und Permissions-Policy. **Diese werden auf GitHub Pages NICHT angewendet** (nur auf Netlify). Falls die Seite irgendwann auf Netlify wechselt, sind sie automatisch aktiv. Auf GitHub Pages bleibt der Header-Schutz reduziert auf das, was per Meta möglich ist.
- Konsequenz für Maria: Niedriges Risiko, weil keine sensiblen Kunden-Daten im Frontend liegen (Reservierungen + Bestellungen sind hinter Supabase-RLS authentifiziert). Aber: kein automatischer Schutz gegen Clickjacking via iFrame. Wenn das je akut wird → Hosting wechseln oder Cloudflare davorhängen.

### Externe Profile pflegen
Die Startseite verlinkt jetzt auf echte Bewertungsplattformen statt erfundene Zitate:

- **Tripadvisor:** [Alstercafe Hamburg](https://www.tripadvisor.de/Restaurant_Review-g187331-d5852030-Reviews-Alstercafe-Hamburg.html)
- **Google Business:** Suche „Alstercafe Ifflandstraße 45" — Foto- und Öffnungszeiten-Pflege
- **Instagram:** [@alstercafe](https://www.instagram.com/alstercafe/)

Diese drei sind ab jetzt Teil der Vitrine. Ein veraltetes Google-Profil schadet mehr als ein fehlendes Zitat auf der eigenen Seite. Faustregel: pro Quartal ein bis zwei neue Fotos auf Google + Instagram.

---

## 7. Wichtige Quick-Links

- **Live-Site:** https://alstercafe.de (sobald DNS umgestellt)
- **Mitgliederbereich:** https://alstercafe.de/admin.html
- **Webshop Croquenoah:** https://croquenoah.simplywebshop.de/storedata/listStore
- **Supabase-Dashboard:** https://supabase.com (Login mit Inhaber-E-Mail)
- **GitHub-Repo (Code):** https://github.com/nnauroz-prog/alstercafe
