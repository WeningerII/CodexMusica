import sys, re
sys.path.insert(0, ".")
import quality.test_propose as tp
from quality.propose import render_line, render_batch
B = tp.B
lines = [f"line number {n} of the draft" for n in range(1, 9)]
def block(text):
    rows = text.split("\n"); out=[]
    for i,r in enumerate(rows):
        if r.strip()=="LINES THAT MUST NOT CHANGE": out.append(rows[i+1])
    return out
cases = {
 "a single, all protected clean": render_line(B(line_no=5, text=lines[4], keep=[1,2,3,4,6,7,8]), lines),
 "b single, some protected noted": render_line(B(line_no=5, text=lines[4], keep=[3]), lines),
 "c single, none clean": render_line(B(line_no=5, text=lines[4], keep=[]), lines),
 "d batch, all others clean": render_batch([B(line_no=5, text=lines[4], keep=[1,2,3,4,6,8]), B(line_no=7, text=lines[6], keep=[1,2,3,4,6,8])], lines),
 "e return group, none clean": render_line(B(line_no=2, text=lines[1], keep=[], return_members=(2,6)), lines),
 "f return group, all others clean": render_line(B(line_no=2, text=lines[1], keep=[1,3,4,5,7,8], return_members=(2,6)), lines),
 "g batch covering all 8 lines": render_batch([B(line_no=n, text=lines[n-1], keep=[]) for n in range(1,9)], lines),
}
for k,v in cases.items():
    print(k); [print("   ", r) for r in sorted(set(block(v)))]
