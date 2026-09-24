// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreTerminalFunction(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "ref", required = true) java.util.UUID ref,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "functionKey", required = true) String functionKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "ranges", required = true) java.util.List<StoreTerminalRange> ranges,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "scenes", required = true) java.util.List<StoreTerminalScene> scenes
) {}
