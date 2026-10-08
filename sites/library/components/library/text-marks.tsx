import type { Evidence, ReadingLine } from "@/lib/library-types";
export function TextMarks({
  line,
  record,
  source,
}: {
  line: ReadingLine;
  record: Evidence | null;
  source: boolean;
}) {
  const text = source ? line.source_text : line.text,
    chars = Array.from(text),
    base = source
      ? (line.source_cp_range as number[] | undefined)?.[0]
      : line.normalized_cp_range?.[0];
  if (!record || base === undefined) return <>{text || "\u00a0"}</>;
  const ranges: { start: number; end: number; precision: string }[] = [];
  function add(value: unknown) {
    if (!value || typeof value !== "object") return;
    const range = value as {
      codepoint_range?: number[];
      precision?: string;
      parts?: unknown[];
    };
    if (range.parts?.length) {
      range.parts.forEach(add);
      return;
    }
    if (!range.codepoint_range) return;
    const [start, end] = range.codepoint_range.map((n) => n - base!);
    if (end > 0 && start < chars.length && end > start)
      ranges.push({
        start: Math.max(0, start),
        end: Math.min(chars.length, end),
        precision: range.precision ?? (source ? "span" : "exact"),
      });
  }
  function walk(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (
        key === (source ? "source_ranges" : "normalized_ranges") &&
        Array.isArray(child)
      )
        child.forEach(add);
      else if (!source && key === "normalized_range") add(child);
      else if (!source && key === "normalized_cp_range" && Array.isArray(child))
        add({ codepoint_range: child });
      else if (
        ![
          "source_ranges",
          "normalized_ranges",
          "normalized_range",
          "normalized_cp_range",
        ].includes(key)
      )
        walk(child);
    }
  }
  walk(record);
  if (!ranges.length) return <>{text || "\u00a0"}</>;
  const points = Array.from(
    new Set([0, chars.length, ...ranges.flatMap((r) => [r.start, r.end])]),
  ).sort((a, b) => a - b);
  return (
    <>
      {points.slice(0, -1).map((start, i) => {
        const end = points[i + 1],
          hits = ranges.filter((r) => r.start < end && r.end > start),
          value = chars.slice(start, end).join("");
        return hits.length ? (
          <mark
            key={start}
            className={
              hits.every((r) => r.precision === "exact")
                ? "exact-text-mark"
                : "mapped-text-mark"
            }
            title={
              hits.every((r) => r.precision === "exact")
                ? "Exact recorded span"
                : "Mapped source span; character precision is not asserted"
            }
          >
            {value}
          </mark>
        ) : (
          <span key={start}>{value}</span>
        );
      })}
    </>
  );
}
