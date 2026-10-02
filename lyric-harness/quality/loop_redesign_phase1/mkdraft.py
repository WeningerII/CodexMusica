# Build a fixture draft the way mcp/test.mjs's live block does.
import re, subprocess, sys
seed, lines, out = sys.argv[1], sys.argv[2], sys.argv[3]
rep = subprocess.run([sys.executable, 'lyric_harness.py', 'plan', f'--seed={seed}', f'--lines={lines}'],
                     capture_output=True, text=True).stdout
n = int(re.search(r'-> (\d+) line\(s\)', rep).group(1))
m = re.search(r'RETURNS: (.*)', rep).group(1).strip()
classes = [] if m == '(none)' else [[int(x) for x in g.split(',')] for g in m.split(';')]
bank = 'stone rain door light road name glass train hill salt wire bell coat dust song tide map north paper'.split()
d = [f'we carry the morning to the {bank[i % len(bank)]}' for i in range(n)]
for c in classes:
    for ln in c[1:]: d[ln-1] = d[c[0]-1]
open(out, 'w').write('\n'.join(d) + '\n')
print(n, 'lines; returns', classes)
