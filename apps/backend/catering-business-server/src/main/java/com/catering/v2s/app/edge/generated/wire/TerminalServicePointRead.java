// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalServicePointRead(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "servicePoint", required = true) StoreServicePoint servicePoint,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "updatedAtEpochMillis", required = true) Long updatedAtEpochMillis
) {}
