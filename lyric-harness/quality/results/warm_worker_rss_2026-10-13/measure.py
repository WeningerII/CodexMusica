#!/usr/bin/env python3
"""Peak resident memory of ONE warm worker holding both reader schemes'
lexicons and a Library analysis -- a measurement, not a gate.

    python3 quality/results/warm_worker_rss_2026-10-13/measure.py

TEST-PROCESS ISOLATION, NOT A PRODUCTION CAPACITY BOUND. One fresh process
loads `mcp/worker.py` and serves, in order: a new lyrics request (reader
scheme v2), a legacy one (a pre-batch deferred state, v1), and a Library
analysis of the Gutenberg rows bound under v1 (`run_reader`, which rebinds
them under v2). After those requests the process's module-level caches hold
lexicons of BOTH schemes (the dual-scheme cache) beside the analysis; this
records which, and the process's resident memory (VmRSS) and peak (VmHWM)
after each step. The Library guard (`library.analysis._resource_guard`) is
left exactly as shipped (1 GiB unless LIBRARY_READER_MAX_RSS_MIB is set,
which this refuses to run under) and is not raised: if it trips, that is
recorded as the result. Nothing here is a threshold; the number is reported
for the owner to read against the guard. A long-lived worker serving many
requests can hold more than one fresh process does, so this is not a bound
on one.

The fixtures are the ones quality/test_reader.py WarmWorker uses
(fixtures/reader_v1_defer_states.json; imports/gutenberg-next-ten/
pronunciations/69378.json, the payload whose rows include `U--h`), and,
as a second analysis in the same process, the largest verse unit of the same
book (imports/gutenberg-next-ten/69378/candidates.json) with its declared
rows.
"""
import hashlib
import io
import json
import os
import platform
import shutil
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT))


def _status():
    out = {}
    for row in Path("/proc/self/status").read_text().splitlines():
        if row.startswith(("VmRSS:", "VmHWM:")):
            out[row.split(":")[0]] = int(row.split()[1]) * 1024
    return {"rss_bytes": out.get("VmRSS"), "peak_rss_bytes": out.get("VmHWM")}


def _caches():
    import quality.fit as FT
    import quality.lexicon_supplement as LS
    import quality.meter_bands as MB
    from quality.phonology import eng
    return {"eng._LEX": sorted(eng._LEX),
            "eng._CUT_LEX": sorted(f"{s}/{'aside' if a else 'strip'}" for s, a in eng._CUT_LEX),
            "fit._LEX": sorted({k[2] for k in FT._LEX if len(k) == 3}),
            "lexicon_supplement._SUPPLEMENTED": sorted({k[-1] for k in LS._SUPPLEMENTED}),
            "meter_bands._READERS": sorted(f"{m}/{s}" for m, s in MB._READERS)}


def _main():
    if "LIBRARY_READER_MAX_RSS_MIB" in os.environ:
        sys.exit("unset LIBRARY_READER_MAX_RSS_MIB: this measures under the shipped envelope")
    import importlib.util
    cwd = os.getcwd()
    spec = importlib.util.spec_from_file_location("lyric_worker_measured",
                                                  ROOT.parent / "mcp" / "worker.py")
    W = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(W)             # chdirs to lyric-harness
    os.chdir(cwd)
    import library.analysis as LA
    envelope = int(os.environ.get("LIBRARY_READER_MAX_RSS_MIB", "1024")) * 1024 * 1024
    fx = json.loads((ROOT / "quality" / "fixtures" / "reader_v1_defer_states.json")
                    .read_text(encoding="utf-8"))
    steps = [dict(step="worker loaded", **_status())]

    def lyrics(state_text):
        work = Path(tempfile.mkdtemp())
        try:
            (work / "draft.txt").write_text("\n".join(fx["draft"]) + "\n", encoding="utf-8")
            if state_text is not None:
                (work / "state.json").write_text(state_text, encoding="utf-8")
            code, out, _ = W.run_one([a.replace("<WORK>", str(work)) for a in fx["verb"]])
            line = next(l for l in out.splitlines() if l.startswith("  lyric result: "))
            return code, json.loads(line[len("  lyric result: "):])["reader_scheme"]
        finally:
            shutil.rmtree(work, True)

    code, scheme = lyrics(None)
    steps.append(dict(step="new lyrics request", exit=code, reader_scheme=scheme, **_status()))
    code, scheme = lyrics(fx["states"][1]["state"])
    steps.append(dict(step="legacy lyrics request", exit=code, reader_scheme=scheme,
                      **_status()))
    batch = ROOT / "imports" / "gutenberg-next-ten" / "pronunciations" / "69378.json"
    payloads = json.loads(batch.read_text(encoding="utf-8"))
    rows = next(p["pronunciations"] for p in payloads.values()
                if any(r["line"].startswith("U--h") for r in p["pronunciations"]))

    pages = Path(tempfile.mkdtemp(prefix="warm-rss-pages-"))

    class Parent:
        """The durable parent `run_reader` acknowledges to, as the Node
        adapter is: each checkpoint frame's records are committed to a
        content-addressed page on disk before the ack names it, so a later
        step can resume from them (`added_page_paths`)."""
        def __init__(self):
            self.out = self              # run_reader prints its frames here
            self.frames, self._last, self._part = 0, "", ""

        # Only the frame awaiting its ack is held: keeping every frame in
        # memory would charge the parent's buffer to the worker's peak.
        def write(self, text):
            self._part += text
            while "\n" in self._part:
                line, self._part = self._part.split("\n", 1)
                if line:
                    self._last, self.frames = line, self.frames + 1
            return len(text)

        def flush(self):
            pass

        def readline(self):
            frame = json.loads(self._last)
            self._last = ""
            body = json.dumps({"instances": frame["data"]["records"]},
                              ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            page = pages / (hashlib.sha256(body).hexdigest() + ".json")
            page.write_bytes(body)
            return json.dumps({"id": "r", "event": "reader_ack", "continue": True,
                               "added_page_paths": [str(page)]}) + "\n"

    def analyse(step, unit, lines, rows):
        payload = {"source": {"reading_unit_id": unit, "reading_revision": "fixture-v1",
                              "language": "eng", "text": "\n".join(lines)},
                   "declarations": {"pronunciations": rows}, "requested": ["sound"]}
        parent = Parent()
        saved = sys.stdin, sys.stdout
        sys.stdin, sys.stdout = parent, parent.out
        try:
            result = W.run_reader(payload, "r")
            status, error = result.get("status"), None
        except ValueError as e:              # the guard's RESOURCE_LIMIT, recorded
            status, error = "raised", str(e)
        finally:
            sys.stdin, sys.stdout = saved
        frames = parent.frames
        steps.append(dict(step=step, status=status, error=error, lines=len(lines),
                          rows=len(rows), checkpoint_frames=frames, **_status()))

    # The test's analysis: the two lines the `U--h` payload declares on.
    analyse("Library analysis (the test's two-line unit)", "caller-owned-fixture:eng",
            list(dict.fromkeys(r["line"] for r in rows)), rows)
    # And the largest verse unit of the same book, with every declared row
    # that falls on its lines: the upper end of one Library reading unit.
    units = json.loads((ROOT / "imports" / "gutenberg-next-ten" / "69378" / "candidates.json")
                       .read_text(encoding="utf-8"))
    big = max(units, key=lambda u: (u.get("verse_line_count") or 0, u["id"]))
    big_lines = [l for l in big["text"].splitlines() if l.strip()]
    on = set(big_lines)
    big_rows = [r for p in payloads.values() for r in p["pronunciations"] if r["line"] in on]
    analyse(f"Library analysis (largest verse unit, {big['id']})", "caller-owned-fixture:big",
            big_lines, big_rows)
    shutil.rmtree(pages, True)
    receipt = {
        "label": "test-process isolation, not a production capacity bound",
        "python": f"{platform.python_implementation()} {platform.python_version()}",
        "guard_envelope_bytes": envelope,
        "steps": steps,
        "peak_rss_bytes": steps[-1]["peak_rss_bytes"],
        "peak_fraction_of_guard": round(steps[-1]["peak_rss_bytes"] / envelope, 3),
        "caches_after": _caches(),
    }
    print(json.dumps(receipt, indent=2))


if __name__ == "__main__":
    _main()
