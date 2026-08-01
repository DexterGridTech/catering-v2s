// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreContractCreateRequest(
    String projectId,
    String storeId,
    String phaseName,
    String contractNo,
    String effectiveFrom,
    String effectiveTo,
    String note,
    tools.jackson.databind.JsonNode extensionValues,
    java.util.List<StoreContractItem> items,
    String phaseNameSnapshot
) {}
