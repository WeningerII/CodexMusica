CREATE TABLE `library_sources` (
	`snapshot` text NOT NULL,
	`sha` text NOT NULL,
	`path` text NOT NULL,
	`object_key` text NOT NULL,
	`hash` text NOT NULL,
	PRIMARY KEY(`snapshot`, `sha`)
);
