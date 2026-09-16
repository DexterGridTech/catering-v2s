// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OrganizationCandidatePageMetadata(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "subjectType", required = true) OrganizationCandidateQuerySubjectType subjectType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "queryText", required = true) String queryText,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "page", required = true) Long page,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "pageSize", required = true) Long pageSize,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "total", required = true) Long total,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "selectedId", required = true) java.util.UUID selectedId
) {}
