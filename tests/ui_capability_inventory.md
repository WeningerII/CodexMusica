# UI capability inventory

The single source of truth for every interactive surface in the codex. Read this before changing the UI. Update this in the same commit as any UI change. The build's reachability gate (`scripts/ui_reachability_check.js`) enforces that every `status: reachable` entry's selector resolves to at least one element under the entry's precondition. Surfaces that aren't catalogued here are invisible to the build gate, which is how the master-detail refactor silently dropped the stack signature panel, the tradition-group delete, and three drag-drop interactions.

**Updated:** 2026-09-30 for the redesigned Lyrics page (see "Lyrics page"), 2026-09-26 for the photo lightbox (a catalog photo enlarges on a click; see "Photo lightbox" at the end), and 2026-09-25 for the reference Your recipe panel (right-hand column, row and genre menus, Recording environment, Recipe preview format, AI entry; see "Your recipe — the reference panel" at the end) and before that for the shared UI foundation (theme, shell, one recipe panel on every route, lifecycle states; see `docs/ui-foundation.md` and the section at the end). Previously 2026-09-12 for the production shared workspace. Reachability is enforced by `scripts/ui_reachability_check.js`; this structural check proves selectors exist under stated preconditions, not that every workflow is usable. Browser mobile checks and `scripts/check_workbench.js` cover separate interaction and state boundaries.

---

## Maintenance protocol — three rules

**Rule 1. Adding a new interactive surface → add an inventory entry in the same commit.** The reachability check won't pass without it. If a `data-action` value appears in `handleAction`'s switch with no corresponding entry, it's invisible to the gate. Same for any modal, keyboard shortcut, drag-drop interaction, or named widget.

**Rule 2. Refactoring a UI surface → update the entry's `selector` and `surface` fields.** If you move a button from `.card-foot` to `.detail-actions`, the selector changes. The check fails until the inventory catches up. Treat the failure as a forcing function, not noise.

**Rule 3. Intentionally dropping a feature → flip `status` to `retired` and add a `notes` field with the rationale.** Do not delete the entry. Retired entries are the historical record of "this used to exist, here's why it doesn't anymore." The check skips them. Future refactor planners read them to understand intentional drops vs. accidental ones.

---

## Entry schema

Every entry lives inside a fenced YAML block. The parser at `scripts/_inventory_parser.js` scans for ```yaml ... ``` blocks and treats each as one entry. Schema:

| Field | Required | Allowed values | Meaning |
|---|---|---|---|
| `name` | yes | unique kebab-case string | Identifier for this capability |
| `kind` | yes | `data-action`, `widget`, `modal`, `keyboard-shortcut`, `drag-drop` | What kind of interactive surface |
| `selector` | yes | CSS selector string | The reachability check verifies this resolves to ≥ 1 element |
| `surface` | yes | human-readable string | Where the user sees this in the UI |
| `implementation` | yes | function name or handler reference | Where the work happens in JS |
| `status` | yes | `reachable`, `pending`, `retired` | Build gate enforces `reachable` only |
| `precondition` | yes | see "Preconditions" below | What state to set up before the check |
| `notes` | no | freeform string | Rationale for retired, planned-work pointer for pending, etc. |

### Preconditions

The reachability check supports these standardized preconditions. The check groups entries by precondition to amortize setup cost across multiple verifications.

| Precondition | Setup |
|---|---|
| `empty` | No setup. Workspace has 0 cards. |
| `1+ cards` | `addCard('electric_guitar_single_coil', { traditionId: 'outlaw_country' })` then select that card. |
| `2+ cards` | Add `electric_guitar_single_coil` (outlaw_country) and `acoustic_guitar_dread` (bluegrass), select the first. |
| `editing part` | 1+ cards, then `card._uiTab = 'parts'` and `card.editingPart = 'electric_technique'` to expand the variant picker. |
| `viewing env tab` | 1+ cards, then `card._uiTab = 'env'`. |
| `editing env: tuning` | 1+ cards, then `card._uiTab = 'env'` and `card.editingEnv = 'tuning'`. |
| `editing env: room` | 1+ cards, then `card._uiTab = 'env'` and `card.editingEnv = 'room'`. |
| `viewing chain tab` | 1+ cards, then `card._uiTab = 'chain'`. |
| `editing chain stage` | 1+ cards, then `card._uiTab = 'chain'` and `card.editingChainStage = 'mic'` (bare ID from CHAIN_SECTIONS, not the `chain_mic` storage key). |
| `viewing parts tab` | 1+ cards, then `card._uiTab = 'parts'`. |
| `viewing preface tab` | 1+ cards, then `card._uiTab = 'preface'`. |
| `drift active` | 1+ cards, then `card.drift = buildDriftCandidates(card)`. |
| `pinned card` | 1+ cards, then `card.pinned = true`. |
| `stack panel open` | 1+ cards, then `card._uiTab = 'stack'` and `card.stackPanel = { format: 'prose' }`. |
| `instrument picker open` | `openModal('modal-add')` (which `uiOpenSurface` turns into the Instrument page) then `renderInstrumentDiscovery()`. The legacy Add-instrument modal and its `renderInstPicker` were removed on 2026-09-26; `modal-add` is only the route name now. |
| `instrument picker open, filter active` | Add one sound-property filter (`INSTRUMENT_FILTER_PILLS[0].id`) to `app.instrumentAxisFilters`, then as `instrument picker open`. Surfaces the Clear control, which only appears when ≥1 filter is active. |
| `tradition picker open` | `renderTradPicker()` then `openModal('modal-trad')`. Required when the entry's selector targets a CHILD of the modal (a tree node, leaf button) — same reasoning as `instrument picker open`. |
| `tradition picker open, tree expanded` | Same as `tradition picker open`, then add every `data-toggle-tree` id to `app.treeExpanded` and re-render. Surfaces leaf-level buttons (`Import`, `Find similar`) that only render under expanded tradition nodes. |
| `recipe stack modal open` | 1+ cards, then `renderRecipeStack()` then `openModal('modal-recipe-stack')`. The recipe-stack body renders its empty-state ("No instruments on the canvas yet") when `app.cards` is empty, so cards must be added first. |
| `preface just committed with shifts` | 1+ cards, then `card._uiTab = 'preface'`, then `commitPrefaceChange(card, 'liturgical')`. `delta_blues` voice + `liturgical` reliably produces non-empty shifts (tuning + room changes) via the inverse algorithm, which populates `_recentShiftsByCard` and surfaces the panel. |
| `instrument picker open, similar drill-down active` | Set `app.similarInstFor = 'voice'`, then `openModal('modal-add')`: `uiOpenSurface` opens that instrument in the Instrument page's inspector, with its similar instruments. |
| `saved workspaces list open` | Install a `window.storage` mock (the RESET does this automatically when no real storage exists — Claude.ai provides one, headless Chromium doesn't), seed one workspace fixture into both `codex:list` and `codex:ws:gate-fixture`, then `openModal('modal-saved')` and `await renderSaved()`. Surfaces one row with Load / Fork / Delete controls. The `_gate_mock` flag on the mock prevents the fixture preconditions from polluting real storage if it's ever present. |
| `genre search: no results` | Type a query no genre matches into `#genre-search`, clear `UI.genre`, `renderGenreDiscovery()`. Surfaces the no-results state and its Clear search. |
| `instrument search: no results` | Type a query no instrument matches into `#instrument-search`, `renderInstrumentDiscovery()`. Surfaces the no-results state and its recovery actions. |
| `genre just imported` | `await importTraditionWithFeedback('delta_blues')`. Surfaces the import toast and its Undo action. |
| `genre: all genres` | Click the Genre page's All genres tab. In Rows (the default layout) it is one row per first letter with the A–Z bar. RESET returns the page to Start exploring in Rows. |
| `genre list layout` | Click the Genre page's List layout button (Rows is the default). Surfaces the List rows. RESET returns the page to Rows. |
| `map view` | `uiNavigate('map')`. The Map presents Your recipe as a dock. RESET returns every group to the Genre section with both search fields cleared. |
| `photo enlarged` | As `instrument picker open, similar drill-down active` (the Instrument inspector on `voice`), then its photo (`.ip-media [data-ui="lightbox"]`) is clicked. The gate serves every remote photo as a local PNG, so the photo exists offline. RESET closes it (`uiCloseLightbox`). |
| `modal open: <id>` | `openModal(<id>)`. Modal IDs: `modal-trad`, `modal-saved`, `modal-save`, `modal-preface`, `modal-recipe-stack`, `modal-attributions` (`modal-add` has no dialog; it routes to the Instrument page). Use this only when the entry targets the modal frame itself (`#modal-X.open`), not its contents — for contents, use one of the populated-state preconditions above. |

When a future capability needs a precondition not listed here, add the precondition spec to `scripts/ui_reachability_check.js` AND document it in the table above in the same commit.

---

## Reachable entries

### App bar

```yaml
name: app-bar-traditions
kind: widget
selector: '#btn-traditions'
surface: Your recipe — "Add another genre" below the genres (in the phone Recipe sheet's toolbar, "Add genre"); the node keeps its id wherever uiPlaceRecipeParts puts it
implementation: DOMContentLoaded click handler opens modal-trad via renderTradPicker
status: reachable
precondition: empty
```

Opens the tradition picker modal at its tree-browser entry point.

```yaml
name: app-bar-saved
kind: widget
selector: '#btn-saved'
surface: app bar — "Saved sessions" button (distinct from Save and from the Autosaved status)
implementation: click handler opens modal-saved via renderSaved
status: reachable
precondition: empty
```

Lists saved workspaces from IndexedDB / filesystem-fallback.

```yaml
name: app-bar-save
kind: widget
selector: '#btn-save'
surface: app bar — "Save workspace" button
implementation: click handler opens modal-save (name input + confirm)
status: reachable
precondition: empty
```

```yaml
name: app-bar-add-instrument
kind: widget
selector: '#btn-add'
surface: Your recipe — "Add independent instrument" below the genres (in the phone Recipe sheet's toolbar, "Add instrument")
implementation: click handler calls openModal('modal-add'), which uiOpenSurface turns into the Instrument page
status: reachable
precondition: empty
```

```yaml
name: app-bar-undo
kind: widget
selector: '#btn-undo'
surface: app bar — undo icon button
implementation: click handler calls undo(); also wired to Ctrl/Cmd+Z
status: reachable
precondition: empty
```

```yaml
name: app-bar-redo
kind: widget
selector: '#btn-redo'
surface: app bar — redo icon button
implementation: click handler calls redo(); also wired to Ctrl/Cmd+Shift+Z
status: reachable
precondition: empty
```

```yaml
name: app-bar-attributions
kind: widget
selector: '#btn-attributions'
surface: app bar — info icon
implementation: click handler opens modal-attributions
status: reachable
precondition: empty
```

```yaml
name: empty-starter-gallery
kind: data-action
selector: '[data-ui="genre-add"]'
surface: genre catalog — direct recipe addition
implementation: the Genre page's Start tab lists STARTER_TRADITIONS (src/pages/genre.js); its Add calls uiAddGenre
status: reachable
precondition: empty
```

Loads a full curated tradition recipe onto the empty workbench.

```yaml
name: empty-surprise
kind: widget
selector: '[data-ui="surprise"]'
surface: More menu — Surprise me
implementation: the shell's 'surprise' action calls surpriseTradition (random tradition with 2+ instruments)
status: reachable
precondition: empty
```

### Empty state

```yaml
name: empty-state-add-instrument
kind: widget
selector: '#btn-add'
surface: shared recipe — Add instrument
implementation: #btn-add's click handler (the legacy #empty-add proxy was removed with the old empty state)
status: reachable
precondition: empty
```

```yaml
name: empty-state-browse-traditions
kind: widget
selector: '[data-view="genre"]'
surface: Genre navigation
implementation: opens modal-trad via renderTradPicker
status: reachable
precondition: empty
```

```yaml
name: empty-state-quick-pick
kind: widget
selector: '[data-ui="instrument-add"]'
surface: Instrument catalog — Add
implementation: click adds that instrument as a card (the legacy quick-pick chips were removed with the old empty state)
status: reachable
precondition: instrument picker open
```

### Sidebar — workspace header

```yaml
name: workspace-rename
kind: widget
selector: '#ws-rename-btn'
surface: Your recipe — pencil next to the session name (in the dock, in its header row)
implementation: click handler calls startRenameWorkspace which swaps in ws-name-input; Enter/blur commits, Escape cancels
status: reachable
precondition: 1+ cards
notes: only renders when 1+ cards (empty-state header shows different layout); ws-name-display also supports dblclick rename
```

### Sidebar — filter

```yaml
name: sidebar-filter-input
kind: widget
selector: '#sidebar-filter-input'
surface: Your recipe — Filter instruments field, revealed by the search button in the panel header (and shown whenever a filter is in force)
implementation: input handler sets app.sidebarFilter, calls renderSidebar; the header toggle (data-ui="recipe-filter", uiSyncRecipeFilter in src/workbench.js) shows it, and closing it clears the filter so no row stays hidden
status: reachable
precondition: 1+ cards
notes: only renders when 1+ cards (filter has nothing to filter on empty)
```

### Sidebar — traditions

```yaml
name: sidebar-tradition-header
kind: widget
selector: '.sb-tradition-header'
surface: Your recipe — genre header (grip, glyphs, name as the collapse toggle button, Primary on the first genre, count while collapsed, … menu)
implementation: click (or the .sb-tradition-toggle button) toggles app.collapsedTraditionGroups Set entry; clicks in the … menu and its trigger do not toggle
status: reachable
precondition: 1+ cards
```

```yaml
name: sidebar-card
kind: widget
selector: '.sb-card'
surface: Your recipe — instrument row (icon, catalog name, current character word; Edit and … beside it)
implementation: click sets app.selected = cardId, renders detail and opens the editor (the shell's sidebar listener)
notes: The per-row mini-fingerprint was dropped from the row for the reference layout, and the editor header's fingerprint panel (always hidden) was removed on 2026-09-26.
status: reachable
precondition: 1+ cards
```

```yaml
name: sidebar-add-to-tradition
kind: widget
selector: '[data-add-to-trad]'
surface: Your recipe — "+ Add instrument" inside each genre (accessible name "Add instrument to <genre>")
implementation: sets app._addToTradition, then openModal('modal-add') opens the Instrument page
status: reachable
precondition: 1+ cards
notes: The instrument picked on the Instrument page joins THAT group — it is configured
  from the tradition (tuning, room, chain, voice parts, amp) exactly as
  importTradition seeds it, and is placed after the group's last card. The
  pre-context is consumed on add and cleared by every other modal-add entry
  point (#btn-add, the card "similar" action), so a later plain add stays
  ungrouped.
```

### Sidebar — staple

```yaml
name: sidebar-staple-add
kind: widget
selector: '#sb-staple-add'
surface: Your recipe — Suggestions for this recipe — "Add {tradition} as a second genre" (inside the disclosure, #sb-staple-toggle)
implementation: click calls importTradition for the suggested tradition
status: reachable
precondition: 1+ cards
notes: only renders when a primary tradition is set; pool from findSimilar
```

```yaml
name: sidebar-staple-refresh
kind: widget
selector: '#sb-staple-refresh'
surface: Your recipe — Suggestions for this recipe — Try another suggestion
implementation: increments app._stapleIdx, opens the disclosure, re-renders the suggestion
status: reachable
precondition: 1+ cards
notes: only renders when staple pool has > 1 candidate
```

### Sidebar — recipe preview

```yaml
name: sidebar-recipe-copy
kind: widget
selector: '#sb-recipe-copy'
surface: Your recipe — Copy recipe under the preview (an icon in the phone recipe bar)
implementation: click runs copyToClipboard with compileRecipeStack output in the format the preview shows (app.recipeStackFormat)
status: reachable
precondition: 1+ cards
```

```yaml
name: sidebar-recipe-open-full
kind: widget
selector: '#sb-open-full-stack'
surface: Your recipe — "Open full recipe →" under the preview
implementation: opens modal-recipe-stack
status: reachable
precondition: 1+ cards
```

### Detail header — action cluster (per card)

```yaml
name: detail-primary-marker
kind: widget
selector: '#detail-view .detail-primary-marker'
surface: detail header — small "ANCHOR" pill next to the instrument name when the displayed card is the workspace's primary card
implementation: renderDetailHeader compares card.id to _determinePrimaryCard(app.cards); inserts the marker only on match. The tooltip explains the semantic to users who haven't encountered the term elsewhere.
status: reachable
precondition: 1+ cards
notes: A card is the primary when it's the first card in app.cards with a non-null traditionId. Manual-build recipes (no tradition on any card) have no primary and surface no marker. Switching app.selected to a secondary card removes the marker; switching back surfaces it again.
```

```yaml
name: card-pin
kind: data-action
selector: '#detail-view [data-action="pin"]'
surface: detail header — pin/unpin icon (pin)
implementation: handleAction pin case toggles card.pinned, calls renderAll
status: reachable
precondition: 1+ cards
notes: sidebar visual feedback for pinned state is pending (see card-pin-sidebar-visual)
```

```yaml
name: card-similar
kind: data-action
selector: '#detail-view [data-action="similar"]'
surface: detail header — find-similar icon (network)
implementation: handleAction similar case sets app.similarInstFor, then openModal('modal-add') inspects it on the Instrument page
status: reachable
precondition: 1+ cards
```

```yaml
name: card-drift
kind: data-action
selector: '#detail-view [data-action="drift"]'
surface: detail header — drift icon (shuffle)
implementation: handleAction drift case sets card.drift via buildDriftCandidates, rerenders
status: reachable
precondition: 1+ cards
```

```yaml
name: card-duplicate
kind: data-action
selector: '#detail-view [data-action="duplicate"]'
surface: detail header — duplicate icon (copy)
implementation: handleAction duplicate case calls dupCard, renderAll, toast
status: reachable
precondition: 1+ cards
```

```yaml
name: card-delete
kind: data-action
selector: '#detail-view [data-action="delete"]'
surface: detail header — delete icon (trash-2, red)
implementation: handleAction delete case calls rmCard (animated removal)
status: reachable
precondition: 1+ cards
```

### Detail — tab bar

```yaml
name: detail-tab-parts
kind: widget
selector: '.detail-tab[data-tab="parts"]'
surface: detail tab bar — "Parts" tab
implementation: tab click sets card._uiTab = 'parts', re-renders tab content
status: reachable
precondition: 1+ cards
```

```yaml
name: detail-tab-environment
kind: widget
selector: '.detail-tab[data-tab="env"]'
surface: detail tab bar — "Environment" tab
implementation: tab click sets card._uiTab = 'env'
status: reachable
precondition: 1+ cards
```

```yaml
name: detail-tab-signal-chain
kind: widget
selector: '.detail-tab[data-tab="chain"]'
surface: detail tab bar — "Signal chain" tab
implementation: tab click sets card._uiTab = 'chain'
status: reachable
precondition: 1+ cards
```

```yaml
name: detail-tab-preface
kind: widget
selector: '.detail-tab[data-tab="preface"]'
surface: detail tab bar — "Character" tab (the preface and its cascade; id stays `preface`)
implementation: tab click sets card._uiTab = 'preface'
status: reachable
precondition: 1+ cards
```

```yaml
name: detail-tab-stack
kind: widget
selector: '.detail-tab[data-tab="stack"]'
surface: detail tab bar — "Output" tab (Rich, Tags, Prose, Compact; id stays `stack`)
implementation: tab click sets card._uiTab = 'stack', renders renderStackPanel
status: reachable
precondition: 1+ cards
```

### Detail — Parts tab interactions

```yaml
name: part-row-toggle
kind: data-action
selector: '#detail-view [data-toggle-part]'
surface: parts tab — click a part row to expand variant grid
implementation: handleCardClick togglePart sets card.editingPart, rerenders
status: reachable
precondition: viewing parts tab
```

```yaml
name: part-variant-pick
kind: data-action
selector: '#detail-view [data-set-part]'
surface: parts tab — expanded variant chip
implementation: handleCardClick setPart writes to card.parts, may re-suggest preface
status: reachable
precondition: editing part
```

### Detail — Environment tab interactions

```yaml
name: env-row-toggle
kind: data-action
selector: '#detail-view [data-toggle-env]'
surface: environment tab — click tuning or room row to expand
implementation: handleCardClick toggleEnv sets card.editingEnv, rerenders
status: reachable
precondition: viewing env tab
```

```yaml
name: env-tuning-pick
kind: data-action
selector: '#detail-view [data-set-tuning]'
surface: environment tab — expanded tuning chip
implementation: handleCardClick setTuning writes to card.tuning
status: reachable
precondition: 'editing env: tuning'
```

```yaml
name: env-room-pick
kind: data-action
selector: '#detail-view [data-set-room]'
surface: environment tab — expanded room chip
implementation: handleCardClick setRoom writes to card.room
status: reachable
precondition: 'editing env: room'
```

### Detail — Signal chain tab interactions

```yaml
name: chain-stage-toggle
kind: data-action
selector: '#detail-view [data-edit-chain]'
surface: chain tab — click stage button to expand pickers
implementation: handleCardClick editChain sets card.editingChainStage
status: reachable
precondition: viewing chain tab
```

```yaml
name: chain-item-pick
kind: data-action
selector: '#detail-view [data-set-chain]'
surface: chain tab — expanded stage item chip (single or multi-select)
implementation: handleCardClick setChain writes to card.chain[stageId]
status: reachable
precondition: editing chain stage
```

### Detail — Preface tab interactions

```yaml
name: preface-input
kind: widget
selector: '#detail-view input[list="preface-options"]'
surface: preface tab — autocomplete input bound to preface datalist
implementation: commit handler routes through commitPrefaceChange, which fires inverseConfigureForPreface to reshape card parts/env toward the target preface's token signature
status: reachable
precondition: viewing preface tab
```

```yaml
name: preface-browse
kind: widget
selector: '#detail-view .preface-browse'
surface: preface tab — "Browse" button next to input
implementation: click opens modal-preface; picks route through commitPrefaceChange (not direct assignment) so inverse fires
status: reachable
precondition: viewing preface tab
```

```yaml
name: preface-suggestion-fan
kind: widget
selector: '#detail-view .preface-fan'
surface: preface tab — ranked-candidate chip strip below the input, top suggestions based on card's current descriptor set
implementation: renderReachabilityFan(card, sec) builds chips from buildReachabilityFan(card, 7); each chip's click routes through commitPrefaceChange so picking a suggestion fires the inverse pipeline
status: reachable
precondition: viewing preface tab
notes: Skipped when fewer than 2 candidates exist (no meaningful choice). The fan is the suggestions UI that was destroyed during the May 27 dead-code prune; restoring its inventory entry so the gate catches its absence next time.
```

```yaml
name: preface-shifts-panel
kind: widget
selector: '#detail-view .preface-shifts-panel'
surface: preface tab — explains the most recent inverse-configure run with per-axis target-tokens-added attribution
implementation: renderShiftsPanel(card, sec) reads from _recentShiftsByCard (populated by commitPrefaceChange) and renders dismissible per-axis rows
status: reachable
precondition: 'preface just committed with shifts'
notes: Surfaces only after a commitPrefaceChange call that produces non-empty shifts (the inverse algorithm decided to mutate one or more axes). The `preface just committed with shifts` precondition uses delta_blues voice + liturgical as a reliable shift-producing fixture.
```

### Detail — Stack tab interactions

```yaml
name: stack-format-prose
kind: data-action
selector: '#detail-view [data-fmt="prose"]'
surface: stack tab — Prose format toggle
implementation: handleCardClick sets card.stackPanel.format = 'prose'
status: reachable
precondition: stack panel open
```

```yaml
name: stack-format-tags
kind: data-action
selector: '#detail-view [data-fmt="tags"]'
surface: stack tab — Tags format toggle
implementation: handleCardClick sets card.stackPanel.format = 'tags'
status: reachable
precondition: stack panel open
```

```yaml
name: stack-format-rich
kind: data-action
selector: '#detail-view [data-fmt="rich"]'
surface: stack tab — Rich format toggle
implementation: handleCardClick sets card.stackPanel.format = 'rich'
status: reachable
precondition: stack panel open
```

```yaml
name: stack-format-compact
kind: data-action
selector: '#detail-view [data-fmt="compact"]'
surface: stack tab — Compact format toggle
implementation: handleCardClick sets card.stackPanel.format = 'compact'
status: reachable
precondition: stack panel open
```

```yaml
name: stack-copy
kind: data-action
selector: '#detail-view [data-action="stack-copy"]'
surface: stack tab — Copy button (current format)
implementation: handleAction stack-copy calls compileStack(format) + copyToClipboard
status: reachable
precondition: stack panel open
```

### Detail — Drift panel (when active)

```yaml
name: drift-walk
kind: data-action
selector: '.drift-panel [data-walk]'
surface: drift panel — "Walk here" button per candidate
implementation: handleCardClick data-walk applies move, clears drift, re-suggests preface
status: reachable
precondition: drift active
```

```yaml
name: drift-roll
kind: data-action
selector: '.drift-panel [data-action="drift-roll"]'
surface: drift panel — "Roll new" button
implementation: handleAction drift-roll rebuilds candidates
status: reachable
precondition: drift active
```

```yaml
name: drift-close
kind: data-action
selector: '.drift-panel [data-action="drift-close"]'
surface: drift panel — "Close" button
implementation: handleAction drift-close clears card.drift, rerenders
status: reachable
precondition: drift active
```

### Modals

```yaml
name: modal-add
kind: modal
selector: '#surface-instrument'
surface: Instrument discovery surface
implementation: openModal('modal-add') routes to the Instrument page (uiOpenSurface); renderInstrumentDiscovery populates
status: reachable
precondition: instrument picker open
```

```yaml
name: modal-add-instrument-chip
kind: data-action
selector: '[data-ui="instrument-add"]'
surface: Instrument catalog
implementation: click calls uiAddInstrument(id) (src/workbench.js) — adds the instrument with catalog defaults to the genre chosen in "Add to" (#instrument-destination), or as an independent card; re-renders; opens the new card's editor in Your recipe (uiOpenEditor, which also opens the session panel on a phone); toasts confirmation. There is no modal to close.
status: reachable
precondition: instrument picker open
```

```yaml
name: modal-add-axis-filter-toggle
kind: data-action
selector: '[data-ui="instrument-filter"]'
surface: Instrument filters
implementation: click toggles the axis ID in app.instrumentAxisFilters set, re-renders picker with filter applied
status: reachable
precondition: instrument picker open
```

```yaml
name: modal-add-axis-filter-clear
kind: data-action
selector: '[data-ui="clear-filters"]'
surface: Instrument filters
implementation: click empties app.instrumentAxisFilters, re-renders picker
status: reachable
precondition: instrument picker open, filter active
notes: Only renders when ≥1 filter is active. The clear button appears alongside the "N of M match" count.
```

```yaml
name: find-similar-instrument-add-to-canvas
kind: data-action
selector: '#instrument-preview [data-ui="instrument-add"]'
surface: Similar instruments
implementation: click adds the instrument through uiAddInstrument; the same handler as modal-add-instrument-chip, inside the inspector's similar instruments
status: reachable
precondition: instrument picker open, similar drill-down active
notes: Triggered when app.similarInstFor is set to a known instrument id; uiOpenSurface opens that instrument's inspector, which ranks its neighbours by axis distance.
```

```yaml
name: modal-trad
kind: modal
selector: '#surface-genre'
surface: Genre discovery surface
implementation: openModal('modal-trad'); renderTradPicker populates
status: reachable
precondition: tradition picker open
```

```yaml
name: modal-trad-tree-node-toggle
kind: data-action
selector: '[data-ui="genre-branch"]'
surface: Genre hierarchy
implementation: click toggles node id in app.treeExpanded set, re-renders. Branch nodes show/hide children; leaf nodes expand to reveal Import + Find similar buttons.
status: reachable
precondition: tradition picker open
```

```yaml
name: modal-trad-leaf-import
kind: data-action
selector: '[data-ui="genre-add"]'
surface: Genre catalog
implementation: click calls importTradition(tradId) which seeds all canonical instruments as cards
status: reachable
precondition: tradition picker open
notes: Only renders under expanded leaf nodes. The tree-expanded precondition expands all visible nodes so every leaf's Import button surfaces.
```

```yaml
name: modal-trad-leaf-find-similar
kind: data-action
selector: '[data-ui="genre-select"]'
surface: Genre relationship web
implementation: click sets app.similarFor = tradId, re-renders picker into similarity-view mode
status: reachable
precondition: tradition picker open
notes: Only renders when the tradition has axes (ext.axes is truthy). The tree-expanded precondition surfaces these on every qualifying leaf.
```

```yaml
name: modal-saved
kind: modal
selector: '#modal-saved.open'
surface: saved-workspaces modal — list with load/delete per row
implementation: openModal('modal-saved'); renderSaved populates async
status: reachable
precondition: 'modal open: modal-saved'
```

```yaml
name: modal-saved-load
kind: data-action
selector: '[data-load]'
surface: saved-workspaces modal — "Load" button per saved-workspace row
implementation: click reads workspace from storage, restores app state, closes modal
status: reachable
precondition: 'saved workspaces list open'
notes: The `saved workspaces list open` precondition installs a storage mock (gate-only — real storage is untouched if present) and seeds one fixture row. The handler at loadWS reads via safeGet, restores cards, closes the modal, toasts.
```

```yaml
name: modal-saved-fork
kind: data-action
selector: '[data-fork]'
surface: saved-workspaces modal — "Fork" button per row (loads as an independent copy with new id)
implementation: click reads workspace, forks (new ids, marks as unsaved), restores state, closes modal
status: reachable
precondition: 'saved workspaces list open'
notes: Same precondition as modal-saved-load. forkWS generates fresh card ids before restoring, so the loaded copy is independent of the original key.
```

```yaml
name: modal-saved-delete
kind: data-action
selector: '[data-del]'
surface: saved-workspaces modal — "Delete" button per row (red, ghost variant)
implementation: click awaits confirmDialog; on confirm removes workspace from storage and re-renders modal list
status: reachable
precondition: 'saved workspaces list open'
notes: Same precondition as modal-saved-load. The reachability gate verifies the button surfaces; the confirmDialog flow that follows a click is verified separately by the confirmDialog widget entry.
```

```yaml
name: modal-save
kind: modal
selector: '#modal-save.open'
surface: save-workspace modal — name input + confirm
implementation: openModal('modal-save')
status: reachable
precondition: 'modal open: modal-save'
```

```yaml
name: modal-preface
kind: modal
selector: '#modal-preface.open'
surface: preface lexicon browser modal — category-grouped entries
implementation: openModal('modal-preface'); openPrefaceModal populates
status: reachable
precondition: 'modal open: modal-preface'
```

```yaml
name: modal-recipe-stack
kind: modal
selector: '#modal-recipe-stack.open'
surface: full recipe stack modal — opened from sidebar "Open full recipe →"
implementation: openModal('modal-recipe-stack'); renderRecipeStack populates
status: reachable
precondition: 'modal open: modal-recipe-stack'
```

```yaml
name: modal-recipe-stack-copy
kind: data-action
selector: '[data-rstack-copy]'
surface: recipe stack modal — "Copy" button at the bottom of the rendered stack
implementation: click calls copyToClipboard(text) with the current format's compiled output and toasts confirmation/error
status: reachable
precondition: 'recipe stack modal open'
notes: Requires cards on the canvas — the recipe-stack body renders the "No instruments on the canvas yet" empty-state otherwise, which has no Copy button.
```

```yaml
name: modal-attributions
kind: modal
selector: '#modal-attributions.open'
surface: image credits + licenses modal
implementation: openModal('modal-attributions')
status: reachable
precondition: 'modal open: modal-attributions'
```

```yaml
name: modal-close-via-data-close
kind: widget
selector: '.modal-bg.open [data-close]'
surface: any modal — close buttons / backdrop with data-close
implementation: DOMContentLoaded handler calls closeModal(b.dataset.close)
status: reachable
precondition: 'modal open: modal-attributions'
```

### Keyboard shortcuts

```yaml
name: keyboard-escape-modal
kind: keyboard-shortcut
selector: 'document'
surface: any open modal — Escape closes
implementation: DOMContentLoaded keydown handler removes .open from any .modal-bg.open
status: reachable
precondition: empty
notes: probe via page.keyboard.press('Escape') after opening a modal
```

```yaml
name: keyboard-undo
kind: keyboard-shortcut
selector: 'document'
surface: global — Ctrl/Cmd+Z calls undo()
implementation: DOMContentLoaded keydown handler, skip if in input/textarea
status: reachable
precondition: editing chain stage
notes: probe via page.keyboard.press('Control+z')
```

```yaml
name: keyboard-redo
kind: keyboard-shortcut
selector: 'document'
surface: global — Ctrl/Cmd+Shift+Z calls redo()
implementation: DOMContentLoaded keydown handler
status: reachable
precondition: 1+ cards
notes: probe via page.keyboard.press('Control+Shift+z')
```

---

## Surfaces restored or added by the UI Capability Inventory Plan

The entries below were the deliverable of the UI Capability Inventory Plan (Phases 2-4). Each surface was either restored after the master-detail refactor silently dropped it, or added net-new alongside the gate infrastructure. Per-entry notes record which phase. Cataloguing them as a distinct group preserves the historical context — a future audit reader can see "this is what the plan accomplished" without having to reconstruct it from commit history. All are now `status: reachable` and verified by the gate; this section is informational rather than a holding area.

```yaml
name: stack-signature-panel
kind: widget
selector: '.detail-stack-signature'
surface: detail pane — strip between breadcrumb-row and detail header showing workspace centroid + 4 nearest traditions
implementation: renderDetailStackSignature wires into renderDetail; reuses buildSongFingerprint + renderAxisFingerprint + wireStackSignatureEvents
status: reachable
precondition: 2+ cards
notes: Shipped as Phase 2 of UI Capability Inventory Plan. Lost in master-detail refactor; restored.
```

```yaml
name: tradition-group-delete
kind: data-action
selector: '.sb-tradition-header [data-delete-tradition]'
surface: Your recipe — genre … menu — Remove genre
implementation: click handler awaits confirmDialog; on confirm pushHistory once then rmCards each with skipHistory:true
status: reachable
precondition: 1+ cards
notes: Shipped as Phase 3a of UI Capability Inventory Plan. Uses existing confirmDialog (Promise-based) and the new rmCard skipHistory opt.
```

```yaml
name: tradition-group-reorder
kind: drag-drop
selector: '.sb-tradition-header[data-drag-tradition]'
surface: sidebar — drag genre headers to reorder (mouse, touch or pen)
implementation: wireTreeDragAndDrop (Pointer Events, delegated from #sidebar-traditions) sets app._dnd; on release dropTraditionOnTradition splices the source genre's cards above or below the target's run
status: reachable
precondition: 2+ cards
notes: Was HTML5 drag-and-drop, which is mouse-only — `dragstart` never fires from a finger, so this was unreachable on every phone. Rewritten on Pointer Events, one implementation for all input types; touch arms on a 350ms long press so a swipe still scrolls the page. Group-target only; within-group reorder deferred. The up/down arrow buttons (tradition-group-move-up / -move-down) remain the primary affordance. Exercised under real touch AND mouse by scripts/check_mobile_layout.js assertion H.
```

```yaml
name: tradition-group-move-up
kind: data-action
selector: '.sb-tradition-header [data-move-trad-up]'
surface: Your recipe — genre … menu — Move up
implementation: click handler computes seen-order from app.cards (first-appearance), finds previous group, splices the moving group's cards before the previous group's first card, pushes history and rerenders
status: reachable
precondition: 2+ cards
notes: The non-drag reorder, now in the genre's … menu (the reference layout keeps the header to name and menu). Disabled at the top of the list (idx === 0). Clicks in the menu do NOT trigger the header's collapse toggle — the header click handler bails on `.sb-menu, [data-menu-toggle]`.
```

```yaml
name: tradition-group-move-down
kind: data-action
selector: '.sb-tradition-header [data-move-trad-down]'
surface: Your recipe — genre … menu — Move down
implementation: click handler computes seen-order from app.cards (first-appearance), finds next group, splices the moving group's cards after the next group's last card, pushes history and rerenders
status: reachable
precondition: 2+ cards
notes: Always visible. Button is disabled at the bottom of the movable list (last position before __ungrouped__, which never participates in reordering). Click does NOT trigger the header's collapse toggle.
```

```yaml
name: card-drag-reparent
kind: drag-drop
selector: '.sb-card'
surface: sidebar — drag an instrument row into a different genre to reparent it (mouse, touch or pen)
implementation: wireTreeDragAndDrop (Pointer Events, delegated from #sidebar-traditions) sets app._dnd; on release dropCardOnTradition sets card.traditionId and moves it after the target genre's last card
status: reachable
precondition: 2+ cards
notes: Was HTML5 drag-and-drop, which is mouse-only, so on a phone this had NO route at all — unlike genre reorder there is no button equivalent. Rewritten on Pointer Events; touch arms on a 350ms long press. Group-target only; card-onto-card drop deferred. Exercised under real touch AND mouse by scripts/check_mobile_layout.js assertion H. The non-drag equivalent is card-move-to-genre-menu; both call dropCardOnTradition.
```

```yaml
name: card-move-to-genre-menu
kind: data-action
selector: '[data-action="move-genre"]'
surface: detail breadcrumb row — reparent the selected instrument into another genre without dragging
implementation: handleAction('move-genre') → openMoveToGenreMenu(card, trigger); the menu's items call dropCardOnTradition, then pushHistory + renderAll + showToast, exactly as the drop path in wireTreeDragAndDrop's onUp does
status: reachable
precondition: 2+ cards
notes: The non-drag route for card-drag-reparent, which until now was the ONE tree operation reachable only by dragging — genre reorder always had the ↑/↓ movers, card reparent had nothing. WCAG 2.2 SC 2.5.7 (Dragging Movements, AA) asks for a single-pointer non-drag alternative, and a keyboard has no drag at all. Also the practical route when the target genre is scrolled out of the sidebar pane: edge auto-scroll makes that drag possible, this makes it unnecessary. Rendered disabled (with an explanatory tooltip) when the workspace has no other genre to move to, so the selector resolves under any precondition with a selected card. Menu is built per-open from workspace state on the shared .more-menu furniture rather than living in the template.
```

```yaml
name: card-pin-sidebar-visual
kind: widget
selector: '.sb-card.is-pinned .sb-card-pin'
surface: Your recipe — pinned rows sort first within their genre; pin glyph beside the name
implementation: renderSidebarTraditions sorts pinned-first via stable sort; renderSidebarCard adds is-pinned class + pin glyph when card.pinned
status: reachable
precondition: pinned card
notes: Shipped as Phase 4a of UI Capability Inventory Plan. The card-pin action toggles state; this entry covers visual feedback.
```

```yaml
name: drift-scroll-into-view
kind: widget
selector: '.drift-panel'
surface: drift activation auto-scrolls panel into center of viewport
implementation: requestAnimationFrame scrollIntoView({behavior:smooth, block:center}) after card.drift = ... in handleAction
status: reachable
precondition: drift active
notes: Shipped as Phase 4b of UI Capability Inventory Plan. Selector identical to drift-walk's host; reachability gate verifies the panel exists, scroll behavior is verified by manual inspection.
```

---

## Retired entries

Capabilities that existed in earlier versions and were deliberately removed. The reachability gate skips these. Future refactor planners read them to understand intentional drops vs. accidental ones.

```yaml
name: multi-card-simultaneous-edit
kind: widget
selector: 'n/a (multiple .card-body.composer-open elements simultaneously)'
surface: legacy card list — multiple cards expanded to composer mode at once
implementation: legacy renderCard with card._composerOpen per-card flag
status: retired
precondition: n/a
notes: Master-detail layout (2026-05) enforces single-active selection via app.selected. The detail pane shows exactly one card's composer at a time. Intentional design simplification per D10 of the UI Capability Inventory Plan. The old `editingPart` / `editingEnv` / `editingChainStage` per-card state still exists but only one card's editing state is visible at a time (the selected one).
```

---

## Counts (for the gate's preamble verification)

- Reachable: 106
- Pending: 0
- Retired: 1
- **Total tracked surfaces: 107**

When this count changes, update it here AND update the verification block in `scripts/ui_reachability_check.js`. Sanity match on every build.

## Production shared workspace (2026-09-12)

The former empty-state entry points now lead through the always-available Genre and Instrument catalogs. Surprise me is in More. The browse/import approval modals were replaced by direct additions and Undo. The tiny fingerprint visualizations are intentionally removed; axis search and similarity remain.

On 2026-09-26 the code behind those retired surfaces was deleted rather than hidden: the legacy empty state (`#empty-state`, starter gallery, quick-pick), the legacy Add-instrument modal body (`#modal-add`, `renderInstPicker`, its similar-instruments drill-down), the old app bar's wordmark, `#meta` count and `#app-more-menu` overflow sheet, the fingerprint mini-charts, the part-row thumbnails, the editor tab status and the AI panel's title, meta and collapse. `openModal('modal-add')` still routes to the Instrument page, and the seven native `#btn-*` action buttons keep their ids and handlers.

```yaml
name: navigation-genre
kind: widget
selector: '[data-view="genre"]'
surface: shared workbench
implementation: src/workbench.js
status: reachable
precondition: empty
```

```yaml
name: navigation-instrument
kind: widget
selector: '[data-view="instrument"]'
surface: shared workbench
implementation: src/workbench.js
status: reachable
precondition: empty
```

```yaml
name: navigation-map
kind: widget
selector: '[data-view="map"]'
surface: shared workbench
implementation: src/workbench.js
status: reachable
precondition: empty
```

```yaml
name: navigation-lyrics
kind: widget
selector: '[data-view="lyrics"]'
surface: shared workbench
implementation: src/workbench.js
status: reachable
precondition: empty
```

```yaml
name: recipe-assistant
kind: widget
selector: '[data-ui="ai"]'
surface: Your recipe — AI recipe (above "Describe a change to this recipe…"; in the phone Recipe sheet's toolbar)
implementation: uiChatOpen in src/workbench.js
status: reachable
precondition: empty
```

```yaml
name: genre-listen
kind: widget
selector: '#surface-genre .listen'
surface: shared workbench
implementation: src/workbench.js
status: reachable
precondition: empty
```

```yaml
name: instrument-listen
kind: widget
selector: '#surface-instrument .listen, #surface-instrument .cm-tile-play'
surface: shared workbench
implementation: src/workbench.js
status: reachable
precondition: instrument picker open
```

```yaml
name: session-export
kind: widget
selector: '[data-ui="export"]'
surface: shared workbench
implementation: src/workbench.js
status: reachable
precondition: empty
```

```yaml
name: session-import
kind: widget
selector: '[data-ui="import"]'
surface: shared workbench
implementation: src/workbench.js
status: reachable
precondition: empty
```

```yaml
name: lyrics-draft
kind: widget
selector: '#lyrics-draft'
surface: Lyrics — the document: one textarea, always editable, under its read layer; the one source of the outline, tools and checks
implementation: src/pages/lyrics.js (committed through uiSaveLyrics in src/workbench.js)
status: reachable
precondition: empty
notes: Every script write (Undo, restore, import, a writer's lyrics) reaches the page through its value setter, so the view never shows stale text.
```

```yaml
name: lyrics-use-recipe
kind: widget
selector: '[data-ui="attach-recipe"]'
surface: Lyrics — Write with AI menu and Writer panel — Use current recipe (prefills the lyrics writer; sends nothing)
implementation: attach-recipe in src/pages/lyrics.js
status: reachable
precondition: empty
notes: The only recipe input to lyric work, and explicit. Lyric work never writes the recipe.
```

```yaml
name: map-workspace
kind: widget
selector: '#map-frame'
surface: shared workbench
implementation: src/workbench.js
status: reachable
precondition: empty
```

## Shared UI foundation (2026-09-25)

The foundation for the four-page redesign (`docs/ui-foundation.md`). These are
shared surfaces on every route; the final page layouts are not built yet and
are listed there as page work. Behaviour — not just presence — is gated by
`scripts/check_ui_foundation.js`.

```yaml
name: theme-setting
kind: widget
selector: '[data-ui="theme"]'
surface: More menu — Theme: System / Light / Dark (segmented, aria-pressed)
implementation: uiThemeControl / uiSyncThemeControl in src/workbench.js; UITheme.set in src/theme.js
status: reachable
precondition: empty
notes: One stored preference (codex-theme), applied before first paint in codex.html and atlas.html, followed live when System, and relayed to the atlas in the Map. check_ui_foundation.js A-D.
```

```yaml
name: autosave-status
kind: widget
selector: '#ui-autosave'
surface: header — Autosaved / Not autosaved / Autosave failed, icon plus word
implementation: uiRenderAutosave, called by uiAutosave in src/workbench.js
status: reachable
precondition: empty
notes: Reports only what the automatic copy of the open session did. Save (named copy) and Saved sessions (list) are separate controls. check_ui_foundation.js F-G.
```

```yaml
name: recipe-panel-collapse
kind: widget
selector: '[data-ui="recipe-collapse"]'
surface: Your recipe header — collapse to a rail (sidebar) or to its header (dock), and expand
implementation: uiApplyRecipeMode / uiRecipeCollapsed (UILayout.remember) in src/workbench.js
status: reachable
precondition: empty
notes: Remembered per presentation under codex-layout:*; Reset layout clears it. Hidden below 900px, where the Recipe sheet has its own Close. check_ui_foundation.js I.
```

```yaml
name: recipe-dock-resize
kind: drag-drop
selector: '.layout-splitter-y'
surface: top edge of the Your recipe dock (the Map) — drag to resize
implementation: UILayout.splitter({ side 'top' }) in src/layout.js, registered by uiLayoutControls
status: reachable
precondition: empty
notes: Keyboard alternative on the same separator (Up/Down, Shift for larger steps, Home resets, End maximises); double-click resets. Visible only while the dock is the presentation and expanded.
```

```yaml
name: recipe-empty-state
kind: widget
selector: '#recipe-empty [data-ui="genre-nav"]'
surface: Your recipe — empty session: what to do, Browse genres, Surprise me
implementation: uiRecipePanelSetup / uiSync in src/workbench.js
status: reachable
precondition: empty
```

```yaml
name: map-status
kind: widget
selector: '#map-status'
surface: Map — "Loading the map…" until the embedded atlas has loaded
implementation: map page render() in src/pages/map.js
status: reachable
precondition: empty
```

```yaml
name: keyboard-escape-layers
kind: keyboard-shortcut
selector: 'document'
surface: global — Escape closes the topmost layer only (dialog, More, AI writer, Recipe sheet, editor, then the page's own) and returns focus to its opener
implementation: uiEscape in src/workbench.js; page escape() hooks in src/pages/genre.js and src/pages/instrument.js
status: reachable
precondition: empty
notes: Verified by check_ui_foundation.js H, not by this presence check.
```

```yaml
name: history-back-between-sections
kind: keyboard-shortcut
selector: 'document'
surface: browser Back / Forward — step between Genre, Instrument, Map and Lyrics
implementation: uiNavigate(view, { push }) and the hashchange listener in src/workbench.js
status: reachable
precondition: empty
notes: Deep links codex.html#<section> and codex.html?trad=<id> (opens that genre's detail; adds nothing) are preserved. Verified by check_ui_foundation.js H.
```

```yaml
name: genre-no-results-clear
kind: data-action
selector: '[data-ui="genre-clear-search"]'
surface: Genre — "No genres match …" with Clear search
implementation: uiEmptyState in src/workbench.js; genre-clear-search in src/pages/genre.js
status: reachable
precondition: 'genre search: no results'
```

```yaml
name: instrument-no-results-recovery
kind: data-action
selector: '[data-ui="instrument-clear-search"]'
surface: Instrument — "No instruments match" naming the constraints in force, with Clear search, Clear filters and All instruments as they apply
implementation: uiInstrumentNoResults in src/pages/instrument.js
status: reachable
precondition: 'instrument search: no results'
```

```yaml
name: toast-action-undo
kind: data-action
selector: '#toast .toast-action'
surface: import toast — Undo (only while the import is still the latest change); Retry after a failed catalog fetch
implementation: showToast(message, kind, action) and importTraditionWithFeedback in src/app.js
status: reachable
precondition: 'genre just imported'
```

```yaml
name: map-your-recipe-dock
kind: widget
selector: '.workbench[data-recipe="dock"] #workspace-sidebar .recipe-panel-head'
surface: Map — Your recipe docked under the map, the same panel and editor as Genre and Instrument
implementation: map page recipe 'dock' (src/pages/map.js); dock presentation in src/workbench.css
status: reachable
precondition: 'map view'
notes: A tradition's stock recipe in the atlas card is labelled "Default recipe" and is a different object. check_ui_foundation.js E proves one node and one state across the three pages.
```

### Your recipe — the reference panel (2026-09-25)

The shared panel as the four references draw it (docs/ui-foundation.md, "One
recipe workspace"). Moved capabilities are recorded on their original entries
above; these are the new controls. Behaviour is gated by
`scripts/check_ui_foundation.js` L (right-hand column, menus, environment
source, output format) and `scripts/check_mobile_layout.js` (sheet, bar,
drag and drop).

```yaml
name: recipe-sidebar-right
kind: drag-drop
selector: '.layout-splitter[aria-label="Resize recipe sidebar"]'
surface: Your recipe as a right-hand column (page recipe 'sidebar-right') — resize from its left edge, collapse to a rail at the right edge
implementation: uiApplyRecipeMode and the 'sidebar-right' UILayout.splitter in src/workbench.js; layout in src/workbench.css
status: reachable
precondition: empty
notes: Two separators carry this name (left and right column); only the one for the current presentation is shown. Keyboard: Left/Right, Home resets, End maximises. check_ui_foundation.js L.
```

```yaml
name: recipe-row-edit
kind: data-action
selector: '.sb-card-row [data-card-action="edit"]'
surface: Your recipe — Edit on each instrument row
implementation: renderSidebarCard / the [data-card-action] wiring in renderSidebarTraditions (src/app.js) — the same path as selecting the row
status: reachable
precondition: 1+ cards
```

```yaml
name: recipe-row-menu
kind: widget
selector: '.sb-card-row [data-menu-toggle]'
surface: Your recipe — … on each instrument row (Duplicate, Pin to top, Move to genre…, Explore variations, Find similar instruments, Remove)
implementation: menu markup in renderSidebarCard (src/app.js); opened, placed, keyboard-driven and closed by uiToggleMenu / uiMenuControls in src/workbench.js
status: reachable
precondition: 1+ cards
notes: Escape closes it first and returns focus to the trigger. check_ui_foundation.js L.
```

```yaml
name: recipe-row-duplicate
kind: data-action
selector: '.sb-menu [data-card-action="duplicate"]'
surface: Your recipe — row … menu — Duplicate
implementation: handleAction('duplicate') (src/app.js)
status: reachable
precondition: 1+ cards
```

```yaml
name: recipe-row-pin
kind: data-action
selector: '.sb-menu [data-card-action="pin"]'
surface: Your recipe — row … menu — Pin to top / Unpin
implementation: handleAction('pin') (src/app.js)
status: reachable
precondition: 1+ cards
```

```yaml
name: recipe-row-move-genre
kind: data-action
selector: '.sb-menu [data-card-action="move-genre"]'
surface: Your recipe — row … menu — Move to genre… (the non-drag reparent; disabled with one genre)
implementation: handleAction('move-genre') → openMoveToGenreMenu anchored on the row's … (src/app.js)
status: reachable
precondition: 1+ cards
```

```yaml
name: recipe-row-variations
kind: data-action
selector: '.sb-menu [data-card-action="drift"]'
surface: Your recipe — row … menu — Explore variations (opens the editor on the row with its variations)
implementation: selects the row, then handleAction('drift') (src/app.js)
status: reachable
precondition: 1+ cards
```

```yaml
name: recipe-row-similar
kind: data-action
selector: '.sb-menu [data-card-action="similar"]'
surface: Your recipe — row … menu — Find similar instruments
implementation: handleAction('similar') (src/app.js) → uiOpenSurface('modal-add') inspects it on the Instrument page
status: reachable
precondition: 1+ cards
```

```yaml
name: recipe-row-remove
kind: data-action
selector: '.sb-menu [data-card-action="delete"]'
surface: Your recipe — row … menu — Remove (Undo restores it)
implementation: handleAction('delete') → rmCard (src/app.js)
status: reachable
precondition: 1+ cards
```

```yaml
name: recipe-genre-menu
kind: widget
selector: '.sb-tradition-header [data-menu-toggle]'
surface: Your recipe — … on each genre (Make primary genre, Move up, Move down, Remove genre)
implementation: menu markup in renderSidebarTraditions (src/app.js); uiToggleMenu in src/workbench.js
status: reachable
precondition: 1+ cards
```

```yaml
name: recipe-genre-make-primary
kind: data-action
selector: '.sb-tradition-header [data-make-primary]'
surface: Your recipe — genre … menu — Make primary genre (disabled on the first genre)
implementation: dropTraditionOnTradition(id, first genre, above) + pushHistory + renderAll (src/app.js) — one undoable step
status: reachable
precondition: 1+ cards
```

```yaml
name: recipe-suggestions-toggle
kind: widget
selector: '#sb-staple-toggle'
surface: Your recipe — Suggestions for this recipe (a disclosure, closed until opened)
implementation: renderSidebarStaple (src/app.js) toggles app._suggestionsOpen
status: reachable
precondition: 1+ cards
```

```yaml
name: recipe-environment-room
kind: data-action
selector: '[data-ui="recipe-env"][data-id="room"]'
surface: Your recipe — Recording environment — Room (opens the editor on the environment's card, Environment tab, room picker open)
implementation: uiRecipeEnvHTML / uiOpenEnvironment in src/workbench.js, from envCardOf(app.cards)
status: reachable
precondition: 1+ cards
notes: Labelled "From <instrument> · <genre>" — the card every output format renders the environment from. check_ui_foundation.js L.
```

```yaml
name: recipe-environment-tuning
kind: data-action
selector: '[data-ui="recipe-env"][data-id="tuning"]'
surface: Your recipe — Recording environment — Tuning (Environment tab, tuning picker open)
implementation: uiOpenEnvironment in src/workbench.js
status: reachable
precondition: 1+ cards
```

```yaml
name: recipe-environment-chain
kind: data-action
selector: '[data-ui="recipe-env"][data-id="chain"]'
surface: Your recipe — Recording environment — Signal chain summary (Signal chain tab; the full stage names in its tooltip)
implementation: uiOpenEnvironment in src/workbench.js
status: reachable
precondition: 1+ cards
```

```yaml
name: recipe-environment-edit
kind: data-action
selector: '[data-ui="recipe-env"][data-id="env"]'
surface: Your recipe — Recording environment — pencil (Environment tab)
implementation: uiOpenEnvironment in src/workbench.js
status: reachable
precondition: 1+ cards
```

```yaml
name: recipe-preview-format
kind: widget
selector: '#sb-recipe-format'
surface: Your recipe — Recipe preview — format (Rich, Tags, Prose, Compact)
implementation: renderSidebarRecipePreview (src/app.js) sets app.recipeStackFormat, shared with the full-recipe dialog; Copy recipe copies the format shown
status: reachable
precondition: 1+ cards
```

```yaml
name: recipe-preview-expand
kind: widget
selector: '#sb-recipe-expand'
surface: Your recipe — Recipe preview — show all of the recipe / show less (on a phone, open the recipe bar)
implementation: renderSidebarRecipePreview (src/app.js): app._recipeDeskExpanded / app._recipeSheetOpen
status: reachable
precondition: 1+ cards
```

```yaml
name: recipe-open-full-editor
kind: data-action
selector: '[data-ui="recipe-open-editor"]'
surface: Your recipe dock — Open full editor (the selected instrument, else the first)
implementation: uiOpenEditor in src/workbench.js
status: reachable
precondition: empty
notes: Shown in the dock presentation; disabled while the recipe is empty.
```

```yaml
name: recipe-filter-toggle
kind: widget
selector: '[data-ui="recipe-filter"]'
surface: Your recipe header — Filter instruments
implementation: uiSyncRecipeFilter and the recipe-filter action in src/workbench.js
status: reachable
precondition: 1+ cards
```

```yaml
name: recipe-ai-entry
kind: widget
selector: '#recipe-ai-input'
surface: Your recipe — "Describe a change to this recipe…" (send opens the AI writer with the request and the current recipe)
implementation: uiRecipeAskAI in src/workbench.js — the one recipe writer; its reply is offered with "Use recipe" (undoable)
status: reachable
precondition: empty
notes: Hidden in the phone sheet, whose toolbar keeps AI recipe. Sends only on the user's own submit.
```

```yaml
name: recipe-autosave-mirror
kind: widget
selector: '#recipe-autosave'
surface: Your recipe header — Autosaved / Not autosaved / Autosave failed, the same words as the header status
implementation: uiRenderAutosave in src/workbench.js (#ui-autosave stays the live region)
status: reachable
precondition: empty
```

## Lyrics page (2026-09-25, redesigned 2026-09-30)

The Lyrics page (`src/pages/lyrics.js`, `src/pages/lyrics.css`), rebuilt on
2026-09-30 to the Lyrics engineering handoff: one document, a section outline,
a main work area and one inspector (Tools, Writer, Review, History). The
whole-document textarea is the authoritative input under a read layer drawn in
the same font and wrapping, so there is no Read/Edit switch. Tool forms read
and write controlled drafts in the lyric metadata (`app.lyricMeta`) until
Apply. Lyric work goes through the one AI writer; nothing here writes the
recipe. Gated with fixture replies by `scripts/check_lyrics_page.js`.

```yaml
name: lyrics-document-read-edit
kind: widget
selector: '[data-ui="ly-view"]'
surface: Lyrics — document toolbar Read / Edit switch
implementation: lyRenderDoc / ly-view in src/pages/lyrics.js
status: retired
precondition: empty
notes: Retired 2026-09-30 by the handoff spec (§1, §3). The document is always editable, with line selection at the same time, through one textarea over a synchronized read layer (lyRenderEditor).
```

```yaml
name: lyrics-song-title
kind: data-action
selector: '#ly-title-wrap'
surface: Lyrics — song header title: a heading button with a pencil; edits in place (Enter or blur commits, Escape restores, blank removes the title declaration and reads Untitled song); the workspace name shows separately
implementation: ly-title-edit / lyCommitTitle in src/pages/lyrics.js
status: reachable
precondition: empty
notes: Writes the [SETUP — title] declaration, never the workspace name. At most 160 characters.
```

```yaml
name: lyrics-song-brief
kind: data-action
selector: '#ly-brief'
surface: Lyrics — Song brief strip (brief, Hook, Edit brief) and its inline form (Creative brief, Exact hook line, Save brief, Cancel)
implementation: lyRenderBrief / ly-brief-save in src/pages/lyrics.js
status: reachable
precondition: empty
notes: The brief is creative context in app.lyricMeta (autosave, saved copies, session export/import, Undo); the hook is the existing exact-line declaration. Neither is graded.
```

```yaml
name: lyrics-inspector-tabs
kind: widget
selector: '.ly-itabs [role="tab"]'
surface: Lyrics — inspector tabs Tools, Writer, Review, History (arrows, Home and End move between them); below 960px a bottom Song / Tools / Writer / Review bar
implementation: lyRenderTabs / ly-tab / ly-mobile in src/pages/lyrics.js
status: reachable
precondition: empty
notes: The selected tab and tool are kept in the lyric metadata's ui record.
```

```yaml
name: lyrics-mobile-nav
kind: widget
selector: '#ly-mnav'
surface: Lyrics — below 960px of page width: one view at a time with Song / Tools / Writer / Review at the bottom; History from the Writer heading
implementation: ly-mobile in src/pages/lyrics.js; .ly-mnav in src/pages/lyrics.css
status: reachable
precondition: empty
notes: Hidden above 960px; the page's width class comes from its own container (ResizeObserver).
```

```yaml
name: lyrics-line-tools
kind: data-action
selector: '#ly-linebar, #ly-linedock'
surface: Lyrics — the selected sung line's Link rhyme / Rhythm / Pronunciation, beside the line when it fits, otherwise in the dock under the document
implementation: lyPlaceLineBar / ly-line-tool in src/pages/lyrics.js
status: reachable
precondition: empty
notes: Present while a sung line holds the caret or selection; hidden for header, setup and stamp rows. Never covers a word of the lyrics.
```

```yaml
name: lyrics-add-section
kind: data-action
selector: '[data-ui="ly-add-section"]'
surface: Lyrics — Sections → Add section: Verse, Pre-chorus, Chorus, Bridge, Intro, Outro, Hook, Refrain, Custom…
implementation: lyInsertSection in src/pages/lyrics.js
status: reachable
precondition: empty
notes: Custom opens Form & story with the new section's name selected.
```

```yaml
name: lyrics-find
kind: widget
selector: '[data-ui="ly-find-open"]'
surface: Lyrics — document toolbar Find: marks matches, n of m lines, previous/next (Enter / Shift+Enter) selecting the match in the document, Escape closes
implementation: lyFindStep / lyFindClose in src/pages/lyrics.js
status: reachable
precondition: empty
```

```yaml
name: lyrics-display
kind: widget
selector: '[data-ui="ly-menu"][data-id="display"]'
surface: Lyrics — document toolbar Display: text size and line numbers
implementation: ly-text-size / ly-numbers (UILayout.remember) in src/pages/lyrics.js
status: reachable
precondition: empty
notes: Layout preferences under codex-layout:*, never in the session or the document's identity.
```

```yaml
name: lyrics-outline
kind: widget
selector: '#ly-sections'
surface: Lyrics — Sections: each section with its line count, the caret's section highlighted; select to jump; 40 lines · 9 sections; collapses to a 48px rail (960–1279px always a rail, opening a 240px overlay with Close and Escape)
implementation: lyRenderOutline in src/pages/lyrics.js
status: reachable
precondition: empty
```

```yaml
name: lyrics-section-actions
kind: data-action
selector: '[data-ui="ly-tool"][data-id="form-story"]'
surface: Lyrics — Form & story: each section's Move up, Move down, Duplicate section and Remove, and a drag handle
implementation: ly-sec-move / ly-sec-dup / ly-sec-remove and row drag via lyEditSections in src/pages/lyrics.js
status: reachable
precondition: empty
notes: Line-number declarations (rhyme groups, returns, placement) follow their lines; members on removed lines are dropped and reported. Every change is one Undo step. Selector anchors the tool row; the table renders when the tool is open.
```

```yaml
name: lyrics-form-story
kind: data-action
selector: '[data-ui="ly-tool"][data-id="form-story"]'
surface: Lyrics — Form & story (in the main area): Section / Lines / Target / Story job table, Creative guidance from the declared jobs and notes, Edit selected section (name, target, story job, how it follows, section note)
implementation: lyToolFormStory and LY_FORMS['form-story'] in src/pages/lyrics.js
status: reachable
precondition: empty
notes: Story jobs map exactly to the harness atoms (Set the scene=ESTABLISH … Depart=DEPART) and junctions (Because=THEREFORE … Contrast=JUXTAPOSE); section notes are creative context in app.lyricMeta, never an atom. Guidance, not a grade.
```

```yaml
name: lyrics-song-setup
kind: widget
selector: '#ly-setup-list [data-ui="ly-tool"]'
surface: Lyrics — Song setup summaries
implementation: lyRenderSong in src/pages/lyrics.js
status: retired
precondition: empty
notes: Retired 2026-09-30. The Tools index (six rows with fixed help) replaces the setup summaries; declared values show in each tool.
```

```yaml
name: lyrics-plan
kind: widget
selector: '[data-ui="ly-song-tab"][data-id="plan"]'
surface: Lyrics — Song → Plan
implementation: lyPlanHtml in src/pages/lyrics.js
status: retired
precondition: empty
notes: Retired 2026-09-30. A running writer's stage (Planning, Drafting, Checking, Revising, Finished) is shown in Writer, read from the job receipt.
```

```yaml
name: lyrics-new-or-import
kind: data-action
selector: '[data-ui="ly-import"]'
surface: Lyrics — Sections → New (a blank draft, one Undo step) and Import (a text file, one Undo step)
implementation: ly-import / ly-blank in src/pages/lyrics.js
status: reachable
precondition: empty
notes: Imported text is kept exactly (line endings normalised).
```

```yaml
name: lyrics-new-song-writer
kind: data-action
selector: '[data-ui="new-lyrics"]'
surface: Lyrics — Write with AI → New song
implementation: new-lyrics → lyStartConversation('lyrics') in src/pages/lyrics.js
status: reachable
precondition: empty
notes: A new lyrics task carries the brief and section notes as lyric_context; creation keeps its server-enforced sweep → screen → plan → grade → revise.
```

```yaml
name: lyrics-edit-with-writer
kind: data-action
selector: '[data-ui="edit-lyrics"]'
surface: Lyrics — Write with AI → Edit this draft (a short prefill; the committed document travels as the request's page context)
implementation: edit-lyrics → lyStartConversation('lyrics-edit') in src/pages/lyrics.js; lyric_context in _chatSend (src/app.js)
status: reachable
precondition: empty
notes: The document sent as context leaves out the [SETUP] rows, because the harness reads each whole-line bracket as a section mark (lyric-harness/quality/recover.py); their values travel as exact declarations. A waiting, parked or unknown-outcome run is never reset: Writer offers Resume current work / Start independent work. Gated with fixture replies by scripts/check_lyrics_page.js (npm run test:app).
```

```yaml
name: lyrics-writer-panel
kind: widget
selector: '#lyrics-chat'
surface: Lyrics — Writer tab: the one AI writer's conversation, under the page's writer status (progress, recovery, waiting answer)
implementation: uiNavigate appends #chat-dock here (src/workbench.js); lyRenderWriter in src/pages/lyrics.js
status: reachable
precondition: empty
```

```yaml
name: lyrics-review-draft
kind: data-action
selector: '[data-ui="ly-run-review"]'
surface: Lyrics — Run review (the header's one primary action): one direct edit-phase request with the committed document, declarations, brief and notes; with pending tool changes it first offers Apply all / Review saved version
implementation: ly-run-review → lySubmitLyricsAction('review') in src/pages/lyrics.js
status: reachable
precondition: empty
notes: No hidden prefill and no Ask step. Gated with fixture replies by scripts/check_lyrics_page.js (npm run test:app).
```

```yaml
name: lyrics-review-tabs
kind: widget
selector: '#ly-review [data-ui="ly-rtab"]'
surface: Lyrics — Review: Issues / Needs input / Notes tabs
implementation: lyRenderReview in src/pages/lyrics.js
status: retired
precondition: empty
notes: Retired 2026-09-30. Review shows the current version's analysis state and coverage rows (Form, Rhymes, Rhythm, Pronunciation; Story as Creative guidance; Performance not assessed), suggestion cards, the review's findings, and Local checks in their own disclosure. See lyrics-review-panel.
```

```yaml
name: lyrics-review-panel
kind: widget
selector: '#ly-panel-review'
surface: Lyrics — Review tab: Current version with its label (Not reviewed, Reviewing this version, Reviewed for this version, Reviewed · issues found, Review needs input, Edited since review, Review incomplete), coverage, suggestions, Local checks
implementation: lyAnalysis / lyRenderReview in src/pages/lyrics.js
status: reachable
precondition: empty
notes: Certified for this version shows only when the server's artifact and completion certify exactly the current document. Persistence, analysis and the writer attempt are separate records.
```

```yaml
name: lyrics-check-and-apply
kind: data-action
selector: '[data-ui="ly-tab"][data-id="review"]'
surface: Lyrics — Review → a suggestion: baseline version, Original / Proposed, Keep mine, Apply change, Write my own (Put in draft, unchecked); stale → Recheck before applying (disabled) and Recheck suggestion
implementation: lySuggestionHtml / lyCheckApply in src/pages/lyrics.js
status: reachable
precondition: empty
notes: Apply re-reads the current draft and verifies the suggestion against it (the whole version it was made for, the target line, and this page's exact checks) before one undoable write. A whole writer draft that came without its request is an unchecked replacement. Gated with fixture replies by scripts/check_lyrics_page.js (npm run test:app).
```

```yaml
name: lyrics-history-recovery
kind: data-action
selector: '[data-ui="ly-tab"][data-id="history"]'
surface: Lyrics — History: writer results with version labels, saved runs with Retrieve saved result (a GET, nothing re-run), draft history, stamps; Writer shows Interrupted with Resume from saved draft / Retrieve saved result / Start new work / Technical details
implementation: lyRenderHistory / lyRenderWriter / lyRetrieve in src/pages/lyrics.js; recovery through _chatRecover (src/app.js)
status: reachable
precondition: empty
notes: Retrieve reads the saved outcome and never re-sends; an uncertain or capacity-stopped run offers no Resume; Resume is disabled while the draft differs from the checkpoint (Restore checkpoint draft). Unknown outcome: "Outcome unknown. Retrieve the saved result before starting another request."
```

```yaml
name: lyrics-export
kind: data-action
selector: '[data-ui="ly-menu"][data-id="export"]'
surface: Lyrics — Export: Copy with headers (exact document), Copy sung lines, Download text, Export session
implementation: copy-lyrics / ly-copy-sung / ly-download / ly-export-session in src/pages/lyrics.js
status: reachable
precondition: empty
notes: A failed copy leaves the exact text selectable on the page with Copy failed; Download says Text download started. Export session carries the lyric metadata (brief, notes, pending entries).
```

```yaml
name: lyrics-writing-tools
kind: widget
selector: '#ly-panel-tools'
surface: Lyrics — Tools index: Form & story, Rhymes, Rhythm, Pronunciation, Repeats & voices, Word rules, each with its fixed help; a selected tool shows Back to tools and its form; a pending strip ({n} pending changes, Apply, Discard)
implementation: lyRenderTools / lyPendingStrip in src/pages/lyrics.js
status: reachable
precondition: empty
notes: Pending values live in controlled drafts (app.lyricMeta.drafts) and never reach the document or a provider until Apply, which validates every field first and is one Undo step; a target that moved blocks Apply with "Target changed. Review these entries before applying."
```

```yaml
name: lyrics-rhyme-links
kind: data-action
selector: '[data-ui="ly-tool"][data-id="rhymes"]'
surface: Lyrics — Rhymes: relation (Any, Rhyme, Assonance, Consonance; custom under Advanced), placement, selected members, Link endings, Remove link, declared links lettered A, B… with "declared {relation}", Ask writer for rhyme options (matched / partial / refused)
implementation: lyToolRhymes / LY_FORMS.rhymes / ly-rhyme-options in src/pages/lyrics.js
status: reachable
precondition: empty
notes: Written as [SETUP — …] lines in the harness's own spelling. The relation is song-wide in the engine, so every link shares it. Rhyme options never insert a word or declare a link.
```

```yaml
name: lyrics-rhythm-placement
kind: data-action
selector: '[data-ui="ly-tool"][data-id="rhythm"]'
surface: Lyrics — Rhythm (in the main area): Meter, Section bars (optional), Pickup, Save rhythm, Copy to other sections, the section table
implementation: lyToolRhythm / LY_FORMS.rhythm in src/pages/lyrics.js
status: reachable
precondition: empty
notes: Declared only: no tempo is assumed and nothing is inferred. Every header shape round-trips (6/8; 6/8, pickup; 4 bars; 4 bars of 6/8).
```

```yaml
name: lyrics-word-rules
kind: data-action
selector: '[data-ui="ly-tool"][data-id="word-rules"]'
surface: Lyrics — Word rules: Required phrases and Avoid phrases, each a repeatable field with Add phrase
implementation: lyToolWordRules / LY_FORMS['word-rules'] in src/pages/lyrics.js
status: reachable
precondition: empty
notes: Exact normalized wording; blank entries ignored, duplicates kept once with a notice. No prose or cliché judgement.
```

```yaml
name: lyrics-pronunciation
kind: data-action
selector: '[data-ui="ly-tool"][data-id="pronunciation"]'
surface: Lyrics — Pronunciation: choose a sung word; its reading, dictionary options (Use reading), Declare my own (phones and a required source), Mark uncertain, Get dictionary options, Remove reading; changed text reads "Text changed · choose again"
implementation: lyToolPronunciation / LY_FORMS.pronunciation in src/pages/lyrics.js
status: reachable
precondition: empty
notes: A reading binds an exact line and sung-word position; identical lines share it. Supplied phones are validated like quality/pronunciation.py.
```

```yaml
name: lyrics-returns-voices
kind: data-action
selector: '[data-ui="ly-tool"][data-id="repeats-voices"]'
surface: Lyrics — Repeats & voices: detected exact repeats (View both, Declare exact repeat), declared returns (Clear), placed returns, parenthesised text as Unsung aside or Sung second voice
implementation: lyToolRepeats in src/pages/lyrics.js
status: reachable
precondition: empty
```

```yaml
name: lyrics-all-checks
kind: data-action
selector: '.ly-tool-tabs [data-ui="ly-tool"][data-id="checks"]'
surface: Lyrics — All checks tool
implementation: lyToolChecks in src/pages/lyrics.js
status: retired
precondition: empty
notes: Retired 2026-09-30. Review's coverage rows and its Local checks disclosure replace it; there is still no overall score.
```

```yaml
name: lyrics-page-resize
kind: drag-drop
selector: '#ly-body > .layout-splitter'
surface: Lyrics — the outline (200–300px) and inspector (320–420px) edges: drag, or arrow keys; Home resets
implementation: UILayout.splitter in the lyrics page layout()
status: reachable
precondition: empty
notes: Each stops before the document would fall below 560px; Reset layout clears both.
```

```yaml
name: lyrics-declared-melody
kind: widget
selector: '[data-ui="ly-tool"][data-id="rhythm"]'
surface: Lyrics — Rhythm → Declared melody (optional): note chips in scientific pitch with beats; Advanced input for meter, beat groups, bars per line, subdivision and hertz:ticks events
implementation: lyToolRhythm / LY_FORMS.melody / lyParseMelody in src/pages/lyrics.js
status: reachable
precondition: empty
notes: Validated to lyric-harness/MELODY.md; imported frequencies are kept as written. A declaration only; pitch, underlay and performance are not certified.
```

```yaml
name: lyrics-line-placement
kind: widget
selector: '[data-ui="ly-tool"][data-id="rhythm"]'
surface: Lyrics — Rhythm → Line placement (optional): per line Bar, Start beat and Duration, in beats or, once the meter is known, bars
implementation: lyToolRhythm / LY_FORMS.placement in src/pages/lyrics.js
status: reachable
precondition: empty
notes: Bars convert exactly to beats (2 bars of 6/8 is stored as 12 beats); all three blank is undeclared, a partial row is refused. Declared only; renumbered with section moves.
```

```yaml
name: lyrics-story-intentions
kind: widget
selector: '[data-ui="ly-tool"][data-id="form-story"]'
surface: Lyrics — Form & story → story job per sung section and how it follows the one before; Turn the story layer off; Clear story plan
implementation: lyToolFormStory / LY_FORMS['form-story'] in src/pages/lyrics.js
status: reachable
precondition: empty
notes: Written in the harness's narrative spelling (ESTABLISH,COMPLICATE/BUT,…). A record for the writer, not a gate.
```

```yaml
name: lyrics-structured-answer
kind: data-action
selector: '[data-ui="ly-tab"][data-id="writer"]'
surface: Lyrics — Writer → "The writer is waiting for an answer": the question, one answer field per asked line, Submit answer
implementation: lyRenderWriter and ly-answer → lySubmitLyricsAction('answer') in src/pages/lyrics.js
status: reachable
precondition: empty
notes: Sent to the same, still-waiting run (its continuation), never a fresh one. Selector anchors the Writer tab; the form exists only while a run waits in the live conversation. Gated with fixture replies by scripts/check_lyrics_page.js (npm run test:app).
```

```yaml
name: lyrics-placed-returns
kind: data-action
selector: '[data-ui="ly-tool"][data-id="repeats-voices"]'
surface: Lyrics — Repeats & voices → Placed returns: members at a place (first word, whole line, last word, word n) across lines
implementation: lyToolRepeats / LY_FORMS['repeats-voices'] in src/pages/lyrics.js
status: reachable
precondition: empty
notes: Kept alongside the exact returns in one declaration in the harness's spelling (e.g. 5.head,13.head).
```

## Genre page redesign (2026-09-25)

The Genre page (`src/pages/genre.js`, `src/pages/genre.css`): a Browse column (the 25 taxonomy roots, the current branch, Find a sound) beside the catalogue (Start exploring / All genres, Rows or List), with Your recipe as the shell's sidebar. On a fresh session Start exploring opens the first starter recipe (Delta blues) in place, so its five detail tabs resolve under `empty`. Selectors below are presence checks; the interactions were exercised in Chromium for the PR (targets filter and rank, tab keys, both instrument destinations, View on map and back, list position on return).

```yaml
name: genre-view-tabs
kind: widget
selector: '#surface-genre [data-ui="genre-view-tab"]'
surface: Genre — Start exploring / All genres (tab list; Arrow keys, Home, End)
implementation: genre-view-tab and gpTabKeys in src/pages/genre.js
status: reachable
precondition: empty
notes: A search always shows All genres; the six starter recipes, Suggestions for this recipe (when Your recipe has a primary genre) and Browse all live under Start exploring.
```

```yaml
name: genre-layout-rows-list
kind: widget
selector: '#surface-genre [data-ui="genre-layout"]'
surface: Genre — Rows / List. Rows (the default) is a row of cards per first letter under All genres (see "Browse rows"), and one row each for the starter recipes and the suggestions; a genre's details open at the top of the catalogue. List is the compact rows, details in place
implementation: genre-layout and gpLayout in src/pages/genre.js; remembered as the layout preference codex-layout:genre-view (a stored Grid reads as Rows), cleared by Reset layout
status: reachable
precondition: empty
```

```yaml
name: genre-browse-roots
kind: data-action
selector: '#genre-browse [data-ui="genre-branch"]'
surface: Genre — Browse column: the taxonomy roots (ten, then All 25 categories), a branch's children, Back; counts include cross-listed members and equal the list they open
implementation: gpBrowse / gpMembership in src/pages/genre.js
status: reachable
precondition: empty
```

```yaml
name: genre-browse-all-roots
kind: data-action
selector: '#genre-browse [data-ui="genre-roots"]'
surface: Genre — Browse: All 25 categories / Fewer categories
implementation: genre-roots in src/pages/genre.js
status: reachable
precondition: empty
```

```yaml
name: genre-browse-disclosure
kind: widget
selector: '#genre-browse [data-ui="genre-browse-toggle"]'
surface: Genre — narrow catalogue (phones, or the editor open beside it): Categories & find a sound, naming the branch and targets in force; Browse tree stays in the heading row
implementation: genre-browse-toggle in src/pages/genre.js; shown by the discovery container query in src/pages/genre.css
status: reachable
precondition: empty
```

```yaml
name: genre-find-a-sound
kind: widget
selector: '#genre-browse input[type="range"][data-axis]'
surface: Genre — Find a sound: one compact row per sound characteristic, its two ends either side of the slider (acoustic ——o—— processed / synthesized); three shown, All 13 characteristics for the rest. Moving, clicking or Enter applies a target; an applied row is outlined, bolds the end it leans to, shows its ×, and its value is the slider's value text and a chip above the list. The characteristic's name is the slider's label and tooltip. A Browse column too narrow for the ends beside the slider stacks them above it
implementation: gpApplyAxis / gpResults in src/pages/genre.js — keeps genres within one step of every target and ranks by total distance, the engine's --axis-target rule (scripts/search.js findClosestTraditionByAxis)
status: reachable
precondition: empty
```

```yaml
name: genre-find-a-sound-all-13
kind: data-action
selector: '#genre-browse [data-ui="genre-axes"]'
surface: Genre — Find a sound: All 13 characteristics / Fewer characteristics
implementation: genre-axes in src/pages/genre.js
status: reachable
precondition: empty
```

```yaml
name: genre-find-a-sound-clear
kind: data-action
selector: '#genre-browse .gp-axis-clear'
surface: Genre — Find a sound: clear one target (the × on an applied row, and the matching chip above the list); Reset clears all
implementation: genre-sound-clear / genre-sound-reset in src/pages/genre.js
status: reachable
precondition: empty
notes: The per-row clear is rendered hidden until its target applies (presence check only). Reset and Match a sound are disabled, with the hint "Choose a target, then match.", until one applies.
```

```yaml
name: genre-find-a-sound-match
kind: data-action
selector: '#genre-browse [data-ui="genre-sound-match"]'
surface: Genre — Match a sound: opens the genre closest to the targets (first of the ranked All genres list)
implementation: genre-sound-match in src/pages/genre.js
status: reachable
precondition: empty
```

```yaml
name: genre-detail-tabs
kind: widget
selector: '#genre-detail [role="tab"][data-ui="genre-tab"]'
surface: Genre detail — Overview / Sound profile / Instruments / Similar sounds / Background (tab list; Arrow keys, Home, End)
implementation: gpDetail / gpSetTab in src/pages/genre.js
status: reachable
precondition: empty
notes: Opens in place in its row, or at the top when the genre is not in the current list (a deep link, Similar sounds, the Map). Close (Esc) returns focus to the row it came from and puts it back in view.
```

```yaml
name: genre-detail-sound-targets-from-profile
kind: data-action
selector: '#genre-detail [data-ui="genre-sound-from"]'
surface: Genre detail — Sound profile / Similar sounds: Use as sound targets (sets all 13 targets to this genre's profile and lists the genres within one step)
implementation: genre-sound-from in src/pages/genre.js
status: reachable
precondition: empty
```

```yaml
name: genre-detail-instrument-destination
kind: widget
selector: '#genre-detail #gp-inst-dest'
surface: Genre detail — Instruments: "Add single instruments to" this genre (set up as it plays it; the group is created if absent), another genre already in Your recipe, or an independent instrument
implementation: gpInstruments / gpAddInstrument in src/pages/genre.js — the shell's uiAddInstrument with this destination (the canonical addInstrumentFromPicker path); the toast names the destination
status: reachable
precondition: empty
```

```yaml
name: genre-detail-instrument-add
kind: data-action
selector: '#genre-detail [data-ui="genre-inst-add"]'
surface: Genre detail — Instruments: Add one instrument to the chosen destination (also Inspect on the Instrument page, Listen, and Add the whole ensemble)
implementation: gpAddInstrument in src/pages/genre.js
status: reachable
precondition: empty
```

```yaml
name: genre-detail-view-on-map
kind: data-action
selector: '#genre-detail [data-ui="genre-map"]'
surface: Genre detail — View on map: the Map opens with this tradition selected; the toast offers Back to <genre>, and Back or the Genre tab return to the same detail
implementation: gpViewOnMap in src/pages/genre.js (the atlas's ?trad= deep link)
status: reachable
precondition: empty
```

```yaml
name: genre-detail-background-references
kind: widget
selector: '#genre-detail #gp-panel-background'
surface: Genre detail — Background: About, Lineage, Classification (primary path and cross-listings, "not a claim of historical descent"), Recordings & references (the catalog's exemplar artists with Listen searches; catalog status). Nothing is added that the catalog does not hold
implementation: gpBackground in src/pages/genre.js
status: reachable
precondition: empty
```

```yaml
name: genre-row-open
kind: widget
selector: '#genre-list .gp-row .gp-open'
surface: Genre — a List row: picture, name, branch, description; the text column fills the row up to Listen and Add to recipe, and the chevron sits at the row's right edge. The name button opens the details in place (keyboard route); a click anywhere else on the row that is not a control does the same
implementation: gpRow and the row click listener in src/pages/genre.js
status: reachable
precondition: genre list layout
```

```yaml
name: genre-media-photo-or-glyph
kind: widget
selector: '#surface-genre .gp-media'
surface: Genre — a genre's picture in List rows and details (a Rows card's picture is uiTile's; see "Browse rows"). When api/tradition_images.json is served (the tradition rows of PR #389's references/_image_manifest.json, derived by scripts/_image_tables.js compactTraditionImages and fetched once after the first paint), a tradition with an entry shows its thumb_url with "Photo: <credit> · <licence>" (linked to the source page in the details), and the photo is a button that enlarges it (photo-enlarge); in a row it sits beside the row's name button, never inside it; without an entry, without the table (a 404 is one quiet request, no script error), or when the image fails to load, the tradition's glyphs show whole and no credit is left behind
implementation: gpLoadOptional / gpIndexImages / gpImage / gpMedia and the image error listener in src/pages/genre.js; scripts/_image_tables.js compactTraditionImages builds the table
status: reachable
precondition: empty
notes: Presence check only (the glyph fallback always renders). The photo path was exercised in Chromium with PR #389's manifest served and the thumbnails stubbed, since the sandbox cannot reach Wikimedia.
```

```yaml
name: genre-explore-map
kind: data-action
selector: '#genre-browse [data-ui="genre-explore-map"]'
surface: Genre — Browse column: Explore the map
implementation: genre-explore-map in src/pages/genre.js
status: reachable
precondition: empty
```

## Map page (2026-09-25)

The Map page redesign (`docs/ui-foundation.md` → Map). Everything below lives
inside the atlas (`atlas.html`, `src/atlas.js`, `src/map-ui.js`, `src/map.css`),
which the Map view embeds as `#map-frame` and which also runs standalone. The
reachability gate evaluates `codex.html` only and cannot see into the frame, so
each entry's `selector` is the frame (its entry point) and `notes` names the
in-frame selectors and what verifies them: `scripts/test_atlas_controls.js`
(panels, filters, routes, collections, search), `scripts/check_layout_usability.js`
(search results inside the viewport, embedded and standalone, 360–1920 px) and
`scripts/check_ui_foundation.js` E (Add genre reports what arrived). The rest was
verified in a browser for this change; a frame-aware gate is a shell request.

```yaml
name: map-search
kind: widget
selector: '#map-frame'
surface: Map toolbar — search by name, place or catalog id, plus sound words; results list with glyphs, and a Sound-word match block saying which descriptors lit extra traditions and that they matched by descriptor, not name
implementation: onQuery in src/atlas.js
status: reachable
precondition: 'map view'
notes: In-frame #search, #results [data-tid], .results-sound. ArrowDown from the field walks the results. No-results text names the query and suggests a place, id or sound word. test_atlas_controls.js 3 and 5; check_layout_usability.js.
```

```yaml
name: map-filter-chips
kind: widget
selector: '#map-frame'
surface: Map toolbar — one chip per constraint in force (genre groups, collection, search), each with its own remove button, plus Clear filters; "No filters" when none
implementation: syncControls in src/atlas.js
status: reachable
precondition: 'map view'
notes: In-frame #filter-summary [data-clear], #clear-filters, #no-filters. Chips are rebuilt from state on every change, so a route (which clears filters) or a collection (which replaces groups and search) leaves no stale chip. A route is shown as its own map chip, not a filter. test_atlas_controls.js 1, 3, 4, 5, 6.
```

```yaml
name: map-side-tabs
kind: widget
selector: '#map-frame'
surface: Map side column — Genres, Routes and Collections tabs (aria-expanded for open, a dot and bold label for an applied filter), collapse to a rail, resizable edge; below 900px a bottom tab bar with In view, each opening a sheet over the map
implementation: setPanel, setCollapsed, syncSide in src/atlas.js; splitter in src/map-ui.js
status: reachable
precondition: 'map view'
notes: In-frame #t-territories, #t-routes, #t-threads, #t-inview, #t-collapse, .layout-splitter. Collapse is a codex-layout preference reset by Reset layout. Sheets close on an outside tap or Escape and return focus to their tab. test_atlas_controls.js 1.
```

```yaml
name: map-genre-groups
kind: widget
selector: '#map-frame'
surface: Map → Genres — all taxonomy groups with glyph (hue + shape), label and count; pick to show only those groups; Clear
implementation: renderLegend, toggleRoot in src/atlas.js
status: reachable
precondition: 'map view'
notes: In-frame #legend-panel [data-root] (aria-pressed), [data-act="clear-roots"]. Each group's (hue, shape) pair is read from the theme palette by the canvas and the DOM alike, so the marker and its legend entry always agree and colour is never the only cue. Choosing a group ends a collection. test_atlas_controls.js 1 and 4.
```

```yaml
name: map-key
kind: widget
selector: '#map-frame'
surface: Map — on-map key of the groups in view (toggle each), what a bubble means (documented scenes, not abundance; ring = group shares), All groups, Hide/Show
implementation: renderKey in src/atlas.js
status: reachable
precondition: 'map view'
notes: In-frame #legend-key [data-key-root], [data-act="toggle-key"], [data-act="all-groups"]. Hidden state is a codex-layout preference. Hidden below 900px, where the Genres sheet is the legend.
```

```yaml
name: map-routes
kind: widget
selector: '#map-frame'
surface: Map → Routes — every catalogued route; choosing one clears filters, fits it, draws it solid and numbers its endpoints 1 and 2 in source order; genre endpoints open their detail, place endpoints are labelled as places; a route chip on the map clears it; Hide routes
implementation: renderRoutes, pickRoute, clearRoute, drawRouteEnds in src/atlas.js
status: reachable
precondition: 'map view'
notes: In-frame #routes-panel [data-route] (aria-current, aria-expanded), .route-ends [data-tid], [data-act="hide-routes"], #route-chip [data-act="clear-route"]. The curve claims no path or intermediate stop. test_atlas_controls.js 6.
```

```yaml
name: map-collections
kind: widget
selector: '#map-frame'
surface: Map → Collections — each collection with its size; choosing one replaces groups and search, fits it, and lists its stops (not a route) with Clear; a stop's detail offers Back to collection
implementation: renderThreads, pickThread, renderThreadCard, exitThread in src/atlas.js
status: reachable
precondition: 'map view'
notes: In-frame #threads-panel [data-thid], #thread-card [data-tid], [data-act="exit-thread"], [data-act="back-thread"]. No line joins the stops. test_atlas_controls.js 2, 3, 7.
```

```yaml
name: map-in-view
kind: widget
selector: '#map-frame'
surface: Map side column — In view: every tradition in the current view (after filters), grouped by region with counts; Show all in a region expands in place
implementation: syncList in src/atlas.js
status: reachable
precondition: 'map view'
notes: In-frame #list [data-tid], [data-expand] (aria-expanded). Nothing in view says which filters are in force. check_layout_usability.js waits on its rows.
```

```yaml
name: map-location-chooser
kind: widget
selector: '#map-frame'
surface: Map — At this location: a bubble that cannot be zoomed apart, or pins sharing a pixel, list every member grouped by glyph, with Find a tradition here, Arrow/Home/End/Enter, and Back to in view (or Back to the map on a phone)
implementation: openStack, renderStack, renderStackList, wireStack in src/atlas.js
status: reachable
precondition: 'map view'
notes: In-frame #stack, #stack-filter, #stack-list [data-tid], [data-act="close"]. Docked it takes the column and the tab it displaced returns on Back; Escape or Back returns focus to the map. A screen-reader status reports the match count while filtering.
```

```yaml
name: map-tradition-inspector
kind: widget
selector: '#map-frame'
surface: Map — tradition inspector: classification path, name and place, Listen (external YouTube search), Add genre (embedded) or Open in Codex Musica (standalone), "Added n of m instruments" / failure with Retry, Open on the Genre page, background, Default recipe (not Your recipe; Copy default, Show full), Similar sounds with their basis (shared sound words named per row) or the stated fallback, collections and routes including it, Location and sources (documented place, drawn position, model-reviewed vs human-verified status, id, JSON)
implementation: select, renderCard, requestAdd and the genre-added listener in src/atlas.js; src/pages/map.js relays add-genre and genre-web
status: reachable
precondition: 'map view'
notes: In-frame #card, [data-act="add"], .add-status, [data-act="genre-page"], [data-act="copy"], [data-act="toggle-recipe"], [data-act="retry-detail"], [data-open-thread], [data-open-route], .card-sources. A thumbnail appears when references/_image_manifest.json has a tradition entry for the genre (read with the Genre page's rules, gpIndexImages / gpImage): its credit and licence are shown beneath it, linked to its https source page (Wikimedia Commons, or Flickr via Openverse); with no entry, or when the thumbnail fails to load, the group glyph. Exercised in Chromium on 2026-09-26 with the thumbnails stubbed (photo, credit, licence and link shown) and with them blocked (glyph fallback). check_ui_foundation.js E (add reports what arrived); test_atlas_controls.js 6, 7.
```

```yaml
name: map-view-controls
kind: keyboard-shortcut
selector: '#map-frame'
surface: Map — zoom in/out, Reset view, Fit route / collection / selection / results (shown only when there is something to fit); the focused map pans with arrow keys (Shift for more), zooms with + and -, resets with 0; drag, wheel and pinch
implementation: setupCanvas, zoomAt, fitTarget, fitPoints, resetView in src/atlas.js
status: reachable
precondition: 'map view'
notes: In-frame #zoom-in, #zoom-out, #zoom-reset, #zoom-fit, #canvas-host (tabindex 0, role application with its keys in the label).
```

```yaml
name: map-information
kind: widget
selector: '#map-frame'
surface: Map toolbar — Map information: bubbles count documented scenes, not abundance; pins drawn, model-reviewed and human-verified counts kept separate; how filters combine; imagery and projection; Reset layout
implementation: renderProvenance, setInfo in src/atlas.js
status: reachable
precondition: 'map view'
notes: In-frame #t-info (aria-expanded), #provenance, [data-act="reset-layout"]. Escape or an outside click closes it.
```

```yaml
name: map-panel-layout
kind: drag-drop
selector: '#map-frame'
surface: Map — side column, inspector and key each have Move / Resize / Reset (drag or arrow keys, Home resets); the column and inspector resize from their inner edge; Reset layout restores all
implementation: UILayout.floating / UILayout.splitter registered in src/map-ui.js
status: reachable
precondition: 'map view'
notes: In-frame .layout-panel-tools, .layout-splitter. A panel moved out of its column gives the column back to the map. Desktop widths only (900px and up); sheets below.
```

```yaml
name: map-standalone-atlas
kind: widget
selector: '#map-frame'
surface: atlas.html on its own (and the published standalone build) — the same map, panels and inspector in Light and Dark, with Open in Codex Musica instead of Add genre
implementation: atlas.html, scripts/build_atlas_standalone.js (shell) inlining src/atlas.js, src/map-ui.js, src/map.css
status: reachable
precondition: 'map view'
notes: check_layout_usability.js loads atlas.html standalone at every width; check_ui_foundation.js A applies the stored theme before first paint.
```

## Instrument page (src/pages/instrument.js)

The Instrument route is the reference layout: categories and sound properties, the catalogue, and an inspector that configures an instrument **before** it is added, over the Your recipe dock (`recipe: 'dock'`). The inspector works on a preview card built by the canonical engine (`makeCard` with the destination's `traditionCardOpts`, the seed `addInstrumentFromPicker` uses); choices run through `applyPartEdit(card, part, { quiet: true })`, `inverseConfigureForPreface` and the editor's plain environment/chain writes. Photos come from `references/_image_manifest.json` (on main since #389) through `scripts/_image_tables.js` `compactInstrumentImages`: the embedded build inlines the table as `CODEX_IMAGE_MANIFEST`, and the lazy shell fetches `api/instrument_images.json` the first time the Instrument page draws (`ipEnsureManifest`, with backoff), showing glyphs until it arrives and then redrawing without moving focus (`ipRedrawForPhotos`). Each photo comes with its credit and licence; a click on one enlarges it (see "Photo lightbox"). The preview never enters `app.cards`. Its inspector entries use the `instrument picker open, similar drill-down active` precondition, which opens it on `voice` (via `uiOpenSurface`).

```yaml
name: instrument-categories
kind: data-action
selector: '#instrument-body .ip-cats [data-ui="instrument-family"]'
surface: Instrument — Categories column (All instruments and the 11 families, with the count matching the current search and filters)
implementation: ipRenderCategories; instrument-family / instrument-all actions in src/pages/instrument.js
status: reachable
precondition: instrument picker open
```

```yaml
name: instrument-sound-properties
kind: widget
selector: '#instrument-body details.ip-prop input[data-ui="instrument-filter"]'
surface: Instrument — Sound properties, the engine's 15 filters grouped as disclosures (Behaviour, Voicing, Pitch, Register, Sound source, Expressiveness), each with the number that would match
implementation: IP_FILTER_GROUPS over INSTRUMENT_FILTER_PILLS; passesInstrumentFilter (AND) in src/app.js
status: reachable
precondition: instrument picker open
notes: Grouping only — the predicates are INSTRUMENT_FILTER_PREDS. A pill the engine adds later appears under "More properties". Conflicting properties (never true together in the catalogue) are named in the no-results state, which offers to remove each one.
```

```yaml
name: instrument-sort-and-view
kind: widget
selector: '#instrument-body #ip-sort'
surface: Instrument list header — Sort (Name A–Z, Name Z–A, Most customizable, within each row in Rows) and Rows / List (Rows, the default: see "Browse rows")
implementation: ipSorted; ip-view action (UILayout.remember 'instrument-view'; a stored Grid reads as Rows) in src/pages/instrument.js
status: reachable
precondition: instrument picker open
```

```yaml
name: instrument-add-destination
kind: widget
selector: '#instrument-destination'
surface: Instrument header — Add to (Independent instrument or a genre in Your recipe); the inspector's Add to mirrors it
implementation: ipSyncDestination in src/pages/instrument.js; read by uiAddInstrument in src/workbench.js
status: reachable
precondition: instrument picker open
```

```yaml
name: instrument-categories-disclosure
kind: data-action
selector: '[data-ui="ip-cats"]'
surface: Instrument — "Categories and sound properties" button that discloses the left column when the page is narrow (phone, or an editor open beside it)
implementation: ip-cats action in src/pages/instrument.js; container query in src/pages/instrument.css
status: reachable
precondition: instrument picker open
```

```yaml
name: instrument-inspector-tabs
kind: data-action
selector: '#instrument-preview [role="tab"][data-ui="ip-tab"]'
surface: Instrument inspector — Character, Parts, Environment, Signal chain, Output (arrow keys move between tabs)
implementation: ipRenderInspector in src/pages/instrument.js
status: reachable
precondition: instrument picker open, similar drill-down active
```

```yaml
name: instrument-inspector-part-options
kind: widget
selector: '#instrument-preview input[type="radio"][data-ip-part]'
surface: Instrument inspector → Parts — every part's options, each with its added (+), kept and removed (struck) descriptors against the current choice; long lists get a filter
implementation: ipRenderParts / ipOption / ipOptionDescs; ipChoose → applyPartEdit (src/app.js)
status: reachable
precondition: instrument picker open, similar drill-down active
notes: Parts expand on demand (ip-part). Parts carrying the universal cross-instrument materials show "More materials — any wood/string on any instrument (n)" as a searchable disclosure inside the part (data-ip-more); every material stays reachable. voice has none, so that disclosure is not asserted under this precondition.
```

```yaml
name: instrument-inspector-not-set
kind: widget
selector: '#instrument-preview input[type="radio"][data-ip-part][value=""]'
surface: Instrument inspector → Parts — "Not set" as an explicit option for every part; carried onto the added card as null
implementation: ipOption in src/pages/instrument.js
status: reachable
precondition: instrument picker open, similar drill-down active
```

```yaml
name: instrument-inspector-character
kind: widget
selector: '#instrument-preview #ip-pref-q'
surface: Instrument inspector → Character — current character (automatic or chosen), the suggestion for the configured sound, search across the preface lexicon, Back to automatic
implementation: ipRenderCharacter; ipApply 'preface' → inverseConfigureForPreface (same cascade as commitPrefaceChange)
status: reachable
precondition: instrument picker open, similar drill-down active
```

```yaml
name: instrument-inspector-character-browser
kind: widget
selector: '#instrument-preview details.ip-pcat[data-ip-pcat]'
surface: Instrument inspector → Character — the character category browser (the editor's 16 categories with glyphs and counts, Expand all / Collapse all, Recently used; searching shows every hit grouped by category)
implementation: ipRenderCharacter / ipPrefaceCategory over prefaceGroups, PREFACE_CAT_ORDER, prefaceGlyphsHTML and load/recordPrefaceRecent (src/app.js); a pick runs ip-preface → inverseConfigureForPreface on the preview
status: reachable
precondition: instrument picker open, similar drill-down active
notes: Same grouping, search predicate and recents as the editor's Browse modal (renderPrefaceModalBody); categories render their chips when opened.
```

```yaml
name: instrument-inspector-environment
kind: widget
selector: '#instrument-preview select[data-ip-env="room"]'
surface: Instrument inspector → Environment — tuning and room (Not set or any catalog entry), and which card supplies the recipe's one rendered environment (envCardOf)
implementation: ipRenderEnv in src/pages/instrument.js
status: reachable
precondition: instrument picker open, similar drill-down active
```

```yaml
name: instrument-inspector-signal-chain
kind: widget
selector: '#instrument-preview select[data-ip-fx="fx"]'
surface: Instrument inspector → Signal chain — all eight CHAIN_SECTIONS stages; Effects take any number (add and remove), the others Not set or one item
implementation: ipRenderChain in src/pages/instrument.js
status: reachable
precondition: instrument picker open, similar drill-down active
```

```yaml
name: instrument-inspector-output
kind: data-action
selector: '#instrument-preview [data-ui="ip-format"]'
surface: Instrument inspector → Output — the previewed instrument in Rich, Tags, Prose or Compact (compileStack), character count and Copy
implementation: ipRenderOutput; ip-copy → copyToClipboard
status: reachable
precondition: instrument picker open, similar drill-down active
```

```yaml
name: instrument-add-configured
kind: data-action
selector: '#instrument-preview [data-ui="ip-add-configured"]'
surface: Instrument inspector — "Add configured instrument" (or "Add instrument" when nothing was changed) to the named destination; Your changes lists what differs from the catalog default and what moved to match, with Review descriptor changes (added / removed / kept) and Reset
implementation: ipAddConfigured → uiAddInstrument(id, { configure, message }) → addInstrumentFromPicker(id, { configure }) (canonical picker path); configure copies the preview's parts, pins, character, environment and chain onto the new card before its one history entry
status: reachable
precondition: instrument picker open, similar drill-down active
notes: The added card keeps the previewed catalog id (canonical identity); the toast names the destination and the number of chosen settings. Undo removes the whole addition in one step.
```

```yaml
name: instrument-inspector-similar
kind: data-action
selector: '#instrument-preview [data-ui="ip-similar"]'
surface: Instrument inspector — Similar instruments (closest by sound axes, naming the closest axes), each with Listen and Add; opening one keeps a Back trail
implementation: findSimilarInstruments / getMatchingInstrumentAxes (src/app.js); ip-similar and ip-trail-back in src/pages/instrument.js
status: reachable
precondition: instrument picker open, similar drill-down active
```

```yaml
name: instrument-inspector-close
kind: data-action
selector: '#instrument-preview [data-ui="close-preview"]'
surface: Instrument inspector — Close (also Escape, last in the Escape order); focus returns to the row that opened it
implementation: uiCloseInstrumentPreview in src/pages/instrument.js
status: reachable
precondition: instrument picker open, similar drill-down active
```

```yaml
name: instrument-your-recipe-dock
kind: widget
selector: '#surface-instrument'
surface: Instrument — Your recipe as the dock under the page (select, duplicate, remove, pin, move to another genre and variations stay on its rows and in the shared editor)
implementation: uiRegisterPage({ recipe: 'dock' }) in src/pages/instrument.js; dock presentation in src/workbench.css
status: reachable
precondition: instrument picker open
```

## Photo lightbox (2026-09-26)

A catalog photo enlarges on a click and one more click anywhere puts it back. One shared helper serves every page: `uiPhoto` wraps a page's own `<img>` in a button (`data-ui="lightbox"`, a shell action) and `uiLightbox` opens it in a native modal `<dialog>`. Behaviour — not just presence — is gated by `scripts/check_ui_foundation.js` O. The Map's atlas card thumbnail (inside the atlas frame) is not a lightbox photo.

```yaml
name: photo-enlarge
kind: data-action
selector: '#instrument-preview .ip-media [data-ui="lightbox"]'
surface: A catalog photo — the Instrument inspector's, a List row's and a Similar instruments row's; a Genre List row's and details' (when references/_image_manifest.json is served). Named "Enlarge photo of <name>", with a zoom-in cursor; a click, Enter or Space shows it large. In a row it sits beside the row's own button, never inside it, where that button's padding used to put it; a glyph in its place (no photo, or one that failed to load) opens the row as before
implementation: uiPhoto and the 'lightbox' shell action (uiLightbox) in src/workbench.js; ipImage in src/pages/instrument.js; gpMedia in src/pages/genre.js
status: reachable
precondition: instrument picker open, similar drill-down active
notes: check_ui_foundation.js O clicks the Instrument inspector's photo, a Genre List row's photo (which must not open the row) and a genre's details' photo, and opens them with Enter and Space. A Rows card's photo opens the details instead (Browse rows); the details' photo enlarges.
```

```yaml
name: photo-lightbox
kind: modal
selector: '#ui-lightbox[open][role="dialog"][aria-modal="true"]'
surface: Photo lightbox — the photo as large as the viewport allows over the dimmed page, never cropped and never past its natural size, with "Photo: <credit> · <licence>" linked to the source page and "Click anywhere to close" ("Tap" on a touch screen). The thumb shows at once, scaled up; a 1280px Commons rendition, else the full image, replaces it when it loads, and if none loads the thumb stays. Nothing larger is requested before the click. A click anywhere (the photo, its frame, the dimmed page), Escape or Back closes it and focus returns to the photo
implementation: uiLightbox, uiCloseLightbox and uiPhotoSources in src/workbench.js; .cm-lightbox in src/workbench.css; the full image is the fifth field of the instrument and tradition photo tables (scripts/_image_tables.js; CODEX_IMAGE_MANIFEST in the embedded build, api/instrument_images.json and api/tradition_images.json in the lazy shell) and image_url in references/_image_manifest.json
status: reachable
precondition: photo enlarged
notes: The topmost layer — it owns its Escape, so nothing under it closes on the same key. The page underneath is inert and neither moves nor scrolls. Back is a history entry pushed on open (http and https only) and taken back when it closes any other way. check_ui_foundation.js O, on a desktop and a phone, in Light and Dark.
```

## Browse rows (2026-09-27)

Rows is the default layout of the Genre and Instrument catalogues (List is the other; Grid was retired). One shared component in `src/workbench.js` (`uiRowsHTML`, `uiRowsJumpHTML`, `uiTile`, `uiRowsKeep` / `uiRowsRestore`; styles `.cm-rows-*`, `.cm-tile-*` in `src/workbench.css`): one horizontally scrolling row of cards per group, a card being a photo (width from its proportions) with the name and one line (a genre's branch; an instrument's family · class). A row gets its cards when it comes near the screen, 30 at a time, and more as it is scrolled toward its end. Behaviour is gated by `scripts/check_ui_foundation.js` Q.

```yaml
name: browse-rows-genre-letters
kind: widget
selector: '#genre-list .cm-rows-group[aria-label]'
surface: Genre — All genres in Rows: one row per first letter (accents folded; # for digits), A to Z within it, headed by the letter and its count; search and the Browse branch narrow the rows and an empty row disappears; with sound targets it is one row, Closest to your sound, closest first, each card's line saying how close. A new list (search, branch, sound targets, tab) starts at the top of its results
implementation: gpLetterGroups / gpTile / gpAll in src/pages/genre.js; uiRowsHTML in src/workbench.js
status: reachable
precondition: 'genre: all genres'
```

```yaml
name: browse-rows-jump-letters
kind: widget
selector: '#genre-maintabs .cm-rows-jump [data-ui="rows-jump"]'
surface: Genre — the A–Z bar, sticky under the Start exploring / All genres tabs; a letter scrolls its row under the bar, is marked current (aria-current) while its row is the one in view, and takes focus to that row's heading so the next Tab goes on into the row; a letter with no genres is disabled; the bar fades at an edge its letters continue past; on a touch screen each letter is 44px tall to a thumb
implementation: uiRowsJumpHTML, uiRowsJump and uiRowsSpy in src/workbench.js
status: reachable
precondition: 'genre: all genres'
```

```yaml
name: browse-rows-instrument-families
kind: widget
selector: '#instrument-body .cm-rows-group[aria-label]'
surface: Instrument — All instruments in Rows: one row per family, largest first (by the catalogue's sizes, so rows keep their places while a search narrows them); inside a family, one row per class; Sort orders each row
implementation: ipGroups / ipTile in src/pages/instrument.js; uiRowsHTML in src/workbench.js
status: reachable
precondition: instrument picker open
```

```yaml
name: browse-rows-jump-families
kind: widget
selector: '#instrument-body .cm-rows-jump [data-ui="rows-jump"]'
surface: Instrument — the family bar (the class bar inside a family), sticky at the top of the catalogue; shown when two or more rows have instruments
implementation: uiRowsJumpHTML, uiRowsJump and uiRowsSpy in src/workbench.js
status: reachable
precondition: instrument picker open
```

```yaml
name: browse-rows-scroll
kind: widget
selector: '#surface-genre [data-ui="rows-scroll"]'
surface: A row's ‹ › buttons (desktop; hidden on a touch screen, which swipes), disabled at either end
implementation: the 'rows-scroll' shell action and uiRowsFill in src/workbench.js
status: reachable
precondition: empty
notes: Start exploring shows the starter recipes as one row.
```

```yaml
name: browse-card-details
kind: widget
selector: '#surface-genre .cm-tile-name[data-ui="genre-select"]'
surface: A card's name (one line, ellipsis, full name as its title) and its photo open the page's existing details — a genre's details at the top of the catalogue, an instrument's inspector; closing them returns focus to the card
implementation: uiTile and the photo click listener in src/workbench.js; genre-select (src/pages/genre.js), instrument-inspect (src/pages/instrument.js)
status: reachable
precondition: empty
```

```yaml
name: browse-card-listen-add
kind: widget
selector: '#surface-genre .cm-tile-play'
surface: Over a card's photo on hover or keyboard focus (always on a touch screen, 44px to a thumb), with a scrim and a slight zoom — Listen (the YouTube search Listen opens elsewhere) and Add (the page's own add). ✓ shows once the genre is in Your recipe — for an instrument, once it is in the Instrument page's "Add to" group — and takes those cards (a genre's, or the instrument's in that group only) out as one step; its toast's Undo puts them back only while the removal is the latest change
implementation: uiTile, uiTileAdd, uiTileCards, uiTilesSync and the 'recipe-remove' shell action (uiRemoveFromRecipe) in src/workbench.js; the instrument card's scope is ipDest() in src/pages/instrument.js
status: reachable
precondition: empty
```

```yaml
name: browse-card-photo-credit
kind: widget
selector: '#instrument-body .cm-tile-credit'
surface: A card's ⓘ (top right of a photo): the credit and licence as its tooltip; a click shows them with a link to the source page. A photo that fails to load gives way to the glyph and its ⓘ goes with it
implementation: uiTile, uiTileCredit and the 'tile-credit' shell action in src/workbench.js
status: reachable
precondition: instrument picker open
```

```yaml
name: browse-card-menu
kind: widget
selector: '#surface-genre .cm-tile-more[aria-haspopup="menu"]'
surface: A card's ⋮ — Add to recipe (Remove from recipe once in it), Listen on YouTube, Details, Photo credit; Up/Down between items, Escape back to the ⋮
implementation: uiTileMenu (one #cm-tile-menu filled from the card), uiToggleMenu and uiMenuControls in src/workbench.js
status: reachable
precondition: empty
```
