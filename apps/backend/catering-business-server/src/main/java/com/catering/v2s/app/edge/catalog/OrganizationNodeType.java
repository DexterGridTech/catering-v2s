package com.catering.v2s.app.edge.catalog;

/** Closed catalog values for workspace-scoped organization-node access. */
public enum OrganizationNodeType {
    GROUP,
    REGION,
    PROJECT,
    HEAD_COMPANY,
    STORE;

    public String wire() {
        return name();
    }
}
