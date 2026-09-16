// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record GroupWorkspaceCreateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupWorkspaceKey", required = true) String groupWorkspaceKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "operationsTitle", required = true) String operationsTitle,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "logoAssetRef", required = true) java.util.UUID logoAssetRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "logoBindGrant", required = true) String logoBindGrant,
    String notes,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "idempotencyKey", required = true) String idempotencyKey
) {}
