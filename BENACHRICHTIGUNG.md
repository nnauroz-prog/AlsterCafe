# Benachrichtigung & Bestätigungs-E-Mails

Zwei Dinge, beide über denselben kostenlosen Mail-Dienst **Resend**:

1. **Automatische Benachrichtigung an dich** bei jeder neuen Reservierung/Bestellung.
   → Edge Function `notify-new` + Database-Webhooks.
2. **Bestätigungs-Knopf an den Gast** im Mitgliederbereich: Bei jeder Anfrage gibt es den Knopf
   **„Bestätigung senden"** — einmal drücken, bestätigen, fertig; der Gast bekommt eine
   **professionell gestaltete E-Mail mit Logo**. → Edge Function `send-confirmation`.

Der Code liegt im Projekt unter `supabase/functions/notify-new/` und
`supabase/functions/send-confirmation/`. Eingerichtet wird in **Resend** und im
**Supabase-Dashboard**; für die Gast-Mails zusätzlich ein paar DNS-Einträge bei **STRATO**.
Am besten gemeinsam Schritt für Schritt.

---

## Wichtig vorab: Du brauchst KEINEN Zugang zum Postfach info@alstercafe.de

Zwei Dinge werden oft verwechselt:

- **Postfach-Zugang** zu info@alstercafe.de (Mails *als* diese Adresse lesen/schreiben)
  → **wird NICHT gebraucht.**
- **Domain-Zugang** bei STRATO (technische DNS-Einträge für alstercafe.de)
  → nur für die schönen Gast-Mails nötig.

Deine **Benachrichtigungen** gehen an **jede Adresse, die du täglich liest** (deine private,
Gmail, egal). Du meldest dich bei Resend einfach **mit genau dieser Adresse** an und trägst sie
als Secret `MAIL_TO` ein. Die Gast-Mails kommen von einer **„nur-senden"-Adresse**
(z. B. `reservierung@alstercafe.de`) — die muss kein echtes Postfach sein. Antworten des Gastes
lenken wir per `REPLY_TO` auf deine lesbare Adresse.

---

## Einrichtung — Schritt für Schritt

**1. Resend-Konto** (kostenlos, keine Kreditkarte) auf https://resend.com anlegen —
**mit der Adresse, die du täglich liest** (nicht info@). E-Mail bestätigen.
Kostenloser Tarif: 3.000 Mails/Monat, 100/Tag — für euch mehr als genug.

**2. Domain `alstercafe.de` verifizieren** (Resend → Domains → Add Domain).
Resend zeigt dir **SPF/DKIM**-Einträge (optional DMARC) — die bei **STRATO** in der
Domain-/DNS-Verwaltung eintragen. **MX-Einträge NICHT anfassen** (das ist eure normale Post).
Dann in Resend auf **Verify**. (DNS kann ein paar Minuten bis Stunden brauchen.)

**3. API-Key** erzeugen (Resend → API Keys → Create). Schlüssel `re_…` kopieren.

**4. Beide Edge Functions anlegen** (Supabase → Edge Functions → Create function), Code jeweils
aus dem Projekt einfügen → Deploy:
- `notify-new`  (aus `supabase/functions/notify-new/index.ts`)
- `send-confirmation` (aus `supabase/functions/send-confirmation/index.ts`)

**5. Secrets hinterlegen** (Supabase → Edge Functions → Secrets):
- `RESEND_API_KEY` = `re_…`
- `MAIL_TO` = **deine lesbare Adresse** ← wichtig, sonst ginge die Benachrichtigung an info@
- `MAIL_FROM` = `Alstercafé <reservierung@alstercafe.de>` (nach erfolgreichem Domain-Verify)
- `REPLY_TO` = deine lesbare Adresse (optional; damit Gast-Antworten bei dir landen)
- optional `WEBHOOK_SECRET` = selbst gewähltes Passwort (dann im Webhook denselben Header
  `x-webhook-secret` eintragen)

**6. Database-Webhooks** (Supabase → Database → Webhooks → Create), nur für `notify-new`:
- Tabelle `reservations`, Event **Insert**, Ziel **Edge Function `notify-new`**.
- Tabelle `orders`, Event **Insert**, Ziel **Edge Function `notify-new`**.

**7. Datenschutz ergänzen:** kurzer Abschnitt „E-Mail-Versand (Resend)" in `datenschutz.html`
(Auftragsverarbeiter, USA/Standardvertragsklauseln) — analog zum bestehenden Supabase-/Vercel-
Abschnitt. Juristisch gegenlesen lassen.

**Ergebnis:** Du bekommst bei jeder neuen Anfrage eine E-Mail an deine Adresse (mit „Antworten"
direkt an den Gast), und der **„Bestätigung senden"-Knopf** verschickt die schöne
Bestätigungs-E-Mail an den Gast.

> Vor erfolgreichem Domain-Verify (Schritt 2) kann Resend nur an **deine eigene Konto-Adresse**
> senden — Benachrichtigungen an dich funktionieren also sofort, Gast-Mails erst nach dem Verify.
> Bis dahin zeigt der Knopf eine klare Meldung.

---

## Der Knopf im Alltag
Mitgliederbereich → Anfragen/Bestellungen → bei jeder Anfrage unten **„Bestätigung senden"**
→ einmal bestätigen → die E-Mail (mit Logo & Branding) geht an die vom Gast angegebene Adresse.
Hat der Gast keine E-Mail angegeben, wird der Knopf nicht angezeigt.

## Wenn etwas nicht ankommt
- Supabase → Edge Functions → Logs der jeweiligen Funktion (Fehlertext?).
- Resend → Emails/Logs („delivered"/„bounced"?).
- Steht die Domain in Resend wirklich auf „verified"? Sonst gehen Gast-Mails nicht raus.
- Die Anfrage steht unabhängig vom Mailversand **immer** im Mitgliederbereich.

## Alternative (ganz ohne Mail-Dienst)
Nur eine **Push-Meldung aufs Handy** (App **ntfy**) bei neuer Anfrage — in ~5 Minuten, ohne
Resend/DNS. Sag Bescheid, dann richten wir das stattdessen/zusätzlich ein.
