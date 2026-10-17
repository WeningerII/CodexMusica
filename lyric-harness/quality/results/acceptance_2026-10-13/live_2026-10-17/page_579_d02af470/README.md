# #579 (d02af470) Library page: live check, BB8, 2026-10-17

#579 changes only the page, so it went live with the Pages build (39069908189, finished 21:13 UTC). It does not wait for the Render deploy.

1. **The live files are the merged files.** At 21:24:45 UTC (`fetched_at.txt`), these files from https://codexmusica.com were byte-identical to `d02af470` (`bytes.txt`):
   - `codex.html`
   - the new `library/code/analysis.444aa6b634.js`
   - `generations.json`
   - `core`
   - the previous generation `analysis.9ebd86e5f8.js`, which is still served for pages that were already open
2. **#579's own checks pass on those bytes.** Run on `d02af470`, which serves exactly the bytes in point 1:
   - `scripts/check_library_page.js`: PASS, 322/322, all chunks.
   - `node --test scripts/test_library_declarations.js`: 13/13.

   These two checks drive the new refusals, with the Library API stubbed.
3. **A real live reading loads the new chunk.** `live_reader.cjs` opens `#library/read/reading_570567e3…?lens=sound` on the live site in Chromium, with every `/chat` request and every non-GET request aborted. Result:
   - 232 reader lines;
   - the Analyze and declarations controls are mounted;
   - the chunks loaded were `core.0dcc6ec3f7`, `reader.4d0287465c` and `analysis.444aa6b634`;
   - the only console error is the deliberately aborted `GET /chat/status`.

   `live_smoke.cjs` checks the same thing on the Library home page.

Not covered: the new refusals were not triggered against the live origin itself. They are covered by point 2 on byte-identical files. The server deploy for this merge (`/health` → `d02af470`) is checked separately.
