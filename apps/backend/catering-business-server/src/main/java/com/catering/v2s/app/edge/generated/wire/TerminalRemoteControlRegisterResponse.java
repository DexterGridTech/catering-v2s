// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalRemoteControlRegisterResponse(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "description", required = true) TerminalRemoteControlDescription description,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "remainingLeaseMs", required = true) Long remainingLeaseMs,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "grants", required = true) java.util.List<TerminalRemoteControlEndpointGrant> grants
) {}
