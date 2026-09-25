# Codex Musica — shared UI foundation handoff

Work in **WeningerII/CodexMusica** as the first shared-foundation implementer.

The user has settled the four page designs and wants implementation to begin. Build and integrate the common foundation before separate instances implement the respective page layouts. This is production work. Complete this scoped implementation; do not stop at an audit, a plan, design tokens alone, or disconnected example components.

You are authorized to implement, verify, push an isolated branch, create or update its PR, and merge once the repository's required checks and integration requirements pass. Follow actual repository instructions and existing authorization. Keep the user informed of meaningful progress and report real blockers accurately.

## 1. Establish the current repository state

Fetch current main; inspect the working tree, open PRs, CI and relevant recent merges. Read applicable AGENTS.md, CLAUDE.md and other repository instructions. Use an isolated branch/worktree and preserve other instances' work.

The design audit was based on main `1f9678e67408d97dd7d0e358eb7d1c375920263d` on 23 September 2026. This is a historical reference, not a statement about current main. The preceding conversation generated concepts and an audit; it did not implement these designs.

Verify current paths. Research starting points are `src/workbench.js`, `src/app.js`, `src/index.template.html`, `src/workbench.css`, `src/layout.js`, `src/atlas.js`, `src/map-ui.js`, `atlas.html`, `docs/production-workbench.md` and `tests/ui_capability_inventory.md`. For lyric contracts, inspect the relevant current modules and `docs/pronunciation-choices.md`, `docs/workflow-recovery.md` and `docs/lyrics-report-fixes.md`. Some historical inventory descriptions reference retired visuals; reconcile them against current behavior and the user's latest direction.

Inspect the running UI as well as source. Reuse the existing stack and canonical engines; make targeted changes rather than undertaking an unrelated framework or backend rewrite. Preserve ongoing harness fixes, data and connector behavior.

## 2. Use the correct visual references

These FOUR attached images are the current reference set:

| Page | Theme illustrated | Exact final image filename |
| --- | --- | --- |
| Genre | Light | exec-ef297381-a9c2-4f2a-9943-8acc70acaa39.png |
| Instrument | Light | exec-57f2f076-825a-4a66-8c60-13de532de63d.png |
| Map | Dark | exec-49e63454-508f-4cfe-a674-cd9abc7ad926.png |
| Lyrics | Dark | exec-2cb51a12-8775-4031-8f38-a0f61e379a4b.png |

Inspect all four. If an attachment is missing, resolve the exact artifact where available; do not substitute another generated iteration. You can inspect the repository and work on independently grounded foundation requirements while obtaining a missing image.

The audit reproduced below predates these final images. Its older image links identify historical drafts and **do not override this table**. Its functional preservation requirements still apply, including corrections now pictured in the revised images. Do not reintroduce old native playback bars, conflicting map filters or incomplete settings.

Generated screenshots are design references, not authoritative catalog data, working UI, licensed historical photographs, exact map geometry or final icon assets. Derive real names, counts, options and locations from canonical data. Consolidate a real shared brand/icon asset set; resolve minor generated inconsistencies through the user's direction and existing approved repository assets.

## 3. The settled visual direction

- Exactly four sections in order: **Genre → Instrument → Map → Lyrics**. Preserve existing navigation/deep-link behavior. Do not add a Studio page or split the experience into more pages.
- **Every page supports both light and dark mode.** The user requested only four example images instead of eight. Theme is a shared preference, not a hardcoded property of a route.
- Light mode uses white and neutral light grays across the entire shell, including navigation and sidebars. Dark mode uses black and neutral charcoal. Remove the former navy/blue cast.
- Use the **full colour palette** in recognizable icons, categories, markers and meaningful accents: red, yellow/amber, orange, green, blue, teal and violet as appropriate. The user explicitly rejected an earlier blue-and-green-only result. Neutral backgrounds do not mean a monochrome interface.
- Match the clean Google/OpenAI surface treatment: clear typography, consistent rounded controls, comfortable internal padding, restrained borders/shadows and flat fills. Preserve visible affordances and contrast.
- Keep icons next to words, consistent meanings across routes/themes, clear focus/selected/disabled states, and textual status labels. Do not rely on colour alone.
- Retain the approved information density and layouts. Genre has a bright catalogue and recipe sidebar; Instrument has catalogue, full settings inspector and recipe dock; Map stays prominent with contextual panels; Lyrics has a spacious document, outline and one active review decision.
- Advanced functions belong in intuitive tabs, menus, drawers and contextual panels. Progressive disclosure must preserve complete access. Do not remove functionality to make the page sparse.
- No filler charts, star/favourite features, decorative prose, gratuitous popups or extra confirmation barriers for routine reversible actions.

## 4. Implement the common foundation

Choose the smallest maintainable structure compatible with the existing app. Establish real reusable interfaces and ownership boundaries without a wholesale rewrite.

1. **Themes and shared styling.** Implement semantic tokens for surfaces, text, borders, spacing, typography, corners, focus, interactive states, icon colours and status colours. Provide one reachable theme setting, persist the user's choice and honor system preference when appropriate. Avoid an incorrect-theme flash and preserve preference through route changes and reloads. Both themes must reach every route and overlay.

2. **Application shell and controls.** Integrate common navigation, branding, search/button/input patterns, tabs, selectors, menus, accordions, status feedback and overlays into actual application routes. Keep Save, Saved sessions and Autosaved distinct. Use shared components/styles instead of four incompatible copies.

3. **Panel and responsive behavior.** Establish the common sidebar/inspector/dock/sheet behavior needed by these layouts. Preserve resize, collapse and reset; retain dragging where supported and provide keyboard/touch alternatives. Handle scroll containment, long labels, focus return, Escape/back and narrow layouts. Keep the map and lyric document usable when secondary panels are open.

4. **One shared recipe workspace.** Genre, Instrument and Map must access the same canonical recipe and complete editor, even when displayed as a sidebar, expanded editor or compact dock. Reuse/adapt the real state and commands; do not create separate page stores, snapshots masquerading as live state, or simplified duplicate builders. Preserve session data and existing saved formats.

5. **Common lifecycle and operation states.** Integrate truthful loading, empty, no-results, success, partial-add, failure and retry handling. Retain named save/load/fork/delete/import/export, autosave, undo/redo scope, and conflict/recovery behavior. Existing AI entry points must remain reachable; preserve their actual start/running/awaiting-input/interrupted/completed states.

6. **Boundaries for later page owners.** Define concrete route integration interfaces, shared component/state APIs, CSS boundaries and actual files that later Genre, Instrument, Map and Lyrics workers may own. Keep common infrastructure under one integration owner. Do not start four parallel page implementations during this foundation phase.

Integrate and exercise the foundation on all four existing routes. Page-specific final layouts and controls that require new wiring can remain explicitly assigned to later page work; existing working capabilities must remain reachable meanwhile. Record each outstanding feature honestly. A blank page, inert button, cosmetic selector or menu label is not an implemented capability.

## 5. Preserve the contracts behind the pictures

The full audit below is mandatory reading. In particular:

- **Listen opens an actual external YouTube search/link.** Do not replace it with a pretend native audio player.
- Genre imports add the complete configured ensemble to the current recipe with accurate result feedback. Repeated addition is intentional and reversible; it must not silently replace existing work.
- The shared editor retains **Character, Parts, Environment, Signal chain and Output**; explicit **Not set**; searchable native and expanded materials; character suggestions/cascades and change previews; independent versus genre destinations; move, duplicate, remove, pin and variations. Keep Rich, Tags, Prose and Compact, limits and full-copy behavior.
- Preserve all eight signal-chain stages, including multiple effects. Derive the environment source from canonical logic and label its actual source; do not assume the first visible card always supplies an environment.
- Configure-before-add must carry the displayed variants into the selected destination when that proposed interaction is implemented. Preserve canonical catalog identity; the generic National/Dobro resonator preview is not automatically the same record as the Delta ensemble's steel-body single-cone resonator.
- Map **Default recipe** and **Your recipe** are different objects. Retain Equal Earth, border-free imagery, on-demand tiles, clusters, grouped/searchable co-located choices, complete in-view browsing, route/collection controls, truthful filter transitions and provenance. Preserve current exclusivity rules unless explicitly changing the underlying behavior. Do not infer history from sound similarity.
- Keep lyric writing separate from recording-recipe generation. Preserve imported lines, exact current draft/declarations, pronunciation uncertainty, incomplete coverage, accepted text and safe recovery. Check & apply must verify the actual current proposal/draft before committing; edits invalidate stale checks. Never convert missing input or an interrupted run into a passed/finished state.
- Preserve all deep search, plan, rhyme, rhythm, return, voice and recovery capabilities listed in the audit. Do not substitute arbitrary catalog examples or a quality score for the real workflows.

## 6. Verify actual integration

Run the repository's required gates and meaningful focused regression checks. Use actual browser interaction and visual inspection of the running app, with screenshots in both themes and at desktop and narrow/mobile sizes. Report any unavailable checks as unverified.

Exercise shared behavior across routes: change a recipe on one music page, continue editing that same recipe on the others, navigate back, reload, and verify saved state and appropriate undo/redo. Exercise panel controls, menus, keyboard focus and theme persistence. Confirm deeper editor access, explicit unset values and full output remain intact. Verify long content and representative empty/error states rather than only the picturesque populated state.

Do not make paid-provider calls merely to validate UI. Use supported interview/local paths when lyric workflow checks are needed. Controlled error fixtures can test UI error handling; label them accurately and never present simulated backend success as acceptance evidence.

Fix regressions introduced by this work. Do not broaden testing into an unrelated harness project or remove capabilities to get a green result.

## 7. Finish this phase and enable safe page work

Before concluding:

- Merge the working shared foundation through the required PR/CI process.
- Record the actual PR, merge commit, verification results and any remaining limitations.
- Update relevant repository documentation/capability tracking to distinguish implemented shared work from pending page-specific work. Update MISSING.md where applicable to actual tracked work; do not invent completion.
- Supply the real component/state interfaces, ownership/file boundaries, and the remaining responsibilities for the four future page instances.
- Identify one owner for shared changes and final integration; page workers must not independently redefine themes, navigation, the recipe engine or session behavior.

The completion boundary is a merged, integrated shared foundation ready for separate page work, not a claim that every final page redesign is already finished. Complete that foundation rather than stopping at “ready to implement” or “green and ready to merge.”

---

# Appendix — functionality audit

The following is the previously completed audit, read in its current stored form when this handoff was prepared. Its functional requirements accompany the final images above. Its historical image links and comments about what those older screenshots omitted are not the current visual baseline.



# Codex Musica — final UI completeness review

Reviewed 23 September 2026 against main `1f9678e67408d97dd7d0e358eb7d1c375920263d`, the selected four images, the UI capability inventory, and the workflows inspected in this conversation.

**Decision:** keep the four selected layouts as the visual references. They cover the main browsing, recipe and writing surfaces, but they are not yet a complete interaction specification. Apply the corrections below during implementation. This review does not replace the four images or claim the pictured controls already work.

## Selected references

| Page | Selected design |
|---|---|
| Genre | [Genre](sandbox:/workspace/scratch/c3a8032ff010/generated_images/exec-053c2e39-c02a-4596-b480-c176920934a8.png) |
| Instrument | [Instrument](sandbox:/workspace/scratch/c3a8032ff010/generated_images/exec-199480fe-6e7f-4fae-85d8-207e511e28b7.png) |
| Map | [Map](sandbox:/workspace/scratch/c3a8032ff010/generated_images/exec-f40d501d-40c1-4e2a-8dc7-84280b668756.png) |
| Lyrics | [Lyrics](sandbox:/workspace/scratch/c3a8032ff010/generated_images/exec-c4f3b124-f580-4767-8937-6ce71deb42cd.png) |

The images show representative states. Their sample text, photographs, icons, counts and selected values are not authoritative catalog records.

## Corrections that must accompany the images

| Area | Finding | Required treatment |
|---|---|---|
| Map and Instrument listening | Both selected images still show native playback, timeline and volume controls. The current app links to YouTube searches. | Remove those playback bars from the implementation baseline. Keep labelled Listen links opening YouTube. A native player would be separate new work. |
| Shared recipe | Genre shows a substantial recipe editor; Instrument has a reduced dock; Map shows a selected tradition's stock recipe without an obvious current-workspace entry. | Expose the same complete recipe editor from Genre, Instrument and Map. It can be collapsed or docked differently. Its state and capabilities must remain the same. Add an explicit Your recipe entry on Map. |
| Map recipe meaning | A tradition's default recipe and the user's edited recipe are different objects. | Label the map detail as that tradition's default recipe. Add genre imports into the shared workspace and confirms success, partial addition or failure. Do not replace the current recipe silently. |
| Instrument editor | The image shows physical parts but has no explicit entry to Character, Environment, Signal chain or Output; it also omits Not set and expanded-material states. | Add a clear full-settings entry. Retain all native editor functions and give expanded lists and explicit unset values visible places. |
| Configure before adding | The Instrument image introduces a real editable preview and Add configured instrument. The current discovery preview is descriptive and adds through the normal seeding path. | Implement the preview-to-card transfer explicitly. Adding must preserve the displayed chosen variants and named destination, with a clear result. Do not ship cosmetic radio buttons that add defaults. |
| Map locations with multiple traditions | Cluster bubbles are pictured; the resulting chooser is not. | Retain the grouped, searchable list for overlapping/co-located traditions, with keyboard selection and a clear return to the map. |
| Map active states | The image shows a route and a collection/filter together. Current route selection clears filters; selecting a collection or typing can replace other selections. | Define and reflect the actual state transitions. For preservation, keep the current exclusivity rules and remove stale active chips. Combined route/collection/filter behavior would require deliberate new implementation. |
| Lyrics operational states | The selected image shows a rhyme proposal, but not required pronunciation input, blocked coverage, paused work, or safe recovery. | Design these inside the same review pane and History surface. Keep missing information distinct from defects and advisory notes. Never turn an unresolved run into a finished badge. |
| Identity and controls | The four headers use different logos and different meanings for Saved; recipe placement and colour meanings also vary. | Use one approved brand asset, consistent navigation order and icon vocabulary. Distinguish Autosaved status from Saved sessions. Keep marker colours consistent with their legends and avoid colour-only meaning. |
| Unimplemented concept controls | Genre sound sliders and List/Grid, genre-to-map targeting, and consolidated Check & apply are design proposals rather than evidence of existing UI wiring. | Implement each as a real operation on the canonical data/workflow, with an explicit result and error state. Do not treat its presence in a picture as implementation proof. |

## Capability preservation map

These are destinations for functionality, not instructions to expand every control at once.

### Genre

| Capability | Home in the design / required expanded state |
|---|---|
| Search names, lineage and descriptions; normalized matching; complete results and no-results recovery | Main search and All genres. Preserve filters/search and list position when returning from detail. |
| All 25 taxonomy roots, descendants and cross-references | Browse, Full tree and All 25 categories. Make memberships clickable; do not confuse classification with historical descent. |
| Six documented starter recipes and random discovery | Start exploring and Surprise me. Use the catalog's actual records. |
| Thirteen sound dimensions and similarity reasons | Find a sound / All 13 characteristics; Sound profile and Similar sounds. Show which controls are applied and allow clearing them. |
| Full description, background, recorded exemplars and available sources | Overview, Lineage/background and Recordings & references. Do not invent citations or artists. |
| Canonical roster; inspect, Listen and add an individual instrument | Instruments tab and inspectable ensemble items. Addition destination must be explicit. |
| Complete configured-ensemble import and intentional re-import | Add to recipe / In recipe menu. Show the number imported; additions are reversible. |
| Related traditions, further similarity exploration and workspace suggestions | Similar sounds, Find similar sounds, Suggestions for this recipe. Explain the basis of similarity. |
| Map navigation | View on map, preserving selected catalog identity and a clear way back. |

### Instrument

| Capability | Home in the design / required expanded state |
|---|---|
| Every family and class, search and complete results | Categories, class navigation, main search and Show more. Use actual names and counts. |
| All 15 existing property filters | Sound properties, including register, sound source and expressiveness disclosures. Preserve their actual predicate behavior; show no-results recovery for conflicting selections. |
| Similar instruments and repeated exploration | Inspector Similar instruments. Preserve the current recipe and browsing context. |
| Every part, searchable long option lists, explicit Not set | Customize / Parts. An unset value must stay unset through saving and export. |
| Curated and expanded cross-instrument materials | More materials disclosure inside the affected part. No physical-plausibility fence should remove allowed catalog choices. |
| Added/kept/removed descriptor previews for a variant | Expanded option comparison. Let the user understand what a change does. |
| Character/preface search, category browser, suggestions and resulting configuration shifts | Full settings → Character. Preserve the existing cascade and show changed settings. |
| Tuning, room and eight chain stages, including multiple effects | Full settings → Environment and Signal chain. |
| Independent addition or addition to a selected genre | Add to selector. Confirm the actual destination and retain explicitly chosen preview settings. |
| Select, duplicate, remove, pin, move to another genre, and explore variations | Existing recipe instrument row and its labelled actions/menu. Provide non-drag movement. |
| Per-instrument and full-recipe output | Full settings → Output and shared Recipe preview. Preserve Rich, Tags, Prose and Compact. |

### Map

| Capability | Home in the design / required expanded state |
|---|---|
| Pan, zoom, reset and fit selected content | Main map controls and keyboard/touch equivalents. Label reset clearly; do not imply a geolocation permission feature. |
| Equal Earth projection, border-free imagery, on-demand detail tiles | Map renderer. The generated background is only an appearance reference. |
| Clusters and co-located traditions | Bubble selection → grouped/searchable location chooser. |
| In-view traditions and browsing all items in a group | In view pane with actual counts and expand controls. |
| Name/place/catalog-identifier and sound-word search | Main search, with a visible explanation when matching by descriptor rather than name. |
| Category filters, clear actions and truthful active state | Genre groups and active chips. Marker and legend meaning must agree. |
| Route selection, endpoint navigation, fitting and hiding | Routes pane. Keep source endpoint order; do not imply unsupported intermediate stops from decorative curves. |
| Collection selection, stop list, back to collection and clear collection | Collections pane and selected collection detail. |
| Tradition selection, background, default recipe, related results, Listen and Add genre | Tradition inspector. Identify whether relations come from shared sound words or a fallback classification. |
| Coordinates and data provenance, loading and fetch failure | Map information and local detail status. Distinguish model-reviewed coordinates from human-verified ones; bubbles count documented scenes, not musical abundance. |
| Movable/resizable panels and reset layout | Panel handles plus accessible Move/Resize/Reset controls. Keep the map prominent on small screens. |
| Shared current recipe access | Add the same Your recipe drawer used elsewhere. A selected stock recipe is not a substitute. |

### Lyrics

| Capability | Home in the design / required expanded state |
|---|---|
| New song versus existing/imported lyrics | New song or import and File. Existing text follows recovery before grading; preserve all draft lines. |
| Goals, eligible plans, form, section roles and structural requirements | Plan and Structure & story. Preserve actual planner limits and distinguish inspect-only plans from executable writing plans. |
| Human writing and AI writing | Editor / Write with AI. Expose progress and the next required answer without requiring users to know tool names. |
| Required/forbidden words, hook, bindings and sound relationships | Rhymes & word rules and Rhyme links. Support overlapping and non-endword relationships, not just AABB-style groupings. |
| Candidate screening, joint constraints, partial matches and blocked words | Explore rhyme words. Do not present a partial match as satisfying every requirement. |
| Single-line proposals, user alternatives and coupled group rewrites | Review, Write my own and Rewrite both lines. |
| Check & apply | Verify the exact proposal against the current draft and declarations before committing. If it fails or coverage is unresolved, retain the original and explain why. Manual edits invalidate stale review results. |
| Declared meter, grouping, subdivision, pickup, position, duration and advanced rhythmic constructs | Rhythm & timing / Rhythm & placement. No assumed tempo or inferred performed rhythm. |
| Optional declared melody | An optional advanced entry in Rhythm & placement. Do not present it as recorded or certified vocal performance. |
| Dictionary choices, supplied readings and explicit uncertainty | Pronunciation / Language & readings. Bind to exact line and sung token; identical repeated lines share the choice. Text changes invalidate old bindings. |
| Exact and placed returns, hook, sung/unsung asides and call/response voices | Used 3 times and Returns & voices. Preserve intentional repeats. |
| Story roles and section-to-section intentions | Structure & story / Plan. Label these as planning information; do not imply semantic plot certification. |
| Requested, answered, unresolved and unrequested coverage; advisory notes | All checks / All feedback. Avoid a single quality score or a false finished state. |
| Revision history, accepted draft, interrupted and non-resumable work | History and the contextual review pane. Resume only when the actual run allows it; recovering accepted text is not permission to repeat uncertain work. |
| Final output with section/return/placement information | Export / Copy in File, preserving the exact accepted text and required headers. |
| Separate lyric and recording-recipe workflows | Shared session may hold both, but recipe data must not silently become a lyric plan. |

## Shared states that the four desktop pictures do not specify

These must be designed and verified during implementation:

- Empty first use; restored session; zero results; long names and large catalogs.
- Lazy data loading; failed fetch; partial import; prevention of duplicate concurrent additions.
- Unsaved edits, successful autosave, save failure, named save, load, independent copy, delete and import/export.
- Shared-tab conflicts and recoverable accepted work; no false Saved status.
- Text-editing Undo/Redo versus workspace Undo/Redo, preserving the appropriate scope.
- Narrow/mobile layout with reachable recipe and detail sheets, adequate touch targets and no horizontal clipping.
- Keyboard focus, Escape/back behavior, labelled icons, non-drag reorder/move, and status announcements.
- Panel resize/collapse/reset, scroll restoration and preserved selections when moving between pages.
- AI starting/running/awaiting-input/completed/interrupted states and a clear route to saved runs.
- Actual licensed/attributed images and correct instrument glyphs. Generated mockup photographs are not a supplied historical-image collection.

## Source anchors and verification scope

- [Current workbench UI](https://github.com/WeningerII/CodexMusica/blob/1f9678e67408d97dd7d0e358eb7d1c375920263d/src/workbench.js): discovery, external Listen links, detail inspection, AI entry and shared state.
- [Canonical app](https://github.com/WeningerII/CodexMusica/blob/1f9678e67408d97dd7d0e358eb7d1c375920263d/src/app.js): import and configuration, explicit unset values, expanded materials, cascades, output and history.
- [UI capability inventory](https://github.com/WeningerII/CodexMusica/blob/1f9678e67408d97dd7d0e358eb7d1c375920263d/tests/ui_capability_inventory.md): preservation obligations and prior lost interactions. Some historical visual descriptions are superseded; reconcile against current source rather than copying every old chart.
- [Layout behavior](https://github.com/WeningerII/CodexMusica/blob/1f9678e67408d97dd7d0e358eb7d1c375920263d/src/layout.js) and [shared-workspace notes](https://github.com/WeningerII/CodexMusica/blob/1f9678e67408d97dd7d0e358eb7d1c375920263d/docs/production-workbench.md): panel controls and recovery requirements.
- [Map logic](https://github.com/WeningerII/CodexMusica/blob/1f9678e67408d97dd7d0e358eb7d1c375920263d/src/atlas.js) and [map integration](https://github.com/WeningerII/CodexMusica/blob/1f9678e67408d97dd7d0e358eb7d1c375920263d/src/map-ui.js): location chooser, filters, routes, collections, provenance and addition feedback.
- [Lyrics tools](https://github.com/WeningerII/CodexMusica/blob/1f9678e67408d97dd7d0e358eb7d1c375920263d/mcp/lyric_tools.js), [pronunciation contract](https://github.com/WeningerII/CodexMusica/blob/1f9678e67408d97dd7d0e358eb7d1c375920263d/docs/pronunciation-choices.md), and [recovery contract](https://github.com/WeningerII/CodexMusica/blob/1f9678e67408d97dd7d0e358eb7d1c375920263d/docs/workflow-recovery.md).
- Lyrics depth was also traced through the planning, revision, grid, narrative and metric-complexity modules reviewed earlier in this conversation.

Main had not changed from the preceding Genre review. This pass re-inspected all four selected images and checked additional source paths. It is a design-completeness review, not a fresh browser acceptance test, production certification or implementation change.

Implementation should use the four images together with this checklist. A feature counts as preserved only when its entry point leads to the complete interaction and correct state behavior; a menu label alone is insufficient.

