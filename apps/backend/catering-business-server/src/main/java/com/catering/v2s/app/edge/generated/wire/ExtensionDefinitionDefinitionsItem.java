// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record ExtensionDefinitionDefinitionsItem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "key", required = true) String key,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "label", required = true) String label,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "type", required = true) ExtensionFieldType type,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "listDisplay", required = true) Boolean listDisplay,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "searchable", required = true) Boolean searchable,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "required", required = true) Boolean required,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "options", required = true) java.util.List<String> options,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) String status,
    Long displayOrder,
    String displaySuffix
) {}
