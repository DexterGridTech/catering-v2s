// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalContractRead(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "contract", required = true) StoreContract contract,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "updatedAtEpochMillis", required = true) Long updatedAtEpochMillis
) {}
