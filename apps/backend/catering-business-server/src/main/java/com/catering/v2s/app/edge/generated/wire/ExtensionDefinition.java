// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record ExtensionDefinition(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupWorkspaceKey", required = true) String groupWorkspaceKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "entityType", required = true) ExtensionEntityType entityType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "definitions", required = true) java.util.List<ExtensionDefinitionDefinitionsItem> definitions,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "revision", required = true) Long revision,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "updatedAt", required = true) Long updatedAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "workspaceStatus", required = true) GroupWorkspaceStatus workspaceStatus,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "blockers", required = true) java.util.List<ExtensionDefinitionBlocker> blockers
) {}
