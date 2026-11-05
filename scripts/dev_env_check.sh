#!/usr/bin/env bash
# Developer/reviewer preflight only. No installs, downloads, configuration edits,
# application imports, browser launches, or production qualification.
# Ownership: #668 comment 6639689668; runtime sequencing: #665 6639663659.
# Sources: README.md Quick start; mcp/requirements-runtime.txt;
# lyric-harness/data/runtime_assets.json; .github/workflows/capacity-proof.yml.
set -u
if (( $# )); then
  if [[ $# == 1 && $1 == --help ]]; then
    printf '%s\n' 'Usage: bash scripts/dev_env_check.sh' \
      'Read-only local preflight. Exit 0: no blocking gaps (warnings possible); 1: gaps; 2: usage.' \
      'Repair commands are suggestions only. Passing does not certify tests or production.'
    exit 0
  fi
  printf '%s\n' 'Unsupported argument. Use --help; no repair mode is provided.' >&2
  exit 2
fi
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd) || exit 1
cd -- "$root" || exit 1
failed=0
printf '%s\n' 'Developer environment preflight (read-only; not a runtime release gate)'
for tool in git node npm python3; do
  if command -v "$tool" >/dev/null 2>&1; then
    printf 'PASS tool: %s is available\n' "$tool"
  else
    printf 'FAIL tool: %s is missing; provision it before running the documented checks\n' "$tool"
    failed=1
  fi
done
if command -v git >/dev/null 2>&1; then
  sparse=$(git config --bool --get core.sparseCheckout 2>/dev/null || true)
  printf 'INFO sparse checkout: %s\n' "${sparse:-false}"
fi
for path in scripts src references lyric-harness mcp; do
  if [[ -d $path ]]; then
    printf 'PASS checkout: %s\n' "$path"
  else
    printf 'FAIL checkout: %s absent; restore the checkout (if sparse, review git sparse-checkout disable) before treating missing-path gates as regressions\n' "$path"
    failed=1
  fi
done
if command -v node >/dev/null 2>&1; then
  node <<'NODE' || failed=1
const fs = require('node:fs');
const path = require('node:path');
let failures = 0;
function report(ok, label, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${detail}`);
  if (!ok) failures++;
}
const major = Number(process.versions.node.split('.')[0]);
report(major >= 22, 'Node', `${process.versions.node}; package.json and mcp/package.json require >=22 (CI uses 22)`);
for (const prefix of ['.', 'mcp']) {
  const install = prefix === '.' ? 'npm ci' : 'npm ci --prefix mcp';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(prefix, 'package.json')));
    const lock = JSON.parse(fs.readFileSync(path.join(prefix, 'package-lock.json')));
    const present = fs.existsSync(path.join(prefix, 'node_modules'));
    report(present, `${prefix}/node_modules`, `local dependency tree ${present ? 'present' : 'absent'}; suggested setup: ${install}`);
    for (const name of Object.keys({...pkg.dependencies, ...pkg.devDependencies})) {
      const expected = lock.packages?.[`node_modules/${name}`]?.version;
      let actual;
      try { actual = JSON.parse(fs.readFileSync(path.join(prefix, 'node_modules', name, 'package.json'))).version; } catch {}
      report(Boolean(expected && actual === expected), `${prefix} dependency ${name}`, `installed=${actual || 'missing'}, lock=${expected || 'missing'}; suggested setup: ${install}`);
    }
  } catch {
    report(false, `${prefix} package metadata`, 'package.json/package-lock.json missing or unreadable; restore the checkout');
  }
}
try {
  console.log('INFO trust boundary: Chromium discovery imports the installed Playwright package; use trusted node_modules. This checker is not a sandbox.');
  const {chromium} = require(path.resolve('node_modules/playwright'));
  const expected = chromium.executablePath();
  const override = process.env.CHROMIUM_PATH;
  function executableExists(file) {
    if (!file) return false;
    try { fs.accessSync(file, fs.constants.X_OK); return fs.statSync(file).isFile(); } catch { return false; }
  }
  const defaultOK = executableExists(expected);
  const overrideOK = executableExists(override);
  const os = require('node:os');
  const defaultCache = process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright')
    : process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'ms-playwright')
    : path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'ms-playwright');
  const caches = new Set(['/opt/pw-browsers', defaultCache]);
  if (process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== '0') caches.add(path.resolve(process.env.PLAYWRIGHT_BROWSERS_PATH));
  // Include the cache Playwright actually resolved (also covers hermetic "0").
  for (let dir = path.dirname(expected); path.dirname(dir) !== dir; dir = path.dirname(dir)) {
    if (/^chromium(?:[_-]headless[_-]shell)?-\d+$/.test(path.basename(dir))) { caches.add(path.dirname(dir)); break; }
  }
  console.log(`INFO PLAYWRIGHT_BROWSERS_PATH: ${JSON.stringify(process.env.PLAYWRIGHT_BROWSERS_PATH ?? '(unset; Playwright default cache)')}; /opt/pw-browsers ${fs.existsSync('/opt/pw-browsers') ? 'exists' : 'absent'}`);
  for (const cache of caches) {
    try {
      const builds = fs.readdirSync(cache, {withFileTypes: true}).filter(e => e.isDirectory() && /^(chromium|chrome|firefox|webkit|ffmpeg)[-_]/.test(e.name)).map(e => e.name).sort();
      console.log(`INFO browser cache ${JSON.stringify(cache)}: ${builds.length} build directories; first 8=${JSON.stringify(builds.slice(0, 8))} (presence only)`);
    } catch {
      console.log(`INFO browser cache ${JSON.stringify(cache)}: absent or unreadable`);
    }
  }
  const detail = `expected=${JSON.stringify(expected)}; ${defaultOK ? 'file is executable' : 'unavailable'}`;
  if (!defaultOK && overrideOK) console.log(`WARN Playwright default executable: ${detail}; valid executable CHROMIUM_PATH override exists`);
  else report(defaultOK, 'Playwright default executable', detail);
  if (override) report(overrideOK, 'CHROMIUM_PATH override', `expected=${JSON.stringify(override)}; ${overrideOK ? 'file is executable' : 'absent, not a file, or not executable'}`);
  console.log('INFO browser route: point CHROMIUM_PATH at an existing executable for gates using Playwright executablePath. Gates ignoring the override still need the expected default. No install or launch performed; file/executable presence does NOT establish a working browser or compatible system libraries.');
} catch {
  report(false, 'Chromium discovery', 'local Playwright unavailable; first restore root dependencies, then inspect configured browser caches and the CHROMIUM_PATH/executablePath route');
}
process.exitCode = failures ? 1 : 0;
NODE
fi
if command -v python3 >/dev/null 2>&1; then
  python3 -B - <<'PY' || failed=1
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

failures = 0
def report(ok, label, detail):
    global failures
    print(f'{"PASS" if ok else "FAIL"} {label}: {detail}')
    failures += not ok

print(f'INFO Python: {sys.version.split()[0]}; capacity-proof CI pins 3.11.16/x64; Library-site CI uses 3.12. Neither is a universal local-version assertion.')
tracked_files = set()
checkout_remedy = 'inspect local deletions and restore the intended tracked files from the checkout'
if shutil.which('git'):
    tracked = subprocess.run(['git', 'ls-files', '-z'], capture_output=True)
    if tracked.returncode == 0:
        paths = [os.fsdecode(p) for p in tracked.stdout.split(b'\0') if p]
        tracked_files = {os.path.abspath(p) for p in paths}
        missing = [p for p in paths if not os.path.lexists(p)]
        sparse = subprocess.run(['git', 'config', '--bool', '--get', 'core.sparseCheckout'], capture_output=True, text=True)
        if sparse.stdout.strip() == 'true':
            checkout_remedy = 'review and run git sparse-checkout disable manually; if paths remain absent, inspect local deletions'
        directories = sorted({str(Path(p).parent) for p in missing})
        report(not missing, 'tracked checkout paths', 'all present on disk' if not missing else f'{len(missing)} missing in {len(directories)} directories; affected directories (up to 8): {directories[:8]!r}; examples: {missing[:5]!r}; {checkout_remedy}')
    else:
        print('INFO tracked checkout paths not checked: no readable Git index; directory checks alone cannot detect partial sparse exclusions.')
try:
    requirements = Path('mcp/requirements-runtime.txt').read_text()
    records = [line.strip() for line in requirements.replace('\\\n', ' ').splitlines()
               if line.strip() and not line.lstrip().startswith('#')]
    if not records:
        raise ValueError('empty requirements inventory')
    pins = []
    for record in records:
        pin = re.fullmatch(r'([A-Za-z0-9_.-]+)==([0-9][A-Za-z0-9.!+_-]*)(?:\s+--hash=sha256:[0-9a-fA-F]{64})*', record)
        if not pin:
            raise ValueError('unsupported requirements syntax; expected exact version pins with optional SHA-256 hashes')
        pins.append(pin.groups())
    for name, expected in pins:
        try:
            actual = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            actual = 'missing'
        detail = f'installed={actual}, pinned={expected}; see mcp/requirements-runtime.txt and CI hash-locked setup'
        if actual != 'missing' and actual != expected:
            print(f'WARN Python package {name}: {detail}; differs from CI hash-locked pin; results may differ from CI (not production qualification)')
        else:
            report(actual != 'missing', f'Python package {name}', detail)
except (OSError, ValueError) as error:
    report(False, 'Python requirements', f'missing, unreadable or unsupported inventory ({type(error).__name__}); restore mcp/requirements-runtime.txt or update this diagnostic for its syntax')

try:
    harness = Path('lyric-harness')
    staged = Path(os.environ.get('LYRIC_STAGED_DATA') or harness / 'data')
    manifest = json.loads((harness / 'data/runtime_assets.json').read_text())
    assets = manifest['assets']
    if not isinstance(assets, list) or not assets or any(not isinstance(a, dict) or type(a.get('runtime')) is not bool for a in assets):
        raise ValueError('invalid assets inventory')
    runtime_assets = [a for a in assets if a['runtime']]
    if not runtime_assets:
        raise ValueError('empty runtime inventory')
    for asset in runtime_assets:
        if not isinstance(asset.get('id'), str) or not asset['id'] or asset.get('base') not in ('root', 'staged') or not isinstance(asset.get('files'), list) or not asset['files']:
            raise ValueError('invalid runtime asset')
        for entry in asset['files']:
            if not isinstance(entry, dict) or not isinstance(entry.get('path'), str) or not entry['path'] or Path(entry['path']).is_absolute() or '..' in Path(entry['path']).parts or type(entry.get('bytes')) is not int or entry['bytes'] < 0 or not isinstance(entry.get('sha256'), str) or not re.fullmatch(r'[0-9a-f]{64}', entry['sha256']):
                raise ValueError('invalid runtime asset file')
    for asset in runtime_assets:
        base = harness if asset['base'] == 'root' else staged
        bad = []
        checkout_gaps = []
        for entry in asset['files']:
            target = base / entry['path']
            if not os.path.lexists(target) and os.path.abspath(target) in tracked_files:
                checkout_gaps.append(entry['path'])
                continue
            try:
                data = target.read_bytes()
                ok = len(data) == entry['bytes'] and hashlib.sha256(data).hexdigest() == entry['sha256']
            except OSError:
                ok = False
            if not ok:
                bad.append(entry['path'])
        if checkout_gaps:
            report(False, f'checkout gap for lexical asset {asset["id"]}', f'{len(checkout_gaps)} tracked files absent; first 5: {", ".join(checkout_gaps[:5])}; {checkout_remedy}; asset staging cannot restore these tracked files')
        if bad or not checkout_gaps:
            report(not bad, f'lexical asset {asset["id"]}', 'manifest hashes match' if not bad else f'{len(bad)} missing or mismatched; first 5: {", ".join(bad[:5])}; review CI staging: lyric_harness.fetch_data() and quality/fetch_data.py --runtime from lyric-harness/')
    if os.environ.get('NLTK_DATA'):
        print('INFO NLTK_DATA is set; verify its search paths against the staged data. This check hashes staged assets, not NLTK lookup resolution.')
except (OSError, ValueError, KeyError, TypeError):
    report(False, 'lexical manifest', 'missing or invalid; restore lyric-harness/data/runtime_assets.json before staging data')
sys.exit(1 if failures else 0)
PY
fi
printf '%s\n' 'INFO Not checked: native catalog, browser launch, full transitive dependency integrity, capacity proof, production identity/continuation, credentials, or live services.'
if (( failed )); then
  printf '%s\n' 'RESULT environment gaps found; resolve the named prerequisites before attributing test failures to a change.'
else
  printf '%s\n' 'RESULT checked prerequisites present; review any WARN lines and run the task-specific tests and existing release gates separately.'
fi
exit "$failed"
