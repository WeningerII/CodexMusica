import json, sys, hashlib
D = sys.argv[1]
names = ["cand_absent","cand_null","cand_v1","cand_v2","cand_v9","cand_null_flagv1","base_absent","base_null"]
def h(x): return hashlib.sha256(json.dumps(x, sort_keys=True).encode()).hexdigest()[:12]
rows = {}
for n in names:
    s = json.load(open(f"{D}/wk/res_{n}.json"))
    p = s.get("pending") or {}
    rec = p.get("record")
    prompt = p.get("prompt","")
    rows[n] = dict(state_rs=s.get("reader_scheme","<absent>"), answered_rs=s["answered"].get("reader_scheme","<absent>"),
                   pending_kind=p.get("kind"), pending_record=h(rec), pending_prompt=hashlib.sha256(prompt.encode()).hexdigest()[:12],
                   accepted=h(s.get("accepted_lines")), answered=h({k:v for k,v in s["answered"].items() if k!="reader_scheme"}),
                   status=s.get("status"), round=s.get("round"))
for n,r in rows.items(): print(n, r)
print()
print("null pending == v2 pending:", rows["cand_null"]["pending_prompt"]==rows["cand_v2"]["pending_prompt"], rows["cand_null"]["pending_record"]==rows["cand_v2"]["pending_record"])
print("null pending == absent(v1) pending:", rows["cand_null"]["pending_prompt"]==rows["cand_absent"]["pending_prompt"])
print("absent pending == base absent pending:", rows["cand_absent"]["pending_prompt"]==rows["base_absent"]["pending_prompt"])
print("base null == base absent:", rows["base_null"]["pending_prompt"]==rows["base_absent"]["pending_prompt"], rows["base_null"]["accepted"]==rows["base_absent"]["accepted"])
print("null_flagv1 == absent:", rows["cand_null_flagv1"]["pending_prompt"]==rows["cand_absent"]["pending_prompt"])
