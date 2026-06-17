# Connector ⇄ Current Recipe: Workspace Parity Plan

**Status:** design / diagnose-only (no engine code changed)
**Branch of record:** `claude/epic-rubin-rolpj6` · deploy branch is `claude/happy-lamport-8t4yw5`
**Decisions (made):** state model = **state-passing**; anti-drift = **parity-gate-first**

---

## 1. The problem (one sentence)

The connector models recipe-making as a **one-shot optimizer**
(`seedFromTradition → search() hill-climb → render`), while the app models it as a
**deterministic, editable workspace** (`importTradition → default cards → edits`).
Same data, two paradigms — so the connector's output cannot equal the "Current
Recipe," no matter how the renderer is unified.

### Evidence (same tradition, `garage_rock`)

| | Current Recipe (app) | Connector (`generate_recipe`) |
|---|---|---|
| Header | `Garage rock,` (primary only) | `Garage rock + Punk + Hardcore punk,` (auto-stapled) |
| Guitar | alder / alnico (clean garage) | mahogany / ceramic / palm-muted (search-optimized) |
| Leslie | 122 | 760 |
| Driver | `addCard` defaults, no search | `search()` hill-climb |

The renderer is **already** shared (`scripts/_recipe_stack.js`,
`renderRecipeFromConfig`). Unifying it was necessary but not sufficient: the
**input** differs (search-optimized + auto-stapled config vs. deterministic
default cards). The fix is the input pipeline, not the renderer.

### The state gap

Human edits **accumulate** on a persistent workspace; change a preface and the
settings deterministically re-derive (`inverseConfigureForPreface`,
`src/app.js:3226` via `commitPrefaceChange:3556`), then you keep editing. The
connector has **no workspace** — every call re-derives from scratch, and
`apply_preface`'s deterministic result is discarded when the next
`generate_recipe` re-runs `search()`.

---

## 2. Target model — a headless driver of the app's workspace

The connector is the same editable workspace the human drives, with no UI.
Deterministic end to end. **No `search()`, no auto-staple.**

- **Workspace = `app.cards`:** an ordered list of cards.
- **Output = the Rich render of the workspace** = the Current Recipe, returned by
  **every** operation.
- **State-passing:** each op takes the workspace JSON in and returns the new
  workspace + rendered recipe. The model threads it. Workspaces are ~1–3 KB.
  (Rationale: stateless, deterministic, replayable, horizontally scalable, no
  session affinity. A server-side session wrapper keyed on `Mcp-Session-Id` can
  be added later as pure sugar over the same ops.)

### Workspace / card schema (the contract)

```jsonc
// Workspace
{ "cards": [ Card, ... ] }              // order is recipe order

// Card  (mirrors src/app.js makeCard / addCard)
{
  "id":           "card_x9",            // stable handle for edits
  "instrumentId": "electric_guitar_single_coil",
  "traditionId":  "garage_rock",        // provenance; drives the genre header
  "parts":   { "<partId>": "<variantId>", ... },
  "tuning":  "twelve_tet" | null,
  "room":    "concrete_basement" | null,
  "chain":   { "mic":id, "pre":id, "comp":id, "eq":id, "medium":id,
               "console":id, "amp":id, "fx":[id,...] },
  "preface":     "evangelizing" | null, // lexicon id
  "prefaceAuto": true | false           // true = auto-deduped; false = user-locked
}
```

---

## 3. Operation set (the function surface; "12 tools" is irrelevant)

Each mutation returns `{ workspace, recipe, recipe_chars }`. `cardRef` = card `id`
(or instrument id when unambiguous).

| Op | App equivalent | Effect |
|---|---|---|
| `seed(traditions[])` | `importTradition` | Build deterministic default cards for each listed tradition (primary roster, **explicit** list — no auto-staple). |
| `add_tradition(ws, id)` | `importTradition` (append) | Append that tradition's default cards. |
| `remove_tradition(ws, id)` | filter cards `:2022` | Drop all cards whose `traditionId === id`. |
| `add_instrument(ws, instrumentId, ctx?)` | `addCard` `:1988` | Seed a default card (optionally in a tradition's context). |
| `remove_instrument(ws, cardRef)` | filter cards | Drop the card. |
| `set_preface(ws, cardRef, prefaceId)` | `commitPrefaceChange→inverseConfigure` | **Deterministically re-derive** that card's parts/env/chain to the preface; set `preface`, `prefaceAuto=false`. Still editable afterward. |
| `set_variant(ws, cardRef, part, variant)` | `card.parts[p]=v` `:2176` | Override one part variant. |
| `set_environment(ws, cardRef, {room?,tuning?,chain?})` | `card.room/tuning/chain` `:2190/2205/2235` | Override room / tuning / chain stage(s). |
| `render(ws, {format:'rich', max_chars:1000})` | `compileStack(cards,'rich')` | Explicit render (also embedded in every op return). |
| **discovery** (unchanged) | `search_catalog`, `list_*`, `search_prefaces` | Resolve words → ids. Lookups, no state. |

**MVP** (covers everything described): `seed`, `set_preface`, `set_variant`,
`add_instrument`, `remove_instrument`, `add_tradition`, `remove_tradition`,
`render` + discovery.

### Discarded
`seedFromTradition` + `search()` as the recipe driver; auto-staple; `translate()`
prose; the "generate = one-shot optimizer / affordances / why-scoring" framing.
`blend_traditions`' weight dial and `recipe_from_axis` have **no Current-Recipe
analog** — a blend is just `add_tradition` (full roster, deterministic), and
axis-target degrades to a *discovery helper* (`findClosestTraditionByAxis`)
returning a tradition id you then `seed`, not a rendered recipe.

---

## 4. Reuse vs. build

**Reuse (already extracted, SSOT on the deploy branch):**
- `scripts/_recipe_stack.js` → `compileStack(cards,'rich',ceiling)`,
  `assignDedupedPrefaces`, `_resolvePreface`, the trim cascade. The renderer.
- `scripts/_inverse_configure.js` → `inverseConfigure(card, prefaceId)`
  ("identical to the browser's `inverseConfigureForPreface`"). Powers `set_preface`.
- `scripts/_preface_match.js`, `scripts/_card_descriptors.js`, `scripts/corpus.js`
  → preface ranking + catalog search (discovery).

**Build (the missing deterministic pieces):**
1. **`seedTraditionCards(traditionId)`** — a shared port of `importTradition`
   (`src/app.js:2027`). ⚠️ `seedCard` in `_inverse_configure.js` is a *simpler*
   seed (default variant per part + partial chain); it is **not** byte-equal to
   the app's import, which also applies voice-part overrides
   (`TUNING_TO_VOICE_PARTS`), per-class amp resolution (bass vs. guitar), and the
   full chain (comp/eq/fx/amp). The seed must replicate `importTradition` or the
   seed-parity gate (§6) will fail.
2. **`renderRecipeFromCards(cards, format, ceiling)`** — `compileStack` renders
   cards but without the genre header; port `_recipeHeader(cards)`
   (`src/app.js:3029`, cards-based, primary-roster) so `render = header + body`.
   (`recipeHeaderFromConfig` exists but derives the header from a *config*'s
   stapled traditions — wrong source for the workspace model.)
3. **Workspace op layer** — the thin state-passing functions in §3 over the
   above. Lives in `mcp/` (e.g. `mcp/workspace.js`), exposed by `mcp/tools.js`.

---

## 5. Anti-drift / SSOT — parity-gate-first

Today the renderer + inverse-configure exist in **two** places — `src/app.js`
(browser) and `scripts/_recipe_stack.js` + `_inverse_configure.js` (Node) — as
"behavior-preserving copies" guarded by tests, **not literally shared by the
browser**. That copy-pair is the drift vector behind everything above.

- **Now (parity-gate-first):** a CI gate that fails if, across the whole catalog,
  `src/app.js` output ≠ the shared `scripts/` modules — for the renderer **and**
  for `inverseConfigure` vs `inverseConfigureForPreface`. `scripts/smoke.js`
  already does part of the render parity; extend it to inverse-configure, the seed,
  and the workspace ops.
- **Fast-follow (full SSOT):** bundle the `scripts/` modules into the browser
  build and delete `app.js`'s inline copies, so there is one literal source. Larger
  refactor (bundling), so it lands after the gate is green.

---

## 6. Verification — the contract that "connector == Current Recipe"

Three regression gates:
1. **Seed parity:** ∀ tradition, `seed(t) + render('rich')` ≡
   `app.importTradition(t) + compileRecipeStack('rich')` — byte-equal.
2. **Preface parity:** `set_preface(card, p)` ≡ `app.commitPrefaceChange(card, p)`
   — same resulting `parts`/`room`/`tuning`/`chain` **and** same rendered string.
3. **Edit-sequence parity:** `seed → set_preface → set_variant → add_instrument →
   add_tradition` reproduces the same end-state recipe as the equivalent UI clicks.

---

## 7. Phased implementation checklist

- [ ] **P0 — Consolidate branches.** Bring the deploy branch's shared modules
  (`_recipe_stack.js`, `_inverse_configure.js`, `_preface_match.js`,
  `_card_descriptors.js`, `corpus.js`) onto the branch of record; retire the old
  `translate()`-based `mcp/engine.js`.
- [ ] **P1 — `seedTraditionCards`.** Port `importTradition` faithfully; land the
  **seed-parity** gate (§6.1). This alone makes a freshly-seeded recipe equal the
  Current Recipe.
- [ ] **P2 — `renderRecipeFromCards`.** Header-from-cards + `compileStack`. Wire
  `render`.
- [ ] **P3 — Workspace ops.** `add/remove_instrument`, `add/remove_tradition`,
  `set_variant`, `set_environment` (pure state-passing mutations).
- [ ] **P4 — `set_preface`.** Via shared `inverseConfigure`; land **preface-parity**
  gate (§6.2).
- [ ] **P5 — Edit-sequence gate** (§6.3) + discovery passthrough
  (`search_catalog`/`list_*`/`search_prefaces`).
- [ ] **P6 — Tool surface.** Replace `generate_recipe`/`blend_traditions`/
  `recipe_from_axis` with the workspace ops; axis → discovery helper.
- [ ] **P7 — Full SSOT** (browser imports shared modules; delete inline copies).

---

## 8. Risks / open items

- **Seed fidelity** (§4.1) is the make-or-break: any divergence from
  `importTradition` shows up as a different Current Recipe. The seed-parity gate
  catches it.
- **Card identity for edits.** `cardRef` needs to disambiguate duplicate
  instruments (e.g. two guitars). Card `id` handles it; instrument-id shorthand is
  a convenience only when unique.
- **Discovery stays as-is** — `search_catalog` etc. are lookups and already
  correct; they are not part of the determinism problem.
- **Blend/axis semantics change** — anyone relying on weighted-blend or
  axis-rendered recipes loses them; messaging needed. They were search-only
  concepts with no app equivalent.
