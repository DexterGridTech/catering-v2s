// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreContract(
    String id,
    String groupWorkspaceKey,
    StoreContractProject project,
    StoreContractStore store,
    StoreContractTenant tenant,
    String phaseName,
    String contractNo,
    String effectiveFrom,
    String effectiveTo,
    String note,
    tools.jackson.databind.JsonNode extensionValues,
    Long extensionRuleRevision,
    StoreContractStatus status,
    Long revision,
    String source,
    Long createdAt,
    Long updatedAt,
    java.util.List<StoreContractItem> items,
    String phaseNameSnapshot
) {}
