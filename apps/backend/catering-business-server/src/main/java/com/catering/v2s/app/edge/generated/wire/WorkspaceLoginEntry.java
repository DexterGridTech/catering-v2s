// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceLoginEntry(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupWorkspaceKey", required = true) String groupWorkspaceKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "workspaceName", required = true) String workspaceName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "operationsTitle", required = true) String operationsTitle,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) GroupWorkspaceStatus status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "sessionState", required = true) String sessionState,
    String logoUrl
) {}
