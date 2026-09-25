# UI capability inventory

The single source of truth for every interactive surface in the codex. Read this before changing the UI. Update this in the same commit as any UI change. The build's reachability gate (`scripts/ui_reachability_check.js`) enforces that every `status: reachable` entry's selector resolves to at least one element under the entry's precondition. Surfaces that aren't catalogued here are invisible to the build gate, which is how the master-detail refactor silently dropped the stack signature panel, the tradition-group delete, and three drag-drop interactions.

**Updated:** 2026-09-25 for the reference Your recipe panel (right-hand column, row and genre menus, Recording environment, Recipe preview format, AI entry; see "Your recipe — the reference panel" at the end) and before that for the shared UI foundation (theme, shell, one recipe panel on every route, lifecycle states; see `docs/ui-foundation.md` and the section at the end). Previously 2026-09-12 for the production shared workspace. Reachability is enforced by `scripts/ui_reachability_check.js`; this structural check proves selectors exist under stated preconditions, not that every workflow is usable. Browser mobile checks and `scripts/check_workbench.js` cover separate interaction and state boundaries.

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
| `instrument picker open` | `renderInstPicker()` then `openModal('modal-add')`. Required (over bare `modal open`) when the entry's selector targets a CHILD of the modal (an instrument chip, a filter pill) — the modal frame opens via `openModal` alone, but the chip list only renders when `renderInstPicker` fires. |
| `instrument picker open, filter active` | Same as `instrument picker open`, then add one axis filter to `app.instrumentAxisFilters` and re-render. Surfaces the `clear` button in the filter status row, which only appears when ≥1 filter is active. |
| `tradition picker open` | `renderTradPicker()` then `openModal('modal-trad')`. Required when the entry's selector targets a CHILD of the modal (a tree node, leaf button) — same reasoning as `instrument picker open`. |
| `tradition picker open, tree expanded` | Same as `tradition picker open`, then add every `data-toggle-tree` id to `app.treeExpanded` and re-render. Surfaces leaf-level buttons (`Import`, `Find similar`) that only render under expanded tradition nodes. |
| `recipe stack modal open` | 1+ cards, then `renderRecipeStack()` then `openModal('modal-recipe-stack')`. The recipe-stack body renders its empty-state ("No instruments on the canvas yet") when `app.cards` is empty, so cards must be added first. |
| `preface just committed with shifts` | 1+ cards, then `card._uiTab = 'preface'`, then `commitPrefaceChange(card, 'liturgical')`. `delta_blues` voice + `liturgical` reliably produces non-empty shifts (tuning + room changes) via the inverse algorithm, which populates `_recentShiftsByCard` and surfaces the panel. |
| `instrument picker open, similar drill-down active` | Set `app.similarInstFor = 'voice'`, then `renderInstPicker()`, then `openModal('modal-add')`. The picker re-renders into similar-instrument drill-down mode (different DOM tree than the family-grouped chip list). |
| `saved workspaces list open` | Install a `window.storage` mock (the RESET does this automatically when no real storage exists — Claude.ai provides one, headless Chromium doesn't), seed one workspace fixture into both `codex:list` and `codex:ws:gate-fixture`, then `openModal('modal-saved')` and `await renderSaved()`. Surfaces one row with Load / Fork / Delete controls. The `_gate_mock` flag on the mock prevents the fixture preconditions from polluting real storage if it's ever present. |
| `genre search: no results` | Type a query no genre matches into `#genre-search`, clear `UI.genre`, `renderGenreDiscovery()`. Surfaces the no-results state and its Clear search. |
| `instrument search: no results` | Type a query no instrument matches into `#instrument-search`, `renderInstrumentDiscovery()`. Surfaces the no-results state and its recovery actions. |
| `genre just imported` | `await importTraditionWithFeedback('delta_blues')`. Surfaces the import toast and its Undo action. |
| `map view` | `uiNavigate('map')`. The Map presents Your recipe as a dock. RESET returns every group to the Genre section with both search fields cleared. |
| `modal open: <id>` | `openModal(<id>)`. Modal IDs: `modal-add`, `modal-trad`, `modal-saved`, `modal-save`, `modal-preface`, `modal-recipe-stack`, `modal-attributions`. Use this only when the entry targets the modal frame itself (`#modal-X.open`), not its contents — for contents, use one of the populated-state preconditions above. |

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
implementation: click handler opens modal-add via renderInstPicker
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
implementation: renderEmpty populates STARTER_TRADITIONS; click calls importTraditionWithFeedback
status: reachable
precondition: empty
```

Loads a full curated tradition recipe onto the empty workbench.

```yaml
name: empty-surprise
kind: widget
selector: '[data-ui="surprise"]'
surface: More menu — Surprise me
implementation: renderEmpty wires click to surpriseTradition (random tradition with 2+ instruments)
status: reachable
precondition: empty
```

### Empty state

```yaml
name: empty-state-add-instrument
kind: widget
selector: '#btn-add'
surface: shared recipe — Add instrument
implementation: click handler proxies to btn-add click
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
implementation: click adds the chip's instrument as a card
status: reachable
precondition: instrument picker open
notes: visible only when workspace is empty
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
notes: The per-row mini-fingerprint was dropped from the row for the reference layout; the tradition fingerprint stays in the editor header.
status: reachable
precondition: 1+ cards
```

```yaml
name: sidebar-add-to-tradition
kind: widget
selector: '[data-add-to-trad]'
surface: Your recipe — "+ Add instrument" inside each genre (accessible name "Add instrument to <genre>")
implementation: opens modal-add with traditionId pre-context
status: reachable
precondition: 1+ cards
notes: The instrument picked from the modal joins THAT group — it is configured
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
implementation: handleAction similar case sets app.similarInstFor, opens modal-add
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
implementation: openModal('modal-add'); renderInstPicker populates
status: reachable
precondition: instrument picker open
```

```yaml
name: modal-add-instrument-chip
kind: data-action
selector: '[data-ui="instrument-add"]'
surface: Instrument catalog
implementation: click handler calls addCard(instrumentId), closes modal, toasts confirmation, scrolls new card into view
status: reachable
precondition: instrument picker open
notes: Bare-frame `modal open: modal-add` does NOT surface these — renderInstPicker populates the chip list. The user-triggered paths (sidebar plus, empty-state add) always render the picker before opening the modal.
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
implementation: click calls addCard(instrumentId), closes modal, toasts; reuses the same handler shape as modal-add-instrument-chip but renders inside the similar-instrument drill-down rather than the main picker
status: reachable
precondition: instrument picker open, similar drill-down active
notes: The drill-down mode is triggered when app.similarInstFor is set to a known instrument id, switching the picker render path from the family-grouped chip list to the similar-instruments cards view (per axes-distance ranking).
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
selector: '#surface-instrument .listen'
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
surface: shared workbench
implementation: src/workbench.js
status: reachable
precondition: empty
```

```yaml
name: lyrics-use-recipe
kind: widget
selector: '[data-ui="attach-recipe"]'
surface: shared workbench
implementation: src/workbench.js
status: reachable
precondition: empty
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
notes: In-frame #card, [data-act="add"], .add-status, [data-act="genre-page"], [data-act="copy"], [data-act="toggle-recipe"], [data-act="retry-detail"], [data-open-thread], [data-open-route], .card-sources. A thumbnail appears only when references/_image_manifest.json lists one with a credit or licence, which is shown beneath it; otherwise the group glyph. check_ui_foundation.js E (add reports what arrived); test_atlas_controls.js 6, 7.
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

The Instrument route is the reference layout: categories and sound properties, the catalogue, and an inspector that configures an instrument **before** it is added, over the Your recipe dock (`recipe: 'dock'`). The inspector works on a preview card built by the canonical engine (`makeCard` with the destination's `traditionCardOpts`, the seed `addInstrumentFromPicker` uses); choices run through `applyPartEdit(card, part, { quiet: true })`, `inverseConfigureForPreface` and the editor's plain environment/chain writes. Photos come from `CODEX_IMAGE_MANIFEST`, inlined by `scripts/build_html.js` from `references/_image_manifest.json` (the file is on main since #389), each with its credit and licence. The preview never enters `app.cards`. Its inspector entries use the `instrument picker open, similar drill-down active` precondition, which opens it on `voice` (via `uiOpenSurface`).

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
surface: Instrument list header — Sort (Name A–Z, Name Z–A, Most customizable) and List / Grid
implementation: ipSorted; ip-view action (UILayout.remember 'instrument-view') in src/pages/instrument.js
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
