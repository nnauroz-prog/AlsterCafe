# Alstercafé · Übergabe-Dokumentation

Diese Datei beschreibt, was vor dem produktiven Einsatz noch zu tun ist und wie der Mitgliederbereich genutzt wird.

## Kurz-Übersicht

Drei Dokumente für drei Zwecke:

| Datei | Für wen | Wozu |
|---|---|---|
| **UEBERGABE.md** (diese) | Verkäufer + Dev | Einmaliges Setup |
| [**MARIA-ROUTINE.md**](MARIA-ROUTINE.md) | Maria | Tägliche 5-Minuten-Routine (Druckkarte) |
| [**PHOTOS.md**](PHOTOS.md) | Maria | Welche Fotos sie knipsen und wie hochladen |
| [**CUSTOM-DOMAIN.md**](CUSTOM-DOMAIN.md) | Dev | DNS-Konfiguration alstercafe.de |

## Live-Adresse (Stand November 2026)
```
https://www.alstercafe.de/
```
Die Seite läuft bei **Vercel**, die Domain liegt bei STRATO. `alstercafe.de` leitet auf
`www.alstercafe.de` um; www ist die Hauptadresse, und Canonical, Sitemap, Social-Vorschau und
Google-Daten nennen einheitlich `https://www.alstercafe.de/`. Wird die Umleitung in Vercel einmal
umgedreht, müssen diese Adressen im Code wieder angepasst werden.

Jede Änderung geht nach dem Merge in `main` in etwa einer Minute automatisch live.

## Erledigt ohne Zutun des Inhabers (November 2026)

- **Alte Zeile `reservations` in der Tabelle `content`:** Die Webseite lädt sie nicht mehr in
  Besucher-Browser, und der Mitgliederbereich löscht solche Überbleibsel beim nächsten normalen Login
  automatisch.
- **Domain:** Code auf die tatsächliche Hauptadresse www.alstercafe.de umgestellt – keine
  Vercel-Einstellung nötig.

## Freiwillig (die Seite ist auch ohne diese Punkte vollständig)

1. **Google-Bewertungslink** im Mitgliederbereich unter Bilder & Farben eintragen – dann erscheinen die
   Bewertungs-Zeile und der QR-Aushang. Ohne Link bleibt beides unsichtbar.
2. **Google Search Console** für `www.alstercafe.de` anlegen und die Sitemap
   `https://www.alstercafe.de/sitemap.xml` einreichen (siehe SEO-CHECKLISTE.md).
3. **Datenschutzerklärung** einmal anwaltlich gegenlesen lassen.

## 1. Was Sie als Inhaberin tun müssen (einmalig, ca. 30 Minuten)

### Schritt 1 – Supabase-Konto vorbereiten
Im Supabase-Dashboard (https://supabase.com) anmelden, Projekt öffnen.

1. **SQL ausführen.** Im Menü links auf „SQL Editor" → „New query" → Inhalt von `setup.sql` einfügen → „Run".
2. **Inhaber-Konto anlegen.** „Authentication" → „Users" → „Add user" → „Create new user".
   - E-Mail: `info@alstercafe.de`
   - Passwort: das gewünschte Login-Passwort (wird von Supabase **verschlüsselt** gespeichert — es steht nirgends im Code). Häkchen „Auto Confirm User" setzen.
   - **Wichtig:** Das Passwort NIE in `config.js` oder sonst in den Code schreiben — es landet sonst im öffentlichen Repo und jeder könnte sich einloggen. Der Code kennt nur die (öffentliche) E-Mail-Adresse.
3. **Site-URL setzen.** „Authentication" → „URL Configuration" → „Site URL" auf `https://alstercafe.de` setzen. Sonst gehen Passwort-Reset-Mails verloren.

### Schritt 2 – Konfiguration anpassen
In der Datei `config.js`:

- `ownerEmail`: ist bereits auf `info@alstercafe.de` gesetzt. Nur ändern, falls ein anderes Login-Konto verwendet wird (muss dann exakt der in Supabase angelegten E-Mail entsprechen). Das Passwort gehört NICHT hierher — das lebt ausschließlich in Supabase.

### Schritt 3 – Hosting
Die Seite läuft bei **Vercel** (automatisches Ausrollen aus dem Branch `main`). Die Domain-Einstellungen
stehen in [`CUSTOM-DOMAIN.md`](CUSTOM-DOMAIN.md), HTTPS aktiviert Vercel automatisch.

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

### Übersicht und tägliche Abläufe
Die ausführliche, druckbare Anleitung steht in [**MARIA-ROUTINE.md**](MARIA-ROUTINE.md). Kurzfassung:

- **Übersicht:** oben **„Zu tun“** (was noch zu bestätigen ist, fehlender Mittagstisch), darunter
  **„Heute“** und **„Morgen“** mit Summe, Mittagstisch und allen Einträgen (antippbar,
  „Tagesliste drucken“). Die Zahlen an den Kacheln zeigen, was noch zu bestätigen ist.
- **Täglich:** Mittagstisch · Reservierungen · Bestellungen · Kalender · Berliner.
  **Selten ändern:** Speisekarte · Bilder & Farben · Hinweis · Öffnungszeiten · Urlaub & Feiertage · Konto.
- **Status jeder Anfrage:** Neu → Bestätigt („Bestätigung senden“, E-Mail an den Gast) → Erledigt
  („Als erledigt markieren“). Erledigte stehen eingeklappt unter „Erledigt (Anzahl)“.
- **Kalender:** Wochenansicht aller Reservierungen und Abholungen inkl. Schließtage; Kalender-Code für
  Mitarbeiter (nur ansehen, ohne Kontaktdaten) unter alstercafe.de/kalender.html.
- **Live-Anzeige oben rechts:** zeigt, ob Änderungen sofort auf allen Geräten und der Webseite erscheinen.
- **Regeln für Gäste:** Reservierung online bis 14:00 Uhr; belegte Brötchen online bis 18 Uhr am Vortag;
  Berliner nach den Regeln der Aktion (Vorlauf, Mindestmenge, Abholzeit).

---

## 3. Sicherheits-Hinweise

- Das Passwort niemals weitergeben. Mitarbeiter bekommen den Kalender-Code (nur ansehen); weitere Admin-Zugänge werden in Supabase angelegt.
- Wenn Sie ein Passwort vergessen: Supabase-Dashboard → „Authentication" → „Users" → den Benutzer wählen → „..." → „Send password recovery"
- Alle Anfragen werden in Deutschland gehostet (Supabase EU-Region). Datenschutzerklärung der Seite ist entsprechend formuliert.

---

---

## 4. Wartung

- **Inhalte ändern:** alles im Mitgliederbereich. Keine Programmierkenntnisse nötig.
- **Technische Wartung:** nicht erforderlich. Die Seite ist statisch und läuft ohne Server-Wartung.
- **Backups:** Der **Gratis-Tarif macht KEINE automatischen Backups** (das gibt es erst ab dem Pro-Tarif). Für die Datensicherung daher selbst sorgen — im Normalfall genügt das völlig:
  - **Wochenplan:** im Bereich Mittagstisch unter „Sicherungskopie“ eine Datei herunterladen und aufbewahren.
  - **Verlustrisiko ist gering:** Menü, Öffnungszeiten und Texte haben ohnehin sichere Standardwerte im Code (`menudata.js` u. a.) und ließen sich im Ernstfall schnell neu eintippen. Reservierungen/Bestellungen sind kurzlebige Anfragen.
  - Wer es automatisiert mag: ein kostenloser wöchentlicher Export der **nicht-personenbezogenen** Inhalte (Karte, Zeiten, Design) ließe sich per GitHub-Action ins Repo sichern — Reservierungen/Bestellungen aber bewusst NICHT (Kundendaten gehören aus DSGVO-Gründen nicht in ein Code-Repo).

### Kosten & Gratis-Tarif (wichtig zu wissen)

- **Supabase kostet für dieses Café dauerhaft 0 €.** Der Gratis-Tarif (500 MB Datenbank, 1 GB Bilder-Speicher, 5 GB Traffic) ist für eine Café-Seite um ein Vielfaches überdimensioniert — die Grenzen werden im Normalbetrieb nie erreicht.
- **Die einzige Eigenheit:** Supabase **pausiert** ein Gratis-Projekt nach ca. **7 Tagen ohne jeden Zugriff** automatisch. Dann lädt die Seite keine Inhalte mehr und nimmt keine Reservierungen/Bestellungen an, bis das Projekt reaktiviert wird. (Das war vermutlich der Grund, falls die Seite einmal „leer" wirkte.)
- **Dagegen läuft jetzt eine automatische Absicherung:** Der Workflow `.github/workflows/keepalive.yml` schickt **alle 3 Tage** eine winzige Anfrage an die Datenbank und hält das Projekt so dauerhaft wach — kostenlos, kein zusätzlicher Dienst. (Wird aktiv, sobald er auf dem `main`-Branch liegt, da GitHub Zeitpläne nur von dort startet.)
- **Falls die Seite doch mal leer wirkt**, zwei schnelle Wege:
  1. Im Supabase-Dashboard das Projekt öffnen → „Restore"/„Resume" klicken.
  2. Oder auf GitHub unter **Actions → „Supabase wachhalten" → „Run workflow"** einmal manuell auslösen.
- **Selbst wenn der Backend kurz weg ist, bricht nichts hart ab:** Die öffentliche Seite zeigt dann die mitgelieferte Standard-Karte statt einer leeren Seite, und die Reservierungs-/Bestellformulare öffnen automatisch eine vorausgefüllte E-Mail an `info@alstercafe.de` — die Anfrage geht also trotzdem nicht verloren.
- **Kein Lock-in:** Die Daten lassen sich jederzeit aus Supabase exportieren; derselbe (Open-Source-)Stack ließe sich später auch selbst hosten, falls gewünscht.

> Hinweis zur Frage „eigenes System ohne Supabase": Ein echtes, für alle Besucher sichtbares System braucht zwingend einen Server (für geteilte Inhalte, Formular-Eingang, sicheren Login). Ein rein im Browser laufendes System funktioniert nur auf einem einzigen Gerät und ist als öffentliche Seite ungeeignet. Selbst-Hosting wäre teurer als der kostenlose Supabase-Tarif und würde Wartung/Sicherheit/DSGVO auf den Betreiber verlagern — für ein Café ist der aktuelle Aufbau die günstigste und wartungsärmste Lösung.

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

**Vor jedem Push `npm test`.** Der erste Schritt (`tests/version-check.mjs`, auch einzeln per `npm run test:versions`) meldet uneinheitliche `?v=`-/`var V`-Stempel und lokale `.css`/`.js`-Einbindungen ohne `?v=` (Ausnahme `vendor/`, dort steckt die Version im Dateinamen). Hintergrund: `vercel.json` cacht `.css`/`.js` nur **mit** `?v=` ein Jahr lang („immutable“); ohne `?v=` gilt `must-revalidate`. Bilder (`png/webp/jpg`) werden einen Tag gecacht (`stale-while-revalidate` eine Woche), Schriften und `vendor/` ein Jahr. Zusätzlich misst `npm run test:cls` (`tests/cls-audit.mjs`, nicht Teil von `npm test`) die Layout-Sprünge beim Laden aller öffentlichen Seiten in drei Breiten und schlägt über 0,1 an.

### Branch- & Deploy-Policy
- Entwickelt wird auf `claude/bakery-website-redesign-vyyXQ` (oder einem neuen Feature-Branch).
- Änderungen kommen als Pull Request nach `main`; nach dem Merge rollt Vercel die Live-Seite in etwa einer Minute aus.
- Zusätzlich spiegelt die GitHub Action (`deploy.yml`) den Stand nach `gh-pages` (Ersatz-Kopie), nur wenn `npm test` grün ist.
- Niemals direkt auf `main` oder `gh-pages` committen.

### Speisekarte: geteilte Datenbasis + Editor + PDF
Die Frühstückskarte (Stand: Maria's echte PDF, 6 Kategorien, 47 Gerichte) ist ein eigenes kleines System:

- **`menudata.js`** — eine einzige Quelle der Wahrheit: `window.ALSTERCAFE_MENU_DEFAULT = { intro, sections: [{ title, icon, note?, items: [{ name, desc?, price, tag? }] }], footnote }`. Wird von `speisekarte.html` und `admin.html` geladen (vor `script.js` bzw. `admin.js`).
- **Öffentliche Seite** (`script.js` → `getMenuData()` + `renderKarteHtml()`): rendert die Karte in `#karte-mount` aus dem gespeicherten Override (`alsterDb.get('menu')`) oder dem Default. Die statische Karte im HTML ist nur no-JS-Fallback + SEO.
- **Admin-Editor** (`admin.js` → `renderMenuEditor`/`buildMenuSection`/`collectMenuData`): Maria pflegt Kategorien + Gerichte selbst. Speichern schreibt nach `content`-Tabelle (id=`menu`), Realtime-Subscribe aktualisiert offene Webseiten-Tabs sofort.
- **PDF-Export** (`admin.js` → `downloadMenuPdf`/`buildMenuPrintHtml`): rein clientseitig, eine Seite pro Kategorie, keine externe Library. Maria wählt im Druckdialog „Als PDF speichern". **Wichtig — Mechanik:** Es wird **kein** `window.open()`-Popup mehr benutzt (das wurde auf iOS Safari lautlos vom Popup-Blocker geschluckt → „passiert nichts"). Stattdessen wird die Druckansicht in ein **verstecktes, gleich-Ursprung-Iframe** (Blob-URL) geladen; ein im Dokument eingebettetes Skript ruft `window.print()` aus dem eigenen Fenster auf. Ein gemeinsames Flag `__alsterPrinted` verhindert doppelte Dialoge, die Blob-URL wird nach `afterprint` freigegeben. Falls je wieder „nichts passiert": prüfen, ob das Iframe `#menu-print-frame` erzeugt wird und die Blob-URL lädt.
- **Preis-Modell bewusst als freier String** (`"8,90 €"` oder `"2,80 / 3,80 €"`), damit der Editor einfach bleibt (3 Felder: Name/Preis/Beschreibung). Der `tag` (z. B. „vegan") wird im Editor transparent über ein `data-tag`-Attribut erhalten.
- **Ändern der Default-Karte:** in `menudata.js` editieren. Solange Maria nichts im Admin gespeichert hat, gilt dieser Default überall.

### Keep-alive gegen Supabase-Pause (`.github/workflows/keepalive.yml`)
Gratis-Supabase-Projekte pausieren nach ~7 Tagen ohne Aktivität. Der Workflow feuert per `schedule` (cron, alle 3 Tage) + `workflow_dispatch` eine einzelne `curl`-Lese-Anfrage an `…/rest/v1/content?select=id&limit=1` mit dem **öffentlichen** anon/publishable Key (steht schon in `config.js`, kein Secret). 2xx = ok, sonst schlägt der Job sichtbar fehl. **Fällt nur vom Default-Branch `main`** (GitHub-Regel für geplante Workflows) — auf Arbeits-Branches läuft nur `workflow_dispatch`. Graceful Degradation ist abgesichert und getestet: bei nicht erreichbarem Backend rendert die Seite die `menudata.js`-Standardkarte, und die Formulare fallen auf `mailto:` zurück (`script.js` Reservierung/Bestellung, `saved=false` → E-Mail-Zweig). Der Overflow-Audit prüft beide Sprachen.

### Live-Sync-Anzeige im Mitgliederbereich
`db.js` meldet den Verbindungsstatus des Realtime-Channels nach außen: `subscribeChanges` übergibt den Status (`SUBSCRIBED` / `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED`, im Demo-Modus `LOCAL`) an `window.alsterDb.onSyncStatus(cb)`. `admin.js` (`updateSyncPill`) spiegelt das in eine Pille `#sync-pill` im Header: grün „Live verbunden", rot „Nicht live", im lokalen Modus ausgeblendet. Rein anzeigend — der Sync-Mechanismus selbst (Supabase Realtime + `hydrate` beim Laden) ist davon unberührt. Die geteilte Datenbasis liegt in der `content`-Tabelle (RLS: öffentlich lesen, nur eingeloggt schreiben, siehe `setup.sql`), Realtime ist dort für `content`/`reservations`/`orders` aktiviert.

### Sparsame Supabase-Requests (Caching & Realtime-Scope)
Bewusste Maßnahmen in `db.js`, um unnötige Backend-Requests zu vermeiden (ohne Aktualitätsverlust):
- **Hydrate-Kurzzeit-Cache (`HYDRATE_TTL`, 60 s):** `ready()` lädt die `content`-Tabelle nur neu, wenn der letzte Abruf älter als 60 s ist (Zeitstempel in `localStorage['alstercafe.__hydrated_at']`). So erzeugt schnelles Navigieren/Neuladen zwischen Seiten **nicht** bei jedem Seitenaufruf einen Request. Offene Seiten bleiben über Realtime live aktuell. Der Mitgliederbereich ruft `ready(true)` → **immer frisch**.
- **Realtime-Scope:** Die öffentliche Seite abonniert nur die `content`-Tabelle (`subscribe(cb, ['content'])`); `reservations`/`orders` sind nur für den Admin relevant. `admin.js` ruft `subscribe(cb)` → alle Tabellen.
- **`auth.getEmail()`** liest aus der lokalen Session (`getSession`), kein `getUser`-Server-Round-Trip.
- Bereits sauber: keine `select('*')` (immer Spalten benannt), Schreib-Operationen geben keine Zeilen zurück, Rechtstexte laden gar kein Backend, kein Supabase-Polling (`setInterval` im Live-Status rechnet nur lokal).

### Layout-Schranke gegen horizontalen Overflow (`npm test`)
Damit nie wieder ein seitlich überlaufendes Layout (wie einmal der Admin-Header auf dem Handy) unbemerkt live geht, gibt es eine **automatische Schranke**:

- **`tests/overflow-audit.mjs`** (Playwright): startet einen eigenen Mini-Server und prüft **jede Seite, jeden eingeloggten Admin-Bereich** sowie die Zustände „mobiles Menü offen" und „Hinweis-Banner sichtbar" über **14 Breiten (320–1440 px)**. Kriterium: `documentElement.scrollWidth > clientWidth` ⇒ Fehler. Bei Treffer wird das schuldige Element protokolliert und der Prozess beendet mit Exit ≠ 0.
- **Lokal ausführen:** `npm install` (einmalig), dann `npm test`. (Lokal ohne CI-Browser: `PW_CHROMIUM=/pfad/zu/chromium npm test`.)
- **CI-Gate:** `.github/workflows/deploy.yml` hat einen Job `test`, von dem `publish` per `needs:` abhängt. **Findet der Audit Overflow, wird NICHTS nach `gh-pages` gespiegelt.** So ist „sowas darf nirgends passieren" technisch erzwungen, nicht nur per Sichtprüfung.
- **Neue Seite/Sektion hinzufügen:** in `tests/overflow-audit.mjs` die `PAGES`- bzw. `ADMIN_PANELS`-Liste ergänzen, dann `npm test`.
- `node_modules` ist in `.gitignore` und wird nicht eingecheckt; die Playwright-Version ist in `package.json` gepinnt.

### Sprachumschaltung Deutsch / English (`i18n.js`)
Die öffentliche Seite lässt sich per Knopf in der Navigation (DE/EN) auf Englisch umschalten.

- **`i18n.js`** enthält ein einziges Wörterbuch (deutscher Quelltext → Englisch) und eine Übersetzungs-Engine, die über Textknoten + ausgewählte Attribute (placeholder, aria-label, title, alt) läuft. **Kein `data-i18n` an den einzelnen Elementen nötig** — die Datei wird nur geladen, den Rest macht sie selbst. Matching ist whitespace-tolerant (mehrzeilige, eingerückte HTML-Texte matchen trotzdem).
- **Umschalt-Knopf** wird per JS in `.primary-nav` injiziert. Die Wahl steht in `localStorage['alstercafe.lang']`. Beim Umschalten wird die Seite **neu geladen** — so werden auch die dynamisch von `script.js` erzeugten Texte (Datum, Wochentag, Öffnungsstatus) sauber in der neuen Sprache gerendert.
- **Dynamische Texte** in `script.js` sind sprachbewusst: `alsterLang()` / `dateLocale()` / `dayLabels()` liefern DE oder EN; Datumsformate laufen über `toLocaleDateString(dateLocale(), …)`, Status-/Teaser-Strings sind mit `en ? … : …` verzweigt.
- **Neue Texte übersetzen:** den deutschen String als Schlüssel ins `EN`-Objekt in `i18n.js` aufnehmen. Fehlt ein Eintrag, bleibt genau dieser Text deutsch (kein Absturz).
- **Bewusst NICHT übersetzt:** vom Inhaber eingegebene Tagesinhalte (Mittagsgericht, Hinweisbanner) — die bleiben so, wie Maria sie eintippt. Rechtstexte (Impressum/Datenschutz) bleiben Deutsch (Standard für deutsche Betriebe; die EN-Version wäre nur unverbindlich). Der Mitgliederbereich (`admin.html`) ist rein deutsch — `i18n.js` wird dort nicht geladen.
- **Layout-Schranke** (`npm test`) prüft Overflow jetzt in **beiden Sprachen** — englischer Text hat andere Längen.

### Design-Entscheidung: kein Kursiv
Maria wollte am 21.06.2026 weg von der geschwungenen italic-Schrift. Implementiert als **eine einzige Schluss-Regel** am Ende von `styles.css`:

```css
*, *::before, *::after { font-style: normal !important; }
```

Außerdem lädt die Google-Fonts-URL bewusst keine italic-Achse mehr (`Fraunces:opsz,wght@…`). Wer kursiv reaktivieren will, muss beides rückgängig machen.

### Gründungsdatum: 2004 (vom Inhaber bestätigt)
- Die Seite nennt durchgehend **„seit 2004"** — so vom Inhaber ausdrücklich gewünscht (Stand 10/2026). Gezählt wird ab der Familienpräsenz an der Ifflandstraße 45: Vorher war dort der **Alstermarkt**, ein Getränkemarkt derselben Familie; 2004 wurde daraus das Café. Der „Alster" im Namen ist von dort geblieben.
- Eine ältere Recherche (Northdata/Webarchiv, 06/2026) deutete auf eine spätere Café-Eröffnung (2013) hin. Der Inhaber zählt die Jahre aber ab 2004 — das ist seine Entscheidung für die Außendarstellung und gilt.
- Zentral gepflegt über die Konstante **`FOUNDED_YEAR = 2004`** in `script.js`: sie füllt automatisch alle „seit X Jahren"-Angaben und den Hochzähl-Counter. Zusätzlich fest hinterlegt: Hero-Stempel „Est. 2004", Splash-Ring, Footer-Credit, Timeline auf „Über uns", JSON-LD `foundingDate: "2004"`.
- Wer die Zahl ändert: **nur** `FOUNDED_YEAR` in `script.js` anpassen (die Jahres-Angaben rechnen sich daraus); die fest geschriebenen „Est.-"Stempel und die Timeline auf `index.html`/`ueber-uns.html` separat nachziehen.

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
- Auf Vercel setzt `vercel.json` HSTS, X-Frame-Options, Content-Security-Policy, Permissions-Policy und Referrer-Policy (live geprüft im November 2026). `_headers` und `netlify.toml` gelten nur für den Fall eines Wechsels zu Netlify.
- Reservierungen und Bestellungen liegen in eigenen Tabellen hinter Supabase-RLS (nur angemeldet lesbar); die öffentliche Tabelle `content` darf keine personenbezogenen Daten enthalten.

### Externe Profile pflegen
Die Startseite verlinkt jetzt auf echte Bewertungsplattformen statt erfundene Zitate:

- **Tripadvisor:** [Alstercafe Hamburg](https://www.tripadvisor.de/Restaurant_Review-g187331-d5852030-Reviews-Alstercafe-Hamburg.html)
- **Google Business:** Suche „Alstercafe Ifflandstraße 45" — Foto- und Öffnungszeiten-Pflege
- **Instagram:** [@alstercafe](https://www.instagram.com/alstercafe/)

Diese drei sind ab jetzt Teil der Vitrine. Ein veraltetes Google-Profil schadet mehr als ein fehlendes Zitat auf der eigenen Seite. Faustregel: pro Quartal ein bis zwei neue Fotos auf Google + Instagram.

---

### Inhalts-Schlüssel und Tests (Stand November 2026)
- Alle Inhalte liegen in der Supabase-Tabelle `content` (öffentlich lesbar). `db.js` übernimmt beim Laden
  **nur** die Schlüssel aus `SYNCED_KEYS`: weekly-menu, menu, specials, hours, notice, notice-until,
  content, design, broetchen-items, holidays, berliner-items, berliner-settings, jobs. Neue Inhalte
  immer dort ergänzen und in „Alle Inhalte zurücksetzen“ (admin.js `onResetAll`) aufnehmen.
  **Nie personenbezogene Daten in `content` speichern.**
- Tests: `npm test` (Versions-Check + Overflow-Audit, 924 Prüfungen), `npm run test:cls` (Layout-Sprünge).

## 7. Wichtige Quick-Links

- **Live-Site:** https://alstercafe.de (sobald DNS umgestellt)
- **Mitgliederbereich:** https://alstercafe.de/admin.html
- **Webshop Croquenoah:** https://croquenoah.simplywebshop.de/storedata/listStore
- **Supabase-Dashboard:** https://supabase.com (Login mit Inhaber-E-Mail)
- **GitHub-Repo (Code):** https://github.com/nnauroz-prog/alstercafe
