/* ============================================================
   Alstercafé · Sprachumschaltung Deutsch / English
   ------------------------------------------------------------
   Statische Seite ohne Build-Schritt: Übersetzung passiert im
   Browser. Ein einziges Wörterbuch (EN, DE-Quelltext → Englisch)
   wird über die Textknoten und ausgewählte Attribute gelegt.
   Kein Eingriff nötig an den einzelnen HTML-Seiten außer dem
   Laden dieser Datei.

   - Umschalt-Knopf wird in die Navigation injiziert (DE / EN).
   - Wahl wird in localStorage gemerkt.
   - Dynamisch nachgeladene Inhalte (Speisekarte, Wochenplan …)
     werden über einen MutationObserver automatisch mitübersetzt.
   - Vom Inhaber eingegebene Tagesinhalte (Mittagsgericht, Hinweis)
     bleiben so, wie sie eingetippt wurden — die stehen nicht im
     Wörterbuch und werden bewusst nicht maschinell übersetzt.
   - Rechtstexte (Impressum/Datenschutz) bleiben Deutsch.
   ============================================================ */
(function () {
  'use strict';
  var LS_KEY = 'alstercafe.lang';

  /* -------- DE-Quelltext → Englisch -------- */
  var EN = {
    /* Navigation / Topbar / Chrome */
    'Mittagstisch': 'Lunch',
    'Speisekarte': 'Menu',
    'Brötchen-Service': 'Sandwich Service',
    'Über uns': 'About',
    'Reservierung': 'Reservations',
    'Kontakt': 'Contact',
    'Webshop': 'Shop',
    'Webshop ↗': 'Shop ↗',
    'Freies WLAN': 'Free Wi-Fi',
    'Menü öffnen': 'Open menu',
    'Schließen': 'Close',
    'Zum Inhalt springen': 'Skip to content',
    'Alstercafé Startseite': 'Alstercafé home',
    'Start': 'Home',
    'Index': 'Index',
    'Besuch': 'Visit',
    'Geöffnet': 'Open',
    'Geöffnet bis': 'Open until',
    'Öffnungszeiten': 'Opening hours',
    'Adresse': 'Address',
    'Folgen Sie uns': 'Follow us',
    'Besuchen Sie uns': 'Visit us',
    'Mitgliederbereich': 'Members area',

    /* Hero (Startseite) */
    'Bäckerei · Café · Mittagstisch · Hohenfelde': 'Bakery · Café · Lunch · Hohenfelde',
    'Aktuell geöffnet · bis 15:00': 'Open now · until 15:00',
    'Schön, dass': 'So glad',
    'Sie da sind.': 'you’re here.',
    'Kommen Sie vorbei.': 'Come on by.',
    'Croque-Monsieur aus dem Ofen, Franzbrötchen vor sieben, mittags\n            etwas Warmes. Ifflandstraße 45, gleich um die Ecke von der\n            Außenalster.':
      'Croque-Monsieur from the oven, Franzbrötchen before seven, something warm at midday. Ifflandstraße 45, just around the corner from the Außenalster.',
    'Online bestellen': 'Order online',
    'Tisch reservieren': 'Book a table',
    'Mit Espresso von': 'With espresso by',
    'Gerade jetzt': 'Right now',
    'Lage': 'Location',
    'Backstube': 'Bakery',
    'ab 05:30 Uhr': 'from 05:30',
    'Heute': 'Today',
    'Est. 2013 · Hohenfelde': 'Est. 2013 · Hohenfelde',
    'scrollen': 'scroll',
    'Schauen Sie einfach vorbei': 'Just drop by',
    'Frische Brötchen, Croques und Kaffee — den ganzen Tag.': 'Fresh rolls, Croques and coffee — all day long.',
    'Mitten in Hohenfelde': 'In the heart of Hohenfelde',

    /* Ticker */
    'Croque-Monsieur': 'Croque-Monsieur',
    'Franzbrötchen vor sieben': 'Franzbrötchen before seven',
    'Mittagstisch ab 12:00': 'Lunch from 12:00',
    'Espresso von Mocambo': 'Espresso by Mocambo',
    'Eigene Backstube': 'Our own bakery',

    /* Heute-Feature */
    'Heute mittag': 'At midday today',
    'Heute servieren wir Frühstück & Backwaren — kein Mittagstisch.': 'Today we serve breakfast & baked goods — no lunch.',
    'Die Wochenkarte wird gerade aktualisiert.': 'This week’s menu is being updated.',

    /* Familie / Greeting */
    'Familienbetrieb': 'Family business',
    'Familiengeführt': 'Family-run',
    'seit': 'for',
    'Jahren.': 'years.',
    'Unsere Backstube ist im Haus. Brötchen, Croissants und Franzbrötchen\n          kommen ab halb sieben aus dem Ofen — was um 10 Uhr noch auf dem Tresen\n          liegt, war drei Stunden vorher noch Teig. Mittagstisch wechselt\n          täglich, je nach dem, was der Markt morgens hergegeben hat. Und ja:\n          es gibt auch Simit.':
      'Our bakery is in-house. Rolls, croissants and Franzbrötchen come out of the oven from half past six — whatever is still on the counter at 10 was dough three hours earlier. The lunch changes daily, depending on what the market gave us that morning. And yes: there’s Simit, too.',
    'Familienbetrieb · Hamburg-Hohenfelde': 'Family business · Hamburg-Hohenfelde',

    /* Bewertungen */
    'Was unsere Gäste sagen': 'What our guests say',
    'Bewertungen lesen Sie': 'Read the reviews',
    'am besten selbst.': 'for yourself.',
    'Statt erfundener Zitate hier die echten Stimmen unserer Gäste —\n          auf den Plattformen, denen Sie schon vertrauen.':
      'Instead of invented quotes, here are the real voices of our guests — on the platforms you already trust.',
    'Bewertungen ansehen': 'Read reviews',
    '@alstercafe folgen': 'follow @alstercafe',

    /* Closer */
    'Sie können auch': 'You can also',
    'zwei Stunden': 'linger two hours',
    'bei einem Kaffee sitzen.': 'over a coffee.',
    '(Tun viele.)': '(Many do.)',
    'Bis dann — Ihre Familie': 'See you soon — your family',
    'vom': 'at',

    /* Spread-Cards */
    'Vier Gründe': 'Four reasons',
    'Wofür Leute': 'Why people',
    'vorbei­kommen.': 'drop by.',
    'Aus dem Ofen': 'From the oven',
    'Unsere': 'Our',
    'Croques.': 'Croques.',
    'Croque-Monsieur, Croque-Madame mit Spiegelei, vegetarisch mit Bergkäse und Gemüse. Aus dem Ofen, drei Minuten, fertig. Online vorbestellen geht über Croquenoah.':
      'Croque-Monsieur, Croque-Madame with fried egg, vegetarian with mountain cheese and vegetables. From the oven, three minutes, done. Pre-order online via Croquenoah.',
    'Jetzt bestellen': 'Order now',
    'Werktags ab zwölf': 'Weekdays from noon',
    'Mittagstisch.': 'Lunch.',
    'Jeden Tag ein anderes Gericht. Beilage und Salat dazu. Was es heute gibt, steht auf der Karte.':
      'A different dish every day. Side and salad included. What’s on today is on the board.',
    'Heute auf der Karte': 'On today’s menu',
    'Den ganzen Tag': 'All day long',
    'Speisekarte.': 'Menu.',
    'Frühstück von klassisch bis orientalisch, alles rund ums Ei, frischer Kaffee von Mocambo. Die ganze Karte mit Preisen.':
      'Breakfast from classic to oriental, everything egg, fresh coffee by Mocambo. The full menu with prices.',
    'Karte entdecken': 'Explore the menu',
    'Platz sichern': 'Reserve a spot',
    'Reservieren.': 'Reserve.',
    'Tisch zum Mittag oder einer für den Sonntagvormittag. Online oder kurz anrufen — wir melden uns am gleichen Tag zurück.':
      'A table for lunch or one for Sunday morning. Online or a quick call — we’ll get back to you the same day.',

    /* Visit-Strip */
    'So finden Sie uns': 'How to find us',
    'Eckhaus, drei Tische vor der Tür, gleich um die Ecke von der Alsterschwimmhalle.':
      'Corner house, three tables out front, just around the corner from the Alsterschwimmhalle.',
    'Route ansehen →': 'View directions →',

    /* Footer */
    'Alstercafé · Ifflandstraße 45 · 22087 Hamburg': 'Alstercafé · Ifflandstraße 45 · 22087 Hamburg',

    /* ---------------- Über uns ---------------- */
    'Eine Bäckerei,': 'A bakery,',
    'eine Familie.': 'a family.',
    'Seit': 'For',
    'Jahren in der Ifflandstraße. Eigene Backstube, ein paar Tische vor der Tür.':
      'years on Ifflandstraße. Our own bakery, a few tables out front.',
    'Wir sind ein': 'We’re a',
    'Eckcafé': 'corner café',
    'an der Ifflandstraße, gleich um die\n            Ecke von der Alsterschwimmhalle. Stammgäste begrüßen wir beim Vornamen.\n            Neue Gesichter sind nach zwei Besuchen Stammgäste.':
      'on Ifflandstraße, just around the corner from the Alsterschwimmhalle. We greet regulars by first name. New faces are regulars after two visits.',
    'Die Backstube läuft ab vier Uhr morgens. Wer um halb sieben reinkommt,\n            bekommt seine Brötchen, Croissants und Franzbrötchen noch warm. Werktags\n            ab zwölf gibt\'s was Warmes — die Karte hängt an der Tür, und wenn Sie\n            kurz anrufen, verraten wir Ihnen auch vorher schon, was im Topf ist.':
      'The bakery starts at four in the morning. Come in at half past six and your rolls, croissants and Franzbrötchen are still warm. Weekdays from noon there’s something hot — the menu hangs on the door, and if you call ahead we’ll happily tell you what’s in the pot.',
    'Keine Kette, keine Filiale, kein Konzept-Café. Zwei Generationen,\n            eine Backstube, eigene Rezepte. Wenn Sie länger sitzen bleiben — bei\n            uns fühlen wir uns geehrt.':
      'No chain, no branch, no concept café. Two generations, one bakery, our own recipes. If you stay a while — we’re honoured.',
    'Übrigens: Vor uns war an gleicher Adresse der': 'By the way: before us, the same address was home to the',
    '— ein Getränkemarkt, ebenfalls aus unserer Familie. 2013 wurde aus dem Markt das Café. Der „Alster" im Namen ist geblieben.':
      '— a beverage store, also run by our family. In 2013 the store became the café. The “Alster” in the name stayed.',
    'per Anruf oder Mail zurück.': 'by phone or email.',
    'Was Sie bei uns': 'What you’ll find',
    'finden.': 'here.',
    'Croques aus dem Ofen': 'Croques from the oven',
    'Belegt, mit Käse überbacken, drei Minuten unter den Salamander. Den Klassiker mit Schinken, die Madame mit Spiegelei, dazu eine vegetarische Variante mit Bergkäse und Gemüse. Vorbestellen zur Abholung oder Lieferung im Stadtteil über den':
      'Filled, gratinated with cheese, three minutes under the salamander. The classic with ham, the Madame with fried egg, plus a vegetarian version with mountain cheese and vegetables. Pre-order for pickup or local delivery via the',
    'Croques online bestellen': 'Order Croques online',
    'Familiäre Atmosphäre': 'Family atmosphere',
    'Hausgemacht': 'Homemade',
    'Die Tische vor der Tür kriegen Sonne, wenn welche da ist. An den anderen Tagen ist':
      'The tables out front catch the sun, when there is any. On the other days it’s',
    'drinnen schöner': 'nicer inside',
    '. Bleiben Sie ruhig länger.': '. Do stay a while.',
    'Häufig gefragt': 'Frequently asked',
    'Bevor Sie': 'Before you',
    'anrufen.': 'call.',
    'Akzeptieren Sie Reservierungen?': 'Do you take reservations?',
    'Ja. Reservieren Sie online über das Formular oder telefonisch unter':
      'Yes. Reserve online via the form or by phone at',
    'Was sind Croques?': 'What are Croques?',
    'Croques sind unsere Spezialität — herzhafte Sandwiches aus dem Ofen, gratiniert mit Käse. Klassisch als Croque-Monsieur (Schinken & Käse), Croque-Madame (mit Spiegelei) oder vegetarisch. Auch online über unseren':
      'Croques are our speciality — savoury sandwiches from the oven, gratinated with cheese. Classic as Croque-Monsieur (ham & cheese), Croque-Madame (with fried egg) or vegetarian. Also online via our',
    'Bieten Sie vegetarische und vegane Optionen?': 'Do you offer vegetarian and vegan options?',
    'Ja — vegetarisches Frühstück, vegetarische Croques und beim Mittagstisch in der Regel eine fleischlose Alternative.':
      'Yes — vegetarian breakfast, vegetarian Croques and usually a meat-free option at lunch.',
    'Wann gibt es den Mittagstisch?': 'When is lunch served?',
    'Werktags ab 12:00. Der Mittagstisch wechselt täglich — die aktuelle Karte sehen Sie auf der':
      'Weekdays from 12:00. The lunch changes daily — see the current menu on the',
    'Kann ich Backwaren bestellen?': 'Can I order baked goods?',
    'Sehr gern. Festtagstorten und größere Mengen Brötchen, Croissants oder Franzbrötchen einfach ein bis zwei Tage im Voraus telefonisch bestellen.':
      'Gladly. Order celebration cakes and larger quantities of rolls, croissants or Franzbrötchen by phone one or two days in advance.',
    'Sind Hunde willkommen?': 'Are dogs welcome?',
    'Gut erzogene Vierbeiner sind im Außenbereich gerne gesehen.': 'Well-behaved four-legged friends are welcome in the outdoor area.',
    'Mittagstisch-Seite': 'lunch page',
    'Croquenoah-Webshop': 'Croquenoah shop',

    /* ---------------- Mittagstisch ---------------- */
    'Ab 12:00': 'From 12:00',
    'der Woche.': 'of the week.',
    'Werktags ab zwölf. Jeden Tag ein anderes Gericht, Beilage und Salat\n          dazu. Was es heute gibt, steht unten. Wer\'s vorher wissen will: kurz\n          anrufen.':
      'Weekdays from noon. A different dish every day, with side and salad. What’s on today is below. Want to know in advance? A quick call.',
    'Anrufen lohnt sich — wir verraten Ihnen das Tagesgericht gern direkt:':
      'A call is worth it — we’ll gladly tell you the dish of the day:',
    'Beilage und Salat sind immer dabei. Wer das Tagesgericht vorher wissen will:':
      'Side and salad are always included. To find out the dish of the day in advance:',

    /* ---------------- Brötchen-Service ---------------- */
    'für die Runde.': 'for the group.',
    'Belegte Brötchen': 'Filled rolls',
    'Fürs Büro, die Familienfeier oder den langen Arbeitstag: Sagen Sie uns,\n          wie viele und womit — wir belegen frisch und stellen alles zur Abholung\n          bereit. Ab 10 Stück, am besten einen Tag vorher.':
      'For the office, the family gathering or the long workday: tell us how many and with what — we fill them fresh and have everything ready for pickup. From 10 pieces, ideally a day ahead.',
    'Was darf\'s sein?': 'What would you like?',
    'Tippen Sie die gewünschte Anzahl je Sorte. Sonderwünsche kommen ins Notizfeld.':
      'Enter the quantity per variety. Special requests go in the notes field.',
    'Käse': 'Cheese',
    'Gouda & Bergkäse, Salatblatt, Butter': 'Gouda & mountain cheese, lettuce, butter',
    'Schinken': 'Ham',
    'Gekochter Schinken, Ei, Gurke': 'Cooked ham, egg, cucumber',
    'Salami': 'Salami',
    'Edelsalami, Käse, Salat': 'Fine salami, cheese, salad',
    'Frischkäse & Gurke': 'Cream cheese & cucumber',
    'Kräuterfrischkäse, Gurke, Radieschen': 'Herb cream cheese, cucumber, radish',
    'Ei': 'Egg',
    'Spiegel- oder Rührei, Schnittlauch': 'Fried or scrambled egg, chives',
    'Lachs': 'Salmon',
    'Räucherlachs, Meerrettich-Frischkäse, Dill': 'Smoked salmon, horseradish cream cheese, dill',
    'Bunt gemischt': 'Mixed selection',
    'Wir stellen eine ausgewogene Auswahl zusammen': 'We put together a balanced selection',
    'Abholung & Kontakt': 'Pickup & contact',
    'Name': 'Name',
    'Telefon': 'Phone',
    'E-Mail': 'Email',
    'Abholdatum': 'Pickup date',
    'Uhrzeit': 'Time',
    'Wünsche / Unverträglichkeiten': 'Requests / intolerances',
    'Ich bin mit der Bearbeitung meiner Anfrage einverstanden.': 'I agree to my request being processed.',
    'Ihre Bestellung': 'Your order',
    'Noch nichts ausgewählt.': 'Nothing selected yet.',
    'Mindestbestellung: 10 Brötchen.': 'Minimum order: 10 rolls.',
    'Bestellung anfragen': 'Request order',
    'Keine Vorkasse — Sie zahlen bei Abholung. Wir bestätigen Ihre\n              Anfrage telefonisch oder per E-Mail.':
      'No prepayment — you pay at pickup. We confirm your request by phone or email.',
    'Vorbestellen': 'Pre-order',
    'Für Büro & Feier': 'For office & parties',
    'Käse, Schinken, Lachs, vegetarisch oder bunt gemischt — frisch belegt zur Abholung. Ab 10 Stück, am besten einen Tag vorher.':
      'Cheese, ham, salmon, vegetarian or mixed — freshly filled for pickup. From 10 pieces, ideally a day ahead.',
    'Belegte Brötchen vorbestellen': 'Pre-order filled rolls',
    'Zum Brötchen-Service': 'To the sandwich service',
    'Mehr Käse': 'More cheese', 'Weniger Käse': 'Less cheese',
    'Mehr Schinken': 'More ham', 'Weniger Schinken': 'Less ham',
    'Mehr Salami': 'More salami', 'Weniger Salami': 'Less salami',
    'Mehr Frischkäse': 'More cream cheese', 'Weniger Frischkäse': 'Less cream cheese',
    'Mehr Ei': 'More egg', 'Weniger Ei': 'Less egg',
    'Mehr Lachs': 'More salmon', 'Weniger Lachs': 'Less salmon',
    'Mehr gemischt': 'More mixed', 'Weniger gemischt': 'Less mixed',
    'Ihre Auswahl': 'Your selection',
    'Ihr Name': 'Your name',
    'ihre@mail.de': 'you@email.com',
    'ihre@mail.de (optional)': 'you@email.com (optional)',
    'z. B. drei ohne Zwiebeln, glutenfrei wenn möglich …': 'e.g. three without onions, gluten-free if possible …',

    /* ---------------- Reservierung ---------------- */
    'für Sie': 'a table',
    'freihalten.': 'for you.',
    'Online über das Formular oder kurz anrufen. Wir melden uns am\n          gleichen Tag zurück.':
      'Online via the form or a quick call. We get back to you the same day.',
    'Ein bis zwei Tage vorher reicht meistens. Größere Gruppen ab sechs\n            Personen bitte einen Tag vorher anmelden — sonst wird\'s in der\n            Backstube knapp.':
      'One or two days ahead is usually enough. Larger groups of six or more, please register a day ahead — otherwise it gets tight in the bakery.',
    'So läuft\'s:': 'How it works:',
    'Sie senden die Anfrage, wir melden uns am selben Tag per Anruf oder Mail zurück mit Bestätigung. Eine Online-Sofortbestätigung gibt es nicht — das ist Absicht.':
      'You send the request, we get back to you the same day by phone or email with confirmation. There’s no instant online confirmation — that’s intentional.',
    'Reservierungen werktags zu unseren Öffnungszeiten.': 'Reservations on weekdays during our opening hours.',
    'Festtagstorten und besondere Wünsche gern auf Vorbestellung.': 'Celebration cakes and special requests gladly by pre-order.',
    'Ihre Daten werden ausschließlich zur Bearbeitung der Anfrage genutzt.': 'Your data is used solely to process your request.',
    'Gut zu wissen': 'Good to know',
    'Sonntag- und Samstagvormittag ist': 'Sunday and Saturday mornings are',
    'am stärksten': 'the busiest',
    'nachgefragt.': 'times.',
    'Größere Gruppen (ab 6 Pers.) bitte einen Tag': 'Larger groups (6+ people) please a day',
    'vorher': 'ahead',
    'Wir melden uns am': 'We get back to you the',
    'gleichen Tag': 'same day',
    'Reservierung anfragen': 'Request reservation',
    'Anlass / Nachricht': 'Occasion / message',
    'Datum': 'Date',
    'Bitte wählen': 'Please choose',
    '1 Person': '1 person', '2 Personen': '2 people', '3 Personen': '3 people',
    '4 Personen': '4 people', '5 Personen': '5 people', '6 Personen': '6 people',
    '7 Personen': '7 people', '8 Personen': '8 people', 'mehr als 8 Personen': 'more than 8 people',
    'Geburtstag, Allergien, Wunschtisch …': 'Birthday, allergies, preferred table …',

    /* ---------------- Kontakt ---------------- */
    'Mitten in': 'In the heart of',
    'Hohenfelde.': 'Hohenfelde.',
    'Ifflandstraße 45, drei Minuten von der Außenalster.': 'Ifflandstraße 45, three minutes from the Außenalster.',
    'Anrufen · 040 – 22 69 28 91': 'Call · 040 – 22 69 28 91',
    'Aus Datenschutzgründen wird die Karte erst nach Ihrer Zustimmung geladen.': 'For privacy reasons the map loads only after your consent.',
    'Karte laden': 'Load map',
    'Karte ist deaktiviert': 'Map is disabled',
    'Stattdessen Google Maps öffnen →': 'Open Google Maps instead →',
    'Route ansehen': 'View directions',

    /* ---------------- 404 ---------------- */
    'Fehler 404': 'Error 404',
    'Diese Seite': 'This page',
    'ist leider': 'is unfortunately',
    'nicht im Sortiment.': 'not on the menu.',
    'Die gewünschte Seite gibt es nicht — vielleicht wurde sie verlegt\n        oder umbenannt. Kommen Sie gerne zurück zur Startseite oder\n        schauen Sie persönlich in der Ifflandstraße 45 vorbei.':
      'The page you’re looking for doesn’t exist — perhaps it was moved or renamed. Head back to the home page, or drop by in person at Ifflandstraße 45.',
    'Zurück zur Startseite': 'Back to home',

    /* ---------------- Cookie-Banner ---------------- */
    'Wir respektieren Ihre Privatsphäre.': 'We respect your privacy.',
    'Wir verwenden nur technisch notwendige Speicherfunktionen. „Alle akzeptieren" lädt zusätzlich die Google-Karte auf der Kontaktseite — die setzt eigene Cookies. Mehr in der':
      'We only use technically necessary storage. “Accept all” additionally loads the Google map on the contact page — which sets its own cookies. More in the',
    'Alle akzeptieren': 'Accept all',
    'Nur notwendige': 'Necessary only',
    'Cookies anpassen': 'Cookie settings',
    'Cookie-Hinweis': 'Cookie notice',

    /* ---------------- Speisekarte (Frühstück) ---------------- */
    'Unser Klassiker': 'Our classic',
    'Frühstück von klassisch bis orientalisch, alles rund ums Ei,\n          frischer Kaffee und kaltgepresster Orangensaft. Gerne bereiten wir\n          Ihnen Ihr Frühstück nach Wunsch zu — auch für mehrere Personen.':
      'Breakfast from classic to oriental, everything egg, fresh coffee and cold-pressed orange juice. We’re happy to prepare your breakfast to order — for groups, too.',
    'Frühstück': 'Breakfast',
    'Rund ums Ei': 'All about eggs',
    'Orient': 'Oriental',
    'Extras': 'Extras',
    'Heiße Getränke': 'Hot drinks',
    'Kalte Getränke': 'Cold drinks',
    'Alle Preise in Euro inkl. MwSt. Änderungen vorbehalten. Brot, Brötchen, Croissants und Franzbrötchen kommen frisch aus unserer eigenen Backstube.':
      'All prices in euros incl. VAT. Subject to change. Bread, rolls, croissants and Franzbrötchen come fresh from our own bakery.',
    'Preis klein / groß. Alle Kaffeesorten auch koffeinfrei erhältlich.': 'Price small / large. All coffees also available decaffeinated.',
    /* Frühstück-Gerichte */
    'Klassik': 'Classic',
    '2 Brötchen nach Wahl und Butter, mit Gouda, Putensalami, Pute und Kochschinken, dazu Marmelade, Honig oder Nutella.':
      '2 rolls of your choice and butter, with Gouda, turkey salami, turkey and cooked ham, plus jam, honey or Nutella.',
    'Käse-Vielfalt': 'Cheese selection',
    '2 Brötchen nach Wahl und Butter, mit Gouda, Weichkäse, Mozzarella und Kräuterfrischkäse.':
      '2 rolls of your choice and butter, with Gouda, soft cheese, mozzarella and herb cream cheese.',
    'Süßes': 'Sweet',
    '2 frisch gebackene Butter-Croissants mit 2 Aufstrichen zur Auswahl: Butter, Honig, Nutella oder Marmelade.':
      '2 freshly baked butter croissants with 2 spreads of your choice: butter, honey, Nutella or jam.',
    'Fitness': 'Fitness',
    'Müsli mit Joghurt, Apfel, Banane und Saisonfrüchten, mit Honig verfeinert.': 'Muesli with yoghurt, apple, banana and seasonal fruit, refined with honey.',
    'Avocado-Traum': 'Avocado dream',
    'Frisch zubereitete Avocado-Creme auf zwei gerösteten Brotscheiben, Avocadoscheiben, Körner & Nüsse, Mixsalat und Balsamico.':
      'Freshly made avocado cream on two toasted slices of bread, avocado slices, seeds & nuts, mixed salad and balsamic.',
    'Avocado-Traum mit Spiegelei': 'Avocado dream with fried egg',
    'Wie der Avocado-Traum, dazu obendrauf 2 Spiegeleier.': 'Like the avocado dream, topped with 2 fried eggs.',
    /* Rund ums Ei */
    'Rührei Klassik': 'Scrambled eggs, classic',
    'Rührei aus 3 Eiern mit Salz, Pfeffer und Milch abgeschmeckt. Dazu Butter und 1 Scheibe Brot oder 1 Brötchen.':
      'Scrambled eggs from 3 eggs seasoned with salt, pepper and milk. With butter and 1 slice of bread or 1 roll.',
    'Rührei aus 2 Eiern': 'Scrambled eggs from 2 eggs',
    'Omelett Natur': 'Plain omelette',
    'Omelett aus 3 Eiern mit Salz, Pfeffer und Milch. Dazu Butter und 1 Scheibe Brot oder 1 Brötchen.':
      'Omelette from 3 eggs with salt, pepper and milk. With butter and 1 slice of bread or 1 roll.',
    '3 Spiegeleier klassisch': '3 fried eggs, classic',
    'Dazu Butter und 1 Scheibe Brot oder 1 Brötchen.': 'With butter and 1 slice of bread or 1 roll.',
    'Gekochtes Ei': 'Boiled egg',
    'Dreher-Frühstück (2 Scheiben)': 'Dreher breakfast (2 slices)',
    'Dreher-Frühstück (3 Scheiben)': 'Dreher breakfast (3 slices)',
    'Dreher-Frühstück (2 Scheiben mit Speck)': 'Dreher breakfast (2 slices with bacon)',
    'Dreher-Frühstück (3 Scheiben mit Speck)': 'Dreher breakfast (3 slices with bacon)',
    'Geröstetes Brot mit Spiegelei und Käse.': 'Toasted bread with fried egg and cheese.',
    'Geröstetes Brot mit Spiegelei, Käse und Speck.': 'Toasted bread with fried egg, cheese and bacon.',
    /* Orient */
    'Rührei mit Sucuk': 'Scrambled eggs with sucuk',
    'Rührei mit Sucuk & Schafskäse': 'Scrambled eggs with sucuk & feta',
    'Rührei aus 3 Eiern mit Salz und Pfeffer abgeschmeckt. Dazu Butter und 1 Scheibe Brot oder 1 Brötchen.':
      'Scrambled eggs from 3 eggs seasoned with salt and pepper. With butter and 1 slice of bread or 1 roll.',
    'Rührei aus 3 Eiern mit Sucuk und Schafskäse. Dazu Butter und 1 Scheibe Brot oder 1 Brötchen.':
      'Scrambled eggs from 3 eggs with sucuk and feta. With butter and 1 slice of bread or 1 roll.',
    'Omelett mit Sucuk': 'Omelette with sucuk',
    'Omelett mit Sucuk & Schafskäse': 'Omelette with sucuk & feta',
    'Omelett mit Sucuk, mit Salz und Pfeffer abgeschmeckt. Dazu Butter und 1 Scheibe Brot oder 1 Brötchen.':
      'Omelette with sucuk, seasoned with salt and pepper. With butter and 1 slice of bread or 1 roll.',
    'Omelett mit Sucuk und Schafskäse. Dazu Butter und 1 Scheibe Brot oder 1 Brötchen.':
      'Omelette with sucuk and feta. With butter and 1 slice of bread or 1 roll.',
    'Spiegelei mit Sucuk': 'Fried egg with sucuk',
    '2 Spiegeleier klassisch mit Sucuk. Dazu Butter und 1 Scheibe Brot oder 1 Brötchen.':
      '2 classic fried eggs with sucuk. With butter and 1 slice of bread or 1 roll.',
    /* Extras */
    'Speck (2 Scheiben)': 'Bacon (2 slices)',
    'Speck (4 Scheiben)': 'Bacon (4 slices)',
    'Schafskäse': 'Feta',
    'Metzger-Zwiebelmett': 'Butcher’s onion mett',
    'Räucherlachs mit Meerrettich & Zwiebeln': 'Smoked salmon with horseradish & onions',
    'Cherry-Tomaten': 'Cherry tomatoes',
    '½ Avocado in Scheiben': '½ avocado, sliced',
    'Pesto': 'Pesto',
    'Butter': 'Butter',
    'Marmelade, Honig oder Nutella': 'Jam, honey or Nutella',
    'Nur in Verbindung mit einem Frühstück.': 'Only together with a breakfast.',
    /* Heiße Getränke */
    'Espresso': 'Espresso',
    'Klein, heiß und kräftig.': 'Small, hot and strong.',
    'Americano': 'Americano',
    'Espresso mit heißem Wasser.': 'Espresso with hot water.',
    'Cappuccino': 'Cappuccino',
    'Espresso und feiner Milchschaum. Mit Hafermilch 4,20 / 4,70 €.': 'Espresso and fine milk foam. With oat milk 4.20 / 4.70 €.',
    'Milchkaffee': 'Café au lait',
    'Café Crema': 'Café crema',
    'Latte Macchiato': 'Latte macchiato',
    'Leicht und bekömmlich. Mit Hafermilch 4,20 / 4,70 €.': 'Light and easy. With oat milk 4.20 / 4.70 €.',
    'Karamell Macchiato': 'Caramel macchiato',
    'Mit Karamell-Aroma und Topping. Mit Hafermilch 4,90 / 5,50 €.': 'With caramel flavour and topping. With oat milk 4.90 / 5.50 €.',
    'Hauskaffee': 'House coffee',
    'Traditionell gefilterter Kaffee.': 'Traditionally filtered coffee.',
    'Die italienische Variante zum Milchkaffee. Mit Hafermilch 4,20 / 4,70 €.': 'The Italian take on café au lait. With oat milk 4.20 / 4.70 €.',
    'Frisch gemahlen und zubereitet.': 'Freshly ground and prepared.',
    'Heiße Schokolade oder Weiße': 'Hot chocolate or white',
    'Süß-schokoladig oder cremig-vanillig.': 'Sweet and chocolatey or creamy and vanilla.',
    'Tee (Glas 0,4 l)': 'Tea (glass 0.4 l)',
    'Feinster Beuteltee in verschiedenen Sorten.': 'Finest bagged tea in various varieties.',
    /* Kalte Getränke */
    'Frisch gepresster Orangensaft 0,2 l': 'Freshly squeezed orange juice 0.2 l',
    'Frisch gepresster Orangensaft 0,5 l': 'Freshly squeezed orange juice 0.5 l',
    'Aus mindestens drei unbehandelten Saftorangen — Vitamine pur.': 'From at least three untreated juice oranges — pure vitamins.',
    'Serviert in der Karaffe.': 'Served in a carafe.',
    'Mineralwasser still 0,2 l': 'Still mineral water 0.2 l',
    'Mineralwasser still 0,7 l': 'Still mineral water 0.7 l',
    'Glasflasche.': 'Glass bottle.',
    'Sekt trocken 12% · 0,2 l': 'Dry sparkling wine 12% · 0.2 l',
    'Sekt trocken · Flasche 0,7 l': 'Dry sparkling wine · bottle 0.7 l',
    'Serviert im Glas, ausgewogen-brut.': 'Served by the glass, balanced brut.',
    'Serviert kalt im Kübel.': 'Served cold in an ice bucket.',
    'vegan': 'vegan',
    'vegetarisch': 'vegetarian'
  };

  /* Normalisiertes Wörterbuch: Mehrfach-Whitespace/Zeilenumbrüche im
     Quelltext auf ein Leerzeichen reduziert, damit eingerückte mehrzeilige
     HTML-Texte trotzdem matchen. */
  var EN_NORM = {};
  (function () {
    for (var k in EN) {
      if (EN.hasOwnProperty(k)) EN_NORM[k.replace(/\s+/g, ' ').trim()] = EN[k];
    }
  })();
  function lookup(raw) {
    return EN_NORM[raw.replace(/\s+/g, ' ').trim()];
  }

  /* Elemente, deren Text von einer Animation in Einzel-Buchstaben zerlegt
     wird (Hero-Überschrift). Die werden auf Element-Ebene über textContent
     übersetzt — das liest den zusammengesetzten Text auch nach dem Split. */
  var BLOCK_SEL = '.head-1, .head-2, .head-3';

  /* Attribute, die mitübersetzt werden. */
  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];

  var textStore = []; // {node, de}
  var attrStore = []; // {el, attr, de}
  var toggleBtns = [];
  var observer = null;
  var current = 'de';

  function shouldSkip(node) {
    var p = node.parentNode;
    while (p && p.nodeType === 1) {
      var tag = p.nodeName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return true;
      if (p.hasAttribute && p.hasAttribute('data-no-i18n')) return true;
      p = p.parentNode;
    }
    return false;
  }

  function translate(toEN) {
    // 1) Block-Elemente (Hero-Überschrift), die per Animation in Buchstaben
    //    zerlegt werden — auf Element-Ebene über textContent übersetzen.
    Array.prototype.forEach.call(document.querySelectorAll(BLOCK_SEL), function (el) {
      if (toEN) {
        var en = lookup(el.textContent);
        if (en !== undefined) {
          if (el.__deHTML === undefined) el.__deHTML = el.innerHTML;
          el.textContent = en;
          el.setAttribute('data-i18n-locked', '1');
        }
      } else if (el.__deHTML !== undefined) {
        el.innerHTML = el.__deHTML;
        el.removeAttribute('data-i18n-locked');
      }
    });
    // 2) Textknoten (Whitespace-tolerant). Führende/abschließende Leerzeichen
    //    bleiben erhalten, damit Wortabstände um Inline-Elemente stimmen.
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var n, batch = [];
    while ((n = walker.nextNode())) batch.push(n);
    batch.forEach(function (node) {
      if (shouldSkip(node)) return;
      // Nicht in bereits element-übersetzte Blöcke hineinschreiben.
      if (node.parentNode && node.parentNode.closest && node.parentNode.closest('[data-i18n-locked]')) return;
      var raw = node.nodeValue;
      var key = raw.trim();
      if (!key) return;
      if (toEN) {
        var en = lookup(raw);
        if (en !== undefined) {
          if (node.__deVal === undefined) node.__deVal = raw;
          var lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
          node.nodeValue = lead + en + trail;
        }
      } else if (node.__deVal !== undefined) {
        node.nodeValue = node.__deVal;
      }
    });
    // Attribute
    var sel = '[' + ATTRS.join('],[') + ']';
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) {
      ATTRS.forEach(function (a) {
        if (!el.hasAttribute(a)) return;
        var store = el.__deAttr || (el.__deAttr = {});
        var raw = el.getAttribute(a);
        var key = raw.trim();
        if (!key) return;
        if (toEN) {
          var en = lookup(raw);
          if (en !== undefined) {
            if (store[a] === undefined) store[a] = raw;
            el.setAttribute(a, en);
          }
        } else if (store[a] !== undefined) {
          el.setAttribute(a, store[a]);
        }
      });
    });
  }

  function withObserverPaused(fn) {
    if (observer) observer.disconnect();
    fn();
    if (observer && current === 'en') {
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }

  function apply(lang) {
    current = lang;
    withObserverPaused(function () { translate(lang === 'en'); });
    document.documentElement.lang = lang;
    updateToggle();
  }

  function setLang(lang) {
    try { localStorage.setItem(LS_KEY, lang); } catch (e) {}
    // Neu laden: so werden auch die dynamisch von script.js erzeugten
    // Inhalte (Datum, Wochentag, Öffnungsstatus) sauber in der neuen
    // Sprache gerendert — ohne fehleranfällige Einzel-Neurenderei.
    try { location.reload(); } catch (e) { apply(lang); }
  }

  function updateToggle() {
    toggleBtns.forEach(function (btn) {
      var isEN = current === 'en';
      // Der Knopf zeigt die Sprache, in die man wechselt.
      btn.textContent = isEN ? 'DE' : 'EN';
      btn.setAttribute('aria-label', isEN ? 'Auf Deutsch umschalten' : 'Switch to English');
      btn.setAttribute('lang', isEN ? 'de' : 'en');
    });
  }

  function makeToggle() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lang-toggle';
    btn.addEventListener('click', function () {
      setLang(current === 'en' ? 'de' : 'en');
    });
    return btn;
  }

  function injectToggles() {
    // In die Hauptnavigation (Desktop + mobiles Ausklappmenü).
    var nav = document.querySelector('.primary-nav');
    if (nav) {
      var b = makeToggle();
      b.classList.add('lang-toggle-nav');
      nav.appendChild(b);
      toggleBtns.push(b);
    }
    updateToggle();
  }

  function init() {
    injectToggles();
    var saved = 'de';
    try { saved = localStorage.getItem(LS_KEY) || 'de'; } catch (e) {}
    // MutationObserver für dynamisch nachgeladene Inhalte (Speisekarte usw.)
    observer = new MutationObserver(function () {
      if (current !== 'en') return;
      withObserverPaused(function () { translate(true); });
    });
    if (saved === 'en') apply('en');
    else updateToggle();
    // Für script.js erreichbar, um nach Render erneut zu übersetzen.
    window.alsterI18n = { setLang: setLang, reapply: function () { apply(current); }, current: function () { return current; } };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
