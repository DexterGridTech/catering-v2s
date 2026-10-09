CREATE TABLE terminal_update.download_grant (
    grant_digest CHAR(64) PRIMARY KEY CHECK (grant_digest ~ '^[0-9a-f]{64}$'),
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    terminal_ref UUID NOT NULL,
    binding_generation BIGINT NOT NULL CHECK (binding_generation > 0),
    store_ref UUID NOT NULL,
    project_ref UUID NOT NULL,
    artifact_ref UUID NOT NULL,
    created_at_epoch_millis BIGINT NOT NULL CHECK (created_at_epoch_millis >= 0),
    expires_at_epoch_millis BIGINT NOT NULL CHECK (expires_at_epoch_millis > created_at_epoch_millis),
    CONSTRAINT fk_terminal_update_download_grant_artifact
      FOREIGN KEY (artifact_ref) REFERENCES terminal_update.artifact (artifact_ref)
);

CREATE INDEX ix_terminal_update_download_grant_binding_expiry
  ON terminal_update.download_grant
  (workspace_uuid, group_workspace_key, terminal_ref, binding_generation, expires_at_epoch_millis);

CREATE INDEX ix_terminal_update_download_grant_expiry
  ON terminal_update.download_grant (expires_at_epoch_millis);
