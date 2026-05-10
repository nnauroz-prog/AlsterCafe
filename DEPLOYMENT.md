# Alstercafé · Deployment-Anleitung

Diese Anleitung führt Sie in **15–20 Minuten** vom Demo-Stand zur produktiv
abgesicherten Webseite mit echter Cloud-Anmeldung.

---

## Was Sie am Ende haben

- **Echte Anmeldung** mit E-Mail/Passwort, gehasht auf Server (bcrypt)
- **Cloud-Datenbank** (PostgreSQL via Supabase) — Inhaber-Eingaben
  erscheinen für *alle* Webseiten-Besucher live
- **Cloud-Bilderspeicher** statt localStorage (skaliert beliebig)
- **Passwort-Reset per E-Mail** out-of-the-box
- **Brute-Force-Schutz** durch Supabase
- **HTTPS-Hosting** mit eigener Domain
- **Realtime-Sync**: Bäcker editiert auf Handy → Webseite aktualisiert sich
  überall ohne Reload
- **PWA**: „Add to Home Screen" auf iPhone & Android — Bäcker hat den
  Mitgliederbereich als App
- **Offline-Fähigkeit** (Service Worker cached Shell-Assets)
- **Live-Status-Pille** „Aktuell geöffnet · schließt in X Min." auf
  Basis der Öffnungszeiten
- **Drag & Drop Sortierung** für Speisekarten-Items und Galerie-Bilder
- **Aktivitäts-Verlauf** im Mitgliederbereich
- **Print-optimierte Speisekarte** (Cmd+P liefert druckbare Karte)
- **404-Seite** im Brand-Stil
- **JSON-LD Menu/FAQ-Schemas** für Google Rich Results

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

Empfohlen: **Netlify** (kostenlos, automatisches HTTPS, automatische Deploys
bei jedem Git-Push).

### Variante A · Netlify mit GitHub *(empfohlen)*

1. Auf <https://app.netlify.com> mit GitHub anmelden
2. **Add new site** → **Import an existing project**
3. **Deploy with GitHub** → das Repository `nnauroz-prog/AlsterCafe` wählen
4. Branch: `main` (oder den Branch, auf dem Sie arbeiten)
5. **Deploy site** klicken
6. Nach ~30 Sek. ist die Seite live unter `https://[zufallsname].netlify.app`

### Variante B · Drag & Drop

1. Alle Dateien des Ordners als ZIP packen (oder den Ordner direkt)
2. Auf <https://app.netlify.com/drop> ziehen — fertig

---

## Schritt 6 · Eigene Domain anbinden *(5 Min.)*

1. **Domain bei z. B. Strato/IONOS/Domains.coop registrieren**
   (z. B. `alstercafe.de` — falls noch frei) — kostet 5–15 €/Jahr
2. In Netlify: **Domain settings** → **Add custom domain** → `alstercafe.de`
3. Netlify gibt zwei DNS-Records vor (CNAME + A-Record)
4. Beim Domain-Anbieter im DNS-Bereich diese Records eintragen
5. Nach 5 Min. – einigen Stunden ist die Domain aktiv (DNS-Propagation)
6. Netlify aktiviert automatisch **HTTPS** (Let's Encrypt)

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

- [ ] **Demo-Passwort entfernen:** `demoPassword: ''` in `config.js` setzen
      (sobald supabaseUrl konfiguriert ist, ist die Demo-Auth ohnehin
      nicht mehr aktiv — entfernt aber den String aus dem Source)
- [ ] **GitHub-Repository auf privat stellen:**
      `https://github.com/nnauroz-prog/AlsterCafe/settings`
      → Danger Zone → Change visibility → Make private
- [ ] Echtes Inhaber-Passwort ist mindestens 12 Zeichen
- [ ] Inhaber-E-Mail ist verifiziert
- [ ] HTTPS ist aktiv (grünes Schloss in der Browser-Adressleiste)
- [ ] Security-Headers werden ausgeliefert (testen unter
      <https://securityheaders.com/?q=alstercafe.de>)
- [ ] Impressum-Daten sind korrekt
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
