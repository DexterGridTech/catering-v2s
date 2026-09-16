// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceRolePageCapabilityCatalogItem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "key", required = true) String key,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "actionGroupKey", required = true) String actionGroupKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "actionGroupLabel", required = true) String actionGroupLabel,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "actionGroupOrder", required = true) Long actionGroupOrder,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "label", required = true) String label,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "description", required = true) String description,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "organizationTypes", required = true) java.util.List<String> organizationTypes
) {}
