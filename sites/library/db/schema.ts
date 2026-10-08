import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const snapshots = sqliteTable("library_snapshots", {
  id: text("id").primaryKey(),
  state: text("state").notNull(),
  manifest: text("manifest").notNull(),
  imported: integer("imported").notNull().default(0),
  total: integer("total").notNull(),
  created: text("created").notNull(),
});
export const active = sqliteTable("library_active", {
  slot: integer("slot").primaryKey(),
  snapshot: text("snapshot").notNull(),
});
export const imports = sqliteTable(
  "library_imports",
  {
    snapshot: text("snapshot").notNull(),
    chunk: integer("chunk").notNull(),
    hash: text("hash").notNull(),
  },
  (t) => [primaryKey({ columns: [t.snapshot, t.chunk] })],
);
export const readings = sqliteTable(
  "library_readings",
  {
    snapshot: text("snapshot").notNull(),
    id: text("id").notNull(),
    revision: text("revision").notNull(),
    work: text("work").notNull(),
    edition: text("edition").notNull(),
    title: text("title").notNull(),
    language: text("language").notNull(),
    contributor: text("contributor").notNull(),
    collections: text("collections").notNull(),
    availability: text("availability").notNull(),
    completeness: text("completeness").notNull(),
    body: text("body").notNull(),
    metadata: text("metadata").notNull(),
    objectKey: text("object_key"),
    hash: text("hash"),
  },
  (t) => [
    primaryKey({ columns: [t.snapshot, t.id] }),
    index("library_language").on(t.snapshot, t.language),
    index("library_work").on(t.snapshot, t.work),
  ],
);
export const jobs = sqliteTable(
  "library_jobs",
  {
    id: text("id").primaryKey(),
    viewer: text("viewer").notNull(),
    capability: text("capability").notNull(),
    idempotency: text("idempotency").notNull(),
    requestHash: text("request_hash").notNull(),
    record: text("record").notNull(),
    accessed: text("accessed").notNull(),
  },
  (t) => [uniqueIndex("library_job_retry").on(t.viewer, t.idempotency)],
);
export const receipts = sqliteTable("library_receipts", {
  key: text("key").primaryKey(),
  hash: text("hash").notNull(),
  job: text("job"),
  viewer: text("viewer"),
  created: text("created").notNull(),
});
export const exportsTable = sqliteTable("library_exports", {
  id: text("id").primaryKey(),
  viewer: text("viewer").notNull(),
  snapshot: text("snapshot").notNull(),
  format: text("format").notNull(),
  state: text("state").notNull(),
  record: text("record").notNull(),
  accessed: text("accessed").notNull(),
  expires: text("expires").notNull(),
  lockUntil: integer("lock_until").notNull().default(0),
});
export const sources = sqliteTable(
  "library_sources",
  {
    snapshot: text("snapshot").notNull(),
    sha: text("sha").notNull(),
    path: text("path").notNull(),
    objectKey: text("object_key").notNull(),
    hash: text("hash").notNull(),
  },
  (t) => [primaryKey({ columns: [t.snapshot, t.sha] })],
);

export const deletedJobs = sqliteTable(
  "library_deleted_jobs",
  {
    id: text("id").notNull(),
    viewer: text("viewer").notNull(),
    deleted: text("deleted").notNull(),
  },
  (t) => [primaryKey({ columns: [t.id, t.viewer] })],
);
