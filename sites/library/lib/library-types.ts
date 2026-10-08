import type { EvidenceKind, Precision, Namespace } from "./reader-contract";
export type JSONValue =
  | null
  | boolean
  | number
  | string
  | JSONValue[]
  | { [key: string]: JSONValue };
export type Data = { [key: string]: JSONValue };
export type Availability =
  | "readable"
  | "metadata_only"
  | "held"
  | "rejected"
  | "research_only";
export interface Collection {
  collection_id: string;
  title: string;
  language: string;
  source_path: string;
  reading_unit_ids: string[];
  readable_reading_unit_ids: string[];
}
export interface ReadingSummary {
  reading_unit_id: string;
  reading_revision: string;
  work_id: string;
  edition_id: string;
  collection_ids: string[];
  title: string;
  language: string;
  direction: "ltr" | "rtl";
  availability: Availability;
  completeness: string;
  source_path: string;
  source_sha256: string;
  normalized_sha256: string;
  path: string;
  lines: number;
  contributor_search?: string;
  source_search?: string;
  title_search: string;
  work_reviewed_equivalence?: boolean;
  work_equivalence_basis?: Data;
  source_basis?: Data;
  whole_source_availability?: string;
  refusal?: string;
  availability_reason?: Data;
  snippet?: string;
  search_hit?: Data;
}
export interface SourceRange {
  physical_line?: number;
  codepoint_range?: number[];
  utf16_range?: number[];
  byte_range?: number[];
  precision: Precision;
}
export interface ReadingLine {
  id: string;
  text: string;
  source_text: string;
  kind: string;
  physical_line: number;
  analysis_line: number | null;
  indent: number;
  terminator: string;
  source_ranges: SourceRange[];
  normalized_cp_range: number[] | null;
  normalized_utf16_range: number[] | null;
  [key: string]: unknown;
}
export interface Reading {
  snapshot_id: string;
  reading_unit_id: string;
  reading_revision: string;
  work_id: string;
  edition_id: string;
  title: string;
  language: string;
  direction: "ltr" | "rtl";
  availability: Availability;
  completeness: string;
  collection_ids: string[];
  source_path: string;
  source_sha256: string;
  normalized_sha256: string;
  normalized_text: string;
  source_text: string;
  lines: ReadingLine[];
  contributors: { name: string; role: string; basis: string }[];
  metadata: Record<string, string[]>;
  rights: Data;
  source_marks: Data[];
  source_map: Data;
  [key: string]: unknown;
}
export interface Catalog {
  collections: Collection[];
  works?: {
    work_id: string;
    title: string;
    reviewed_equivalence: boolean;
    reading_unit_ids: string[];
  }[];
  editions?: {
    edition_id: string;
    source_path: string;
    reading_unit_ids: string[];
  }[];
  readings?: ReadingSummary[];
}
export interface Manifest {
  schema_version: number;
  snapshot_id: string;
  repository_commit: string;
  counts: Record<string, number | Record<string, number>>;
  parser_version: string;
  normalizer_version: string;
  [key: string]: unknown;
}
export interface Method {
  id: string;
  namespace: Namespace;
  name: string;
  aliases?: string[];
  definition?: string;
  normative?: string;
  required_capabilities?: string[];
  pair_local?: boolean;
  scope?: string;
  language?: string;
  remedies?: Record<string, string>;
  figure?: Data;
  channels?: Data[];
  provenance?: Data;
  scopes?: Record<string, unknown>;
  [key: string]: unknown;
}
export interface Registry {
  contract_version: number;
  registry_hash: string;
  counts: Record<string, number>;
  methods: Method[];
  profiles: { language: string; declaration: Data }[];
  capabilities: string[];
}
export interface Evidence {
  id: string;
  kind: EvidenceKind;
  method_id?: string;
  namespace?: string;
  line_ids?: string[];
  source_ranges?: SourceRange[];
  verdict?: "true" | "false" | "undecided";
  coverage?: string;
  basis?: string;
  [key: string]: unknown;
}
export interface ReaderJob {
  id: string;
  state: string;
  identity: Data;
  attempt: number;
  generation: number;
  progress: Data;
  coverage?: Data;
  manifest_hash?: string;
  reason?: Data | string;
  expires_at: string;
  [key: string]: unknown;
}
export interface ResultManifest {
  manifest_hash?: string;
  version: number;
  job_id: string;
  identity: Data;
  identity_hash: string;
  generation: number;
  partial: boolean;
  page_count: number;
  evidence_count: number;
  summary?: Data;
  coverage?: Data;
  provider_calls: number;
}
export const languageNames: Record<string, string> = {
  eng: "English",
  fas: "Persian",
  fin: "Finnish",
  cym: "Welsh",
  non: "Old Norse",
  ltc: "Middle Chinese",
  msa: "Malay",
  san: "Sanskrit",
  som: "Somali",
};
