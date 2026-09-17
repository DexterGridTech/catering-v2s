// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record BusinessChannelTemplateCreateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "projectRef", required = true) java.util.UUID projectRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "templateName", required = true) String templateName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "templateCode", required = true) String templateCode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "accessKind", required = true) String accessKind,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "operatorKind", required = true) String operatorKind,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "orderKind", required = true) String orderKind,
    String dineInForm,
    tools.jackson.databind.JsonNode providerCode,
    tools.jackson.databind.JsonNode urlRule,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeVisibilityScope", required = true) BusinessChannelTemplateStoreVisibilityScope storeVisibilityScope,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "visibleStoreRefs", required = true) java.util.List<java.util.UUID> visibleStoreRefs
) {}
