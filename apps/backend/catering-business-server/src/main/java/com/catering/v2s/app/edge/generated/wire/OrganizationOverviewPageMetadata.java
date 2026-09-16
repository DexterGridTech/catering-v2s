// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OrganizationOverviewPageMetadata(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupWorkspaceKey", required = true) String groupWorkspaceKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "category", required = true) OrganizationOverviewCategory category,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "page", required = true) Long page,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "pageSize", required = true) Long pageSize,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "total", required = true) Long total,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "sort", required = true) OrganizationOverviewSortKey sort,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "direction", required = true) OrganizationOverviewSortDirection direction,
    Long definitionRevision
) {}
