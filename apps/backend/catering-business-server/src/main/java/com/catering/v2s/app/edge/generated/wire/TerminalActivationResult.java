// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalActivationResult(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "terminalRef", required = true) java.util.UUID terminalRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeRef", required = true) java.util.UUID storeRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupWorkspaceKey", required = true) String groupWorkspaceKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "bindingGeneration", required = true) Long bindingGeneration
) {}
