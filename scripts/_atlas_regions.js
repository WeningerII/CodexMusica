// _atlas_regions.js — the editorial policy for data/geo.json's two authored
// fields: the place label and the sidebar region. Both are validated here; the
// gate is scripts/build_atlas_geo.js.
//
// A geo.json entry is [lat, lng, place, region].
//
// ─────────────────────────────────────────────────────────────────────────────
// THE LABEL POLICY: NAME THE PLACE, NEVER THE STATE
//
// Labels were machine-drafted alongside the coordinates and made sovereignty
// claims inconsistently — several different ways in the same file. Tibet
// appeared with no country while Xinjiang implied China through the city name;
// Somaliland was named as though it were a state; Tuva stood alone while Sakha
// carried "Russia"; Sápmi sometimes had a state suffix and sometimes did not;
// Byzantine chant said "Constantinople (Istanbul)" while makam entries from the
// same city said Istanbul. 102 traditions carried a label that took a position.
//
// Naming a place IS a claim about who it belongs to, so the atlas stopped
// making one. Every label is now the place and nothing after it:
//
//     Lhasa, Tibet          -> Lhasa
//     Kashgar, Xinjiang     -> Kashgar
//     Diyarbakır, Kurdistan -> Diyarbakır
//     Hargeisa, Somaliland  -> Hargeisa
//     Taipei, Taiwan        -> Taipei
//     Nashville, US         -> Nashville
//     Kautokeino, Sápmi, Norway -> Kautokeino
//
// The rule is applied to all 2503 entries, not only the contested ones. A rule
// with exceptions is itself a position — "we name states except where it is
// awkward" invites exactly the argument the policy exists to avoid — so the
// atlas names no state anywhere and never has to decide which states count.
//
// WHAT THE RULE DOES NOT DO
//   - It does not remove anybody. Deleting the 102 contested entries would have
//     deleted Māori, Sámi, Hawaiian, Tibetan, Navajo, Inuit, Uyghur, Kurdish and
//     Kanak music from the map, which is a far larger statement than any label.
//   - It does not erase a community's own name for its own place. Where the
//     place IS the name — Sápmi, Navajo Nation, Basque Country, Hong Kong,
//     Puerto Rico, Jerusalem, Levant — that label stands alone and stays.
//   - It does not touch historical names. "Constantinople (Istanbul)",
//     "Edo (Tokyo)", "Trabzon (Pontus)", "Ionia (Izmir)" and
//     "Tenochtitlan (Mexico City)" all name historical traditions and carry the
//     modern name in parentheses. Which name a city gets after a conquest is a
//     separate question from which state it is attributed to, and it has not
//     been ruled on.
//   - It does not drop the honesty tags. "(internet-native)", "(worldwide)" and
//     "(Durango diaspora)" survive the trim: "Chicago, US (internet-native)"
//     becomes "Chicago (internet-native)".
//
// THE ONE EXCEPTION, AND ITS BOUND
// A qualifier is kept only where a bare name would otherwise label places in two
// DIFFERENT sidebar regions — five names, twelve labels: Athens (Greece and
// Georgia), Birmingham (UK and Alabama), Bristol (UK and Tennessee), Jerez
// (Andalusia and Zacatecas), Santiago (Chile and Cape Verde). Without it, Athens
// jangle pop and Greek rebetiko would share a label. Same-region repeats are
// left alone: two "Jeolla" pins 150km apart are one province, and the map
// position and regional heading already tell them apart. None of the five
// involves a contested sovereignty.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE REGION FIELD
//
// The prototype grouped the sidebar with a hand-rolled bounding-box classifier —
// a ladder of latitude/longitude comparisons ending in a catch-all
// `return 'Africa'`. Over the real data it filed Algiers, Tunis and two Moroccan
// entries under EUROPE, the nine Hawaiian entries under LATIN AMERICA, three
// southern Greek entries under AFRICA, and split Mexico 49/21 and Egypt 18/2.
// For an atlas whose thesis is that regional framing is contestable, a
// classifier that files Algiers under Europe is the error that undermines the
// argument.
//
// The region is now authored per entry in data/geo.json — 2503 values that can
// each be argued with, rather than a formula whose failures are geometry
// puzzles. It was seeded from a lookup table over the old labels' country
// tokens, then reviewed: four independent assignments of all 181 country tokens,
// each from one declared convention (UN M49, ethnomusicological area studies,
// listener findability, plain physical geography), disagreed on 26, and each of
// those was argued separately. Three of those rulings are in the data (Cyprus,
// Egypt, Xinjiang — see CONTESTED). That table is gone now that the labels no
// longer carry country tokens for it to key on; what it concluded lives in the
// data and in CONTESTED below.
//
// THERE IS STILL NO FALLBACK. A geo.json entry whose region is missing or is not
// one of REGIONS fails the build, naming the entry. The old classifier's
// catch-all is exactly how Hawaiʻi got mis-filed and stayed that way: an answer
// for everything is indistinguishable from a correct one. A new tradition must
// be classified by a person.

'use strict';

// Canonical buckets. src/atlas.js renders whichever are in view, ordered by how
// many pins each holds, so this order is for validation only.
//
// "Mongolia & Siberia" was "Central & North Asia" in the prototype. All four
// reviews independently flagged the same defect: it and "Caucasus & Central
// Asia" share the words "Central" and "Asia", so a reader scanning headings
// cannot tell which one holds Kazakhstan and which holds Tuva. The bucket holds
// Mongolia, Tuva and Sakha, so it is named for what is in it.
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

// Region assignments where a different convention lands elsewhere, recorded so
// the next person to argue with the data starts from what was already argued.
// Keyed by the place or country the argument is about, not by tradition id.
const CONTESTED = {
  Turkey:
    'Middle East; the UN geoscheme files it Western Asia and most of its pins are Istanbul, which is partly in Europe. The rule holds THROUGHOUT, including Edirne and Istanbul, which are physically in European Thrace — and including the Greek-culture-in-Anatolia repertoires, which is where it was actually broken: Byzantine chant and Pontic Greek were filed Middle East while Homeric rhapsode recitation at Ionia (Izmir) was filed Europe, the only entry in the file that put an Asian coordinate in Europe. The argument for Europe is real — Homeric recitation is Archaic Greek and belongs with the Hellenic sphere — but it is an argument about culture that the atlas already declined to make for Byzantine chant in the same breath, so making it once is an inconsistency rather than a position.',
  Cyprus:
    'Europe: an EU member whose majority repertoire is Greek-language and is shelved with Greece in the reference literature. M49 says Western Asia, but filing it Middle East would read to Greek Cypriots as an erasure, which outranks the code.',
  Egypt:
    'Middle East, with Upper Egypt: Cairo is the centre of the Arab art-music repertoire this bucket exists to hold, and someone hunting Umm Kulthum, tarab or Sufi inshad scans Middle East first. M49 and physical geography both say Africa, and the Maghreb deliberately goes the other way.',
  Morocco:
    'Africa, unlike Egypt: raï, gnawa and chaabi carry Andalusi and sub-Saharan lineage rather than the Mashriqi tarab tradition, and a flat MENA framing would collapse that difference. Algeria, Tunisia and Libya follow it.',
  Xinjiang:
    'Caucasus & Central Asia, against the political border: Uyghur muqam sits with Uzbek shashmaqam and the Tajik and Kazakh repertoires, so someone arriving through the music finds it among its neighbours. The name is contested too — Uyghurs call it East Turkestan — which is why the label now reads Kashgar.',
  Tibet:
    'East Asia, where a listener would look; culturally and politically distinct from Han China, and Inner Asian framings group it with Central Asia. The label reads Lhasa.',
  Afghanistan:
    'South Asia, following its Hindustani-facing art music; often filed Central Asia or Middle East.',
  Russia:
    'Europe: 27 of the 30 Russian pins are European Russia. Dagestan and Nalchik are Caucasus & Central Asia and Yakutsk is Mongolia & Siberia, assigned per entry.',
  Hawaiʻi:
    'Oceania & Pacific on musical and cultural lineage; it is also a US state, so a listener may reasonably scan North America first. The prototype filed it Latin America & Caribbean, which was simply a bug.',
  Mongolia:
    'Mongolia & Siberia, with Tuva, whose khoomei and long-song repertoire it shares; an East Asian filing is defensible on political geography alone.',
  Sápmi:
    'Europe on geography; Sápmi is a stateless nation across four states and is not a European sub-region in its own telling.',
  'Canary Islands': 'Europe as part of Spain; physically off the African coast.',
  Réunion:
    'Africa as an Indian Ocean island; politically a French department. Mauritius follows it.',
  Somaliland:
    'Africa; noted because the polity is unrecognised, not because the region is in doubt.',
  Kurdistan:
    'Middle East; noted because it is a stateless nation spanning four states. The label reads Diyarbakır.',
  Levant:
    'Middle East; a regional name rather than a state, kept because the tradition is not one country’s.',
};

// A label may name a place. It may not append a sovereign attribution. The
// qualifiers below are the complete allowed exception list — see THE ONE
// EXCEPTION above — and anything else with a comma is a policy violation.
const ALLOWED_QUALIFIED = new Set([
  'Athens, Greece',
  'Athens, Georgia',
  'Birmingham, UK',
  'Birmingham, Alabama',
  'Bristol, UK',
  'Bristol, Tennessee',
  'Jerez, Andalusia',
  'Jerez, Zacatecas',
  'Santiago, Chile',
  'Santiago, Cape Verde',
]);

const stripNote = (s) => s.replace(/\s*\([^)]*\)\s*$/, '').trim();

// Returns an array of problems, empty when the entry is well-formed.
function validateEntry(id, entry) {
  const errs = [];
  if (!Array.isArray(entry) || entry.length !== 4) return [['SHAPE', id]];
  const [lat, lng, place, region] = entry;
  if (typeof lat !== 'number' || Math.abs(lat) > 85) errs.push(['LAT_RANGE', id, String(lat)]);
  if (typeof lng !== 'number' || Math.abs(lng) > 180) errs.push(['LNG_RANGE', id, String(lng)]);
  if (typeof place !== 'string' || !place.trim()) errs.push(['EMPTY_PLACE', id]);
  if (!REGIONS.includes(region)) errs.push(['BAD_REGION', id, String(region)]);
  if (
    typeof place === 'string' &&
    place.indexOf(',') >= 0 &&
    !ALLOWED_QUALIFIED.has(stripNote(place))
  )
    errs.push(['LABEL_NAMES_A_STATE', id, place]);
  return errs;
}

module.exports = { REGIONS, CONTESTED, ALLOWED_QUALIFIED, validateEntry, stripNote };
