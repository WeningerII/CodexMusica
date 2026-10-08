"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/library-client";
import type { ReadingSummary } from "@/lib/library-types";
export function ComparisonPicker({
  id,
  snapshot,
  onChoose,
}: {
  id: string;
  snapshot: string;
  onChoose: (id: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [related, setRelated] = useState<ReadingSummary[]>([]),
    [results, setResults] = useState<ReadingSummary[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void api<ReadingSummary>(`metadata/${id}?snapshot=${snapshot}`)
      .then((r) =>
        api<{ items: ReadingSummary[] }>(
          `search?snapshot=${snapshot}&availability=readable&work=${r.work_id}`,
        ),
      )
      .then(
        (r) =>
          live && setRelated(r.items.filter((r) => r.reading_unit_id !== id)),
      )
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [id, snapshot]);
  useEffect(() => {
    if (!query) return;
    let live = true;
    const timer = setTimeout(
      () =>
        void api<{ items: ReadingSummary[] }>(
          `search?snapshot=${snapshot}&availability=readable&limit=20&q=${encodeURIComponent(query)}`,
        )
          .then(
            (r) =>
              live &&
              setResults(r.items.filter((r) => r.reading_unit_id !== id)),
          )
          .catch((e) => live && setError((e as Error).message)),
      250,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, id, snapshot]);
  return (
    <div className="comparison-picker">
      {related.length > 0 && (
        <>
          <h3>Other readings of this recorded work</h3>
          {related.map((r) => (
            <button
              className="button full-width"
              key={r.reading_unit_id}
              onClick={() => onChoose(r.reading_unit_id)}
            >
              {r.title} · {r.source_path}
            </button>
          ))}
        </>
      )}
      <label>
        Find another readable work
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Title, contributor or exact phrase"
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {query &&
        results.map((r) => (
          <button
            className="button full-width"
            key={r.reading_unit_id}
            onClick={() => onChoose(r.reading_unit_id)}
          >
            {r.title} · {r.source_path}
          </button>
        ))}
    </div>
  );
}
