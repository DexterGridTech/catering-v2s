package com.catering.v2s.collaboration.api;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/** Owner projections. Secrets, opaque authorization references and adapter payloads are deliberately absent. */
public final class CollaborationReadback {
    private CollaborationReadback() {}

    public record ExternalSystem(
            String externalSystemCode,
            String displayName,
            String catalogStatus,
            String catalogStatusDisplayName,
            List<CollaborationCatalogSource.AttributeDefinition> attributeDictionary,
            List<Capability> capabilities,
            String enablementStatus,
            long version) {
        public ExternalSystem {
            attributeDictionary = List.copyOf(attributeDictionary == null ? List.of() : attributeDictionary);
            capabilities = List.copyOf(capabilities == null ? List.of() : capabilities);
        }
    }

    public record Capability(
            String capabilityClass,
            String displayName,
            JsonNode attributeValues,
            Map<String, String> attributeValueLabels) {
        public Capability {
            capabilityClass = Objects.requireNonNull(capabilityClass, "capabilityClass");
            displayName = Objects.requireNonNull(displayName, "displayName");
            attributeValues = Objects.requireNonNull(attributeValues, "attributeValues");
            attributeValueLabels = Map.copyOf(attributeValueLabels == null ? Map.of() : attributeValueLabels);
        }
    }

    public record ProviderProfile(
            String providerCode,
            String displayName,
            String externalSystemCode,
            String externalSystemDisplayName,
            List<String> businessScope,
            List<String> businessScopeDisplayNames,
            List<String> bindableNodeTypes,
            List<String> bindableNodeTypeDisplayNames,
            String authenticationKind,
            String authenticationKindDisplayName,
            String unbindKind,
            String unbindKindDisplayName,
            String catalogStatus,
            String catalogStatusDisplayName,
            String enablementStatus,
            long version) {
        public ProviderProfile {
            businessScope = List.copyOf(businessScope == null ? List.of() : businessScope);
            businessScopeDisplayNames =
                    List.copyOf(businessScopeDisplayNames == null ? List.of() : businessScopeDisplayNames);
            bindableNodeTypes = List.copyOf(bindableNodeTypes == null ? List.of() : bindableNodeTypes);
            bindableNodeTypeDisplayNames =
                    List.copyOf(bindableNodeTypeDisplayNames == null ? List.of() : bindableNodeTypeDisplayNames);
        }
    }

    public record Tree(List<ExternalSystem> externalSystems, List<ProviderProfile> providerProfiles) {
        public Tree {
            externalSystems = List.copyOf(externalSystems == null ? List.of() : externalSystems);
            providerProfiles = List.copyOf(providerProfiles == null ? List.of() : providerProfiles);
        }
    }

    public record OwnerBinding(
            UUID bindingRef,
            String providerCode,
            String providerDisplayName,
            String capabilityClass,
            String capabilityClassDisplayName,
            List<String> businessScopeDisplayNames,
            String nodeType,
            String nodeTypeDisplayName,
            String nodeRef,
            String bindingDisplayName,
            String externalOwnerId,
            long boundAt,
            long statusChangedAt,
            String status,
            String statusDisplayName,
            long version) {}

    public record OwnerBindingPage(List<OwnerBinding> items, Metadata metadata) {
        public OwnerBindingPage {
            items = List.copyOf(items == null ? List.of() : items);
            metadata = Objects.requireNonNull(metadata, "metadata");
        }

        public record Metadata(
                String bindingName,
                String nodeQueryText,
                String sortKey,
                String sortDirection,
                int page,
                int pageSize,
                long total) {
            public Metadata {
                if (page < 1) throw new IllegalArgumentException("page must be at least 1");
                if (pageSize < 1) throw new IllegalArgumentException("pageSize must be positive");
                if (total < 0) throw new IllegalArgumentException("total must be non-negative");
            }
        }
    }
}
