import re, sys, hashlib
def tests(path):
    lines = open(path).read().split("\n")
    out = {}; i = 0
    while i < len(lines):
        m = re.match(r"^test\((['\"])(.*?)\1", lines[i])
        if m:
            j = i
            while lines[j] != "});": j += 1
            out[m.group(2)] = "\n".join(lines[i:j+1])
            i = j
        i += 1
    return out
def preamble(path):
    t = open(path).read(); k = t.find("\ntest("); return t[:k]
before = tests(sys.argv[1])
after = {}
for p in sys.argv[2:]:
    for k, v in tests(p).items():
        assert k not in after; after[k] = (p.split('/')[-1], v)
print("before", len(before), "after", len(after))
print("same names:", set(before) == set(after))
for k in before:
    f, v = after[k]
    same = v == before[k]
    na = len(re.findall(r"\bassert\.", before[k])); nb = len(re.findall(r"\bassert\.", v))
    print(f"{'IDENTICAL' if same else 'DIFFERENT'}  asserts {na}->{nb}  {f}  {k[:70]}")
# code between tests (helpers) in before file
b = open(sys.argv[1]).read()
for k,v in before.items(): b = b.replace(v, "<<TEST>>")
print("=== non-test code in before (helpers) ===")
print(hashlib.sha256(b.encode()).hexdigest()[:12], len(b.split("\n")), "lines")
open(sys.argv[1]+".nontest","w").write(b)
for p in sys.argv[2:]:
    a = open(p).read()
    for k,v in tests(p).items(): a = a.replace(v, "<<TEST>>")
    open(p+".nontest","w").write(a)
