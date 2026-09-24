// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreTerminalScene(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "sceneKey", required = true) String sceneKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "orderTypes", required = true) java.util.List<String> orderTypes,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "printers", required = true) java.util.List<StoreTerminalPrinterRef> printers
) {}
