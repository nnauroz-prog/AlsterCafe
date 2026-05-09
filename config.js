/* ============================================================
   Alstercafé · Konfiguration
   ============================================================
   PRODUCTION-SETUP:
   Tragen Sie die zwei Werte aus der Supabase-Konsole ein.
   Solange beide leer sind, läuft die Seite im Demo-Modus mit
   lokaler Speicherung (kein echter Schutz).

   SICHERHEIT:
   • supabaseUrl + supabaseAnonKey sind ÖFFENTLICHE Werte und
     dürfen im Frontend stehen. Echte Sicherheit kommt durch
     die Row-Level-Security-Regeln in setup.sql.
   • demoPassword ist nur für die Demo. Vor dem Go-Live entweder
     leeren ODER eine echte Supabase-Anbindung aktivieren — dann
     wird der Demo-Pfad nicht mehr verwendet.
   ============================================================ */

window.ALSTERCAFE_CONFIG = {
  // Production
  supabaseUrl:     '', // z. B. 'https://abcdefghijkl.supabase.co'
  supabaseAnonKey: '', // z. B. 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  storageBucket:   'images',
  ownerEmail:      'inhaber@alstercafe.de',

  // Demo (wird ignoriert sobald supabaseUrl gesetzt ist)
  demoPassword:    'IfflandStr45!'
};

