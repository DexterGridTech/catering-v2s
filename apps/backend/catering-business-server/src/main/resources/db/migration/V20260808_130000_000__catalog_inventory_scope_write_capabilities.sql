-- Split the former cross-owner catalog capability into target-scope write capabilities.
-- This runs before role readback checks the new generated authorization catalog.
WITH migrated AS (
    SELECT role.id,
           COALESCE(jsonb_agg(DISTINCT replacement.capability ORDER BY replacement.capability), '[]'::jsonb) AS capability_keys
      FROM workspace_iam.workspace_role role
      LEFT JOIN LATERAL (
          SELECT retained.capability
            FROM jsonb_array_elements_text(role.capability_keys) AS retained(capability)
           WHERE retained.capability NOT IN ('EDIT_CATALOG_LIBRARY', 'READ_INVENTORY_ADVANCED_DIAGNOSTICS')
          UNION
          SELECT granted.capability
            FROM unnest(
                CASE WHEN role.capability_keys ? 'EDIT_CATALOG_LIBRARY' THEN
                    CASE role.service_node_type
                        WHEN 'GROUP' THEN ARRAY['EDIT_HEAD_COMPANY_CATALOG', 'EDIT_STORE_CATALOG', 'EDIT_STORE_INVENTORY']::text[]
                        WHEN 'HEAD_COMPANY' THEN ARRAY['EDIT_HEAD_COMPANY_CATALOG']::text[]
                        WHEN 'REGION' THEN ARRAY['EDIT_STORE_CATALOG', 'EDIT_STORE_INVENTORY']::text[]
                        WHEN 'PROJECT' THEN ARRAY['EDIT_STORE_CATALOG', 'EDIT_STORE_INVENTORY']::text[]
                        WHEN 'STORE' THEN ARRAY['EDIT_STORE_CATALOG', 'EDIT_STORE_INVENTORY']::text[]
                        ELSE ARRAY[]::text[]
                    END
                    ELSE ARRAY[]::text[]
                END
            ) AS granted(capability)
      ) replacement ON TRUE
     WHERE role.capability_keys ?| ARRAY['EDIT_CATALOG_LIBRARY', 'READ_INVENTORY_ADVANCED_DIAGNOSTICS']
     GROUP BY role.id
)
UPDATE workspace_iam.workspace_role role
   SET capability_keys = migrated.capability_keys,
       version = role.version + 1,
       updated_at_epoch_millis = (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint
  FROM migrated
 WHERE role.id = migrated.id;
