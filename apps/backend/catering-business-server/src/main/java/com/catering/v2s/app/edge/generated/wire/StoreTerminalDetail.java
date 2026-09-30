// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreTerminalDetail(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "terminalRef", required = true) java.util.UUID terminalRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeRef", required = true) java.util.UUID storeRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "deviceType", required = true) String deviceType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) StoreTerminalStatus status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "version", required = true) Long version,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "createdAt", required = true) Long createdAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "updatedAt", required = true) Long updatedAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "activationCode", required = true) String activationCode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "configuration", required = true) StoreTerminalConfiguration configuration,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "areaReferences", required = true) java.util.List<StoreTerminalAreaReference> areaReferences,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "tagReferences", required = true) java.util.List<StoreTerminalTagReference> tagReferences,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "binding", required = true) StoreTerminalBinding binding
) {
  @Override
  public String toString() {
    return "StoreTerminalDetail["
        + "terminalRef=" + terminalRef
        + ", storeRef=" + storeRef
        + ", name=" + name
        + ", deviceType=" + deviceType
        + ", status=" + status
        + ", version=" + version
        + ", createdAt=" + createdAt
        + ", updatedAt=" + updatedAt
        + ", redacted=" + "[REDACTED]"
        + ", configuration=" + configuration
        + ", areaReferences=" + areaReferences
        + ", tagReferences=" + tagReferences
        + ", binding=" + binding
        + "]";
  }
}
