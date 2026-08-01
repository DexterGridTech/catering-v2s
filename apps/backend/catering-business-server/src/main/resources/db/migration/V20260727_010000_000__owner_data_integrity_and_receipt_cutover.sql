-- CR04 additive cutover. Historical migrations remain byte-for-byte unchanged.

CREATE OR REPLACE FUNCTION contract.valid_store_contract_items(value JSONB)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT jsonb_typeof(value) = 'array'
       AND jsonb_array_length(value) > 0
       AND NOT EXISTS (
            SELECT 1
              FROM jsonb_array_elements(value) item
             WHERE jsonb_typeof(item) <> 'object'
                OR item - ARRAY['code', 'name']::TEXT[] <> '{}'::jsonb
                OR jsonb_typeof(item->'code') <> 'string'
                OR jsonb_typeof(item->'name') <> 'string'
                OR btrim(item->>'code') = ''
                OR btrim(item->>'name') = ''
                OR length(btrim(item->>'code')) > 120
                OR length(btrim(item->>'name')) > 240
       )
       AND (
            SELECT count(*) = count(DISTINCT lower(btrim(item->>'code')))
              FROM jsonb_array_elements(value) item
       );
$$;

ALTER TABLE contract.store_contract ADD COLUMN items_json JSONB;

DO $$
DECLARE offender_ids TEXT;
BEGIN
    SELECT string_agg(contract_id::text, ',' ORDER BY contract_id::text)
      INTO offender_ids
      FROM (
          SELECT contract_id
            FROM contract.store_contract_item
           GROUP BY contract_id, lower(btrim(item_code))
          HAVING count(*) > 1
          UNION
          SELECT contract_id
            FROM contract.store_contract_item
           WHERE btrim(item_code) = '' OR length(btrim(item_code)) > 120
              OR btrim(item_name) = '' OR length(btrim(item_name)) > 240
      ) invalid;
    IF offender_ids IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_CONTRACT_ITEMS_PRECONDITION_FAILED', DETAIL=offender_ids;
    END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text)
      INTO offender_ids
      FROM contract.store_contract contract_row
     WHERE NOT EXISTS (SELECT 1 FROM contract.store_contract_item item WHERE item.contract_id=contract_row.id);
    IF offender_ids IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_CONTRACT_ITEMS_EMPTY_PRECONDITION_FAILED', DETAIL=offender_ids;
    END IF;
END $$;

UPDATE contract.store_contract contract_row
   SET items_json = (
       SELECT jsonb_agg(jsonb_build_object('code', btrim(item_code), 'name', btrim(item_name)) ORDER BY line_no)
         FROM contract.store_contract_item item
        WHERE item.contract_id=contract_row.id
   );

ALTER TABLE contract.store_contract
    ALTER COLUMN items_json SET NOT NULL,
    ADD CONSTRAINT ck_store_contract_items_json_valid CHECK (contract.valid_store_contract_items(items_json));

DO $$
DECLARE mismatch_ids TEXT;
BEGIN
    SELECT string_agg(contract_row.id::text, ',' ORDER BY contract_row.id::text)
      INTO mismatch_ids
      FROM contract.store_contract contract_row
     WHERE jsonb_array_length(contract_row.items_json) <>
           (SELECT count(*) FROM contract.store_contract_item item WHERE item.contract_id=contract_row.id);
    IF mismatch_ids IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_CONTRACT_ITEMS_PARITY_FAILED', DETAIL=mismatch_ids;
    END IF;
END $$;

DROP TABLE contract.store_contract_item;

ALTER TABLE extension.extension_definition ADD COLUMN workspace_uuid UUID;
UPDATE extension.extension_definition definition
   SET workspace_uuid = workspace.workspace_uuid
  FROM platform_workspace.group_workspace workspace
 WHERE workspace.group_workspace_key=definition.group_workspace_key;

DO $$
DECLARE offender_keys TEXT;
BEGIN
    SELECT string_agg(group_workspace_key || ':' || entity_type, ',' ORDER BY group_workspace_key, entity_type)
      INTO offender_keys
      FROM extension.extension_definition
     WHERE workspace_uuid IS NULL;
    IF offender_keys IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_EXTENSION_WORKSPACE_PRECONDITION_FAILED', DETAIL=offender_keys;
    END IF;
    SELECT string_agg(idempotency_key, ',' ORDER BY idempotency_key)
      INTO offender_keys
      FROM extension.extension_command_receipt
     WHERE TRUE;
    IF offender_keys IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_EXTENSION_RECEIPT_LEGACY_PRECONDITION_FAILED', DETAIL=offender_keys;
    END IF;
END $$;

ALTER TABLE extension.extension_definition
    ALTER COLUMN workspace_uuid SET NOT NULL,
    ADD CONSTRAINT uq_extension_definition_workspace_entity UNIQUE (workspace_uuid, group_workspace_key, entity_type),
    ADD CONSTRAINT fk_extension_definition_workspace FOREIGN KEY (workspace_uuid, group_workspace_key)
        REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key);

ALTER TABLE extension.extension_command_receipt
    DROP COLUMN definition_id,
    ADD COLUMN workspace_uuid UUID NOT NULL,
    ADD COLUMN group_workspace_key VARCHAR(64) NOT NULL,
    ADD COLUMN entity_type VARCHAR(32) NOT NULL,
    ADD CONSTRAINT fk_extension_receipt_definition FOREIGN KEY (workspace_uuid, group_workspace_key, entity_type)
        REFERENCES extension.extension_definition(workspace_uuid, group_workspace_key, entity_type),
    ADD CONSTRAINT ck_extension_receipt_response_object CHECK (jsonb_typeof(response_json)='object');

DO $$
DECLARE offender_keys TEXT;
BEGIN
    SELECT string_agg(idempotency_key, ',' ORDER BY idempotency_key)
      INTO offender_keys
      FROM platform_asset.asset_command_receipt
     WHERE asset_ref IS NULL
        OR NOT EXISTS (SELECT 1 FROM platform_asset.staged_asset asset WHERE asset.asset_ref=asset_command_receipt.asset_ref);
    IF offender_keys IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_ASSET_RECEIPT_ORPHAN_PRECONDITION_FAILED', DETAIL=offender_keys;
    END IF;
    SELECT string_agg(idempotency_key, ',' ORDER BY idempotency_key)
      INTO offender_keys
      FROM platform_asset.asset_command_receipt
     WHERE response_json ? 'bindGrant';
    IF offender_keys IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_ASSET_RECEIPT_SECRET_PRECONDITION_FAILED', DETAIL=offender_keys;
    END IF;
END $$;

ALTER TABLE platform_asset.asset_command_receipt
    ALTER COLUMN asset_ref SET NOT NULL,
    ADD CONSTRAINT fk_asset_receipt_asset FOREIGN KEY (asset_ref) REFERENCES platform_asset.staged_asset(asset_ref),
    ADD CONSTRAINT ck_asset_receipt_response_no_bind_grant CHECK (NOT response_json ? 'bindGrant');

DO $$
DECLARE duplicate_ids TEXT;
BEGIN
    SELECT string_agg(id::text, ',' ORDER BY id::text)
      INTO duplicate_ids
      FROM platform_workspace.audit_event event
     WHERE action='COMMERCIAL_GROUP_INITIALIZED'
       AND EXISTS (
           SELECT 1 FROM platform_workspace.audit_event duplicate
            WHERE duplicate.workspace_uuid=event.workspace_uuid
              AND duplicate.group_workspace_key=event.group_workspace_key
              AND duplicate.action='COMMERCIAL_GROUP_INITIALIZED'
              AND duplicate.id<>event.id
       );
    IF duplicate_ids IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_COMMERCIAL_GROUP_AUDIT_DUPLICATE_PRECONDITION_FAILED', DETAIL=duplicate_ids;
    END IF;
    SELECT string_agg(event.id::text, ',' ORDER BY event.id::text)
      INTO duplicate_ids
      FROM platform_workspace.audit_event event
     WHERE event.action='COMMERCIAL_GROUP_INITIALIZED'
       AND EXISTS (SELECT 1 FROM organization.audit_event target WHERE target.id=event.id);
    IF duplicate_ids IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_COMMERCIAL_GROUP_AUDIT_ID_CONFLICT_PRECONDITION_FAILED', DETAIL=duplicate_ids;
    END IF;
END $$;

INSERT INTO organization.audit_event
    (id, workspace_uuid, group_workspace_key, entity_type, entity_ref_text, actor_type, actor_id,
     actor_display_snapshot, action, occurred_at_epoch_millis, changes_json)
SELECT event.id, event.workspace_uuid, event.group_workspace_key, 'GROUP_WORKSPACE', workspace.id::text,
       event.actor_type, event.actor_id, event.actor_display_snapshot, event.action,
       event.occurred_at_epoch_millis, event.changes_json
  FROM platform_workspace.audit_event event
  JOIN platform_workspace.group_workspace workspace
    ON workspace.workspace_uuid=event.workspace_uuid
   AND workspace.group_workspace_key=event.group_workspace_key
 WHERE event.action='COMMERCIAL_GROUP_INITIALIZED';

DELETE FROM platform_workspace.audit_event WHERE action='COMMERCIAL_GROUP_INITIALIZED';

DO $$
DECLARE table_name TEXT; row_count BIGINT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'organization.commercial_group_audit',
        'platform_iam.platform_audit',
        'platform_workspace.workspace_audit',
        'platform_asset.asset_audit',
        'extension.extension_audit',
        'organization.organization_audit',
        'workspace_iam.workspace_audit',
        'contract.contract_audit'
    ] LOOP
        EXECUTE format('SELECT count(*) FROM %s', table_name) INTO row_count;
        IF row_count <> 0 THEN
            RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_LEGACY_AUDIT_NOT_EMPTY', DETAIL=table_name || ':' || row_count;
        END IF;
    END LOOP;
END $$;

DROP TABLE organization.commercial_group_audit;
DROP TABLE platform_iam.platform_audit;
DROP TABLE platform_workspace.workspace_audit;
DROP TABLE platform_asset.asset_audit;
DROP TABLE extension.extension_audit;
DROP TABLE organization.organization_audit;
DROP TABLE workspace_iam.workspace_audit;
DROP TABLE contract.contract_audit;
