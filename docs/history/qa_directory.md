# Directory QA

Built from OSM (edits to 2026-10-21) and Overture 2026-09. Rules: see the docstring of `scripts/build_directory.py`.

**394 branches, 329 shops** (14 without coordinates). Background layer (OSM only, status unverified): 731.

## By class

- independent: 212
- specialty: 173
- multibranch: 9

## By open evidence

- editorial_2025_26: 173
- osm_check: 135
- overture_2026_09: 86

## By city

- Quezon City: 80
- Makati: 70
- Manila: 52
- Mandaluyong: 37
- San Juan: 30
- Taguig: 29
- Marikina: 25
- Pasig: 25
- Pasay: 12
- Las Piñas: 9
- Muntinlupa: 9
- Parañaque: 9
- Caloocan: 3
- Valenzuela: 3
- Malabon: 1

## Removed before classification

- tea / dessert / donut cuisine: 231 (e.g. Dunkin, BrewerTea, I Love Milktea, Chatime, Tokyo Bubble Tea, Tealive)
- duplicate within 150 m: 62
- unnamed: 53 (e.g. n281021762, n1013373937, n1321374724, n2088032261, n2184717253, n2548107135)
- bakery: 20 (e.g. Polland Hopia, Dunkin', Dunkin', IJO Bakery, Jipan, Mrs. Fields)
- outside NCR: 18 (e.g. Taste from the Greens, Hugot Cafe, I Love Milktea, Cha Tuk Chak, Lucky Chai Cafe, Tap Tea)
- milk tea / internet café name: 16 (e.g. Kai Cha Milk Tea, Chemistea Milk Tea + Cafe, I Love Milktea, I Love Milktea, Kuya Orlee Computer Shop, I Love Milktea)
- restaurant / bar: 11 (e.g. Bistro Ravioli, Detoxify Bar, Soya Bar, Bites Bistro, Bar Pintxos, New Bistro Deli)
- manual exclusion (data/osm_exclusions.psv): 7 (e.g. Za's Cafe, Fleur de Ly's, Cafe Nenzo, Bhon Cafe, Café Mezzanine, The Wallflower Café)
- closed / not a café per editorial check: 4

## Chains removed (869 OSM features)

- Starbucks: 251
- Dunkin: 153
- The Coffee Bean & Tea Leaf: 60
- Pickup Coffee: 44
- ZUS Coffee: 30
- Seattle's Best: 26
- Tim Hortons: 22
- J.CO: 21
- Coffee Project: 19
- UCC: 17
- Bo's Coffee: 17
- Black Scoop: 13
- Figaro: 13
- But First Coffee: 12
- Moonleaf: 9
- Highlands Coffee: 8
- Big Brew: 7
- Macao Imperial: 7
- Serenitea: 6
- Cafe France: 6
- BigBrew: 6
- TOMORO Coffee: 6
- Tealive: 5
- Infinitea: 5
- Kkopi: 5
- Mary Grace: 4
- Dakasi: 4
- Coffee Bean: 4
- Bon Appetea: 4
- Krispy Kreme: 4
- McCafé: 3
- Nitro 7: 3
- St. Marc Café: 3
- Café Breton (12 locations): 3
- Gloria Jean's: 3
- D'Cream: 3
- Gong Cha: 3
- Dear Joe: 3
- Paik's Coffee: 3
- The Matcha Tokyo: 3
- Conti's: 2
- Yi Fang: 2
- Juan Café (16 locations): 2
- Cafe Breton (12 locations): 2
- Kopi Roti: 2
- Happy Lemon: 2
- Costa Coffee: 2
- Bench: 2
- Royaltea: 2
- Café Amazon: 2
- Juan Cafe (16 locations): 2
- Don Macchiatos: 2
- CoCo: 2
- Greyhound Café: 2
- KOI Thé: 2
- M&S: 1
- Black Canyon: 1
- Paul: 1
- Sharetea: 1
- KopiRoti: 1
- Rocky Mountain Chocolate: 1
- TWG Tea: 1
- Cha Tuk Chak: 1
- Publiq: 1
- Ya Kun: 1
- Country Style: 1
- Segafredo: 1
- ShuYi: 1
- Cha Dao: 1
- Caffè Pascucci: 1
- Chatime: 1
- Mister Donut: 1
- Farron Cafe (10 locations): 1
- IKEA: 1
- Kopilism. (10 locations): 1
- Paris Baguette: 1

## Multi-branch (4-9 locations), kept and labelled

- Nono's (4): 3
- Tomo Coffee (5): 2
- Cafe Bonjour (6): 2
- The Coffee Beanery (5): 2
- happykopi (5): 2
- Happykopi (5): 2
- tomo coffee (5): 1
- Kalinaw (5): 1
- CALLE CAFE (4): 1
- Hebrew Cafe (4): 1
- Little Flour (4): 1
- The Brewed Buddies (4): 1
- Love, Coffee (4): 1
- Sunnies Cafe (4): 1
- Kalinaw Coffee Co. (5): 1
- Beanleaf (8): 1
- Cafe Tribu (6): 1
- Cafe Republic (4): 1
- HappyKopi (5): 1
- Calle Cafe (4): 1
- Little Flour Café (4): 1
- Cafe Adriatico (4): 1
- Tomo coffee (5): 1
- Doppio (4): 1

## Names with >= 4 locations (review for chains.psv)

- starbucks: 353
- dunkin: 139
- bean tea leaf: 94
- figaro: 73
- bos: 59
- black scoop: 56
- tim hortons: 50
- seattles best: 45
- pickup: 44
- mary grace: 34
- kkopi tea: 32
- zus: 30
- but first: 28
- dunkin donuts: 27
- project: 26
- jco donuts: 23
- france: 19
- juan: 16
- highlands: 14
- tobys estate: 12
- bigbrew: 12
- breton: 12
- infinitea: 11
- mccafe: 10
- farron: 10
- kopilism: 10
- harlan holden: 9
- macao imperial tea: 9
- cha tuk chak: 9
- coftea: 9
- famous belgian waffles: 9
- big brew: 8
- moonleaf: 8
- ucc clockwork: 8
- beanleaf: 8
- happy kopi: 8
- kofee manila: 8
- 1128 tea: 8
- serenitea: 7
- ucc terrace: 7
- starbucks reserve: 7
- country style: 7
- yardstick: 6
- single origin: 6
- bonjour: 6
- costa: 6
- tribu: 6
- kkopitea: 6
- ucc: 6
- 2838 tea: 6
- tastes from greens: 6
- pad 41 kofe: 6
- tomo: 5
- dakasi: 5
- kalinaw: 5
- tealive: 5
- ucc vienna: 5
- nitro 7 tea: 5
- kkopi: 5
- st marc: 5
- kopi roti: 5
- bon appetea: 5
- beanery: 5
- happy lemon: 5
- craft revolution: 5
- happykopi: 5
- king queen tea: 5
- bibingkinitan: 5
- tea time: 5
- havens brew: 5
- emoteara: 5
- ucc park: 4
- calle: 4
- hebrew: 4
- wildflour: 4
- dcream: 4
- little flour: 4
- brewed buddies: 4
- love: 4
- sunnies: 4
- don macchiatos: 4
- moonleaf tea shop: 4
- gong cha: 4
- nonos: 4
- republic: 4
- paiks: 4
- matcha tokyo: 4
- dear joe: 4
- adriatico: 4
- doppio: 4
- zen tea: 4
- ourblend milk tea: 4
