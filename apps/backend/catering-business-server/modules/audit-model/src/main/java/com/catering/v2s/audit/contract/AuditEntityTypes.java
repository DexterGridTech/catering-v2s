package com.catering.v2s.audit.contract;

/** Shared audit entity-type values; each owning domain retains its own audit persistence and change policy. */
public final class AuditEntityTypes {
    public static final String HEAD_COMPANY = "HEAD_COMPANY";
    public static final String STORE = "STORE";
    public static final String STORE_SERVICE_POINT_AREA = "STORE_SERVICE_POINT_AREA";
    public static final String STORE_SERVICE_POINT = "STORE_SERVICE_POINT";
    public static final String STORE_QR_CONFIGURATION = "STORE_QR_CONFIGURATION";
    public static final String STORE_TERMINAL = "STORE_TERMINAL";
    public static final String TERMINAL_BINDING = "TERMINAL_BINDING";
    public static final String REGION = "REGION";
    public static final String PROJECT = "PROJECT";

    private AuditEntityTypes() {}
}
