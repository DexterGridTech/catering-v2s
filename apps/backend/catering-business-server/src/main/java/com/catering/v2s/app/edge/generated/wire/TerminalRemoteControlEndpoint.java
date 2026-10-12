// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalRemoteControlEndpoint(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "endpointId", required = true) java.util.UUID endpointId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "participantIdentity", required = true) String participantIdentity
) {}
