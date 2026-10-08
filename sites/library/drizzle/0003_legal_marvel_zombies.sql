CREATE TABLE `library_deleted_jobs` (
	`id` text NOT NULL,
	`viewer` text NOT NULL,
	`deleted` text NOT NULL,
	PRIMARY KEY(`id`, `viewer`)
);
