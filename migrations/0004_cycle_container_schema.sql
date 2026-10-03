PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_cycles` (
	`id` text PRIMARY KEY NOT NULL,
	`program_id` text NOT NULL,
	`current_block_id` text NOT NULL,
	`pass` integer NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_cycles`("id", "program_id", "current_block_id", "pass") SELECT "id", "program_id", "current_block_id", "pass" FROM `cycles`;--> statement-breakpoint
DROP TABLE `cycles`;--> statement-breakpoint
ALTER TABLE `__new_cycles` RENAME TO `cycles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `cycles_program` ON `cycles` (`program_id`);--> statement-breakpoint
CREATE TABLE `__new_workout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`program_id` text NOT NULL,
	`cycle_id` text NOT NULL,
	`pass` integer NOT NULL,
	`training_block_id` text NOT NULL,
	`workout_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_workout_sessions`("id", "profile_id", "program_id", "cycle_id", "pass", "training_block_id", "workout_id", "status", "started_at", "finished_at") SELECT "id", "profile_id", "program_id", "cycle_id", "pass", "training_block_id", "workout_id", "status", "started_at", "finished_at" FROM `workout_sessions`;--> statement-breakpoint
DROP TABLE `workout_sessions`;--> statement-breakpoint
ALTER TABLE `__new_workout_sessions` RENAME TO `workout_sessions`;--> statement-breakpoint
CREATE UNIQUE INDEX `workout_sessions_cycle_pass_block_workout` ON `workout_sessions` (`cycle_id`,`pass`,`training_block_id`,`workout_id`);