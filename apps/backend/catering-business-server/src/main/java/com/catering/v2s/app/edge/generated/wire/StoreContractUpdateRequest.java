// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreContractUpdateRequest(
    String phaseName,
    String effectiveFrom,
    String effectiveTo,
    String note,
    java.util.List<StoreContractUpdateRequestExtensionValuesItem> extensionValues,
    Long expectedVersion,
    java.util.List<StoreContractItem> items,
    String phaseNameSnapshot
) {}
