"use client";
import { useState } from "react";
export type PronunciationChoice = {
  line: string;
  token: number;
  word: string;
  dictionary_readings: {
    phones: string[];
    syllables: number;
    stress: number[];
  }[];
  matching_line_ids: string[];
};
export function PronunciationChoices({
  choices,
  onAdd,
}: {
  choices: PronunciationChoice[];
  onAdd: (row: Record<string, unknown>) => void;
}) {
  const [limit, setLimit] = useState(20),
    [chosen, setChosen] = useState<Record<string, string>>({}),
    [basis, setBasis] = useState("");
  return (
    <details>
      <summary>Choose a sourced English pronunciation</summary>
      <p className="note">
        Choices come from the installed dictionary. A choice binds every
        verbatim occurrence of its exact lyric line. Further evidence pages may
        contain additional words.
      </p>
      <label>
        Source / basis
        <input value={basis} onChange={(e) => setBasis(e.target.value)} />
      </label>
      {choices.slice(0, limit).map((c) => {
        const key = c.line + ":" + c.token;
        return (
          <div className="pronunciation-choice" key={key}>
            <label>
              {c.word} · token {c.token}
              <small>{c.line}</small>
              <select
                value={chosen[key] ?? ""}
                onChange={(e) =>
                  setChosen({ ...chosen, [key]: e.target.value })
                }
              >
                <option value="">All dictionary readings</option>
                {c.dictionary_readings.map((r, j) => (
                  <option key={j} value={j}>
                    {r.phones.join(" ")} · {r.syllables} syllables
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button"
              disabled={
                !basis.trim() || chosen[key] === undefined || chosen[key] === ""
              }
              onClick={() =>
                onAdd({
                  line: c.line,
                  token: c.token,
                  word: c.word,
                  phones: c.dictionary_readings[Number(chosen[key])].phones,
                  basis: "dictionary",
                  source: basis,
                })
              }
            >
              Use this reading
            </button>
            <p className="note">
              Applies to {c.matching_line_ids.length} identical source lines.
            </p>
          </div>
        );
      })}
      {limit < choices.length && (
        <button className="button" onClick={() => setLimit(limit + 20)}>
          Show next dictionary choices · {limit} / {choices.length}
        </button>
      )}
      {!choices.length && (
        <p className="note">
          Analyze the work and load its token evidence to choose a dictionary
          reading. Supplied historical or delivered pronunciations remain
          available in Advanced sourced declarations.
        </p>
      )}
    </details>
  );
}
