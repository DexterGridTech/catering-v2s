package com.catering.v2s.app.edge.platform.externalcollaboration;

import com.catering.v2s.app.edge.generated.wire.CapabilityDictionary;
import com.catering.v2s.app.edge.generated.wire.ExternalCapability;
import com.catering.v2s.app.edge.generated.wire.ExternalCapabilityAttributeValues;
import com.catering.v2s.app.edge.generated.wire.ExternalCapabilityAttributeValuesGroupBuyMappingDirection;
import com.catering.v2s.app.edge.generated.wire.ExternalCapabilityAttributeValuesMenuCollaborationDirection;
import com.catering.v2s.app.edge.generated.wire.ExternalCapabilityCapabilityClass;
import com.catering.v2s.app.edge.generated.wire.ExternalCollaborationTree;
import com.catering.v2s.app.edge.generated.wire.ExternalProviderCandidatePage;
import com.catering.v2s.app.edge.generated.wire.ExternalSystemView;
import com.catering.v2s.app.edge.generated.wire.ExternalSystemViewCatalogStatus;
import com.catering.v2s.app.edge.generated.wire.ExternalSystemViewEnablementStatus;
import com.catering.v2s.app.edge.generated.wire.OrganizationPathNode;
import com.catering.v2s.app.edge.generated.wire.OwnerBindingPage;
import com.catering.v2s.app.edge.generated.wire.OwnerBindingPageMetadata;
import com.catering.v2s.app.edge.generated.wire.OwnerBindingView;
import com.catering.v2s.app.edge.generated.wire.OwnerBindingViewBusinessScopeItem;
import com.catering.v2s.app.edge.generated.wire.OwnerBindingViewCapabilityClass;
import com.catering.v2s.app.edge.generated.wire.OwnerBindingViewNodeType;
import com.catering.v2s.app.edge.generated.wire.OwnerBindingViewStatus;
import com.catering.v2s.app.edge.generated.wire.ProviderProfileView;
import com.catering.v2s.app.edge.generated.wire.ProviderProfileViewAuthenticationKind;
import com.catering.v2s.app.edge.generated.wire.ProviderProfileViewBindableNodeTypesItem;
import com.catering.v2s.app.edge.generated.wire.ProviderProfileViewBusinessScopeItem;
import com.catering.v2s.app.edge.generated.wire.ProviderProfileViewCatalogStatus;
import com.catering.v2s.app.edge.generated.wire.ProviderProfileViewEnablementStatus;
import com.catering.v2s.app.edge.generated.wire.ProviderProfileViewUnbindKind;
import com.catering.v2s.app.edge.generated.wire.ServiceNodeType;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.collaboration.api.CollaborationCatalogSource;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import java.util.List;
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
                enumValue(ExternalSystemViewCatalogStatus.class, value.catalogStatus(), "catalogStatus"),
                value.capabilities().stream()
                        .map(ExternalCollaborationWireMapper::capability)
                        .toList(),
                enumValue(ExternalSystemViewEnablementStatus.class, value.enablementStatus(), "enablementStatus"),
                value.version());
    }

    private static ExternalSystemView externalSystem(CollaborationCatalogSource.ExternalSystemDefinition value) {
        return new ExternalSystemView(
                value.externalSystemCode(),
                value.displayName(),
                enumValue(ExternalSystemViewCatalogStatus.class, value.catalogStatus(), "catalogStatus"),
                value.capabilities().stream()
                        .map(capability -> new ExternalCapability(
                                enumValue(
                                        ExternalCapabilityCapabilityClass.class,
                                        capability.capabilityClass(),
                                        "capabilityClass"),
                                capability.displayName(),
                                attributeValues(capability.attributeValues())))
                        .toList(),
                enumValue(ExternalSystemViewEnablementStatus.class, CATALOG_ONLY_ENABLEMENT, "enablementStatus"),
                0L);
    }

    public static ProviderProfileView providerProfile(CollaborationReadback.ProviderProfile value) {
        return new ProviderProfileView(
                value.providerCode(),
                value.displayName(),
                value.externalSystemCode(),
                value.externalSystemDisplayName(),
                enumValues(ProviderProfileViewBusinessScopeItem.class, value.businessScope(), "businessScope"),
                enumValues(
                        ProviderProfileViewBindableNodeTypesItem.class, value.bindableNodeTypes(), "bindableNodeTypes"),
                enumValue(
                        ProviderProfileViewAuthenticationKind.class, value.authenticationKind(), "authenticationKind"),
                enumValue(ProviderProfileViewUnbindKind.class, value.unbindKind(), "unbindKind"),
                enumValue(ProviderProfileViewCatalogStatus.class, value.catalogStatus(), "catalogStatus"),
                enumValue(ProviderProfileViewEnablementStatus.class, value.enablementStatus(), "enablementStatus"),
                value.version());
    }

    private static ProviderProfileView providerProfile(
            CollaborationCatalogSource.ProviderProfileDefinition value, String externalSystemDisplayName) {
        return new ProviderProfileView(
                value.providerCode(),
                value.displayName(),
                value.externalSystemCode(),
                externalSystemDisplayName,
                enumValues(ProviderProfileViewBusinessScopeItem.class, value.businessScope(), "businessScope"),
                enumValues(
                        ProviderProfileViewBindableNodeTypesItem.class, value.bindableNodeTypes(), "bindableNodeTypes"),
                enumValue(
                        ProviderProfileViewAuthenticationKind.class, value.authenticationKind(), "authenticationKind"),
                enumValue(ProviderProfileViewUnbindKind.class, value.unbindKind(), "unbindKind"),
                enumValue(ProviderProfileViewCatalogStatus.class, value.catalogStatus(), "catalogStatus"),
                enumValue(ProviderProfileViewEnablementStatus.class, CATALOG_ONLY_ENABLEMENT, "enablementStatus"),
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
        return new OwnerBindingView(
                value.bindingRef(),
                value.providerCode(),
                value.providerDisplayName(),
                enumValue(OwnerBindingViewCapabilityClass.class, value.capabilityClass(), "capabilityClass"),
                enumValues(OwnerBindingViewBusinessScopeItem.class, value.businessScope(), "businessScope"),
                enumValue(OwnerBindingViewNodeType.class, value.nodeType(), "nodeType"),
                uuid(value.nodeRef(), "nodeRef"),
                value.nodePath().stream()
                        .map(ExternalCollaborationWireMapper::nodePath)
                        .toList(),
                text(value.bindingDisplayName()),
                text(value.externalOwnerId()),
                value.boundAt(),
                value.statusChangedAt(),
                enumValue(OwnerBindingViewStatus.class, value.status(), "status"),
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

    public static String optionalText(String value, String field) {
        return value;
    }

    private static ExternalCapability capability(CollaborationReadback.Capability value) {
        return new ExternalCapability(
                enumValue(ExternalCapabilityCapabilityClass.class, value.capabilityClass(), "capabilityClass"),
                value.displayName(),
                attributeValues(value.attributeValues()));
    }

    private static ExternalCapabilityAttributeValues attributeValues(com.fasterxml.jackson.databind.JsonNode value) {
        if (value == null || value.isNull()) return new ExternalCapabilityAttributeValues(null, null);
        return new ExternalCapabilityAttributeValues(
                enumValue(
                        ExternalCapabilityAttributeValuesGroupBuyMappingDirection.class,
                        textValue(value, "groupBuyMappingDirection"),
                        "groupBuyMappingDirection"),
                enumValue(
                        ExternalCapabilityAttributeValuesMenuCollaborationDirection.class,
                        textValue(value, "menuCollaborationDirection"),
                        "menuCollaborationDirection"));
    }

    private static <E extends Enum<E>> E enumValue(Class<E> type, String value, String field) {
        if (value == null) return null;
        try {
            return Enum.valueOf(type, value);
        } catch (IllegalArgumentException failure) {
            throw new IllegalStateException(field + " is not a supported closed value: " + value, failure);
        }
    }

    private static <E extends Enum<E>> List<E> enumValues(Class<E> type, List<String> values, String field) {
        return values.stream().map(value -> enumValue(type, value, field)).toList();
    }

    private static String textValue(com.fasterxml.jackson.databind.JsonNode value, String field) {
        com.fasterxml.jackson.databind.JsonNode child = value.get(field);
        return child == null || child.isNull() ? null : child.asText();
    }

    private static OrganizationPathNode nodePath(CollaborationReadback.OrganizationPathNode value) {
        return new OrganizationPathNode(value.ref(), value.code(), value.name(), serviceNodeType(value.nodeType()));
    }

    private static ServiceNodeType serviceNodeType(String value) {
        return switch (value) {
            case "COMMERCIAL_GROUP", "GROUP" -> ServiceNodeType.GROUP;
            case "REGION" -> ServiceNodeType.REGION;
            case "PROJECT" -> ServiceNodeType.PROJECT;
            case "HEAD_COMPANY" -> ServiceNodeType.HEAD_COMPANY;
            case "STORE" -> ServiceNodeType.STORE;
            default -> throw new IllegalStateException("unsupported collaboration path node type: " + value);
        };
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
}
