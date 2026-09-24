// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreTerminalPrinter(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "ref", required = true) java.util.UUID ref,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "brandKey", required = true) String brandKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "modelKey", required = true) String modelKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "paperSpecKey", required = true) String paperSpecKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "connectionMethodKey", required = true) String connectionMethodKey,
    tools.jackson.databind.JsonNode connectionParameter
) {}
