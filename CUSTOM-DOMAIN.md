# Custom-Domain einrichten (alstercafe.de → GitHub Pages)

Aktuelle Live-Adresse:
```
https://nnauroz-prog.github.io/AlsterCafe/
```

Sobald die Custom-Domain umgezogen ist:
```
https://alstercafe.de/
```

Funktioniert mit jedem Domain-Anbieter (Strato, IONOS, GoDaddy, Domainfactory, …).
Dauert ~15 Minuten Konfiguration + 1 bis 24 Stunden DNS-Propagation.

---

## Wichtig: Reihenfolge einhalten
Die Schritte **müssen in dieser Reihenfolge** durchgeführt werden, sonst
geht zwischendurch sowohl die Pages-URL als auch die Custom-Domain offline:
zuerst DNS, dann GitHub-Setting.

## Schritt 1 — DNS beim Domain-Anbieter setzen

Beim Anbieter (Strato/IONOS/…) ins Domain-Management → DNS-Einstellungen.
**Vier `A`-Records** für die Apex-Domain (`alstercafe.de` ohne `www`):

| Typ | Name | Wert |
|-----|------|------|
| A   | @    | 185.199.108.153 |
| A   | @    | 185.199.109.153 |
| A   | @    | 185.199.110.153 |
| A   | @    | 185.199.111.153 |

**Plus ein `CNAME`-Record für `www`:**

| Typ   | Name | Wert |
|-------|------|------|
| CNAME | www  | nnauroz-prog.github.io |

Alte `A`-Records auf der Apex-Domain vorher löschen, sonst gibt's Konflikte.

## Schritt 2 — Domain in GitHub eintragen
**Erst machen, wenn DNS gesetzt ist (Schritt 1).**

1. Gehe zu **Settings → Pages** des Repos
2. Unter **„Custom domain"** eintragen: `alstercafe.de`
3. Auf **Save** klicken — GitHub legt automatisch eine `CNAME`-Datei im `gh-pages`-Branch an, deren Vorhandensein die Custom-Domain aktiviert.
4. GitHub prüft die DNS-Records — der grüne Haken erscheint, sobald sie propagiert sind (meist innerhalb von 15 Minuten, bis zu 24 h möglich).
5. **„Enforce HTTPS"** ankreuzen, sobald verfügbar — TLS-Zertifikat ist kostenlos und automatisch (Let's Encrypt).

## Schritt 3 — Tests

- `https://alstercafe.de` → Bäckerei-Startseite
- `https://www.alstercafe.de` → leitet auf `https://alstercafe.de` weiter (kein „www" in der finalen URL)
- `http://alstercafe.de` → leitet automatisch auf `https://`

## Schritt 4 — `CNAME`-Datei in den Quell-Branch übernehmen
**Sehr wichtig**, sonst überschreibt der Auto-Deploy die Custom-Domain wieder.

Der Auto-Deploy-Workflow spiegelt den Quell-Branch komplett nach `gh-pages`.
Wenn die von GitHub angelegte `CNAME`-Datei nur in `gh-pages` lebt, wird sie
beim nächsten meiner Pushes überschrieben → Custom-Domain weg.

**So vorbeugen:** Lege im Quell-Branch (`claude/bakery-website-redesign-vyyXQ` oder `main`) eine Datei namens `CNAME` an, Inhalt nur eine Zeile:
```
alstercafe.de
```

Im GitHub-Web-UI: Code → „Add file" → „Create new file" → Name `CNAME` →
Inhalt `alstercafe.de` → Commit. Fertig.

Ab dann bleibt die Custom-Domain bei jedem Auto-Deploy erhalten.

## Was sich danach ändert
- Die Pages-Adresse `nnauroz-prog.github.io/AlsterCafe/` leitet automatisch auf `alstercafe.de` weiter.
- Alle Canonicals und Sitemap-Einträge im Code zeigen bereits auf `alstercafe.de` — passt ohne weitere Änderung.
- Supabase-Site-URL einmal in der Supabase-Konsole anpassen: Authentication → URL Configuration → `https://alstercafe.de`. Sonst gehen Passwort-Reset-Mails ins Leere.

## Falls etwas hakt
- DNS noch nicht propagiert: Geduld — bis 24 h sind normal. `dig alstercafe.de` oder `nslookup alstercafe.de` zeigt, was schon ankommt.
- Grüner Haken in GitHub fehlt: meist eine alte `AAAA`/`A`-Zeile beim Anbieter, die noch da ist. Erst alle alten löschen, dann neu setzen.
- 404 unter der Custom-Domain: `CNAME`-Datei im `gh-pages`-Branch prüfen (muss exakt `alstercafe.de` enthalten, nichts sonst).
