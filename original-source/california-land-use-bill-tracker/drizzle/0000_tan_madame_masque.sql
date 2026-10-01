CREATE TABLE `scan_state` (
	`id` text PRIMARY KEY NOT NULL,
	`checked_at` text NOT NULL,
	`result` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tracked_bills` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`status` text NOT NULL,
	`date` text NOT NULL,
	`chapter` text NOT NULL,
	`impact` text NOT NULL,
	`action` text NOT NULL,
	`url` text NOT NULL,
	`bill_text` text NOT NULL,
	`checked_at` text NOT NULL
);
