-- No production query supplies the partial predicate option_value_code IS NOT NULL
-- together with this index's leading identity columns.  The inventory owner reads
-- BOMs by opaque item_ref, so this index cannot serve those paths.
DROP INDEX inventory.ix_stock_bom_option_value;
