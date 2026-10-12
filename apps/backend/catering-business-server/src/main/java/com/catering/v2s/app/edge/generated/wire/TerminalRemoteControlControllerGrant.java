// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalRemoteControlControllerGrant(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "url", required = true) String url,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "roomName", required = true) String roomName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "participantIdentity", required = true) String participantIdentity,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "token", required = true) String token,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expiresAtEpochMillis", required = true) Long expiresAtEpochMillis,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "description", required = true) TerminalRemoteControlDescription description
) {
  @Override
  public String toString() {
    return "TerminalRemoteControlControllerGrant["
        + "url=" + url
        + ", roomName=" + roomName
        + ", participantIdentity=" + participantIdentity
        + ", redacted=" + "[REDACTED]"
        + ", expiresAtEpochMillis=" + expiresAtEpochMillis
        + ", description=" + description
        + "]";
  }
}
