package com.catering.v2s.platform.foundation.contract;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Shared shape for typed owner failures at the application edge.
 *
 * <p>The interface deliberately carries no owner error-code closed set and no persistence or generated-wire type.
 * Owners retain their codes and business context; the edge may consume the common shape without adding another
 * instanceof branch for every owner.
 */
public interface OwnerProblem {
    String code();

    int status();

    /** Optional owner details; null means the owner has no structured detail payload. */
    default JsonNode details() {
        return null;
    }
}
