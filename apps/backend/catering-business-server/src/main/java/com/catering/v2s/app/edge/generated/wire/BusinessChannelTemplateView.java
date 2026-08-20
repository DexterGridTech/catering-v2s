// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record BusinessChannelTemplateView(
    java.util.UUID templateRef,
    java.util.UUID projectRef,
    String templateName,
    tools.jackson.databind.JsonNode templateCode,
    String accessKind,
    String accessKindDisplayName,
    String operatorKind,
    String operatorKindDisplayName,
    String orderKind,
    String orderKindDisplayName,
    tools.jackson.databind.JsonNode dineInForm,
    tools.jackson.databind.JsonNode dineInFormDisplayName,
    tools.jackson.databind.JsonNode providerCode,
    String status,
    String statusDisplayName,
    Long version
) {}
