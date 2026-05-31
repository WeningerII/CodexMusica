// _paths.js — single source of truth for output file locations.
//
// The codex runs in a sandbox where `/mnt/user-data/outputs/` is the
// blessed location for artifacts that get surfaced back to the user
// (via the `present_files` tool). build_html.js writes here by default;
// tandem.js reads from here for the [HTML ↔ source parity] check;
// smoke.js reads from here when verifying smoke output against the
// shipped embed.
//
// On non-sandbox environments the default won't exist. build_html.js
// accepts `--out=path` to override; consumers that need to find the
// artifact should fall back to env or argument resolution rather than
// relying on this default.

const path = require('path');

const SANDBOX_OUTPUT_DIR = '/mnt/user-data/outputs';

module.exports = {
  HTML_OUT: path.join(SANDBOX_OUTPUT_DIR, 'codex.html'),
  ZIP_OUT:  path.join(SANDBOX_OUTPUT_DIR, 'codex.zip'),
  OUTPUT_DIR: SANDBOX_OUTPUT_DIR,
};
