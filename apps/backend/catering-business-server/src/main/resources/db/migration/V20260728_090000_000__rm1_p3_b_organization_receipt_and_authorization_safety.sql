-- RM1 P3-B: make organization receipt identity workspace-scoped before R-24 uses it.
DO $$
DECLARE
    offender_keys TEXT;
BEGIN
    SELECT string_agg(idempotency_key, ',' ORDER BY idempotency_key)
      INTO offender_keys
      FROM organization.organization_command_receipt
     WHERE COALESCE(
               NULLIF(response_json ->> 'workspaceUuid', ''),
               NULLIF(response_json -> 'headCompany' ->> 'workspaceUuid', '')
           ) IS NULL;
    IF offender_keys IS NOT NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'RM1_P3_B_ORGANIZATION_RECEIPT_WORKSPACE_PRECONDITION_FAILED',
            DETAIL = offender_keys;
    END IF;

    SELECT string_agg(store.id::text, ',' ORDER BY store.id::text)
      INTO offender_keys
      FROM organization.store store
      LEFT JOIN organization.head_company_brand_authorization brand_authorization
        ON brand_authorization.head_company_id = store.head_company_id
       AND brand_authorization.brand_id = store.brand_id
     WHERE store.head_company_id IS NOT NULL
       AND brand_authorization.head_company_id IS NULL;
    IF offender_keys IS NOT NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'RM1_P3_B_STORE_BRAND_AUTHORIZATION_PRECONDITION_FAILED',
            DETAIL = offender_keys;
    END IF;

    SELECT string_agg(idempotency_key, ',' ORDER BY idempotency_key)
      INTO offender_keys
      FROM workspace_iam.workspace_command_receipt
     WHERE response_json ? 'rawInvitationToken';
    IF offender_keys IS NOT NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'RM1_P3_B_INVITATION_RECEIPT_SECRET_PRECONDITION_FAILED',
            DETAIL = offender_keys;
    END IF;
END $$;

ALTER TABLE organization.organization_command_receipt
    ADD COLUMN workspace_uuid UUID,
    ADD COLUMN state VARCHAR(16) NOT NULL DEFAULT 'SUCCEEDED',
    ADD CONSTRAINT ck_organization_command_receipt_state
        CHECK (state IN ('IN_PROGRESS', 'SUCCEEDED'));

UPDATE organization.organization_command_receipt
   SET workspace_uuid = COALESCE(
       NULLIF(response_json ->> 'workspaceUuid', '')::uuid,
       NULLIF(response_json -> 'headCompany' ->> 'workspaceUuid', '')::uuid
   );

ALTER TABLE organization.organization_command_receipt
    ALTER COLUMN workspace_uuid SET NOT NULL,
    DROP CONSTRAINT organization_command_receipt_pkey,
    ADD CONSTRAINT organization_command_receipt_pkey PRIMARY KEY (workspace_uuid, idempotency_key);

ALTER TABLE organization.store
    ADD CONSTRAINT fk_store_head_company_brand_authorized
    FOREIGN KEY (head_company_id, brand_id)
    REFERENCES organization.head_company_brand_authorization (head_company_id, brand_id)
    MATCH SIMPLE;

ALTER TABLE workspace_iam.workspace_command_receipt
    ADD CONSTRAINT ck_workspace_command_receipt_response_no_raw_invitation_token
        CHECK (NOT response_json ? 'rawInvitationToken');

ALTER TABLE workspace_iam.invitation
    DROP CONSTRAINT ck_invitation_status,
    ADD CONSTRAINT ck_invitation_status CHECK (status IN (
        'PENDING', 'ACCEPT_INTENT_RECORDED', 'MOBILE_VERIFIED', 'CREDENTIAL_READY',
        'COMPLETED', 'CANCELLED', 'EXPIRED', 'REISSUED', 'CONSENTED'
    ));

DO $$
DECLARE offender_keys TEXT;
BEGIN
    SELECT string_agg(idempotency_key, ',' ORDER BY idempotency_key)
      INTO offender_keys
      FROM workspace_iam.workspace_command_receipt
     WHERE NULLIF(response_json ->> 'workspaceUuid', '') IS NULL;
    IF offender_keys IS NOT NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'RM1_P3_B_WORKSPACE_RECEIPT_WORKSPACE_PRECONDITION_FAILED',
            DETAIL = offender_keys;
    END IF;
END $$;

ALTER TABLE workspace_iam.workspace_command_receipt
    ADD COLUMN workspace_uuid UUID;

UPDATE workspace_iam.workspace_command_receipt
   SET workspace_uuid = NULLIF(response_json ->> 'workspaceUuid', '')::uuid;

ALTER TABLE workspace_iam.workspace_command_receipt
    ALTER COLUMN workspace_uuid SET NOT NULL,
    DROP CONSTRAINT workspace_command_receipt_pkey,
    ADD CONSTRAINT workspace_command_receipt_pkey PRIMARY KEY (workspace_uuid, idempotency_key);

DO $$
DECLARE offender_keys TEXT;
BEGIN
    SELECT string_agg(receipt.idempotency_key, ',' ORDER BY receipt.idempotency_key)
      INTO offender_keys
      FROM organization.commercial_group_idempotency receipt
      LEFT JOIN platform_workspace.group_workspace workspace
        ON workspace.group_workspace_key = receipt.group_workspace_key
     WHERE workspace.workspace_uuid IS NULL;
    IF offender_keys IS NOT NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'RM1_P3_B_COMMERCIAL_GROUP_RECEIPT_WORKSPACE_PRECONDITION_FAILED',
            DETAIL = offender_keys;
    END IF;
END $$;

ALTER TABLE organization.commercial_group_idempotency
    ADD COLUMN workspace_uuid UUID;

UPDATE organization.commercial_group_idempotency receipt
   SET workspace_uuid = workspace.workspace_uuid
  FROM platform_workspace.group_workspace workspace
 WHERE workspace.group_workspace_key = receipt.group_workspace_key;

ALTER TABLE organization.commercial_group_idempotency
    ALTER COLUMN workspace_uuid SET NOT NULL,
    DROP CONSTRAINT commercial_group_idempotency_pkey,
    ADD CONSTRAINT commercial_group_idempotency_pkey PRIMARY KEY (workspace_uuid, idempotency_key);

ALTER TABLE extension.extension_command_receipt
    ADD COLUMN state VARCHAR(16) NOT NULL DEFAULT 'SUCCEEDED',
    ADD CONSTRAINT ck_extension_command_receipt_state CHECK (state IN ('IN_PROGRESS', 'SUCCEEDED')),
    DROP CONSTRAINT extension_command_receipt_pkey,
    ADD CONSTRAINT extension_command_receipt_pkey PRIMARY KEY (workspace_uuid, idempotency_key);
