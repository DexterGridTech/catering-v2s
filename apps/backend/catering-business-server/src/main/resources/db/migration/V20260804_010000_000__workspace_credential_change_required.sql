-- Owner state for platform-initiated operations-account credential reset.
-- The old generation-key reset flow is retired; self-service operations recovery remains separate.
ALTER TABLE workspace_iam.workspace_credential
    ADD COLUMN password_change_required BOOLEAN NOT NULL DEFAULT FALSE;

DROP TABLE workspace_iam.password_reset_progress;
DROP TABLE workspace_iam.password_reset;
