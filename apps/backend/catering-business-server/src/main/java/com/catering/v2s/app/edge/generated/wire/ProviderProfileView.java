// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record ProviderProfileView(
    String providerCode,
    String displayName,
    String externalSystemCode,
    String externalSystemDisplayName,
    java.util.List<String> businessScope,
    java.util.List<String> businessScopeDisplayNames,
    java.util.List<String> bindableNodeTypes,
    java.util.List<String> bindableNodeTypeDisplayNames,
    String authenticationKind,
    String authenticationKindDisplayName,
    String unbindKind,
    String unbindKindDisplayName,
    String catalogStatus,
    String catalogStatusDisplayName,
    String enablementStatus,
    Long version
) {}
