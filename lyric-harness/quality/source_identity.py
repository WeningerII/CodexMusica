"""Read named source definitions without trusting a live function's old line offset.

A long process may outlive edits to unrelated lines above a definition.
inspect.getsource(function) then uses a stale co_firstlineno and can hash a
neighbouring function. Resolve the actual top-level declaration by name in the
current module instead, preserving its exact source text and decorators.
"""
import ast
import inspect
from pathlib import Path


def definition_source(value):
    module = inspect.getmodule(value)
    if module is None or not getattr(module, "__file__", None):
        raise ValueError("source identity requires a file-backed module")
    name = value.__qualname__
    if "." in name:
        raise ValueError("source identity requires a top-level definition")
    source = Path(module.__file__).read_text(encoding="utf-8")
    nodes = [node for node in ast.parse(source).body
             if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
             and node.name == name]
    if len(nodes) != 1:
        raise ValueError(f"source identity requires one definition of {name}")
    node = nodes[0]
    first = min([node.lineno] + [decorator.lineno for decorator in node.decorator_list])
    return "".join(source.splitlines(keepends=True)[first - 1:node.end_lineno])


def definition_closure(path, entry_names):
    """-> (reached names, source text) for one module's slice of another.

    A memo guarded by a WHOLE-FILE hash of a file under active edit is a memo
    that is always cold. `lyric_harness.py` is 13k lines and ~220 top-level
    names; the song-profile comparator reaches 60 of them, and over the 40
    commits before this function was written, 7 of the 10 that changed that
    file changed nothing the comparator can see. Each of those 7 discarded a
    ~2.4 CPU-hour memo and took the nightly's bounded slice with it (`ci.yml`,
    the song-profile step; `MISSING.md` M-299).

    THE GUARD IS NOT WEAKENED, and that is the whole point of taking the
    closure rather than a hand-written list. `entry_names` are the names a
    caller actually takes from the module; everything those definitions can
    reach BY NAME is included, transitively, so a change to a helper five
    calls deep still moves the hash. Only definitions nothing reachable
    mentions are dropped.

    TWO DELIBERATE OVER-INCLUSIONS, because widening is safe here and
    narrowing is not:
      * every module-level statement that is not a definition -- imports and
        module-level validation -- is included whatever it mentions, since it
        runs at import and can change what the reachable definitions do;
      * an attribute name (`obj.foo`) counts as a reference to a top-level
        `foo` if one exists. That can pull in a definition nothing really
        uses. It cannot miss one.

    The returned names are hashed by the caller alongside the text, so a
    change in WHICH definitions are reachable moves the fingerprint even if
    every definition's own text is unchanged.

    Dynamic dispatch would defeat this, so it is checked rather than assumed:
    `quality/test_source_identity.py` refuses a closure whose reachable set
    looks up a module-level name through `getattr`/`globals`/`eval`.
    """
    source = Path(path).read_text(encoding="utf-8")
    tree = ast.parse(source)
    definitions, other = {}, []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            definitions.setdefault(node.name, []).append(node)
        elif isinstance(node, (ast.Assign, ast.AnnAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            named = [t.id for t in targets if isinstance(t, ast.Name)]
            for name in named:
                definitions.setdefault(name, []).append(node)
            if not named:
                other.append(node)
        else:
            other.append(node)

    reached, todo = set(), []
    for name in entry_names:
        if name in definitions and name not in reached:
            reached.add(name)
            todo.append(name)
    while todo:
        for node in definitions[todo.pop()]:
            for inner in ast.walk(node):
                if isinstance(inner, ast.Name):
                    name = inner.id
                elif isinstance(inner, ast.Attribute):
                    name = inner.attr
                else:
                    continue
                if name in definitions and name not in reached:
                    reached.add(name)
                    todo.append(name)

    lines = source.splitlines(keepends=True)
    def text_of(node):
        first = min([node.lineno]
                    + [d.lineno for d in getattr(node, "decorator_list", [])])
        return "".join(lines[first - 1:node.end_lineno])

    chunks = [text_of(node) for node in other]
    for name in sorted(reached):
        chunks.extend(text_of(node) for node in definitions[name])
    return sorted(reached), "".join(chunks)


def module_entry_names(importer_path, module_name):
    """-> sorted names one module TAKES from another, read off the importer.

    The companion to `definition_closure`: that function needs an entry set,
    and a hand-written entry set is a second statement of an import list
    (doctrine 1) that goes stale the first time somebody imports one more
    name. This reads the list from the importer's own source instead, so the
    closure widens by itself when the import does.

    Both spellings are read, and the second is why this walks the whole tree
    rather than `tree.body`: `quality/features.py` takes `Declaration`,
    `Lexicon`, `anchor`, `line_anchors`, `score`, `syllabify`, `vowel_sim`
    and `VOWELS` at module level and `_refuse` and `fold_apostrophes` from
    INSIDE two function bodies, and a top-level-only scan would have dropped
    the tokeniser's own apostrophe folding out of the comparator.
    `module.attr` attribute access is read too, so a module imported whole is
    covered by the same call.

    A star import REFUSES. `from X import *` makes the entry set exactly "the
    whole module" and this function cannot say so in names, so it says it
    cannot rather than returning a set that looks complete (doctrine 20).
    """
    tree = ast.parse(Path(importer_path).read_text(encoding="utf-8"))
    bare = module_name.split(".")[-1]
    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module == module_name:
            for alias in node.names:
                if alias.name == "*":
                    raise ValueError(
                        f"{importer_path} star-imports {module_name}: the entry"
                        " set is the whole module and cannot be named")
                names.add(alias.name)
        elif (isinstance(node, ast.Attribute)
              and isinstance(node.value, ast.Name)
              and node.value.id == bare):
            names.add(node.attr)
    return sorted(names)
