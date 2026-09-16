// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record HeadCompanyPage(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "metadata", required = true) HeadCompanyPageMetadata metadata,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "items", required = true) java.util.List<HeadCompany> items
) {}
