// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceAssignmentRevokeResult(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "assignmentId", required = true) java.util.UUID assignmentId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) String status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "version", required = true) Long version,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "revokedAt", required = true) Long revokedAt
) {}
