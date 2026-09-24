// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreTerminalConfiguration(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "printers", required = true) java.util.List<StoreTerminalPrinter> printers,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "functions", required = true) java.util.List<StoreTerminalFunction> functions
) {}
