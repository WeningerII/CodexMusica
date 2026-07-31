# UI capability inventory

The single source of truth for every interactive surface in the codex. Read this before changing the UI. Update this in the same commit as any UI change. The build's reachability gate (`scripts/ui_reachability_check.js`) enforces that every `status: reachable` entry's selector resolves to at least one element under the entry's precondition. Surfaces that aren't catalogued here are invisible to the build gate, which is how the master-detail refactor silently dropped the stack signature panel, the tradition-group delete, and three drag-drop interactions.

**Last verified:** UI Capability Inventory Plan complete (2026-05-27). All 6 phases shipped. Reachability gate enforced via `scripts/ui_reachability_check.js` on every `build.js` run. Total entries: 80 reachable, 0 pending, 1 retired.

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
| `modal open: <id>` | `openModal(<id>)`. Modal IDs: `modal-add`, `modal-trad`, `modal-saved`, `modal-save`, `modal-preface`, `modal-recipe-stack`, `modal-attributions`. Use this only when the entry targets the modal frame itself (`#modal-X.open`), not its contents — for contents, use one of the populated-state preconditions above. |

When a future capability needs a precondition not listed here, add the precondition spec to `scripts/ui_reachability_check.js` AND document it in the table above in the same commit.

---

## Reachable entries

### App bar

```yaml
name: app-bar-traditions
kind: widget
selector: '#btn-traditions'
surface: app bar — "Traditions" button
implementation: DOMContentLoaded click handler opens modal-trad via renderTradPicker
status: reachable
precondition: empty
```

Opens the tradition picker modal at its tree-browser entry point.

```yaml
name: app-bar-saved
kind: widget
selector: '#btn-saved'
surface: app bar — "Saved" button
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
surface: app bar — "Add instrument" primary button
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
selector: '#starter-gallery [data-starter-trad]'
surface: empty state — curated starter-recipe buttons
implementation: renderEmpty populates STARTER_TRADITIONS; click calls importTraditionWithFeedback
status: reachable
precondition: empty
```

Loads a full curated tradition recipe onto the empty workbench.

```yaml
name: empty-surprise
kind: widget
selector: '#empty-surprise'
surface: empty state — "Surprise me" button
implementation: renderEmpty wires click to surpriseTradition (random tradition with 2+ instruments)
status: reachable
precondition: empty
```

### Empty state

```yaml
name: empty-state-add-instrument
kind: widget
selector: '#empty-add'
surface: empty state — primary "Add an instrument" button
implementation: click handler proxies to btn-add click
status: reachable
precondition: empty
```

```yaml
name: empty-state-browse-traditions
kind: widget
selector: '#empty-add-genre, #quick-trad'
surface: empty state — "Browse traditions" button
implementation: opens modal-trad via renderTradPicker
status: reachable
precondition: empty
```

```yaml
name: empty-state-quick-pick
kind: widget
selector: '#empty-state .quick-pick button'
surface: empty state — 5 starter-instrument chips
implementation: click adds the chip's instrument as a card
status: reachable
precondition: empty
notes: visible only when workspace is empty
```

### Sidebar — workspace header

```yaml
name: workspace-rename
kind: widget
selector: '#ws-rename-btn'
surface: sidebar header — pencil icon next to workspace name
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
surface: sidebar — instrument filter input
implementation: input handler sets app.sidebarFilter, calls renderSidebar
status: reachable
precondition: 1+ cards
notes: only renders when 1+ cards (filter has nothing to filter on empty)
```

### Sidebar — traditions

```yaml
name: sidebar-tradition-header
kind: widget
selector: '.sb-tradition-header'
surface: sidebar — per-tradition group header (chevron + name + status pill + count)
implementation: click toggles app.collapsedTraditionGroups Set entry
status: reachable
precondition: 1+ cards
```

```yaml
name: sidebar-card
kind: widget
selector: '.sb-card'
surface: sidebar — per-card row (thumb + line1 + line2 mini-fingerprint)
implementation: click sets app.selected = cardId, renders detail
status: reachable
precondition: 1+ cards
```

```yaml
name: sidebar-add-to-tradition
kind: widget
selector: '[data-add-to-trad]'
surface: sidebar — per-tradition-group "+ Add instrument to tradition" button
implementation: opens modal-add with traditionId pre-context
status: reachable
precondition: 1+ cards
```

### Sidebar — staple

```yaml
name: sidebar-staple-add
kind: widget
selector: '#sb-staple-add'
surface: sidebar — "Add {tradition} as secondary" button
implementation: click calls importTradition for the suggested tradition
status: reachable
precondition: 1+ cards
notes: only renders when a primary tradition is set; pool from findSimilar
```

```yaml
name: sidebar-staple-refresh
kind: widget
selector: '#sb-staple-refresh'
surface: sidebar — refresh button on staple panel (try another suggestion)
implementation: increments app._stapleIdx, re-renders sidebar
status: reachable
precondition: 1+ cards
notes: only renders when staple pool has > 1 candidate
```

### Sidebar — recipe preview

```yaml
name: sidebar-recipe-copy
kind: widget
selector: '#sb-recipe-copy'
surface: sidebar — copy button on recipe preview
implementation: click runs copyToClipboard with current compressRichRecipe output
status: reachable
precondition: 1+ cards
```

```yaml
name: sidebar-recipe-open-full
kind: widget
selector: '#sb-open-full-stack'
surface: sidebar — "Open full stack →" button
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
surface: detail tab bar — "Preface" tab
implementation: tab click sets card._uiTab = 'preface'
status: reachable
precondition: 1+ cards
```

```yaml
name: detail-tab-stack
kind: widget
selector: '.detail-tab[data-tab="stack"]'
surface: detail tab bar — "Stack" tab
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
selector: '#modal-add.open'
surface: instrument picker modal — search + family-grouped list
implementation: openModal('modal-add'); renderInstPicker populates
status: reachable
precondition: 'modal open: modal-add'
```

```yaml
name: modal-add-instrument-chip
kind: data-action
selector: '[data-add]'
surface: instrument picker modal — per-instrument chip in the family-grouped list
implementation: click handler calls addCard(instrumentId), closes modal, toasts confirmation, scrolls new card into view
status: reachable
precondition: 'instrument picker open'
notes: Bare-frame `modal open: modal-add` does NOT surface these — renderInstPicker populates the chip list. The user-triggered paths (sidebar plus, empty-state add) always render the picker before opening the modal.
```

```yaml
name: modal-add-axis-filter-toggle
kind: data-action
selector: '[data-filter-toggle]'
surface: instrument picker modal — axis-filter pill (one per filter axis)
implementation: click toggles the axis ID in app.instrumentAxisFilters set, re-renders picker with filter applied
status: reachable
precondition: 'instrument picker open'
```

```yaml
name: modal-add-axis-filter-clear
kind: data-action
selector: '[data-filter-clear]'
surface: instrument picker modal — "clear" button in the filter status row
implementation: click empties app.instrumentAxisFilters, re-renders picker
status: reachable
precondition: 'instrument picker open, filter active'
notes: Only renders when ≥1 filter is active. The clear button appears alongside the "N of M match" count.
```

```yaml
name: find-similar-instrument-add-to-canvas
kind: data-action
selector: '[data-add-inst]'
surface: instrument picker modal — "Add to canvas" button on each similar-instrument card in the find-similar drill-down view
implementation: click calls addCard(instrumentId), closes modal, toasts; reuses the same handler shape as modal-add-instrument-chip but renders inside the similar-instrument drill-down rather than the main picker
status: reachable
precondition: 'instrument picker open, similar drill-down active'
notes: The drill-down mode is triggered when app.similarInstFor is set to a known instrument id, switching the picker render path from the family-grouped chip list to the similar-instruments cards view (per axes-distance ranking).
```

```yaml
name: modal-trad
kind: modal
selector: '#modal-trad.open'
surface: tradition picker modal — V5 tree picker + similarity view
implementation: openModal('modal-trad'); renderTradPicker populates
status: reachable
precondition: 'modal open: modal-trad'
```

```yaml
name: modal-trad-tree-node-toggle
kind: data-action
selector: '[data-toggle-tree]'
surface: tradition picker modal — every tree row (branch and leaf)
implementation: click toggles node id in app.treeExpanded set, re-renders. Branch nodes show/hide children; leaf nodes expand to reveal Import + Find similar buttons.
status: reachable
precondition: 'tradition picker open'
```

```yaml
name: modal-trad-leaf-import
kind: data-action
selector: '[data-import]'
surface: tradition picker modal — "Import N" button on each expanded tradition leaf
implementation: click calls importTradition(tradId) which seeds all canonical instruments as cards
status: reachable
precondition: 'tradition picker open, tree expanded'
notes: Only renders under expanded leaf nodes. The tree-expanded precondition expands all visible nodes so every leaf's Import button surfaces.
```

```yaml
name: modal-trad-leaf-find-similar
kind: data-action
selector: '[data-similar]'
surface: tradition picker modal — "Find similar" button on each expanded tradition leaf with axis data
implementation: click sets app.similarFor = tradId, re-renders picker into similarity-view mode
status: reachable
precondition: 'tradition picker open, tree expanded'
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
surface: full recipe stack modal — opened from sidebar "Open full stack →"
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
surface: sidebar — trash icon in each tradition group header (after count)
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
surface: sidebar — up-arrow button in each tradition group header (between count and delete)
implementation: click handler computes seen-order from app.cards (first-appearance), finds previous group, splices the moving group's cards before the previous group's first card, pushes history and rerenders
status: reachable
precondition: 2+ cards
notes: Always visible (unlike delete, which is hover-faded) because this is the primary "reorder my groups" affordance, replacing the unreliable drag-and-drop discovery path. Button is disabled at the top of the list (idx === 0). Click does NOT trigger the header's collapse toggle — the header click handler checks `closest('.sb-tradition-move')` and bails.
```

```yaml
name: tradition-group-move-down
kind: data-action
selector: '.sb-tradition-header [data-move-trad-down]'
surface: sidebar — down-arrow button in each tradition group header (after up-arrow)
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
notes: Was HTML5 drag-and-drop, which is mouse-only, so on a phone this had NO route at all — unlike genre reorder there is no button equivalent. Rewritten on Pointer Events; touch arms on a 350ms long press. Group-target only; card-onto-card drop deferred. Exercised under real touch AND mouse by scripts/check_mobile_layout.js assertion H.
```

```yaml
name: card-pin-sidebar-visual
kind: widget
selector: '.sb-card.is-pinned .sb-card-pin'
surface: sidebar — pinned cards sort first within group; pin glyph on row
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

- Reachable: 80
- Pending: 0
- Retired: 1
- **Total tracked surfaces: 81**

When this count changes, update it here AND update the verification block in `scripts/ui_reachability_check.js`. Sanity match on every build.
