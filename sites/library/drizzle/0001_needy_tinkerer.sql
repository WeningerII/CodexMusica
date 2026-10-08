CREATE TABLE `library_exports` (
	`id` text PRIMARY KEY NOT NULL,
	`viewer` text NOT NULL,
	`snapshot` text NOT NULL,
	`format` text NOT NULL,
	`state` text NOT NULL,
	`record` text NOT NULL,
	`accessed` text NOT NULL,
	`expires` text NOT NULL,
	`lock_until` integer DEFAULT 0 NOT NULL
);
