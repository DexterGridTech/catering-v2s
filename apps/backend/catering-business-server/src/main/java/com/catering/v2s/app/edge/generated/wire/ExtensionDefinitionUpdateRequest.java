// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record ExtensionDefinitionUpdateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "definitions", required = true) java.util.List<ExtensionDefinitionUpdateRequestDefinitionsItem> definitions,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedVersion", required = true) Long expectedVersion
) {}
