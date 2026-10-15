"""null-and-variants (a): cand vs prev for every case where stdout/state differed but neither refused for a
malformed scheme -- compared again with the build's scorer identity (cursor.scorer, a hash of the scorer's
source files, which differs between builds by construction) and the work-dir path removed."""
import json, re, sys, os
A = "/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/h0af/null-and-variants/a"
recs = json.load(open(A + "/matrix.json"))
SC = {"cand": None, "prev": None}
def scorer_of(state_path):
    try: return json.load(open(state_path)).get("cursor", {}).get("scorer")
    except Exception: return None
def norm_text(t, wk, sc):
    t = t.replace(wk, "<WK>")
    t = re.sub(r"/tmp/finish_bp_[A-Za-z0-9_]+\.json", "BP", t)
    if sc: t = t.replace(sc, "<SCORER>")
    return t
def norm_state(p):
    d = json.load(open(p))
    if isinstance(d.get("cursor"), dict) and "scorer" in d["cursor"]: d["cursor"]["scorer"] = "<SCORER>"
    return d
for n, r in recs.items():
    if r["tree"] != "cand": continue
    pn = n.replace("_cand_", "_prev_", 1); p = recs.get(pn)
    if not p or "is malformed" in r["refusal"] or "is not one this build" in (p["refusal"] or ""): continue
    wkc, wkp = f"{A}/{r['run']}/wk/{n}", f"{A}/{p['run']}/wk/{pn}"
    stfile = next((f for f in ("state.json", "ck.json", "replay.json", "rp.json", "state_new.json", "ck_new.json") if os.path.exists(f"{wkc}/{f}")), None)
    scc = scorer_of(f"{wkc}/{stfile}") if stfile else None
    scp = scorer_of(f"{wkp}/{stfile}") if stfile else None
    tc = norm_text(open(f"{A}/{r['run']}/out/{n}.out").read(), wkc, scc)
    tp = norm_text(open(f"{A}/{p['run']}/out/{pn}.out").read(), wkp, scp)
    sc = norm_state(f"{wkc}/{stfile}") == norm_state(f"{wkp}/{stfile}") if stfile else None
    print(f"{n.replace('_cand',''):36s} stdout_same_mod_scorer={tc == tp!s:5s} state_same_mod_scorer={sc}")
