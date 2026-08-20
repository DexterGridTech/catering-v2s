// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record ExternalSystemView(
    String externalSystemCode,
    String displayName,
    String catalogStatus,
    String catalogStatusDisplayName,
    java.util.List<ExternalCapabilityAttributeDescriptor> attributeDictionary,
    java.util.List<ExternalCapability> capabilities,
    String enablementStatus,
    Long version
) {}
