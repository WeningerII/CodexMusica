"""Every string the grading tool can send back, with the verbs that can send it.

-> JSON on stdout: [{file, line, verbs, text}].

WHICH VERBS. Inside lyric_harness.py's `main`, a string's verbs are the ones
its enclosing `cmd` branches leave possible: `cmd == X` and `cmd in (...)`
narrow the set in the body and remove it in the `else`; `!=` and `not in` do
the opposite; a test that also says something else narrows the body only;
nesting intersects. Code in `main` outside every `cmd` branch runs for every
verb. A helper function, or anything else outside `main`, can be called from
any verb, so its verbs are ["*"]. A module the verbs import for their
messages is given its verbs whole (MODULE_VERBS).

WHAT A STRING IS. A plain literal, one f-string read whole, or a `+` of
string parts read whole, each interpolation shown as {}. Not modelled: an
early `return` (a later string is still given the verbs that returned), a
`match` statement, and a message assembled by `%`, `.format()` or a list
`join` (each part is read on its own). Docstrings are left out: they are read by people,
not sent. A message built from a variable at run time is only as visible
here as its fixed parts; mcp/test_flag_free_messages.mjs runs the real tools
for those.

Run from the repository root, or pass a root.
"""
import ast
import json
import os
import sys

def _quality_modules(node):
    """-> the `quality.X` module names an import statement brings in."""
    names = []
    if isinstance(node, ast.ImportFrom) and node.module:
        if node.module == 'quality':
            names = [a.name for a in node.names]
        elif node.module.startswith('quality.'):
            names = [node.module.split('.')[1]]
    elif isinstance(node, ast.Import):
        names = [a.name.split('.')[1] for a in node.names
                 if a.name.startswith('quality.')]
    return names


def _cmd_test(test):
    """-> (verbs, positive, exact, else_drop) for a test about `cmd`, else None.

    positive: the body runs only when cmd IS one of verbs. exact: the test
    says nothing else, so the `else` branch is the complement too. else_drop:
    for a positive test, the verbs that can never reach its `else` (all of
    them when exact; only the exact parts' of an `or`)."""
    if isinstance(test, ast.UnaryOp) and isinstance(test.op, ast.Not):
        inner = _cmd_test(test.operand)
        # Only an exact test can be complemented: `not (cmd == X and y)`
        # still runs for X whenever y is false.
        if not inner or not inner[2]:
            return None
        return (inner[0], False, True, None) if inner[1] else (inner[0], True, True, inner[0])
    if (isinstance(test, ast.Compare) and isinstance(test.left, ast.Name)
            and test.left.id == 'cmd' and len(test.ops) == 1):
        op, right = test.ops[0], test.comparators[0]
        if isinstance(right, ast.Constant) and isinstance(right.value, str):
            verbs = {right.value}
        elif isinstance(right, (ast.Tuple, ast.List, ast.Set)):
            verbs = {e.value for e in right.elts if isinstance(e, ast.Constant)}
        else:
            return None
        if isinstance(op, (ast.Eq, ast.In)):
            return verbs, True, True, verbs
        if isinstance(op, (ast.NotEq, ast.NotIn)):
            return verbs, False, True, None
        return None
    if isinstance(test, ast.BoolOp):
        parts = [_cmd_test(v) for v in test.values]
        cmd_parts = [p for p in parts if p]
        if not cmd_parts:
            return None
        if isinstance(test.op, ast.Or) and len(cmd_parts) == len(parts) \
                and all(p[1] for p in cmd_parts):
            # Exact only if every part is: `(cmd == X and y) or cmd == Z`
            # can fall to the `else` for X whenever y is false.
            return (set().union(*(p[0] for p in cmd_parts)), True,
                    all(p[2] for p in cmd_parts),
                    set().union(*(p[0] for p in cmd_parts if p[2])))
        if isinstance(test.op, ast.And):
            pos = [p for p in cmd_parts if p[1]]
            if pos:
                verbs = set.intersection(*(p[0] for p in pos))
                for p in cmd_parts:
                    if not p[1]:
                        verbs -= p[0]
                return verbs, True, False, set()
        return None
    return None


def _universe(main):
    verbs = set()
    for n in ast.walk(main):
        t = _cmd_test(n) if isinstance(n, (ast.Compare, ast.BoolOp, ast.UnaryOp)) else None
        if t:
            verbs |= t[0]
    return verbs


def _text(node):
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        left, right = _text(node.left), _text(node.right)
        if left is not None or right is not None:
            return (left if left is not None else '{}') + (right if right is not None else '{}')
        return None
    if isinstance(node, ast.JoinedStr):
        return ''.join(v.value if isinstance(v, ast.Constant) else '{}'
                       for v in node.values)
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def _docstrings(tree):
    out = set()
    for n in ast.walk(tree):
        if isinstance(n, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) \
                and n.body and isinstance(n.body[0], ast.Expr) \
                and isinstance(n.body[0].value, ast.Constant):
            out.add(id(n.body[0].value))
    return out


def scan(path, name, fixed=None, imports=None):
    """-> the strings of one file. `imports`, when given, collects each
    quality module the file imports with the verbs that can reach the import
    (None: any verb)."""
    tree = ast.parse(open(path, encoding='utf-8').read())
    docs = _docstrings(tree)
    out = []

    def emit(node, verbs):
        text = _text(node)
        if text is not None and id(node) not in docs:
            out.append({'file': name, 'line': node.lineno,
                        'verbs': sorted(verbs), 'text': text})
            return True
        return False

    def walk(node, ctx):
        """ctx: the set of verbs that can reach `node`, or None for any."""
        if isinstance(node, ast.IfExp):
            # `a if cmd in (...) else b` narrows its two values the way an
            # `if` narrows its two branches.
            t = _cmd_test(node.test)
            walk(node.test, ctx)
            if t and ctx is not None:
                verbs, positive, exact, else_drop = t
                if positive:
                    body, orelse = ctx & verbs, ctx - else_drop
                else:
                    body, orelse = ctx - verbs, (ctx & verbs if exact else ctx)
            else:
                body = orelse = ctx
            walk(node.body, body)
            walk(node.orelse, orelse)
            return
        if isinstance(node, ast.If):
            t = _cmd_test(node.test)
            walk(node.test, ctx)
            if t and ctx is not None:
                verbs, positive, exact, else_drop = t
                if positive:
                    body, orelse = ctx & verbs, ctx - else_drop
                else:
                    body, orelse = ctx - verbs, (ctx & verbs if exact else ctx)
            else:
                body = orelse = ctx
            for ch in node.body:
                walk(ch, body)
            for ch in node.orelse:
                walk(ch, orelse)
            return
        if imports is not None:
            for mod in _quality_modules(node):
                if ctx is None or imports.get(mod, set()) is None:
                    imports[mod] = None
                else:
                    imports[mod] = imports.get(mod, set()) | ctx
        if emit(node, ['*'] if ctx is None else ctx):
            if isinstance(node, (ast.JoinedStr, ast.BinOp)):
                return
        for ch in ast.iter_child_nodes(node):
            walk(ch, ctx)

    if fixed is not None:
        for top in tree.body:
            walk(top, set(fixed))
        return out
    for top in tree.body:
        if isinstance(top, ast.FunctionDef) and top.name == 'main':
            universe = _universe(top)
            for ch in top.body:
                walk(ch, set(universe))
        else:
            walk(top, None)
    return out


def scan_all(root):
    """-> every string of lyric_harness.py and of every quality module it
    imports, directly or through another quality module. A module's verbs are
    those of the branches that import it (an import outside every branch, or
    in a helper, gives any verb); a module imported by another inherits the
    importer's verbs."""
    imports = {}
    rows = scan(os.path.join(root, 'lyric_harness.py'), 'lyric_harness.py', imports=imports)
    done = {}
    queue = list(imports)
    while queue:
        mod = queue.pop()
        verbs = imports[mod]
        if mod in done and (done[mod] is None or (verbs is not None and verbs <= done[mod])):
            continue
        done[mod] = None if verbs is None or done.get(mod, set()) is None \
            else done.get(mod, set()) | verbs
        path = os.path.join(root, 'quality', mod + '.py')
        if not os.path.exists(path):
            continue
        inner = {}
        scan(path, f'quality/{mod}.py', None if done[mod] is None else done[mod], inner)
        for sub_mod in inner:
            v = done[mod]
            if v is None or imports.get(sub_mod, set()) is None:
                imports[sub_mod] = None
            else:
                imports[sub_mod] = imports.get(sub_mod, set()) | v
            queue.append(sub_mod)
    for mod, verbs in done.items():
        path = os.path.join(root, 'quality', mod + '.py')
        if os.path.exists(path):
            rows += scan(path, f'quality/{mod}.py', verbs)
    return rows


def main(argv):
    root = os.path.join(argv[1] if len(argv) > 1 else '.', 'lyric-harness')
    json.dump(scan_all(root), sys.stdout)


if __name__ == '__main__':
    main(sys.argv)
