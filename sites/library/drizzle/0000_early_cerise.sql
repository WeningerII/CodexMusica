CREATE TABLE `library_active` (
	`slot` integer PRIMARY KEY NOT NULL,
	`snapshot` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `library_imports` (
	`snapshot` text NOT NULL,
	`chunk` integer NOT NULL,
	`hash` text NOT NULL,
	PRIMARY KEY(`snapshot`, `chunk`)
);
--> statement-breakpoint
CREATE TABLE `library_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`viewer` text NOT NULL,
	`capability` text NOT NULL,
	`idempotency` text NOT NULL,
	`request_hash` text NOT NULL,
	`record` text NOT NULL,
	`accessed` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_job_retry` ON `library_jobs` (`viewer`,`idempotency`);--> statement-breakpoint
CREATE TABLE `library_readings` (
	`snapshot` text NOT NULL,
	`id` text NOT NULL,
	`revision` text NOT NULL,
	`work` text NOT NULL,
	`edition` text NOT NULL,
	`title` text NOT NULL,
	`language` text NOT NULL,
	`contributor` text NOT NULL,
	`collections` text NOT NULL,
	`availability` text NOT NULL,
	`completeness` text NOT NULL,
	`body` text NOT NULL,
	`metadata` text NOT NULL,
	`object_key` text,
	`hash` text,
	PRIMARY KEY(`snapshot`, `id`)
);
--> statement-breakpoint
CREATE INDEX `library_language` ON `library_readings` (`snapshot`,`language`);--> statement-breakpoint
CREATE INDEX `library_work` ON `library_readings` (`snapshot`,`work`);--> statement-breakpoint
CREATE TABLE `library_receipts` (
	`key` text PRIMARY KEY NOT NULL,
	`hash` text NOT NULL,
	`job` text,
	`viewer` text,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `library_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`manifest` text NOT NULL,
	`imported` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE VIRTUAL TABLE library_search USING fts5(snapshot UNINDEXED, unit UNINDEXED, title, contributor, body, tokenize='unicode61 remove_diacritics 0');
