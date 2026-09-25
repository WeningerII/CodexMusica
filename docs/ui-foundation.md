# UI foundation — shared shell, theme, recipe workspace and page boundaries

This is the contract between the shared foundation and the four page owners
(Genre, Instrument, Map, Lyrics) of the Codex Musica redesign. It records what
the foundation implements, the interfaces pages build on, which files each
owner may change, and what remains page work. The four final page layouts are
**not** built yet; every capability the current pages had is still reachable.

One integration owner holds the shared files below and merges page work.
Page owners do not redefine themes, navigation, the recipe engine or session
behaviour; they ask the integration owner for a shell change instead.

## Files and owners

| Owner | Files |
|---|---|
| Shell (integration owner) | `src/workbench.js`, `src/workbench.css`, `src/theme.css`, `src/theme.js`, `src/layout.js`, `src/layout.css`, `src/index.template.html`, `scripts/build_html.js`, `scripts/build_atlas_standalone.js`, `scripts/check_ui_foundation.js` and the other UI gates |
| Canonical engine (integration owner) | `src/app.js` — cards, parts, prefaces and cascades, rooms, tunings, chain, compilation, history, saves, dialogs, chat. Pages call it; they do not fork it. |
| Genre page | `src/pages/genre.js`, `src/pages/genre.css` |
| Instrument page | `src/pages/instrument.js`, `src/pages/instrument.css` |
| Map page | `src/pages/map.js`, `src/pages/map.css`, `atlas.html`, `src/atlas.js`, `src/atlas-tiles.js`, `src/map-ui.js`, `src/map.css` |
| Lyrics page | `src/pages/lyrics.js`, `src/pages/lyrics.css` — lyric workflows go through the existing chat contracts in `src/app.js`; `lyric-harness/` is not UI code |
| Shared, each owner adds its own entries | `tests/ui_capability_inventory.md` |

`codex.html` is generated (`CODEX_OUT_DIR="$(pwd)" npm run build:html`) and
byte-checked by `npm run check:fresh`; never edit it by hand.

Load order in the page: theme boot (in `<head>`) → template styles →
`src/theme.css` → `src/workbench.css` → `src/pages/*.css` (genre, instrument,
map, lyrics) → `src/layout.css`; scripts: catalog data → `src/layout.js` →
`src/app.js` → `src/workbench.js` → `src/pages/*.js`.

## Page interface

A page registers once, at load, from its own file:

```js
uiRegisterPage({
  id: 'genre', // one of genre | instrument | map | lyrics
  recipe: 'sidebar', // or 'dock': how Your recipe is presented on this route
  mount(surface) {}, // build the page once inside <section id="surface-genre">
  render() {}, // show current state; called on every visit and refresh
  layout() {}, // page-specific UILayout panes, once, after the shell's
  resetLayout() {}, // extra work for Reset layout
  escape() {}, // close what this page opened (last in the Escape order)
  actions: { 'genre-branch': (id, button, event) => {} }, // data-ui="…" handlers
});
```

The shell refuses an unknown route, a second registration, and an action name
the shell or another page already owns. Route order, labels, icons and colours
are the shell's (`UI_ROUTES`); deep links are `codex.html#genre|instrument|map|lyrics`
and `codex.html?trad=<id>` (opens that tradition's Genre detail; adds nothing).

## Shell APIs pages may use

| API | Contract |
|---|---|
| `uiNavigate(view, { push })` | Show a section. `push: true` for a user's own navigation, so Back/Forward step between sections. |
| `uiAddGenre(id)` | Add a genre's configured ensemble to the shared recipe through the canonical import. Resolves `{ added, expected }`; refuses a second concurrent addition; the toast offers Undo (refused if later changes followed) or Retry. |
| `uiAddInstrument(id)` | Add one instrument through the canonical picker path, to the destination selected in the Instrument page's "Add to". |
| `uiOpenEditor(cardId)` | Open the shared editor on a card. |
| `uiSaveLyrics()` | Commit `#lyrics-draft` to the session (`app.lyrics`) and autosave. |
| `uiNewTask(domain)`, `uiChatOpen()` | Start or open the one AI writer (`recipe`, `lyrics`, `lyrics-edit`). |
| `uiButton(action, label, icon, extra)` | A labelled button with an icon; `data-ui` routes the click. |
| `listenLink(name, instrument)` | The external YouTube search link ("Listen"). There is no native player. |
| `uiEmptyState({ title, text, actions, tone })` | Empty, no-results and failure blocks (`tone: 'danger'`), with recovery actions. |
| `uiFocus(el)`, `uiFind(selector, key, value)` | Focus return helpers (match by `dataset`, no `CSS.escape`). |
| `showToast(message, kind, action)` | `kind` `success`/`error`; `action` `{ label, run }` adds one button. |
| `UITheme` | `preference()` (`system`/`light`/`dark`), `theme()` (resolved), `set(pref)`, `onChange(fn)`, `token(name, fallback)` for canvas drawing. |
| `UILayout` | `splitter({ side: 'left'|'right'|'top' })` (drag, arrows, Home, End, double-click), `floating`, `anchor`, `remember(key, initial)`, `refresh`, `reset`, `tooltips`. |

State: `app.*` (src/app.js) is the recipe and session — cards, selection,
history, `workspaceName`, `lyrics`. `UI.*` is shell state; `UI.genre`/`UI.genreNode`
belong to Genre, `UI.instrumentFamily`/`UI.instrumentClass`/`UI.instrumentPreview`
to Instrument. Pages keep any other state private to their file.

Session formats are unchanged and must stay so: autosave `codex-workbench-v1`
(version 1) plus the per-tab recovery copy `codex-workbench-recovery`; named
saves `codex:ws:*` indexed by `codex:list` (schema 2); export version 3; the
legacy keys still load. Layout preferences live under `codex-layout:*` and
never enter the session. The theme preference is `codex-theme`.

## One recipe workspace

`#workspace-sidebar` is the only recipe panel and `#workspace-detail` the only
editor, on every route. Nothing copies or snapshots them. The panel is headed
"Your recipe"; a tradition's stock recipe on the Map is labelled "Default
recipe" and is a different object (copying it never touches Your recipe).

- `recipe: 'sidebar'` — a column, resizable (drag or arrow keys on its
  separator), collapsible to a rail from its header, both remembered.
- `recipe: 'dock'` — a strip under the page (the Map uses it): actions and name,
  the recipe tree, and the preview side by side; resizable from its top edge
  (drag or Up/Down), collapsible to its header. The editor opens beside the page.
- Below 900 px — the Recipe sheet (header button). On the Map and Lyrics the
  sheet stops at 60 % of the height so the map and the document stay usable.

The editor's tabs are Character, Parts, Environment, Signal chain and Output
(ids `preface`, `parts`, `env`, `chain`, `stack`).

## Theme

`src/theme.js` resolves Light, Dark or System before the first paint (inlined
in `codex.html`, blocking in `atlas.html`), stores it, follows the system live,
and reaches the atlas in the Map through the storage event or a postMessage.
The setting is in More → Theme.

Use tokens, never literal colours: `--cm-canvas`, `--cm-surface`,
`--cm-surface-subtle`, `--cm-surface-sunken`, `--cm-surface-overlay`, `--cm-text`,
`--cm-text-secondary`, `--cm-text-muted`, `--cm-border(-subtle|-strong)`,
`--cm-accent(-soft|-text)`, `--cm-link`, `--cm-focus`, `--cm-emphasis`, status
tones `--cm-success|warning|danger|info` with `-soft` and `-text`, the palette
`--cm-red|orange|amber|green|teal|blue|indigo|violet|pink`, section colours
`--cm-route-*`, map colours `--cm-map-*`, shadows `--cm-shadow-1..3`, and the
type, radius and size tokens. Dark surfaces are neutral (equal R, G, B); the
gate fails on a hue. Colour never carries meaning alone: status is icon + word.

Shared components (in `src/theme.css`): `.cm-btn` (+ `-primary`, `-tonal`,
`-outline`, `-danger`, `-icon`), `.cm-input`, `.cm-select`, `.cm-search`,
`.cm-tab`, `.cm-chip` (`aria-pressed`), `.cm-menu`, `.cm-segmented`,
`.cm-accordion`, `.cm-status` (`data-tone`), `.cm-empty`, `.cm-panel`,
`.cm-scrim`. Page CSS scopes its rules to `#surface-<page>` or to its own
classes and does not restyle shell selectors (header, workspace grid, recipe
panel, editor, dialogs, AI writer).

## Layers, keyboard and focus

Escape closes the topmost layer only and returns focus to what opened it: a
dialog (src/app.js), then More, the AI writer, the Recipe sheet (below
900 px), the editor, then the page's own `escape()` (Genre: the inline tree,
then a genre's detail; Instrument: the preview). Back and Forward step between
sections. Dragging keeps working and every drag has a keyboard or button
alternative; splitters widen for touch.

## Lifecycle states the foundation provides

- Loading: the catalog boot shows "Loading the catalog…" instead of the
  unwired legacy header; the Map shows "Loading the map…" until the atlas loads.
- Failure and retry: a failed catalog boot shows its Reload; a failed genre
  fetch offers Retry; the AI service status keeps its Retry.
- Empty: a new session shows what to do in Your recipe; no-results says which
  constraints are in force and offers to clear each.
- Success and partial addition: the import toast names the count when only
  part of an ensemble arrives ("Imported n/m instruments from …"), and the
  Map's link reads "Added n of m instruments · Add again".
- Session: Save (a named copy), Saved sessions (load, independent copy, delete)
  and the Autosaved status are separate. The status says Autosaved only after a
  real write, "Not autosaved" when another tab owns the session (Keep this
  session / Export), "Autosave failed" when the browser refuses.
- Undo/Redo step through session changes (recipe, name, lyrics); text fields
  keep their own Ctrl/Cmd+Z.
- AI writer: Connecting / unavailable with Retry, running, a request running in
  the other writer, saved runs and recovery — unchanged from `src/app.js`.

## What remains page work

Nothing below is implemented by the foundation. Each item needs real wiring,
an entry in `tests/ui_capability_inventory.md`, and a gate where it is a claim.

- **Genre** — the reference layout (Browse column, Start exploring / All genres,
  recipe sidebar on the right); List/Grid; "Find a sound" with the 13
  characteristics as applied, clearable controls; Overview / Sound profile /
  Instruments / Similar sounds / Background tabs; recordings and references
  only from real sources; an explicit destination when adding one instrument
  from a genre's roster (today it follows the Instrument page's "Add to").
- **Instrument** — catalogue, full-settings inspector and recipe dock
  (`recipe: 'dock'` is available); configure-before-add that carries the shown
  variants into the named destination; "Not set" and expanded materials in the
  inspector; the 15 sound-property filters as disclosures; Similar instruments
  in the inspector.
- **Map** — contextual Genres / Routes / Collections panel, the tradition
  inspector, location chooser polish, marker and legend colours that agree
  (the atlas reuses ten hues across its 26 root groups), Map information and
  provenance,
  and reflecting the current exclusivity rules (a route clears filters; a
  collection or search can replace other selections) without implying combined
  behaviour.
- **Lyrics** — the document with sections and outline, one active review
  decision with Check & apply against the current draft, pronunciation input,
  coverage, history and safe recovery, writing tools; all through the existing
  lyric contracts (see `docs/pronunciation-choices.md` and
  `docs/workflow-recovery.md`).

## Verification

```sh
npm run check:ui          # this contract, in Chromium (theme, one workspace, layers, states)
npm run check:mobile      # phone layout, touch targets, drag and drop
npm run reachability      # every inventory entry resolves
node scripts/check_layout_usability.js
node scripts/check_workbench.js
```

`npm run check:ui` is two-sided: `scripts/faults.js` plants a theme applied
after the first paint and a Map without Your recipe, and the gate must fail on
each.
