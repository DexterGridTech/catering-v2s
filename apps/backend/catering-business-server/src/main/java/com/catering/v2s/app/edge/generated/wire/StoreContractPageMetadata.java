// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreContractPageMetadata(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupWorkspaceKey", required = true) String groupWorkspaceKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "projectRef", required = true) java.util.UUID projectRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "projectName", required = true) String projectName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "page", required = true) Long page,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "pageSize", required = true) Long pageSize,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "total", required = true) Long total,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "sort", required = true) StoreContractSortKey sort,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "direction", required = true) StoreContractSortDirection direction,
    Long definitionRevision
) {}
