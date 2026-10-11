# Benachrichtigung & Bestätigungs-E-Mails

Zwei Dinge, beide über denselben kostenlosen Mail-Dienst **Resend**:

1. **Automatische Benachrichtigung an den Inhaber** bei jeder neuen Reservierung/Bestellung
   (E-Mail an info@alstercafe.de). → Edge Function `notify-new` + Database-Webhooks.
2. **Bestätigungs-Knopf an den Gast** im Mitgliederbereich: Bei jeder Anfrage gibt es den Knopf
   **„Bestätigung senden"** — einmal drücken, bestätigen, fertig; der Gast bekommt eine
   **professionell gestaltete E-Mail mit Logo**. → Edge Function `send-confirmation`.

Der Code liegt im Projekt unter `supabase/functions/notify-new/` und
`supabase/functions/send-confirmation/`. Einrichten passiert in **Resend** und im
**Supabase-Dashboard** (für die Gast-Mails zusätzlich ein paar DNS-Einträge bei STRATO).
Am besten gemeinsam Schritt für Schritt.

---

## Stufe 1 — Benachrichtigung an den Inhaber (schnell, ohne DNS)

1. **Resend-Konto** (kostenlos) auf https://resend.com anlegen — **mit info@alstercafe.de**
   (ohne verifizierte Domain darf Resend anfangs nur an die eigene Konto-Adresse senden, also
   an dich). E-Mail bestätigen.
2. **API-Key** erzeugen (Resend → API Keys → Create). Schlüssel `re_…` kopieren.
3. **Beide Edge Functions anlegen** (Supabase → Edge Functions → Create function), Code jeweils
   aus dem Projekt einfügen → Deploy:
   - `notify-new`  (aus `supabase/functions/notify-new/index.ts`)
   - `send-confirmation` (aus `supabase/functions/send-confirmation/index.ts`)
4. **Secret hinterlegen** (Supabase → Edge Functions → Secrets): `RESEND_API_KEY` = `re_…`.
   (Optional für `notify-new`: `WEBHOOK_SECRET` = selbst gewähltes Passwort; dann im Webhook den
   gleichen Header `x-webhook-secret` eintragen.)
5. **Database-Webhooks** (Supabase → Database → Webhooks → Create), nur für `notify-new`:
   - Tabelle `reservations`, Event **Insert**, Ziel **Edge Function `notify-new`**.
   - Tabelle `orders`, Event **Insert**, Ziel **Edge Function `notify-new`**.

**Ergebnis Stufe 1:** Du bekommst bei jeder neuen Anfrage eine E-Mail an info@alstercafe.de.
Der **„Bestätigung senden"-Knopf** funktioniert für Gäste aber erst nach Stufe 2 (Resend lässt
ohne verifizierte Domain keine Mails an fremde Adressen zu) — bis dahin zeigt der Knopf eine
klare Fehlermeldung.

---

## Stufe 2 — Gast-Mails freischalten (Bestätigungs-Knopf, mit DNS)

6. **Domain in Resend verifizieren** (Resend → Domains → Add Domain → `alstercafe.de`).
7. **DNS-Einträge bei STRATO** setzen (die von Resend angezeigten SPF/DKIM-Einträge; optional
   DMARC). **MX-Einträge NICHT anfassen.** In Resend auf **Verify**.
8. **Absender umstellen:** Secret `MAIL_FROM` = `Alstercafé <reservierung@alstercafe.de>`
   (kein Code-Deploy nötig).
9. **Datenschutz ergänzen:** kurzer Abschnitt „E-Mail-Versand (Resend)" in `datenschutz.html`
   (Auftragsverarbeiter, USA/Standardvertragsklauseln) — juristisch gegenlesen lassen.

**Ergebnis Stufe 2:** Der Knopf „Bestätigung senden" im Mitgliederbereich verschickt die
schöne Bestätigungs-E-Mail an den Gast.

---

## Der Knopf im Alltag
Mitgliederbereich → Anfragen/Bestellungen → bei jeder Anfrage unten **„Bestätigung senden"**
→ einmal bestätigen → die E-Mail (mit Logo & Branding) geht an die vom Gast angegebene Adresse.
Hat der Gast keine E-Mail angegeben, wird der Knopf nicht angezeigt.

## Wenn etwas nicht ankommt
- Supabase → Edge Functions → Logs der jeweiligen Funktion (Fehlertext?).
- Resend → Emails/Logs („delivered"/„bounced"?).
- Vor Stufe 2 schlägt der Gast-Versand bewusst fehl (Domain nicht verifiziert) — die
  Inhaber-Benachrichtigung aus Stufe 1 muss aber ankommen.
- Die Anfrage steht unabhängig vom Mailversand **immer** im Mitgliederbereich.

## Alternative (ganz ohne Mail-Dienst)
Nur eine **Push-Meldung aufs Handy** (App **ntfy**) bei neuer Anfrage — in ~5 Minuten, ohne
Resend/DNS. Sag Bescheid, dann richten wir das stattdessen/zusätzlich ein.
