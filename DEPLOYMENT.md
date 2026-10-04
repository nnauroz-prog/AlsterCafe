# Alstercafé · Deployment-Anleitung

Diese Anleitung führt Sie in **15–20 Minuten** vom Demo-Stand zur produktiv
abgesicherten Webseite mit echter Cloud-Anmeldung.

---

## Was Sie am Ende haben

- **Echte Anmeldung** mit E-Mail/Passwort, gehasht auf Server (bcrypt)
- **Cloud-Datenbank** (PostgreSQL via Supabase) — Inhaber-Eingaben
  erscheinen für *alle* Webseiten-Besucher live
- **Cloud-Bilderspeicher** statt localStorage, mit automatischer
  Kompression vor Upload (480 px Logo, 1400 px Hero/Über-uns, 1200 px Galerie)
- **Passwort-Reset per E-Mail** out-of-the-box
- **Brute-Force-Schutz** durch Supabase
- **HTTPS-Hosting** mit eigener Domain (GitHub Pages oder Netlify)
- **Realtime-Sync**: Bäcker editiert auf Handy → Webseite aktualisiert sich
  überall ohne Reload
- **PWA-Manifest**: „Add to Home Screen" auf iPhone & Android — Bäcker hat den
  Mitgliederbereich als App-Icon. (Kein Service Worker im Einsatz — die Seite
  ist klein genug, dass Browser-Cache + Cache-Buster reichen. Ein altes SW
  wird bei jedem Pageload aktiv entfernt.)
- **Live-Status-Pille** „Aktuell geöffnet · schließt in X Min." auf
  Basis der Öffnungszeiten
- **Drag & Drop Sortierung** für Speisekarten-Items und Galerie-Bilder
- **Aktivitäts-Verlauf** im Mitgliederbereich
- **Print-optimierte Speisekarte** (Cmd+P liefert druckbare Karte)
- **404-Seite** im Brand-Stil
- **JSON-LD Schema.org** auf Index (`CafeOrCoffeeShop` mit Öffnungszeiten +
  foundingDate 2013) und auf jeder Sub-Page (`BreadcrumbList`)

---

## Schritt 1 · Supabase-Projekt anlegen *(5 Min.)*

1. Auf <https://supabase.com> mit GitHub oder E-Mail anmelden
2. **New Project** anklicken
3. Werte eintragen:
   - **Name:** `alstercafe`
   - **Database Password:** ein zufälliges, starkes Passwort
     (notieren Sie es, brauchen wir nur für Notfälle)
   - **Region:** **Frankfurt (eu-central-1)** für DSGVO-Konformität
4. **Create new project** klicken — dauert ~2 Min.

---

## Schritt 2 · Datenbank-Schema einrichten *(2 Min.)*

1. Im Supabase-Dashboard links: **SQL Editor**
2. **New query** klicken
3. Inhalt der Datei `setup.sql` aus diesem Repository hineinkopieren
4. **Run** klicken (rechts unten)
5. Erwartete Antwort: „Success. No rows returned."

Das legt an:
- Tabelle `content` für alle Inhalte
- Storage-Bucket `images` für hochgeladene Fotos
- Row-Level-Security: nur authentifizierte Nutzer dürfen schreiben

---

## Schritt 3 · Inhaber-Account anlegen *(2 Min.)*

1. Im Supabase-Dashboard: **Authentication** → **Users**
2. **Add user** → **Create new user**
3. Eintragen:
   - **Email:** `inhaber@alstercafe.de` (oder die echte E-Mail des Bäckers)
   - **Password:** ein sicheres Passwort (mind. 12 Zeichen,
     Buchstaben + Zahlen + Sonderzeichen)
   - **Auto Confirm User** ✓ aktivieren
4. **Create user** klicken

> 💡 Sie können später jederzeit weitere Mitarbeiter-Accounts anlegen.

---

## Schritt 4 · API-Keys in `config.js` eintragen *(1 Min.)*

1. Supabase-Dashboard: **Project Settings** (Zahnrad-Icon) → **API**
2. Zwei Werte kopieren:
   - **Project URL** (z. B. `https://abcdefgh.supabase.co`)
   - **Project API keys** → **anon public** (langer Token mit `eyJ…`)
3. Datei `config.js` öffnen und einsetzen:

```js
window.ALSTERCAFE_CONFIG = {
  supabaseUrl:     'https://abcdefgh.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.....',
  storageBucket:   'images',
  ownerEmail:      'inhaber@alstercafe.de'
};
```

4. Speichern.

> 🔒 Diese beiden Werte sind **öffentlich** und dürfen im Frontend stehen.
> Die echte Sicherheit kommt durch die Row-Level-Security-Regeln,
> die wir in Schritt 2 angelegt haben.

---

## Schritt 5 · Webseite hosten *(5 Min.)*

Aktueller Stand: **GitHub Pages** (kostenlos, automatischer Deploy aus dem
Feature-Branch in den `gh-pages`-Branch via GitHub Action).

### Variante A · GitHub Pages *(aktive Konfiguration)*

1. Push auf den Feature-Branch (`claude/bakery-website-redesign-vyyXQ` oder
   `main`) löst automatisch den Workflow aus.
2. Live-URL: `https://nnauroz-prog.github.io/AlsterCafe/`
3. Custom-Domain einrichten: siehe `CUSTOM-DOMAIN.md`.
4. Hinweis: GitHub Pages liest **nicht** `_headers` oder `netlify.toml` —
   die dort definierten Security-Header (HSTS, CSP, X-Frame-Options,
   Permissions-Policy) sind dort **nicht aktiv**. Auf der Seite selbst ist
   `Referrer-Policy` als `<meta>` gesetzt, das funktioniert host-unabhängig.

### Variante B · Netlify (alternativ, kostenlos)

Falls voll funktionierende Security-Header gewünscht sind, ist Netlify
eine Alternative — die liest `_headers` und `netlify.toml` automatisch.

1. Auf <https://app.netlify.com> mit GitHub anmelden
2. **Add new site** → **Import an existing project**
3. **Deploy with GitHub** → Repository `nnauroz-prog/AlsterCafe` wählen
4. Branch: `main`
5. **Deploy site** klicken — fertig

---

## Schritt 6 · Eigene Domain anbinden *(5 Min.)*

Siehe ausführliche Anleitung in **`CUSTOM-DOMAIN.md`** (DNS-Records,
GitHub-Pages-Setting, CNAME-Datei im Source-Branch). Inhalt in Kurz:

1. **Domain bei z. B. Strato/IONOS registrieren** — kostet 5–15 €/Jahr
2. **DNS-Records setzen:** vier `A`-Records auf die GitHub-Pages-IPs +
   ein `CNAME` für `www` → `nnauroz-prog.github.io`
3. **In GitHub:** Settings → Pages → Custom domain `alstercafe.de` eintragen
4. **HTTPS aktivieren:** „Enforce HTTPS" anhaken (Let's Encrypt, kostenlos)
5. **CNAME-Datei** in den Source-Branch übernehmen, sonst überschreibt
   der Auto-Deploy die Custom-Domain

---

## Schritt 7 · Test

1. <https://alstercafe.de> öffnen
2. Im Footer auf **Mitgliederbereich** klicken
3. Mit der E-Mail aus Schritt 3 anmelden
4. Im Tab **Wochenplan** etwas eintragen → speichern
5. In einem zweiten Browser-Fenster die Hauptseite öffnen
   → Eintrag sollte sofort sichtbar sein (Realtime)
6. Ein Bild im **Design**-Tab hochladen → erscheint überall live

---

## Was bei Problemen?

### „Anmeldung fehlgeschlagen"
- Stimmen E-Mail/Passwort?
- Ist der User in Supabase **bestätigt** (grünes Häkchen)?
- Browser-Konsole (F12) zeigt detaillierten Fehler

### „Bild-Upload schlägt fehl"
- Ist der Storage-Bucket `images` angelegt? *(setup.sql Schritt 5)*
- Sind Sie eingeloggt?

### „Daten werden nicht gespeichert"
- Sind die RLS-Policies aktiv? *(setup.sql Schritt 3)*
- Browser-Konsole zeigt Fehlermeldung

### „config.js wird nicht geladen"
- Liegt sie im selben Ordner wie `index.html`?
- Sind beide Werte (URL + Key) ausgefüllt?

---

## Was Sie an den Bäcker übergeben

1. **Login-URL:** `https://alstercafe.de/admin.html`
2. **E-Mail:** die in Schritt 3 angelegte
3. **Initial-Passwort:** das in Schritt 3 vergebene
4. **Hinweis:** „Bitte Passwort beim ersten Login ändern" *(geht in der
   Endversion über Mitgliederbereich → Konto → Passwort ändern)*

---

## Kosten-Übersicht

| Position | Kosten/Monat |
|---|---|
| Supabase (Free Tier) | **0 €** (bis 50.000 Logins/Monat, 500 MB DB, 1 GB Storage) |
| Netlify (Free Tier) | **0 €** (bis 100 GB Traffic) |
| Domain `alstercafe.de` | ~ **0,80 €** (10 €/Jahr) |
| **Gesamt** | **~ 1 €/Monat** |

Bei mehr Traffic skaliert Supabase auf 25 €/Monat (Pro Tier) — für eine
Bäckerei-Webseite irrelevant.

---

## Sicherheits-Checkliste vor Go-Live

- [x] **Demo-Passwort entfernt** (bereits erledigt — `config.js` enthält
      keinen `demoPassword`-Schlüssel mehr)
- [ ] **GitHub-Repository auf privat stellen:**
      `https://github.com/nnauroz-prog/AlsterCafe/settings`
      → Danger Zone → Change visibility → Make private
- [ ] Echtes Inhaber-Passwort ist mindestens 12 Zeichen
- [ ] Inhaber-E-Mail ist verifiziert
- [ ] HTTPS ist aktiv (grünes Schloss in der Browser-Adressleiste)
- [ ] Security-Headers prüfen unter <https://securityheaders.com/?q=alstercafe.de>:
      auf GitHub Pages werden NUR Referrer-Policy (via `<meta>`) und
      HSTS (von GitHub gesetzt) ausgeliefert. Für CSP/X-Frame-Options
      Cloudflare davorhängen oder zu Netlify wechseln.
- [ ] Impressum-Daten sind korrekt (Croquenoah Cafe, Inh. Maria Bayrakcioglu)
- [ ] Datenschutzerklärung-Daten sind korrekt
- [ ] Sitemap zeigt auf die richtige Domain
      (`sitemap.xml` ggf. anpassen)

---

## Optional: 2-Faktor-Authentifizierung

Supabase unterstützt TOTP-2FA out-of-the-box. Aktivierung:
**Authentication → Providers → enable MFA**
Der Bäcker scannt einen QR-Code mit einer Authenticator-App (Google
Authenticator, Authy) — beim Login wird zusätzlich ein 6-stelliger Code
abgefragt.

Dringend empfohlen für die echte Inhaber-E-Mail.
