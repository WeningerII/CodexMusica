export const readerLenses = [
  { id: "summary", label: "Summary", icon: "Layers" },
  { id: "sound", label: "Sound", icon: "AudioLines" },
  { id: "form", label: "Form", icon: "List" },
  { id: "rhythm", label: "Rhythm", icon: "Music2" },
  { id: "language", label: "Language", icon: "AlignLeft" },
  { id: "sources", label: "Sources", icon: "FileText" },
] as const;

export type ReaderLens = (typeof readerLenses)[number]["id"];
export type CoverageState = "answered" | "refused" | "not_requested";
export type EvidenceBasis =
  | "source"
  | "measured"
  | "reader_declared"
  | "conditional"
  | "research";

export function coverageLabel(state: CoverageState) {
  return state === "answered"
    ? "Answered"
    : state === "refused"
      ? "Cannot tell"
      : "Not requested";
}
