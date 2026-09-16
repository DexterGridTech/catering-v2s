// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record GroupWorkspaceDisplayUpdateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "operationsTitle", required = true) String operationsTitle,
    String notes,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "logoIntent", required = true) String logoIntent,
    java.util.UUID logoAssetRef,
    String logoBindGrant,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedVersion", required = true) Long expectedVersion,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "idempotencyKey", required = true) String idempotencyKey
) {}
