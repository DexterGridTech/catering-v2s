// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceUserRevokeResult(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "revokedAssignmentId", required = true) String revokedAssignmentId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "accountRetained", required = true) Boolean accountRetained,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "user", required = true) WorkspaceUser user,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "contextVersion", required = true) Long contextVersion,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "sessionEntryRequired", required = true) Boolean sessionEntryRequired,
    WorkspaceSessionEntry sessionEntry
) {}
