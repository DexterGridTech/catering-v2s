ALTER TABLE organization.store_service_point
    DROP CONSTRAINT ck_store_service_point_table_attributes;

ALTER TABLE organization.store_service_point
    ADD CONSTRAINT ck_store_service_point_table_attributes CHECK (
        (point_type = 'TABLE')
        OR (point_type = 'SCAN'
            AND seat_capacity IS NULL
            AND table_shape IS NULL
            AND reservable IS NULL
            AND image_asset_ref IS NULL)
    );
