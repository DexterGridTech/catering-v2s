DO $$
DECLARE
    existing_role_ids TEXT;
BEGIN
    SELECT string_agg(id::text, ',' ORDER BY id) INTO existing_role_ids
    FROM workspace_iam.workspace_role;
    IF existing_role_ids IS NOT NULL THEN
        RAISE EXCEPTION 'WORKSPACE_ROLE_TIMESTAMP_BACKFILL_REQUIRES_EMPTY_ROLE_TABLE: %', existing_role_ids;
    END IF;
END $$;

ALTER TABLE workspace_iam.workspace_role
    ADD COLUMN created_at_epoch_millis BIGINT NOT NULL,
    ADD COLUMN updated_at_epoch_millis BIGINT NOT NULL;
