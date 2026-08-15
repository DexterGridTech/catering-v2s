-- Part two: preserve owner-local receipt identity and remove redundant or missing
-- database integrity structures. Historical migrations remain immutable.

-- A workspace UUID denotes one logical group workspace; the existing composite
-- key remains for foreign-key compatibility, while this closes the missing
-- one-to-one invariant at the owner table.
ALTER TABLE platform_workspace.group_workspace
    ADD CONSTRAINT uq_group_workspace_workspace_uuid UNIQUE (workspace_uuid);

-- The platform account projection correlates invitations by the workspace tuple
-- and the account mobile number for each returned row.
CREATE INDEX ix_workspace_iam_invitation_workspace_mobile
    ON workspace_iam.invitation (workspace_uuid, group_workspace_key, mobile_normalized);

-- Password recovery, password reset, account disable and assignment revoke all
-- revoke a user's active sessions through this leading predicate.
CREATE INDEX ix_workspace_iam_session_account_status
    ON workspace_iam.workspace_session (account_id, status);

-- These are strict left prefixes of their corresponding unique identity indexes.
DROP INDEX inventory.ix_stock_target_scope_item_ref;
DROP INDEX inventory.ix_stock_bom_scope_item_ref;

-- Ledger scope remains normalized through its target. A foreign key prevents an
-- orphan ledger entry from escaping that scoped target boundary.
ALTER TABLE inventory.stock_ledger
    ADD CONSTRAINT fk_stock_ledger_target
        FOREIGN KEY (target_ref) REFERENCES inventory.stock_target(target_ref)
        ON DELETE RESTRICT;
