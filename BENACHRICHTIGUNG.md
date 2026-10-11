# E-Mail-Benachrichtigung bei neuen Anfragen

Ziel: Bei jeder neuen **Reservierung** oder **Brötchen-Bestellung**
1. bekommt der Inhaber eine **E-Mail an info@alstercafe.de**, und
2. bekommt der **Gast** eine automatische **Eingangsbestätigung** per E-Mail.

Technik: ein kostenloser Mail-Dienst (**Resend**) + eine kleine **Supabase Edge Function**
(der Code liegt im Projekt unter `supabase/functions/notify-new/index.ts`), die bei jeder
neuen Anfrage automatisch die Mails verschickt.

> Das Einrichten passiert in **Resend** und im **Supabase-Dashboard** (und bei STRATO fürs
> DNS). Am besten gemeinsam Schritt für Schritt — hier die Reihenfolge.

---

## Stufe 1 — E-Mail an den Inhaber (schnell, ohne DNS)

**1. Resend-Konto anlegen (kostenlos).**
- Auf https://resend.com registrieren — **mit der Adresse info@alstercafe.de**
  (wichtig: Ohne verifizierte Domain darf Resend anfangs nur an die eigene Konto-Adresse
  senden — das ist genau die Inhaber-Mail).
- E-Mail-Adresse bestätigen.

**2. API-Key erzeugen.**
- Resend → **API Keys** → **Create API Key** → Name z. B. „alstercafe", Rechte „Sending".
- Den Schlüssel (beginnt mit `re_…`) **kopieren** — er wird gleich in Supabase hinterlegt.

**3. Edge Function in Supabase anlegen.**
- Supabase-Dashboard → Projekt **alstercafe** → links **Edge Functions** → **Create function**.
- Name exakt: **`notify-new`**.
- Den gesamten Code aus `supabase/functions/notify-new/index.ts` (in diesem Projekt) in den
  Editor einfügen → **Deploy**.

**4. Den API-Key als Secret hinterlegen.**
- Supabase → **Edge Functions** → **Manage secrets** (oder Project Settings → Edge Functions) →
  neues Secret **`RESEND_API_KEY`** = der Resend-Schlüssel `re_…` → speichern.
- (Optional, empfohlen) Secret **`WEBHOOK_SECRET`** = ein selbst ausgedachtes Passwort —
  schützt die Funktion vor fremden Aufrufen. Wenn gesetzt, im Webhook (Schritt 5) denselben
  Wert als Header `x-webhook-secret` eintragen.

**5. Zwei Database-Webhooks anlegen.**
- Supabase → **Database** → **Webhooks** → **Create a new hook**:
  - Hook 1: Tabelle **`reservations`**, Event **Insert**, Typ **Supabase Edge Functions** →
    Function **`notify-new`**. (Falls `WEBHOOK_SECRET` gesetzt: HTTP-Header
    `x-webhook-secret` = dein Wert hinzufügen.)
  - Hook 2: dasselbe für Tabelle **`orders`**.

**Fertig mit Stufe 1.** Teste: eine Reservierung über die Webseite abschicken → es sollte eine
E-Mail an **info@alstercafe.de** kommen. (Die Gast-Bestätigung folgt in Stufe 2.)

---

## Stufe 2 — Bestätigungs-Mail an den Gast (braucht Domain-Freigabe)

Damit E-Mails **an die Gäste** (beliebige Adressen) zuverlässig ankommen, muss die eigene
Domain in Resend verifiziert werden.

**6. Domain in Resend verifizieren.**
- Resend → **Domains** → **Add Domain** → `alstercafe.de` → Resend zeigt mehrere DNS-Einträge
  (SPF/TXT, DKIM, optional DMARC).

**7. DNS-Einträge bei STRATO setzen.**
- STRATO → Domainverwaltung → `alstercafe.de` → DNS → die von Resend angezeigten Einträge
  genau so anlegen. **Die MX-Einträge (E-Mail-Empfang) NICHT verändern.**
- Zurück in Resend auf **Verify** — kann ein paar Minuten bis Stunden dauern.

**8. Absender umstellen.**
- Supabase → Edge Functions → Secrets → Secret **`MAIL_FROM`** =
  `Alstercafé <reservierung@alstercafe.de>`.
- (Kein Code-Deploy nötig — die Funktion liest den Absender aus diesem Secret.)

**9. Datenschutz ergänzen.**
- In `datenschutz.html` einen kurzen Abschnitt „E-Mail-Versand (Resend)" aufnehmen:
  Resend als Auftragsverarbeiter, Übermittlung in die USA / EU-Standardvertragsklauseln —
  analog zum bestehenden Supabase-/Vercel-Abschnitt. (Juristisch gegenlesen lassen.)

**Fertig.** Teste erneut mit einer Reservierung an eine Test-Gastadresse → der „Gast" bekommt
die Eingangsbestätigung, der Inhaber die Benachrichtigung.

---

## Wenn etwas nicht ankommt
- Supabase → **Edge Functions** → **`notify-new`** → **Logs**: Wurde die Funktion aufgerufen?
  Steht dort ein Fehler (z. B. „RESEND_API_KEY fehlt" oder ein Resend-Fehlertext)?
- Resend → **Emails/Logs**: Steht die Mail auf „delivered" oder „bounced"?
- In Stufe 1 schlägt die **Gast-**Mail bewusst noch fehl (Domain nicht verifiziert) — das ist
  normal; die Inhaber-Mail muss aber ankommen.
- Die Anfrage selbst steht unabhängig vom Mailversand **immer** im Mitgliederbereich.

## Alternative (ganz ohne Mail-Dienst)
Wenn es dir reicht, **auf dem Handy** benachrichtigt zu werden (statt per E-Mail): Das geht in
~5 Minuten mit der kostenlosen App **ntfy** + einem Supabase-Webhook — ohne Resend und ohne
DNS. Sag Bescheid, dann richten wir das stattdessen ein.
