package com.catering.v2s.fulfillment.production.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

/** Production tag definition owner. Catalog stores only typed references to these facts. */
public interface ProductionTagOwnerApi {
    JsonNode read(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId);
    JsonNode write(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey);

    /** Coordinated copy command; production owns tag definitions. */
    JsonNode copy(String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request, String requestId);

    /** Internal coordinated variant carrying the same idempotency key as the edge command. */
    default JsonNode copy(String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey) {
        return copy(sourceDataNodeRef, targetDataNodeRef, brandRef, request, requestId);
    }

    /** Read-only owner judgement used by catalog copy preflight and execute recheck. */
    JsonNode preflightCopy(String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request);

    final class Problem extends RuntimeException {
        private final String code;
        private final int status;
        public Problem(String code, int status, String message) { super(message); this.code=code; this.status=status; }
        public String code(){return code;}
        public int status(){return status;}
    }
}
