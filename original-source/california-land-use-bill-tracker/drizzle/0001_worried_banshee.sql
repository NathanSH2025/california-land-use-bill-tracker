CREATE TABLE `bill_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`decision` text NOT NULL,
	`decided_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pending_bills` (
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
