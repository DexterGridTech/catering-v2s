-- Successful workspace-IAM authentication facts only.  This append-only owner table
-- deliberately stores neither session credentials nor network/client identifiers.
CREATE TABLE workspace_iam.workspace_authentication_history (
    id UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    account_id UUID NOT NULL REFERENCES workspace_iam.workspace_account(id) ON DELETE RESTRICT,
    authenticated_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT fk_workspace_authentication_history_workspace
        FOREIGN KEY (workspace_uuid, group_workspace_key)
        REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key)
);

CREATE INDEX ix_workspace_authentication_history_latest
    ON workspace_iam.workspace_authentication_history
        (workspace_uuid, group_workspace_key, account_id, authenticated_at_epoch_millis DESC, id DESC);
