# Benachrichtigung & Bestätigungs-E-Mails

Zwei Dinge, beide über dein **eigenes STRATO-Mailpaket** (kein Fremddienst):

1. **Automatische Benachrichtigung an dich** bei jeder neuen Reservierung/Bestellung.
   → Edge Function `notify-new` + Database-Webhooks.
2. **Bestätigungs-Knopf an den Gast** im Mitgliederbereich: Bei jeder Anfrage gibt es den Knopf
   **„Bestätigung senden"** — einmal drücken, bestätigen, fertig; der Gast bekommt eine
   **professionell gestaltete E-Mail mit Logo**. → Edge Function `send-confirmation`.

Der Code liegt im Projekt unter `supabase/functions/notify-new/` und
`supabase/functions/send-confirmation/`. Versendet wird direkt über den STRATO-Postausgang
(`smtp.strato.de`, Port 465, SSL/TLS) — die Mail kommt **von reservierung@alstercafe.de**.

**Vorteile dieses Wegs:** kein neues Konto/Fremddienst, **keine DNS-Einträge**, deutscher
Datenschutz (STRATO), kostenlos im Mail-Paket.

**Eingerichtet ist ein eigenes Versand-Postfach `reservierung@alstercafe.de`.** Darüber gehen
die Mails raus. So bleibt das Passwort von info@ unangetastet (Geräte, die info@ nutzen, laufen
weiter). Benachrichtigungen und Gast-Antworten landen trotzdem bei **info@alstercafe.de**. Das
Passwort von reservierung@ liegt verschlüsselt als Supabase-Secret (nicht im Code).

---

## Einrichtung — Schritt für Schritt (im Supabase-Dashboard)

**1. Versand-Postfach anlegen** (erledigt). STRATO → *E-Mails verwalten* → neues Postfach
`reservierung@alstercafe.de` (Domain **.de**!) mit eigenem Passwort, Passwort notieren.

**2. Beide Edge Functions anlegen** (Supabase → Edge Functions → *Create function*), Code jeweils
aus dem Projekt einfügen → *Deploy*:
- `notify-new`  (aus `supabase/functions/notify-new/index.ts`)
- `send-confirmation` (aus `supabase/functions/send-confirmation/index.ts`)

**3. Secrets hinterlegen** (Supabase → Edge Functions → *Secrets* / *Manage secrets*):
- `SMTP_HOST` = `smtp.strato.de`
- `SMTP_PORT` = `465`
- `SMTP_USER` = `reservierung@alstercafe.de`
- `SMTP_PASS` = **das Passwort** von reservierung@
- `MAIL_FROM` = `Alstercafé <reservierung@alstercafe.de>`  ← Absender MUSS = SMTP_USER sein (STRATO-Vorgabe)
- `MAIL_TO`   = `info@alstercafe.de`  ← wohin die Benachrichtigung geht
- `REPLY_TO`  = `info@alstercafe.de`  (optional; wohin Antworten gehen)

**4. Database-Webhooks** (Supabase → Database → *Webhooks* → *Create*), nur für `notify-new`:
- Tabelle `reservations`, Event **Insert**, Ziel **Edge Function `notify-new`**.
- Tabelle `orders`, Event **Insert**, Ziel **Edge Function `notify-new`**.

**Ergebnis:** Du bekommst bei jeder neuen Anfrage eine E-Mail an info@alstercafe.de (Absender
reservierung@, „Antworten" geht direkt an den Gast), und der **„Bestätigung senden"-Knopf** verschickt
die schöne Bestätigungs-E-Mail an den Gast.

> Solange `SMTP_USER`/`SMTP_PASS` nicht gesetzt sind, zeigt der Knopf eine klare Meldung
> „noch nicht eingerichtet" — es geht nichts kaputt.

---

## Der Knopf im Alltag
Mitgliederbereich → Anfragen/Bestellungen → bei jeder Anfrage unten **„Bestätigung senden"**
→ einmal bestätigen → die E-Mail (mit Logo & Branding) geht an die vom Gast angegebene Adresse.
Hat der Gast keine E-Mail angegeben, wird der Knopf nicht angezeigt.

## Wenn etwas nicht ankommt
- Supabase → Edge Functions → Logs der jeweiligen Funktion (Fehlertext? z. B. falsches Passwort).
- Passt `SMTP_USER` = volle Adresse und `MAIL_FROM` = dieselbe Adresse? (STRATO verlangt das.)
- Ist das info@-Postfach evtl. voll? Dann vorher ausmisten (sonst blockiert STRATO den Versand).
- Die Anfrage steht unabhängig vom Mailversand **immer** im Mitgliederbereich.

## Datenschutz
STRATO ist bereits dein Hoster/Mailanbieter (deutscher Auftragsverarbeiter) — es kommt **kein**
US-Dienst hinzu. Ein kurzer Satz „E-Mail-Versand über STRATO" im Datenschutz schadet nicht;
juristisch gegenlesen.

## Alternative (ganz ohne E-Mail)
Nur eine **Push-Meldung aufs Handy** (App **ntfy**) bei neuer Anfrage — in ~5 Minuten, ganz ohne
Postfach. Sag Bescheid, dann richten wir das stattdessen/zusätzlich ein.
