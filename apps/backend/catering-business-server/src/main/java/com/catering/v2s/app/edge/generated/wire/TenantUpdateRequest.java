// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TenantUpdateRequest(
    String code,
    String name,
    String legalName,
    String unifiedSocialCreditCode,
    String remark,
    tools.jackson.databind.JsonNode extensionValues,
    Long expectedExtensionRuleRevision,
    Long expectedVersion
) {}
