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

WHAT A STRING IS. A plain literal, or one f-string read whole, each
interpolation shown as {}. Docstrings are left out: they are read by people,
not sent. A message built from a variable at run time is only as visible
here as its fixed parts; mcp/test_flag_free_messages.mjs runs the real tools
for those.

Run from the repository root, or pass a root.
"""
import ast
import json
import os
import sys

MODULE_VERBS = {
    'quality/revise.py': ['song', 'brief', 'finish', 'revise', 'verify'],
    'quality/recover.py': ['recover'],
}


def _cmd_test(test):
    """-> (verbs, positive, exact) for a test about `cmd`, else None.

    positive: the body runs when cmd IS one of verbs. exact: the test says
    nothing else, so the `else` branch is the complement too."""
    if isinstance(test, ast.UnaryOp) and isinstance(test.op, ast.Not):
        inner = _cmd_test(test.operand)
        return (inner[0], not inner[1], inner[2]) if inner else None
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
            return verbs, True, True
        if isinstance(op, (ast.NotEq, ast.NotIn)):
            return verbs, False, True
        return None
    if isinstance(test, ast.BoolOp):
        parts = [_cmd_test(v) for v in test.values]
        cmd_parts = [p for p in parts if p]
        if not cmd_parts:
            return None
        if isinstance(test.op, ast.Or) and len(cmd_parts) == len(parts) \
                and all(p[1] for p in cmd_parts):
            return set().union(*(p[0] for p in cmd_parts)), True, True
        if isinstance(test.op, ast.And):
            pos = [p for p in cmd_parts if p[1]]
            if pos:
                verbs = set.intersection(*(p[0] for p in pos))
                for p in cmd_parts:
                    if not p[1]:
                        verbs -= p[0]
                return verbs, True, False
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


def scan(path, name, fixed=None):
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
        if isinstance(node, ast.If):
            t = _cmd_test(node.test)
            walk(node.test, ctx)
            if t and ctx is not None:
                verbs, positive, exact = t
                body = ctx & verbs if positive else ctx - verbs
                orelse = (ctx - verbs if positive else ctx & verbs) if exact else ctx
            else:
                body = orelse = ctx
            for ch in node.body:
                walk(ch, body)
            for ch in node.orelse:
                walk(ch, orelse)
            return
        if emit(node, ['*'] if ctx is None else ctx):
            if isinstance(node, ast.JoinedStr):
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


def main(argv):
    root = os.path.join(argv[1] if len(argv) > 1 else '.', 'lyric-harness')
    rows = scan(os.path.join(root, 'lyric_harness.py'), 'lyric_harness.py')
    for p, verbs in MODULE_VERBS.items():
        rows += scan(os.path.join(root, p), p, verbs)
    json.dump(rows, sys.stdout)


if __name__ == '__main__':
    main(sys.argv)
