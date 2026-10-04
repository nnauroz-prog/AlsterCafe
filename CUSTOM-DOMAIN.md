# Custom-Domain einrichten (alstercafe.de → Vercel)

Aktuelle Live-Adresse (Vercel):
```
https://alster-cafe.vercel.app
```
Ziel: Die eigene Domain zeigt auf die neue Seite:
```
https://alstercafe.de
```

**Ausgangslage:** `alstercafe.de` liegt bei **STRATO** und zeigt dort aktuell eine **alte
WordPress-Seite** (Webspace, „Umleitung Intern"). Wir stellen die DNS-Einträge so um, dass die
Domain die neue Vercel-Seite ausliefert. Die WordPress-Dateien bleiben als Backup im Webspace,
werden aber nicht mehr unter der Domain angezeigt.

Dauer: ~15 Min. Einrichtung + 1–24 h DNS-Verbreitung. HTTPS kommt bei Vercel automatisch.

---

## Schritt 1 — In Vercel die Domain hinzufügen (zuerst!)
1. Vercel → Projekt **alster-cafe** → **Settings → Domains**.
2. `alstercafe.de` eintragen → **Add**. Danach ebenso `www.alstercafe.de` → **Add**.
3. Vercel zeigt dann **die genauen DNS-Werte**, die bei STRATO einzutragen sind
   (in der Regel ein **A-Record** für die nackte Domain und ein **CNAME** für `www`).
   Diese Werte sind maßgeblich — nimm sie genau so, wie Vercel sie anzeigt.

Typische Werte (zur Orientierung — Vercels Anzeige gilt):
```
A      @     76.76.21.21
CNAME  www   cname.vercel-dns.com
```

## Schritt 2 — Bei STRATO die DNS-Einträge setzen
1. STRATO → Domainverwaltung → `alstercafe.de`.
2. Die aktuelle **„Umleitung Intern"** (auf den WordPress-Webspace) **deaktivieren/entfernen**
   — sonst überschreibt sie die DNS-Weiterleitung zu Vercel.
3. Tab **DNS** öffnen und eintragen (exakt die Werte aus Schritt 1):
   - **A-Record** für `@` (die nackte Domain) → Vercel-IP (z. B. `76.76.21.21`).
   - **CNAME** für `www` → `cname.vercel-dns.com`.
4. Speichern.

## ⚠️ Wichtig: E-Mail nicht kaputt machen
Falls es **E-Mail-Postfächer `@alstercafe.de`** bei STRATO gibt: **die `MX`-Einträge NICHT
ändern/löschen** — nur die `A`/`CNAME`-Einträge für die Website anfassen. Sonst kommt keine
Post mehr an. (Nur die Web-Einträge zeigen auf Vercel, die Mail-Einträge bleiben bei STRATO.)

## Schritt 3 — Warten & prüfen
- Nach einigen Minuten bis max. 24 h: `https://alstercafe.de` zeigt die neue Seite.
- In Vercel steht die Domain dann auf **„Valid Configuration"**, HTTPS ist automatisch aktiv.
- `www.alstercafe.de` sollte auf `alstercafe.de` weiterleiten (in Vercel so einstellbar).

## Rückfahrkarte
Geht etwas schief, einfach bei STRATO die DNS-Änderung rückgängig machen bzw. die alte
„Umleitung Intern" wieder aktivieren — dann ist die alte WordPress-Seite wieder unter der
Domain sichtbar. Die neue Seite bleibt davon unberührt unter `alster-cafe.vercel.app` erreichbar.
