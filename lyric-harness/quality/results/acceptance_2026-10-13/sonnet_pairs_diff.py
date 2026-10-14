import json, sys
def bucket(k):
    for lo, hi in ((3, 4), (5, 8), (9, 16), (17, None)):
        if k >= lo and (hi is None or k <= hi): return f"k={lo}-{hi}" if hi else f"k={lo}+"
    return f"below(k={k})"
b, h = (json.load(open(p)) for p in sys.argv[1:3])
B = {tuple(x[:5]): x[5] for x in b["admitted"]}; H = {tuple(x[:5]): x[5] for x in h["admitted"]}
print("base admitted", len(B), "head admitted", len(H))
for key in sorted(set(B) - set(H)): print("LEFT ", bucket(B[key]), key[:3], "|", key[3][-45:], "||", key[4][-45:])
for key in sorted(set(H) - set(B)): print("JOINED", bucket(H[key]), key[:3], "|", key[3][-45:], "||", key[4][-45:])
moved = [(key, B[key], H[key]) for key in set(B) & set(H) if bucket(B[key]) != bucket(H[key])]
print("bucket moves", len(moved))
for key, kb, kh in sorted(moved): print("MOVED", bucket(kb), "->", bucket(kh), key[:3], "|", key[3][-40:], "||", key[4][-40:])
