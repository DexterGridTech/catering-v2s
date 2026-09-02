-- Sales-menu owns menu identity, draft versions, immutable publications, and manual sale facts.
-- References to organization, business-channel, catalog, inventory, and sales-menu assets remain opaque;
-- this migration creates no cross-schema foreign key.
CREATE SCHEMA sales_menu;

CREATE TABLE sales_menu.sales_collection (
    collection_ref UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(128) NOT NULL,
    store_ref UUID NOT NULL,
    name VARCHAR(160) NOT NULL,
    archived_at_epoch_millis BIGINT,
    current_draft_version_ref UUID,
    latest_published_version_ref UUID,
    version BIGINT NOT NULL CHECK (version > 0),
    CONSTRAINT ck_sales_collection_name_non_blank CHECK (btrim(name) <> ''),
    CONSTRAINT ck_sales_collection_archived_at CHECK (
        archived_at_epoch_millis IS NULL OR archived_at_epoch_millis >= 0
    )
);

CREATE UNIQUE INDEX uq_sales_collection_active_name
    ON sales_menu.sales_collection (workspace_uuid, group_workspace_key, store_ref, name)
    WHERE archived_at_epoch_millis IS NULL;

CREATE TABLE sales_menu.sales_collection_activation (
    collection_ref UUID NOT NULL,
    channel_ref UUID NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('ENABLED', 'DISABLED')),
    version BIGINT NOT NULL CHECK (version > 0),
    PRIMARY KEY (collection_ref, channel_ref),
    CONSTRAINT fk_sales_collection_activation_collection
        FOREIGN KEY (collection_ref) REFERENCES sales_menu.sales_collection(collection_ref) ON DELETE RESTRICT
);

CREATE INDEX idx_sales_collection_activation_channel
    ON sales_menu.sales_collection_activation (channel_ref, status, collection_ref);

CREATE TABLE sales_menu.sales_collection_version (
    version_ref UUID PRIMARY KEY,
    collection_ref UUID NOT NULL,
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('DRAFT', 'PUBLISHED')),
    revision BIGINT NOT NULL CHECK (revision >= 0),
    schedule_kind VARCHAR(32) NOT NULL CHECK (schedule_kind IN ('ALL_DAY', 'DAILY_TIME_RANGE')),
    schedule_start_local_time TIME WITHOUT TIME ZONE,
    schedule_end_local_time TIME WITHOUT TIME ZONE,
    source_draft_version_ref UUID,
    source_draft_revision BIGINT,
    version BIGINT NOT NULL CHECK (version > 0),
    CONSTRAINT uq_sales_collection_version_ref_collection UNIQUE (version_ref, collection_ref),
    CONSTRAINT fk_sales_collection_version_collection
        FOREIGN KEY (collection_ref) REFERENCES sales_menu.sales_collection(collection_ref) ON DELETE RESTRICT,
    CONSTRAINT fk_sales_collection_version_source_draft
        FOREIGN KEY (source_draft_version_ref, collection_ref)
        REFERENCES sales_menu.sales_collection_version(version_ref, collection_ref) ON DELETE RESTRICT,
    CONSTRAINT ck_sales_collection_version_schedule CHECK (
        (schedule_kind = 'ALL_DAY'
            AND schedule_start_local_time IS NULL
            AND schedule_end_local_time IS NULL)
        OR (schedule_kind = 'DAILY_TIME_RANGE'
            AND schedule_start_local_time IS NOT NULL
            AND schedule_end_local_time IS NOT NULL
            AND schedule_start_local_time <> schedule_end_local_time)
    ),
    CONSTRAINT ck_sales_collection_version_source CHECK (
        (kind = 'DRAFT' AND source_draft_version_ref IS NULL AND source_draft_revision IS NULL)
        OR (kind = 'PUBLISHED' AND source_draft_version_ref IS NOT NULL AND source_draft_revision IS NOT NULL)
    ),
    CONSTRAINT ck_sales_collection_version_source_revision CHECK (
        source_draft_revision IS NULL OR source_draft_revision >= 0
    )
);

CREATE UNIQUE INDEX uq_sales_collection_current_draft
    ON sales_menu.sales_collection_version (collection_ref)
    WHERE kind = 'DRAFT';

ALTER TABLE sales_menu.sales_collection
    ADD CONSTRAINT fk_sales_collection_current_draft
        FOREIGN KEY (current_draft_version_ref, collection_ref)
        REFERENCES sales_menu.sales_collection_version(version_ref, collection_ref) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_sales_collection_latest_publication
        FOREIGN KEY (latest_published_version_ref, collection_ref)
        REFERENCES sales_menu.sales_collection_version(version_ref, collection_ref) ON DELETE RESTRICT;

CREATE TABLE sales_menu.sales_section (
    section_ref UUID PRIMARY KEY,
    collection_ref UUID NOT NULL,
    CONSTRAINT uq_sales_section_ref_collection UNIQUE (section_ref, collection_ref),
    CONSTRAINT fk_sales_section_collection
        FOREIGN KEY (collection_ref) REFERENCES sales_menu.sales_collection(collection_ref) ON DELETE RESTRICT
);

CREATE TABLE sales_menu.sales_version_section (
    version_ref UUID NOT NULL,
    section_ref UUID NOT NULL,
    collection_ref UUID NOT NULL,
    name VARCHAR(160) NOT NULL,
    display_order BIGINT NOT NULL CHECK (display_order >= 0),
    PRIMARY KEY (version_ref, section_ref),
    CONSTRAINT uq_sales_version_section_order
        UNIQUE (version_ref, display_order),
    CONSTRAINT ck_sales_version_section_name_non_blank CHECK (btrim(name) <> ''),
    CONSTRAINT fk_sales_version_section_version
        FOREIGN KEY (version_ref, collection_ref)
        REFERENCES sales_menu.sales_collection_version(version_ref, collection_ref) ON DELETE RESTRICT,
    CONSTRAINT fk_sales_version_section_section
        FOREIGN KEY (section_ref, collection_ref)
        REFERENCES sales_menu.sales_section(section_ref, collection_ref) ON DELETE RESTRICT
);

CREATE TABLE sales_menu.sales_item (
    sales_item_ref UUID PRIMARY KEY,
    collection_ref UUID NOT NULL,
    catalog_item_ref UUID NOT NULL,
    CONSTRAINT uq_sales_item_ref_collection UNIQUE (sales_item_ref, collection_ref),
    CONSTRAINT fk_sales_item_collection
        FOREIGN KEY (collection_ref) REFERENCES sales_menu.sales_collection(collection_ref) ON DELETE RESTRICT
);

CREATE INDEX idx_sales_item_collection_catalog_item
    ON sales_menu.sales_item (collection_ref, catalog_item_ref, sales_item_ref);

CREATE TABLE sales_menu.sales_version_item (
    version_ref UUID NOT NULL,
    sales_item_ref UUID NOT NULL,
    section_ref UUID NOT NULL,
    collection_ref UUID NOT NULL,
    display_order BIGINT NOT NULL CHECK (display_order >= 0),
    display_name_override VARCHAR(160),
    resolved_item_name VARCHAR(160),
    resolved_item_code VARCHAR(160),
    resolved_product_shape VARCHAR(32),
    listed_price_cents BIGINT CHECK (listed_price_cents >= 0),
    ordering_constraints_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    display_media_mode VARCHAR(32) NOT NULL CHECK (display_media_mode IN ('INHERIT_CATALOG', 'CUSTOM')),
    version BIGINT NOT NULL CHECK (version > 0),
    PRIMARY KEY (version_ref, sales_item_ref),
    CONSTRAINT uq_sales_version_item_order
        UNIQUE (version_ref, section_ref, display_order),
    CONSTRAINT ck_sales_version_item_display_name CHECK (
        display_name_override IS NULL OR btrim(display_name_override) <> ''
    ),
    CONSTRAINT ck_sales_version_item_ordering_constraints
        CHECK (jsonb_typeof(ordering_constraints_json) = 'object'),
    CONSTRAINT fk_sales_version_item_version
        FOREIGN KEY (version_ref, collection_ref)
        REFERENCES sales_menu.sales_collection_version(version_ref, collection_ref) ON DELETE RESTRICT,
    CONSTRAINT fk_sales_version_item_item
        FOREIGN KEY (sales_item_ref, collection_ref)
        REFERENCES sales_menu.sales_item(sales_item_ref, collection_ref) ON DELETE RESTRICT,
    CONSTRAINT fk_sales_version_item_section
        FOREIGN KEY (section_ref, collection_ref)
        REFERENCES sales_menu.sales_section(section_ref, collection_ref) ON DELETE RESTRICT,
    CONSTRAINT fk_sales_version_item_section_membership
        FOREIGN KEY (version_ref, section_ref)
        REFERENCES sales_menu.sales_version_section(version_ref, section_ref) ON DELETE RESTRICT
);

CREATE TABLE sales_menu.sales_version_item_sku (
    version_ref UUID NOT NULL,
    sales_item_ref UUID NOT NULL,
    sku_ref UUID NOT NULL,
    listed_price_cents BIGINT NOT NULL CHECK (listed_price_cents >= 0),
    resolved_sku_code VARCHAR(160) NOT NULL,
    resolved_sku_name VARCHAR(160) NOT NULL,
    default_price_cents BIGINT NOT NULL CHECK (default_price_cents >= 0),
    display_order BIGINT NOT NULL CHECK (display_order >= 0),
    PRIMARY KEY (version_ref, sales_item_ref, sku_ref),
    CONSTRAINT uq_sales_version_item_sku_order
        UNIQUE (version_ref, sales_item_ref, display_order),
    CONSTRAINT ck_sales_version_item_sku_code_non_blank CHECK (btrim(resolved_sku_code) <> ''),
    CONSTRAINT ck_sales_version_item_sku_name_non_blank CHECK (btrim(resolved_sku_name) <> ''),
    CONSTRAINT fk_sales_version_item_sku_version
        FOREIGN KEY (version_ref) REFERENCES sales_menu.sales_collection_version(version_ref) ON DELETE RESTRICT,
    CONSTRAINT fk_sales_version_item_sku_item
        FOREIGN KEY (sales_item_ref) REFERENCES sales_menu.sales_item(sales_item_ref) ON DELETE RESTRICT,
    CONSTRAINT fk_sales_version_item_sku_version_item
        FOREIGN KEY (version_ref, sales_item_ref)
        REFERENCES sales_menu.sales_version_item(version_ref, sales_item_ref) ON DELETE RESTRICT
);

CREATE TABLE sales_menu.sales_version_item_media (
    version_ref UUID NOT NULL,
    sales_item_ref UUID NOT NULL,
    asset_ref UUID NOT NULL,
    display_order BIGINT NOT NULL CHECK (display_order >= 0),
    PRIMARY KEY (version_ref, sales_item_ref, asset_ref),
    CONSTRAINT uq_sales_version_item_media_order
        UNIQUE (version_ref, sales_item_ref, display_order),
    CONSTRAINT fk_sales_version_item_media_version
        FOREIGN KEY (version_ref) REFERENCES sales_menu.sales_collection_version(version_ref) ON DELETE RESTRICT,
    CONSTRAINT fk_sales_version_item_media_item
        FOREIGN KEY (sales_item_ref) REFERENCES sales_menu.sales_item(sales_item_ref) ON DELETE RESTRICT,
    CONSTRAINT fk_sales_version_item_media_version_item
        FOREIGN KEY (version_ref, sales_item_ref)
        REFERENCES sales_menu.sales_version_item(version_ref, sales_item_ref) ON DELETE RESTRICT
);

CREATE TABLE sales_menu.sales_publication (
    publication_ref UUID PRIMARY KEY,
    collection_ref UUID NOT NULL,
    published_version_ref UUID NOT NULL,
    source_draft_revision BIGINT NOT NULL CHECK (source_draft_revision >= 0),
    actor_type VARCHAR(48) NOT NULL,
    actor_id UUID,
    actor_display_snapshot VARCHAR(160) NOT NULL,
    occurred_at_epoch_millis BIGINT NOT NULL CHECK (occurred_at_epoch_millis >= 0),
    CONSTRAINT uq_sales_publication_version UNIQUE (published_version_ref),
    CONSTRAINT ck_sales_publication_actor CHECK (
        (actor_type = 'SYSTEM' AND actor_id IS NULL)
        OR (actor_type <> 'SYSTEM' AND actor_id IS NOT NULL)
    ),
    CONSTRAINT fk_sales_publication_collection
        FOREIGN KEY (collection_ref) REFERENCES sales_menu.sales_collection(collection_ref) ON DELETE RESTRICT,
    CONSTRAINT fk_sales_publication_version
        FOREIGN KEY (published_version_ref, collection_ref)
        REFERENCES sales_menu.sales_collection_version(version_ref, collection_ref)
        ON DELETE RESTRICT
);

CREATE TABLE sales_menu.sales_manual_status_current (
    sales_item_ref UUID NOT NULL,
    channel_ref UUID NOT NULL,
    state VARCHAR(24) NOT NULL CHECK (state IN ('NORMAL', 'MANUAL_SOLD_OUT')),
    reason VARCHAR(240),
    changed_at_epoch_millis BIGINT,
    actor_type VARCHAR(48),
    actor_id UUID,
    actor_display_snapshot VARCHAR(160),
    version BIGINT NOT NULL CHECK (version > 0),
    PRIMARY KEY (sales_item_ref, channel_ref),
    CONSTRAINT ck_sales_manual_status_reason CHECK (
        (state = 'NORMAL' AND reason IS NULL)
        OR (state = 'MANUAL_SOLD_OUT' AND reason IS NOT NULL AND btrim(reason) <> '')
    ),
    CONSTRAINT ck_sales_manual_status_changed_at CHECK (
        changed_at_epoch_millis IS NULL OR changed_at_epoch_millis >= 0
    ),
    CONSTRAINT ck_sales_manual_status_actor CHECK (
        (actor_type IS NULL AND actor_id IS NULL AND actor_display_snapshot IS NULL)
        OR (
            actor_type IS NOT NULL
            AND actor_display_snapshot IS NOT NULL
            AND ((actor_type = 'SYSTEM' AND actor_id IS NULL) OR (actor_type <> 'SYSTEM' AND actor_id IS NOT NULL))
        )
    ),
    CONSTRAINT fk_sales_manual_status_item
        FOREIGN KEY (sales_item_ref) REFERENCES sales_menu.sales_item(sales_item_ref) ON DELETE RESTRICT
);

CREATE INDEX idx_sales_manual_status_channel_item
    ON sales_menu.sales_manual_status_current (channel_ref, sales_item_ref);

CREATE TABLE sales_menu.sales_manual_status_event (
    event_ref UUID PRIMARY KEY,
    sales_item_ref UUID NOT NULL,
    channel_ref UUID NOT NULL,
    event_kind VARCHAR(16) NOT NULL CHECK (event_kind IN ('SOLD_OUT', 'RESTORED')),
    reason VARCHAR(240),
    actor_type VARCHAR(48) NOT NULL,
    actor_id UUID,
    actor_display_snapshot VARCHAR(160) NOT NULL,
    occurred_at_epoch_millis BIGINT NOT NULL CHECK (occurred_at_epoch_millis >= 0),
    CONSTRAINT ck_sales_manual_status_event_reason CHECK (
        (event_kind = 'SOLD_OUT' AND reason IS NOT NULL AND btrim(reason) <> '')
        OR (event_kind = 'RESTORED' AND reason IS NULL)
    ),
    CONSTRAINT ck_sales_manual_status_event_actor CHECK (
        (actor_type = 'SYSTEM' AND actor_id IS NULL)
        OR (actor_type <> 'SYSTEM' AND actor_id IS NOT NULL)
    ),
    CONSTRAINT fk_sales_manual_status_event_item
        FOREIGN KEY (sales_item_ref) REFERENCES sales_menu.sales_item(sales_item_ref) ON DELETE RESTRICT
);

CREATE TABLE sales_menu.sales_operation_record (
    record_ref UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(128) NOT NULL,
    store_ref UUID NOT NULL,
    channel_ref UUID,
    collection_ref UUID,
    operation_kind VARCHAR(120) NOT NULL,
    target_ref UUID,
    result VARCHAR(16) NOT NULL CHECK (result IN ('SUCCESS', 'FAILED')),
    failure_code VARCHAR(120),
    actor_type VARCHAR(48) NOT NULL,
    actor_id UUID,
    actor_display_snapshot VARCHAR(160) NOT NULL,
    occurred_at_epoch_millis BIGINT NOT NULL CHECK (occurred_at_epoch_millis >= 0),
    idempotency_key VARCHAR(128),
    CONSTRAINT ck_sales_operation_record_kind_non_blank CHECK (btrim(operation_kind) <> ''),
    CONSTRAINT ck_sales_operation_record_failure CHECK (
        (result = 'SUCCESS' AND failure_code IS NULL)
        OR (result = 'FAILED' AND failure_code IS NOT NULL AND btrim(failure_code) <> '')
    ),
    CONSTRAINT ck_sales_operation_record_actor CHECK (
        (actor_type = 'SYSTEM' AND actor_id IS NULL)
        OR (actor_type <> 'SYSTEM' AND actor_id IS NOT NULL)
    ),
    CONSTRAINT fk_sales_operation_record_collection
        FOREIGN KEY (collection_ref) REFERENCES sales_menu.sales_collection(collection_ref) ON DELETE RESTRICT
);

CREATE INDEX idx_sales_operation_record_scope_time
    ON sales_menu.sales_operation_record (
        workspace_uuid,
        group_workspace_key,
        store_ref,
        collection_ref,
        channel_ref,
        occurred_at_epoch_millis DESC,
        record_ref DESC
    );

CREATE TABLE sales_menu.sales_command_receipt (
    receipt_ref UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(128) NOT NULL,
    operation_id VARCHAR(160) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL,
    readback_json JSONB NOT NULL CHECK (jsonb_typeof(readback_json) = 'object'),
    created_at_epoch_millis BIGINT NOT NULL CHECK (created_at_epoch_millis >= 0),
    CONSTRAINT uq_sales_command_receipt_key
        UNIQUE (workspace_uuid, operation_id, idempotency_key)
);

-- Asset ownership stays in platform_asset. Only the target relation is added here; the menu refs are opaque.
ALTER TABLE platform_asset.staged_asset
    DROP CONSTRAINT ck_platform_asset_usage,
    ADD CONSTRAINT ck_platform_asset_usage
        CHECK (usage IN ('GROUP_WORKSPACE_LOGO', 'CATALOG_ITEM_IMAGE', 'SALES_MENU_ITEM_IMAGE'));

CREATE TABLE platform_asset.sales_menu_asset_target (
    asset_ref UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(128) NOT NULL,
    store_ref UUID NOT NULL,
    sales_menu_ref UUID NOT NULL,
    sales_item_ref UUID NOT NULL,
    usage VARCHAR(64) NOT NULL CHECK (usage = 'SALES_MENU_ITEM_IMAGE'),
    expected_draft_version BIGINT NOT NULL CHECK (expected_draft_version >= 0),
    created_at_epoch_millis BIGINT NOT NULL CHECK (created_at_epoch_millis >= 0),
    CONSTRAINT fk_sales_menu_asset_target_asset
        FOREIGN KEY (asset_ref) REFERENCES platform_asset.staged_asset(asset_ref) ON DELETE RESTRICT
);

CREATE INDEX idx_sales_menu_asset_target_lookup
    ON platform_asset.sales_menu_asset_target (
        workspace_uuid,
        store_ref,
        sales_menu_ref,
        sales_item_ref,
        asset_ref
    );

CREATE OR REPLACE FUNCTION sales_menu.reject_published_version_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.kind = 'PUBLISHED' OR (TG_OP = 'UPDATE' AND NEW.kind = 'PUBLISHED') THEN
        RAISE EXCEPTION 'SALES_MENU_PUBLISHED_VERSION_IMMUTABLE: %', TG_TABLE_NAME
            USING ERRCODE = '55000';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sales_menu.reject_published_version_child_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF EXISTS (
            SELECT 1
            FROM sales_menu.sales_collection_version
            WHERE version_ref = OLD.version_ref AND kind = 'PUBLISHED'
        ) THEN
            RAISE EXCEPTION 'SALES_MENU_PUBLISHED_VERSION_CHILD_IMMUTABLE: %', TG_TABLE_NAME
                USING ERRCODE = '55000';
        END IF;
        RETURN OLD;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM sales_menu.sales_collection_version
        WHERE version_ref = OLD.version_ref AND kind = 'PUBLISHED'
    ) OR EXISTS (
        SELECT 1
        FROM sales_menu.sales_collection_version
        WHERE version_ref = NEW.version_ref AND kind = 'PUBLISHED'
    ) THEN
        RAISE EXCEPTION 'SALES_MENU_PUBLISHED_VERSION_CHILD_IMMUTABLE: %', TG_TABLE_NAME
            USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sales_menu.reject_publication_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'SALES_MENU_PUBLICATION_APPEND_ONLY'
        USING ERRCODE = '55000';
    RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION sales_menu.reject_sales_item_rebind()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.collection_ref IS DISTINCT FROM OLD.collection_ref
        OR NEW.catalog_item_ref IS DISTINCT FROM OLD.catalog_item_ref THEN
        RAISE EXCEPTION 'SALES_MENU_ITEM_BINDING_IMMUTABLE'
            USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sales_menu.populate_version_child_collection_ref()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    version_collection_ref UUID;
BEGIN
    SELECT collection_ref
      INTO version_collection_ref
      FROM sales_menu.sales_collection_version
     WHERE version_ref = NEW.version_ref;

    IF version_collection_ref IS NOT NULL
        AND NEW.collection_ref IS NOT NULL
        AND NEW.collection_ref IS DISTINCT FROM version_collection_ref THEN
        RAISE EXCEPTION 'SALES_MENU_VERSION_COLLECTION_MISMATCH: %', TG_TABLE_NAME
            USING ERRCODE = '23514';
    END IF;

    IF version_collection_ref IS NOT NULL THEN
        NEW.collection_ref := version_collection_ref;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_sales_version_section_collection_ref
    BEFORE INSERT OR UPDATE OF version_ref, collection_ref ON sales_menu.sales_version_section
    FOR EACH ROW EXECUTE FUNCTION sales_menu.populate_version_child_collection_ref();

CREATE TRIGGER tr_sales_version_item_collection_ref
    BEFORE INSERT OR UPDATE OF version_ref, collection_ref ON sales_menu.sales_version_item
    FOR EACH ROW EXECUTE FUNCTION sales_menu.populate_version_child_collection_ref();

CREATE TRIGGER tr_sales_collection_version_published_immutable
    BEFORE UPDATE OR DELETE ON sales_menu.sales_collection_version
    FOR EACH ROW EXECUTE FUNCTION sales_menu.reject_published_version_mutation();

CREATE TRIGGER tr_sales_version_section_published_immutable
    BEFORE UPDATE OR DELETE ON sales_menu.sales_version_section
    FOR EACH ROW EXECUTE FUNCTION sales_menu.reject_published_version_child_mutation();

CREATE TRIGGER tr_sales_version_item_published_immutable
    BEFORE UPDATE OR DELETE ON sales_menu.sales_version_item
    FOR EACH ROW EXECUTE FUNCTION sales_menu.reject_published_version_child_mutation();

CREATE TRIGGER tr_sales_version_item_sku_published_immutable
    BEFORE UPDATE OR DELETE ON sales_menu.sales_version_item_sku
    FOR EACH ROW EXECUTE FUNCTION sales_menu.reject_published_version_child_mutation();

CREATE TRIGGER tr_sales_version_item_media_published_immutable
    BEFORE UPDATE OR DELETE ON sales_menu.sales_version_item_media
    FOR EACH ROW EXECUTE FUNCTION sales_menu.reject_published_version_child_mutation();

CREATE TRIGGER tr_sales_publication_append_only
    BEFORE UPDATE OR DELETE ON sales_menu.sales_publication
    FOR EACH ROW EXECUTE FUNCTION sales_menu.reject_publication_mutation();

CREATE TRIGGER tr_sales_item_binding_immutable
    BEFORE UPDATE OF collection_ref, catalog_item_ref ON sales_menu.sales_item
    FOR EACH ROW EXECUTE FUNCTION sales_menu.reject_sales_item_rebind();
