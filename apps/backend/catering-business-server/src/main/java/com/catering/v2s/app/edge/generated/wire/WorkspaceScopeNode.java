// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceScopeNode(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "dataNodeType", required = true) String dataNodeType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "dataNodeRef", required = true) java.util.UUID dataNodeRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "dataNodeName", required = true) String dataNodeName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "dataNodeCode", required = true) String dataNodeCode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "ancestorPath", required = true) java.util.List<String> ancestorPath,
    java.util.UUID regionRef,
    java.util.UUID projectRef,
    java.util.UUID storeRef,
    java.util.UUID headCompanyRef
) {}
