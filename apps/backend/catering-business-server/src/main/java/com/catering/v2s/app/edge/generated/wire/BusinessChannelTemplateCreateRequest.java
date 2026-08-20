// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record BusinessChannelTemplateCreateRequest(
    java.util.UUID projectRef,
    String templateName,
    String templateCode,
    String accessKind,
    String operatorKind,
    String orderKind,
    String dineInForm,
    tools.jackson.databind.JsonNode providerCode
) {}
