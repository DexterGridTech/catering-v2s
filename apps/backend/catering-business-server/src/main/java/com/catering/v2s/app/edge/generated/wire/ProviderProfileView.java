// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record ProviderProfileView(
    String providerCode,
    String displayName,
    String externalSystemCode,
    String externalSystemDisplayName,
    java.util.List<ProviderProfileViewBusinessScopeItem> businessScope,
    java.util.List<ProviderProfileViewBindableNodeTypesItem> bindableNodeTypes,
    ProviderProfileViewAuthenticationKind authenticationKind,
    ProviderProfileViewUnbindKind unbindKind,
    ProviderProfileViewCatalogStatus catalogStatus,
    ProviderProfileViewEnablementStatus enablementStatus,
    Long version
) {}
