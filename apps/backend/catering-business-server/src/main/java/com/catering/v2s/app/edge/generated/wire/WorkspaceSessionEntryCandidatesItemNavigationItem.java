// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceSessionEntryCandidatesItemNavigationItem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "pageDesignKey", required = true) String pageDesignKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "title", required = true) String title,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "menuGroup", required = true) String menuGroup,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "menuOrder", required = true) Long menuOrder,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "kind", required = true) String kind,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "pageAccessManaged", required = true) Boolean pageAccessManaged,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "requiredDataNodeType", required = true) String requiredDataNodeType
) {}
