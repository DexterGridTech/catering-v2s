// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OrganizationPathNode(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "ref", required = true) java.util.UUID ref,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "code", required = true) String code,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "nodeType", required = true) ServiceNodeType nodeType
) {}
