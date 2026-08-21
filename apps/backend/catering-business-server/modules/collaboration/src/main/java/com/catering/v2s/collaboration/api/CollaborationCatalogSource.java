package com.catering.v2s.collaboration.api;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
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
            String catalogStatusDisplayName,
            List<AttributeDefinition> attributeDictionary,
            List<CapabilityDefinition> capabilities) {
        public ExternalSystemDefinition {
            externalSystemCode = required(externalSystemCode, "externalSystemCode");
            displayName = required(displayName, "displayName");
            catalogStatus = required(catalogStatus, "catalogStatus");
            catalogStatusDisplayName = required(catalogStatusDisplayName, "catalogStatusDisplayName");
            attributeDictionary = List.copyOf(attributeDictionary == null ? List.of() : attributeDictionary);
            capabilities = List.copyOf(capabilities == null ? List.of() : capabilities);
        }
    }

    record AttributeDefinition(
            String fieldKey, String label, String helpText, String controlKind, JsonNode optionSourceRef) {
        public AttributeDefinition {
            fieldKey = required(fieldKey, "fieldKey");
            label = required(label, "label");
            helpText = required(helpText, "helpText");
            controlKind = required(controlKind, "controlKind");
            optionSourceRef = Objects.requireNonNull(optionSourceRef, "optionSourceRef");
        }
    }

    record CapabilityDefinition(
            String capabilityClass,
            String displayName,
            JsonNode attributeValues,
            Map<String, String> attributeValueLabels) {
        public CapabilityDefinition {
            capabilityClass = required(capabilityClass, "capabilityClass");
            displayName = required(displayName, "displayName");
            attributeValues = Objects.requireNonNull(attributeValues, "attributeValues");
            attributeValueLabels = Map.copyOf(attributeValueLabels == null ? Map.of() : attributeValueLabels);
        }
    }

    record ProviderProfileDefinition(
            String providerCode,
            String displayName,
            String externalSystemCode,
            List<String> businessScope,
            List<String> businessScopeDisplayNames,
            List<String> bindableNodeTypes,
            List<String> bindableNodeTypeDisplayNames,
            String authenticationKind,
            String authenticationKindDisplayName,
            String unbindKind,
            String unbindKindDisplayName,
            String catalogStatus,
            String catalogStatusDisplayName) {
        public ProviderProfileDefinition {
            providerCode = required(providerCode, "providerCode");
            displayName = required(displayName, "displayName");
            externalSystemCode = required(externalSystemCode, "externalSystemCode");
            businessScope = List.copyOf(businessScope == null ? List.of() : businessScope);
            businessScopeDisplayNames =
                    List.copyOf(businessScopeDisplayNames == null ? List.of() : businessScopeDisplayNames);
            bindableNodeTypes = List.copyOf(bindableNodeTypes == null ? List.of() : bindableNodeTypes);
            bindableNodeTypeDisplayNames =
                    List.copyOf(bindableNodeTypeDisplayNames == null ? List.of() : bindableNodeTypeDisplayNames);
            authenticationKind = required(authenticationKind, "authenticationKind");
            authenticationKindDisplayName = required(authenticationKindDisplayName, "authenticationKindDisplayName");
            unbindKind = required(unbindKind, "unbindKind");
            unbindKindDisplayName = required(unbindKindDisplayName, "unbindKindDisplayName");
            catalogStatus = required(catalogStatus, "catalogStatus");
            catalogStatusDisplayName = required(catalogStatusDisplayName, "catalogStatusDisplayName");
            if (businessScope.size() != businessScopeDisplayNames.size()) {
                throw new IllegalArgumentException("businessScopeDisplayNames must align with businessScope");
            }
            if (bindableNodeTypes.size() != bindableNodeTypeDisplayNames.size()) {
                throw new IllegalArgumentException("bindableNodeTypeDisplayNames must align with bindableNodeTypes");
            }
        }
    }

    private static String required(String value, String name) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty()) throw new IllegalArgumentException(name + " is required");
        return normalized;
    }
}
