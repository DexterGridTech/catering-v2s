// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record ExternalSystemView(
    String externalSystemCode,
    String displayName,
    ExternalSystemViewCatalogStatus catalogStatus,
    java.util.List<ExternalCapability> capabilities,
    ExternalSystemViewEnablementStatus enablementStatus,
    Long version
) {}
