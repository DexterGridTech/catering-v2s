// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceOperationsInvitationCreateRequest(
    java.util.UUID scopeRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "mobile", required = true) String mobile,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "roleIds", required = true) java.util.List<String> roleIds,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "idempotencyKey", required = true) String idempotencyKey
) {}
