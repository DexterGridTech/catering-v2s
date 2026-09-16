// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceUserPageCriteria(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "sort", required = true) WorkspaceUserSortKey sort,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "direction", required = true) SortDirection direction
) {}
