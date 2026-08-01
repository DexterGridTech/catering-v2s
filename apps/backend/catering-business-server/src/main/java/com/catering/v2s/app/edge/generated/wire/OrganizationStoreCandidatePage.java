// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OrganizationStoreCandidatePage(
    String groupWorkspaceKey,
    OrganizationStoreCandidatePageDataScope dataScope,
    java.util.List<OrganizationStoreCandidatePageProjectsItem> projects,
    java.util.List<OrganizationStoreCandidatePageBrandsItem> brands,
    java.util.List<OrganizationStoreCandidatePageTenantsItem> tenants,
    java.util.List<OrganizationStoreCandidatePageHeadCompaniesItem> headCompanies
) {}
