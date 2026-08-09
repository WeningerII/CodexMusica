// scripts/_merge.js — the family-parts merge, authored ONCE.
//
// Each instrument inherits its family's parts. Per-instrument parts with the
// same id as a family part REPLACE the family version (full override). Family
// variants that declare `applies_to: [...]` are filtered to the listed
// instrument ids, letting a family part hold instrument-specific vocabulary
// without per-instrument authoring.
//
// Two own-part modes:
//   1. FULL OVERRIDE — own-part has a `variants` array; the family-part is
//      skipped and the own-part is used as authored.
//   2. ANNOTATION — own-part has no `variants`, only metadata such as
//      `default_variant: 'variant_id'`; the family-part is inherited and the
//      named variant is marked default for this instrument's view.
//
// The merge is non-destructive — original parts are preserved under
// inst._ownParts; the merged list replaces inst.parts so consumers see it.
//
// This function is used in two contexts, and is the single source of truth for
// both so the CLI engine and the shipped browser app compute identical parts:
//   - Node    : scripts/_loader.js calls mergeFamilyParts(INSTRUMENTS, INSTRUMENT_FAMILY_PARTS)
//   - Browser : scripts/build_html.js inlines the marked function into codex.html
'use strict';

/* @inline-start — the region between the markers is inlined verbatim into codex.html */
function mergeFamilyParts(instruments, familyParts) {
  familyParts = familyParts || {};
  for (const inst of instruments || []) {
    const ownParts = Array.isArray(inst.parts) ? inst.parts : [];
    inst._ownParts = ownParts;
    const fParts = familyParts[inst.family] || [];
    // An instrument may opt OUT of specific family parts it would otherwise
    // inherit — e.g. drum_kit excludes the generic `percussion_technique`
    // because its own `drum_technique` is a strict superset. Listed ids are
    // simply skipped during the merge (the part stays available to every other
    // instrument in the family).
    const excludeFamilyIds = new Set(
      Array.isArray(inst.exclude_family_parts) ? inst.exclude_family_parts : []
    );
    if (fParts.length === 0) {
      inst.parts = ownParts;
      continue;
    }
    const fullOverrideIds = new Set();
    const annotations = {};
    for (const op of ownParts) {
      if (Array.isArray(op.variants)) fullOverrideIds.add(op.id);
      else if (op.default_variant) annotations[op.id] = op.default_variant;
    }
    const merged = [];
    for (const fp of fParts) {
      if (fullOverrideIds.has(fp.id)) continue;
      if (excludeFamilyIds.has(fp.id)) continue;
      let filteredVariants = (fp.variants || []).filter((v) => {
        if (!v.applies_to) return true;
        return Array.isArray(v.applies_to) && v.applies_to.includes(inst.id);
      });
      if (filteredVariants.length === 0) continue;
      if (annotations[fp.id]) {
        const defId = annotations[fp.id];
        filteredVariants = filteredVariants.map((v) =>
          v.id === defId ? { ...v, default: true } : v
        );
      }
      merged.push({ id: fp.id, name: fp.name, variants: filteredVariants, _fromFamily: true });
    }
    for (const op of ownParts) {
      if (Array.isArray(op.variants)) merged.push(op);
    }
    inst.parts = merged;
  }

  // ── universal materials (sound-generator freedom) ───────────────────────────
  // CodexMusica synthesizes audio, so it is NOT bound by physical buildability:
  // any stringed instrument may use any string material (beef gut on an electric
  // bass, a resonator strung like a sitar), and any instrument with a resonant
  // soundbox (top / back / body / soundboard) may be voiced from any tonewood.
  // For each material family we collect the union of that material's variants
  // across the catalog and offer the ones an instrument lacks on every part of the
  // matching kind. Appended copies are auto:false (never auto-seeded → default
  // recipes stay byte-identical) and carry expanded:<kind> (the UI groups them
  // under a collapsible "More materials" header, and the static-API build strips
  // them so published per-instrument files stay curated). An instrument's own
  // variants are left exactly as authored, in their original order, on top.
  //
  // augmentUniversalMaterial is the single mechanism, parameterised per family:
  //   isTargetPart(part)       — does this part take this material kind?
  //   isMemberVariant(variant) — (optional) is this variant actually of the kind?
  //                              omitted ⇒ every variant of a target part counts.
  const augmentUniversalMaterial = function (instruments, kind, isTargetPart, isMemberVariant) {
    const union = [];
    const seen = {};
    for (const inst of instruments || []) {
      for (const p of inst.parts || []) {
        if (!isTargetPart(p)) continue;
        for (const v of p.variants || []) {
          if (v.expanded) continue; // never re-collect an already-appended copy
          if (isMemberVariant && !isMemberVariant(v)) continue;
          if (!seen[v.id]) {
            seen[v.id] = true;
            union.push(v);
          }
        }
      }
    }
    // ONE lent copy per union variant, SHARED by every part that borrows it.
    //
    // This used to Object.assign a fresh copy per (part, variant) pair, which is
    // the same object rebuilt over and over: the three overridden fields are
    // constant for a given kind, so every copy of `mahogany` lent as a tonewood
    // was byte-identical to every other. At 508,418 tuples that is half a million
    // allocations to produce a few hundred distinct values, and the cost showed
    // up as GC noise on every page load.
    //
    // Sharing is safe because nothing anywhere mutates a variant object —
    // checked across scripts/, src/app.js and mcp/ before relying on it. The
    // renderers read id, name and descriptors; the edit paths write the variant
    // ID onto a CARD, never into the catalog. If that ever stops being true this
    // becomes aliasing, so it is stated here rather than left to be rediscovered.
    const lent = union.map((v) =>
      Object.assign({}, v, { auto: false, expanded: kind, default: false })
    );
    for (const inst of instruments || []) {
      if (!Array.isArray(inst.parts)) continue;
      // Build NEW part objects for the augmented parts. Do NOT mutate the existing
      // part object: for a full-override own-part it is the SAME reference held in
      // inst._ownParts, and mutating it would pollute _ownParts (which other code
      // and the published API serialize) with the expanded variants.
      // default:false is critical — a copied variant must never become an
      // instrument's default (its own curated default stays), or a part with no
      // own default could pick up a borrowed one and change its recipe.
      inst.parts = inst.parts.map((p) => {
        if (!isTargetPart(p)) return p;
        const have = {};
        for (const v of p.variants || []) have[v.id] = true;
        const additions = [];
        for (let k = 0; k < union.length; k++) {
          if (have[union[k].id]) continue;
          additions.push(lent[k]);
        }
        return additions.length
          ? Object.assign({}, p, { variants: (p.variants || []).concat(additions) })
          : p;
      });
    }
  };

  // Strings — any string material on any instrument that has a string-material part.
  const isStringMaterialPart = function (p) {
    return (
      /string/i.test(p.name || p.label || '') &&
      !/count|tuning|configuration|sympathetic|courses|setup|copedent|gauge/i.test(
        (p.name || p.label || '') + ' ' + p.id
      )
    );
  };
  augmentUniversalMaterial(instruments, 'string', isStringMaterialPart);

  // Tonewoods — any wood on any resonant soundbox surface (top / back / body /
  // soundboard). Scoped to those parts only: necks, fretboards, drum shells,
  // mallet bars and bow sticks stay curated. A part qualifies only if it BOTH
  // names a soundbox surface AND carries ≥1 real wood variant — so "Body alloy",
  // "Body type", "Top skin", the "Body" archetype list, etc. never match — and
  // only the wood variants of a qualifying part travel (synthetic/composite tops
  // stay put).
  const WOOD =
    /(spruce|cedar|cedrillo|redwood|\bfir\b|larch|\bpine\b|pinho|juniper|cypress|alpine|mahogany|caoba|sapele|khaya|maple|sycamore|rosewood|palisander|jacarand|dalbergia|sheesham|pau.?ferro|palo escrito|huanghuali|kingwood|violetwood|cocobolo|bubinga|imbuia|\bkoa\b|acacia|walnut|butternut|ebony|blackwood|grenadilla|mpingo|zitan|sandalwood|paulownia|\bkiri\b|wutong|tongmu|mulberry|kuwa|zelkova|keyaki|cherry|yamazakura|apricot|\bplum\b|\bpear|boxwood|cornel|birch|alder|basswood|linden|poplar|willow|beech|\boak\b|chestnut|hornbeam|\bash\b|teak|jack.?wood|padauk|korina|limba|agathis|\bnato\b|okoume|\byew\b|ironwood|agave|eucalyptus|corymbia|bloodwood|naranjillo|yagrumo|cap[aá]|olive|laurel|lingue|rauli|aacha|hardwickia|\btun\b|hardwood|\bfig\b|plywood|laminate)/i;
  const isWoodVariant = function (v) {
    return WOOD.test(v.name || v.label || '');
  };
  const isTonewoodPart = function (p) {
    const nm = p.name || p.label || p.id || '';
    // THE PRIMARY GATE, and the one doing the real work: the part must already
    // carry a CURATED wood variant. A part somebody authored maple and birch
    // onto is a wood-material part, whatever it is called. Everything below is a
    // secondary filter to exclude parts where a wood name appears incidentally.
    if (!(p.variants || []).some((v) => !v.expanded && isWoodVariant(v))) return false;
    if (/\b(top|back|bowl|ribs?|body)\b/i.test(nm) && /\bwood\b/i.test(nm)) return true;
    if (/\bsoundboard\b/i.test(nm)) return true;
    if (/\btop construction\b/i.test(nm)) return true;
    if (/\bback\s*&\s*sides\b/i.test(nm)) return true;
    // The list above is a lutherie vocabulary — top, back, sides, soundboard —
    // and it silently excluded everything that resonates without being a guitar.
    // Measured: 178 instruments carried curated wood variants on a part this
    // predicate did not recognise, almost all of them drums, on parts named
    // exactly what a drum's wood is called: atabaque_shell_wood, djembe_wood,
    // drum_kit.shell_wood, conga_shell_wood. A djembe is a resonant wooden body
    // by any definition; it was outside the palette on a naming technicality.
    //
    // So: a part that is ABOUT material — its name says wood, timber or
    // material, or it names a resonating member and says so — counts too.
    //
    // Deliberately NOT "drop the name test and trust the wood variant alone".
    // That was measured as well: it would pull in 95 more instruments through
    // parts like hambone_technique ("Technique"), ghatam_school ("Clay-temper
    // school") and clapsticks_bilma_form ("Regional form"), whose variants
    // merely MENTION a wood. Offering mahogany as a technique is worse than
    // offering nothing, because it is indistinguishable from a real answer.
    // Plurals, because a part is as likely to be called "Build and materials" as
    // "Body material" and the difference is not meaningful. Measured: the
    // singular-only form excluded exactly one instrument, and it was the aulos —
    // whose `aulos_build` part is literally named "Build and materials" and
    // carries turned boxwood and sycamore. It was one character away from
    // already working.
    if (
      /\b(shells?|frames?|bod(y|ies)|bars?|slabs?|blocks?|tongues?|resonators?)\b/i.test(nm) &&
      /\b(woods?|materials?|timbers?)\b/i.test(nm)
    )
      return true;
    if (/\bwoods?\b/i.test(nm) || /\bmaterials?\b/i.test(nm)) return true;
    return false;
  };
  augmentUniversalMaterial(instruments, 'wood', isTonewoodPart, isWoodVariant);

  // Membranes — any drumhead on any part that carries one.
  //
  // The catalog had exactly two universal pools, strings and tonewoods, which
  // between them describe a guitar. A drum is made of a shell and a HEAD, and
  // the head is the half that decides how it sounds: calfskin and goatskin and
  // Mylar are not interchangeable in any sense a listener would miss. There was
  // no pool for them, so an instrument whose only material choice was its head
  // — 71 of them, on parts named exactly "Head material" and "Skin material" —
  // could not take a material edit at all.
  //
  // Same shape as the two above, and the same primary gate: the part must
  // already carry a CURATED variant of this kind. The name gate then keeps it
  // to parts that are ABOUT the head, so a technique or a tuning part whose
  // prose happens to say "skin" is not offered 262 drumheads.
  const MEMBRANE =
    /(calf.?skin|goat.?skin|sheep.?skin|kid.?skin|snake.?skin|fish.?skin|kangaroo|deer.?skin|horse.?hide|camel|buffalo|rawhide|\bhide\b|\bskins?\b|vellum|parchment|mylar|\bremo\b|weatherking|plastic head|synthetic head|membrane|drum.?head)/i;
  const isMembraneVariant = function (v) {
    return MEMBRANE.test(v.name || v.label || '');
  };
  const isMembranePart = function (p) {
    const nm = p.name || p.label || p.id || '';
    // Strings are the string pool's business, and a gut string is not a head.
    if (/string/i.test(nm)) return false;
    if (!(p.variants || []).some((v) => !v.expanded && isMembraneVariant(v))) return false;
    if (/\b(heads?|skins?|membranes?|batter|resonant|drum.?heads?)\b/i.test(nm)) return true;
    return /\b(materials?)\b/i.test(nm);
  };
  augmentUniversalMaterial(instruments, 'membrane', isMembranePart, isMembraneVariant);

  // Metals — shells, jingles, reeds, bars, bells.
  //
  // The other half the two original pools missed. A timbale shell is steel or
  // brass, a tambourine's jingles are bronze or German silver, an accordion's
  // reeds are steel — all real, audible choices on parts named "Shell metal",
  // "Jingle material", "Reed material", and all of them dead ends because the
  // catalog knew how to lend a tonewood and not an alloy.
  //
  // The `string` exclusion matters more here than anywhere else: string
  // materials ARE metals ("nickel-plated steel"), and without it this pool
  // would collide with the string pool on every wound-string part and offer
  // cymbal bronze as a guitar string.
  const METAL =
    /(bronze|brass|\bsteel\b|stainless|\biron\b|silver|\bgold\b|copper|nickel|alumin|titanium|\btin\b|pewter|zinc|monel|German.?silver)/i;
  const isMetalVariant = function (v) {
    return METAL.test(v.name || v.label || '');
  };
  const isMetalPart = function (p) {
    const nm = p.name || p.label || p.id || '';
    if (/string/i.test(nm)) return false;
    if (!(p.variants || []).some((v) => !v.expanded && isMetalVariant(v))) return false;
    if (
      /\b(shells?|jingles?|reeds?|plates?|bars?|tines?|frames?|cymbals?|gongs?|bells?|keys?|tongues?)\b/i.test(
        nm
      )
    )
      return true;
    return /\b(metals?|alloys?|materials?)\b/i.test(nm);
  };
  augmentUniversalMaterial(instruments, 'metal', isMetalPart, isMetalVariant);

  return instruments;
}
/* @inline-end */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mergeFamilyParts };
}
