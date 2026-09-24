// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreTerminalTagCandidate(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "tagRef", required = true) java.util.UUID tagRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "code", required = true) String code,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) StoreTerminalStatus status
) {}
