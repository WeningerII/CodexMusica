"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/library-client";
import { alignLines, intraLine } from "@/lib/compare-text";
import type { Reading } from "@/lib/library-types";
export function Comparison({
  earlier,
  other,
  snapshot,
  passage = [],
}: {
  earlier: string;
  other: string;
  snapshot: string;
  passage?: string[];
}) {
  const [data, setData] = useState<[Reading, Reading] | null>(null),
    [error, setError] = useState(""),
    [source, setSource] = useState(false),
    [mode, setMode] = useState("Differences"),
    [limit, setLimit] = useState(250);
  useEffect(() => {
    let live = true;
    void Promise.all([
      api<Reading>(`readings/${earlier}?snapshot=${snapshot}&whole=1`),
      api<Reading>(`readings/${other}?snapshot=${snapshot}&whole=1`),
    ])
      .then((r) => live && setData(r))
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [earlier, other, snapshot]);
  const aligned = useMemo(() => {
    if (!data) return [];
    const result = alignLines(
      data[0].lines
        .filter((l) => source || l.analysis_line !== null)
        .map((l) => (source ? l.source_text : l.text)),
      data[1].lines
        .filter((l) => source || l.analysis_line !== null)
        .map((l) => (source ? l.source_text : l.text)),
    );
    if (!passage.length) return result;
    const lines = data[0].lines.filter(
        (l) => source || l.analysis_line !== null,
      ),
      chosen = new Set(
        lines
          .map((l, i) => (passage.includes(l.id) ? i + 1 : 0))
          .filter(Boolean),
      );
    const bounds = [Math.min(...chosen), Math.max(...chosen)];
    let previous = 0;
    return result.filter((row) => {
      if (row.earlier) previous = row.earlier;
      return row.earlier
        ? chosen.has(row.earlier)
        : previous >= bounds[0] && previous < bounds[1];
    });
  }, [data, source, passage]);
  const changed = aligned.filter((l) => l.status !== "same").length;
  if (error)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  if (!data) return <p>Loading both complete reading units…</p>;
  return (
    <section className="text-comparison">
      <div className="button-row">
        <label>
          <input
            type="checkbox"
            checked={source}
            onChange={(e) => setSource(e.target.checked)}
          />
          Source transcription
        </label>
        <span className="state-badge">
          {data[0].work_id === data[1].work_id &&
          data[0].work_reviewed_equivalence === true &&
          data[1].work_reviewed_equivalence === true
            ? "Reviewed work comparison"
            : "Text comparison"}
        </span>
        {passage.length > 0 && (
          <span>Selected earlier passage · {passage.length} lines</span>
        )}
        <span>
          {changed} differing aligned rows / {aligned.length} total
        </span>
      </div>
      <p className="note">
        {source ? "Exact source rows" : "Normalized analysis lines"} ·
        deterministic ordered exact anchors, then positional alignment in
        ambiguous intervals. Work equivalence is not inferred.
      </p>
      <div className="subview-tabs">
        {["Earlier", "Other", "Differences"].map((m) => (
          <button
            key={m}
            className={mode === m ? "active" : ""}
            onClick={() => setMode(m)}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="comparison-headings">
        <h3>{data[0].title}</h3>
        <h3>{data[1].title}</h3>
      </div>
      <div className={`aligned-comparison view-${mode.toLowerCase()}`}>
        {aligned.slice(0, limit).map((l, i) => {
          const diff = intraLine(l.a, l.b);
          return (
            <div key={i} className={"difference-" + l.status}>
              <div dir={data[0].direction}>
                <small>{l.earlier ?? "+"}</small>
                <span lang={data[0].language}>
                  {diff.a[0]}
                  <mark>{l.status === "same" ? "" : diff.a[1]}</mark>
                  {l.status === "same" ? diff.a[1] : ""}
                  {diff.a[2]}
                </span>
              </div>
              <div dir={data[1].direction}>
                <small>{l.other ?? "−"}</small>
                <span lang={data[1].language}>
                  {diff.b[0]}
                  <mark>{l.status === "same" ? "" : diff.b[1]}</mark>
                  {l.status === "same" ? diff.b[1] : ""}
                  {diff.b[2]}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {limit < aligned.length && (
        <button className="button" onClick={() => setLimit(limit + 250)}>
          Show next aligned rows · {limit} / {aligned.length}
        </button>
      )}
    </section>
  );
}
