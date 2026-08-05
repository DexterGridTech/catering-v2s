package com.catering.v2s.organization.api;

import java.util.Set;

/** Owner-local business-entity vocabulary; STORE is a separate managed entity path. */
public final class BusinessEntityTypes {
    public static final String BRAND = "BRAND";
    public static final String TENANT = "TENANT";
    public static final String HEAD_COMPANY = "HEAD_COMPANY";
    public static final String STORE = "STORE";
    public static final Set<String> VALUES = Set.of(BRAND, TENANT, HEAD_COMPANY, STORE);

    private BusinessEntityTypes() { }
}
