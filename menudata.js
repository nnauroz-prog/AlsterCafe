/* ============================================================
   Alstercafé · Speisekarten-Daten (geteilt)
   ============================================================
   Eine einzige Quelle der Wahrheit fuer:
   - die oeffentliche Speisekarte (speisekarte.html via script.js)
   - den Admin-Editor (admin.html via admin.js)
   - den PDF-Export (admin.js)

   Wird vom Admin-Editor ueberschrieben (gespeichert unter dem
   'menu'-Key). Aendert Maria hier nichts, gilt dieser Default.

   Item-Modell — bewusst einfach gehalten:
     { name, desc, price, tag? }
   price ist ein freier Text — "8,90 €" oder "2,80 / 3,80 €".
   tag ist optional, z. B. "vegan".
   ============================================================ */
window.ALSTERCAFE_MENU_DEFAULT = {
  intro: 'Gerne bereiten wir Ihnen Ihr Frühstück nach Wunsch zu — auch für mehrere Personen.',
  sections: [
    {
      title: 'Frühstück',
      icon: 'i-bread',
      items: [
        { name: 'Klassik', price: '8,90 €', desc: '2 Brötchen nach Wahl und Butter, mit Gouda, Putensalami, Pute und Kochschinken, dazu Marmelade, Honig oder Nutella.' },
        { name: 'Käse-Vielfalt', price: '9,90 €', desc: '2 Brötchen nach Wahl und Butter, mit Gouda, Weichkäse, Mozzarella und Kräuterfrischkäse.' },
        { name: 'Süßes', price: '6,90 €', desc: '2 frisch gebackene Butter-Croissants mit 2 Aufstrichen zur Auswahl: Butter, Honig, Nutella oder Marmelade.' },
        { name: 'Fitness', price: '6,90 €', desc: 'Müsli mit Joghurt, Apfel, Banane und Saisonfrüchten, mit Honig verfeinert.' },
        { name: 'Avocado-Traum', tag: 'vegan', price: '9,90 €', desc: 'Frisch zubereitete Avocado-Creme auf zwei gerösteten Brotscheiben, Avocadoscheiben, Körner & Nüsse, Mixsalat und Balsamico.' },
        { name: 'Avocado-Traum mit Spiegelei', price: '11,90 €', desc: 'Wie der Avocado-Traum, dazu obendrauf 2 Spiegeleier.' }
      ]
    },
    {
      title: 'Rund ums Ei',
      icon: 'i-cup',
      items: [
        { name: 'Rührei Klassik', price: '7,90 €', desc: 'Rührei aus 3 Eiern mit Salz, Pfeffer und Milch abgeschmeckt. Dazu Butter und 1 Scheibe Brot oder 1 Brötchen.' },
        { name: 'Omelett Natur', price: '7,90 €', desc: 'Omelett aus 3 Eiern mit Salz, Pfeffer und Milch. Dazu Butter und 1 Scheibe Brot oder 1 Brötchen.' },
        { name: '3 Spiegeleier klassisch', price: '7,90 €', desc: 'Dazu Butter und 1 Scheibe Brot oder 1 Brötchen.' },
        { name: 'Dreher-Frühstück (2 Scheiben)', price: '6,90 €', desc: 'Geröstetes Brot mit Spiegelei und Käse.' },
        { name: 'Dreher-Frühstück (2 Scheiben mit Speck)', price: '8,90 €', desc: 'Geröstetes Brot mit Spiegelei, Käse und Speck.' },
        { name: 'Dreher-Frühstück (3 Scheiben)', price: '8,90 €', desc: 'Geröstetes Brot mit Spiegelei und Käse.' },
        { name: 'Dreher-Frühstück (3 Scheiben mit Speck)', price: '10,90 €', desc: 'Geröstetes Brot mit Spiegelei, Käse und Speck.' }
      ]
    },
    {
      title: 'Orient',
      icon: 'i-leaf',
      items: [
        { name: 'Rührei mit Sucuk', price: '9,90 €', desc: 'Rührei aus 3 Eiern mit Salz und Pfeffer abgeschmeckt. Dazu Butter und 1 Scheibe Brot oder 1 Brötchen.' },
        { name: 'Rührei mit Sucuk & Schafskäse', price: '11,90 €', desc: 'Rührei aus 3 Eiern mit Sucuk und Schafskäse. Dazu Butter und 1 Scheibe Brot oder 1 Brötchen.' },
        { name: 'Omelett mit Sucuk', price: '9,90 €', desc: 'Omelett mit Sucuk, mit Salz und Pfeffer abgeschmeckt. Dazu Butter und 1 Scheibe Brot oder 1 Brötchen.' },
        { name: 'Omelett mit Sucuk & Schafskäse', price: '11,90 €', desc: 'Omelett mit Sucuk und Schafskäse. Dazu Butter und 1 Scheibe Brot oder 1 Brötchen.' },
        { name: 'Spiegelei mit Sucuk', price: '8,90 €', desc: '2 Spiegeleier klassisch mit Sucuk. Dazu Butter und 1 Scheibe Brot oder 1 Brötchen.' }
      ]
    },
    {
      title: 'Extras',
      icon: 'i-wheat',
      note: 'Nur in Verbindung mit einem Frühstück.',
      items: [
        { name: 'Käse', price: '2,00 €' },
        { name: 'Schafskäse', price: '2,90 €' },
        { name: 'Pesto', price: '2,00 €' },
        { name: 'Cherry-Tomaten', price: '1,50 €' },
        { name: 'Speck (2 Scheiben)', price: '2,90 €' },
        { name: 'Speck (4 Scheiben)', price: '3,90 €' },
        { name: '½ Avocado in Scheiben', price: '2,50 €' },
        { name: 'Räucherlachs mit Meerrettich & Zwiebeln', price: '3,90 €' },
        { name: 'Butter', price: '0,50 €' },
        { name: 'Rührei aus 2 Eiern', price: '3,90 €' },
        { name: 'Gekochtes Ei', price: '1,50 €' },
        { name: 'Metzger-Zwiebelmett', price: '1,50 €' },
        { name: 'Marmelade, Honig oder Nutella', price: '0,70 €' }
      ]
    },
    {
      title: 'Heiße Getränke',
      icon: 'i-cup',
      note: 'Preis klein / groß. Alle Kaffeesorten auch koffeinfrei erhältlich.',
      items: [
        { name: 'Hauskaffee', price: '2,80 / 3,80 €', desc: 'Traditionell gefilterter Kaffee.' },
        { name: 'Café Crema', price: '3,10 / 4,10 €', desc: 'Frisch gemahlen und zubereitet.' },
        { name: 'Latte Macchiato', price: '3,80 / 4,50 €', desc: 'Die italienische Variante zum Milchkaffee. Mit Hafermilch 4,20 / 4,70 €.' },
        { name: 'Cappuccino', price: '3,80 / 4,50 €', desc: 'Espresso und feiner Milchschaum. Mit Hafermilch 4,20 / 4,70 €.' },
        { name: 'Milchkaffee', price: '3,80 / 4,50 €', desc: 'Leicht und bekömmlich. Mit Hafermilch 4,20 / 4,70 €.' },
        { name: 'Karamell Macchiato', price: '4,50 / 4,90 €', desc: 'Mit Karamell-Aroma und Topping. Mit Hafermilch 4,90 / 5,50 €.' },
        { name: 'Heiße Schokolade oder Weiße', price: '3,90 / 4,70 €', desc: 'Süß-schokoladig oder cremig-vanillig.' },
        { name: 'Espresso', price: '2,70 / 3,70 €', desc: 'Klein, heiß und kräftig.' },
        { name: 'Americano', price: '2,90 / 3,90 €', desc: 'Espresso mit heißem Wasser.' },
        { name: 'Tee (Glas 0,4 l)', price: '3,30 €', desc: 'Feinster Beuteltee in verschiedenen Sorten.' }
      ]
    },
    {
      title: 'Kalte Getränke',
      icon: 'i-leaf',
      items: [
        { name: 'Frisch gepresster Orangensaft 0,2 l', price: '3,50 €', desc: 'Aus mindestens drei unbehandelten Saftorangen — Vitamine pur.' },
        { name: 'Frisch gepresster Orangensaft 0,5 l', price: '5,90 €', desc: 'Serviert in der Karaffe.' },
        { name: 'Sekt trocken 12% · 0,2 l', price: '4,50 €', desc: 'Serviert im Glas, ausgewogen-brut.' },
        { name: 'Sekt trocken · Flasche 0,7 l', price: '14,90 €', desc: 'Serviert kalt im Kübel.' },
        { name: 'Mineralwasser still 0,7 l', price: '4,50 €', desc: 'Glasflasche.' },
        { name: 'Mineralwasser still 0,2 l', price: '2,50 €', desc: 'Glasflasche.' }
      ]
    }
  ],
  footnote: 'Alle Preise in Euro inkl. MwSt. Änderungen vorbehalten. Brot, Brötchen, Croissants und Franzbrötchen kommen frisch aus unserer eigenen Backstube.'
};
