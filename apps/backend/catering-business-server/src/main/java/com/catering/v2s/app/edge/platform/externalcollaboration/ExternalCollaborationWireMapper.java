package com.catering.v2s.app.edge.platform.externalcollaboration;

import com.catering.v2s.app.edge.generated.wire.CapabilityDictionary;
import com.catering.v2s.app.edge.generated.wire.ExternalCapability;
import com.catering.v2s.app.edge.generated.wire.ExternalCapabilityAttributeDescriptor;
import com.catering.v2s.app.edge.generated.wire.ExternalCollaborationTree;
import com.catering.v2s.app.edge.generated.wire.ExternalProviderCandidatePage;
import com.catering.v2s.app.edge.generated.wire.ExternalSystemView;
import com.catering.v2s.app.edge.generated.wire.OwnerBindingPage;
import com.catering.v2s.app.edge.generated.wire.OwnerBindingPageMetadata;
import com.catering.v2s.app.edge.generated.wire.OwnerBindingView;
import com.catering.v2s.app.edge.generated.wire.ProviderProfileView;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.collaboration.api.CollaborationCatalogSource;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Maps collaboration-owner projections to the accepted Jackson 3 edge wire types. */
public final class ExternalCollaborationWireMapper {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String CATALOG_ONLY_ENABLEMENT = "DISABLED";

    private ExternalCollaborationWireMapper() {}

    public static ExternalCollaborationTree tree(CollaborationReadback.Tree value) {
        Objects.requireNonNull(value, "value");
        return new ExternalCollaborationTree(
                value.externalSystems().stream()
                        .map(ExternalCollaborationWireMapper::externalSystem)
                        .toList(),
                value.providerProfiles().stream()
                        .map(ExternalCollaborationWireMapper::providerProfile)
                        .toList());
    }

    public static CapabilityDictionary dictionary(CollaborationReadback.Tree value) {
        Objects.requireNonNull(value, "value");
        return new CapabilityDictionary(
                value.externalSystems().stream()
                        .map(ExternalCollaborationWireMapper::externalSystem)
                        .toList(),
                value.providerProfiles().stream()
                        .map(ExternalCollaborationWireMapper::providerProfile)
                        .toList());
    }

    /** The platform dictionary is catalog-only because its route has no workspace selector. */
    public static CapabilityDictionary dictionary(CollaborationCatalogSource catalog) {
        Objects.requireNonNull(catalog, "catalog");
        return new CapabilityDictionary(
                catalog.externalSystems().stream()
                        .map(ExternalCollaborationWireMapper::externalSystem)
                        .toList(),
                catalog.providerProfiles().stream()
                        .map(value -> providerProfile(
                                value,
                                catalog.externalSystem(value.externalSystemCode())
                                        .displayName()))
                        .toList());
    }

    public static ExternalSystemView externalSystem(CollaborationReadback.ExternalSystem value) {
        return new ExternalSystemView(
                value.externalSystemCode(),
                value.displayName(),
                value.catalogStatus(),
                value.catalogStatusDisplayName(),
                value.attributeDictionary().stream()
                        .map(ExternalCollaborationWireMapper::attribute)
                        .toList(),
                value.capabilities().stream()
                        .map(ExternalCollaborationWireMapper::capability)
                        .toList(),
                value.enablementStatus(),
                value.version());
    }

    private static ExternalSystemView externalSystem(CollaborationCatalogSource.ExternalSystemDefinition value) {
        return new ExternalSystemView(
                value.externalSystemCode(),
                value.displayName(),
                value.catalogStatus(),
                value.catalogStatusDisplayName(),
                value.attributeDictionary().stream()
                        .map(ExternalCollaborationWireMapper::attribute)
                        .toList(),
                value.capabilities().stream()
                        .map(capability -> new ExternalCapability(
                                capability.capabilityClass(),
                                capability.displayName(),
                                json(capability.attributeValueLabels()),
                                json(capability.attributeValues())))
                        .toList(),
                CATALOG_ONLY_ENABLEMENT,
                0L);
    }

    public static ProviderProfileView providerProfile(CollaborationReadback.ProviderProfile value) {
        return new ProviderProfileView(
                value.providerCode(),
                value.displayName(),
                value.externalSystemCode(),
                value.externalSystemDisplayName(),
                value.businessScope(),
                value.businessScopeDisplayNames(),
                value.bindableNodeTypes(),
                value.bindableNodeTypeDisplayNames(),
                value.authenticationKind(),
                value.authenticationKindDisplayName(),
                value.unbindKind(),
                value.unbindKindDisplayName(),
                value.catalogStatus(),
                value.catalogStatusDisplayName(),
                value.enablementStatus(),
                value.version());
    }

    private static ProviderProfileView providerProfile(
            CollaborationCatalogSource.ProviderProfileDefinition value, String externalSystemDisplayName) {
        return new ProviderProfileView(
                value.providerCode(),
                value.displayName(),
                value.externalSystemCode(),
                externalSystemDisplayName,
                value.businessScope(),
                value.businessScopeDisplayNames(),
                value.bindableNodeTypes(),
                value.bindableNodeTypeDisplayNames(),
                value.authenticationKind(),
                value.authenticationKindDisplayName(),
                value.unbindKind(),
                value.unbindKindDisplayName(),
                value.catalogStatus(),
                value.catalogStatusDisplayName(),
                CATALOG_ONLY_ENABLEMENT,
                0L);
    }

    public static OwnerBindingPage bindingPage(CollaborationReadback.OwnerBindingPage value) {
        return new OwnerBindingPage(
                new OwnerBindingPageMetadata(
                        text(value.metadata().bindingName()),
                        text(value.metadata().nodeQueryText()),
                        value.metadata().sortKey(),
                        value.metadata().sortDirection(),
                        (long) value.metadata().page(),
                        (long) value.metadata().pageSize(),
                        value.metadata().total()),
                value.items().stream()
                        .map(ExternalCollaborationWireMapper::binding)
                        .toList());
    }

    public static OwnerBindingView binding(CollaborationReadback.OwnerBinding value) {
        return binding(value, null);
    }

    public static OwnerBindingView binding(CollaborationReadback.OwnerBinding value, String nodeDisplayPath) {
        return new OwnerBindingView(
                value.bindingRef(),
                value.providerCode(),
                value.providerDisplayName(),
                text(value.capabilityClass()),
                text(value.capabilityClassDisplayName()),
                value.businessScopeDisplayNames(),
                value.nodeType(),
                value.nodeTypeDisplayName(),
                uuid(value.nodeRef(), "nodeRef"),
                text(nodeDisplayPath),
                text(value.bindingDisplayName()),
                text(value.externalOwnerId()),
                value.boundAt(),
                value.statusChangedAt(),
                value.status(),
                value.statusDisplayName(),
                value.version());
    }

    public static ExternalProviderCandidatePage providerCandidates(
            List<CollaborationReadback.ProviderProfile> values, String nextCursor, long total) {
        return new ExternalProviderCandidatePage(
                values.stream()
                        .map(ExternalCollaborationWireMapper::providerProfile)
                        .toList(),
                text(nextCursor),
                total);
    }

    public static String requiredText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new InvalidEdgeRequestException(field + " is required");
        }
        return value;
    }

    public static String optionalText(JsonNode value, String field) {
        if (value == null || value.isNull()) return null;
        if (!value.isTextual()) {
            throw new InvalidEdgeRequestException(field + " must be a string or null");
        }
        return value.asText();
    }

    private static ExternalCapabilityAttributeDescriptor attribute(
            CollaborationCatalogSource.AttributeDefinition value) {
        return new ExternalCapabilityAttributeDescriptor(
                value.fieldKey(), value.label(), value.helpText(), value.controlKind(), json(value.optionSourceRef()));
    }

    private static ExternalCapability capability(CollaborationReadback.Capability value) {
        return new ExternalCapability(
                value.capabilityClass(),
                value.displayName(),
                json(value.attributeValueLabels()),
                json(value.attributeValues()));
    }

    static JsonNode text(String value) {
        return value == null ? null : JSON.valueToTree(value);
    }

    private static UUID uuid(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalStateException(field + " is missing in owner readback");
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException failure) {
            throw new IllegalStateException(field + " is not a UUID in owner readback", failure);
        }
    }

    private static JsonNode json(com.fasterxml.jackson.databind.JsonNode value) {
        if (value == null || value.isNull()) return null;
        try {
            return JSON.readTree(value.toString());
        } catch (Exception failure) {
            throw new IllegalStateException("collaboration owner JSON cannot be mapped", failure);
        }
    }

    private static JsonNode json(Map<String, String> value) {
        return value == null ? null : JSON.valueToTree(value);
    }
}
