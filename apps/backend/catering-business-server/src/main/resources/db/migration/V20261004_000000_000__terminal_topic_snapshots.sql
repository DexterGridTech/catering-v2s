CREATE TABLE organization.terminal_topic_snapshot (
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    store_ref UUID NOT NULL,
    topic_key VARCHAR(40) NOT NULL CHECK (topic_key IN ('SERVICE_POINT_AREA_COLLECTION', 'SERVICE_POINT_COLLECTION')),
    collection_hash CHAR(64) NOT NULL CHECK (collection_hash ~ '^[0-9a-f]{64}$'),
    topic_time_epoch_millis BIGINT NOT NULL CHECK (topic_time_epoch_millis >= 0),
    PRIMARY KEY (workspace_uuid, group_workspace_key, store_ref, topic_key)
);

CREATE TABLE contract.terminal_topic_snapshot (
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    store_ref UUID NOT NULL,
    topic_key VARCHAR(40) NOT NULL CHECK (topic_key = 'VALID_CONTRACT_COLLECTION'),
    collection_hash CHAR(64) NOT NULL CHECK (collection_hash ~ '^[0-9a-f]{64}$'),
    topic_time_epoch_millis BIGINT NOT NULL CHECK (topic_time_epoch_millis >= 0),
    PRIMARY KEY (workspace_uuid, group_workspace_key, store_ref, topic_key)
);

WITH enabled_areas AS (
    SELECT workspace_uuid, group_workspace_key, store_ref,
           string_agg(area_ref::text, E'\n' ORDER BY area_ref::text) AS member_refs,
           max(updated_at_epoch_millis) AS latest_member_time
      FROM organization.store_service_point_area
     WHERE status = 'ENABLED'
     GROUP BY workspace_uuid, group_workspace_key, store_ref
), scopes AS (
    SELECT workspace_uuid, group_workspace_key, id AS store_ref
      FROM organization.store
)
INSERT INTO organization.terminal_topic_snapshot
    (workspace_uuid, group_workspace_key, store_ref, topic_key, collection_hash, topic_time_epoch_millis)
SELECT s.workspace_uuid, s.group_workspace_key, s.store_ref, 'SERVICE_POINT_AREA_COLLECTION',
       encode(sha256(convert_to(coalesce(a.member_refs, ''), 'UTF8')), 'hex'),
       coalesce(a.latest_member_time, 0)
  FROM scopes s
  LEFT JOIN enabled_areas a USING (workspace_uuid, group_workspace_key, store_ref)
UNION ALL
SELECT s.workspace_uuid, s.group_workspace_key, s.store_ref, 'SERVICE_POINT_COLLECTION',
       encode(sha256(convert_to(coalesce(p.member_refs, ''), 'UTF8')), 'hex'),
       coalesce(p.latest_member_time, 0)
  FROM scopes s
  LEFT JOIN (
      SELECT workspace_uuid, group_workspace_key, store_ref,
             string_agg(point_ref::text, E'\n' ORDER BY point_ref::text) AS member_refs,
             max(updated_at_epoch_millis) AS latest_member_time
        FROM organization.store_service_point
       WHERE status = 'ENABLED'
       GROUP BY workspace_uuid, group_workspace_key, store_ref
  ) p USING (workspace_uuid, group_workspace_key, store_ref);

WITH active_contracts AS (
    SELECT workspace_uuid, group_workspace_key, store_id AS store_ref,
           string_agg(id::text, E'\n' ORDER BY id::text) AS member_refs,
           max(updated_at_epoch_millis) AS latest_member_time
      FROM contract.store_contract
     WHERE status = 'ACTIVE'
     GROUP BY workspace_uuid, group_workspace_key, store_id
)
INSERT INTO contract.terminal_topic_snapshot
    (workspace_uuid, group_workspace_key, store_ref, topic_key, collection_hash, topic_time_epoch_millis)
SELECT s.workspace_uuid, s.group_workspace_key, s.id, 'VALID_CONTRACT_COLLECTION',
       encode(sha256(convert_to(coalesce(c.member_refs, ''), 'UTF8')), 'hex'),
       coalesce(c.latest_member_time, 0)
  FROM organization.store s
  LEFT JOIN active_contracts c
    ON c.workspace_uuid = s.workspace_uuid
   AND c.group_workspace_key = s.group_workspace_key
   AND c.store_ref = s.id;

CREATE FUNCTION organization.read_terminal_topic_time(
    p_workspace_uuid UUID,
    p_group_workspace_key VARCHAR,
    p_store_ref UUID,
    p_topic_key VARCHAR,
    p_owner_ref UUID
)
RETURNS TABLE (topic_time_epoch_millis BIGINT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    WITH bound_store AS (
        SELECT s.id, s.project_id, project.parent_id AS region_ref,
               region.parent_id AS commercial_group_ref
          FROM organization.store s
          JOIN organization.organization_node project
            ON project.id = s.project_id AND project.node_type = 'PROJECT'
           AND project.workspace_uuid = s.workspace_uuid AND project.group_workspace_key = s.group_workspace_key
          JOIN organization.organization_node region
            ON region.id = project.parent_id AND region.node_type = 'REGION'
           AND region.workspace_uuid = s.workspace_uuid AND region.group_workspace_key = s.group_workspace_key
         WHERE s.id = p_store_ref AND s.workspace_uuid = p_workspace_uuid
           AND s.group_workspace_key = p_group_workspace_key
    )
    SELECT s.updated_at_epoch_millis
      FROM organization.store s
     WHERE p_topic_key IN ('STORE', 'STORE_OPERATING_RULE')
       AND s.id = p_owner_ref AND s.id = p_store_ref
       AND s.workspace_uuid = p_workspace_uuid AND s.group_workspace_key = p_group_workspace_key
    UNION ALL
    SELECT n.updated_at_epoch_millis
      FROM organization.organization_node n
      JOIN bound_store bs ON bs.project_id = n.id
     WHERE p_topic_key IN ('PROJECT', 'REGION')
       AND n.id = p_owner_ref AND n.workspace_uuid = p_workspace_uuid AND n.group_workspace_key = p_group_workspace_key
       AND p_topic_key = 'PROJECT' AND n.node_type = 'PROJECT'
    UNION ALL
    SELECT n.updated_at_epoch_millis
      FROM organization.organization_node n
      JOIN bound_store bs ON bs.region_ref = n.id
     WHERE p_topic_key = 'REGION' AND n.id = p_owner_ref
       AND n.workspace_uuid = p_workspace_uuid AND n.group_workspace_key = p_group_workspace_key
       AND n.node_type = 'REGION'
    UNION ALL
    SELECT cg.updated_at_epoch_millis
      FROM organization.commercial_group cg
      JOIN platform_workspace.group_workspace gw ON gw.group_workspace_key = cg.group_workspace_key
      JOIN bound_store bs ON bs.commercial_group_ref = cg.commercial_group_uuid
     WHERE p_topic_key = 'COMMERCIAL_GROUP'
       AND cg.commercial_group_uuid = p_owner_ref AND cg.group_workspace_key = p_group_workspace_key
       AND gw.workspace_uuid = p_workspace_uuid
    UNION ALL
    SELECT a.updated_at_epoch_millis
      FROM organization.store_service_point_area a
     WHERE p_topic_key = 'SERVICE_POINT_AREA'
       AND a.area_ref = p_owner_ref AND a.store_ref = p_store_ref
       AND a.workspace_uuid = p_workspace_uuid AND a.group_workspace_key = p_group_workspace_key
    UNION ALL
    SELECT p.updated_at_epoch_millis
      FROM organization.store_service_point p
     WHERE p_topic_key = 'SERVICE_POINT'
       AND p.point_ref = p_owner_ref AND p.store_ref = p_store_ref
       AND p.workspace_uuid = p_workspace_uuid AND p.group_workspace_key = p_group_workspace_key
$$;

CREATE FUNCTION contract.read_terminal_topic_time(
    p_workspace_uuid UUID,
    p_group_workspace_key VARCHAR,
    p_store_ref UUID,
    p_topic_key VARCHAR,
    p_owner_ref UUID
)
RETURNS TABLE (topic_time_epoch_millis BIGINT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    SELECT c.updated_at_epoch_millis
      FROM contract.store_contract c
     WHERE p_topic_key = 'CONTRACT'
       AND c.id = p_owner_ref AND c.store_id = p_store_ref
       AND c.workspace_uuid = p_workspace_uuid AND c.group_workspace_key = p_group_workspace_key
$$;

REVOKE ALL ON FUNCTION organization.read_terminal_topic_time(UUID, VARCHAR, UUID, VARCHAR, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION contract.read_terminal_topic_time(UUID, VARCHAR, UUID, VARCHAR, UUID) FROM PUBLIC;
