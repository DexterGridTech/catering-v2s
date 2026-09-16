// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record ProviderProfileView(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "providerCode", required = true) String providerCode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "displayName", required = true) String displayName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "externalSystemCode", required = true) String externalSystemCode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "externalSystemDisplayName", required = true) String externalSystemDisplayName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "businessScope", required = true) java.util.List<ProviderProfileViewBusinessScopeItem> businessScope,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "bindableNodeTypes", required = true) java.util.List<ProviderProfileViewBindableNodeTypesItem> bindableNodeTypes,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "authenticationKind", required = true) ProviderProfileViewAuthenticationKind authenticationKind,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "unbindKind", required = true) ProviderProfileViewUnbindKind unbindKind,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "catalogStatus", required = true) ProviderProfileViewCatalogStatus catalogStatus,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "enablementStatus", required = true) ProviderProfileViewEnablementStatus enablementStatus,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "version", required = true) Long version
) {}
