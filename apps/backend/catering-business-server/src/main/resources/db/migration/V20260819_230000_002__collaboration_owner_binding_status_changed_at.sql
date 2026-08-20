-- Owner binding status history is a distinct fact from mutable display/owner edits.
ALTER TABLE collaboration.owner_binding
    ADD COLUMN status_changed_at_epoch_millis BIGINT;

-- The initial owner table had no status-transition timestamp. For existing rows,
-- binding creation is the only recoverable status fact; new transitions are
-- written by CollaborationOwnerService and no longer reuse updated_at.
UPDATE collaboration.owner_binding
   SET status_changed_at_epoch_millis = created_at_epoch_millis
 WHERE status_changed_at_epoch_millis IS NULL;

ALTER TABLE collaboration.owner_binding
    ALTER COLUMN status_changed_at_epoch_millis SET NOT NULL;
