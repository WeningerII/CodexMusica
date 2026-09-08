// _atlas_regions.js — the atlas sidebar's regional grouping, as a table.
//
// WHAT THIS REPLACES
// The design prototype grouped the "In view" list with a hand-rolled
// bounding-box classifier: a ladder of latitude/longitude comparisons. Run over
// the real data it put Algiers, Tunis and two Moroccan entries in EUROPE (the
// Maghreb fell through a gap in the rule that rescues the western edge), the
// nine Hawaiian entries in LATIN AMERICA & CARIBBEAN (the Americas rule claimed
// them at lat 21 before the Oceania rule could fire), three southern Greek
// entries in AFRICA, and split Mexico 49/21 and Egypt 18/2 across two buckets
// each. For an atlas whose stated thesis is that regional framing is
// contestable, a classifier that files Algiers under Europe is the one error
// that undermines the argument.
//
// The replacement is a table, not a formula. 181 distinct place tokens cover all
// 2503 pins, so every assignment is written down and can be argued with, and a
// wrong one is a one-line fix rather than a geometry puzzle.
//
// THE IMPORTANT PROPERTY: THERE IS NO FALLBACK.
// resolveRegion() returns null for anything it does not know, and
// scripts/build_atlas_geo.js turns that into a build failure naming the label.
// The old classifier's final `return 'Africa'` is exactly how Hawaiʻi ended up
// mis-filed and stayed that way — a catch-all answer is indistinguishable from a
// correct one. A new tradition with an unfamiliar place label must be classified
// by a person, not guessed at.
//
// HOW A LABEL RESOLVES
//   1. Parentheticals are stripped: "Moscow, Russia (internet-native)" -> "Moscow, Russia".
//   2. LABEL_REGION is consulted with the whole label. This exists for countries
//      that genuinely span two regions — Russia is the only one in today's data,
//      at 99 degrees of longitude, so Dagestan and Sakha are named explicitly
//      while the other 27 Russian entries fall through to Europe below.
//   3. Otherwise the last comma-separated segment is looked up in PLACE_REGION.
//
// ON THE ASSIGNMENTS THEMSELVES
// Several are contested, and the table says so rather than pretending otherwise
// (see CONTESTED below). This is a NAVIGATION aid — its job is that someone
// browsing can find the music without hunting — and it is not a claim about
// where anyone belongs. Where findability and convention disagreed, findability
// won; where an assignment would read as an erasure, it did not.

'use strict';

// Canonical buckets. src/atlas.js renders whichever of these are in view,
// ordered by how many pins each holds, so this order is for validation only.
//
// "Mongolia & Siberia" was "Central & North Asia" in the prototype. Four
// independent reviews, working from different conventions, all flagged the same
// defect: it and "Caucasus & Central Asia" share the words "Central" and
// "Asia", so a reader scanning headings cannot tell which one holds Kazakhstan
// and which holds Tuva. The bucket holds Mongolia and Tuva (and Sakha, via
// LABEL_REGION), so it is now named for what is in it.
const REGIONS = [
  'North America',
  'Latin America & Caribbean',
  'Europe',
  'Africa',
  'Middle East',
  'Caucasus & Central Asia',
  'Mongolia & Siberia',
  'South Asia',
  'Southeast Asia',
  'East Asia',
  'Oceania & Pacific',
];

// Whole-label overrides, for a country that spans more than one bucket.
const LABEL_REGION = {
  'Dagestan, Russia': 'Caucasus & Central Asia',
  'Nalchik, Caucasus, Russia': 'Caucasus & Central Asia',
  'Yakutsk, Sakha, Russia': 'Mongolia & Siberia',
};

// Trailing place token -> bucket. Grouped by bucket so the table can be read
// and argued with; lookup is by key, so the grouping is purely for humans.
const PLACE_REGION = {};
const assign = (region, tokens) => {
  for (const t of tokens) PLACE_REGION[t] = region;
};

assign('North America', ['US', 'Canada']);

assign('Latin America & Caribbean', [
  'Argentina',
  'Bahamas',
  'Barbados',
  'Belize',
  'Bolivia',
  'Brazil',
  'Northeast Brazil',
  'Chile',
  'Colombia',
  'Colombian Andes',
  'Cuba',
  'Dominica',
  'Dominican Republic',
  'Ecuador',
  'Grenada',
  'Guadeloupe',
  'Guatemala',
  'Haiti',
  'Honduras',
  'Jamaica',
  'Martinique',
  'Mexico',
  'Panama',
  'Paraguay',
  'Peru',
  'Puerto Rico',
  'St Lucia',
  'St Vincent',
  'Suriname',
  'Trinidad',
  'Uruguay',
  'Venezuela',
]);

assign('Europe', [
  'Albania',
  'Austria',
  'Belgium',
  'Bosnia',
  'Central Bosnia',
  'Bulgaria',
  'Croatia',
  'Cyprus',
  'Czechia',
  'Denmark',
  'Estonia',
  'Faroe Islands',
  'Finland',
  'France',
  'Rural France',
  'Germany',
  'Greece',
  'Aegean',
  'Hungary',
  'Iceland',
  'Ireland',
  'Isle of Man',
  'Italy',
  'Latvia',
  'Lithuania',
  'Netherlands',
  'North Macedonia',
  'Norway',
  'Poland',
  'Portugal',
  'Romania',
  'Russia',
  'Sápmi',
  'Scotland',
  'Scottish Highlands',
  'Serbia',
  'Serbia/Montenegro',
  'Slovenia',
  'Spain',
  'Canary Islands',
  'Sweden',
  'Switzerland',
  'UK',
  'Ukraine',
]);

assign('Africa', [
  'Algeria',
  'Angola',
  'Botswana',
  'Cameroon',
  'Cape Verde',
  "Côte d'Ivoire",
  'DR Congo',
  'Northwest Congo Basin',
  'Eritrea',
  'Ethiopia',
  'Ghana',
  'Guinea',
  'Kenya',
  'Libya',
  'Mali',
  'Mauritius',
  'Morocco',
  'Mozambique',
  'Namibia',
  'Niger',
  'Nigeria',
  'Réunion',
  'Senegal',
  'Senegambia',
  'Sierra Leone',
  'Somaliland',
  'South Africa',
  'Sudan',
  'Tanzania',
  'Tunisia',
  'Uganda',
  'Zambia',
  'Zimbabwe',
]);

assign('Middle East', [
  'Bahrain',
  'Egypt',
  'Upper Egypt',
  'Iran',
  'Iraq',
  'Israel',
  'Jerusalem',
  'Kurdistan',
  'Kuwait',
  'Lebanon',
  'Mount Lebanon',
  'Levant',
  'Oman',
  'Saudi Arabia',
  'Syria',
  'Turkey',
  'Yemen',
]);

assign('Caucasus & Central Asia', [
  'Armenia',
  'Azerbaijan',
  'Georgia',
  'Kazakhstan',
  'Kazakh Steppe',
  'Kyrgyzstan',
  'Tajikistan',
  'Turkmenistan',
  'Uzbekistan',
  'Xinjiang',
]);

assign('Mongolia & Siberia', ['Mongolia', 'Central Mongolia', 'Western Mongolia', 'Tuva']);

assign('South Asia', [
  'Afghanistan',
  'Bangladesh',
  'Bengal',
  'Bhutan',
  'India',
  'Maldives',
  'Nepal',
  'Pakistan',
  'Sri Lanka',
]);

assign('Southeast Asia', [
  'Cambodia',
  'Indonesia',
  'Laos',
  'Malaysia',
  'Myanmar',
  'Philippines',
  'Singapore',
  'Thailand',
  'Central Thailand',
  'Vietnam',
]);

assign('East Asia', ['China', 'Hong Kong', 'Japan', 'Korea', 'Taiwan', 'Tibet']);

assign('Oceania & Pacific', [
  'Aotearoa New Zealand',
  'New Zealand',
  'Australia',
  'Central Australia',
  'Fiji',
  'French Polynesia',
  'Hawaiʻi',
  'New Caledonia',
  'Papua New Guinea',
  'Samoa',
  'Solomon Islands',
  'Tahiti',
  'Tonga',
  'Vanuatu',
]);

// Assignments where a different convention lands elsewhere, recorded so the next
// person to argue with the table starts from what was already argued. The atlas
// does not present these as settled.
const CONTESTED = {
  Turkey:
    'Middle East here; the UN geoscheme files it Western Asia and 18 of the 27 pins are Istanbul, which is partly in Europe.',
  Cyprus:
    'Europe here: an EU member whose majority repertoire is Greek-language and is shelved with Greece in the reference literature. The UN geoscheme files it Western Asia, but filing it Middle East would read to Greek Cypriots as an erasure, which outranks the code.',
  Egypt:
    'Middle East here, with Upper Egypt: Cairo is the centre of the Arab art-music repertoire this bucket exists to hold, and someone hunting Umm Kulthum, tarab or Sufi inshad scans Middle East first. M49 and physical geography both say Africa, and the Maghreb below deliberately goes the other way — Mashriq and Maghreb part company here, as they do in the music.',
  Morocco:
    'Africa here, unlike Egypt above: raï, gnawa and chaabi carry Andalusi and sub-Saharan lineage rather than the Mashriqi tarab tradition, and a MENA framing would collapse that difference.',
  Algeria: 'Africa here, same reasoning as Morocco.',
  Tunisia: 'Africa here, same reasoning as Morocco.',
  Libya: 'Africa here, same reasoning as Morocco.',
  Tibet:
    'East Asia here, where a listener would look; culturally and politically distinct from Han China, and Inner Asian framings group it with Central Asia.',
  Xinjiang:
    'Caucasus & Central Asia, against the political border: Uyghur muqam sits with Uzbek shashmaqam and the Tajik and Kazakh repertoires, so someone arriving through the music finds it among its neighbours. The name itself is also contested — Uyghurs call it East Turkestan.',
  Afghanistan:
    'South Asia here, following its Hindustani-facing art music; often filed Central Asia or Middle East.',
  Russia:
    'Europe by default because 27 of the 30 pins are European Russia; Dagestan, Nalchik and Sakha are named explicitly in LABEL_REGION.',
  Hawaiʻi:
    'Oceania & Pacific on musical and cultural lineage; it is also a US state, so a listener may reasonably scan North America first. The prototype filed it Latin America & Caribbean, which was simply a bug.',
  Mongolia:
    'Mongolia & Siberia, with Tuva, whose khoomei and long-song repertoire it shares; an East Asian filing is defensible on political geography alone. Central Mongolia and Western Mongolia follow it.',
  'Upper Egypt': 'Middle East, following Egypt above.',
  Sápmi:
    'Europe here on geography; Sápmi is a stateless nation across four states and is not a European sub-region in its own telling.',
  'Canary Islands': 'Europe here as part of Spain; physically off the African coast.',
  Réunion: 'Africa here as an Indian Ocean island; politically a French department.',
  Mauritius: 'Africa here, same reasoning as Réunion.',
  Somaliland:
    'Africa; listed because the polity itself is unrecognised, not because the region is in doubt.',
  Kurdistan: 'Middle East; listed because it is a stateless nation spanning four states.',
  Levant:
    'Middle East; a regional name rather than a state, kept because the tradition is not one countryic.',
};

const stripParens = (s) =>
  s
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Returns a bucket, or null when the label is unknown. Never guesses.
function resolveRegion(label) {
  if (typeof label !== 'string') return null;
  const clean = stripParens(label);
  if (!clean) return null;
  if (LABEL_REGION[clean]) return LABEL_REGION[clean];
  const parts = clean
    .split(',')
    .map((s) => stripParens(s))
    .filter(Boolean);
  if (!parts.length) return null;
  return PLACE_REGION[parts[parts.length - 1]] || null;
}

module.exports = { REGIONS, PLACE_REGION, LABEL_REGION, CONTESTED, resolveRegion, stripParens };
