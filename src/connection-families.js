// THE DISPLAY FAMILY OF EACH CONNECTION METHOD, BY STABLE ID (#637 6545593976,
// item 7 of 6547009973). A family is how the views colour and group a method;
// it is not its native structure and not its prohibition wording, which stay
// on the registry record. Keyed by id so a renamed method keeps its family:
// a name is a label (AGENTS.md, name-isolation). A method absent here has no
// agreed visual family and is shown as native bindings only.
/* exported CONNECTION_FAMILIES */
/* global module */
const CONNECTION_FAMILIES = Object.freeze({
  'schema:4ee209d91502755b4c725c2c': 'rhyme', // additive rhyme
  'schema:85d0a9d89593c874a7ac0fab': 'alliteration', // alliteration
  'schema:09d97e7804132dfcb2bc1522': 'rhyme', // amphisbaenic rhyme
  'schema:c6f237b95f5c25155a209dc7': 'rhyme', // analysed rhyme
  'schema:7efd06d89cf6b0bacdb2f95a': 'rhyme', // apocopated rhyme
  'schema:3b8ac9eeba200f3c57504c92': 'assonance', // assonance
  'schema:d2d6d4dcaa1ed4c96915eb60': 'rhyme', // broken rhyme
  'schema:34cc0118709d1859e4d4bb2b': 'rhyme', // chain rhyme (interlocking scheme)
  'schema:aedcb1bf99e9f7db0a2ee56a': 'rhyme', // chain rhyme (rap)
  'schema:d89344d3444e3c2d3eb07c5c': 'consonance', // cluster consonance / skothending span
  'shared_sound:36c0bdd528d21a18a0750102': 'consonance', // coda@v1
  'schema:49e6867b361b214f8ab1dee4': 'rhyme', // compound / phrasal rhyme
  'schema:d0c59df91e344dfdedb05f20': 'consonance', // consonance
  'schema:aa1e0b430f78c2fa967e3a41': 'rhyme', // cross rhyme
  'schema:e4bf0a70acc63f4da8db52e4': 'rhyme', // dialect rhyme
  'schema:5685af112590fd32d19b21e9': 'rhyme', // enjambed rhyme
  'schema:afd6a3122d2583784c337b6d': 'rhyme', // eye rhyme
  'schema:4729f888065eb2134d611d75': 'rhyme', // family rhyme
  'schema:e4c81bbec2065247b6cd1b3f': 'rhyme', // head rhyme (positional)
  'schema:81d485c4c6d7120e8a12b9e1': 'rhyme', // historical rhyme
  'schema:775a813f6f2e2d3c59ec8de2': 'rhyme', // holorhyme
  'schema:56f33f8ae8e67eea7323fa72': 'rhyme', // interlaced rhyme
  'schema:ea429261a9c6fd4c6558b965': 'assonance', // internal assonance
  'schema:d805364d391422f4eeb8b91c': 'consonance', // internal consonance
  'schema:1429ae948687ca75ce1cebde': 'rhyme', // internal rhyme
  'schema:878961d0ea79b2aebc47abbe': 'rhyme', // leonine rhyme
  'schema:548889fbd0162710b512b63a': 'rhyme', // light rhyme
  'schema:453e80811a8b51749a2f44d9': 'rhyme', // linked rhyme
  'schema:ebfca4d4c71dfc705cfcbb4d': 'rhyme', // Middle Chinese end rhyme (同用 group)
  'schema:653e10d22b27be91bf3a22c2': 'rhyme', // monorhyme / leash
  'schema:437ea75b47c47680684cd73a': 'rhyme', // mosaic rhyme
  'schema:991f9c38b0ce9ed3a9e92b4d': 'rhyme', // multisyllabic rhyme
  'schema:1e618ba2871bb8aea84ea765': 'rhyme', // offbeat internal rhyme
  'shared_sound:5501158800570050e3c814ef': 'alliteration', // onset@v1
  'schema:62f48d423f3d95f13cf3d3f5': 'rhyme', // pararhyme
  'schema:7d37abf7e6143b3d21f7bf98': 'consonance', // parechesis / general consonance
  'schema:fd8899c7df3627b14d717d01': 'rhyme', // perfect rhyme
  'schema:bb44043db7e97123d5c11241': 'rhyme', // reverse rhyme
  'schema:994164efee46da419dc7b505': 'rhyme', // Scots vowel-length rhyme (Aitken's Law)
  'schema:c6a94a029d113625f4368209': 'rhyme', // semirhyme
  'shared_sound:537bd32865cbd4127598d038': 'alliteration', // stressed_onset@v1
  'schema:c3e0632f9680ae62400cfeca': 'rhyme', // subtractive rhyme
  'schema:db6a3aa4d90bfe7f6c28f817': 'rhyme', // sung-delivery rhyme
  'schema:1bc0e774d8c9a0e7e091c042': 'rhyme', // syllabic rhyme
  'schema:8ccd66a90da0cd797d67a344': 'rhyme', // transformative / bent rhyme
  'schema:9fb03ec150fcd70d4aebfc55': 'rhyme', // trite rhyme
  'shared_sound:ffdfe1a5e8803b0ed1cb8759': 'assonance', // vowel@v1
  'schema:fec49e7b83fc13743feba016': 'rhyme', // wrenched rhyme
});
if (typeof module !== 'undefined' && module.exports) module.exports = { CONNECTION_FAMILIES };
