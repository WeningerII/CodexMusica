import json, sys
K = sys.argv[1]
names = ["base", "695_v1", "0af_v1", "695_v2", "0af_v2"]
D = {n: json.load(open(f"{K}/a/{n}.json")) for n in names}
print("(d) line_anchors(Lexicon, L1) vs relation stream on L1's last token")
print("cell = anchors-last-word/anchor-word|stream: R(read)/U(unread)  -> AGREE or DIS")
for i, r in enumerate(D["base"]["rows"]):
    cells = []
    for n in names:
        rr = D[n]["rows"][i]
        a = rr.get("anchors_first")
        aw = (a[-1][2] if a else None)
        anchored = bool(a)
        last_tok = rr["L1_tokens"][-1] if rr.get("L1_tokens") else None
        stream_read = last_tok not in (rr.get("unread_L1") or []) if last_tok is not None else None
        # boundary-appended endpoints: the token before may be the word
        agree = "AGREE" if anchored == stream_read else "DIS"
        cells.append(f"{n}:{rr.get('anchors_last')!r}/{aw!r}|{'R' if stream_read else 'U'} {agree}")
    print(f"{r['label'][:34]:34s} " + " ; ".join(cells))
