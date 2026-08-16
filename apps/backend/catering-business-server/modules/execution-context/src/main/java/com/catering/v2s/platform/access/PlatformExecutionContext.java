package com.catering.v2s.platform.access;

import java.time.Instant;
import java.util.Objects;

/**
 * This boundary type is deliberately not an account, role, session, or credential model. The signed edge adapter
 * applies fixed consumer-face validation.
 */
public record PlatformExecutionContext(
        String externalSubject, String consumerFace, Instant expiresAt, String correlationId) {
    public PlatformExecutionContext {
        externalSubject = require(externalSubject, "externalSubject");
        consumerFace = require(consumerFace, "consumerFace");
        expiresAt = Objects.requireNonNull(expiresAt, "expiresAt");
        correlationId = require(correlationId, "correlationId");
    }

    private static String require(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(name + " must not be blank");
        }
        return value;
    }
}
