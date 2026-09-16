// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceSessionEntrySelected(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "roleAssignmentRef", required = true) java.util.UUID roleAssignmentRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "roleId", required = true) String roleId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "roleName", required = true) String roleName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "roleNodeRef", required = true) java.util.UUID roleNodeRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "roleNodeType", required = true) String roleNodeType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "roleNodeName", required = true) String roleNodeName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "homePageDesignKey", required = true) String homePageDesignKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "pageDesignKeys", required = true) java.util.List<String> pageDesignKeys,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "navigation", required = true) java.util.List<WorkspaceSessionEntrySelectedNavigationItem> navigation,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "contextVersion", required = true) Long contextVersion
) {}
