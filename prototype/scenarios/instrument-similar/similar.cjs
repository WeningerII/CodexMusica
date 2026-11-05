// Standalone hermetic DOM scenario for #670 row 207; no shell/engine Add/Undo,
// browser layout, actual image delivery or lightbox integration claim.
// node prototype/scenarios/instrument-similar/similar.cjs [--mutations]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { JSDOM } = require('jsdom');
const repo = path.resolve(__dirname, '../../..');
const read = (p) => fs.readFileSync(path.join(repo, p), 'utf8');
const featurePath = 'prototype/features/instrument-similar/similar.js';
let source = read(featurePath);
const mutations = {
  order: [
    'for (const neighbour of record.neighbours)',
    'for (const neighbour of [...record.neighbours].reverse())',
    'production order',
  ],
  stale: [
    'disposed || seq !== generation || snapshot().instrumentActions?.instrumentId !== id',
    'disposed',
    'stale A-B-A',
  ],
  destination: [
    'destination: s.instrumentActions.destination',
    'destination: null',
    'current destination',
  ],
  revision: ['revision: s.revision', 'revision: 0', 'current destination'],
  focus: ['moveFocus && doc.activeElement === status', 'moveFocus', 'Retry does not steal'],
  unsubscribe: ['unsubscribe();', '/* unsubscribe removed */', 'unsubscribes'],
  remote: ['ctx.media.resolve(photo[0])', 'photo[0]', 'remote photo'],
  labels: [
    'neighbour.agreements.join(',
    '[...neighbour.agreements].reverse().join(',
    'production order',
  ],
};
if (process.argv.includes('--mutations')) {
  for (const [name, [, , expected]] of Object.entries(mutations)) {
    const r = spawnSync(process.execPath, [__filename], {
      env: { ...process.env, SIMILAR_MUTATION: name },
      encoding: 'utf8',
      timeout: 30000,
    });
    assert.notEqual(r.status, 0, `${name} escaped`);
    assert.match(
      r.stderr,
      new RegExp(expected),
      `${name} failed for the wrong reason: ${r.stderr}`
    );
    console.log(`REJECTED ${name}: ${expected}`);
  }
  process.exit(0);
}
if (process.env.SIMILAR_MUTATION) {
  const [before, after] = mutations[process.env.SIMILAR_MUTATION];
  assert(source.includes(before), 'mutation must apply');
  source = source.replaceAll(before, after);
}
// Committed fixture projections, captured from production main
// fd16719d46217adc9b57ef939c9497e29e77741c (also inspected on #755 e736f534).
// Producer: src/app.js findSimilarInstruments(id, 6), then
// getMatchingInstrumentAxes(id, neighbour.id, 2).map(m => m.axis.name.toLowerCase()).
// Names/order come from references/02_instruments.js; photos are the unchanged
// tuple shapes from api/instrument_images.json. Listen follows listenHref(name,true).
// Source git blobs:
// app: 18578a05ee3b4e0cf36d59fc733d8894901f4adb
// instruments: 0f67d61306b2a96bd005c7c01e34c52afd70357f
// axis definitions: 2240639fd08b0ae27b2b72c2f0fdecf68be973cd
// photos: d0386633dec52cb64a388adbdbe7ec28382b547f
// Literal remote URL hostnames are openly normalized to inert .test hosts:
// Listen -> listen.test; image -> images.test; attribution -> credits.test;
// the URL embedded in one credit string -> tickets.test.
// Paths, query encoding, other credit/licence text, tuple lengths and nulls are preserved.
// glyphUrl is the same synthetic empty SVG used by the original DOM scenario;
// it proves image/control plumbing, not production glyph rendering.
// This command executes no production functions and reads no production files.
// It verifies the lane against five frozen projections, not current engine parity.
// The earlier 20-check source oracle (all 1,671 instruments) is separate evidence.
const expected = {
  oud: [
    'comorian_gambusi',
    'cobza',
    'acoustic_guitar_dread',
    'acoustic_guitar_om',
    'classical_nylon_string_guitar',
    'rudra_veena',
  ],
  fiddle: [
    'violin_carnatic',
    'violin_orchestral',
    'latfiol',
    'hardanger_fiddle_inst',
    'viola_classical',
    'sorahi',
  ],
  grand_piano: [
    'upright_piano',
    'concert_harp',
    'jazz_trio_piano',
    'tack_piano',
    'steel_orchestra',
    'russian_seven_string_guitar',
  ],
  electric_guitar_humbucker: [
    'electric_guitar_single_coil',
    'baritone_electric',
    'semi_hollow',
    'twelve_string_electric',
    'archtop_jazz',
    'electric_bass',
  ],
  voice: [
    'griot_voice',
    'qawwal_voice',
    'human_voice_ensemble_unspecified',
    'spoken_dramatic_cast',
    'pansori_voice',
    'erhu',
  ],
};
const records = {
  oud: {
    id: 'oud',
    name: 'oud',
    neighbours: [
      {
        id: 'comorian_gambusi',
        name: 'Gambusi (Comorian four-string lute)',
        agreements: ['articulation bandwidth', 'transduction mode'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/5/5c/Shure_SM58.jpg/250px-Shure_SM58.jpg?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=thumbnail',
          'CC BY 2.5 Generic',
          'Iain Fergusson; existing crop by Binksternet, Shure SM58.jpg, Wikimedia Commons, CC BY 2.5 Generic',
          'https://credits.test/wiki/File:Shure_SM58.jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Gambusi%20(Comorian%20four-string%20lute)%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'cobza',
        name: 'Cobza (Romanian lăutari strummed lute)',
        agreements: ['articulation bandwidth', 'transduction mode'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/e/eb/%D0%9C%D0%BE%D0%BB%D0%B4%D0%B0%D0%B2%D1%81%D0%BA%D0%B0%D1%8F_%D0%BA%D0%BE%D0%B1%D0%B7%D0%B0.png/500px-%D0%9C%D0%BE%D0%BB%D0%B4%D0%B0%D0%B2%D1%81%D0%BA%D0%B0%D1%8F_%D0%BA%D0%BE%D0%B1%D0%B7%D0%B0.png',
          'Public domain',
          'Moldovan Post Office',
          'https://credits.test/wiki/File:%D0%9C%D0%BE%D0%BB%D0%B4%D0%B0%D0%B2%D1%81%D0%BA%D0%B0%D1%8F_%D0%BA%D0%BE%D0%B1%D0%B7%D0%B0.png',
          'https://images.test/wikipedia/commons/e/eb/%D0%9C%D0%BE%D0%BB%D0%B4%D0%B0%D0%B2%D1%81%D0%BA%D0%B0%D1%8F_%D0%BA%D0%BE%D0%B1%D0%B7%D0%B0.png',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Cobza%20(Romanian%20l%C4%83utari%20strummed%20lute)%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'acoustic_guitar_dread',
        name: 'Dreadnought acoustic guitar',
        agreements: ['transduction mode', 'sustain capability'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/d/d2/Martin_HD28.jpg/500px-Martin_HD28.jpg',
          'CC BY-SA 2.5',
          'Maxo',
          'https://credits.test/wiki/File:Martin_HD28.jpg',
          'https://images.test/wikipedia/commons/d/d2/Martin_HD28.jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Dreadnought%20acoustic%20guitar%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'acoustic_guitar_om',
        name: 'Orchestra-model acoustic guitar',
        agreements: ['transduction mode', 'sustain capability'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/a/ad/Steel-string_acoustic_guitars_%282014-08-29_17.51.34_by_sbaimo%29.jpg/330px-Steel-string_acoustic_guitars_%282014-08-29_17.51.34_by_sbaimo%29.jpg',
          'CC BY 2.0',
          'sbaimo from United States',
          'https://credits.test/wiki/File:Steel-string_acoustic_guitars_(2014-08-29_17.51.34_by_sbaimo).jpg',
          'https://images.test/wikipedia/commons/a/ad/Steel-string_acoustic_guitars_%282014-08-29_17.51.34_by_sbaimo%29.jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Orchestra-model%20acoustic%20guitar%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'classical_nylon_string_guitar',
        name: 'Classical guitar',
        agreements: ['articulation bandwidth', 'transduction mode'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/e/e8/Classical_Guitar_two_views.jpg/500px-Classical_Guitar_two_views.jpg',
          'CC BY-SA 2.0 de',
          'Martin Möller',
          'https://credits.test/wiki/File:Classical_Guitar_two_views.jpg',
          'https://images.test/wikipedia/commons/e/e8/Classical_Guitar_two_views.jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Classical%20guitar%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'rudra_veena',
        name: 'Rudra vīṇā (dhrupad bin)',
        agreements: ['articulation bandwidth', 'transduction mode'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/a/ad/Rudraveena1.JPG/500px-Rudraveena1.JPG',
          'CC BY-SA 3.0',
          'Fotokannan',
          'https://credits.test/wiki/File:Rudraveena1.JPG',
          'https://images.test/wikipedia/commons/a/ad/Rudraveena1.JPG',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Rudra%20v%C4%AB%E1%B9%87%C4%81%20(dhrupad%20bin)%20musical%20instrument%20solo%20demonstration',
      },
    ],
  },
  fiddle: {
    id: 'fiddle',
    name: 'fiddle',
    neighbours: [
      {
        id: 'violin_carnatic',
        name: 'Violin (Carnatic tuning)',
        agreements: ['pitch-fixedness', 'sustain capability'],
        photo: [
          'https://media.test/CRDImages/mi/web-large/DP163308.jpg',
          'Public Domain (Met Open Access, CC0)',
          'The Metropolitan Museum of Art, Purchase, Clara Mertens Bequest, in memory of André Mertens, 1992',
          'https://media.test/art/collection/search/503443',
          'https://media.test/CRDImages/mi/original/DP163308.jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Violin%20(Carnatic%20tuning)%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'violin_orchestral',
        name: 'Orchestral violin',
        agreements: ['pitch-fixedness', 'sustain capability'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/1/1b/Violin_VL100.png/500px-Violin_VL100.png',
          'CC0',
          'Just plain Bill',
          'https://credits.test/wiki/File:Violin_VL100.png',
          'https://images.test/wikipedia/commons/1/1b/Violin_VL100.png',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Orchestral%20violin%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'latfiol',
        name: 'Låtfiol (Swedish revival fiddle with sympathetic strings)',
        agreements: ['pitch-fixedness', 'sustain capability'],
        photo: [
          'https://images.test/wikipedia/commons/e/eb/Michaelkinglatfiol.jpg',
          'Public domain',
          'Michael King',
          'https://credits.test/wiki/File:Michaelkinglatfiol.jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=L%C3%A5tfiol%20(Swedish%20revival%20fiddle%20with%20sympathetic%20strings)%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'hardanger_fiddle_inst',
        name: 'Hardingfele (Hardanger fiddle)',
        agreements: ['pitch-fixedness', 'sustain capability'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/e/eb/Midt.jpg/500px-Midt.jpg',
          'CC BY-SA 3.0',
          'Frode Inge Helland',
          'https://credits.test/wiki/File:Midt.jpg',
          'https://images.test/wikipedia/commons/e/eb/Midt.jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Hardingfele%20(Hardanger%20fiddle)%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'viola_classical',
        name: 'Viola (orchestral alto)',
        agreements: ['pitch-fixedness', 'sustain capability'],
        photo: [
          'https://media.test/CRDImages/mi/web-large/DP-37178-001.jpg',
          'Public Domain (Met Open Access, CC0)',
          'The Metropolitan Museum of Art, Gift of Dorothy and Robert Rosenbaum, 1979',
          'https://media.test/art/collection/search/503931',
          'https://media.test/CRDImages/mi/original/DP-37178-001.jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Viola%20(orchestral%20alto)%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'sorahi',
        name: 'Sorahi (Shajarian-designed Persian bowed spike fiddle)',
        agreements: ['pitch-fixedness', 'sustain capability'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/3/31/2_Kam%C4%81nches%2C_Persia%2C_ca._1880.jpg/500px-2_Kam%C4%81nches%2C_Persia%2C_ca._1880.jpg',
          'CC0',
          'Unnamed; released by the Metropolitan Museum of Art into the public domain.',
          'https://credits.test/wiki/File:2_Kam%C4%81nches%2C_Persia%2C_ca._1880.jpg',
          'https://images.test/wikipedia/commons/3/31/2_Kam%C4%81nches%2C_Persia%2C_ca._1880.jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Sorahi%20(Shajarian-designed%20Persian%20bowed%20spike%20fiddle)%20musical%20instrument%20solo%20demonstration',
      },
    ],
  },
  grand_piano: {
    id: 'grand_piano',
    name: 'grand_piano',
    neighbours: [
      {
        id: 'upright_piano',
        name: 'Upright piano',
        agreements: ['pitch-fixedness', 'concurrent-voice capacity'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/d/da/Steinway_%26_Sons_upright_piano%2C_model_K-132%2C_manufactured_at_Steinway%27s_factory_in_Hamburg%2C_Germany.png/500px-Steinway_%26_Sons_upright_piano%2C_model_K-132%2C_manufactured_at_Steinway%27s_factory_in_Hamburg%2C_Germany.png',
          'CC BY-SA 3.0',
          'Steinway &amp; Sons, 10 Rondenbarg, Hamburg D-22525, Germany, eu.steinway.com.Steinway &amp; Sons, 1 Steinway Place, Long Island City, New York 11105, The United States, www.steinway.com.',
          'https://credits.test/wiki/File:Steinway_%26_Sons_upright_piano,_model_K-132,_manufactured_at_Steinway%27s_factory_in_Hamburg,_Germany.png',
          'https://images.test/wikipedia/commons/d/da/Steinway_%26_Sons_upright_piano%2C_model_K-132%2C_manufactured_at_Steinway%27s_factory_in_Hamburg%2C_Germany.png',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Upright%20piano%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'concert_harp',
        name: 'Concert pedal harp',
        agreements: ['pitch-fixedness', 'concurrent-voice capacity'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/7/7d/Salvi_harp_Diana.jpg/500px-Salvi_harp_Diana.jpg',
          'CC BY-SA 4.0',
          'N.S.M. s.p.a.',
          'https://credits.test/wiki/File:Salvi_harp_Diana.jpg',
          'https://images.test/wikipedia/commons/7/7d/Salvi_harp_Diana.jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Concert%20pedal%20harp%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'jazz_trio_piano',
        name: 'Piano trio (jazz)',
        agreements: ['concurrent-voice capacity', 'range breadth'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/f/f9/ALIMI_TRIO_JAZZ_Photos_sc%C3%A8ne_11.10.2014..jpg/330px-ALIMI_TRIO_JAZZ_Photos_sc%C3%A8ne_11.10.2014..jpg',
          'CC BY-SA 4.0',
          'Alimijeanpaul',
          'https://credits.test/wiki/File:ALIMI_TRIO_JAZZ_Photos_sc%C3%A8ne_11.10.2014..jpg',
          'https://images.test/wikipedia/commons/f/f9/ALIMI_TRIO_JAZZ_Photos_sc%C3%A8ne_11.10.2014..jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Piano%20trio%20(jazz)%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'tack_piano',
        name: 'Tack piano (modified upright)',
        agreements: ['pitch-fixedness', 'concurrent-voice capacity'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/c/cd/Pinezki-K.WasilewskiSka.jpg/330px-Pinezki-K.WasilewskiSka.jpg',
          'Public domain',
          'Julo',
          'https://credits.test/wiki/File:Pinezki-K.WasilewskiSka.jpg',
          'https://images.test/wikipedia/commons/c/cd/Pinezki-K.WasilewskiSka.jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Tack%20piano%20(modified%20upright)%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'steel_orchestra',
        name: 'Steel band (Trinidadian steel orchestra)',
        agreements: ['pitch-fixedness', 'concurrent-voice capacity'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/8/80/Calypso_Steel_Band_Norway.jpg/500px-Calypso_Steel_Band_Norway.jpg',
          'CC BY-SA 4.0',
          'See VTRS Ticket#2023020610013491 https://tickets.test/otrs/index.pl?Action=AgentTicketZoom;TicketID=12670577#Article15658676',
          'https://credits.test/wiki/File:Calypso_Steel_Band_Norway.jpg',
          'https://images.test/wikipedia/commons/8/80/Calypso_Steel_Band_Norway.jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Steel%20band%20(Trinidadian%20steel%20orchestra)%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'russian_seven_string_guitar',
        name: 'Russian seven-string guitar',
        agreements: ['concurrent-voice capacity', 'transduction mode'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/5/5c/Shure_SM58.jpg/250px-Shure_SM58.jpg?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=thumbnail',
          'CC BY 2.5 Generic',
          'Iain Fergusson; existing crop by Binksternet, Shure SM58.jpg, Wikimedia Commons, CC BY 2.5 Generic',
          'https://credits.test/wiki/File:Shure_SM58.jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Russian%20seven-string%20guitar%20musical%20instrument%20solo%20demonstration',
      },
    ],
  },
  electric_guitar_humbucker: {
    id: 'electric_guitar_humbucker',
    name: 'electric_guitar_humbucker',
    neighbours: [
      {
        id: 'electric_guitar_single_coil',
        name: 'Solid-body electric guitar with single-coil pickups',
        agreements: ['articulation bandwidth', 'concurrent-voice capacity'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/2/24/Strat_s%C3%A9rie_L.jpg/330px-Strat_s%C3%A9rie_L.jpg',
          'CC BY-SA 4.0',
          'A.potelle',
          'https://credits.test/wiki/File:Strat_s%C3%A9rie_L.jpg',
          'https://images.test/wikipedia/commons/2/24/Strat_s%C3%A9rie_L.jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Solid-body%20electric%20guitar%20with%20single-coil%20pickups%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'baritone_electric',
        name: 'Baritone electric guitar',
        agreements: ['articulation bandwidth', 'concurrent-voice capacity'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/7/78/Fender_baritone_custom.jpg/500px-Fender_baritone_custom.jpg',
          'CC BY-SA 3.0',
          'Andrewa at en.wikipedia',
          'https://credits.test/wiki/File:Fender_baritone_custom.jpg',
          'https://images.test/wikipedia/commons/7/78/Fender_baritone_custom.jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Baritone%20electric%20guitar%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'semi_hollow',
        name: 'Semi-hollow electric guitar',
        agreements: ['articulation bandwidth', 'concurrent-voice capacity'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/d/db/GMFT3-2_piles_of_semi-hollow_bodies%2C_in_work_in_process.jpg/500px-GMFT3-2_piles_of_semi-hollow_bodies%2C_in_work_in_process.jpg',
          'CC BY 2.0',
          'Lindsey Turner',
          'https://credits.test/wiki/File:GMFT3-2_piles_of_semi-hollow_bodies,_in_work_in_process.jpg',
          'https://images.test/wikipedia/commons/d/db/GMFT3-2_piles_of_semi-hollow_bodies%2C_in_work_in_process.jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Semi-hollow%20electric%20guitar%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'twelve_string_electric',
        name: 'Twelve-string electric guitar',
        agreements: ['concurrent-voice capacity', 'range breadth'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/f/f2/1967_Rickenbacker_360-12_12_string_electric_guitar_owned_and_photographed_by_Greg_Field.jpg/500px-1967_Rickenbacker_360-12_12_string_electric_guitar_owned_and_photographed_by_Greg_Field.jpg',
          'CC BY-SA 3.0',
          'Outerrealm',
          'https://credits.test/wiki/File:1967_Rickenbacker_360-12_12_string_electric_guitar_owned_and_photographed_by_Greg_Field.jpg',
          'https://images.test/wikipedia/commons/f/f2/1967_Rickenbacker_360-12_12_string_electric_guitar_owned_and_photographed_by_Greg_Field.jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Twelve-string%20electric%20guitar%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'archtop_jazz',
        name: 'Archtop jazz guitar',
        agreements: ['articulation bandwidth', 'concurrent-voice capacity'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/9/9d/Gibson_ES-150.png/500px-Gibson_ES-150.png',
          'CC BY-SA 2.5',
          'Thomas Despoix',
          'https://credits.test/wiki/File:Gibson_ES-150.png',
          'https://images.test/wikipedia/commons/9/9d/Gibson_ES-150.png',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Archtop%20jazz%20guitar%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'electric_bass',
        name: 'Solid-body electric bass',
        agreements: ['articulation bandwidth', 'range breadth'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/9/9b/Rob_Allen_Solid_4_Electric_Bass_Guitar_%288308114913%29.jpg/500px-Rob_Allen_Solid_4_Electric_Bass_Guitar_%288308114913%29.jpg',
          'CC BY 2.0',
          'Ethan Prater from San Bruno, CA, USA',
          'https://credits.test/wiki/File:Rob_Allen_Solid_4_Electric_Bass_Guitar_(8308114913).jpg',
          'https://images.test/wikipedia/commons/9/9b/Rob_Allen_Solid_4_Electric_Bass_Guitar_%288308114913%29.jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Solid-body%20electric%20bass%20musical%20instrument%20solo%20demonstration',
      },
    ],
  },
  voice: {
    id: 'voice',
    name: 'voice',
    neighbours: [
      {
        id: 'griot_voice',
        name: 'Griot / jeli voice',
        agreements: ['pitch-fixedness', 'sustain capability'],
        photo: [
          'https://images.test/wikipedia/commons/d/df/GriotF%C3%AAte.jpg',
          'Public domain',
          'Jeanniot (grav.)',
          'https://credits.test/wiki/File:GriotF%C3%AAte.jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Griot%20%2F%20jeli%20voice%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'qawwal_voice',
        name: 'Qawwal lead voice',
        agreements: ['pitch-fixedness', 'sustain capability'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/6/63/Qawalli_at_Ajmer_Sharif_dargah.jpg/330px-Qawalli_at_Ajmer_Sharif_dargah.jpg',
          'CC BY-SA 4.0',
          'Saswat swarup mishra',
          'https://credits.test/wiki/File:Qawalli_at_Ajmer_Sharif_dargah.jpg',
          'https://images.test/wikipedia/commons/6/63/Qawalli_at_Ajmer_Sharif_dargah.jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Qawwal%20lead%20voice%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'human_voice_ensemble_unspecified',
        name: 'Human voice — source-unspecified ensemble and tracking',
        agreements: ['pitch-fixedness', 'sustain capability'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/5/5c/Shure_SM58.jpg/250px-Shure_SM58.jpg?utm_campaign=index&utm_content=thumbnail&utm_source=commons.wikimedia.org',
          'CC BY 2.5 Generic',
          'Iain Fergusson; existing crop by Binksternet, Shure SM58.jpg, Wikimedia Commons, CC BY 2.5 Generic',
          'https://credits.test/wiki/File:Shure_SM58.jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Human%20voice%20%E2%80%94%20source-unspecified%20ensemble%20and%20tracking%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'spoken_dramatic_cast',
        name: 'Spoken dramatic cast',
        agreements: ['pitch-fixedness', 'sustain capability'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/5/5c/Shure_SM58.jpg/250px-Shure_SM58.jpg?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=thumbnail',
          'CC BY 2.5 Generic',
          'Iain Fergusson; existing crop by Binksternet, Shure SM58.jpg, Wikimedia Commons, CC BY 2.5 Generic',
          'https://credits.test/wiki/File:Shure_SM58.jpg',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Spoken%20dramatic%20cast%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'pansori_voice',
        name: 'Pansori voice (rough-pressed seongeum mechanism, Korean narrative-song tradition)',
        agreements: ['pitch-fixedness', 'sustain capability'],
        photo: [
          'https://media.test/wikipedia/commons/thumb/6/6a/Korea-Busan_3404-06_Pansori.JPG/330px-Korea-Busan_3404-06_Pansori.JPG',
          'CC BY-SA 3.0',
          'Steve46814',
          'https://credits.test/wiki/File:Korea-Busan_3404-06_Pansori.JPG',
          'https://images.test/wikipedia/commons/6/6a/Korea-Busan_3404-06_Pansori.JPG',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Pansori%20voice%20(rough-pressed%20seongeum%20mechanism%2C%20Korean%20narrative-song%20tradition)%20musical%20instrument%20solo%20demonstration',
      },
      {
        id: 'erhu',
        name: 'Erhu (Chinese two-string fiddle)',
        agreements: ['pitch-fixedness', 'sustain capability'],
        photo: [
          'https://images.test/wikipedia/commons/d/da/Erhu.png',
          'Public domain',
          'LDHan',
          'https://credits.test/wiki/File:Erhu.png',
        ],
        glyphUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3C%2Fsvg%3E',
        listenHref:
          'https://listen.test/results?search_query=Erhu%20(Chinese%20two-string%20fiddle)%20musical%20instrument%20solo%20demonstration',
      },
    ],
  },
};
for (const [id, ids] of Object.entries(expected)) {
  assert.deepEqual(
    records[id].neighbours.map((n) => n.id),
    ids,
    `pinned fixture ${id}`
  );
}
assert.deepEqual(records.oud.neighbours[0].agreements, [
  'articulation bandwidth',
  'transduction mode',
]);
const freeze = (x) => {
  if (x && typeof x === 'object') {
    Object.values(x).forEach(freeze);
    Object.freeze(x);
  }
  return x;
};
Object.values(records).forEach(freeze);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
let count = 0;
async function check(name, fn) {
  try {
    await fn();
    count++;
    console.log(`PASS ${name}`);
  } catch (e) {
    throw new Error(`${name}: ${e.message}`, { cause: e });
  }
}
function harness(record = records.oud, aborted = false) {
  const dom = new JSDOM('<button id="outside">Outside</button><div id="host"></div>', {
    url: 'https://fixture.test/prototype/',
    runScripts: 'outside-only',
  });
  const w = dom.window,
    doc = w.document,
    host = doc.getElementById('host');
  const signal = new w.AbortController();
  if (aborted) signal.abort();
  let state = freeze({
    status: 'ready',
    busy: false,
    revision: 1,
    instrumentActions: {
      instrumentId: record?.id || null,
      status: 'ready',
      destination: 'bluegrass',
      previewRevision: 4,
    },
  });
  const subscriptions = new Set(),
    requests = [],
    adds = [],
    opens = [],
    mediaCalls = [],
    announced = [];
  let loader = (id) => Promise.resolve(records[id] || record);
  const ctx = Object.freeze({
    signal: signal.signal,
    announce: (x) => announced.push(x),
    recipe: Object.freeze({
      snapshot: () => state,
      subscribe: (fn) => {
        subscriptions.add(fn);
        return () => subscriptions.delete(fn);
      },
      addInstrument: (x) => {
        adds.push(x);
        return Promise.resolve({ snapshot: state, placed: 'grouped' });
      },
    }),
    loadInstrumentSimilar: (id, options) => {
      requests.push({ id, ...options });
      return loader(id, options);
    },
    openInstrument: (id, options) => {
      opens.push({ id, ...options });
      return Promise.resolve();
    },
    media: Object.freeze({
      resolve: (x) => (typeof x === 'string' && x.startsWith('../assets/') ? x : null),
    }),
    openPhoto: (photo, options) => {
      mediaCalls.push({ photo, ...options });
    },
  });
  // Module syntax/URL adaptation only; every executable feature function is
  // evaluated unchanged in the DOM realm, with its own AbortController.
  w.eval(
    source
      .replace('export function mount', 'function mount')
      .replaceAll('import.meta.url', JSON.stringify('https://fixture.test/' + featurePath)) +
      '\nglobalThis.featureMount=mount;'
  );
  const api = w.featureMount(host, ctx);
  return {
    w,
    doc,
    host,
    api,
    signal,
    subscriptions,
    requests,
    adds,
    opens,
    mediaCalls,
    announced,
    loader: (fn) => {
      loader = fn;
    },
    emit: (patch) => {
      state = freeze({
        ...state,
        ...patch,
        instrumentActions: { ...state.instrumentActions, ...patch.instrumentActions },
      });
      for (const fn of subscriptions) fn();
    },
    buttons: () => [...host.querySelectorAll('.instrument-similar-open')],
    close: () => {
      api.unmount();
      dom.window.close();
    },
    state: () => state,
  };
}
(async () => {
  let h = harness();
  await tick();
  await check('production order and two lowercase labels for five fixtures', async () => {
    for (const [id, record] of Object.entries(records)) {
      h.emit({ instrumentActions: { instrumentId: id } });
      await tick();
      assert.deepEqual(
        h.buttons().map((x) => x.firstElementChild.textContent),
        record.neighbours.map((n) => n.name)
      );
      assert.deepEqual(
        [...h.host.querySelectorAll('.instrument-similar-agreements')].map((x) => x.textContent),
        record.neighbours.map((n) => 'Closest on ' + n.agreements.join(', '))
      );
    }
  });
  h.emit({ instrumentActions: { instrumentId: 'oud' } });
  await tick();
  await check('self-loaded scoped CSS and semantic section/list', () => {
    assert(h.host.querySelector('link').href.endsWith('/instrument-similar/similar.css'));
    assert.equal(h.host.querySelector('section').getAttribute('aria-label'), 'Similar instruments');
    assert.equal(h.host.querySelector('ul').getAttribute('role'), 'list');
  });
  await check(
    'current destination and revision, no preview mutation or focus stealing',
    async () => {
      h.emit({ revision: 17, instrumentActions: { destination: 'tarab', previewRevision: 80 } });
      await tick();
      const add = h.host.querySelector('li').lastElementChild;
      add.focus();
      add.click();
      await tick();
      assert.deepEqual(JSON.parse(JSON.stringify(h.adds.at(-1))), {
        instrumentId: expected.oud[0],
        destination: 'tarab',
        revision: 17,
      });
      assert.equal(h.doc.activeElement, add);
      assert.equal(h.announced.length, 0);
    }
  );
  await check('Similar navigation carries current origin and preview revision', async () => {
    const b = h.buttons()[0];
    b.click();
    await tick();
    const x = h.opens.at(-1);
    assert.equal(x.id, expected.oud[0]);
    assert.equal(x.fromInstrumentId, 'oud');
    assert.equal(x.previewRevision, 80);
    assert.equal(x.similar, true);
    assert.equal(x.returnFocus, b);
  });
  await check('recipe busy blocks controls; preview busy blocks inspect only', async () => {
    const before = h.adds.length;
    h.emit({ busy: true });
    h.host.querySelector('li').lastElementChild.click();
    await tick();
    assert.equal(h.adds.length, before);
    h.emit({ busy: false, instrumentActions: { status: 'loading' } });
    await tick();
    assert(h.buttons()[0].disabled);
    assert(!h.host.querySelector('li').lastElementChild.disabled);
    h.emit({ instrumentActions: { status: 'ready' } });
    await tick();
  });
  await check('native Listen destination and security attributes', () => {
    const a = h.host.querySelector('li a');
    assert.equal(a.href, records.oud.neighbours[0].listenHref);
    assert.equal(a.target, '_blank');
    assert.equal(a.rel, 'noopener noreferrer');
  });
  await check('remote photo never bypasses media resolver; no unavailable credit', () => {
    assert([...h.host.querySelectorAll('img')].every((x) => !x.src.startsWith('https://')));
    assert([...h.host.querySelectorAll('.instrument-similar-credit')].every((x) => x.hidden));
  });
  await check('media arrival/failure preserves nodes, focus, callback and credit', async () => {
    const row = h.host.querySelector('li'),
      open = h.buttons()[0],
      media = row.firstElementChild,
      img = media.firstElementChild;
    const photo = [
      '../assets/test/local.svg',
      'CC BY 4.0',
      'Fixture author',
      'https://example.test/source',
    ];
    const changed = {
      ...records.oud,
      neighbours: records.oud.neighbours.map((n, i) => (i ? n : { ...n, photo })),
    };
    open.focus();
    h.loader(() => Promise.resolve(freeze(changed)));
    h.emit({ revision: 18 });
    await tick();
    assert.equal(h.host.querySelector('li'), row);
    assert.equal(h.buttons()[0], open);
    assert.equal(media.firstElementChild, img);
    assert.equal(h.doc.activeElement, open);
    img.dispatchEvent(new h.w.Event('load'));
    assert.equal(
      row.querySelector('.instrument-similar-credit').textContent,
      'Photo: Fixture author · CC BY 4.0'
    );
    media.focus();
    media.click();
    await tick();
    assert.equal(h.mediaCalls.at(-1).photo, photo);
    assert.equal(h.mediaCalls.at(-1).returnFocus, media);
    img.dispatchEvent(new h.w.Event('error'));
    assert.equal(h.doc.activeElement, media);
    assert(row.querySelector('.instrument-similar-credit').hidden);
    assert(img.src.startsWith('data:image/svg+xml'));
    const calls = h.mediaCalls.length;
    media.click();
    await tick();
    assert.equal(h.mediaCalls.length, calls);
  });
  h.close();
  h = harness();
  await tick();
  await check('stale A-B-A responses cannot replace latest list', async () => {
    const a = deferred(),
      b = deferred(),
      last = deferred();
    let n = 0;
    h.loader(() => [a, b, last][n++].promise);
    h.emit({ revision: 2 });
    h.emit({ instrumentActions: { instrumentId: 'fiddle' } });
    h.emit({ instrumentActions: { instrumentId: 'oud' } });
    assert(h.requests.at(-3).signal.aborted);
    assert(h.requests.at(-2).signal.aborted);
    last.resolve(records.oud);
    await tick();
    b.resolve(records.fiddle);
    a.resolve({ ...records.oud, neighbours: [] });
    await tick();
    assert.equal(h.buttons().length, 6);
    assert.equal(h.buttons()[0].firstElementChild.textContent, records.oud.neighbours[0].name);
  });
  async function fail() {
    h.loader(() =>
      Promise.reject(Object.assign(new Error('raw internal text'), { code: 'LOAD_FAILED' }))
    );
    h.emit({ revision: h.state().revision + 1 });
    await tick();
  }
  await fail();
  await check('loader failure uses exact Instrument sentence and only lane Retry', () => {
    assert.equal(
      h.host.querySelector('[role=status]').textContent,
      'This instrument’s details couldn’t load. Try again.'
    );
    assert.equal(
      [...h.host.querySelectorAll('button')].filter((x) => x.textContent === 'Retry' && !x.hidden)
        .length,
      1
    );
  });
  await check(
    'Retry success focuses first neighbour; host update cannot cancel focus intent',
    async () => {
      const d = deferred();
      h.loader(() => d.promise);
      h.host.querySelector('section > button').click();
      const request = h.requests.at(-1);
      h.emit({ revision: 31 });
      assert.equal(h.requests.at(-1), request);
      d.resolve(records.oud);
      await tick();
      assert.equal(h.doc.activeElement, h.buttons()[0]);
    }
  );
  await fail();
  await check('Retry does not steal focus after user leaves lane', async () => {
    const d = deferred();
    h.loader(() => d.promise);
    h.host.querySelector('section > button').click();
    h.doc.getElementById('outside').focus();
    d.resolve(records.oud);
    await tick();
    assert.equal(h.doc.activeElement.id, 'outside');
  });
  await fail();
  await check('repeated Retry failure focuses Retry', async () => {
    h.host.querySelector('section > button').click();
    await tick();
    assert.equal(h.doc.activeElement, h.host.querySelector('section > button'));
  });
  await check('empty Retry success preserves empty heading/list and focuses heading', async () => {
    h.loader(() => Promise.resolve({ ...records.oud, neighbours: [] }));
    h.host.querySelector('section > button').click();
    await tick();
    assert.equal(h.buttons().length, 0);
    assert(h.host.querySelector('h3'));
    assert(h.host.querySelector('ul'));
    assert.equal(h.doc.activeElement, h.host.querySelector('h3'));
    assert.equal(h.host.querySelector('[role=status]').textContent, '');
  });
  await fail();
  await check(
    'Retry finishing while busy focuses visible heading instead of disabled control',
    async () => {
      const d = deferred();
      h.loader(() => d.promise);
      h.host.querySelector('section > button').click();
      h.emit({ busy: true });
      d.resolve(records.oud);
      await tick();
      assert.equal(h.doc.activeElement, h.host.querySelector('h3'));
      assert(h.buttons()[0].disabled);
      h.emit({ busy: false });
      await tick();
    }
  );
  await fail();
  await check('selection clears pending Retry and prevents late focus', async () => {
    const d = deferred();
    h.loader(() => d.promise);
    h.host.querySelector('section > button').click();
    h.emit({ instrumentActions: { instrumentId: null } });
    h.doc.getElementById('outside').focus();
    d.resolve(records.oud);
    await tick();
    assert.equal(h.buttons().length, 0);
    assert.equal(h.doc.activeElement.id, 'outside');
    assert.equal(h.host.querySelector('[role=status]').textContent, 'Select an instrument');
  });
  await check('NOT_FOUND uses exact sentence and Retry without invented diagnosis', async () => {
    h.loader(() => Promise.reject(Object.assign(new Error('x'), { code: 'NOT_FOUND' })));
    h.emit({ instrumentActions: { instrumentId: 'invalid' } });
    await tick();
    assert.equal(
      h.host.querySelector('[role=status]').textContent,
      'This instrument isn’t in the catalog’s data. Select another instrument.'
    );
    assert(!h.host.querySelector('section > button').hidden);
  });
  await check('unmount aborts wait, unsubscribes, removes CSS and ignores completion', async () => {
    const d = deferred();
    h.loader(() => d.promise);
    h.host.querySelector('section > button').click();
    const req = h.requests.at(-1);
    h.api.unmount();
    h.api.unmount();
    assert(req.signal.aborted);
    assert.equal(h.subscriptions.size, 0);
    d.resolve(records.oud);
    await tick();
    assert.equal(h.host.children.length, 0);
  });
  h.close();
  await check('already aborted mount is inert', async () => {
    const x = harness(records.oud, true);
    await tick();
    assert.equal(x.host.children.length, 0);
    assert.equal(x.subscriptions.size, 0);
    assert.equal(x.requests.length, 0);
    x.close();
  });
  console.log(
    `${count} checks passed; five pinned catalog projections. DOM only; commands and media delivery stubbed.`
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
