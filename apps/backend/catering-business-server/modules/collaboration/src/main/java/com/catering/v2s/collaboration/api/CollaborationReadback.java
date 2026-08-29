package com.catering.v2s.collaboration.api;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Owner projections. Secrets, opaque authorization references and adapter payloads are deliberately absent. */
public final class CollaborationReadback {
    private CollaborationReadback() {}

    public record ExternalSystem(
            String externalSystemCode,
            String displayName,
            String catalogStatus,
            List<Capability> capabilities,
            String enablementStatus,
            long version) {
        public ExternalSystem {
            capabilities = List.copyOf(capabilities == null ? List.of() : capabilities);
        }
    }

    public record Capability(String capabilityClass, String displayName, JsonNode attributeValues) {
        public Capability {
            capabilityClass = Objects.requireNonNull(capabilityClass, "capabilityClass");
            displayName = Objects.requireNonNull(displayName, "displayName");
            attributeValues = Objects.requireNonNull(attributeValues, "attributeValues");
        }
    }

    public record ProviderProfile(
            String providerCode,
            String displayName,
            String externalSystemCode,
            String externalSystemDisplayName,
            List<String> businessScope,
            List<String> bindableNodeTypes,
            String authenticationKind,
            String unbindKind,
            String catalogStatus,
            String enablementStatus,
            long version) {
        public ProviderProfile {
            businessScope = List.copyOf(businessScope == null ? List.of() : businessScope);
            bindableNodeTypes = List.copyOf(bindableNodeTypes == null ? List.of() : bindableNodeTypes);
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
            List<String> businessScope,
            String nodeType,
            String nodeRef,
            List<OrganizationPathNode> nodePath,
            String bindingDisplayName,
            String externalOwnerId,
            long boundAt,
            long statusChangedAt,
            String status,
            long version) {
        public OwnerBinding {
            businessScope = List.copyOf(businessScope == null ? List.of() : businessScope);
            nodePath = List.copyOf(nodePath == null ? List.of() : nodePath);
        }
    }

    public record OrganizationPathNode(UUID ref, String code, String name, String nodeType) {
        public OrganizationPathNode {
            ref = Objects.requireNonNull(ref, "ref");
            code = required(code, "code");
            name = required(name, "name");
            nodeType = required(nodeType, "nodeType");
        }

        private static String required(String value, String field) {
            String normalized = Objects.requireNonNullElse(value, "").trim();
            if (normalized.isEmpty()) throw new IllegalArgumentException(field + " is required");
            return normalized;
        }
    }

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
