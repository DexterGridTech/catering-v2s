ALTER TABLE terminal_update.project_rule
    ALTER COLUMN hot_strategy DROP NOT NULL;

UPDATE terminal_update.project_rule
   SET hot_strategy = NULL
 WHERE hot_artifact_ref IS NULL;

ALTER TABLE terminal_update.project_rule
    DROP CONSTRAINT ck_terminal_update_rule_hot_threshold,
    ADD CONSTRAINT ck_terminal_update_rule_hot_threshold
        CHECK (
            (hot_artifact_ref IS NULL AND hot_strategy IS NULL AND m_seconds IS NULL)
            OR (
                hot_artifact_ref IS NOT NULL
                AND hot_strategy IS NOT NULL
                AND (
                    (hot_strategy = 'IMMEDIATE' AND m_seconds IS NULL)
                    OR (hot_strategy = 'IDLE' AND m_seconds IS NOT NULL)
                )
            )
        );
