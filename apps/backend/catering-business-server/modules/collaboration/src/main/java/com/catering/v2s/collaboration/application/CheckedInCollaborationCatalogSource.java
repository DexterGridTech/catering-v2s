package com.catering.v2s.collaboration.application;

import com.catering.v2s.collaboration.api.CollaborationCatalogSource;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Runtime adapter for the checked-in collaboration contract catalogue.
 *
 * <p>The resource is copied from {@code contracts/collaboration} by this module's resource source set. It is parsed
 * once at application startup and is never persisted in collaboration tables.
 */
@Component
public final class CheckedInCollaborationCatalogSource implements CollaborationCatalogSource {
    private static final String RESOURCE = "external-platform-catalog.json";
    private static final Set<String> CATALOG_STATUSES = Set.of("PLANNED", "AVAILABLE");
    private static final Set<String> AUTHENTICATION_KINDS = Set.of("EXTERNAL_GRANT", "INTERNAL_MAPPING", "NO_MAPPING");
    private static final Set<String> UNBIND_KINDS = Set.of("LOCAL_ONLY", "REQUIRES_ADAPTER_UNBIND");
    private static final Set<String> CAPABILITY_CLASSES = Set.of(
            "MASTER_DATA_SYNC",
            "MEMBER_BENEFIT",
            "GROUP_BUY",
            "TAKEAWAY",
            "INVENTORY_SYNC",
            "TAKEAWAY_DELIVERY",
            "ORDER_SYNC");
    private static final Set<String> NODE_TYPES =
            Set.of("COMMERCIAL_GROUP", "REGION", "PROJECT", "HEAD_COMPANY", "STORE");

    private final List<ExternalSystemDefinition> externalSystems;
    private final List<ProviderProfileDefinition> providerProfiles;
    private final Map<String, ExternalSystemDefinition> externalSystemsByCode;
    private final Map<String, ProviderProfileDefinition> providerProfilesByCode;

    public CheckedInCollaborationCatalogSource(ObjectMapper mapper) {
        Catalog catalog = load(mapper);
        this.externalSystems = catalog.externalSystems();
        this.providerProfiles = catalog.providerProfiles();
        this.externalSystemsByCode = indexExternalSystems(externalSystems);
        this.providerProfilesByCode = indexProviderProfiles(providerProfiles);
    }

    @Override
    public ExternalSystemDefinition externalSystem(String externalSystemCode) {
        return externalSystemsByCode.get(externalSystemCode);
    }

    @Override
    public ProviderProfileDefinition providerProfile(String providerCode) {
        return providerProfilesByCode.get(providerCode);
    }

    @Override
    public List<ExternalSystemDefinition> externalSystems() {
        return externalSystems;
    }

    @Override
    public List<ProviderProfileDefinition> providerProfiles() {
        return providerProfiles;
    }

    private static Catalog load(ObjectMapper mapper) {
        Objects.requireNonNull(mapper, "mapper");
        try (InputStream stream =
                CheckedInCollaborationCatalogSource.class.getClassLoader().getResourceAsStream(RESOURCE)) {
            if (stream == null) throw invalid("checked-in collaboration catalogue resource is missing");
            JsonNode root = mapper.readTree(stream);
            if (root == null || root.path("schemaVersion").asInt(-1) != 1) {
                throw invalid("collaboration catalogue schemaVersion is unsupported");
            }
            Map<String, ExternalSystemDefinition> systems = readExternalSystems(root.path("externalSystems"));
            List<ProviderProfileDefinition> providers = readProviderProfiles(root.path("providerProfiles"), systems);
            if (systems.isEmpty() || providers.isEmpty()) throw invalid("collaboration catalogue is empty");
            return new Catalog(List.copyOf(systems.values()), List.copyOf(providers));
        } catch (IOException | IllegalArgumentException failure) {
            throw new IllegalStateException("checked-in collaboration catalogue is unreadable", failure);
        }
    }

    private static Map<String, ExternalSystemDefinition> readExternalSystems(JsonNode values) {
        requireArray(values, "externalSystems");
        Map<String, ExternalSystemDefinition> result = new LinkedHashMap<>();
        for (JsonNode value : values) {
            String code = text(value, "externalSystemCode");
            if (result.containsKey(code)) throw invalid("duplicate external system code: " + code);
            String status = text(value, "catalogStatus");
            requireOneOf(status, CATALOG_STATUSES, "catalogStatus");
            List<CapabilityDefinition> capabilities = new ArrayList<>();
            Set<String> capabilityCodes = new java.util.HashSet<>();
            JsonNode capabilityValues = value.path("capabilities");
            requireNonEmptyArray(capabilityValues, "capabilities");
            for (JsonNode capability : capabilityValues) {
                String capabilityClass = text(capability, "capabilityClass");
                requireOneOf(capabilityClass, CAPABILITY_CLASSES, "capabilityClass");
                if (!capabilityCodes.add(capabilityClass)) {
                    throw invalid("duplicate capability class for external system: " + code);
                }
                JsonNode attributeData = capability.path("attributeValues");
                if (!attributeData.isObject()) throw invalid("capability attributeValues must be an object");
                capabilities.add(new CapabilityDefinition(
                        capabilityClass, text(capability, "displayName"), attributeData.deepCopy()));
            }
            result.put(code, new ExternalSystemDefinition(code, text(value, "displayName"), status, capabilities));
        }
        return result;
    }

    private static List<ProviderProfileDefinition> readProviderProfiles(
            JsonNode values, Map<String, ExternalSystemDefinition> systems) {
        requireArray(values, "providerProfiles");
        List<ProviderProfileDefinition> result = new ArrayList<>();
        Set<String> providerCodes = new java.util.HashSet<>();
        for (JsonNode value : values) {
            String providerCode = text(value, "providerCode");
            if (!providerCodes.add(providerCode)) throw invalid("duplicate provider code: " + providerCode);
            String externalSystemCode = text(value, "externalSystemCode");
            ExternalSystemDefinition system = systems.get(externalSystemCode);
            if (system == null) throw invalid("provider references unknown external system: " + externalSystemCode);
            List<String> businessScope = texts(value, "businessScope", true);
            Set<String> systemCapabilities = system.capabilities().stream()
                    .map(CapabilityDefinition::capabilityClass)
                    .collect(java.util.stream.Collectors.toSet());
            if (!systemCapabilities.containsAll(businessScope)) {
                throw invalid("provider businessScope exceeds external system capabilities: " + providerCode);
            }
            List<String> bindableNodeTypes = texts(value, "bindableNodeTypes", true);
            bindableNodeTypes.forEach(nodeType -> requireOneOf(nodeType, NODE_TYPES, "bindableNodeTypes"));
            String authenticationKind = text(value, "authenticationKind");
            requireOneOf(authenticationKind, AUTHENTICATION_KINDS, "authenticationKind");
            String unbindKind = text(value, "unbindKind");
            requireOneOf(unbindKind, UNBIND_KINDS, "unbindKind");
            String catalogStatus = text(value, "catalogStatus");
            requireOneOf(catalogStatus, CATALOG_STATUSES, "catalogStatus");
            result.add(new ProviderProfileDefinition(
                    providerCode,
                    text(value, "displayName"),
                    externalSystemCode,
                    businessScope,
                    bindableNodeTypes,
                    authenticationKind,
                    unbindKind,
                    catalogStatus));
        }
        return List.copyOf(result);
    }

    private static List<String> texts(JsonNode parent, String field, boolean requireNonEmpty) {
        JsonNode values = parent.path(field);
        if (!values.isArray() || (requireNonEmpty && values.isEmpty())) {
            throw invalid(field + " must be a non-empty array");
        }
        List<String> result = new ArrayList<>();
        for (JsonNode value : values) {
            if (!value.isTextual() || value.asText().isBlank()) {
                throw invalid(field + " must contain non-empty text");
            }
            result.add(value.asText());
        }
        return List.copyOf(result);
    }

    private static String text(JsonNode parent, String field) {
        JsonNode value = parent.path(field);
        if (!value.isTextual() || value.asText().isBlank()) throw invalid(field + " must be non-empty text");
        return value.asText();
    }

    private static void requireArray(JsonNode value, String field) {
        if (!value.isArray()) throw invalid(field + " must be an array");
    }

    private static void requireNonEmptyArray(JsonNode value, String field) {
        requireArray(value, field);
        if (value.isEmpty()) throw invalid(field + " must not be empty");
    }

    private static void requireOneOf(String value, Set<String> allowed, String field) {
        if (!allowed.contains(value)) throw invalid(field + " contains unsupported value: " + value);
    }

    private static Map<String, ExternalSystemDefinition> indexExternalSystems(List<ExternalSystemDefinition> values) {
        Map<String, ExternalSystemDefinition> result = new LinkedHashMap<>();
        values.forEach(value -> result.put(value.externalSystemCode(), value));
        return Collections.unmodifiableMap(result);
    }

    private static Map<String, ProviderProfileDefinition> indexProviderProfiles(
            List<ProviderProfileDefinition> values) {
        Map<String, ProviderProfileDefinition> result = new LinkedHashMap<>();
        values.forEach(value -> result.put(value.providerCode(), value));
        return Collections.unmodifiableMap(result);
    }

    private static IllegalStateException invalid(String message) {
        return new IllegalStateException(message);
    }

    private record Catalog(
            List<ExternalSystemDefinition> externalSystems, List<ProviderProfileDefinition> providerProfiles) {}
}
