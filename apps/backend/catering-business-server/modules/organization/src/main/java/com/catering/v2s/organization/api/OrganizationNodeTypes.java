package com.catering.v2s.organization.api;

import java.util.Set;

/** Owner-local organization-tree vocabulary; it is intentionally narrower than service-node types. */
public final class OrganizationNodeTypes {
    public static final String REGION = "REGION";
    public static final String PROJECT = "PROJECT";
    public static final Set<String> VALUES = Set.of(REGION, PROJECT);

    private OrganizationNodeTypes() { }
}
