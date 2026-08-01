// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record HeadCompany(
    String id,
    String groupWorkspaceKey,
    String code,
    String name,
    String legalName,
    String unifiedSocialCreditCode,
    String remark,
    java.util.List<HeadCompanyAuthorizedBrandsItem> authorizedBrands,
    tools.jackson.databind.JsonNode extensionValues,
    Long extensionRuleRevision,
    BusinessEntityStatus status,
    Long revision,
    Long createdAt,
    Long updatedAt
) {}
