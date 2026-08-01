// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OrganizationOverviewItem(
    String id,
    String groupWorkspaceKey,
    OrganizationOverviewCategory category,
    OrganizationOverviewType type,
    String code,
    String name,
    java.util.List<OrganizationOverviewItemPathItem> path,
    OrganizationOverviewStatus status,
    OrganizationOverviewSource source,
    Long version,
    Long createdAt,
    Long updatedAt,
    String notes,
    OrganizationOverviewItemProject project,
    OrganizationOverviewItemBrand brand,
    OrganizationOverviewItemTenant tenant,
    OrganizationOverviewItemHeadCompany headCompany,
    java.util.List<String> unresolvedReferences,
    java.util.List<OrganizationOverviewItemExtensionFieldsItem> extensionFields
) {}
