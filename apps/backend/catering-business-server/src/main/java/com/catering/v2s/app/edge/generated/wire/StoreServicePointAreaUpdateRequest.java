// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreServicePointAreaUpdateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "code", required = true) String code,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "areaType", required = true) StoreServicePointAreaType areaType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) StoreServicePointStatus status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedVersion", required = true) Long expectedVersion
) {}
