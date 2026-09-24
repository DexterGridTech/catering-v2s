// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreTerminalMutation(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "terminalRef", required = true) java.util.UUID terminalRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "version", required = true) Long version,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) StoreTerminalStatus status
) {}
