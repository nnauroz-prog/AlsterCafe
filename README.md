# Alstercafé

Webseite für das Alstercafé in Hamburg-Hohenfelde (Croquenoah Cafe, Inh. Maria Bayrakcioglu, Ifflandstraße 45).

## Live-Adressen

| Wo | URL |
|---|---|
| Aktuell (GitHub Pages) | https://nnauroz-prog.github.io/AlsterCafe/ |
| Geplant (Custom-Domain) | https://alstercafe.de/ — siehe [`CUSTOM-DOMAIN.md`](CUSTOM-DOMAIN.md) |

Auto-Deploy: jeder Push auf den Feature-Branch wird per GitHub Actions in `gh-pages` gespiegelt und ist nach ~1 Minute live.

## Struktur (statisch, kein Build-Schritt)

```
.
├── index.html                       Startseite
├── mittagstisch.html                Wochenplan (Public-View)
├── speisekarte.html                 Frühstück/Backwaren/Heiße Getränke
├── broetchen.html                   Belegte-Brötchen-Bestellservice
├── ueber-uns.html                   Geschichte und Atmosphäre
├── reservierung.html                Tisch-Reservierung
├── kontakt.html                     Anschrift, Karte, Öffnungszeiten
├── impressum.html                   § 5 TMG
├── datenschutz.html                 DSGVO
├── admin.html                       Mitgliederbereich (Inhaber)
├── 404.html
│
├── styles.css                       Eine Datei, Editorial-Design
├── script.js                        Public-JS
├── admin.js                         Mitgliederbereich-Logik
├── db.js                            Unified Data Layer (Supabase + localStorage)
├── config.js                        Supabase-URL und Anon-Key
├── manifest.webmanifest             PWA-Manifest
├── image.png                        Logo
│
├── setup.sql                        Vollständiges Supabase-Setup
├── supabase/functions/
│   └── notify-whatsapp/index.ts     Edge Function: WhatsApp-Benachrichtigung
│
├── .github/workflows/
│   └── deploy.yml                   Auto-Deploy nach gh-pages
│
└── docs/
    ├── UEBERGABE.md                 Schritt-für-Schritt für die Inhaberin
    ├── CUSTOM-DOMAIN.md             alstercafe.de auf Pages umstellen
    ├── WHATSAPP-SETUP.md            Benachrichtigung aktivieren
    └── MASTERPROMPT.md              Re-Use als Template für andere Cafés
```

## Stack

- **Frontend:** plain HTML, vanilla CSS, vanilla JS — kein Build-Schritt, kein Framework.
- **Schriften:** Fraunces (Editorial-Serif) + Inter (Sans), via Google Fonts.
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime). Anon-Key im Frontend, Sicherheit durch Row-Level-Security.
- **Hosting:** GitHub Pages mit Auto-Deploy.
- **Benachrichtigungen:** Supabase Edge Function → WhatsApp (CallMeBot), optional.

## Daten-Layer

`db.js` kapselt alles hinter `window.alsterDb`:

```js
window.alsterDb = {
  isProd,                      // true wenn Supabase konfiguriert
  ready(), get(key), set(key, value), remove(key),
  uploadImage(file, slot), subscribe(cb),
  auth: { signIn, signOut, isAuthed, getEmail, resetPassword,
          updatePassword, inviteUser },
  // Reservierungen
  addReservation, listReservations, updateReservationStatus, deleteReservation,
  // Brötchen-Bestellungen
  addOrder, listOrders, updateOrderStatus, deleteOrder
}
```

Tabellen in Supabase (alles in `setup.sql`):
- `content` — Key-Value-Store für Wochenplan, Menü, Öffnungszeiten, Design, Banner, Brötchen-Sorten. Public-Read, Authenticated-Write.
- `reservations` — Tisch-Anfragen. Public-Insert, Authenticated-Read/-Write.
- `orders` — Brötchen-Bestellungen mit Positionen. Public-Insert, Authenticated-Read/-Write.

## Mitgliederbereich

`admin.html` — Login per Supabase Auth, danach Dashboard mit großen Aktionskacheln:
- Mittagsmenü bearbeiten (Wochenplan mit Sonntag-Spillover)
- Speisekarte pflegen
- Hinweisbanner aktivieren
- Anfragen ansehen (Reservierungen, Live-Update)
- Brötchen-Bestellungen (mit eigener Sorten-Verwaltung)
- Bilder hochladen (Logo, Hero, Über-uns, Galerie)
- Öffnungszeiten ändern
- Konto (Passwort, Mitarbeiter anlegen)

Jeder Bereich hat eine eingebaute „So geht's"-Anleitung.

## Editorial-Design

- Cream-Hintergrund (`#FFFCF4`), Espresso-Text (`#3D2415`), Gold-Akzent (`#B8893E`)
- Fraunces-Optical-Sizing für Headlines, Inter für Fließtext
- Editorial-Wasserzeichen pro Seite (Mittag, Karte, Frisch, Tisch, Hier, Familie)
- Marquee-Ticker im Hero, Hochzähl-Animation für „über 15 Jahre"
- Mobile-First, Full-Screen-Menü, magnetische Hover-Effekte (Desktop)

## Lokales Arbeiten

```bash
# Reicht ein einfacher HTTP-Server (Python):
python3 -m http.server 8080

# Dann im Browser: http://localhost:8080/
```

Kein Build, kein npm, kein nichts.

## Übergabe an Maria

Komplette Schritt-für-Schritt-Anleitung: [`UEBERGABE.md`](UEBERGABE.md).
