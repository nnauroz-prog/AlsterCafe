# =============================================================
# MASTER-PROMPT für lokale Boutique-Webseiten (Café/Bäckerei/Restaurant)
# =============================================================
# Anwendung: Diesen Prompt in den Chat kopieren, Platzhalter
# <<...>> mit den Daten des Kunden befüllen, fertig.
# =============================================================

Baue mir eine vollständige, production-ready Webseite für eine lokale
Boutique-Marke (Café / Bäckerei / Restaurant / kleines Geschäft).
Liefere alle Dateien fertig im Workspace ab, mit echtem Inhalt
(keine Lorem-Ipsum-Platzhalter), und committe & pushe in das
Git-Repository.

## KUNDEN-DATEN (bitte ersetzen)

- Markenname: <<Alstercafé>>
- Inhaber:    <<Maria Bayrakcioglu>>
- Adresse:    <<Ifflandstraße 45, 22087 Hamburg>>
- Telefon:    <<040 / 22 69 28 91>>
- E-Mail:     <<info@alstercafe.de>>
- USt-IdNr.:  <<DE246690078>>
- Logo-Datei: <<image.png>> (im Repo-Root)
- Markenbeschreibung in 2 Sätzen:
  <<Zentral zwischen Alsterschwimmhalle und Außenalster gelegen,
  lädt das Café mit familiärer Atmosphäre täglich zum Frühstück
  und Kaffee ein. Unter der Woche zusätzlich wechselnder Mittagstisch.>>
- Externe Links (Webshop, Instagram, Tripadvisor, etc.):
  <<https://croquenoah.simplywebshop.de/storedata/listStore>>,
  <<https://www.instagram.com/alstercafe/>>,
  <<https://www.tripadvisor.de/...>>
- Mittagstisch-Beispiel (für Demo-Daten):
  <<Hähnchenschenkel oder gebackener Schafskäse mit Bulgur oder Reis>>
- Öffnungszeiten:
  <<Mo–Fr 06:30–15:00, Sa 07:30–15:00, So 07:30–15:00>>

## TECH-STACK & EINSCHRÄNKUNGEN

- Reines **HTML / CSS / Vanilla-JavaScript** — KEIN Build-Step,
  KEIN Webpack, KEIN React/Vue/Next. Statisch deploybar auf jedem Server.
- Optional **Supabase** als Backend (Auth + Postgres + Storage + Realtime)
  — wird über `config.js` aktiviert. Ohne Supabase läuft alles als
  Demo mit `localStorage`.
- Schriften via Google Fonts: **Fraunces** (Serif, mit Optical-Sizing)
  + **Inter** (Sans).
- Mobile-First, vollständig responsive.
- Keine externen UI-Frameworks (kein Tailwind, kein Bootstrap).
- Inline-SVG-Icons, keine Emoji-Icons.

## DESIGN-RICHTUNG

- **Boutique / Editorial / Aesop / Apple / Boutique-Hotel.**
- Warme Farbpalette: Cream (#FAF5EC), Paper (#FFFCF4), Espresso (#3D2415),
  Coffee (#5C3C20), Gold (#B8893E), Linen (#F1E7D3).
- Akzent-Farbe gold, sparsam eingesetzt.
- Typografie: Fraunces für Headlines (Optical-Sizing 96 für Display,
  italic für Akzente), Inter für Body, ALLE Eyebrows in 0.22em
  letter-spacing UPPERCASE mit nummeriertem Kreis-Tag (01, 02, ...).
- Sektionen-Polster: `clamp(72px, 9vw, 130px)` vertikal.
- Soft-Shadow-System (4 Stufen: xs/sm/base/lg), niemals harte Schatten.
- Premium-Easing-Curve global: `cubic-bezier(0.22, 1, 0.36, 1)`.
- Hero mit zeilen-gestaffelter Reveal-Animation (80/200/340ms Delay).
- `text-wrap: balance` auf Headlines, `text-wrap: pretty` auf Paragrafen.
- `:focus-visible` statt `:focus` (keine Maus-Outlines).
- `prefers-reduced-motion` überall respektiert.
- Mobile: Safe-Area-Inset für Notch-Geräte, min-height 48px für Touch.

## SEITEN-AUFBAU (öffentliche Hauptseite)

1. **Topbar** (dünn, espresso-braun): Telefon · Adresse · Freies WLAN
2. **Sticky Header** mit Logo + Marken-Schriftzug (Fraunces italic) +
   Hauptnavigation. Auf Scroll: Blur-Background + verkleinertes Logo.
   Goldener "Webshop ↗"-Button rechts in der Nav (falls externer Shop).
3. **Hero** mit:
   - Eyebrow "Café · Bäckerei · <<Stadtteil>>"
   - 3-zeilige Headline mit Italic-Akzent
   - Lead-Text (max. 3 Zeilen)
   - Primary-CTA "Online bestellen" (zum Webshop) + Secondary-Link
   - Visual rechts: CSS-illustrierte Kaffeetasse mit animiertem Dampf
     (kein Bild, reines CSS) — wird im Design-Studio durch echtes
     Foto ersetzbar.
4. **Mittagstisch** (dunkel, espresso-Hintergrund):
   - "Heute"-Karte mit pulsierendem Gold-Dot, großem Italic-Gericht
   - 7-Tage-Wochenkarte (Grid), heute hervorgehoben mit Gold-Akzent-Linie
   - Telefon-CTA "Tisch reservieren · ab 12:00" in Gold
5. **Über uns**: 1.4fr Text + 1fr Aside mit Quote (großes deutsches
   Anführungszeichen `„`, italic Fraunces).
6. **Speisekarte** (3 Spalten): Frühstück | Backwaren | Heiße Getränke
   — Items mit Hover-Padding-Shift, dotted Trennlinien.
7. **Reservierung** (dunkel): Form mit Underline-Inputs, Loading-Spinner +
   Success-Flash, mailto-Submit.
8. **Galerie** (nur sichtbar wenn der Inhaber Bilder hochgeladen hat):
   Magazine-Grid mit Feature-Tile (4 Spalten + 2 Reihen) für erstes Bild.
9. **Kontakt + Öffnungszeiten kombiniert**: Adresse + Telefon + Social +
   Hours-Liste links, eingebettete Karte (Google Maps oder OSM) rechts —
   **erst nach Cookie-Einwilligung** geladen.
10. **Footer** (espresso): Logo + Brand + Footer-Nav (Mittagstisch,
    Speisekarte, Impressum, Datenschutz, Cookies anpassen,
    Mitgliederbereich) + © Jahr.

## SEITEN-AUFBAU (rechtlich erforderlich)

- **`impressum.html`** mit echten Inhaber-Daten nach §5 TMG (Anbieter,
  Kontakt, USt-IdNr., Aufsichtsbehörde, Verantwortlich nach §18 MStV,
  vollständiger Disclaimer).
- **`datenschutz.html`** im Wortlaut der bestehenden Webseite oder als
  e-recht24-Standard-Text (Datenschutz-Generator). Mit Sektionen
  Verantwortlicher, Verarbeitete Daten, Rechtsgrundlagen, Cookies,
  Drittanbieter (Google Fonts, Maps), Betroffenenrechte, Widerrufsrecht.

## DSGVO / TTDSG

- Cookie-Consent-Banner unten: "Alle akzeptieren" / "Nur notwendige".
- iOS-Safe-Area-Padding-Bottom.
- Karten-Embed (Google Maps/OSM) lädt **erst nach** Akzeptieren —
  vorher Platzhalter mit "Karte laden"-Button + Datenschutz-Hinweis.
- "Cookies anpassen"-Link im Footer öffnet Banner erneut.

## MITGLIEDERBEREICH (`admin.html`)

Hinter Login. Linke Spalte ENTFÄLLT — vertikal-gestackte Tabs oben.

### Login-Formular
- E-Mail + Passwort, Auge-Toggle für Passwort-Sichtbarkeit
- `autocapitalize="none"`, `autocorrect="off"`, `spellcheck="false"`
- Anti-Flash: Login-View startet `hidden`, wird per JS sichtbar
  geschaltet nach Auth-Check
- Fade-in-Animation
- Hinweis "Passwort vergessen? Bitte Administrator kontaktieren."

### Dashboard (nach Login)
- Header mit User-Badge (E-Mail mit grünem Status-Dot), goldener
  "Texte bearbeiten"-Button (öffnet Hauptseite mit `?edit=1` in
  neuem Tab), "Vorschau", "Abmelden"
- Welcome-Section: H1, Beschreibungstext, **3 Stat-Cards**:
  "X von 7 Tagen befüllt", "Aktuelle KW", "Zuletzt gespeichert"
- **Tab-Navigation**: Wochenplan / Speisekarte / Öffnungszeiten /
  Design / Hinweis-Banner / Konto
- Tabs scrollen horizontal auf Mobile (versteckte Scrollbar)

### Tab: Wochenplan
- Wochen-Navigator (← KW XX · DD.MM – DD.MM → · "Heute"-Schnellzugriff)
- 7 Tageskarten (Mo–So) mit:
  - Hauptgericht (Textarea)
  - Beilagen / Zusatz (Input)
  - "Geschlossen / Kein Mittagstisch" Toggle
  - "Heute"-Pille auf der heutigen Karte, Gold-Akzent-Border
- Toolbar: Vorwoche kopieren, JSON-Export, Woche leeren
- Sticky-Save-Bar (Pill mit Backdrop-Blur, Safe-Area)

### Tab: Speisekarte
- 3 Kategorien (Frühstück / Backwaren / Heiße Getränke)
- Pro Kategorie: editierbare Titel + Liste von Items
- Pro Item: Bezeichnung + Beschreibung + X-Remove-Button
- "Eintrag hinzufügen"-Button pro Kategorie
- Save-Bar mit "Auf Standard zurücksetzen"

### Tab: Öffnungszeiten
- Beliebig viele Zeilen mit Label + Zeit
- "+ Zeile hinzufügen"-Button
- Save-Bar

### Tab: Design (das Highlight)
- **Logo**: Upload, zeigt aktuelles Logo aus Repo-Root als Standard
  mit "Standard-Logo"-Tag
- **Hero-Bild**: Upload, ersetzt CSS-Animation durch eigenes Foto
- **Über-uns-Bild**: Upload, neue Bildebene über dem Quote
- **Galerie**: Multi-Upload, max. 6 Bilder, Tile-Grid mit Hover-Remove
- **Akzentfarbe**: 5 Color-Chip-Presets (Gold/Kupfer/Salbei/Mocca/
  Espresso) + Custom-Color-Picker
- Bilder werden via Canvas auf max. 1400px komprimiert (q=0.85),
  in Production zu Supabase Storage hochgeladen, in Demo als
  data-URL in localStorage
- Live-Vorschau: Änderungen erscheinen sofort auf der Hauptseite
  (Cross-Tab-Sync via Storage-Event oder Supabase-Realtime)

### Tab: Hinweis-Banner
- Textarea, Save → erscheint als gold-farbener Banner ganz oben
  auf der Hauptseite
- "Banner ausblenden"-Button

### Tab: Konto
- Card "Konto": angemeldete E-Mail + Rolle + Sicherheitshinweis
- Card "Eigenes Passwort ändern": Form mit Mindest-8-Zeichen +
  Bestätigung
- Card "Mitarbeiter-Zugang anlegen": E-Mail + Initial-Passwort,
  Liste aller Mitarbeiter mit "Sie"-Badge fürs eigene Konto und
  X-Remove fürs Entfernen anderer
- Card "Gefahrenzone": rote Border, "Alle Eingaben zurücksetzen"

## INLINE-EDIT-MODE auf der Hauptseite

- URL `?edit=1` aktiviert WYSIWYG-Bearbeitung
- **Synchroner Auth-Gate im `<head>`** der Hauptseite — prüft
  localStorage VOR jedem Rendering, ob Session existiert. Bei
  Nicht-Auth: sofortige Weiterleitung zu `admin.html?next=edit`
  (Seite wird nie sichtbar)
- Async-Backup-Check in `initEditMode()` für Supabase-Sessions
- Editierbare Texte mit `data-editable="key"`-Attribut markiert:
  hero.eyebrow, hero.head1/2/3, hero.lead, about.headline, about.p1/p2/quote,
  lunch.headline/note, menu.headline, reservation.headline/intro, contact.headline
- Hover: gold-gestrichelte Outline + "Bearbeiten"-Label oben links
- Click: contenteditable=true, gold solide Outline
- Blur: automatisches Speichern in `content`-Storage
- **Floating Edit-FAB** unten rechts (KEINE Top-Toolbar — würde
  Layout verschieben). Pille mit pulsierendem Gold-Dot.
  Klick öffnet Menü mit Status, "Texte zurücksetzen", "Fertig".

## DATEN-LAYER (`db.js`)

- Unified API: `window.alsterDb.get(key)`, `.set(key, value)`,
  `.remove(key)`, `.uploadImage(file, slot)`, `.subscribe(cb)`,
  `.auth.{signIn,signOut,isAuthed,getEmail,updatePassword,
   inviteUser,listUsers,removeUser}`
- Schaltet automatisch zwischen Supabase und localStorage je nach
  `config.js`. Identische API für beide Pfade.
- Reads sind synchron (aus Cache), Writes async.
- Hydratation aus Supabase bei `db.ready()` füllt den
  localStorage-Cache.
- Realtime-Subscription auf Supabase `content`-Tabelle —
  Änderungen erscheinen live ohne Reload.
- Bildupload: Supabase Storage Bucket "images" mit Public-URL
  oder data-URL-Fallback im Demo.

## SUPABASE-SETUP (in `setup.sql` ablegen)

- Tabelle `public.content` (id text PK, data jsonb, updated_at timestamptz)
- Row-Level-Security:
  - SELECT: public (`true`)
  - INSERT/UPDATE/DELETE: nur `auth.role() = 'authenticated'`
- `alter publication supabase_realtime add table public.content`
- Storage-Bucket `images` mit `public = true`
- Storage-Policies: SELECT public, INSERT/UPDATE/DELETE authenticated only

## SECURITY HARDENING (Netlify-spezifisch)

- `_headers`-Datei mit:
  - Strict-Transport-Security (1 Jahr, includeSubDomains, preload)
  - X-Frame-Options: SAMEORIGIN
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy: camera=(), microphone=(), payment=()
  - Content-Security-Policy mit known-good Quellen
    (Supabase, Google Fonts, Maps, OSM)
- `/admin.html` mit `X-Robots-Tag: noindex, nofollow`
- Aggressive Cache-Headers für JS/CSS/Fonts (1 Jahr, immutable),
  niemals für HTML
- `netlify.toml` mit URL-Redirects (`/admin` → `admin.html`)
- `robots.txt`: Disallow /admin
- `sitemap.xml` mit allen öffentlichen Seiten

## SEO

- JSON-LD `CafeOrCoffeeShop`-Schema im `<head>` mit Adresse,
  Koordinaten, Öffnungszeiten, USt-Id
- Open Graph + Twitter Card Meta-Tags
- Lang-Attribut `de`, Theme-Color, Viewport-Meta

## DATEISTRUKTUR (Liefer-Output)

```
/
├── index.html        # Hauptseite, Inline-Auth-Gate für edit
├── admin.html        # Mitgliederbereich
├── impressum.html
├── datenschutz.html
├── styles.css        # Komplettes Design-System
├── script.js         # Hauptseite + Edit-Mode
├── admin.js          # Dashboard-Logik
├── db.js             # Unified Data Layer
├── config.js         # Supabase-URL + ANON-Key + ownerEmail + demoPassword
├── setup.sql         # Supabase-Setup-Script
├── _headers          # Netlify Security Headers
├── netlify.toml      # Netlify Build-Config
├── robots.txt
├── sitemap.xml
├── DEPLOYMENT.md     # Schritt-für-Schritt-Anleitung (15 Min)
└── image.png         # Logo
```

## ARBEITSWEISE

1. Erst alle Inhalte sammeln (Markenname, Adresse, Öffnungszeiten,
   echte Texte). Bei fehlenden Infos beim Auftraggeber nachfragen.
2. Demo-Modus zuerst bauen (alles funktioniert mit localStorage),
   damit der Pitch beim Kunden sofort möglich ist.
3. Production-Migration auf Supabase erst nach Vertragsabschluss.
4. Nach jedem größeren Schritt commiten + pushen.
5. Vorschau via raw.githack.com des Feature-Branches teilen.
6. Vor Go-Live: Demo-Passwort leeren, GitHub-Repo privat schalten,
   securityheaders.com prüfen → Ziel: Note A oder besser.

## PITCH-NUTZUNG

Beim Kundentermin diese Reihenfolge:
1. Hauptseite → durchscrollen, Hero, Mittagstisch zeigen
2. „Online bestellen"-Button drücken (falls Webshop) → Verkaufs-Argument
3. Footer → Mitgliederbereich anklicken
4. Live einloggen vor dem Kunden
5. Wochenplan-Tab → ein Gericht ändern → speichern
6. Goldener „Texte bearbeiten"-Button → Hauptseite mit Edit-FAB
7. Auf einen Text klicken → live ändern → Kunde sieht Wow-Moment
8. Design-Tab → Akzentfarbe wechseln → alle Akzente passen sich an
9. Konto-Tab → "Mitarbeiter-Zugang anlegen" zeigen

Erkläre dem Kunden ehrlich:
- Demo läuft auf raw.githack.com
- Production kommt mit Supabase + Netlify (~ 1 €/Monat Betriebskosten)
- Bäcker bekommt eigene E-Mail-/Passwort-Auth, Cloud-Sync,
  HTTPS-Domain, Backups
- Aufwand nach Vertragsabschluss: 1 Tag bis Live-Schaltung

Preisempfehlung: 3.000 – 7.000 € einmalig je nach Aufwand.
