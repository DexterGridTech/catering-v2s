// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record BusinessChannelTemplateVisibleStore(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeRef", required = true) java.util.UUID storeRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeCode", required = true) String storeCode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeName", required = true) String storeName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeStatus", required = true) String storeStatus
) {}
