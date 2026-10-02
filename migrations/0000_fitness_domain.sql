CREATE TABLE `bodyweight_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`entry_date` text NOT NULL,
	`weight_grams` integer NOT NULL,
	`recorded_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bodyweight_profile_date` ON `bodyweight_entries` (`profile_id`,`entry_date`);--> statement-breakpoint
CREATE TABLE `cycles` (
	`id` text PRIMARY KEY NOT NULL,
	`program_id` text NOT NULL,
	`number` integer NOT NULL,
	`status` text NOT NULL,
	`current_block_number` integer NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cycles_program_number` ON `cycles` (`program_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `cycles_one_active_per_program` ON `cycles` (`program_id`) WHERE status = 'active';--> statement-breakpoint
CREATE TABLE `exercise_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_id` text NOT NULL,
	`position` integer NOT NULL,
	`exercise_id` text NOT NULL,
	`is_optional` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercise_slots_workout_position` ON `exercise_slots` (`workout_id`,`position`);--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_profile_name_key` ON `exercises` (`profile_id`,`name_key`);--> statement-breakpoint
CREATE TABLE `planned_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`exercise_slot_id` text NOT NULL,
	`training_block_id` text NOT NULL,
	`set_number` integer NOT NULL,
	`target_reps` integer NOT NULL,
	`last_weight_grams` integer,
	FOREIGN KEY (`exercise_slot_id`) REFERENCES `exercise_slots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`training_block_id`) REFERENCES `training_blocks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `planned_sets_slot_block_set` ON `planned_sets` (`exercise_slot_id`,`training_block_id`,`set_number`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`account_subject` text NOT NULL,
	`active_program_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`active_program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_account_subject_unique` ON `profiles` (`account_subject`);--> statement-breakpoint
CREATE TABLE `programs` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `set_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`performed_at` integer NOT NULL,
	`set_number` integer NOT NULL,
	`reps` integer NOT NULL,
	`weight_grams` integer,
	`program_id` text NOT NULL,
	`cycle_id` text NOT NULL,
	`training_block_id` text NOT NULL,
	`workout_id` text NOT NULL,
	`exercise_slot_id` text NOT NULL,
	`workout_session_id` text NOT NULL,
	`cycle_number` integer NOT NULL,
	`block_number` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `set_logs_profile_exercise_performed` ON `set_logs` (`profile_id`,`exercise_id`,`performed_at`);--> statement-breakpoint
CREATE TABLE `training_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`program_id` text NOT NULL,
	`position` integer NOT NULL,
	`label` text,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_blocks_program_position` ON `training_blocks` (`program_id`,`position`);--> statement-breakpoint
CREATE TABLE `workout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`program_id` text NOT NULL,
	`cycle_id` text NOT NULL,
	`workout_id` text NOT NULL,
	`cycle_number` integer NOT NULL,
	`block_number` integer NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workout_sessions_cycle_block_workout` ON `workout_sessions` (`cycle_id`,`block_number`,`workout_id`);--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`program_id` text NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workouts_program_position` ON `workouts` (`program_id`,`position`);