package com.catering.v2s.extension.api;

import java.util.Set;

/** Owner-local extension host vocabulary. It must not be used as the service-node contract. */
public final class ExtensionHostTypes {
    public static final String BRAND = "BRAND";
    public static final String TENANT = "TENANT";
    public static final String HEAD_COMPANY = "HEAD_COMPANY";
    public static final String STORE = "STORE";
    public static final String CONTRACT = "CONTRACT";
    public static final String COMMERCIAL_GROUP = "COMMERCIAL_GROUP";
    public static final String REGION = "REGION";
    public static final String PROJECT = "PROJECT";
    public static final String SERVICE_POINT = "SERVICE_POINT";
    public static final Set<String> VALUES =
            Set.of(BRAND, TENANT, HEAD_COMPANY, STORE, CONTRACT, COMMERCIAL_GROUP, REGION, PROJECT, SERVICE_POINT);
    public static final Set<String> FLAT_VALUES = Set.of(BRAND, TENANT, HEAD_COMPANY, STORE, CONTRACT);

    private ExtensionHostTypes() {}
}
