// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceInvitationPage(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "items", required = true) java.util.List<WorkspaceInvitation> items,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "page", required = true) Long page,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "pageSize", required = true) Long pageSize,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "total", required = true) Long total,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "criteria", required = true) WorkspaceInvitationPageCriteria criteria
) {}
