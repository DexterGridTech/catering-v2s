// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OrganizationStore(
    String id,
    String groupWorkspaceKey,
    String code,
    String name,
    OrganizationStoreProject project,
    OrganizationStoreBrand brand,
    OrganizationStoreTenant tenant,
    OrganizationStoreHeadCompany headCompany,
    String notes,
    OrganizationStoreStatus status,
    tools.jackson.databind.JsonNode extensionValues,
    Long extensionRuleRevision,
    Long revision,
    Long createdAt,
    Long updatedAt,
    String contractDerivedStatus
) {}
