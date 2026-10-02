CREATE TRIGGER set_logs_no_update BEFORE UPDATE ON set_logs BEGIN SELECT RAISE(ABORT, 'set_logs are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER set_logs_no_delete BEFORE DELETE ON set_logs BEGIN SELECT RAISE(ABORT, 'set_logs are immutable'); END;
