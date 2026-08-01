package com.catering.v2s.app.edge.catalog;

/** Closed contract-list sort keys, including annotation-safe defaults. */
public enum ContractSortKey {
    UPDATED_AT;

    public static final String DEFAULT_WIRE = "UPDATED_AT";
    public String wire() { return name(); }
}
