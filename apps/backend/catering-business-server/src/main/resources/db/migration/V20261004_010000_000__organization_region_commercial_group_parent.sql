DO $$
DECLARE
    invalid_region_ids TEXT;
BEGIN
    SELECT string_agg(region.id::text, ',' ORDER BY region.id::text)
      INTO invalid_region_ids
      FROM organization.organization_node region
      LEFT JOIN platform_workspace.group_workspace workspace
        ON workspace.workspace_uuid = region.workspace_uuid
       AND workspace.group_workspace_key = region.group_workspace_key
      LEFT JOIN organization.commercial_group commercial_group
        ON commercial_group.group_workspace_id = workspace.id
       AND commercial_group.group_workspace_key = workspace.group_workspace_key
     WHERE region.node_type = 'REGION'
       AND (workspace.id IS NULL OR commercial_group.commercial_group_uuid IS NULL
            OR (region.parent_id IS NOT NULL
                AND region.parent_id <> commercial_group.commercial_group_uuid));

    IF invalid_region_ids IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot resolve REGION parent to one same-workspace commercial group; region ids: %',
            invalid_region_ids;
    END IF;
END $$;

UPDATE organization.organization_node region
   SET parent_id = commercial_group.commercial_group_uuid
  FROM platform_workspace.group_workspace workspace
  JOIN organization.commercial_group commercial_group
    ON commercial_group.group_workspace_id = workspace.id
   AND commercial_group.group_workspace_key = workspace.group_workspace_key
 WHERE region.node_type = 'REGION'
   AND region.parent_id IS NULL
   AND workspace.workspace_uuid = region.workspace_uuid
   AND workspace.group_workspace_key = region.group_workspace_key;

ALTER TABLE organization.organization_node
    ADD CONSTRAINT ck_organization_region_parent_required
    CHECK (node_type <> 'REGION' OR parent_id IS NOT NULL);
