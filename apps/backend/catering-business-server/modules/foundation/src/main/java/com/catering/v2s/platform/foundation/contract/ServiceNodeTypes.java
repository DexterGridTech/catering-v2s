package com.catering.v2s.platform.foundation.contract;

import java.util.Set;

/** Closed service-node vocabulary mirrored from contracts/openapi/components/common/enum.schemas.json. */
public final class ServiceNodeTypes {
    public static final String GROUP = "GROUP";
    public static final String REGION = "REGION";
    public static final String PROJECT = "PROJECT";
    public static final String HEAD_COMPANY = "HEAD_COMPANY";
    public static final String STORE = "STORE";
    public static final Set<String> VALUES = Set.of(GROUP, REGION, PROJECT, HEAD_COMPANY, STORE);

    private ServiceNodeTypes() {}
}
