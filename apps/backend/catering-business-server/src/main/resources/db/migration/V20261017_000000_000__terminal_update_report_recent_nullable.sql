ALTER TABLE terminal_update.terminal_report
    ALTER COLUMN recent DROP NOT NULL;

ALTER TABLE terminal_update.terminal_report
    DROP CONSTRAINT terminal_report_recent_check;

UPDATE terminal_update.terminal_report
SET recent = NULL,
    changed_at_epoch_millis = 0
WHERE task_id IS NULL
  AND recent->>'state' = 'WAITING_USER'
  AND recent->>'reason' = 'NONE';

ALTER TABLE terminal_update.terminal_report
    ADD CONSTRAINT ck_terminal_update_report_recent_shape CHECK (
        (recent IS NULL AND task_id IS NULL)
        OR (recent IS NOT NULL AND jsonb_typeof(recent) = 'object')
    );
