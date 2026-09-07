-- SalesMenu owns the selected option snapshot and target-level manual sale facts.
-- Catalog and Inventory references remain opaque and are revalidated by the owner.

CREATE TABLE sales_menu.sales_version_item_order_option (
    version_ref UUID NOT NULL,
    sales_item_ref UUID NOT NULL,
    definition_ref UUID NOT NULL,
    resolved_definition_name VARCHAR(160) NOT NULL,
    selection_mode VARCHAR(16) NOT NULL CHECK (selection_mode IN ('SINGLE', 'MULTIPLE')),
    required BOOLEAN NOT NULL,
    min_selection_count INTEGER CHECK (min_selection_count IS NULL OR min_selection_count >= 0),
    max_selection_count INTEGER CHECK (max_selection_count IS NULL OR max_selection_count >= 0),
    display_order BIGINT NOT NULL CHECK (display_order >= 0),
    PRIMARY KEY (version_ref, sales_item_ref, definition_ref),
    CONSTRAINT ck_sales_version_item_order_option_name_non_blank
        CHECK (btrim(resolved_definition_name) <> ''),
    CONSTRAINT ck_sales_version_item_order_option_counts
        CHECK (
            min_selection_count IS NULL OR max_selection_count IS NULL
            OR min_selection_count <= max_selection_count
        ),
    CONSTRAINT fk_sales_version_item_order_option_version_item
        FOREIGN KEY (version_ref, sales_item_ref)
        REFERENCES sales_menu.sales_version_item(version_ref, sales_item_ref) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX uq_sales_version_item_order_option_order
    ON sales_menu.sales_version_item_order_option (version_ref, sales_item_ref, display_order);

CREATE TABLE sales_menu.sales_version_item_order_option_value (
    version_ref UUID NOT NULL,
    sales_item_ref UUID NOT NULL,
    definition_ref UUID NOT NULL,
    definition_value_ref UUID NOT NULL,
    resolved_value_name VARCHAR(160) NOT NULL,
    display_order BIGINT NOT NULL CHECK (display_order >= 0),
    default_value BOOLEAN NOT NULL,
    extra_price BIGINT CHECK (extra_price IS NULL OR extra_price >= 0),
    PRIMARY KEY (version_ref, sales_item_ref, definition_ref, definition_value_ref),
    CONSTRAINT ck_sales_version_item_order_option_value_name_non_blank
        CHECK (btrim(resolved_value_name) <> ''),
    CONSTRAINT fk_sales_version_item_order_option_value_group
        FOREIGN KEY (version_ref, sales_item_ref, definition_ref)
        REFERENCES sales_menu.sales_version_item_order_option(version_ref, sales_item_ref, definition_ref)
        ON DELETE RESTRICT
);

CREATE UNIQUE INDEX uq_sales_version_item_order_option_value_order
    ON sales_menu.sales_version_item_order_option_value
        (version_ref, sales_item_ref, definition_ref, display_order);

ALTER TABLE sales_menu.sales_manual_status_current
    ADD COLUMN target_kind VARCHAR(32),
    ADD COLUMN target_ref UUID;

UPDATE sales_menu.sales_manual_status_current
   SET target_kind = 'ITEM', target_ref = sales_item_ref
 WHERE target_kind IS NULL OR target_ref IS NULL;

ALTER TABLE sales_menu.sales_manual_status_current
    ALTER COLUMN target_kind SET NOT NULL,
    ALTER COLUMN target_ref SET NOT NULL,
    DROP CONSTRAINT sales_manual_status_current_pkey,
    ADD CONSTRAINT pk_sales_manual_status_current_target
        PRIMARY KEY (sales_item_ref, channel_ref, target_kind, target_ref),
    ADD CONSTRAINT ck_sales_manual_status_current_target_kind
        CHECK (target_kind IN ('ITEM', 'SKU', 'ORDER_OPTION_VALUE')),
    ADD CONSTRAINT ck_sales_manual_status_current_item_target
        CHECK (target_kind <> 'ITEM' OR target_ref = sales_item_ref);

CREATE INDEX idx_sales_manual_status_channel_target
    ON sales_menu.sales_manual_status_current (channel_ref, sales_item_ref, target_kind, target_ref);

ALTER TABLE sales_menu.sales_manual_status_event
    ADD COLUMN target_kind VARCHAR(32),
    ADD COLUMN target_ref UUID;

UPDATE sales_menu.sales_manual_status_event
   SET target_kind = 'ITEM', target_ref = sales_item_ref
 WHERE target_kind IS NULL OR target_ref IS NULL;

ALTER TABLE sales_menu.sales_manual_status_event
    ALTER COLUMN target_kind SET NOT NULL,
    ALTER COLUMN target_ref SET NOT NULL,
    ADD CONSTRAINT ck_sales_manual_status_event_target_kind
        CHECK (target_kind IN ('ITEM', 'SKU', 'ORDER_OPTION_VALUE')),
    ADD CONSTRAINT ck_sales_manual_status_event_item_target
        CHECK (target_kind <> 'ITEM' OR target_ref = sales_item_ref);

CREATE INDEX idx_sales_manual_status_event_item_target
    ON sales_menu.sales_manual_status_event (sales_item_ref, channel_ref, target_kind, target_ref);

ALTER TABLE sales_menu.sales_operation_record
    ADD COLUMN target_kind VARCHAR(32),
    ADD COLUMN target_display_snapshot VARCHAR(160),
    ADD CONSTRAINT ck_sales_operation_record_target_kind
        CHECK (target_kind IS NULL OR target_kind IN ('ITEM', 'SKU', 'ORDER_OPTION_VALUE')),
    ADD CONSTRAINT ck_sales_operation_record_target_display
        CHECK (target_display_snapshot IS NULL OR btrim(target_display_snapshot) <> '');

CREATE TRIGGER tr_sales_version_item_order_option_published_immutable
    BEFORE UPDATE OR DELETE ON sales_menu.sales_version_item_order_option
    FOR EACH ROW EXECUTE FUNCTION sales_menu.reject_published_version_child_mutation();

CREATE TRIGGER tr_sales_version_item_order_option_value_published_immutable
    BEFORE UPDATE OR DELETE ON sales_menu.sales_version_item_order_option_value
    FOR EACH ROW EXECUTE FUNCTION sales_menu.reject_published_version_child_mutation();
