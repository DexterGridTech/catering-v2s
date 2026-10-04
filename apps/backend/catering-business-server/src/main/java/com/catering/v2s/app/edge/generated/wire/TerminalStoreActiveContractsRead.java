// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalStoreActiveContractsRead(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "items", required = true) java.util.List<StoreContract> items,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "collectionUpdatedAtEpochMillis", required = true) Long collectionUpdatedAtEpochMillis
) {}
