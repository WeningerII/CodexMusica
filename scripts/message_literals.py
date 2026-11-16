"""Every string literal the grading tool can send back on a connector verb.

-> JSON on stdout: [{file, line, verbs, text}]. A literal's verbs are the
harness verbs whose `cmd ==` / `cmd in` branch of lyric_harness.py encloses it;
a module the verbs import for their messages is given its verbs whole
(MODULE_VERBS). Docstrings are left out: they are read by people, not sent.
Read by mcp/test_flag_free_messages.mjs, which holds these messages to the
connector's own fields. Run from the repository root, or pass a root.
"""
import ast, json, os, re, sys
CONNECTOR = {'song','brief','finish','revise','verify','recover','screen','types','plan'}
MODULE_VERBS = {'quality/revise.py': {'song','brief','finish','revise','verify'},
                'quality/recover.py': {'recover'}}
def verbs_of(t):
    if isinstance(t, ast.Compare) and isinstance(t.left, ast.Name) and t.left.id == 'cmd':
        r = t.comparators[0]
        if isinstance(r, ast.Constant): return {r.value}
        if isinstance(r, (ast.Tuple, ast.List, ast.Set)): return {e.value for e in r.elts if isinstance(e, ast.Constant)}
    if isinstance(t, ast.BoolOp):
        s = set()
        for v in t.values: s |= verbs_of(v) or set()
        return s or None
    return None
out = []
def scan(path, fixed, name):
    tree = ast.parse(open(path).read())
    docs = set()
    for n in ast.walk(tree):
        if isinstance(n, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and n.body and isinstance(n.body[0], ast.Expr) and isinstance(getattr(n.body[0], 'value', None), ast.Constant):
            docs.add(id(n.body[0].value))
    def walk(node, ctx):
        for field, val in ast.iter_fields(node):
            for ch in (val if isinstance(val, list) else [val]):
                if not isinstance(ch, ast.AST): continue
                c = ctx
                if isinstance(node, ast.If) and field == 'body':
                    v = verbs_of(node.test)
                    if v: c = v
                text = None
                if isinstance(ch, ast.JoinedStr):
                    # One f-string is one message: its fixed parts, with each
                    # interpolation shown as {}.
                    text = ''.join(v.value if isinstance(v, ast.Constant) else '{}'
                                   for v in ch.values)
                elif isinstance(ch, ast.Constant) and isinstance(ch.value, str) and id(ch) not in docs:
                    text = ch.value
                if text is not None:
                    vs = (fixed or c or set()) & CONNECTOR
                    if vs:
                        out.append({'file': name, 'line': ch.lineno, 'verbs': sorted(vs), 'text': text})
                    if isinstance(ch, ast.JoinedStr):
                        continue
                walk(ch, c)
    walk(tree, None)
def main(argv):
    root = os.path.join(argv[1] if len(argv) > 1 else '.', 'lyric-harness')
    scan(os.path.join(root, 'lyric_harness.py'), None, 'lyric_harness.py')
    for p, v in MODULE_VERBS.items():
        scan(os.path.join(root, p), v, p)
    json.dump(out, sys.stdout)


if __name__ == '__main__':
    main(sys.argv)
