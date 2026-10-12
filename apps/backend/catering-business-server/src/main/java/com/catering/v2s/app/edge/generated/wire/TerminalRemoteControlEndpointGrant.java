// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalRemoteControlEndpointGrant(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "endpointId", required = true) java.util.UUID endpointId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "roomName", required = true) String roomName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "participantIdentity", required = true) String participantIdentity,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "token", required = true) String token,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expiresAtEpochMillis", required = true) Long expiresAtEpochMillis
) {
  @Override
  public String toString() {
    return "TerminalRemoteControlEndpointGrant["
        + "endpointId=" + endpointId
        + ", roomName=" + roomName
        + ", participantIdentity=" + participantIdentity
        + ", redacted=" + "[REDACTED]"
        + ", expiresAtEpochMillis=" + expiresAtEpochMillis
        + "]";
  }
}
