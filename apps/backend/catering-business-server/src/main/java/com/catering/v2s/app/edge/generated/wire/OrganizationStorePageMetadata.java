// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OrganizationStorePageMetadata(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupWorkspaceKey", required = true) String groupWorkspaceKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "dataScope", required = true) OrganizationStorePageMetadataDataScope dataScope,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "page", required = true) Long page,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "pageSize", required = true) Long pageSize,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "total", required = true) Long total,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "sort", required = true) OrganizationStoreSortKey sort,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "direction", required = true) OrganizationStoreSortDirection direction,
    Long definitionRevision
) {}
