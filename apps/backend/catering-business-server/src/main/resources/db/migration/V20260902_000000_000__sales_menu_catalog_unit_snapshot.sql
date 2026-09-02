-- Published sales-menu rows retain the Catalog-derived effective sales-unit fact.
-- Draft rows leave this five-column snapshot null; no cross-schema foreign key is introduced.
ALTER TABLE sales_menu.sales_version_item
    ADD COLUMN resolved_sales_unit_ref UUID,
    ADD COLUMN resolved_sales_unit_code VARCHAR(160),
    ADD COLUMN resolved_sales_unit_name VARCHAR(160),
    ADD COLUMN resolved_sales_unit_dimension VARCHAR(32),
    ADD COLUMN resolved_sales_unit_precision INTEGER;

ALTER TABLE sales_menu.sales_version_item
    ADD CONSTRAINT ck_sales_version_item_sales_unit_snapshot CHECK (
        (
            resolved_sales_unit_ref IS NULL
            AND resolved_sales_unit_code IS NULL
            AND resolved_sales_unit_name IS NULL
            AND resolved_sales_unit_dimension IS NULL
            AND resolved_sales_unit_precision IS NULL
        )
        OR (
            resolved_sales_unit_ref IS NOT NULL
            AND resolved_sales_unit_code IS NOT NULL
            AND btrim(resolved_sales_unit_code) <> ''
            AND resolved_sales_unit_name IS NOT NULL
            AND btrim(resolved_sales_unit_name) <> ''
            AND resolved_sales_unit_dimension IN ('COUNT', 'WEIGHT', 'VOLUME', 'SERVICE_DURATION', 'PACKAGE')
            AND resolved_sales_unit_precision IS NOT NULL
            AND resolved_sales_unit_precision >= 0
        )
    );
