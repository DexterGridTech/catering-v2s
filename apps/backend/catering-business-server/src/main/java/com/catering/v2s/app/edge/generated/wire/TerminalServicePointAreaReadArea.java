// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalServicePointAreaReadArea(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "areaRef", required = true) java.util.UUID areaRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeRef", required = true) java.util.UUID storeRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "code", required = true) String code,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "areaType", required = true) StoreServicePointAreaType areaType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) StoreServicePointStatus status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "displayOrder", required = true) Long displayOrder,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "version", required = true) Long version,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "createdAt", required = true) Long createdAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "updatedAt", required = true) Long updatedAt
) {}
