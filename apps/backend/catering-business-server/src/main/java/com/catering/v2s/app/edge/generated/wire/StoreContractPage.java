// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreContractPage(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "metadata", required = true) StoreContractPageMetadata metadata,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "items", required = true) java.util.List<StoreContract> items
) {}
