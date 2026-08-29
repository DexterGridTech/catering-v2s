package com.catering.v2s.collaboration.api;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Objects;

/**
 * Read-only port for the checked-in external-platform catalogue.
 *
 * <p>The catalogue is contract source, not collaboration runtime state. An implementation is supplied by the catalogue
 * publication path; this owner never copies the definitions into PostgreSQL.
 */
public interface CollaborationCatalogSource {
    ExternalSystemDefinition externalSystem(String externalSystemCode);

    ProviderProfileDefinition providerProfile(String providerCode);

    List<ExternalSystemDefinition> externalSystems();

    List<ProviderProfileDefinition> providerProfiles();

    record ExternalSystemDefinition(
            String externalSystemCode,
            String displayName,
            String catalogStatus,
            List<CapabilityDefinition> capabilities) {
        public ExternalSystemDefinition {
            externalSystemCode = required(externalSystemCode, "externalSystemCode");
            displayName = required(displayName, "displayName");
            catalogStatus = required(catalogStatus, "catalogStatus");
            capabilities = List.copyOf(capabilities == null ? List.of() : capabilities);
        }
    }

    record CapabilityDefinition(String capabilityClass, String displayName, JsonNode attributeValues) {
        public CapabilityDefinition {
            capabilityClass = required(capabilityClass, "capabilityClass");
            displayName = required(displayName, "displayName");
            attributeValues = Objects.requireNonNull(attributeValues, "attributeValues");
        }
    }

    record ProviderProfileDefinition(
            String providerCode,
            String displayName,
            String externalSystemCode,
            List<String> businessScope,
            List<String> bindableNodeTypes,
            String authenticationKind,
            String unbindKind,
            String catalogStatus) {
        public ProviderProfileDefinition {
            providerCode = required(providerCode, "providerCode");
            displayName = required(displayName, "displayName");
            externalSystemCode = required(externalSystemCode, "externalSystemCode");
            businessScope = List.copyOf(businessScope == null ? List.of() : businessScope);
            bindableNodeTypes = List.copyOf(bindableNodeTypes == null ? List.of() : bindableNodeTypes);
            authenticationKind = required(authenticationKind, "authenticationKind");
            unbindKind = required(unbindKind, "unbindKind");
            catalogStatus = required(catalogStatus, "catalogStatus");
        }
    }

    private static String required(String value, String name) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty()) throw new IllegalArgumentException(name + " is required");
        return normalized;
    }
}
