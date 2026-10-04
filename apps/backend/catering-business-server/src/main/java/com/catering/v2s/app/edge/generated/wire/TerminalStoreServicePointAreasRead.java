// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalStoreServicePointAreasRead(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "items", required = true) java.util.List<StoreServicePointArea> items,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "collectionUpdatedAtEpochMillis", required = true) Long collectionUpdatedAtEpochMillis
) {}
