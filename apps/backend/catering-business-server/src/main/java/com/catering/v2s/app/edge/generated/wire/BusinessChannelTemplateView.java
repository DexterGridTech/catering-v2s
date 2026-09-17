// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record BusinessChannelTemplateView(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "templateRef", required = true) java.util.UUID templateRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "projectRef", required = true) java.util.UUID projectRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "templateName", required = true) String templateName,
    tools.jackson.databind.JsonNode templateCode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "accessKind", required = true) BusinessChannelTemplateViewAccessKind accessKind,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "operatorKind", required = true) BusinessChannelTemplateViewOperatorKind operatorKind,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "orderKind", required = true) BusinessChannelTemplateViewOrderKind orderKind,
    BusinessChannelTemplateViewDineInForm dineInForm,
    tools.jackson.databind.JsonNode providerCode,
    tools.jackson.databind.JsonNode urlRule,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeVisibilityScope", required = true) BusinessChannelTemplateStoreVisibilityScope storeVisibilityScope,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "visibleStoreCount", required = true) Long visibleStoreCount,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) BusinessChannelTemplateViewStatus status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "statusDimensions", required = true) java.util.List<BusinessChannelTemplateViewStatusDimensionsItem> statusDimensions,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "blockers", required = true) java.util.List<BusinessChannelTemplateViewBlockersItem> blockers,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "version", required = true) Long version
) {}
