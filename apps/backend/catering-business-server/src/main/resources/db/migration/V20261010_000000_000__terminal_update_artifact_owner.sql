CREATE SCHEMA IF NOT EXISTS terminal_update;

CREATE TABLE terminal_update.artifact_stage (
    stage_ref UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    asset_ref UUID NOT NULL UNIQUE,
    file_name VARCHAR(255) NOT NULL,
    expires_at_epoch_millis BIGINT NOT NULL CHECK (expires_at_epoch_millis > 0),
    byte_size BIGINT NOT NULL CHECK (byte_size >= 4),
    zip_sha256 CHAR(64) NOT NULL CHECK (zip_sha256 ~ '^[a-f0-9]{64}$'),
    application_id VARCHAR(255) NOT NULL,
    platform VARCHAR(32) NOT NULL CHECK (platform = 'android'),
    native_version VARCHAR(64) NOT NULL,
    native_build_number BIGINT NOT NULL CHECK (native_build_number > 0),
    bundle_version VARCHAR(64) NOT NULL,
    runtime_version VARCHAR(128) NOT NULL,
    entry_path VARCHAR(1024) NOT NULL,
    files_json JSONB NOT NULL,
    publication_id CHAR(64) NOT NULL CHECK (publication_id ~ '^[a-f0-9]{64}$'),
    apk_path VARCHAR(1024),
    apk_sha256 CHAR(64),
    certificate_sha256 CHAR(64),
    minimum_full JSONB,
    owner_actor_type VARCHAR(48) NOT NULL,
    owner_actor_id UUID NOT NULL,
    created_at_epoch_millis BIGINT NOT NULL CHECK (created_at_epoch_millis > 0),
    CONSTRAINT ck_terminal_update_stage_apk_facts CHECK (
        (apk_path IS NULL AND apk_sha256 IS NULL AND certificate_sha256 IS NULL)
        OR (apk_path IS NOT NULL AND apk_sha256 IS NOT NULL AND apk_sha256 ~ '^[a-f0-9]{64}$'
            AND certificate_sha256 IS NOT NULL AND certificate_sha256 ~ '^[a-f0-9]{64}$')
    )
);

CREATE TABLE terminal_update.publication_identity (
    application_id VARCHAR(255) NOT NULL,
    platform VARCHAR(32) NOT NULL,
    runtime_version VARCHAR(128) NOT NULL,
    bundle_version VARCHAR(64) NOT NULL,
    publication_id CHAR(64) NOT NULL CHECK (publication_id ~ '^[a-f0-9]{64}$'),
    PRIMARY KEY (application_id, platform, runtime_version, bundle_version),
    UNIQUE (application_id, platform, runtime_version, bundle_version, publication_id)
);

CREATE TABLE terminal_update.artifact (
    artifact_ref UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    asset_ref UUID NOT NULL UNIQUE,
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('FULL', 'HOT')),
    application_id VARCHAR(255) NOT NULL,
    platform VARCHAR(32) NOT NULL CHECK (platform = 'android'),
    native_version VARCHAR(64) NOT NULL,
    native_build_number BIGINT NOT NULL CHECK (native_build_number > 0),
    bundle_version VARCHAR(64) NOT NULL,
    runtime_version VARCHAR(128) NOT NULL,
    entry_path VARCHAR(1024) NOT NULL,
    files_json JSONB NOT NULL,
    publication_id CHAR(64) NOT NULL CHECK (publication_id ~ '^[a-f0-9]{64}$'),
    zip_sha256 CHAR(64) NOT NULL CHECK (zip_sha256 ~ '^[a-f0-9]{64}$'),
    byte_size BIGINT NOT NULL CHECK (byte_size >= 4),
    apk_path VARCHAR(1024),
    apk_sha256 CHAR(64),
    certificate_sha256 CHAR(64),
    minimum_full_artifact_ref UUID,
    minimum_full JSONB,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status = 'ACTIVE'),
    created_at_epoch_millis BIGINT NOT NULL CHECK (created_at_epoch_millis > 0),
    CONSTRAINT ck_terminal_update_artifact_kind_facts CHECK (
        (kind = 'FULL' AND apk_path IS NOT NULL AND apk_sha256 IS NOT NULL AND apk_sha256 ~ '^[a-f0-9]{64}$'
            AND certificate_sha256 IS NOT NULL AND certificate_sha256 ~ '^[a-f0-9]{64}$'
            AND minimum_full_artifact_ref IS NULL AND minimum_full IS NULL)
        OR (kind = 'HOT' AND apk_path IS NULL AND apk_sha256 IS NULL
            AND certificate_sha256 IS NULL AND minimum_full_artifact_ref IS NOT NULL AND minimum_full IS NOT NULL)
    )
);

CREATE INDEX ix_terminal_update_artifact_workspace_created
    ON terminal_update.artifact(workspace_uuid, group_workspace_key, created_at_epoch_millis DESC, artifact_ref DESC);

CREATE TABLE terminal_update.audit_event (
    id UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL CHECK (entity_type = 'TERMINAL_UPDATE_ARTIFACT'),
    entity_ref_text VARCHAR(128) NOT NULL,
    actor_type VARCHAR(48) NOT NULL,
    actor_id UUID,
    actor_display_snapshot VARCHAR(160) NOT NULL,
    action VARCHAR(120) NOT NULL CHECK (action IN ('STAGE', 'REGISTER', 'RELEASE_STAGE')),
    occurred_at_epoch_millis BIGINT NOT NULL CHECK (occurred_at_epoch_millis >= 0),
    changes_json JSONB NOT NULL,
    CHECK ((actor_type IN ('SYSTEM', 'TERMINAL_DEVICE') AND actor_id IS NULL)
        OR (actor_type NOT IN ('SYSTEM', 'TERMINAL_DEVICE') AND actor_id IS NOT NULL))
);

CREATE INDEX ix_terminal_update_audit_entity_time
    ON terminal_update.audit_event(workspace_uuid, group_workspace_key, entity_type, entity_ref_text,
       occurred_at_epoch_millis DESC, id DESC);

CREATE TABLE terminal_update.command_receipt (
    group_workspace_key VARCHAR(64) NOT NULL,
    command_name VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    request_hash CHAR(64) NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
    response_json JSONB NOT NULL,
    created_at_epoch_millis BIGINT NOT NULL CHECK (created_at_epoch_millis > 0),
    PRIMARY KEY (group_workspace_key, command_name, idempotency_key)
);
