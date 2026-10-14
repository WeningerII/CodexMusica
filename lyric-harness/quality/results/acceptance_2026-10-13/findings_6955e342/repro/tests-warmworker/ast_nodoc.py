import ast, sys
def strip(src):
    t = ast.parse(src)
    for n in ast.walk(t):
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Module)) and n.body \
           and isinstance(n.body[0], ast.Expr) and isinstance(getattr(n.body[0], 'value', None), ast.Constant) \
           and isinstance(n.body[0].value.value, str):
            n.body = n.body[1:] or [ast.Pass()]
    return ast.dump(t)
a, b = open(sys.argv[1]).read(), open(sys.argv[2]).read()
print(sys.argv[3], "code-identical-modulo-docstrings" if strip(a) == strip(b) else "CODE DIFFERS")
