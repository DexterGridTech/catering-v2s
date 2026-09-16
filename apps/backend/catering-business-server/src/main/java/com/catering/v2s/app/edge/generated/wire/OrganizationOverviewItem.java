// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OrganizationOverviewItem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "id", required = true) String id,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupWorkspaceKey", required = true) String groupWorkspaceKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "category", required = true) OrganizationOverviewCategory category,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "type", required = true) OrganizationOverviewType type,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "code", required = true) String code,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "path", required = true) java.util.List<OrganizationOverviewItemPathItem> path,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) OrganizationOverviewStatus status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "source", required = true) OrganizationOverviewSource source,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "version", required = true) Long version,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "createdAt", required = true) Long createdAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "updatedAt", required = true) Long updatedAt,
    String notes,
    OrganizationOverviewItemProject project,
    OrganizationOverviewItemBrand brand,
    OrganizationOverviewItemTenant tenant,
    OrganizationOverviewItemHeadCompany headCompany,
    java.util.List<String> unresolvedReferences,
    String alias,
    String legalName,
    String unifiedSocialCreditCode,
    java.util.List<OrganizationOverviewItemExtensionFieldsItem> extensionFields,
    tools.jackson.databind.JsonNode extensionValues,
    Long extensionRuleRevision
) {}
