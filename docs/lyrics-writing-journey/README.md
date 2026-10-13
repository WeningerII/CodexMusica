# Lyrics: primary writing journey — design discussion

**Status:** research only; awaiting 3PO's shared image concepts and agreement before code. Owns start/import, brief, document, section navigation and writer interaction. The other OpenAI session owns tools/review/recovery; 3PO resolves overlaps. One separate Claude teammate will review both PRs. No UI, prototype, engine or dictionary changes.

## Evidence and limits

Inspected main `fce4bf0f1b4b274d1c44c67831a6e40b22a8802c`. Screenshots show its shipped `codex.html`, served locally, in clean headless Chromium with default light theme, on 2026-10-13. Desktop: 1180×757; phone: 390×844. Imported lyrics and brief are synthetic research inputs. No writer request was submitted. The live URL failed with `ERR_TUNNEL_CONNECTION_FAILED`; local chat reported inability to connect. These captures do not establish production backend behavior.

| Observed locally | Design implication |
| --- | --- |
| [Blank start](screenshots/01-empty-1180.png): three equal-weight start choices; disabled blue Run review and six tools occupy prominent space. | Make the first writing action unmistakable; introduce review after there is text. |
| [New song](screenshots/02-new-song-1180.png): empty document remains while conversation opens in the narrow inspector. Composer measured x=867, y=569.5, width=262, height=94; focus scrolls it into view, clipping earlier writer controls. | Give the initial request enough room; keep the composer and its next action visible without hunting. |
| [Imported document](screenshots/03-imported-1180.png): importing a `.txt` through the file input produces two named sections and four lines; toast offers Undo. [Sections rail opened](screenshots/05-sections-1180.png) exposes Verse 1/Chorus with counts. Selecting Chorus allows editing its line. | Preserve immediate editing, recognizable section names and undoable imports; reduce navigation indirection. |
| [Expanded brief](screenshots/04-brief-1180.png): creative context and exact-hook selection share a large form above the document. Saved brief and a manually edited lyric survived reload. | Introduce creative context at start, then summarize it compactly; distinguish intention from an exact lyric declaration. |
| [Phone writing](screenshots/06-mobile-song-390.png): header/actions/brief/navigation push the first section to about y=606; bottom Song/Tools/Writer/Review navigation remains visible. | Spend more of the first viewport on lyrics; preserve a clear way back to the document. |

**Supplied preliminary observation, not reproduced here:** at 1180×757 the writer input was below the viewport; a benign interview request returned `LYRICS_UNFINISHED` / “Review incomplete” with no useful draft or recovery. Our local connection-error state differs. Treat this as a concept-review scenario, not a backend diagnosis or authorization to alter runtime behavior.

## Source facts to preserve

- [Page contracts and ownership](../ui-foundation.md), [capability inventory](../../tests/ui_capability_inventory.md), and [fixture-based browser gate](../../scripts/check_lyrics_page.js) define existing behavior; fixtures are not live-service evidence. `.agents/skills` is absent; repository AGENTS.md, SKILL.md and the lyric-workflows skill were inspected.
- [lyrics.js](https://github.com/WeningerII/CodexMusica/blob/fce4bf0f1b4b274d1c44c67831a6e40b22a8802c/src/pages/lyrics.js#L2794): brief is creative context, not graded. The textarea is authoritative; bracket headers generate sections. `lyStartConversation` opens the shared writer; `lyContext` passes committed context. New and existing lyrics have distinct phases.
- [Layout](../../src/pages/lyrics.css): compact widths collapse sections to a rail; below 960 container pixels, Song/Tools/Writer/Review become separate views. [Import contract](../../src/library-import.js): preserve Library provenance. Recipe context stays explicit.
- Retain pending tool values, undoable Apply, section-reference remapping, draft-version review validity and non-destructive writer continuation. Tools/review/recovery presentation belongs to the other lane.

## Proposed direction for image concepts

1. **Start:** clearly offer “Write myself”, “Write with the writer”, and “Import lyrics”; each leads directly to its task. For writer-assisted starts, collect the idea/brief in the main work area with one obvious next action.
2. **Write:** keep the document central, compact brief above it, visible section location and an accessible outline. Place contextual writer help beside the active writing when space permits; keep typing and submission visible on small screens.
3. **Visual continuity:** retain current neutral surfaces, typography, blue actions, purple Lyrics navigation glyph, line icons, borders, spacing and shared `--cm-*` / `.cm-*` components. Change hierarchy, not brand.
4. **Critique criteria:** at both captured sizes, can John identify the first action, enter a request, reach imported lyrics, edit a line, switch sections and return from assistance without guessing? Show blank, active-writing and mobile states; coordinate advanced-tool, pending-change, stale-review and interrupted-writer states with the other lane. Never imply that a draft is finished or reviewed without evidence.

**Next gate:** 3PO shares image-generated concepts here/across both PRs; critique against these scenarios, agree on a direction, then assign exact `lyrics.js` function ownership and integration order. No concurrent production edits before that agreement.
