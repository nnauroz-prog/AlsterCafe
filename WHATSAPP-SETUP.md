# WhatsApp-Benachrichtigung einrichten

Ziel: Sobald ein Kunde eine **Brötchen-Bestellung** oder eine **Reservierung**
absendet, bekommt der Inhaber sofort eine WhatsApp-Nachricht aufs Handy.

Die Nachricht enthält **keine Kundendaten** (DSGVO) — nur Anzahl, Datum und
Uhrzeit. Beispiel:

> Alstercafé — neue Brötchen-Bestellung: 20 Stück. Abholung: Do 15.05. um 10:00 Uhr. Details im Mitgliederbereich.

Einmalige Einrichtung, ca. 15 Minuten.

---

## Schritt 1 — WhatsApp-Empfang aktivieren (auf dem Handy des Inhabers)

CallMeBot ist ein kostenloser Dienst, mit dem man sich selbst WhatsApp-Nachrichten schicken kann.

1. Die Nummer **+34 644 51 95 23** als Kontakt im Handy speichern (z. B. als „Alstercafé Bot").
2. In WhatsApp an diese Nummer schreiben:
   **`I allow callmebot to send me messages`**
3. Es kommt eine Antwort mit einem **API-Key** (z. B. `123456`). Diesen Key notieren.
4. Die eigene Handynummer im Format **+49…** notieren (z. B. `+4915112345678`).

> Hinweis: CallMeBot ist ein kostenloser Dienst für Privatgebrauch. Für einen
> garantierten Versand (SLA) ließe sich später Twilio WhatsApp anbinden — die
> Edge Function ist dafür vorbereitet.

---

## Schritt 2 — Edge Function bei Supabase hochladen

Voraussetzung: die Supabase-CLI ist installiert (`npm i -g supabase`) und man ist eingeloggt (`supabase login`).

```bash
# im Projektordner
supabase link --project-ref DEIN_PROJECT_REF
supabase functions deploy notify-whatsapp --no-verify-jwt
```

`DEIN_PROJECT_REF` steht im Supabase-Dashboard unter Project Settings → General.

Alternativ ohne CLI: im Dashboard → Edge Functions → „Deploy a new function",
Name `notify-whatsapp`, den Inhalt von
`supabase/functions/notify-whatsapp/index.ts` einfügen, „Verify JWT" deaktivieren.

---

## Schritt 3 — Geheimnisse (Secrets) setzen

Im Dashboard → Edge Functions → notify-whatsapp → „Secrets", oder per CLI:

```bash
supabase secrets set WHATSAPP_PHONE="+4915112345678"
supabase secrets set CALLMEBOT_APIKEY="123456"
supabase secrets set WEBHOOK_SECRET="ein-langes-zufaelliges-passwort"
```

- `WHATSAPP_PHONE` — die Handynummer aus Schritt 1
- `CALLMEBOT_APIKEY` — der API-Key aus Schritt 1
- `WEBHOOK_SECRET` — ein selbst ausgedachtes langes Passwort (schützt die Funktion vor fremden Aufrufen). Merken für Schritt 4.

---

## Schritt 4 — Zwei Database-Webhooks anlegen

Im Dashboard → Database → Webhooks → „Create a new hook". Zweimal, einmal je Tabelle:

**Webhook 1 — Bestellungen**
- Name: `notify-orders`
- Table: `orders`
- Events: nur **Insert**
- Type: **HTTP Request**, Method **POST**
- URL: `https://DEIN_PROJECT_REF.supabase.co/functions/v1/notify-whatsapp`
- HTTP Headers:
  - `x-webhook-secret` = derselbe Wert wie `WEBHOOK_SECRET` aus Schritt 3

**Webhook 2 — Reservierungen**
- Name: `notify-reservations`
- Table: `reservations`
- Events: nur **Insert**
- Type: **HTTP Request**, Method **POST**
- URL: `https://DEIN_PROJECT_REF.supabase.co/functions/v1/notify-whatsapp`
- HTTP Headers:
  - `x-webhook-secret` = derselbe Wert wie `WEBHOOK_SECRET`

---

## Schritt 5 — Test

1. Auf der Webseite eine Test-Bestellung über den **Brötchen-Service** absenden.
2. Innerhalb weniger Sekunden sollte die WhatsApp-Nachricht aufs Handy kommen.
3. Dasselbe mit einer Test-Reservierung.

Falls nichts ankommt:
- Dashboard → Edge Functions → notify-whatsapp → „Logs" ansehen (Fehlermeldungen).
- Prüfen, ob die drei Secrets gesetzt sind und der `x-webhook-secret`-Header in beiden Webhooks exakt mit `WEBHOOK_SECRET` übereinstimmt.
- Prüfen, ob die CallMeBot-Aktivierung (Schritt 1) wirklich bestätigt wurde.

---

## Kosten

Alles kostenlos: CallMeBot (Privatgebrauch), Supabase Edge Functions (Free-Tier
großzügig), Database Webhooks inklusive.
