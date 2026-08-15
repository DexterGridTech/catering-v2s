-- `shortName` is an item-list filter fact.  It must not remain a client-writable
-- JSON key beside the indexed relational read model.
ALTER TABLE catalog.catalog_item ADD COLUMN short_name TEXT;

-- Keyword lookup is one name / short-name / code predicate.  A btree cannot
-- serve its leading-wildcard ILIKE form, so index the exact expression used by
-- the owner rather than indexing only one branch that the planner cannot select.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE INDEX ix_catalog_item_scope_short_name_trgm
    ON catalog.catalog_item USING GIN (data_node_ref, brand_ref,
        (name || chr(1) || COALESCE(short_name, '') || chr(1) || code) gin_trgm_ops);
