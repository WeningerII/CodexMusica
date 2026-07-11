---
name: codex-music-tool
description: Query, compose, validate, and mutate the Codex Musica dataset — 1195 recorded-music traditions (in a 317-node genre tree, 13-axis space), 651 instruments across 11 families with shared parts/variants, 256 rooms, 84 chain archetypes, 21 production aesthetics, 120 tunings, and a 649-entry voice/preface lexicon. Use to look entries up, build an ensemble + room/chain/tuning setup from a tradition (or blend), compile a compressed descriptor-stack "recipe", validate every cross-reference and invariant, and safely add/edit/delete instruments, traditions, rooms, and other entities.
license: UNLICENSED
---

# Codex Musica

A catalog of recorded-music **traditions** in a 13-axis space, plus the
**instruments**, **rooms**, **chain archetypes**, **aesthetics**, and **tunings** they
are recorded with. Headline op: **recipe generation** — a tightly compressed descriptor
stack telling someone how to record a song in a tradition (or 1–3 stapled traditions).
This skill makes the data operable: **query**, **compose** an ensemble + sound, compile
the **recipe**, **validate** every reference, and **mutate** safely.

Every recipe below was run against the real `references/` files and shows its output. <!-- @promise: documented-behaviors -->
Run from the package root (the dir holding `references/`), or set `CODEX_REF` to the
absolute `references/` path. `node` and `jq` are available.

> Ground truth beats memory: tables are bare `const` (not `window.*`/`module.exports`,
> except `07`); `axes` is an **object**; **tree-node ids are full dotted paths**;
> `crossRefs[]` mixes strings and `{ref,voice_isolated}`/`{ref,isolated_parts}` objects; counts are in §1.<!-- @promise: catalog-counts --> Shipped data
> is clean under the §5 checker — but verify with §5/§6, don't trust remembered numbers.

---

## Start Here — intent router

| User intent | Go to |
|---|---|
| "What instruments / traditions / rooms / tunings exist?" / look one up | §2 Loading & querying |
| "Build an ensemble for <tradition / region / era / genre>" | §3a Ensemble from a tradition |
| "Pick instruments that can do <part/technique> in <genre>" | §3b Select by capability |
| "Set the sound: room + signal chain + tuning" | §3c Chain + room + tuning |
| "What descriptors fit this voice/part?" | §3d Voice & preface lexicon |
| "Make a song / give me a recipe / how to record X" / blend traditions | §3e Compile the recipe + §4 |
| "Add / edit / delete an instrument / tradition / room / tuning" | §5 CRUD & invariants |
| "Produce the final output" | §4 Output contract → §6 Validation |
| "Check / fix this recipe or arrangement" | §6 Validation checklist |
| Error, ambiguous name, missing field, anachronism, broken ref | §7 Efficiency + failure modes |

Hard rule: **anything you emit (recipe or arrangement) MUST pass §6 before you return it.**

---

## 1. Data model at a glance

| Entity | Count | ID namespace | Table (global `const`) |
|---|---|---|---|
| instrument families | 11 | bare slug: `bowed`,`percussion`,`wind`,… | `INSTRUMENT_FAMILIES` (array) |
| family part-groups | 9 | keyed by family slug | `INSTRUMENT_FAMILY_PARTS` (object) |
| instruments | 651 | bare slug, e.g. `oud`, `electric_bass` | `INSTRUMENTS` (array) |
| rooms | 256 | bare slug, e.g. `parlor` | `ROOMS` (array) |
| chain archetypes | 84 | `arch_<slug>` | `CHAIN_ARCHETYPES` (array) |
| chain sections (UI menus) | 8 | `mic`/`pre`/`fx`/… | `CHAIN_SECTIONS` (array) |
| production aesthetics | 21 | bare slug, e.g. `wall_of_sound` | `PRODUCTION_AESTHETICS` (array) |
| arrangement templates | 5 | bare slug | `ARRANGEMENTS` (array) |
| tunings | 120 | bare slug, e.g. `twelve_tet` | `TUNINGS` (array) |
| tree nodes | 317 | **full dotted path**, e.g. `groovePercussion.afroDiasporicElec` | `TREE_NODES` (array) |
| traditions | 1195 | bare slug, e.g. `afrobeat` | `TRADITIONS` (array) |
| tradition extras | 1195 | keyed by tradition id | `TRADITION_EXTRAS` (object) |
| voice/preface lexicon | 649 | bare slug, e.g. `sobbing` | `PREFACE_LEXICON` (array) |
| axis definitions | 13 (trad) / 9 (inst) | bare slug, e.g. `harm` | `AXIS_DEFINITIONS`, `INSTRUMENT_AXIS_DEFINITIONS` |

**Bundles → tables.** Each file declares bare `const NAME = …;` (no `window`; only
`07` adds a `module.exports`). The loader (§2) promotes these consts to globals.

| File | Tables it declares |
|---|---|
| `01_family_parts.js` | `INSTRUMENT_FAMILY_PARTS` |
| `02_instruments.js` | `INSTRUMENT_FAMILIES`, `INSTRUMENTS` |
| `03_rooms_chains_tunings.js` | `ROOMS`,`ROOM_CLUSTERS`,`CHAIN_SECTIONS`,`TUNINGS`,`AXIS_DEFINITIONS`,`INSTRUMENT_AXIS_DEFINITIONS`,`CHAIN_ARCHETYPES`,`PRODUCTION_AESTHETICS`,`ARRANGEMENTS` |
| `04_tree.js` | `TREE_NODES` |
| `05_traditions.js` | `TRADITIONS` |
| `06_extras.js` | `TRADITION_EXTRAS` |
| `07_preface_lexicon.js` | `PREFACE_LEXICON` (also `module.exports`) |
| `08_asset_manifest.js` | `ICON_PATHS`,`ICON_ALIASES`,`EMOJI_SVGS`,`EMOJI_REGISTRY`,`FAMILY_FALLBACK_EMOJI` |

The `_*.json` files (`_part_type.json`, `_instrument_base.json`, `_shard_vocabulary.json`,
`_tradition_signatures.json`) are **auxiliary** — real JSON you can `jq`, but the
authoritative parts live in `INSTRUMENT_FAMILY_PARTS` + each instrument's own `parts`.
`scripts/_loader.js` (the canonical loader) and `scripts/_merge.js` (the family-parts
merge) define the semantics §2 mirrors.

### Cross-reference graph (every arrow is an id that must resolve)

```
tradition ─instruments[]─▶ instrument ─family─▶ family ; instrument has merged parts[]─▶ variants[]
    ├─room─▶ room              (parts = family parts filtered by applies_to[], + instrument's own parts)
    ├─tuning─▶ tuning
    ├─chain_archetype─▶ archetype   (archetype.components = {mic,pre,console?,comp,eq,medium})
    ├─chain_mic / chain_pre / chain_console / chain_comp / chain_eq / chain_medium / chain_amp*
    │      = free-vocabulary component ids (NOT a lookup table; inline fallback when no archetype)
    └─production_aesthetic? ─▶ aesthetic
extras[tradition] ─parent─▶ tree node id ; ─crossRefs[]─▶ tree node id (string OR {ref,voice_isolated|isolated_parts})
tree node ─parent─▶ tree node id (root nodes have parent:null)
asset: EMOJI_REGISTRY[instrument_or_variant_id] = emoji codepoint ; instruments fall back via family
```

### Record shapes (verified)

```
family      : {id, name, descriptors[], note}                          // 11
family_parts: INSTRUMENT_FAMILY_PARTS[familyId] = [ part, … ]          // 9 families carry shared parts
part        : {id, name, surface?, variants[], applies_to?[]}          // applies_to gates a family part
variant     : {id, name, descriptors[], default?, applies_to?[], match_tokens?[]}
instrument  : {id, name, family, class, axes{9 named keys}, short, parts[]}   // parts already family-merged
room        : {id, name, cluster, descriptors[], note, default_chain_archetype?, era?, region?, scale_tier?}  // group by .cluster (no "type")
archetype   : {id, name, era, region, scale_tier, components{mic,pre,console?,comp,eq,medium}, exemplar_studios[], note}
aesthetic   : {id, name, era, description, characteristic_techniques[], exemplar_recordings[], production_locus}
tuning      : {id, name, sub, descriptors[], note, pointer}            // "sub"/descriptors carry the system
treeNode    : {id(=full dotted path), name, parent(id|null), description}
tradition   : {id, name, family, lineage, instruments[], room, tuning, chain_archetype?,
               chain_mic, chain_pre, chain_console, chain_comp, chain_eq, chain_medium, chain_amp*, production_aesthetic?}
extras[id]  : {parent(node id), axes{13 named keys, ints -2..+2}, description, exemplars[], status, crossRefs[]}
preface     : {id, tokens[], note?}                                    // a named bundle of descriptor tokens
```

Facts that bite if you miss them:
- **`axes` is an OBJECT keyed by axis name**, not an array. Tradition axes (13):
  `harm, pitch, ornament, meter, density, transmission, improv, soundTech, intensity,
  voice, timbre, percussion, cyclicity`. Instrument axes: a 9-key object (`pitchFix,
  sustain, polyphony, …`). Values are ints **−2..+2**.
- **`instrument.family`** ∈ the 11-value `INSTRUMENT_FAMILIES` table (always resolves).
  **`tradition.family`** is a *different* 12-value vocabulary (`global, classical,
  rock_punk, electronic, hip_hop, vernacular, jazz, pop, blues_gospel, rock, country,
  pop_rock`; `global` dominates at 733/1195) — a top-level genre bucket, NOT an
  instrument family.
- **Tree-node ids are full dotted paths.** 292 of 317 ids contain dots
  (`functionalSong.country.honkyTonkEra`); `extras.parent`/`crossRefs` hold such ids and
  resolve directly via `byNode[path]` — no path reconstruction.
- **`crossRefs[]` is a mixed array**: mostly strings (node-id paths), but 67 entries
  (across 63 distinct traditions) are `{ref:"<node path>", voice_isolated:true}` (44) or
  `{ref:"<node path>", isolated_parts:[…]}` (23) objects — there is **no** `weight` field
  (a `{ref,weight}` object would fail `validate.js`). Normalize with `cr.ref ?? cr` before
  resolving (the §5/§6 checks do this).
- An instrument's `parts` are already family-merged in the data; the §2 helper
  `partsFor(id)` reproduces the merge (family parts filtered by `applies_to`, overlaid
  with own parts) so it works whether or not merge ran.
- `PREFACE_LEXICON` is a flat list of named token bundles (e.g. `sobbing`,`crooning`)
  for vocal/character description — **not** a parts table and **not** a conflicts table.
- Names are **not unique** and not always literal; the `id` is the key. Region/era live
  in `lineage`/`description` text and on archetype/aesthetic `era`, not in a tidy field.

---

## 2. Loading & querying (the fix)

The bundles are bare `const NAME = …;`. **`require()` returns `{}` for files 01–06/08**
(no exports), and **`jq` can't parse them** (JS, not JSON). Use one of:

### A. Loader shim (the only reliable way to get every table)

Mirror `scripts/_loader.js`: read the files, regex-promote `const NAME` →
`globalThis.NAME`, eval. Save as `load.js`:

```js
// load.js — load all Codex tables. CODEX_REF = absolute path to references/.
const fs = require('fs'), path = require('path');
const REF = process.env.CODEX_REF || path.join(__dirname, 'references');
const FILES = ['01_family_parts.js','02_instruments.js','03_rooms_chains_tunings.js',
  '04_tree.js','05_traditions.js','06_extras.js','07_preface_lexicon.js','08_asset_manifest.js'];
const TABLES = ['INSTRUMENT_FAMILY_PARTS','INSTRUMENTS','INSTRUMENT_FAMILIES','ROOMS',
  'ROOM_CLUSTERS','CHAIN_SECTIONS','TUNINGS','AXIS_DEFINITIONS','INSTRUMENT_AXIS_DEFINITIONS',
  'CHAIN_ARCHETYPES','PRODUCTION_AESTHETICS','ARRANGEMENTS','TREE_NODES','TRADITIONS',
  'TRADITION_EXTRAS','PREFACE_LEXICON'];
let bundle = FILES.map(f => fs.readFileSync(path.join(REF, f), 'utf8')).join('\n');
bundle = bundle.replace(new RegExp('const (' + TABLES.join('|') + ')', 'g'), 'globalThis.$1');
new Function('module', bundle)({ exports: {} });        // module shim for 07's export tail
const T = {}; for (const t of TABLES) T[t] = globalThis[t];
module.exports = T;
```
```bash
CODEX_REF="$PWD/references" node -e 'const T=require("./load.js");
console.log("loaded:",T.INSTRUMENTS.length,"insts,",T.TRADITIONS.length,"trads")'
# → loaded: 651 insts, 1195 trads
```

### B. `require` for the preface lexicon only (it has `module.exports`)

```bash
node -e 'console.log(require("./references/07_preface_lexicon.js").PREFACE_LEXICON.length)'  # → 649
```

### C. grep to locate fast (single-quoted JS; the field is `name`)

```bash
grep -oE "name: '[^']*[Oo]ud[^']*'" references/02_instruments.js | head -2
# name: 'Jingju role-type mechanism (… jing pressed-loud …)'   ← false positive ("l[oud]")
# name: 'Fretless (oud-style neck)'                             ← a variant name, not the instrument
```
Caveat: a substring pattern catches false positives (here `[Oo]ud` matches "l**oud**") **and
can miss the record you want** — the real instrument's name is
`'ʿŪd (Arab/Mediterranean fretless lute)'` (id `oud`), whose non-ASCII spelling this pattern
never matches. So grep is for rough locating only; resolve the actual record by **id** via
`q.js` (`db.byInst['oud']`). Records are pretty-printed over many lines, so `grep -c "^  { id:"`
does NOT count records — use the loader to count.

### D. `jq` works on the auxiliary `_*.json` files (real JSON), not the bundles.

### Reusable helper — save as `q.js`, then `node q.js`

```js
// q.js — load tables + id indexes + helpers. CODEX_REF = absolute references/ path.
const fs = require('fs'), path = require('path');
const REF = process.env.CODEX_REF || path.join(__dirname, 'references');
const FILES = ['01_family_parts.js','02_instruments.js','03_rooms_chains_tunings.js',
  '04_tree.js','05_traditions.js','06_extras.js','07_preface_lexicon.js','08_asset_manifest.js'];
const TABLES = ['INSTRUMENT_FAMILY_PARTS','INSTRUMENTS','INSTRUMENT_FAMILIES','ROOMS',
  'ROOM_CLUSTERS','CHAIN_SECTIONS','TUNINGS','AXIS_DEFINITIONS','INSTRUMENT_AXIS_DEFINITIONS',
  'CHAIN_ARCHETYPES','PRODUCTION_AESTHETICS','ARRANGEMENTS','TREE_NODES','TRADITIONS',
  'TRADITION_EXTRAS','PREFACE_LEXICON'];
let bundle = FILES.map(f => fs.readFileSync(path.join(REF, f), 'utf8')).join('\n');
bundle = bundle.replace(new RegExp('const (' + TABLES.join('|') + ')', 'g'), 'globalThis.$1');
new Function('module', bundle)({ exports: {} });
const g = globalThis, db = {};
TABLES.forEach(t => { db[t] = g[t]; });
const idx = a => Object.fromEntries(a.map(x => [x.id, x]));
db.byInst = idx(db.INSTRUMENTS); db.byFamily = idx(db.INSTRUMENT_FAMILIES);
db.byRoom = idx(db.ROOMS); db.byArch = idx(db.CHAIN_ARCHETYPES);
db.byAes = idx(db.PRODUCTION_AESTHETICS); db.byTuning = idx(db.TUNINGS);
db.byTrad = idx(db.TRADITIONS); db.byNode = idx(db.TREE_NODES);
db.byPreface = idx(db.PREFACE_LEXICON); db.extras = db.TRADITION_EXTRAS;
// tree node ids are full dotted paths → resolve extras.parent / crossRefs via db.byNode.
db.crId = cr => (cr && typeof cr === 'object') ? cr.ref : cr;   // crossRefs: string OR {ref,voice_isolated|isolated_parts}
// available parts for an instrument = family parts (filtered by applies_to) overlaid
// with the instrument's own parts (own wins on id). Mirrors scripts/_merge.js.
db.partsFor = id => {
  const inst = db.byInst[id]; if (!inst) return [];
  const fam = (db.INSTRUMENT_FAMILY_PARTS[inst.family] || [])
    .filter(p => !p.applies_to || p.applies_to.includes(id));
  const own = inst.parts || [], ownById = new Map(own.map(p => [p.id, p])), seen = new Set(), out = [];
  for (const fp of fam) { out.push(ownById.get(fp.id) || { ...fp, _inherited: true }); seen.add(fp.id); }
  for (const p of own) if (!seen.has(p.id)) out.push(p);
  return out;
};
module.exports = db;

if (require.main === module) {        // demo: instruments whose available parts include a "mute"
  console.log(JSON.stringify(db.INSTRUMENTS
    .filter(i => db.partsFor(i.id).some(p => /mute/.test(p.id))).slice(0, 6).map(i => i.id)));
}
```
Verified `node q.js` → `["fiddle","trombone","trumpet"]`.
For any query, `const db = require('./q.js')` and read `db.*` / `db.by*` /
`db.partsFor(id)` — load once, never re-parse the 1–2 MB bundles.

### Three verified example queries

```bash
# 1) instruments per family, top 5
node -e 'const db=require("./q.js");const c={};db.INSTRUMENTS.forEach(i=>c[i.family]=(c[i.family]||0)+1);
console.log(JSON.stringify(Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,5)))'
# → [["percussion",106],["plucked_traditional",76],["wind",73],["ensemble",32],["bowed",31]]

# 2) traditions under a genre-tree branch (extras.parent is a full dotted path)
node -e 'const db=require("./q.js");
console.log(JSON.stringify(db.TRADITIONS.filter(t=>db.extras[t.id].parent.startsWith("groovePercussion")).slice(0,5).map(t=>t.id)))'
# → ["palm_wine","highlife","funk","samba","pagode"]

# 3) tunings that are not the Western default (group by first descriptor)
node -e 'const db=require("./q.js");
console.log(JSON.stringify(db.TUNINGS.filter(t=>!(t.descriptors||[]).includes("Western")).slice(0,4).map(t=>t.id+":"+(t.descriptors||[])[0])))'
# → ["just_intonation:pure","pythagorean:medieval","meantone:mellow","well_temperament:key-colored"]
```
(Verified: instrument families 11; tradition.family buckets 12; tuning first-descriptor
groups `pentatonic:11, korean-traditional:2, son-clave:2, …` — descriptors are
character-based, not region-based; `PREFACE_LEXICON` has 567 distinct tokens.)

---

## 3. Core workflows

Each reuses `const db = require('./q.js')`. Run from the package root or with
`CODEX_REF=/abs/path/to/references node script.js`.

### 3a. Build an ensemble from a tradition

1. **Pick the tradition** — by id, or filter by `tradition.family` bucket /
   `extras.parent` branch / words in `lineage`:
   ```bash
   node -e 'const db=require("./q.js");const t=db.byTrad["afrobeat"];
   console.log(t.id,"|",t.family,"|",t.instruments.length,"insts | parent",db.extras[t.id].parent)'
   # → afrobeat | global | 9 insts | parent groovePercussion.afroDiasporicElec
   ```
2. **Resolve the ensemble + sound refs** (this is the seed):
   ```bash
   node -e 'const db=require("./q.js");const t=db.byTrad["afrobeat"];
   t.instruments.forEach(id=>console.log(id, db.byInst[id].name, "["+db.byInst[id].family+"]"));
   const a=db.byArch[t.chain_archetype], r=db.byRoom[t.room];
   console.log("room:",r.id,"("+r.cluster+")");
   console.log("archetype:",a.id,"era="+a.era,"mic="+a.components.mic,"comp="+a.components.comp);
   console.log("tuning:",t.tuning)'
   ```
   Verified output:
   ```
   electric_guitar_single_coil Solid-body electric guitar with single-coil pickups [electric_strings]
   electric_bass Solid-body electric bass [electric_strings]
   drum_kit Drum kit (Western) [percussion]
   tonewheel_organ Drawbar tonewheel organ (with rotating-speaker cabinet) [keyboard]
   saxophone Saxophone (soprano / alto / tenor / baritone) [wind]
   trumpet Trumpet / cornet / flugelhorn [wind]
   voice Voice [voice]
   shekere Shekere (West African beaded gourd) [percussion]
   congas Congas / tumbadoras (Cuban) [percussion]
   room: studio_emi_lagos_african (commercial_studio)
   archetype: arch_emi_lagos_african_70s era=1965-1985 mic=condenser_ldc comp=comp_vari_mu
   tuning: twelve_tet
   ```
3. **Assign one variant per relevant instrument part** (technique/voicing) from
   `db.partsFor(id)`; default is the `default:true` variant unless the tradition points
   elsewhere (e.g. afrobeat guitar → `electric_chicken_scratch`).
4. **Blend** (one to three traditions): union the instrument lists; keep the **primary** as
   anchor and reconcile room/archetype/tuning to it; pull staples only from genres close
   in the tree. Then §3e and §6.

### 3b. Select instruments by capability + genre

- **By capability (which part/technique an instrument supports):**
  ```bash
  node -e 'const db=require("./q.js");
  console.log(JSON.stringify(db.INSTRUMENTS.filter(i=>db.partsFor(i.id).some(p=>/mute/.test(p.id))).slice(0,6).map(i=>i.id)))'
  # → ["fiddle","trombone","trumpet"]
  ```
- **By genre:** genre is on the **tradition** side (`tradition.family` bucket,
  `extras.parent` branch) and on archetype/aesthetic `era`/region. Go tradition→instruments:
  ```bash
  node -e 'const db=require("./q.js");const ids=new Set();
  db.TRADITIONS.filter(t=>t.family==="jazz").forEach(t=>t.instruments.forEach(i=>ids.add(i)));
  console.log("instruments across jazz traditions:",ids.size)'   # → 33
  ```
- **By instrument family / class / axes:** filter `i.family==="bowed"`, `i.class`, or
  numeric `i.axes.sustain`, etc. Confirm a chosen part is in `db.partsFor(id)` (§6).

### 3c. Design signal chain + room + tuning

1. **Chain = pick an archetype** (period-curated bundle in `.components`). Match `era`
   + `region`:
   ```bash
   node -e 'const db=require("./q.js");const a=db.byArch["arch_memphis_southern_soul"];
   console.log(a.id,"["+a.era+","+a.region+"]"); console.log(JSON.stringify(a.components))'
   # arch_memphis_southern_soul [1965-1980,NA-S]
   # {"mic":"ribbon_passive","pre":"pre_neve_1073_input","console":"colored","comp":"comp_la2a_optical","eq":"eq_inductor_iron","medium":"tape_30ips"}
   ```
   If no archetype fits, set the inline `chain_mic/pre/console/comp/eq/medium` ids
   directly — they are **free vocabulary**, not a lookup table.
2. **Room** (exactly one): group by `cluster`; match `descriptors` to intent.
   ```bash
   node -e 'const db=require("./q.js");const r=db.byRoom["studio_emi_lagos_african"];
   console.log(r.id,"|",r.cluster,"|",r.descriptors.join("/"))'
   # studio_emi_lagos_african | commercial_studio | large-tropical/ensemble-volume/EMI-equipment-heritage
   ```
   (List clusters with `[...new Set(db.ROOMS.map(r=>r.cluster))]`.)
3. **Tuning** (usually one): start from `tradition.tuning` (often `twelve_tet`). Mixing
   tuning *families* (Western vs maqam vs gamelan, read from `descriptors`/`sub`) is a
   hard flag unless intentional.

### 3d. Voice & preface lexicon (descriptor enrichment)

`PREFACE_LEXICON` is 649 named bundles of descriptor tokens for **vocal/character**
description (`sobbing`, `belting`, `keening`, `wailing`, `crooning`, `purring`, …). Use it
to enrich a voice chair's descriptors with consistent tokens; there is **no numeric
op-model and no conflicts table**.
```bash
node -e 'const db=require("./q.js");const p=db.byPreface["belting"];
console.log(p.id,"=>",p.tokens.slice(0,8).join(", "))'
# belting => projecting, chest-resonance-low-mid, vibrato-rich, late-Romantic-onward, ringing, blues-shouter, characteristic-cry, choir-blendable
```
Pick a bundle whose name matches the intended delivery and fold a few tokens into the
voice chair's `descriptors`. Keep the output free of impressionistic contradictions
(don't say both "bright" and "dark" for one source) — an authoring judgment, not a lookup.

### 3e. Compile the recipe (the product)

The deliverable is a compressed **descriptor-stack string** (≤1000 chars; §4A).
Assemble it from the resolved pieces in this fixed order:

1. Tradition position: `classic <region> <era> <name>, <parent branch>, <crossRefs…>`
   (region/era from `lineage`; branch + crossRefs from `extras`, rendered readable).
2. Voice descriptors (if voiced), no noun.
3. Instruments with their chosen iconic variant descriptors (modifiers in front, noun last).
4. Chain electronics from the archetype components: amp, mic, pre, console, comp, eq.
5. Medium + fx, then production aesthetic.

A real compiled recipe (verbatim `node scripts/recipe.js --tradition afrobeat`
snapshot, 990 chars — shown truncated):
```
classic West African mid-1970s afrobeat, groove Percussion, Afro-diasporic electric branch, American jazz fusion, Afro-diasporic MC rhythm acid jazz. thick, rap, nervy, narrative. Fender blackface amp American 60s amp spring reverb bright maple pau ferro single coil electric guitar, ampeg b15 amp American 60s bass amp flip top character thomastik infeld low tension electric bass, birch vintage ambassador asymmetric bronze bell bronze drum kit, Hammond b3 canonical 1955 1975 jazz gospel rock standard Leslie 145 …
```
Output rules are strict (§4A): no prose/connectives, no axis values, **no
artist/band/exemplar names**, drop defaults silently, modifiers-before-noun.

### 3f. The `recipe.js` engine — customize, delete, add, blend, explain

`scripts/recipe.js` is the headline generator and already does most
recipe-shaping the browser app does. Prefer it over hand-assembling §3e. All
flags below are verified; run from the repo root.

| Intent | Command |
|---|---|
| Recipe for one tradition | `node scripts/recipe.js --tradition <id>` |
| Staple multiple traditions (order = lead order) | `node scripts/recipe.js --traditions <id1>,<id2>` |
| Weighted blend of two (0=A … 1=B) | `node scripts/recipe.js --diff --weight=0.7 <idA> <idB>` |
| Best-fit tradition for an axis target | `node scripts/recipe.js --axis-target "harm:2,density:2,intensity:2"` |
| **Customize** a part's variant | `node scripts/recipe.js --tradition <id> --swap-variant=<inst>:<part>:<variant>` |
| **Delete** instrument(s) from the ensemble | `node scripts/recipe.js --tradition <id> --exclude-instrument=<id>,<id>` |
| **Add** instrument(s) beyond the roster | `node scripts/recipe.js --tradition <id> --add-instrument=<id>` |
| Pin a different arrangement | `node scripts/recipe.js --tradition <id> --arrangement=<id>` |
| Machine-readable config (not the string) | `… --json` |
| Explain variant picks / preface picks | `… --why` / `… --why-prefaces` (add `-json` for either) |

Notes that bite:
- `--diff` is a registered boolean flag (`recipe.js`'s `BOOLEAN_FLAGS`), so it never
  swallows the next token: the natural `--diff <a> <b> [--weight=0.7]` form just works,
  and the two ids stay positional no matter where `--weight` / `--swap-variant` /
  `--exclude-instrument` sit — before, between, or after them (all three orderings verified
  byte-identical). `--weight` defaults to 0.5 (0 = full A … 1 = full B). (Historical
  footgun, now fixed: a *bare* `--diff <a> <b>` used to swallow `<a>` and die with
  `--diff requires two tradition ids`. `check_doc_commands.js` runs the documented form
  and `check_doc_behaviors.js` asserts every argument ordering stays byte-identical on
  each CI run, so this can't silently regress.)
- `--swap-variant` is `inst:part:variant`; multiple swaps separated by `;`.
  Validate the triple first via `db.partsFor(inst)` (§2) — recipe.js rejects
  unknown part/variant ids with exit 2.
- Stapling **order** in `--traditions a,b` sets which tradition leads the
  recipe header and instrument order (matches the app's group-order → output
  behavior). Reorder by reordering the ids.

Verified examples:
```bash
node scripts/recipe.js --tradition delta_blues --swap-variant=voice:voice_register:falsetto
node scripts/recipe.js --tradition afrobeat --exclude-instrument=saxophone,trumpet
node scripts/recipe.js --diff --weight=0.5 delta_blues detroit_techno
node scripts/recipe.js --diff delta_blues detroit_techno          # bare form: both ids stay positional
```

### 3g. Reshape a card toward a preface (inverse-configure)

The forward direction (§3d) suggests a preface for a fixed configuration.
`scripts/preface_configure.js` is the **inverse**: fix a target preface and let
the instrument's variants/tuning/room/chain re-pick to maximize overlap with
that preface's token signature (coordinate-ascent; same algorithm as the
browser app's `inverseConfigureForPreface`).

```bash
node scripts/preface_configure.js --instrument voice --preface liturgical
#   target coverage: 0/9 → 2/9 tokens
#   Tuning: (none) → Pythagorean tuning   [+medieval]
#   Room: (none) → Tin-roofed shack
```
- `--tradition <id>` seeds the card from a real tradition first (so you refine a
  recipe card rather than a bare default).
- `--json` emits `{startScore, finalScore, targetTokenCount, changes[], config}`
  for programmatic use; `config` is a ready-to-use card (parts/tuning/room/chain
  + `preface`).
- A "preface" is a **token bundle**, not arithmetic: reshaping = re-selecting
  variants whose `descriptors` overlap the preface tokens. Coverage `k/N` is
  how many of the preface's N tokens the new config covers.

**A preface override can move your settings — including the room.** The inverse
re-picks across part-variants, tuning, **room**, and chain stages (mic/pre/
medium/console). Verified: `caressing` on a `voice` card moved
`Room → Front parlor (period furniture, rugs, drapes)` (and on a fuller card,
Register Head→Chest + Quality lowered-larynx→Opera). So if you commit a preface
*after* hand-setting a room/tuning, expect it may overwrite them — check the
returned `changes[]` and re-set anything you wanted to keep.

**Two override paths — pick by intent:**
- **Reshape** (inverse): `preface_configure.js` / the app's `commitPrefaceChange`
  — re-selects settings to fit the preface. Use when you want the preface to
  *drive* the configuration.
- **Label only** (no reshape): set `card.preface = id; card.prefaceAuto = false`
  directly. Use when your settings are already where you want them and you only
  want to relabel — or for a free-form word that isn't in the lexicon (the engine
  can't reshape toward a token-less target, so it just sets the label).

**Manual prefaces are locked; auto prefaces dedup.** At recipe-compile, two cards
that auto-resolve to the same preface collide — the higher-scoring card keeps it
and the loser is bumped to its next-best (so no two cards in one recipe show the
same preface). Cards with `prefaceAuto = false` (anything you set by hand) are
**locked**: they keep their id and reserve it, and the auto cards flow around
them. This is why a hand-picked preface survives while auto-picks shuffle.

### 3h. Produce a named recipe format (rich / prose / tags / compact)

**`recipe.js` does NOT emit these four formats.** It uses `translate.js`, a
single descriptor-stack renderer. The four named formats the app shows (the
"current recipe" panel, the Stack tab) — **rich**, **prose**, **tags**,
**compact** — live only in `src/app.js` as `compress{Rich,Prose,Tags,Compact}Recipe`,
compiled via `compileRecipeStack(cards, format, opts)`. To produce them you run
the **browser engine headless** (jsdom over the built `codex.html`). This is the
faithful path — the real function the app calls, not a reimplementation.

```js
// rich_recipe.js — emit a named-format recipe via the real browser engine.
// Save at the REPO ROOT and run `node rich_recipe.js` from there (jsdom +
// build_html.js resolve relative to the repo). Run `npm ci` first: a fresh clone has
// no node_modules, so an un-installed tree fails with "Cannot find module 'jsdom'" even
// from the repo root — and running from the wrong dir fails the same way. (Mirrors
// scripts/app_recipe_regression.js.)
const fs=require('fs'),os=require('os'),path=require('path');
const {execFileSync}=require('child_process');
const {JSDOM}=require('jsdom');                 // devDependency — needs `npm ci` first
const tmp=path.join(os.tmpdir(),`codex_${process.pid}.html`);
// --embedded: the default build is the lazy shell, which boots by fetching api/
// (jsdom here has no fetch). The embedded build carries the tables in-page and
// boots synchronously — what this headless harness needs.
execFileSync('node',[path.join('scripts','build_html.js'),`--out=${tmp}`,'--embedded','--quiet'],{stdio:['ignore','ignore','inherit']});
const html=fs.readFileSync(tmp,'utf8'); fs.unlinkSync(tmp);
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
  w.storage={async get(){return null;},async set(){},async delete(){},async list(){return{keys:[]};}};
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
  w.scrollTo=()=>{};
}});
setTimeout(()=>{
  const probe=`(function(){
    // Build cards with the app's OWN makeCard, then tweak parts/tuning/room/chain.
    const TRAD='tin_pan_alley_song';
    const v=makeCard('voice',{traditionId:TRAD});
    v.parts.voice_register='head_voice';                 // example tweak
    const cards=[v, makeCard('cornet',{traditionId:TRAD})];
    // commitPrefaceChange(cards[0],'caressing');         // optional: reshape toward a preface
    window.__out=compileRecipeStack(cards,'rich',{});     // 'rich' | 'prose' | 'tags' | 'compact'
  })();`;
  const s=dom.window.document.createElement('script'); s.textContent=probe;
  dom.window.document.body.appendChild(s);
  console.log(dom.window.__out); dom.window.close();
},1500);
```
- Inside the probe you have the full app API: `makeCard(id,{traditionId})`,
  `card.parts`/`tuning`/`room`/`chain`, `commitPrefaceChange(card,id)`,
  `compileRecipeStack(cards, format, {})`. Tweak, then compile.
- The chain shape is `{fx:[],amp,pre,comp,eq,console,mic,medium}`; set acoustic-era
  gear by id, e.g. `card.chain={...card.chain, mic:'mic_acoustic_horn_pre1925', medium:'shellac_78'}`.
- **Validate the result against §6** before returning it (≤1000 chars, no proper
  names, ids resolve). The four formats all honor the ceiling via the same trim
  cascade.
- Iterate: build 2-3 variants (e.g. with/without a stapled tradition, or different
  preface picks) and compare — the catalog rewards play, and one-shotting hides
  the better fit.

---

## 4. Output contract

Emit **one of two** shapes depending on the ask.

### 4A. Recipe string (default for "make / recipe / how to record")

A single descriptor-stack string. Constraints (all enforced by §6):
- ≤ **1000 characters** (a ceiling, not a target; trim the last category first if over).
- No prose, connectives, or labels. Period between category groups; commas within.
- **No axis values** printed. **No artist/band/composer/exemplar names** — those live
  only in `extras.exemplars[]` / `archetype.exemplar_studios[]` and must never appear.
- Drop catalog defaults silently (e.g. don't print `twelve_tet`, `comp_none`).
- Modifiers in front, anchor noun last.

### 4B. Arrangement JSON (when the user wants a structured, checkable plan)

Emit exactly this shape. **Required:** `meta.title`, and each `ensemble[]` item's
`instrument_id`. Every id must resolve (§6).

```jsonc
{
  "meta": {
    "title": "string (required)",
    "tradition": "afrobeat",            // optional; if built from one
    "blend": ["afrobeat","highlife"],   // optional; primary first
    "tempo_bpm": 118, "key": "E dorian"
  },
  "ensemble": [
    { "instrument_id": "electric_guitar_single_coil",   // required, must resolve
      "parts": [                                         // each part_id ∈ db.partsFor(instrument_id)
        { "part_id": "electric_technique",
          "variant_id": "electric_chicken_scratch",      // ∈ that part's variants
          "descriptors": ["chicken-scratch","midrange-forward"] } ] }
  ],
  "room_id": "studio_emi_lagos_african",                // exactly one
  "chain": { "archetype_id": "arch_emi_lagos_african_70s",  // resolves; supersedes inline
             "mic": null, "pre": null, "console": null, "comp": null, "eq": null, "medium": null },
  "tuning_id": "twelve_tet",
  "aesthetic_id": null,                                  // optional; must resolve if present
  "recipe": "classic West African mid-1970s afrobeat, …",   // the §4A string
  "validation": { "checked": true, "issues": [] }        // checked MUST be true; issues empty (or all soft)
}
```

### Complete worked example (every id verified to resolve & be coherent)

Built from the real `afrobeat` tradition — all nine instruments resolve; `room`,
`chain_archetype` (with components), and `tuning` all resolve; `electric_chicken_scratch`
is a real variant of the single-coil guitar's `electric_technique` part:

```json
{
  "meta": { "title": "Afrobeat Session in E Dorian", "tradition": "afrobeat", "tempo_bpm": 118, "key": "E dorian" },
  "ensemble": [
    { "instrument_id": "electric_guitar_single_coil",
      "parts": [ { "part_id": "electric_technique", "variant_id": "electric_chicken_scratch",
                   "descriptors": ["chicken-scratch","midrange-forward","clean"] } ] },
    { "instrument_id": "electric_bass", "parts": [] },
    { "instrument_id": "drum_kit", "parts": [] },
    { "instrument_id": "tonewheel_organ", "parts": [] },
    { "instrument_id": "saxophone", "parts": [] },
    { "instrument_id": "trumpet", "parts": [] },
    { "instrument_id": "voice", "parts": [] },
    { "instrument_id": "shekere", "parts": [] },
    { "instrument_id": "congas", "parts": [] }
  ],
  "room_id": "studio_emi_lagos_african",
  "chain": { "archetype_id": "arch_emi_lagos_african_70s", "mic": null, "pre": null, "console": null, "comp": null, "eq": null, "medium": null },
  "tuning_id": "twelve_tet",
  "aesthetic_id": null,
  "recipe": "classic West African mid-1970s afrobeat, groove Percussion, Afro-diasporic electric branch, American jazz fusion. thick, nervy, narrative. chicken-scratch midrange-forward clean single coil electric guitar, fingerstyle electric bass, bronze drum kit, tonewheel organ Leslie, tenor saxophone, trumpet, shekere, congas. large-diaphragm condenser, German tube V72-school preamp, German tube console, vari-mu tube compressor, Pultec-style passive program EQ. two-inch thirty-ips tape.",
  "validation": { "checked": true, "issues": [] }
}
```
(`electric_chicken_scratch` descriptors are `["chicken-scratch","midrange-forward",
"clean"]` — verbatim from the data. Because the arrangement sets `chain.archetype_id`, the
chain uses archetype `arch_emi_lagos_african_70s`'s components (which **supersede**
afrobeat's inline `chain_*` per §4B): `mic=condenser_ldc`, `pre=pre_tube_german_v72`,
`console=console_german_tube_50s`, `comp=comp_vari_mu`, `eq=eq_passive_program_pultec`,
`medium=tape_30ips`. The recipe contains none of afrobeat's exemplars
(`Fela Kuti, Tony Allen, Antibalas`). Caveat: variants are family-part-level, so the §6
validator confirms a `variant_id` belongs to its part but cannot judge musical idiom —
choose idiomatic variants yourself.)

---

## 5. CRUD & invariants

Tables are static JS literals — there is no live store. To mutate: load via the §2
shim, change the in-memory table, **re-serialize the whole file** as
`const NAME = <value>;` (keep `07`'s `module.exports` tail; `08`'s several consts), then
re-run the §5 checker. In a full distribution also run `scripts/validate.js` and
`scripts/build.js` (validate + audit + regression + rebuild HTML). After ANY edit the
checker must still print `{"totalIssues":0,…}`.

**Two surfaces, kept honest by gates.** Core logic ships twice — inlined in
`src/app.js` (the browser/`codex.html`) and as `scripts/` primitives (the CLI/agent
path). Don't hand-edit the duplicated pieces independently:
- **Tradition signatures** live canonically in `references/_tradition_signatures.json`;
  `node scripts/build_signatures.js` regenerates the `app.js` inline copy from it. Never
  edit the `app.js` `TRADITION_SIGNATURES` block by hand.
- `scripts/equivalence.js` (in `npm test` and `build.js`) executes both the browser
  functions (in jsdom) and the node primitives on shared fixtures and fails if their
  descriptor sets or preface picks diverge — behavioral parity, not just textual. <!-- @promise: browser-node-parity --> If you
  change `_cardDescriptorSet`/`_matchSurvivors` in `app.js`, change the matching
  `scripts/_card_descriptors.js`/`_preface_match.js` too, or this gate fails.

**Add an instrument**
1. New bare-slug `id`, never reused.
2. Required fields: `id, name, family, class, axes{9 keys}, short, parts[]` (parts may be `[]`).
3. `family` ∈ `INSTRUMENT_FAMILIES` (the 11). Each `parts[].id`/`variants[].id` follow
   the existing slug style; per part, ≤1 `default:true` variant unless multiple defaults
   carry disjoint `applies_to` scopes.
4. To give it shared family parts, add its id to those parts' `applies_to[]` in
   `01_family_parts.js`.
5. Optionally register an emoji in `EMOJI_REGISTRY` (else it falls back by family).
6. Re-serialize `02_instruments.js` (+ `01` if touched); run the checker.

**Add an optional, off-by-default dimension** (a new part, or extra variants, whose presence
must NOT change any existing recipe): make the part's `default:true` variant *neutral* — empty
`descriptors: []`, so it renders nothing — and tag every other variant `auto: false`. The node
search (`search.js`) skips `auto: false` variants in **both** the seed pick (`seedFromTradition`)
and the hill-climb (`variantSwapMoves`), so the neutral default is kept for every tradition and the
variant surfaces only when a caller selects it explicitly via `--swap-variant` (which pins it
past the search). The browser path uses `defaultParts` (no hill-climb), so it keeps the default
too. This is how `voice`'s `voice_effort` (subglottal-pressure / under-singing) and
`voice_vocal_tract` (tongue-root / vowel posture) dimensions were added with zero recipe drift
(1198/1198 + 56/56 + 8/8 unchanged). Confirm with `npm test` after.

**Edit**: keep `id` stable; re-check every ref you touch.
**Delete an instrument**: remove it AND scrub every dangling ref — any
`tradition.instruments[]`, any family part's `applies_to[]`, any `EMOJI_REGISTRY` entry,
and any arrangement `ensemble[]` pointing at it.

**Add/edit/delete a tradition**: a `TRADITIONS` entry **must** have a paired
`TRADITION_EXTRAS["<id>"]` whose `parent` is a tree-node id, `axes` is a 13-key object
of ints in −2..+2, plus `description`/`exemplars`/`status`/`crossRefs` (crossRefs are
tree-node ids, as strings or `{ref,voice_isolated}`/`{ref,isolated_parts}` objects). `room`/`tuning`/`chain_archetype`/
`production_aesthetic` should resolve.

**Other entities**: family/part/variant → `01`+`02`; room/archetype/aesthetic/tuning →
`03`; tree node → `04`; preface bundle → `07`; assets → `08`. Respect the namespace and
re-run the checker.

### Invariants
- I1 Instrument ids unique; `family` ∈ `INSTRUMENT_FAMILIES`.
- I2 Family part `applies_to[]` ⊆ instrument ids; per part, multiple `default:true`
  variants only if their `applies_to` scopes are disjoint (never both apply to one inst).
- I3 Tradition `instruments[]` ⊆ instruments; `room`/`tuning`/`chain_archetype`/
  `production_aesthetic` resolve; every tradition has paired extras.
- I4 Extras: no orphan keys (key ∈ traditions); `parent` and every normalized
  `crossRefs[]` (`cr.ref ?? cr`) resolve via `byNode`; `axes` is a 13-key object of ints
  in −2..+2.
- I5 Tree: every non-root node's `parent` resolves.
- I6 Each entity conforms to its §1 record shape (required keys, id style, types).

### Invariant checker (verified — clean on shipped data; flags injected damage)

```js
// check.js — CODEX_REF=/abs/references node check.js  → {totalIssues, byCategory, sample[]}
const db = require('./q.js');
const issues = [], S = a => new Set(a.map(x => x.id));
const crId = cr => (cr && typeof cr === 'object') ? cr.ref : cr;
const instIds=S(db.INSTRUMENTS), roomIds=S(db.ROOMS), tunIds=S(db.TUNINGS),
      archIds=S(db.CHAIN_ARCHETYPES), aesIds=S(db.PRODUCTION_AESTHETICS),
      famIds=S(db.INSTRUMENT_FAMILIES), tradIds=S(db.TRADITIONS), seen=new Set();
for (const i of db.INSTRUMENTS) {                                   // I1
  if (seen.has(i.id)) issues.push('DUP_INST ' + i.id); seen.add(i.id);
  if (!famIds.has(i.family)) issues.push('BAD_FAMILY ' + i.id + '->' + i.family);
}
for (const fam of Object.keys(db.INSTRUMENT_FAMILY_PARTS))          // I2
  for (const p of db.INSTRUMENT_FAMILY_PARTS[fam]) {
    (p.applies_to||[]).forEach(x => { if (!instIds.has(x)) issues.push('APPLIES_TO_BAD ' + fam + '.' + p.id + '->' + x); });
    const defs = (p.variants||[]).filter(v => v.default);           // >1 default OK iff disjoint applies_to
    if (defs.length > 1) { const sc = new Set(); let overlap = false;
      for (const v of defs) for (const a of (v.applies_to || ['*'])) { if (sc.has(a) || a === '*') overlap = true; sc.add(a); }
      if (overlap) issues.push('MULTI_DEFAULT ' + fam + '.' + p.id); }
  }
for (const t of db.TRADITIONS) {                                    // I3
  (t.instruments||[]).forEach(x => { if (!instIds.has(x)) issues.push('TRAD_BAD_INST ' + t.id + '->' + x); });
  if (t.room && !roomIds.has(t.room)) issues.push('TRAD_BAD_ROOM ' + t.id + '->' + t.room);
  if (t.tuning && !tunIds.has(t.tuning)) issues.push('TRAD_BAD_TUNING ' + t.id + '->' + t.tuning);
  if (t.chain_archetype && !archIds.has(t.chain_archetype)) issues.push('TRAD_BAD_ARCH ' + t.id + '->' + t.chain_archetype);
  if (t.production_aesthetic && !aesIds.has(t.production_aesthetic)) issues.push('TRAD_BAD_AES ' + t.id + '->' + t.production_aesthetic);
  if (!db.extras[t.id]) issues.push('TRAD_NO_EXTRAS ' + t.id);
}
for (const k of Object.keys(db.extras)) if (!tradIds.has(k)) issues.push('EXTRAS_ORPHAN ' + k);  // I4
for (const [k, e] of Object.entries(db.extras)) {
  if (e.parent && !db.byNode[e.parent]) issues.push('EXTRAS_BAD_PARENT ' + k + '->' + e.parent);
  (e.crossRefs||[]).forEach(cr => { if (!db.byNode[crId(cr)]) issues.push('EXTRAS_BAD_CROSSREF ' + k + '->' + crId(cr)); });
  const ax = e.axes && typeof e.axes === 'object' ? Object.values(e.axes) : null;
  if (!ax || ax.length !== 13) issues.push('AXES_SHAPE ' + k);
  else if (ax.some(a => !Number.isInteger(a) || a < -2 || a > 2)) issues.push('AXES_RANGE ' + k);
}
for (const n of db.TREE_NODES) if (n.parent && !db.byNode[n.parent]) issues.push('TREE_BAD_PARENT ' + n.id);  // I5
const byCat = {}; issues.forEach(s => { const c = s.split(' ')[0]; byCat[c] = (byCat[c] || 0) + 1; });
console.log(JSON.stringify({ totalIssues: issues.length, byCategory: byCat, sample: issues.slice(0, 8) }));
```
**Verified on shipped data:** `{"totalIssues":0,"sample":[],"byCategory":{}}` — fully
consistent. (Two subtleties make this true: the disjoint-`applies_to` `MULTI_DEFAULT`
exception covers `wind.wind_articulation` and `percussion.percussion_technique`; and
crossRefs are normalized via `cr.ref ?? cr` since 67 are `{ref,voice_isolated}`/`{ref,isolated_parts}` objects.) The
checker also flags injected damage — a dup instrument id, bad `family`, orphan extras
key, tradition with no extras, and bad extras `parent` yield `DUP_INST oud`,
`BAD_FAMILY frob`, `EXTRAS_ORPHAN x_orphan`, `TRAD_NO_EXTRAS x_bad`,
`EXTRAS_BAD_PARENT x_orphan` (verified).

---

## 6. Validation checklist (run before every return)

Run IN ORDER. Stop and fix on any hard failure; record soft items in
`validation.issues`. Then set `validation.checked = true`.

1. **Shape** — recipe is a non-empty string ≤1000 chars, OR arrangement has
   `meta.title` and every `ensemble[]` item has a resolving `instrument_id`.
2. **All ids resolve** — `instrument_id`, each `parts[].part_id`/`variant_id`,
   `room_id`, `tuning_id`, `chain.archetype_id`, `aesthetic_id`, and
   `meta.tradition`/`meta.blend[]` exist in their tables. (Inline `chain.*` components
   are free vocab → soft, not hard.)
3. **Part valid for instrument** — every `part_id ∈ db.partsFor(instrument_id)`, and
   `variant_id` belongs to that part.
4. **Tuning coherence** — all tunings in use share a family (read `descriptors`/`sub`);
   mixing Western with maqam/gamelan/just is a hard flag unless intentional.
5. **Era/region coherence** — if a tradition is named, the room/archetype/aesthetic eras
   and regions are consistent with its `lineage`; flag obvious anachronisms as soft.
6. **No exemplar/proper names in `recipe`** — none of the tradition's `exemplars[]` (or
   archetype `exemplar_studios[]`) appears in the output; no axis numbers printed.
7. **Recipe budget** — `recipe.length ≤ 1000`; catalog defaults dropped.
8. **Nothing left unlooked-at** — every id emitted was checked by ≥1 rule above;
   `validation.issues` lists every soft finding; no placeholder/TODO ids.

### Verified arrangement validator

```js
// validate.js — CODEX_REF=/abs/references node validate.js arrangement.json
const db = require('./q.js'), fs = require('fs');
const A = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const hard = [], soft = [];
const partsIndex = id => { const m = {}; db.partsFor(id).forEach(p => m[p.id] = p); return m; };
if (!A.meta || !A.meta.title) hard.push('meta.title missing');
const trads = A.meta ? (A.meta.tradition ? [A.meta.tradition] : (A.meta.blend || [])) : [];
trads.forEach(t => { if (!db.byTrad[t]) hard.push('unknown tradition ' + t); });
(A.ensemble || []).forEach((c, n) => {
  const i = db.byInst[c.instrument_id];
  if (!i) { hard.push('chair ' + n + ': unknown instrument ' + c.instrument_id); return; }
  const pm = partsIndex(c.instrument_id);
  (c.parts || []).forEach(pp => {
    const p = pm[pp.part_id];
    if (!p) { hard.push('chair ' + n + ': ' + i.id + ' has no part ' + pp.part_id); return; }
    if (pp.variant_id && !(p.variants || []).some(v => v.id === pp.variant_id))
      hard.push('chair ' + n + ': variant ' + pp.variant_id + ' not in ' + pp.part_id);
  });
});
if (A.room_id && !db.byRoom[A.room_id]) hard.push('unknown room ' + A.room_id);
if (A.tuning_id && !db.byTuning[A.tuning_id]) hard.push('unknown tuning ' + A.tuning_id);
if (A.aesthetic_id && !db.byAes[A.aesthetic_id]) hard.push('unknown aesthetic ' + A.aesthetic_id);
if (A.chain && A.chain.archetype_id && !db.byArch[A.chain.archetype_id])
  soft.push('archetype not in CHAIN_ARCHETYPES (free-vocab if intentional): ' + A.chain.archetype_id);
if (typeof A.recipe === 'string') {
  if (A.recipe.length > 1000) hard.push('recipe over 1000 chars (' + A.recipe.length + ')');
  trads.forEach(tid => (db.extras[tid] ? db.extras[tid].exemplars || [] : []).forEach(name => {
    const base = String(name).split(/[—\-(]/)[0].trim();
    if (base.length > 3 && A.recipe.includes(base)) hard.push('recipe leaks exemplar name: ' + base);
  }));
}
console.log(JSON.stringify({ ok: hard.length === 0, hard, soft, recipeLen: (A.recipe || '').length }, null, 1));
```
On the §4 worked example: `{"ok":true,"hard":[],"soft":[],"recipeLen":480}` (verified).
On a deliberately broken arrangement (unknown instrument `NOPE`; a `brass_mute` part the
acoustic guitar can't take; a real `acoustic_technique` part with a bogus
`acoustic_moonwalk` variant; unknown room/tuning/aesthetic; a made-up archetype; and a
recipe containing "Bill Monroe") it returns `ok:false` with hard items
`unknown instrument NOPE`, `chair 1: acoustic_guitar_dread has no part brass_mute`,
`chair 2: variant acoustic_moonwalk not in acoustic_technique`, `unknown room room_NOPE`,
`unknown tuning tuning_NOPE`, `unknown aesthetic aesthetic_NOPE`, `recipe leaks exemplar
name: Bill Monroe`, and the made-up archetype in `soft` (verified).

---

## 7. Efficiency rules & failure modes

**Token/efficiency**
- Load once with `q.js`; reuse `db.by*` and `db.partsFor`. Never re-parse the 1–2 MB
  bundles per query.
- Project to `{id,name}` and `slice`/`head` before printing — never dump a full table
  (651 instruments / 1195 traditions — a lot of tokens).
- Prefer counts/samples while exploring; pull full records only for the few ids that
  land in the output.
- For a single name lookup, `grep -oE "name: '…'"` beats spinning up node.

**Failure modes & disambiguation**
- **Wrong load method**: `require()` returns `{}` for files 01–06/08 (no exports). Use
  the §2 loader shim. `require` works only for `07`.
- **`axes` confusion**: it's an object (`{harm:1,…}`), not an array; `tradition.family`
  is a genre bucket, not an instrument family. Don't cross them.
- **Tree paths / crossRef objects**: see §1 — skipping `cr.ref ?? cr` normalization
  produces false "broken ref" reports.
- **Multiple / non-literal names**: names aren't unique and can be non-literal —
  disambiguate by `id` (always unique); list candidates as `id + name + family`.
- **Part not applicable**: if a technique isn't in `db.partsFor(id)`, the instrument
  can't take it — pick a different instrument or a part it has; don't fabricate part ids.
- **`chain_*` components are free vocabulary** (no table). Treat unknown component
  strings as opaque ids; only `archetype`/`room`/`tuning`/`aesthetic`/`instrument`
  resolve to tables. Prefer an archetype over hand-set components.
- **Multiple defaults are sometimes legal**: a family part may have >1 `default:true`
  variant when their `applies_to` scopes are disjoint (e.g. `percussion_technique` has
  separate defaults for drum kit, hand drums, mallets). Only overlapping defaults are bugs.
- **Exemplar leakage**: the most common output error is letting an artist/band/studio
  name from `exemplars[]`/`exemplar_studios[]` into the recipe. The §6 validator catches
  it — always run it.
- **Anachronism / incoherence**: data is descriptive and occasionally non-literal
  (names, `lineage`). Don't "fix" the dataset; surface the mismatch as a soft
  `validation.issues` note and proceed with the ids.
- **`PREFACE_LEXICON` is not a parts/conflicts table**: it's vocal/character token
  bundles. Don't expect `targets`, `ops`, or `conflicts` fields.

When in doubt, re-run §6's `validate.js`. A clean `{"ok":true,"hard":[]}` (with any
issues confined to `soft`) is the bar for returning any output.

---

## 8. GUI ↔ agent capability map

The browser app (`codex.html`) and this agent path are two front-ends over the **same
engine**. Anything a human does by clicking in the app, you can do from `scripts/`. This
table maps every interactive GUI capability to the command that reproduces it, so nothing
the human can do is out of reach for an agent. (All commands verified against the real
data; run from the repo root. Add `--json` where noted for machine-readable output.)

### Browse & look things up

| In the app | Agent command |
|---|---|
| Browse traditions / instruments / rooms / tunings | `node scripts/list.js --traditions` (or `--instruments`, `--rooms`, `--archetypes`, `--aesthetics`, `--tunings`, `--tree`, `--variants --instrument=<id>`) — filters are per-section: `--traditions` takes `--family=`/`--parent=`; `--instruments` takes `--family=`/`--has-part=`; `--rooms`/`--archetypes` take `--era=`/`--region=`/`--scale=` |
| Chain-section menu (mic/pre/console/…) contents | `node scripts/list.js --section <mic\|pre\|console\|comp\|eq\|medium\|fx\|amp>` |
| Deep-view one entry with its refs resolved | `node scripts/expand.js --tradition <id>` (or `--instrument`, `--room`, `--archetype`, `--aesthetic`, `--tree`) — emits JSON |
| Tradition fingerprint strip (13-axis profile) | `node scripts/fingerprint.js <tradition_id>` (`--json`; optional `--aesthetic=<id>`) |

### Find similar (nearest-neighbor) — the app's "Find similar" buttons

| In the app | Agent command |
|---|---|
| "Find similar" on a tradition leaf | `node scripts/nearest_neighbor.js --type tradition --id <id>` |
| "Find similar" on a card (similar instruments) | `node scripts/nearest_neighbor.js --type instrument --id <id>` |
| Keyword search across traditions | `node scripts/nearest_neighbor.js --type tradition --keyword "<term>"` |
| Axis-vector search | `node scripts/nearest_neighbor.js --type tradition --axes "harm:1,density:2,…"` |
| Neighbors of a variant / tree-node / chain-item / room | `--type variant\|tree-node\|chain-item\|room --id <id>` |

Verified: `nearest_neighbor.js --type instrument --id voice` → top neighbor `griot_voice`
(score 0.80); `--type tradition --id delta_blues` → `jug_band` (0.31).

### Compare & diagnose

| In the app | Agent command |
|---|---|
| Compare two traditions structurally | `node scripts/compare.js --traditions <a> <b>` (axis deltas, instrument Venn, room/chain diff) — also `--instruments`, `--rooms`, `--archetypes` |
| "Why did this variant win?" (per-slot scoring) | `node scripts/inspect.js --tradition=<id>` (`--staples=<id1,id2>`, `--instrument=<id>`, `--part=<id>`, `--runner-up=N`, `--filtered`) |
| Why a recipe came out the way it did | `node scripts/recipe.js --tradition=<id> --why` / `--why-prefaces` (each has a `-json` variant) — see §3f |
| Full descriptor stack a config draws from | `node scripts/stack.js --tradition=<id>` (`--mode=cloud` for the merged weighted cloud) |

### Build, customize & shape the recipe

These are in §3 — cross-referenced here for completeness:
- Ensemble from a tradition → §3a. Select by capability/genre → §3b. Chain+room+tuning → §3c.
- **Customize / delete / add / blend** instruments → §3f (`recipe.js` `--swap-variant` /
  `--exclude-instrument` / `--add-instrument` / `--diff`).
- **Reshape toward a preface** (the app's preface inverse) → §3g (`preface_configure.js`).
- Stapling **order** sets recipe lead order (matches dragging groups up/down in the app) → §3f.

### Extend the catalog (the app has no UI for this — agent/CRUD only)

| Task | Agent command |
|---|---|
| Pre-flight a new tradition before adding | `node scripts/placement_check.js --id <new_id> --parent <tree_path> [--instruments id1,id2] [--room <id>] [--archetype <id>] [--tuning <id>]` |
| Add / edit / delete entities + invariants | §5 (then `validate.js`, then `build_signatures.js` if signatures changed) |
| Surgical field edit on one tradition (asserts prior value + unique match) | `node scripts/_apply_trad_edits.js` (see its usage header) |

**Parity guarantee.** If you find a GUI capability with no command here, it's a
documentation gap, not a missing feature — the engine is shared. Check `scripts/` (every
file has a usage header) and `tests/ui_capability_inventory.md` (the canonical list of
GUI surfaces), and prefer adding a thin script wrapper over reimplementing engine logic.

---

## 9. Building a faithful recipe — the complete checklist

§3 shows the happy path. This section is the **exhaustive** reference for getting a recipe to
faithfully match a *specific real recording* — every lever that shapes the output, the gotchas where
a default silently overrides your intent, and a pre-flight checklist. All of it is verified by driving
the real engine; the gotchas are real (each bit during dogfooding).

### 9.1 The complete set of levers (what actually shapes a Rich recipe)

A browser/Rich recipe (`compileRecipeStack(cards, 'rich', {})`) is built **entirely from the cards** —
nothing else. There are exactly these levers, and no others:

| Lever | Where it lives | What it controls in the output |
|---|---|---|
| **Which traditions** | `card.traditionId` per card | the genre header + each card's signature-token baseline + which prefaces score well |
| **Tradition ORDER** | order of cards in the array | header reads `Name1 + Name2, …` in **first-appearance order**; reorder cards to reorder the header (and the per-instrument order) |
| **Which instruments** | one card per instrument | the instrument chunks (the body of the recipe) |
| **Instrument PART variants** | `card.parts[<partId>] = <variantId>` | the post-noun descriptor stack per instrument (material/technique/lineage/**era**) |
| **Tuning** | `card.tuning` | the tuning chunk (e.g. `arabic-maqam-framework: microtonal-bend`) |
| **Room** | `card.room` | the room chunk (acoustics) |
| **Signal chain** | `card.chain.{mic,pre,comp,eq,medium,console,amp,fx}` | the chain chunks (gear) **and** (for 4 of the 8 stages) the prefaces |
| **Preface** | `card.preface` + `card.prefaceAuto` | the per-card affective label; auto-derived unless locked |

> **Not levers for the Rich/browser recipe:** `ARRANGEMENTS` and `PRODUCTION_AESTHETICS` do **not**
> enter `compileRecipeStack` at all (verified: 0 references in the browser compile path; its signature is
> `compileRecipeStack(cards, format, options)` — no arrangement param). They are **CLI-only** —
> `recipe.js --arrangement=<id>` and a tradition's `production_aesthetic` field feed the `translate.js`
> renderer, a *different* output from the four named formats. Verified both directions:
> `recipe.js --tradition delta_blues --arrangement twelve_bar_blues_repeated` injects a clause
> (`twelve-bar blues repeated, twelve bar cyclic, i iv v foundation, call and response within cycle`)
> that the browser Rich for the same tradition does **not** contain. If a user asks for the "Rich"
> recipe, arrangement/aesthetic are irrelevant; don't reach for them.

### 9.2 The chain stages — SCORED vs cosmetic (non-obvious, matters)

`CHAIN_SECTIONS` = `fx, amp, mic, pre, comp, eq, medium, console`. They split into two classes:

- **SCORED** — `mic`, `pre`, `medium`, `console`. Their item `descriptors` are pooled into the card's
  descriptor set (`_card_descriptors.js`), so **changing these changes which preface auto-selects.**
- **Cosmetic-only** — `fx` (multi-select), `amp`, `comp`, `eq`. They render in the recipe text but do
  **not** affect preface scoring.

Practical consequence: if you set a period-correct mic/pre/medium/console, expect the preface to move
too (that's correct). If you want to change the *sound description* without disturbing prefaces, the
cosmetic stages are safe.

### 9.3 GOTCHA — derived/inherited state does NOT auto-propagate (override per-axis)

The single biggest source of "the recipe says the wrong thing." Three independent instances, all real:

**(a) Relocating `room` does NOT move the `chain`.** A card's chain comes from the tradition's inline
`chain_*` fields, fixed at `importTradition` time — not from the room and not from the chain archetype.
So setting `card.room` to a period studio leaves an anachronistic chain behind (e.g. a "1968 Düsseldorf
Kling Klang" room with an "SSL-clone 1989" chain). **Fix:** set `card.chain` explicitly to the period
archetype's components. To read an archetype's components:
```bash
node scripts/list.js --archetypes 2>&1 | grep -A1 arch_acoustic_horn_pre1925
# arch_acoustic_horn_pre1925  era=1900-1925 ...
#   components: mic=mic_acoustic_horn_pre1925  comp=comp_none  eq=eq_none  medium=shellac_78
```
then in the build: `card.chain = { fx:[], amp:null, mic:'mic_acoustic_horn_pre1925', pre:null, comp:null, eq:null, medium:'shellac_78', console:null }`.

**(b) `makeCard(id, {traditionId})` does NOT inherit tuning/room/chain.** It sets
`tuning:null, room:null, chain:emptyChain()` — only `importTradition` populates those from the
tradition row. An instrument added via `makeCard` (the agent equivalent of `--add-instrument`) comes out
**bare** and renders without tuning/room/chain context. **Fix — copy from a sibling card** (the clean idiom):
```js
const sib = cards[0];  // any already-populated card in the same tradition
const c = makeCard('riq', { traditionId: TRAD, tuning: sib.tuning, room: sib.room, chain: { ...sib.chain } });
```

**(c) PART variants can carry an anachronistic ERA — from defaults *or* from preface-reshaping.**
Era/date lives inside part-variant `descriptors`, and era-bearing parts are **systemic across all 11
families** (e.g. `voice.voice_multitrack_stack`, `voice.voice_processing_chain`, `piano_pitch_standard`,
`cymbal_alloy`, pickup/string/lineage parts on guitars). Two ways a wrong era sneaks in: (1) the
instrument's **default** variant is modern, or (2) **locking a preface** via `commitPrefaceChange` runs
the inverse (§3g), which **re-picks** parts toward the preface's tokens and can land on an era-stamped
variant — in dogfooding, locking a 1949 vocal to `keening` reshaped its `voice_multitrack_stack` to a
*late-1980s-reverb-saturated-bus* variant, stamping "late-1980s" on the recipe. The signal-chain tweak
can't touch this — it's a *part*, a different axis. **Fix:** after any preface lock, re-check and
explicitly set era-bearing part variants. Find which
parts carry era on an instrument:
```bash
node -e 'const db=require("./scripts/_loader.js");const i=db.INSTRUMENTS.find(x=>x.id==="voice");
for(const p of i.parts){for(const v of (p.variants||[])){if(/\b(19|20)\d{2}\b|late-|early-|-era/.test((v.descriptors||[]).join(" "))){console.log(p.id,"->",v.id);break;}}}'
```
then set `card.parts[partId] = periodVariantId` (or via the CLI, `recipe.js --swap-variant=inst:part:variant`).

### 9.4 GOTCHA — preface dedup can cascade to a semantically-distant label

Recipe compile runs a **dedup**: no two cards may show the same preface in the rendered output. Each
card claims its top-scoring preface; collisions are resolved by giving it to the highest-scoring card and
bumping the losers to their *next-best*. With many cards in one tradition, the good on-genre prefaces get
claimed early and later cards cascade **past their whole top-N** to a leftover that can be cross-cultural
— e.g. a bluegrass fiddle labeled `erhuang` (Chinese opera), or a tarab violin labeled `mor-lam-storytelling` (Thai mor lam).
Worst case observed (dogfooding): a Notre-Dame-organum recipe whose voices cascaded to `street-pulsing`
(club) and pipe organ to `breaks-skittering` (breakbeat) — once every apt sacred preface had been claimed
by a higher-scoring card, the losers cascaded down the shared ranked list (the cause is generic-token
overlap, *not* a shallow pool — see below).

- **`card.preface` is NOT the rendered preface.** Dedup runs at *compile* time into a render-only
  override (`_RECIPE_PREFACE_OVERRIDES`, consumed by `_resolvePreface`); the stored `card.preface` is left
  untouched. So several cards can show the same `card.preface` value while the *recipe* renders them all
  distinct. When debugging prefaces, **read the rendered recipe, not `card.preface`.**
- **It is not a bad match** — the card's *true* top prefaces are right; dedup just couldn't give it one.
- **Root cause is generic-token overlap, not a shallow pool.** The matcher is pure token-overlap with no
  cultural awareness. Culturally-distant prefaces share *generic* tokens (`thick`, `grounded`,
  `speech-derived`, `high-falsetto`) with a card's descriptors, so they can score **as high as** the
  apt ones — e.g. a default chant voice ranks `jeong` (Korean) and `nadryv` (Russian) at the same 0.56
  as sacred prefaces. (The pool itself is usually deep — that same chant voice has ~106 scoring prefaces,
  not a handful; an earlier "shallow pool" reading was a measurement artifact of scoring a parts-stripped
  card.) So even the *top* picks can be cross-cultural, and **many same-tradition cards amplify it**:
  the more cards competing for the same high-scorers, the further down the shared ranked list the losers
  cascade.
- **Mitigation (verified) — an escalating ladder.** Set a card's preface by hand and it is
  **locked** (`prefaceAuto = false`) — dedup skips it and *reserves* its id, so the auto cards flow
  around it.
  - *Few same-instrument cards:* locking the lead vocal + 1-2 signature instruments is usually enough.
  - *Many cards competing (e.g. a big vocal/choir section, or a blend):* locking the lead alone only frees
    one id — the others still cascade. **Lock EVERY iconic card** (one apt preface each). Verified on the
    organum case: locking voice→`inshad-cantillating`, choir→`hymnic`, organ→`liturgical` fully rescued the
    primary positions (the lexicon does carry sacred prefaces: `inshad-cantillating, oli-chanting,
    liturgical, hymnic, monastic, doxological, devotional, sepulchral, penitential, sermonizing, oracular,
    …` — confirm an id exists before relying on it; e.g. there is no bare `cantillating`, only
    `inshad-cantillating`).
  ```js
  commitPrefaceChange(voiceCard, 'keening');   // locks it; reshapes settings toward the preface (see §3g)
  // or label-only, no reshape:  card.preface = 'keening'; card.prefaceAuto = false;
  ```
  (Locking via `commitPrefaceChange` runs the inverse and may move the card's room/tuning/parts — see §3g.
  If you've already period-pinned the chain, re-pin it after locking.)

### 9.4a GOTCHA — the same instrument across traditions COLLAPSES into one chunk (lossy in blends)

The Rich/Tags renderers group chunks by **trailing token (the instrument noun)**: two-plus chunks ending
in the same noun merge into one, prefaces stacked. Within one tradition this is tidy (a 12-piece
percussion bench renders as compact merged chunks). **In a blend it is lossy:** if `voice` appears in
4 stapled traditions, all four voice cards merge into a single `voice` chunk with their prefaces piled in
front (e.g. `street-pulsing rasping apollonian spoken-flowing voice`) — you **cannot** show "trap voice"
and "chant voice" as separate lines. Past ~3 same-noun cards the stack becomes an unreadable adjective
pile (a 41-voice stress build stacked 41 distinct preface words before one `voice:`). It never errors and
stays under ceiling, but the per-tradition distinction is gone. **If you need two traditions' takes on the same
instrument to read distinctly, give them different instrument *ids*** (e.g. `voice` vs a specific vocal
variant, or `violin_orchestral` vs `fiddle`) so they don't share a trailing noun — or accept the merge.

### 9.4b GOTCHA — the environment (tuning/room/chain) comes from the FIRST card only

The env section of a recipe is built from `cards[0]` alone — one shared sonic environment for the whole
recipe. Consequences:
- Only the **primary (first) card's** tuning/room/chain render as env chunks. Other cards' tunings survive
  *only* as their own instrument-level descriptors, never as an env tuning. A 5-tradition build with five
  incompatible tunings (12-TET + maqam + shruti + just + Pythagorean) renders just **one** env
  tuning — the first card's — and looks perfectly clean; the clash is **invisible, not flagged**.
- To make a particular tuning/room/chain drive the recipe, put that card **first** (reordering the array
  moves the env, confirmed). This is the same order-lever as the header (§9.1).
- Therefore **tuning coherence is the agent's judgment call, not something the output will surface** — the
  engine cannot show a tuning conflict because it only ever emits one env tuning. If you stapled
  incompatible-tuning traditions on purpose, fine; if not, the recipe won't warn you.

### 9.4c The engine is PERMISSIVE — it never validates your ids; §6 checks are mandatory

Verified by feeding deliberately-broken cards: an invalid part-variant id, a nonexistent tuning, and a
nonexistent room were all **silently dropped** (no throw, no raw id in the output — the valid parts still
rendered). A preface force-locked to a zero-overlap value was **held verbatim** (locks are absolute), and
**locked duplicates are NOT deduped** — three cards locked to the same preface all render it (dedup only
governs `prefaceAuto !== false` cards). Takeaways:
- The engine will not reject or flag a bad id; it just omits it. A recipe can **silently lack** a tuning
  or part you thought you set. So §6's "all ids resolve" is **mandatory, not optional** — validate before
  emitting.
- You *can* deliberately force duplicate prefaces by locking them (dedup won't touch locked cards).
- Empty card set → `compileRecipeStack` returns `''` (all formats). Guard against emitting an empty recipe
  after a delete-to-empty. Conversely, a **sparse** recipe is *verbose*, not short: the trim cascade
  expands per-instrument detail to fill the budget (a 2-card build dumped ~25 descriptors on a piano).

### 9.5 Pre-flight checklist — run before emitting a recipe for a specific recording

Research first (the tool's slots tell you what to find): **era, region, genre lineage, voice character,
instrumentation, recording technology**. Then:

1. **Tradition** — find it (`nearest_neighbor.js --type tradition --keyword …`, §8). Read its `lineage`
   and `extras.description` to confirm era/region fit. Prefer a tradition whose room/tuning already match
   over one you'd have to heavily retrofit.
2. **Instruments** — `importTradition` for the canonical roster; add/remove to match the real session
   (`--add-instrument` / `--exclude-instrument`, §3f). For every **added** card, set
   `{traditionId, tuning, room, chain}` from a sibling (§9.3b).
3. **Period accuracy — align ALL THREE era-bearing axes** (§9.3): (a) signal **chain** to the period
   archetype's components, (b) **room** to a period-appropriate space, (c) era-bearing **part variants**
   (don't trust modern defaults). Cross-check the rendered recipe for stray modern tokens
   (`grep -oE '(19|20)[0-9]{2}'`-style sanity on the output) — a 1949 song must not contain "1980s".
4. **Tuning** — set to the tradition's vocabulary tuning (maqam/shruti/pentatonic/etc.) or `twelve_tet`.
   If two cards use tunings from different families (Western vs maqam vs gamelan), that's a hard flag
   unless intentional (§6.4).
5. **Voice** — if voiced, set `voice_register / voice_quality / voice_vibrato` (and the era-bearing
   `voice_multitrack_stack` / `voice_processing_chain`) to match the singer; don't leave the modern-pop
   defaults.
6. **Prefaces** — let them auto-derive, then **lock the lead + signature instruments** if you see a
   cross-cultural cascade (§9.4). Iterate: a hand-locked anchor reshapes the others' cascade.
7. **Order** — put the primary tradition's cards first (header leads with it); reorder cards to reorder
   the header and instrument sequence.
8. **Compile + validate** — `compileRecipeStack(cards, 'rich', {})` (§3h), then run §6:
   ≤1000 chars, no artist/band/exemplar names, no axis numbers, all ids resolve, sealed with `.`.
9. **Iterate, don't one-shot** — build 2-3 variants (with/without a stapled tradition, different period
   archetypes, different preface locks) and compare. The catalog rewards play.

### 9.6 Quick reference — "the recipe says X, I wanted Y"

| Symptom | Cause | Fix |
|---|---|---|
| Right room, wrong-era gear | chain ≠ room (§9.3a) | set `card.chain` to the period archetype's components |
| Added instrument has no tuning/room/chain | `makeCard` doesn't inherit (§9.3b) | copy `{tuning,room,chain}` from a sibling card |
| Modern year on an old recording | default part variant carries era (§9.3c) | swap the era-bearing `card.parts[partId]` |
| Cross-cultural preface on a card | dedup cascade (§9.4) | lock the iconic cards' prefaces |
| Changing mic/pre/medium/console moved the preface | those stages are SCORED (§9.2) | expected; use cosmetic stages (fx/amp/comp/eq) to avoid it |
| Recipe over 1000 chars | (rare) trim cascade exhausted | drop a low-priority instrument, or accept the `[+N hidden]` notice |
| Arrangement/aesthetic not in Rich output | they're CLI-only (§9.1) | use `recipe.js` if you need them; they don't apply to the four browser formats |
