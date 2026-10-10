#!/usr/bin/env python3
"""Generate the lyric harness map: the small index every session loads
(lyric-harness/CLAUDE.md) and the sections it points to (map/*.md).

Everything here is derived from the code and from one traced run of the
reference song, never written by hand, so it cannot drift from the code.

  python3 map/build.py                 rewrite the index and the sections
  python3 map/build.py --from-profile  also rebuild the song path from
                                       map/.prof (node map/trace.mjs --profile)
  python3 map/build.py --check         exit 1 if anything is out of date
  python3 map/build.py show FILE[:NAME]   print code without comments
"""
import ast
import glob
import json
import os
import pstats
import re
import subprocess
import sys
import textwrap

MAP = os.path.dirname(os.path.abspath(__file__))
HARNESS = os.path.dirname(MAP)
ROOT = os.path.dirname(HARNESS)
INDEX = os.path.join(HARNESS, "CLAUDE.md")
TOKENS_PER_BYTE = 1 / 3.6  # rough: English prose and Python both run near this
SECTIONS = ("song-path", "rules", "limits", "files", "timings")


def rel(path):
    return os.path.relpath(path, HARNESS)


def tracked(prefix=""):
    out = subprocess.run(["git", "-C", HARNESS, "ls-files"] + ([prefix] if prefix else []),
                         capture_output=True, text=True, check=True).stdout
    return [p for p in out.split("\n") if p]


def ktok(nbytes):
    """Tokens to two significant figures, so routine edits don't move the figure."""
    t = nbytes * TOKENS_PER_BYTE
    if t < 1000:
        return "<1k"
    k = float(f"{t / 1000:.2g}")
    return f"{k:,.0f}k" if k >= 10 else f"{k:g}k"


def stripped(src):
    """Source with comments and docstrings removed (ast.unparse drops comments)."""
    tree = ast.parse(src)
    for node in ast.walk(tree):
        body = getattr(node, "body", None)
        if (isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef))
                and body and isinstance(body[0], ast.Expr)
                and isinstance(body[0].value, ast.Constant)
                and isinstance(body[0].value.value, str)):
            node.body = body[1:] or [ast.Pass()]
    return ast.unparse(tree)


# ---------------------------------------------------------------- reachability
def import_closure(start="lyric_harness.py"):
    """Every harness .py the entry point can import, at top level or inside a function."""
    files = [f for f in tracked() if f.endswith(".py")]
    mods = {}
    for f in files:
        m = f[:-3].replace("/", ".")
        mods[m[:-9] if m.endswith(".__init__") else m] = f
    flat = {os.path.basename(f)[:-3]: f for f in files}

    def resolve(name, cur):
        parts = name.split(".")
        for i in range(len(parts), 0, -1):
            cand = ".".join(parts[:i])
            for pre in ("", "quality.", os.path.dirname(cur).replace("/", ".") + "."):
                if pre + cand in mods:
                    return mods[pre + cand]
        return flat.get(parts[0]) if len(parts) == 1 else None

    seen, stack = set(), [start]
    while stack:
        f = stack.pop()
        if f in seen:
            continue
        seen.add(f)
        tree = ast.parse(open(os.path.join(HARNESS, f), encoding="utf-8").read())
        for node in ast.walk(tree):
            names = []
            if isinstance(node, ast.Import):
                names = [a.name for a in node.names]
            elif isinstance(node, ast.ImportFrom):
                base = node.module or ""
                if node.level:
                    pkg = [p for p in os.path.dirname(f).split("/") if p]
                    pkg = pkg[:len(pkg) - (node.level - 1)]
                    base = ".".join(pkg + ([base] if base else []))
                names = [base] + [f"{base}.{a.name}" for a in node.names]
            for name in names:
                hit = resolve(name, f)
                if hit:
                    stack.append(hit)
    return seen


# ---------------------------------------------------------------- profile -> song path
def load_profiles():
    """{tool: pstats.Stats} from map/.prof, keyed through map/trace-profile.json."""
    trace = json.load(open(os.path.join(MAP, "trace-profile.json")))
    tool_of = {c["n"]: c["tool"] for c in trace["calls"]}
    by_tool = {}
    VERBS.clear()
    for path in sorted(glob.glob(os.path.join(MAP, ".prof", "*.prof"))):
        n, rest = os.path.basename(path)[:-len(".prof")].split("--", 1)
        by_tool.setdefault(tool_of[int(n)], []).append(path)
        VERBS.setdefault(tool_of[int(n)], set()).add(rest.rsplit("--", 1)[0])
    opened = set()
    for path in glob.glob(os.path.join(MAP, ".prof", "*.opened")):
        opened |= {line for line in open(path, encoding="utf-8").read().split("\n")
                   if line and not line.endswith((".py", ".pyc")) and not line.startswith("map/")}
    return {tool: pstats.Stats(*paths) for tool, paths in by_tool.items()}, sorted(opened)


VERBS = {}  # tool -> harness commands it ran, filled by load_profiles
PASS_THROUGH = ("<module>", "<listcomp>", "<genexpr>", "<lambda>", "<setcomp>", "<dictcomp>")
_QUAL = {}


def qualnames(path):
    """{line: 'Class.method'} for every def in a file, keyed by its def line and,
    when decorated, by its first decorator line (what cProfile reports)."""
    if path not in _QUAL:
        found = {}

        def visit(node, prefix):
            for child in ast.iter_child_nodes(node):
                if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                    q = prefix + child.name  # a class body runs as code named after the class
                    found[child.lineno] = q
                    for d in child.decorator_list:
                        found.setdefault(d.lineno, q)
                    visit(child, q + ".")
                else:  # defs inside if/try/with blocks keep the enclosing prefix
                    visit(child, prefix)
        visit(ast.parse(open(path, encoding="utf-8").read()), "")
        _QUAL[path] = found
    return _QUAL[path]


def harness_key(func):
    filename, line, name = func
    if not filename.startswith(HARNESS + os.sep) or os.sep + "map" + os.sep in filename:
        return None
    if name.startswith("<"):
        return f"{rel(filename)}:{name}"
    return f"{rel(filename)}:{qualnames(filename).get(line, name)}"


def song_path_from(stats_by_tool):
    """-> (markdown, ran) where ran = sorted ['file:function', ...] over every tool."""
    order = ["lyric_sweep", "lyric_screen", "lyric_plan", "lyric_grade", "lyric_revise",
             "lyric_recover", "lyric_check", "lyric_verify", "lyric_types"]
    ran, out = set(), []
    for tool in [t for t in order if t in stats_by_tool]:
        st = stats_by_tool[tool].stats
        callees = {}
        for func, (_cc, _nc, _tt, _ct, callers) in st.items():
            for caller in callers:
                callees.setdefault(caller, set()).add(func)
        keys = {f: harness_key(f) for f in st}
        here = {k for k in keys.values() if k}
        ran |= here
        shown = {f for f, k in keys.items() if k and not f[2].startswith(PASS_THROUGH)}
        entry = next((f for f in st if keys[f] == "lyric_harness.py:main"), None)
        if entry is None:
            continue
        total = st[entry][3] or 1

        def children(func):
            """Named harness functions reached from func, looking through library
            frames, imports and comprehensions."""
            found, stack, seen = set(), list(callees.get(func, ())), set()
            while stack:
                g = stack.pop()
                if g in seen:
                    continue
                seen.add(g)
                if g in shown:
                    found.add(g)
                else:
                    stack.extend(callees.get(g, ()))
            return sorted(found, key=lambda g: (-st[g][3], keys[g]))

        named = {k for k in here if not k.split(":", 1)[1].startswith("<")}
        out.append(f"\n## {tool}\n")
        out.append("Runs `lyric_harness.py` " + ", ".join(
            f"`{v}`" for v in sorted(VERBS.get(tool, ()))) + ".\n")
        out.append(f"{len(named)} named harness functions ran, in "
                   f"{len({k.split(':')[0] for k in named})} files. Tree: each function's share "
                   f"of this tool's time (time inside the calls it makes included; a function that "
                   f"calls itself can show more than its parent), 4 levels, under 3% left out, "
                   f"each function shown once.\n")
        lines, placed = [], {entry}

        def walk(func, depth):
            for g in children(func):
                share = st[g][3] / total
                if share < 0.03 or g in placed:
                    continue
                placed.add(g)
                lines.append(f"{'  ' * depth}- `{keys[g]}` {share:.0%}")
                if depth < 3:
                    walk(g, depth + 1)
        walk(entry, 0)
        out.extend(lines)
        top = sorted(shown, key=lambda f: (-st[f][2], keys[f]))[:6]
        self_total = sum(v[2] for v in st.values()) or 1
        out.append("\nMost time spent inside the function itself: " + ", ".join(
            f"`{keys[f]}` {st[f][2] / self_total:.0%}" for f in top) + "\n")
    head = ("# Song path\n\nWhat runs when each lyric tool is called, from one profiled run of "
            "the reference song (`map/song.txt`, 16 lines) through the connector, every call in "
            "a fresh Python process, so start-up (loading the pronunciation dictionary and "
            "tables) shows up in each tool. The deployed connector keeps one warm process and "
            "pays it once. Regenerate: `node map/trace.mjs --profile && python3 map/build.py "
            "--from-profile`.\n")
    return head + "\n".join(out) + "\n", sorted(ran)


# ---------------------------------------------------------------- rules
def rules_md():
    sys.path.insert(0, HARNESS)
    from quality import gate_census
    from quality.loop import MANDATORY_PURSUE
    census = gate_census.census()
    rows = sorted(census.items(), key=lambda kv: (kv[1]["verdict"] != "GATED", kv[0]))
    out = ["# Rules\n",
           "Every finding code the harness can emit (from `quality/gate_census.py`). "
           "**Stops a song** says what can refuse on it: a flag fails grading and holds the "
           "line open in revise; `MANDATORY_PURSUE` (`quality/loop.py`) holds a line open on a "
           "note; `LENGTH_GATE_CODES` (`quality/floor.py`) blocks exit 0. "
           "Codes marked nothing are reported and stop nothing.\n",
           f"Held open even as notes (`MANDATORY_PURSUE`): "
           f"{', '.join(sorted(MANDATORY_PURSUE)) or 'none (emptied 2026-10-04, owner ruling)'}.\n",
           "| code | severity | stops a song | emitted in |", "|---|---|---|---|"]
    for code, r in rows:
        out.append(f"| {code} | {'/'.join(r['severities'])} | {', '.join(r['gates']) or '—'} | "
                   f"{', '.join(r['files'])} |")
    out.append("\nFunction reading refusals: `END_WORD_UNREADABLE` blocks requested "
               "function coverage, not a quality flag. Concrete failures carry "
               "`function:END_WORD_UNREADABLE:TN:LN` plus the failed word, sung-token "
               "position and exact lyric text. `function:draft` retains the aggregate "
               "refusal. A comparison without a draft coordinate remains explicitly "
               "unlocated; its section-local line is not a draft line number. "
               "Mixed failures retain known line obligations plus a separate "
               "`location_scope: section_local` record for unlocated words. "
               "Occurrence declarations bind exact text and sung-token position; "
               "they do not add dictionary readings or change the perfect-rime policy.")
    return "\n".join(out) + "\n"


# ---------------------------------------------------------------- limits
LIMIT_NAME = re.compile(r"(CAP|MAX|MIN|LIMIT|BUDGET|TIMEOUT|DEADLINE|BYTES|CEILING|CHARS|"
                        r"ROUNDS|ATTEMPTS|_MS|_S$|_SECONDS|WINDOW|DEPTH|RESERVE)", re.I)


def _num(node):
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)) \
            and not isinstance(node.value, bool):
        return node.value
    if isinstance(node, ast.BinOp):
        a, b = _num(node.left), _num(node.right)
        if a is None or b is None:
            return None
        ops = {ast.Mult: lambda: a * b, ast.Add: lambda: a + b,
               ast.Sub: lambda: a - b, ast.Pow: lambda: a ** b}
        return ops.get(type(node.op), lambda: None)()
    return None


def limits_md(files_that_ran):
    rows = []
    for f in sorted(files_that_ran):
        tree = ast.parse(open(os.path.join(HARNESS, f), encoding="utf-8").read())
        for node in tree.body:
            if isinstance(node, (ast.Assign, ast.AnnAssign)):
                targets = node.targets if isinstance(node, ast.Assign) else [node.target]
                for t in targets:
                    if isinstance(t, ast.Name) and t.id.isupper() and LIMIT_NAME.search(t.id):
                        v = _num(node.value)
                        if v is not None:
                            rows.append((f, t.id, v))
    js = []
    for f in sorted(glob.glob(os.path.join(ROOT, "mcp", "*.js"))):
        for m in re.finditer(r"^(?:export )?const ([A-Z][A-Z0-9_]+) = ([0-9_ *+.()-]+);",
                             open(f, encoding="utf-8").read(), re.M):
            if LIMIT_NAME.search(m.group(1)):
                try:
                    v = eval(m.group(2).replace("_", ""), {"__builtins__": {}})  # digits and operators only
                except Exception:
                    continue
                js.append((os.path.relpath(f, ROOT), m.group(1), v))
    out = ["# Limits\n",
           "Numeric caps and budgets: module-level constants in the harness files that ran "
           "for the reference song, and in the connector (`mcp/`). Name, value, file. "
           "Byte values are also shown in KB.\n",
           "| constant | value | file |", "|---|---:|---|"]

    def show(name, v):
        return f"{v:,}" + (f" ({v / 1024:,.0f} KB)" if "BYTES" in name and v >= 1024 else "")
    out += [f"| {n} | {show(n, v)} | `{f}` |" for f, n, v in rows]
    out += ["", "Connector:", "", "| constant | value | file |", "|---|---:|---|"]
    out += [f"| {n} | {show(n, v)} | `../{f}` |" for f, n, v in js]
    return "\n".join(out) + "\n"


# ---------------------------------------------------------------- files
def files_md(ran_files, imported, reach, opened):
    cats = {}
    py = []
    for f in tracked():
        size = os.path.getsize(os.path.join(HARNESS, f))
        if f.endswith(".py"):
            base = os.path.basename(f)
            kind = ("test" if base.startswith("test_") else "ran" if f in ran_files
                    else "imported, no function ran" if f in imported
                    else "loadable, not loaded" if f in reach else "never loaded by a song")
            py.append((f, kind, size))
            key = "Python: " + {"test": "tests", "ran": "song program (ran)",
                                "imported, no function ran": "imported by the song program, unused",
                                "loadable, not loaded": "loadable by the song program, not loaded",
                                "never loaded by a song": "research and record tools (never loaded)"}[kind]
        else:
            top = f.split("/")[0] if "/" in f else "(top level)"
            key = {"corpus": "corpus (raw verse, measured offline)",
                   "data": "data tables (read at run time)"}.get(top, None)
            if key is None:
                key = ("saved measurement results" if f.startswith("quality/results/")
                       else "notes and records (.md)" if f.endswith(".md") else "other files")
        c = cats.setdefault(key, [0, 0])
        c[0] += 1
        c[1] += size
    out = ["# Files\n",
           "Everything tracked under `lyric-harness/`, sized in tokens (bytes ÷ 3.6, rounded). "
           "**ran** = at least one function in the file ran for the reference song.\n",
           "| part | files | tokens |", "|---|---:|---:|"]
    out += [f"| {k} | {n} | {ktok(b)} |" for k, (n, b) in sorted(cats.items(), key=lambda kv: -kv[1][1])]
    corpus = [f for f in opened if f.startswith("corpus/")]
    in_repo = set(tracked())
    fetched = {}
    for f in opened:
        if f not in in_repo:
            key = "/".join(f.split("/")[:3]) + "/" if f.count("/") >= 3 else f
            fetched[key] = fetched.get(key, 0) + 1
    out += ["", f"## Data the song program opened ({len(opened)} files, {len(corpus)} under corpus/)", "",
            "In the repo: " + ", ".join(
                f"`{f}` {ktok(os.path.getsize(os.path.join(HARNESS, f)))}"
                for f in opened if f in in_repo) + ".",
            "", "Fetched or staged, not in the repo: " + ", ".join(
                f"`{k}`" + (f" ({n} files)" if n > 1 else "") for k, n in sorted(fetched.items())) + "."]
    for kind in ("ran", "imported, no function ran", "loadable, not loaded", "never loaded by a song"):
        group = sorted((p for p in py if p[1] == kind), key=lambda p: -p[2])
        out += ["", f"## Python — {kind} ({len(group)})", ""]
        out += [", ".join(f"`{f}` {ktok(s)}" for f, _k, s in group)]
    return "\n".join(out) + "\n"


# ---------------------------------------------------------------- timings
def timings_md():
    t = json.load(open(os.path.join(MAP, "trace.json")))
    out = ["# Timings\n",
           f"One run of the reference song (`map/song.txt`, {t['song_lines']} lines, seed "
           f"{t['seed']}) through the connector with the {t['worker']} Python worker, "
           f"{t['generated'][:10]}. Each call's limit is {t['tool_budget_ms'] // 1000} s. "
           "Revise questions were answered mechanically, so the song is not the point; "
           "the times are. Regenerate: `node map/trace.mjs && python3 map/build.py`.\n",
           "| # | flow | tool | seconds | exit | result |", "|---:|---|---|---:|---:|---|"]
    for c in t["calls"]:
        res = c.get("stop") or c.get("status") or (
            "refused: " + c["refusal"][:80] if c.get("refusal") else "")
        out.append(f"| {c['n']} | {c['flow']} | {c['tool']} | {c['ms'] / 1000:.1f} | "
                   f"{c['exit_code']} | {res} |")
    out.append(f"\nTotal: {t['total_ms'] / 1000:.0f} s.")
    return "\n".join(out) + "\n", t


# ---------------------------------------------------------------- index
def handbook_sections():
    path = os.path.join(HARNESS, "HANDBOOK.md")
    if not os.path.exists(path):
        return []
    out, name, size = [], None, 0
    for line in open(path, encoding="utf-8"):
        if line.startswith("## "):
            if name:
                out.append((name, size))
            name, size = line[3:].strip(), 0
        size += len(line.encode())
    if name:
        out.append((name, size))
    return out


def index_md(sections, ran, trace):
    calls = {}
    for c in trace["calls"]:
        calls.setdefault(c["tool"], []).append(c["ms"] / 1000)
    verbs = ", ".join(f"`{tool}` {max(s):.0f}s" for tool, s in calls.items())
    hb = handbook_sections()
    sizes = {s: len(sections[s].encode()) for s in sections}
    lines = [
        "# Lyric harness — start here",
        "",
        "<!-- Generated by `python3 map/build.py`. Do not edit by hand; edit the "
        "template in map/build.py. -->",
        "",
        "This folder is the songwriting program behind the lyric tools: it plans a song's "
        "shape, grades a draft against that plan, and runs the revise loop that asks the "
        "writer for replacement lines. The connector (`../mcp/`) turns each lyric tool call "
        "into one or more runs of `lyric_harness.py` (`map/song-path.md` names them).",
        "",
        "This file is kept small on purpose. Load the section a task needs, not everything.",
        "",
        "## The owner's standing rules",
        "",
        "1. The recipe engine and the lyrics never touch: no import, bridge or pipeline "
        "between them.",
        "2. This is a songwriter, not a grader. The order is plan, write, revise; the checks "
        "exist to serve the writing.",
        "3. No private instruments: any step used to produce a delivered song goes through a "
        "verb, not a scratch script.",
        "4. Batch comparator changes (anything that moves `comparator_fingerprint()` in "
        "`quality/song_profile_calibration.py` discards the predictability memo).",
        "5. A word passes if any way of singing it works: a check the song must pass holds "
        "under one whole dictionary reading; a collision counts only if every reading has it.",
        "",
        "House rules: never abbreviate project names (Codex Musica, Pantheon Registry, Deus ex "
        "Homine, Chocolate Secrets); no artist or producer names as descriptors in "
        "generation-facing output.",
        "",
        "## How a song moves through the tools",
        "",
        "New song: `lyric_sweep` (pick a seed) → `lyric_screen` (test rhyme words) → "
        "`lyric_plan` (song shape and rhyme plan) → write the draft → `lyric_grade` → "
        "`lyric_revise` (asks for replacement lines until it stops). Pasted lyrics: "
        "`lyric_recover` → `lyric_check` → `lyric_revise` → `lyric_verify`.",
        "",
        f"Slowest call per tool on the 16-line reference song ({trace['generated'][:10]}, "
        f"limit {trace['tool_budget_ms'] // 1000}s per call): {verbs}.",
        "",
        "## Map sections (read only what the task needs)",
        "",
        "| section | what it answers | tokens |",
        "|---|---|---:|",
        f"| `map/song-path.md` | which functions run for each tool, and where the time goes | {ktok(sizes['song-path'])} |",
        f"| `map/rules.md` | every finding code, its severity, and whether it can stop a song | {ktok(sizes['rules'])} |",
        f"| `map/limits.md` | every numeric cap, budget and time limit, with its file | {ktok(sizes['limits'])} |",
        f"| `map/files.md` | which files the song program uses, which it never loads, sizes | {ktok(sizes['files'])} |",
        f"| `map/timings.md` | seconds per tool call on the reference song | {ktok(sizes['timings'])} |",
        "",
        "## Reading code without filling the context",
        "",
        "`python3 map/build.py show quality/loop.py:revise_loop` prints one function (or a "
        "class, or a whole file) with comments and docstrings removed. Most of this "
        "codebase's text is comments; the stripped form is usually under half the size.",
        "",
        "## Large files: search them, never load them whole",
        "",
        f"- `HANDBOOK.md` ({ktok(os.path.getsize(os.path.join(HARNESS, 'HANDBOOK.md')) if os.path.exists(os.path.join(HARNESS, 'HANDBOOK.md')) else 0)}): "
        "the previous version of this file — design history, doctrines (numbered 1–96; the "
        "table is its last section), test discipline. Sections:",
    ]
    lines += [f"  - {name} ({ktok(size)})" for name, size in hb]
    lines += [
        f"- `MISSING.md` ({ktok(os.path.getsize(os.path.join(HARNESS, 'MISSING.md')))}): the "
        "defect register, entries `M-<n>`. Grep for the entry number.",
        f"- `BACKLOG.md` ({ktok(os.path.getsize(os.path.join(HARNESS, 'BACKLOG.md')))}): "
        "open work, by tier.",
        "- `corpus/`, `data/`, `quality/results/`: measurement inputs and outputs, millions "
        f"of tokens. In the traced run the song program opened {len(ran['opened'])} data files "
        f"and {sum(f.startswith('corpus/') for f in ran['opened'])} under `corpus/` "
        "(`map/files.md` lists them).",
        "",
        "## Keeping this map true",
        "",
        "`python3 map/build.py --check` fails when the map no longer matches the code. "
        "After changing harness code, run `python3 map/build.py`. After changing what a "
        "tool runs, retrace: `node map/trace.mjs --profile && node map/trace.mjs && "
        "python3 map/build.py --from-profile`.",
        "",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------- driver
def build(from_profile=False):
    files = {}
    ran_path = os.path.join(MAP, "ran.json")
    if from_profile:
        stats, opened = load_profiles()
        files["song-path"], functions = song_path_from(stats)
        ran = {"functions": functions, "opened": opened}
        with open(ran_path, "w") as fh:
            fh.write(json.dumps(ran, indent=0) + "\n")
    else:
        files["song-path"] = open(os.path.join(MAP, "song-path.md"), encoding="utf-8").read()
        ran = json.load(open(ran_path))
    # A file whose only entry is "<module>" was imported, not used.
    ran_files = {k.split(":")[0] for k in ran["functions"] if not k.endswith(":<module>")}
    imported = {k.split(":")[0] for k in ran["functions"]} - ran_files
    files["rules"] = rules_md()
    files["limits"] = limits_md(ran_files)
    files["files"] = files_md(ran_files, imported, import_closure(), ran["opened"])
    files["timings"], trace = timings_md()
    index = index_md(files, ran, trace)
    return files, index, ran


def stale_names(ran):
    """Traced functions that no longer exist (renamed, moved or deleted)."""
    missing = []
    for k in ran["functions"]:
        f, name = k.split(":", 1)
        path = os.path.join(HARNESS, f)
        if not os.path.exists(path) or (not name.startswith("<")
                                        and name not in qualnames(path).values()):
            missing.append(k)
    return missing


def show(target):
    f, _, name = target.partition(":")
    src = open(os.path.join(HARNESS, f), encoding="utf-8").read()
    if not name:
        print(stripped(src))
        return
    parts = name.split(".")
    nodes = ast.parse(src).body
    for part in parts:
        hit = next((n for n in nodes if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef,
                                                       ast.ClassDef)) and n.name == part), None)
        if hit is None:
            sys.exit(f"{name} not found at top level of {f} (use Class.method for methods)")
        nodes = hit.body
    first = hit.decorator_list[0].lineno if hit.decorator_list else hit.lineno
    print(f"# {f}:{first}-{hit.end_lineno}")
    print(stripped(textwrap.dedent("\n".join(src.splitlines()[first - 1:hit.end_lineno]))))


def main(argv):
    if argv[:1] == ["show"]:
        return show(argv[1])
    files, index, ran = build(from_profile="--from-profile" in argv)
    if "--check" in argv:
        bad = [s for s in SECTIONS if open(os.path.join(MAP, f"{s}.md"), encoding="utf-8").read() != files[s]]
        if open(INDEX, encoding="utf-8").read() != index:
            bad.append("CLAUDE.md")
        gone = stale_names(ran)
        if bad or gone:
            print("lyric map is out of date:", ", ".join(bad) or "-")
            if gone:
                print("functions in the traced song path no longer exist:", ", ".join(gone[:10]))
                print("retrace: node map/trace.mjs --profile && python3 map/build.py --from-profile")
            else:
                print("run: python3 map/build.py")
            return 1
        print("lyric map is current")
        return 0
    for s in SECTIONS:
        with open(os.path.join(MAP, f"{s}.md"), "w", encoding="utf-8") as fh:
            fh.write(files[s])
    with open(INDEX, "w", encoding="utf-8") as fh:
        fh.write(index)
    print("wrote CLAUDE.md and map/" + ", map/".join(f"{s}.md" for s in SECTIONS))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
