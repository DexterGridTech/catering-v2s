-- Catalog-derived capability snapshot consumed by inventory when a target is offered as a BOM component.
-- Inventory does not read catalog schema; existing rows remain conservatively ineligible until their owning
-- catalog definition is saved through the new whole-save command.
ALTER TABLE inventory.stock_target
    ADD COLUMN component_eligible BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX ix_inventory_stock_target_component_candidates
    ON inventory.stock_target (
        data_node_ref,
        brand_ref,
        component_eligible,
        definition_status,
        item_code,
        sku_code,
        target_ref
    );
