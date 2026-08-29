// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record BusinessChannelTemplateView(
    java.util.UUID templateRef,
    java.util.UUID projectRef,
    String templateName,
    tools.jackson.databind.JsonNode templateCode,
    BusinessChannelTemplateViewAccessKind accessKind,
    BusinessChannelTemplateViewOperatorKind operatorKind,
    BusinessChannelTemplateViewOrderKind orderKind,
    BusinessChannelTemplateViewDineInForm dineInForm,
    tools.jackson.databind.JsonNode providerCode,
    BusinessChannelTemplateViewStatus status,
    java.util.List<BusinessChannelTemplateViewStatusDimensionsItem> statusDimensions,
    java.util.List<BusinessChannelTemplateViewBlockersItem> blockers,
    Long version
) {}
