"""Focused Boo-” historical-module comparison, not full-tree acceptance.

Run from any directory with a Python environment supporting the harness:
    python3 boo_quote_probe.py [--repo PATH] > boo_quote_probe.json

The repository defaults to this script's enclosing checkout. The staged
cmudict.dict must be present. Each historical pair runs in a fresh process.
Only relations.py and phonology/eng.py are loaded from historical commits;
all other loaded harness modules must match SUPPORT_HEAD exactly. No provider
or network calls are made. Output includes module hashes and exact pins.
"""
import argparse
import hashlib
import importlib.abc
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

_BEFORE = "0af39c6ff3bb9f1c0229bbf7bf14f49816e298e2"
_AFTER = "7c26d40c4b441851fb9946fb4c54fc50d737b1fd"
_SUPPORT = "8ea94ac9d5141eb5062a8094351a9330f4edc38c"
_MODULES = ("quality.relations", "quality.phonology.eng")
_WITNESS = "Then the ominous words “It’s a Boo-”"


def _saved(repo, head, relative):
    return subprocess.check_output(["git", "show", f"{head}:{relative}"], cwd=repo)


class _Historical(importlib.abc.MetaPathFinder, importlib.abc.Loader):
    def __init__(self, repo, head):
        self.repo, self.head = repo, head

    def find_spec(self, fullname, path, target=None):
        if fullname in _MODULES:
            return importlib.util.spec_from_loader(fullname, self)
        return None

    def create_module(self, spec):
        return None

    def exec_module(self, module):
        relative = "lyric-harness/" + module.__name__.replace(".", "/") + ".py"
        source = _saved(self.repo, self.head, relative)
        module.__file__ = str(self.repo / relative)
        exec(compile(source, f"{self.head}:{relative}", "exec"), module.__dict__)


def _probe(repo, head):
    sys.meta_path.insert(0, _Historical(repo, head))
    sys.path.insert(0, str(repo / "lyric-harness"))
    import lyric_harness as LH
    from quality import relations as R
    from quality.revise import relation_phonology_for
    rows = []
    for strip in (True, False):
        lex = LH.Lexicon(reader_scheme="v2", strip_parens=strip)
        phon = relation_phonology_for(lex)
        stream = R.build_stream([_WITNESS, "we knew"], phon)
        row = {"strip_parens": strip, "mode": "aside-stripped" if strip else "voices",
               "tokens": stream.lexical_tokens[0], "unread": stream.unreadable,
               "split": phon.split_final(_WITNESS)}
        for name in ("perfect rhyme", "broken rhyme"):
            row[name] = R.line_pairs_for(R.REGISTRY[name], stream, keep_refusal=True,
                                        requested_pairs={(1, 2)}).verdict((1, 2))
        assert row["split"] is False
        expected = (None, None) if head == _BEFORE else (True, False)
        assert (row["perfect rhyme"], row["broken rhyme"]) == expected, row
        assert stream.unreadable == ([(0, 6, "Boo-")] if head == _BEFORE else []), row
        rows.append(row)
    manifest = []
    for name, module in sorted(sys.modules.items()):
        if name == "__main__":
            continue
        file = getattr(module, "__file__", None)
        if not file:
            continue
        try:
            relative = Path(file).resolve().relative_to(repo).as_posix()
        except ValueError:
            continue
        if not relative.startswith("lyric-harness/") or not relative.endswith(".py"):
            continue
        pin = head if name in _MODULES else _SUPPORT
        source = _saved(repo, pin, relative)
        if name not in _MODULES:
            assert Path(file).read_bytes() == source, f"support module differs: {relative}"
        manifest.append({"path": relative, "commit": pin,
                         "sha256": hashlib.sha256(source).hexdigest()})
    return {"historical_module_head": head, "support_head": _SUPPORT,
            "results": rows, "loaded_harness_modules": manifest}


def _main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[4])
    parser.add_argument("--child", choices=(_BEFORE, _AFTER), help=argparse.SUPPRESS)
    args = parser.parse_args()
    repo = args.repo.resolve()
    if args.child:
        result = _probe(repo, args.child)
    else:
        runs = [json.loads(subprocess.check_output([
            sys.executable, str(Path(__file__).resolve()), "--repo", str(repo), "--child", head
        ], text=True)) for head in (_BEFORE, _AFTER)]
        result = {"scope": "historical relation/phonology modules with pinned supporting modules; not full-tree or live acceptance",
                  "python": sys.version, "witness": _WITNESS, "comparison_line": "we knew",
                  "dictionary_sha256": hashlib.sha256((repo / "lyric-harness/cmudict.dict").read_bytes()).hexdigest(),
                  "runs": runs}
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    _main()
