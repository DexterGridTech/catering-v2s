-- G-06 requires one brand catalog entry per commercial-group name; do not rely on an edge pre-check.
DO $$
DECLARE
    offender_ids TEXT;
BEGIN
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids
    FROM organization.brand
    WHERE (workspace_uuid, group_workspace_key, lower(btrim(name))) IN (
        SELECT workspace_uuid, group_workspace_key, lower(btrim(name))
        FROM organization.brand
        GROUP BY workspace_uuid, group_workspace_key, lower(btrim(name))
        HAVING count(*) > 1
    );
    IF offender_ids IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'R5_BRAND_NAME_DUPLICATE', DETAIL = offender_ids;
    END IF;
END $$;

CREATE UNIQUE INDEX uq_brand_normalized_name
    ON organization.brand (workspace_uuid, group_workspace_key, lower(btrim(name)));
