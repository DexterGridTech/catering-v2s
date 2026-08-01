package com.catering.v2s.app.edge.catalog;

/** Closed catalog values passed from edge adapters to the organization owner API. */
public enum OrganizationEntityType {
    BRAND,
    TENANT,
    HEAD_COMPANY,
    STORE;

    public String wire() { return name(); }
}
