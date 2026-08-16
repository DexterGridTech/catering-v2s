package com.catering.v2s.app.edge.catalog;

/** Closed sort directions, including the annotation-safe descending default. */
public enum SortDirection {
    ASC,
    DESC;

    public static final String DEFAULT_WIRE = "DESC";

    public String wire() {
        return name();
    }
}
