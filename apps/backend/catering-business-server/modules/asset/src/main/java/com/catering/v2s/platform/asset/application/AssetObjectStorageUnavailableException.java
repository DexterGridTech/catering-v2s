package com.catering.v2s.platform.asset.application;

import java.util.Objects;

/**
 * Safe, owner-facing classification for an object-storage dependency failure.
 *
 * <p>The exception carries only allowlisted dependency facts.  It deliberately does not expose
 * a storage endpoint, object payload, request body, credentials, or provider response text.</p>
 */
public final class AssetObjectStorageUnavailableException extends RuntimeException {
    private final String operation;
    private final Integer httpStatus;
    private final String serviceErrorCode;

    public AssetObjectStorageUnavailableException(String operation, Throwable cause) {
        this(operation, cause, null, null);
    }

    public AssetObjectStorageUnavailableException(String operation, Throwable cause, Integer httpStatus, String serviceErrorCode) {
        super(Objects.requireNonNull(cause, "cause"));
        this.operation = safe(operation, "operation");
        if (httpStatus != null && (httpStatus < 100 || httpStatus > 599)) throw new IllegalArgumentException("invalid storage HTTP status");
        this.httpStatus = httpStatus;
        this.serviceErrorCode = serviceErrorCode == null ? null : safe(serviceErrorCode, "serviceErrorCode");
    }

    public String operation() { return operation; }
    public Integer httpStatus() { return httpStatus; }
    public String serviceErrorCode() { return serviceErrorCode; }

    private static String safe(String value, String name) {
        Objects.requireNonNull(value, name);
        if (!value.matches("[A-Za-z0-9._:-]{1,128}")) throw new IllegalArgumentException("invalid storage " + name);
        return value;
    }
}
