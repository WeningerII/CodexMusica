"""PHASE-1 MEASUREMENT DRIVER (scratch; never used to produce a song).
Answers each deferred question mechanically so call cost can be measured
against answers on record. Line answer: the line itself with its last word
swapped for the first OFFERED word in the brief (or kept). Group answer:
each member's current line, unchanged. Usage: drive.py N CALLS TAG"""
import json, re, subprocess, sys, time, os


def main():
    n, calls, tag = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
    S = os.path.dirname(os.path.abspath(__file__))
    st = f"{S}/st_{tag}.json"; draft = f"{S}/d{n}.txt"
    if os.environ.get("PASTE"):
        draft = f"{S}/cp{n}.txt"
        cmd = [sys.executable, "lyric_harness.py", "revise", draft, open(f"{S}/cp{n}.scheme").read(),
               f"--propose=defer:{st}"] + sys.argv[4:]
    else:
        cmd = [sys.executable, "lyric_harness.py", "finish", draft, "--seed=1", f"--lines={n}",
               f"--propose=defer:{st}"] + sys.argv[4:]
    def offered(prompt, line_no):
        seg = prompt.split(f"L{line_no}", 1)[-1]
        m = re.search(r"OFFERED[^\n]*\n\s*(.+)", seg)
        if not m: return None
        w = re.findall(r"[a-z']+", m.group(1))
        return w[0] if w else None
    for k in range(calls):
        t0 = time.time()
        p = subprocess.run(cmd, capture_output=True, text=True, cwd="/home/user/CodexMusica/lyric-harness")
        dt = time.time() - t0
        s = json.load(open(st)) if os.path.exists(st) else {}
        pend = s.get("pending") or {}
        ans = s.get("answered", {})
        nrec = len(ans.get("propose", [])) + len(ans.get("propose_group", []))
        kind = pend.get("kind"); rec = pend.get("record") or {}
        asked = ([r["line"] for r in rec.get("records", [])] if kind == "propose_batch"
                 else rec.get("members") if kind == "propose_group" else [rec.get("line")])
        print(f"{tag}\tcall{k}\trc={p.returncode}\t{dt:.1f}s\tstate={os.path.getsize(st) if os.path.exists(st) else 0}B"
              f"\tout={len(p.stdout)}B\tprompt={len(pend.get('prompt') or '')}B\trecorded={nrec}\tkind={kind}\tasked={asked}", flush=True)
        if p.returncode != 4 or not pend: break
        cur = s.get("accepted_lines") or open(draft).read().splitlines()
        prompt = pend["prompt"]
        def ans_line(ln):
            words = cur[ln-1].split(); w = offered(prompt, ln)
            if w: words[-1] = w
            return " ".join(words)
        if kind == "propose": pend["answer"] = ans_line(rec["line"])
        elif kind == "propose_batch": pend["answer"] = "\n".join(f"L{r['line']}: {ans_line(r['line'])}" for r in rec["records"])
        else: pend["answer"] = "\n".join(f"L{m}: {cur[m-1]}" for m in rec["members"])
        json.dump(s, open(st, "w"), indent=2)


if __name__ == "__main__":
    main()
