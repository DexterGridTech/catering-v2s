// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceOperationsInvitationActionRequest(
    java.util.UUID scopeRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedContextVersion", required = true) Long expectedContextVersion,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedVersion", required = true) Long expectedVersion,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "idempotencyKey", required = true) String idempotencyKey
) {}
