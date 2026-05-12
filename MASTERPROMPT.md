# Masterprompt · Premium-Café/Bäckerei-Website

Diesen kompletten Block als ersten Prompt in einen frischen Claude-Code-Chat einfügen.
Das Beispiel benutzt ein Café — ersetze die Eigennamen, Adressen, Telefonnummern und
Texte vor dem Senden auf dein echtes Geschäft.

---

# Aufgabe

Baue mir eine vollständige, produktionsreife Webseite für ein **familiengeführtes Café/Bäckerei** in Deutschland. Die Seite soll modern wirken, sich an einen lokalen Stammkundenkreis richten und am Ende verkaufsfertig sein. Sie soll sich anfühlen wie ein hochwertiger, aber warmer Familienbetrieb — **NICHT** wie eine Boutique, kein Luxus, kein Lifestyle-Magazin.

## Geschäftsdaten (anpassen vor dem Senden)
- Name: `[BETRIEBSNAME]`
- Adresse: `[STRASSE NR, PLZ ORT]`
- Telefon: `[TELEFON]`
- E-Mail: `[KONTAKT@DOMAIN.DE]`
- Domain: `[domain.de]`
- Inhaber/in: `[VORNAME NAME]`, Familienbetrieb seit `[X]` Jahren
- Besonderheit/USP: `[z. B. Croque-Spezialitäten, hausgemachte Torten, Mittagstisch, …]`
- Öffnungszeiten: `[Mo–Fr 06:30–15:00, Sa+So 07:30–15:00]`
- Region/Tonalität: `[z. B. Hamburg-Hohenfelde, hanseatisch, bodenständig-warm]`

---

# Technische Grundlagen — bitte ab dem ersten Commit befolgen

## Stack
- **Plain HTML / Vanilla CSS / Vanilla JS.** Kein Build-Step. Kein React/Vue/Tailwind/Webpack/Vite. Statisches Deployment per Drag-and-Drop nach Netlify.
- **Supabase** als einziges Backend: Postgres + Auth + Storage + Realtime. Anon-Key im Frontend, echte Sicherheit ausschließlich über Row-Level-Security.
- **localStorage** als Cache- und Fallback-Schicht, niemals als Single-Source-of-Truth.
- Schriftarten ausschließlich `Fraunces` (Serif, optical sizing) + `Inter` (Sans, 300/400/500/600). Beides via Google Fonts mit `preconnect`.

## Datenfluss-Regel (sehr wichtig)
Schreibe **eine** unified-data-layer-Datei `db.js`, die folgende API exportiert:
```
window.alsterDb = {
  isProd,                  // true wenn Supabase konfiguriert
  ready(),                 // Promise — wartet auf Hydratation
  get(key),                // synchron aus Cache
  set(key, value),         // async, schreibt Cache + Supabase
  remove(key),             // async
  uploadImage(file, slot), // async, gibt URL
  subscribe(cb),           // Realtime — ruft cb(key) auf
  auth: { signIn, signOut, isAuthed, getEmail,
          resetPassword, updatePassword, inviteUser },

  // Public-writeable, owner-readable Daten (Reservierungen, Kontaktformulare)
  // GEHEN NIE über die generische content-Tabelle, sondern über eigene Tabellen
  // mit eigenen RLS-Policies. Beispiel:
  addReservation, listReservations, updateReservationStatus, deleteReservation
}
```

Die unterliegende Supabase-Struktur:
- Tabelle `content` (id text PK, data jsonb): RLS = jeder darf SELECT, nur `authenticated` darf INSERT/UPDATE/DELETE. Für alle Owner-Inhalte (Wochenplan, Speisekarte, Öffnungszeiten, Design, Banner).
- Tabelle `reservations` (id text PK, name, phone, email, date, time, persons, message, status, received_at): RLS = jeder darf INSERT (anonym), nur `authenticated` darf SELECT/UPDATE/DELETE. Für Kundenanfragen.
- Storage-Bucket `images` mit Public-Read, Authenticated-Write.

**Liefere setup.sql** mit allen Tabellen, RLS-Policies, Realtime-Publication und Storage-Buckets in einem einzigen Skript zum Reinkopieren ins Supabase-SQL-Editor.

## Cache-Invalidierung (ab Tag 1, nicht erst am Schluss)
In jedem `<head>` einer HTML-Seite eine **inline-Mikro-Skript** vor allen anderen Skripten:
```html
<script>
(function(){
  var V='2026-01-01-r1';
  try{
    if(localStorage.getItem('app-version')!==V){
      localStorage.removeItem('app-content');
      localStorage.setItem('app-version',V);
    }
  }catch(e){}
  try{
    if('serviceWorker' in navigator){
      navigator.serviceWorker.getRegistrations()
        .then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});
    }
  }catch(e){}
})();
</script>
```
Plus Cache-Buster-Querystrings auf jedem `<link href="styles.css?v=...">` und `<script src="x.js?v=...">`. **Service Worker nicht aktivieren** — er ist zu 100 % der Cache-Albtraum, der einem das Wochenende kostet.

## FOUC verhindern
Inline-kritisches CSS direkt im `<head>` jeder Seite (Hintergrund-Farbe, Body-Font, Box-Sizing). Externes Stylesheet danach.

## Fehler-Sicherung
- Globaler `window.onerror` + `unhandledrejection`, der den Splash entfernt und einen Console-Warn loggt.
- Schema-Validatoren für alle localStorage-Daten, die bei Fehler `null` zurückgeben statt zu werfen.
- Jeder Init-Aufruf in einem `safeRun(fn)`-Wrapper. Ein Fehler in einer Init-Funktion darf nie die ganze Seite mitreißen.
- Splash hat einen 2.5-Sekunden-Safety-Net-Timer, der ihn auf jeden Fall ausblendet.

---

# Inhalt & Struktur (Multi-Page, nicht One-Pager)

**Pflichtseiten**, jede mit eigenem `<title>`, `description`, canonical:
1. **index.html** — Startseite mit Hero, „Heute kochen wir für Sie"-Block, Familien-Begrüßung, Teaser-Grid (4 Karten zu Mittagstisch/Speisekarte/Über uns/Reservierung), Visit-Strip, Closer
2. **mittagstisch.html** — Wochenplan: heutiges Gericht groß, dann Wochenliste
3. **speisekarte.html** — Frühstück, Backwaren, Heiße Getränke (jede Kategorie editierbar)
4. **ueber-uns.html** — „Eine Bäckerei, eine Familie." Geschichte, Atmosphäre, USP
5. **reservierung.html** — Formular (Name, Telefon, E-Mail, Datum, Uhrzeit, Personen, Nachricht), speichert direkt in Supabase-`reservations`-Tabelle, mailto-Fallback nur bei Speicherfehler
6. **kontakt.html** — Adresse, Öffnungszeiten, Telefon, E-Mail, deaktivierte Google-Map mit Klick-zum-Laden (DSGVO)
7. **impressum.html** — § 5 TMG vollständig
8. **datenschutz.html** — DSGVO-konform, Supabase + Cookies erwähnt
9. **admin.html** — Mitgliederbereich (siehe unten)
10. **404.html** — freundliche Fehler-Seite mit Rückweg

**Auf jeder öffentlichen Seite:**
- Topbar mit Telefon + Adresse + „Freies WLAN"
- Sticky-Header mit Logo, Navigation (mit `is-active`-Markierung), optional Webshop-Link
- Footer mit Marke, Navigation, Impressum/Datenschutz/Mitgliederbereich, Copyright

---

# Designsystem

## Farbpalette (CSS-Custom-Properties in :root)
```
--bean:      #3D2415   /* Espresso, Haupttext */
--cream:     #FAF5EC   /* Body-Hintergrund */
--paper:     #FFFCF4   /* Karten-Hintergrund */
--linen:     #F1E7D3   /* Bereiche & Pillen */
--gold:      #B8893E   /* Akzent (Buttons, aktive Tabs) */
--gold-soft: #D4B380
--muted:     #786152   /* Sekundärtext */
--line:      #E0D2B8
--line-soft: #EFE5D2
--radius-md: 12px
--shadow-sm: 0 6px 16px -8px rgba(42, 24, 16, 0.14)
--ease-out:  cubic-bezier(0.22, 1, 0.36, 1)
--dur-base:  320ms
```

## Typografie
- Überschriften: `Fraunces` mit `font-variation-settings: "opsz" XX` passend zur Größe. Tracking leicht negativ. Gelegentlich kursive Wortbeispiele (`<em>`).
- Fließtext: `Inter`, 300/400/500/600.
- Eyebrows (`.eyebrow`): all-caps, .68rem, letter-spacing .16em, mit Nummerierung wie `01`, `02` — gibt der Seite eine editorial-redaktionelle Anmutung.

## Tonalität
- „Schön, dass Sie da sind. Kommen Sie vorbei."
- **Familienbetrieb, kein „Maria als Mensch".** Stimme = wir = das Café. Signatur: „— Ihre Familie vom [Betriebsname]".
- Bodenständig, herzlich, hanseatisch (oder regional angepasst).
- Keine Luxus-Phrasen wie „kuratiert", „handverlesen", „Manufaktur".
- USP klar formulieren (z. B. „Croques · Frühstück · Mittagstisch · Backwaren").

## Komponenten
- **Buttons:** `.btn-primary` (Espresso-Fill), `.btn-gold` (Gold-Fill), `.btn-link` (Unterstreichung). Mindestgröße 44 px für Touch.
- **Karten:** weiches Radius 12–18 px, dezenter Schatten beim Hover, Border statt harter Schatten.
- **Skip-Link** für Tastaturnutzer.
- **Reveal-on-Scroll** über IntersectionObserver, respektiert `prefers-reduced-motion`.
- Kein Spotlight-Effekt, keine Magnetic-Buttons, keine animierten CSS-Kaffeetassen, keine Easter-Eggs.

## Mobile-First
- Container `max-width: 1180px`, Side-Padding `clamp(20px, 4vw, 40px)`.
- Burger-Menü unter 760 px, Tabs scrollbar.
- Touch-Targets ≥ 44 px.
- Single-Column für Formulare und Karten unter 760 px.

---

# Mitgliederbereich (admin.html)

## Login
- Klare Login-Karte mit E-Mail + Passwort, Augen-Toggle, Status-Linie.
- **Niemals** ein Demo-Passwort hartkodiert in `config.js`. Nur Supabase-Auth.
- Forgot-Password-Hinweis: „Bitte wenden Sie sich an Ihren Administrator." (User wird via Supabase-Dashboard angelegt.)

## Nach dem Login: Dashboard-Übersicht (NICHT Tabs als Landing)
Eine zentrale Karte mit dem Titel „Was möchten Sie ändern?" und einer „Online"-Status-Pille. Darunter ein Grid aus **6 großen klickbaren Karten** (Icon links, Titel + Beschreibung, Pfeil rechts):

1. **Mittagsmenü bearbeiten** — Wochenplan + Tagesgerichte
2. **Speisekarte pflegen** — Frühstück / Backwaren / Getränke
3. **Hinweisbanner aktivieren** — Brückentage etc.
4. **Anfragen ansehen** — eingegangene Reservierungen, mit goldenem Badge für Anzahl
5. **Bilder hochladen** — Logo, Hero, Galerie, Akzentfarbe
6. **Öffnungszeiten ändern**

Erst beim Klick auf eine Karte erscheinen Tabs + Panels mit einem „← Zurück zur Übersicht"-Button oben.

## Wochenplan-Editor — kritische Details
- 7 Tageskarten (Mo–So), 2-Spalten-Grid auf Desktop, Single-Column auf Mobile.
- Pro Tag: weiches Textarea „Hauptgericht", Input „Beilage", iOS-Style-Toggle „An diesem Tag geschlossen".
- Labels in normaler Schreibweise — **kein UPPERCASE-Geschrei**.
- Wochen-Navigation mit ← KW → + „Heute"-Knopf + „Vorwoche kopieren".
- **Sunday-Spillover:** Am Sonntag pivotiert der Editor automatisch auf den kommenden Montag — der Inhaber plant am Sonntag schon die neue Woche. Die Sonntags-Karte wird zusätzlich oben als „Heute · Sonntag" eingeblendet und bekommt einen eigenen Spillover-Speicher in der laufenden Woche.
- **Public-Seite muss diese Logik spiegeln:** `initLunchWeek()` auf `mittagstisch.html` schaltet sonntags ebenfalls auf die kommende Woche um, nimmt aber „Heute" aus der laufenden Woche. Sonst sieht der Kunde am Sonntag die alte/leere Woche. → Dieser Bug ist mir in der Vorgängerseite passiert, **bitte gleich richtig machen**.
- Ab 15:00 zeigt die Startseite das Gericht von **morgen** statt von heute (Schließzeit erreicht).

## Speisekarte-Editor
- Drei Kategorien, je editierbarer Titel + Liste aus { name, description }.
- Items per „+ Hinzufügen", entfernbar, sortierbar (drag-and-drop optional).
- Reset auf Standardwerte möglich.

## Öffnungszeiten-Editor
- Reihe = { label, time }. Hinzufügen/Entfernen möglich.
- Public-Seite zeigt einen „Aktuell geöffnet"-Live-Status, der die Zeiten aus dem DOM parst und alle 60 s aktualisiert.

## Hinweisbanner
- Ein Textfeld, ein Speichern, ein „Banner ausblenden"-Knopf.
- Erscheint als gold-akzentuierter Banner direkt unter dem Hero.

## Anfragen-Bereich
- Liste aller Reservierungsanfragen, neueste zuerst.
- Pro Eintrag: Name, Personenzahl, Datum + Uhrzeit als Klartext (`Donnerstag, 14. Mai 2026 · 12:30 Uhr`), klickbares Telefon (`tel:`) und E-Mail (`mailto:` mit vorbereiteter Antwort), Nachricht in einem Zitatblock.
- Aktionen: „Als erledigt markieren" (Toggle), „Löschen".
- Badge auf Overview-Karte UND auf Tab zeigt Anzahl unbearbeitete Anfragen.
- Live-Update via Supabase-Realtime.

## Bilder / Design
- Logo, Hero-Bild, Über-uns-Bild, Galerie (max. 6 Bilder), Akzentfarbe (5 Presets + ColorPicker).
- Upload geht über Supabase-Storage, lokal vorab komprimiert auf max. Kantenlänge.

## Konto
- Aktuell angemeldete E-Mail, Rolle, Passwort-Ändern-Formular.
- „Mitarbeiter-Zugang anlegen" (Supabase signUp mit anon-Key).
- Aktivitätslog (letzte Änderungen).
- „Original-Texte wiederherstellen" und „Alle Eingaben zurücksetzen" als gefährliche Aktionen.

---

# DSGVO

- Cookie-Banner mit „Zustimmen" / „Nur notwendig". Wird in localStorage gemerkt.
- Google-Map auf Kontakt-Seite **deaktiviert** mit Klick-zum-Laden.
- Datenschutzerklärung erwähnt: Supabase-EU-Hosting, Reservierungsdaten, IP-Logs durch Hoster, Cookies.
- Impressum vollständig nach § 5 TMG inkl. Streitschlichtung, Haftung, Urheberrecht.
- E-Recht24-Quelle korrekt referenziert.

---

# SEO

- `<title>` und `<meta name="description">` einzigartig pro Seite.
- `<link rel="canonical">` auf jeder Seite mit absoluter URL.
- Open-Graph (`og:type=restaurant.restaurant`, `og:title`, `og:description`, `og:url`, `og:image`, `og:site_name`, `og:locale=de_DE`) plus Twitter-Card.
- JSON-LD `CafeOrCoffeeShop` auf der Startseite mit `address`, `geo`, `openingHoursSpecification`, `sameAs` (Instagram, Tripadvisor).
- Sitemap.xml als Bonus.
- `robots="noindex"` auf admin.html und 404.html.

---

# Fallen, die mir in der ersten Iteration die Zeit gefressen haben — bitte präventiv vermeiden

1. **Niemals demoPassword in config.js** ablegen — Hintertür. Nur Supabase-Auth, Punkt.
2. **Service-Worker nicht aktivieren**, sonst hängst du am alten Cache. Wenn doch nötig: Kill-Switch-SW, der sich selbst deregistriert.
3. **localStorage und Supabase nicht getrennt behandeln** — sondern hinter einer einzigen `alsterDb`-API kapseln und konsequent über sie schreiben/lesen.
4. **Sunday-Spillover-Logik in Editor UND public-View identisch implementieren** — sonst zeigt der Editor sonntags die kommende Woche, die public-Seite sucht aber in der laufenden und findet nichts.
5. **Reservierungen niemals in der `content`-Tabelle ablegen.** Anonyme Besucher haben dort kein Schreibrecht. Eigene Tabelle mit „public-insert / authenticated-read"-RLS.
6. **Tabs als Landing-Seite vermeiden.** Maria sah früher direkt den Wochenplan und fand alles andere nicht. Overview-Karten als erster Bildschirm.
7. **Labels nicht in UPPERCASE schreien.** Sentence-Case mit dezenter Muted-Farbe — fühlt sich ruhiger und premiumiger an.
8. **Kein „Maria als Person".** Familienbetrieb spricht im Wir-Plural.
9. **Cache-Buster-Querystrings sofort einbauen**, nicht erst wenn ein Stakeholder Updates nicht sieht.
10. **FOUC mit inline-kritischem CSS** ab dem ersten Commit verhindern.
11. **Bei jedem neuen Feature: ist es im Demo-Mode (kein Supabase) noch sinnvoll?** Wenn nein, klar dokumentieren.
12. **Mobile-Test mit realem Gerät**, nicht nur Chrome-DevTools-Resize.

---

# Lieferumfang

Nach Abschluss soll der Repo enthalten:

- 10 HTML-Seiten (siehe oben)
- `styles.css` (eine Datei, ca. 2500–3500 Zeilen)
- `script.js` (öffentliche JS-Logik)
- `db.js` (unified data layer)
- `config.js` (Supabase-URL + Anon-Key + ownerEmail — KEIN demoPassword)
- `admin.js` (Mitgliederbereich-Logik)
- `setup.sql` (komplettes Supabase-Setup, in einem Rutsch ausführbar)
- `UEBERGABE.md` (Schritt-für-Schritt-Anleitung für den Inhaber: Supabase-Konto anlegen, Site-URL setzen, Netlify-Deploy, eigene Domain verknüpfen, erste Tests)
- `image.png` (Logo-Platzhalter, falls noch nicht da)

Am Ende ein Commit pro logischer Etappe, klare Commit-Messages auf Deutsch.

---

# Akzeptanzkriterien

- [ ] Alle 10 Seiten laden ohne Konsolen-Fehler
- [ ] HTML-Tag-Balance auf jeder Seite stimmt
- [ ] Login funktioniert mit echtem Supabase-User
- [ ] Wochenplan speichern und auf zweitem Gerät innerhalb von Sekunden sichtbar
- [ ] Mittagstisch-Seite zeigt am Sonntag die kommende Woche (siehe Fallen-Punkt 4)
- [ ] Reservierung von einem nicht-eingeloggten Browser absenden → erscheint live im Anfragen-Bereich des eingeloggten Inhabers
- [ ] Mobile (375 × 667): alle Karten klickbar, keine abgeschnittenen Texte, Burger funktioniert
- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO = 100
- [ ] Hard-Refresh nach Deploy lädt zwingend die neue Version (Cache-Buster greifen)
- [ ] Kein demoPassword im Repo
- [ ] DSGVO-Texte erwähnen Supabase

---

# Arbeitsweise

- Plane in Etappen. Nach jeder Etappe Commit + kurzer Statusbericht.
- Frage nach, wenn die Geschäftsdaten oben unklar sind. Frage **NICHT** nach Design-Geschmack — entscheide nach den Vorgaben in diesem Prompt.
- Liefere lauffähigen Code in jeder Etappe. Niemals halbfertige Stubs.
- Nutze TodoWrite, wenn die Aufgabe in Unteraufgaben zerfällt.
- Am Ende: pushe alles, gib mir den Branch-Namen und eine Kurzfassung der nächsten Schritte aus UEBERGABE.md.

Los geht's. Erste Etappe: lege das Repo-Grundgerüst an (alle 10 HTML-Skelette mit Header/Footer, styles.css mit Custom-Properties, db.js mit den API-Stubs, setup.sql, UEBERGABE.md leer angelegt). Danach Stopp und Bericht.
