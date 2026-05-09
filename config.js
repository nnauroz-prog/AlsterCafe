/* ============================================================
   Alstercafé · Konfiguration
   ============================================================
   Production-Setup: hier die zwei Werte aus der Supabase-Konsole
   eintragen. Solange beide leer sind, läuft die Seite im Demo-
   Modus mit lokaler Speicherung (kein echter Schutz).
   Diese Datei darf öffentlich sein — der ANON-Key ist dafür da.
   Echte Sicherheit kommt durch die Row-Level-Security-Regeln in
   setup.sql und durch die separat verwaltete Auth-User.
   ============================================================ */

window.ALSTERCAFE_CONFIG = {
  supabaseUrl:     '', // z. B. 'https://abcdefghijkl.supabase.co'
  supabaseAnonKey: '', // z. B. 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  storageBucket:   'images',
  ownerEmail:      'inhaber@alstercafe.de'
};
