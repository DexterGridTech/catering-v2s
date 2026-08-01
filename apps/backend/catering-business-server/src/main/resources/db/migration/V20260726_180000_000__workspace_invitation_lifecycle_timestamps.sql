DO $$
DECLARE
    existing_invitation_ids text;
BEGIN
    SELECT string_agg(id::text, ',' ORDER BY id)
      INTO existing_invitation_ids
      FROM workspace_iam.invitation;
    IF existing_invitation_ids IS NOT NULL THEN
        RAISE EXCEPTION 'WORKSPACE_INVITATION_TIMESTAMP_BACKFILL_REQUIRES_EMPTY_INVITATION_TABLE: %', existing_invitation_ids;
    END IF;
END $$;

ALTER TABLE workspace_iam.invitation
    ADD COLUMN created_at_epoch_millis BIGINT NOT NULL,
    ADD COLUMN consented_at_epoch_millis BIGINT,
    ADD COLUMN completed_at_epoch_millis BIGINT,
    ADD COLUMN cancelled_at_epoch_millis BIGINT;
