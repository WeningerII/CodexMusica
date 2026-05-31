// _paths.js — single source of truth for output file locations.
//
// Artifacts (codex.html, codex.zip) are written to a resolved OUTPUT_DIR.
// Resolution order:
//   1. CODEX_OUT_DIR env var — explicit override always wins.
//   2. /mnt/user-data/outputs — the sandbox "blessed" dir, used only when it
//      already exists. In that environment artifacts here get surfaced back to
//      the user (via the present_files tool); tandem.js/smoke.js read from here
//      for HTML↔source parity checks.
//   3. A writable OS-temp dir (os.tmpdir()/codex-outputs) — for CI runners and
//      any non-sandbox host, where the sandbox dir does not exist and mkdir on
//      it fails with EACCES.
//
// build_html.js also accepts `--out=path` to override the file path directly.

const path = require('path');
const fs = require('fs');
const os = require('os');

const SANDBOX_OUTPUT_DIR = '/mnt/user-data/outputs';

function resolveOutputDir() {
  if (process.env.CODEX_OUT_DIR) return process.env.CODEX_OUT_DIR;
  try {
    if (fs.existsSync(SANDBOX_OUTPUT_DIR)) return SANDBOX_OUTPUT_DIR;
  } catch {
    /* fall through to temp */
  }
  return path.join(os.tmpdir(), 'codex-outputs');
}

const OUTPUT_DIR = resolveOutputDir();

module.exports = {
  HTML_OUT: path.join(OUTPUT_DIR, 'codex.html'),
  ZIP_OUT: path.join(OUTPUT_DIR, 'codex.zip'),
  OUTPUT_DIR,
};
