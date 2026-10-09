ALTER TABLE terminal_update.project_rule
    DROP CONSTRAINT project_rule_check1,
    ADD CONSTRAINT ck_terminal_update_rule_hot_threshold
        CHECK (
            (hot_artifact_ref IS NULL AND m_seconds IS NULL)
            OR (
                hot_artifact_ref IS NOT NULL
                AND (
                    (hot_strategy = 'IMMEDIATE' AND m_seconds IS NULL)
                    OR (hot_strategy = 'IDLE' AND m_seconds IS NOT NULL)
                )
            )
        );
