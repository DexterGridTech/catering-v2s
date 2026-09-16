// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record ExternalCollaborationTree(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "externalSystems", required = true) java.util.List<ExternalSystemView> externalSystems,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "providerProfiles", required = true) java.util.List<ProviderProfileView> providerProfiles
) {}
