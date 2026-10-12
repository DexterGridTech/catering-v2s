// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalRemoteControlDescription(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "sessionId", required = true) java.util.UUID sessionId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "roomName", required = true) String roomName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "controllerIdentity", required = true) String controllerIdentity,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "topologyKind", required = true) String topologyKind,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "masterEndpointId", required = true) java.util.UUID masterEndpointId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "endpoints", required = true) java.util.List<TerminalRemoteControlEndpoint> endpoints,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "screens", required = true) java.util.List<TerminalRemoteControlScreen> screens
) {}
