DROP INDEX `checkins_user_id_date_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_checkins_user_date_live` ON `checkins` (`user_id`,`date`) WHERE deleted_at IS NULL;--> statement-breakpoint
DROP INDEX `diary_entries_user_id_date_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_diary_user_date_live` ON `diary_entries` (`user_id`,`date`) WHERE deleted_at IS NULL;--> statement-breakpoint
DROP INDEX `habit_logs_habit_id_date_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_habit_logs_habit_date_live` ON `habit_logs` (`habit_id`,`date`) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX `idx_habit_logs_user_date` ON `habit_logs` (`user_id`,`date`);--> statement-breakpoint
DROP INDEX `monthly_reviews_user_id_year_month_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_reviews_user_month_live` ON `monthly_reviews` (`user_id`,`year`,`month`) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX `idx_assignments_user_due` ON `assignments` (`user_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `idx_followups_user_next_date` ON `client_followups` (`user_id`,`next_followup_date`);--> statement-breakpoint
CREATE INDEX `idx_action_items_user_deadline` ON `meeting_action_items` (`user_id`,`deadline`);--> statement-breakpoint
CREATE INDEX `idx_meetings_user_date` ON `meetings` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_reminders_status_trigger` ON `reminders` (`status`,`trigger_at`);--> statement-breakpoint
CREATE INDEX `idx_standups_member_date` ON `standups` (`team_member_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_tasks_user_date` ON `tasks` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_tasks_user_status` ON `tasks` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_date` ON `transactions` (`user_id`,`date`);