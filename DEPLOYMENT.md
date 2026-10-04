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
  foundingDate 2004) und auf jeder Sub-Page (`BreadcrumbList`)

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
   - **Email:** `info@alstercafe.de` (die echte Login-E-Mail des Cafés)
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
  ownerEmail:      'info@alstercafe.de'
};
```

4. Speichern.

> 🔒 Diese beiden Werte sind **öffentlich** und dürfen im Frontend stehen.
> Die echte Sicherheit kommt durch die Row-Level-Security-Regeln,
> die wir in Schritt 2 angelegt haben.

---

## Schritt 5 · Webseite hosten *(5 Min.)*

Aktueller Stand: **Vercel** (kostenlos, automatischer Deploy bei jedem Push
auf `main`). Zusätzlich spiegelt eine GitHub Action weiterhin nach `gh-pages`
(Backup-Spiegel).

### Variante A · Vercel *(aktive Produktions-Konfiguration)*

1. Push auf `main` löst automatisch einen Vercel-Deploy aus.
2. Live-URL: `https://alstercafe.de/` (Projekt: `https://alster-cafe.vercel.app/`).
3. Custom-Domain einrichten: siehe `CUSTOM-DOMAIN.md`.
4. Security-Header: Vercel liest `vercel.json` — dort sind HSTS, CSP,
   X-Frame-Options, Referrer-Policy und Permissions-Policy aktiv
   (`_headers`/`netlify.toml` werden von Vercel **nicht** gelesen).

### Variante B · GitHub Pages (Backup-Spiegel)

1. Push auf den Feature-Branch (`claude/bakery-website-redesign-vyyXQ` oder
   `main`) spiegelt via GitHub Action nach `gh-pages`.
2. Spiegel-URL: `https://nnauroz-prog.github.io/AlsterCafe/`
3. Hinweis: GitHub Pages liest **nicht** `_headers`/`netlify.toml`/`vercel.json` —
   die Security-Header sind dort **nicht aktiv** (der Spiegel dient nur als
   Ausfall-Backup; produktiv ist Vercel).

---

## Schritt 6 · Eigene Domain anbinden *(5 Min.)*

Siehe ausführliche Anleitung in **`CUSTOM-DOMAIN.md`** (DNS-Records bei STRATO,
Vercel-Domains-Setting). Inhalt in Kurz:

1. **Domain** `alstercafe.de` liegt bei **STRATO** (5–15 €/Jahr).
2. **In Vercel:** Projekt → Settings → Domains → `alstercafe.de` und
   `www.alstercafe.de` hinzufügen — Vercel zeigt die exakten DNS-Werte.
3. **In STRATO (DNS):** interne Umleitung entfernen; `A @ → 76.76.21.21`,
   `CNAME www → cname.vercel-dns.com` (bzw. exakt wie von Vercel angezeigt).
4. **HTTPS** wird von Vercel automatisch bereitgestellt (Let's Encrypt).
5. **MX-Records** (E-Mail) NICHT anfassen.

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
