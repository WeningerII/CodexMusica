export interface AlignedLine {
  earlier: number | null;
  other: number | null;
  status: "same" | "changed" | "added" | "removed";
  a: string;
  b: string;
}
// Unique exact anchors preserve order; ambiguous intervals retain every row.
// This is deterministic source/text alignment, not a claim of work equivalence.
export function alignLines(a: string[], b: string[]): AlignedLine[] {
  const ca = new Map<string, number[]>(),
    cb = new Map<string, number[]>();
  a.forEach((s, i) => ca.set(s, [...(ca.get(s) ?? []), i]));
  b.forEach((s, i) => cb.set(s, [...(cb.get(s) ?? []), i]));
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < a.length; i++) {
    const aa = ca.get(a[i])!,
      bb = cb.get(a[i]);
    if (a[i].trim() && aa.length === 1 && bb?.length === 1)
      pairs.push([i, bb[0]]);
  }
  const tails: number[] = [],
    prev = new Array<number>(pairs.length).fill(-1);
  for (let i = 0; i < pairs.length; i++) {
    let lo = 0,
      hi = tails.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (pairs[tails[m]][1] < pairs[i][1]) lo = m + 1;
      else hi = m;
    }
    if (lo) prev[i] = tails[lo - 1];
    tails[lo] = i;
  }
  const anchors: Array<[number, number]> = [];
  let at = tails.at(-1) ?? -1;
  while (at >= 0) {
    anchors.push(pairs[at]);
    at = prev[at];
  }
  anchors.reverse();
  anchors.push([a.length, b.length]);
  const output: AlignedLine[] = [];
  let ai = 0,
    bi = 0;
  for (const [ax, bx] of anchors) {
    while (ai < ax || bi < bx) {
      const va = ai < ax ? a[ai] : null,
        vb = bi < bx ? b[bi] : null;
      output.push({
        earlier: va === null ? null : ai + 1,
        other: vb === null ? null : bi + 1,
        status:
          va === null
            ? "added"
            : vb === null
              ? "removed"
              : va === vb
                ? "same"
                : "changed",
        a: va ?? "",
        b: vb ?? "",
      });
      if (va !== null) ai++;
      if (vb !== null) bi++;
    }
    if (ax < a.length && bx < b.length) {
      output.push({
        earlier: ax + 1,
        other: bx + 1,
        status: "same",
        a: a[ax],
        b: b[bx],
      });
      ai = ax + 1;
      bi = bx + 1;
    }
  }
  return output;
}
export function intraLine(a: string, b: string) {
  const aa = Array.from(a),
    bb = Array.from(b);
  let p = 0,
    s = 0;
  while (p < Math.min(aa.length, bb.length) && aa[p] === bb[p]) p++;
  while (
    s < Math.min(aa.length - p, bb.length - p) &&
    aa[aa.length - s - 1] === bb[bb.length - s - 1]
  )
    s++;
  return {
    a: [
      aa.slice(0, p).join(""),
      aa.slice(p, aa.length - s).join(""),
      s ? aa.slice(-s).join("") : "",
    ],
    b: [
      bb.slice(0, p).join(""),
      bb.slice(p, bb.length - s).join(""),
      s ? bb.slice(-s).join("") : "",
    ],
    precision: "exact_codepoint_difference_region",
  };
}
