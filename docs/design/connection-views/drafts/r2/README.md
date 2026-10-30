# CodexMusica connection-view candidate r2 — not final

Design-only authored fixture; no engine run, implementation, product or Site change. These are supporting renderer drafts, not named-team consensus or signoff.

Four editable SVGs and self-contained HTML wrappers, with exact PNG renders and base64 copies. Desktop is 1600×1120, phone is 390×1270. `manifest-sha256.json` identifies exact PNG bytes for review. Decode a copy using `base64 -d 01-poem-arcs.png.base64.txt > 01-poem-arcs.png`.

Re-render with Python 3 + Pillow + Inkscape installed: `python render.py`. The SVGs are the direct editable artifact. Font: Arial sans-serif UI; DejaVu Serif poem, measured via Pillow. No image generation. Inkscape rendering does not require a browser or network. Rendering creates SVG, HTML, PNG, base64 and SHA256 manifest files.

Fixture: six occurrences woods L1w2, know L1w8, though L2w7, watch L4w2, woods L4w4, snow L4w8. Exactly four authored holds: watch↔woods L4 same-line alliteration; know↔though, know↔snow, though↔snow end rhyme. The selected pair is watch L4w2 ↔ woods L4w4 everywhere. Not actual engine output.

Unspecified eligible cells use “NS” / “Not supplied (fixture only)”, avoiding fabricated pending, false, refusal or unknown outcomes. Outside-locus marks only describe selected same-line alliteration eligibility. Six presentation-state samples are isolated in an example-only legend. Pending example: dotted gray outline + ellipsis; outside-locus example: diagonal hatch. Dimming applies only to decorative unselected edges, never text. Matrix default is single-method alliteration and upper-triangle unordered occurrence-pair view; future directed/role/span/figure views are not forced into this projection.

Coverage lines deliberately state no engine totals supplied. Group denominators are authored eligible subgraph counts, not evaluated denominators. No global witness/clique badge. Phone preserves selected pair and offers selected occurrence row list with bottom-sheet inspector.

Review needed: named-team actual visual assent; proof of interaction, accessibility, source-revision invalidation and role-aware selection requires implementation acceptance tests, not PNG inference. This draft does not pretend those behaviors were tested.

## r2 delta
R1 remains immutable in the sibling render-drafts directory. Candidate r2 adds three matching desktop filter controls with the Matrix explicitly single-method, word labels inside graph nodes with coordinates beneath, distinct NS fixture-only missing-data marks (not pending ellipsis), explicit token-to-port stems, and a more concise inspector. It preserves the same-line selected arc above the words, margin ending arcs, and phone row list. Pending named-team visual review before finalizing this candidate.
