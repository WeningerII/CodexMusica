import {
  loadObject,
  readingItem,
  reference,
  type LibraryBindings,
  type ReadingItem,
  type Bootstrap,
} from "./library-catalog";
import type { ReadingLine } from "./library-types";
type SearchSpan = {
  search_cp_range: number[];
  normalized_cp_range: number[];
  precision: string;
};
type Transform = {
  normalized_cp_range: number[];
  source_cp_range: number[];
  source_utf16_range: number[];
  byte_range: number[];
  precision: string;
  kind: string;
};
const intersects = (a: number[], b: number[]) => a[0] < b[1] && b[0] < a[1];
async function parts<T>(
  env: LibraryBindings,
  b: Bootstrap,
  item: ReadingItem,
  field: string,
  range: number[],
  bound: "search_cp_range" | "normalized_cp_range",
) {
  const values: T[] = [];
  for (const path of item.reading_chunks?.[field] ?? []) {
    const ref = reference(b, path);
    if (ref[bound] && !intersects(ref[bound]!, range)) continue;
    const part = await loadObject<{ value: T[] }>(
      env,
      b.manifest.snapshot_id,
      ref,
    );
    values.push(
      ...(field === "lines"
        ? part.value.map(
            (v, i) =>
              ({
                ...(v as object),
                catalog_row_offset: (ref.value_range?.[0] ?? 0) + i,
              }) as T,
          )
        : part.value),
    );
  }
  return values;
}
/** Search coordinates come from the recorded case-folding and normalization maps. */
export async function projectSearchHit(
  env: LibraryBindings,
  snapshot: string,
  id: string,
  start: number,
  length: number,
) {
  const { b, item } = await readingItem(env, snapshot, id),
    searchRange = [start, start + length];
  const spans = item.reading_is_header
    ? await parts<SearchSpan>(
        env,
        b,
        item,
        "search.spans",
        searchRange,
        "search_cp_range",
      )
    : (item.reading!.search as { spans: SearchSpan[] }).spans;
  const hits = spans.filter((s) => intersects(s.search_cp_range, searchRange));
  if (!hits.length) return null;
  const normalized = hits.map((s) =>
    s.precision === "exact" &&
    s.search_cp_range[1] - s.search_cp_range[0] ===
      s.normalized_cp_range[1] - s.normalized_cp_range[0]
      ? [
          s.normalized_cp_range[0] + Math.max(start - s.search_cp_range[0], 0),
          s.normalized_cp_range[1] -
            Math.max(s.search_cp_range[1] - searchRange[1], 0),
        ]
      : s.normalized_cp_range,
  );
  const range = [
    Math.min(...normalized.map((r) => r[0])),
    Math.max(...normalized.map((r) => r[1])),
  ];
  const lines = item.reading_is_header
    ? await parts<ReadingLine>(
        env,
        b,
        item,
        "lines",
        range,
        "normalized_cp_range",
      )
    : item.reading!.lines;
  const matching = lines.filter(
    (l) => l.normalized_cp_range && intersects(l.normalized_cp_range, range),
  );
  if (!matching.length) return null;
  const line = matching[0],
    transforms = (line.transformation_spans ?? []) as Transform[],
    sourceRanges = [];
  for (const t of transforms) {
    if (!intersects(t.normalized_cp_range, range) || t.kind === "deleted")
      continue;
    const exact =
      t.precision === "exact" &&
      t.source_cp_range[1] - t.source_cp_range[0] ===
        t.normalized_cp_range[1] - t.normalized_cp_range[0];
    const cp = exact
      ? [
          t.source_cp_range[0] +
            Math.max(range[0] - t.normalized_cp_range[0], 0),
          t.source_cp_range[1] -
            Math.max(t.normalized_cp_range[1] - range[1], 0),
        ]
      : t.source_cp_range;
    const rowStart = (line.source_cp_range as number[])[0],
      chars = Array.from(line.source_text),
      prefix = chars.slice(0, cp[0] - rowStart).join(""),
      value = chars.slice(cp[0] - rowStart, cp[1] - rowStart).join("");
    sourceRanges.push({
      physical_line: line.physical_line,
      codepoint_range: cp,
      utf16_range: [
        (line.source_utf16_range as number[])[0] + prefix.length,
        (line.source_utf16_range as number[])[0] + prefix.length + value.length,
      ],
      byte_range: [
        (line.byte_range as number[])[0] +
          new TextEncoder().encode(prefix).length,
        (line.byte_range as number[])[0] +
          new TextEncoder().encode(prefix + value).length,
      ],
      precision: exact ? "exact" : "span",
    });
  }
  return {
    line_id: line.id,
    line_ids: matching.map((l) => l.id),
    physical_line: line.physical_line,
    row_offset: item.reading_is_header
      ? line.catalog_row_offset
      : item.reading!.lines.findIndex((l) => l.id === line.id),
    normalized_cp_range: range,
    source_ranges: sourceRanges,
    precision:
      hits.every((s) => s.precision === "exact") &&
      sourceRanges.every((s) => s.precision === "exact")
        ? "exact"
        : "span",
    snippet: Array.from(line.source_text).slice(0, 240).join(""),
  };
}
