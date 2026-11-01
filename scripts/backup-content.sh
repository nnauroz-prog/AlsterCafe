#!/usr/bin/env bash
# Alstercafé · Sicherung der Webseiten-Inhalte (keine Gästedaten)
# Liest die öffentliche Tabelle `content` und lädt hochgeladene Bilder mit.
# Aufruf: scripts/backup-content.sh <Zielordner>
# Benötigt SUPABASE_URL und SUPABASE_ANON_KEY (öffentliche Werte, siehe config.js).
set -euo pipefail
OUT="${1:?Zielordner fehlt}"
mkdir -p "$OUT/images"

RAW="$OUT/content.json"
if [ -n "${CONTENT_FILE:-}" ]; then
  cp "$CONTENT_FILE" "$RAW"            # Testmodus: Antwort aus Datei
else
  code=$(curl -sS -o "$RAW" -w "%{http_code}" \
    "$SUPABASE_URL/rest/v1/content?select=id,data,updated_at&order=id" \
    -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY")
  if [ "$code" -lt 200 ] || [ "$code" -ge 300 ]; then
    echo "❌ Supabase antwortet mit Status $code – keine Sicherung geschrieben."; exit 1
  fi
fi

# Plausibilität: gültiges JSON, Liste, mindestens ein Eintrag
count=$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); assert isinstance(d,list); print(len(d))' "$RAW" 2>/dev/null || echo "x")
if [ "$count" = "x" ] || [ "$count" -lt 1 ]; then
  echo "❌ Antwort leer oder ungültig – Sicherung abgebrochen, alte Sicherungen bleiben unverändert."; exit 1
fi
echo "✅ $count Inhalte gelesen."

# Gleiches Format wie „Sicherung herunterladen“ im Mitgliederbereich
python3 - "$RAW" "$OUT/sicherung.json" <<'PY'
import json, sys, datetime
rows = json.load(open(sys.argv[1]))
data = {r["id"]: r["data"] for r in rows if isinstance(r, dict) and "id" in r}
json.dump({"format": "alstercafe-sicherung", "version": 1,
           "erstellt": datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
           "quelle": "automatisch (wöchentlich)", "inhalte": data},
          open(sys.argv[2], "w"), ensure_ascii=False, indent=2)
PY

# Bilder: alle Storage-Adressen aus den Inhalten herunterladen
grep -oE 'https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/[^"\\ ]+' "$RAW" | sort -u > "$OUT/images/liste.txt" || true
n=0
while read -r url; do
  [ -z "$url" ] && continue
  name=$(echo "$url" | sed 's#.*/object/public/##; s#[^A-Za-z0-9._-]#_#g')
  if curl -sSf -o "$OUT/images/$name" "$url"; then n=$((n+1)); else echo "⚠️  Bild nicht geladen: $url"; fi
done < "$OUT/images/liste.txt"
echo "✅ $n Bilder gesichert."
