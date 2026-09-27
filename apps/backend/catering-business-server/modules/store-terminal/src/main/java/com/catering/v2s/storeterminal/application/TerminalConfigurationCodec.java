package com.catering.v2s.storeterminal.application;

import com.catering.v2s.storeterminal.domain.PrinterSpecification;
import com.catering.v2s.storeterminal.domain.TerminalConfiguration;
import com.catering.v2s.storeterminal.domain.TerminalConfiguration.ChildIdentity;
import com.catering.v2s.storeterminal.domain.TerminalConfiguration.Function;
import com.catering.v2s.storeterminal.domain.TerminalConfiguration.Printer;
import com.catering.v2s.storeterminal.domain.TerminalConfiguration.PrinterBinding;
import com.catering.v2s.storeterminal.domain.TerminalConfiguration.RangeSelection;
import com.catering.v2s.storeterminal.domain.TerminalConfiguration.SceneSelection;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/** Validates request-local identities, assigns stable refs, and stores no clientKey in the owner document. */
final class TerminalConfigurationCodec {
    private final ObjectMapper json;

    TerminalConfigurationCodec(ObjectMapper json) {
        this.json = Objects.requireNonNull(json, "json");
    }

    Normalized normalize(String deviceType, JsonNode input, JsonNode priorDocument) {
        if (input == null || !input.isObject()) throw invalid();
        Set<UUID> priorPrinterRefs = refs(priorDocument == null ? null : priorDocument.path("printers"));
        Set<UUID> priorFunctionRefs = refs(priorDocument == null ? null : priorDocument.path("functions"));
        Map<UUID, String> priorFunctionKeys =
                functionKeys(priorDocument == null ? null : priorDocument.path("functions"));
        Set<String> clientKeys = new HashSet<>();
        Map<String, UUID> printerClientRefs = new HashMap<>();
        List<Printer> printers = new ArrayList<>();
        ObjectNode normalized = json.createObjectNode();
        ArrayNode normalizedPrinters = normalized.putArray("printers");
        JsonNode inputPrinters = input.path("printers");
        if (!inputPrinters.isArray()) throw invalid();
        for (JsonNode value : inputPrinters) {
            ChildIdentity identity = identity(value, priorPrinterRefs, clientKeys);
            UUID ref = identity.ref() == null ? UUID.randomUUID() : identity.ref();
            if (identity.clientKey() != null) printerClientRefs.put(identity.clientKey(), ref);
            String name = text(value, "name");
            PrinterSpecification specification = PrinterSpecification.of(
                    text(value, "brandKey"),
                    text(value, "modelKey"),
                    text(value, "paperSpecKey"),
                    text(value, "connectionMethodKey"),
                    optionalText(value, "connectionParameter"));
            printers.add(new Printer(new ChildIdentity(ref, null), name, specification));
            ObjectNode out = normalizedPrinters
                    .addObject()
                    .put("ref", ref.toString())
                    .put("name", name)
                    .put("brandKey", specification.brandKey())
                    .put("modelKey", specification.modelKey())
                    .put("paperSpecKey", specification.paperSpecKey())
                    .put("connectionMethodKey", specification.connectionMethodKey());
            if (specification.connectionParameter() != null) {
                out.put("connectionParameter", specification.connectionParameter());
            }
        }

        JsonNode inputFunctions = input.path("functions");
        if (!inputFunctions.isArray()) throw invalid();
        List<Function> functions = new ArrayList<>();
        ArrayNode normalizedFunctions = normalized.putArray("functions");
        for (JsonNode value : inputFunctions) {
            ChildIdentity identity = identity(value, priorFunctionRefs, clientKeys);
            UUID ref = identity.ref() == null ? UUID.randomUUID() : identity.ref();
            String key = text(value, "functionKey");
            if (identity.ref() != null && !key.equals(priorFunctionKeys.get(identity.ref()))) {
                throw invalid();
            }
            List<RangeSelection> ranges = readRanges(value.path("ranges"));
            ArrayNode rangesNode = normalizedFunctions
                    .addObject()
                    .put("ref", ref.toString())
                    .put("functionKey", key)
                    .putArray("ranges");
            ObjectNode functionNode = (ObjectNode) normalizedFunctions.get(normalizedFunctions.size() - 1);
            ArrayNode normalizedRanges = (ArrayNode) functionNode.get("ranges");
            for (RangeSelection range : ranges) {
                ObjectNode rangeNode =
                        normalizedRanges.addObject().put("key", range.key()).put("all", range.all());
                ArrayNode refsNode = rangeNode.putArray("refs");
                range.refs().forEach(item -> refsNode.add(item.toString()));
            }

            JsonNode scenesNode = value.path("scenes");
            if (!scenesNode.isArray()) throw invalid();
            ArrayNode normalizedScenes = functionNode.putArray("scenes");
            List<SceneSelection> scenes = new ArrayList<>();
            for (JsonNode sceneValue : scenesNode) {
                String sceneKey = text(sceneValue, "sceneKey");
                List<String> orderTypes = stringList(sceneValue.path("orderTypes"));
                List<PrinterBinding> bindings = new ArrayList<>();
                ArrayNode normalizedBindings =
                        normalizedScenes.addObject().put("sceneKey", sceneKey).putArray("orderTypes");
                ObjectNode normalizedScene = (ObjectNode) normalizedScenes.get(normalizedScenes.size() - 1);
                ArrayNode normalizedOrderTypes = (ArrayNode) normalizedScene.get("orderTypes");
                orderTypes.forEach(normalizedOrderTypes::add);
                ArrayNode printerBindings = normalizedScene.putArray("printers");
                JsonNode requestedBindings = sceneValue.path("printers");
                if (!requestedBindings.isArray()) throw invalid();
                for (JsonNode requestedBinding : requestedBindings) {
                    UUID printerRef = bindingRef(requestedBinding, printerClientRefs);
                    bindings.add(new PrinterBinding(new ChildIdentity(printerRef, null)));
                    printerBindings.addObject().put("printerRef", printerRef.toString());
                }
                scenes.add(new SceneSelection(sceneKey, orderTypes, bindings));
            }
            functions.add(new Function(new ChildIdentity(ref, null), key, ranges, scenes));
        }

        TerminalConfiguration configuration = TerminalConfiguration.create(deviceType, printers, functions);
        return new Normalized(normalized, configuration, clientKeys);
    }

    private List<RangeSelection> readRanges(JsonNode values) {
        if (!values.isArray()) throw invalid();
        List<RangeSelection> result = new ArrayList<>();
        for (JsonNode value : values) {
            String key = text(value, "key");
            JsonNode allValue = value.path("all");
            if (!allValue.isBoolean()) throw invalid();
            List<UUID> refs = uuidList(value.path("refs"));
            result.add(new RangeSelection(key, allValue.booleanValue(), refs));
        }
        return List.copyOf(result);
    }

    private ChildIdentity identity(JsonNode node, Set<UUID> priorRefs, Set<String> clientKeys) {
        String ref = optionalText(node, "ref");
        String clientKey = optionalText(node, "clientKey");
        if ((ref == null) == (clientKey == null)) throw invalid();
        if (ref != null) {
            try {
                UUID parsed = UUID.fromString(ref);
                if (!priorRefs.contains(parsed)) throw invalid();
                return new ChildIdentity(parsed, null);
            } catch (IllegalArgumentException malformedOrForeign) {
                throw invalid(malformedOrForeign);
            }
        }
        if (clientKey.isBlank() || !clientKeys.add(clientKey)) throw invalid();
        return new ChildIdentity(null, clientKey);
    }

    private UUID bindingRef(JsonNode binding, Map<String, UUID> printerClientRefs) {
        String ref = optionalText(binding, "printerRef");
        String clientKey = optionalText(binding, "printerClientKey");
        if ((ref == null) == (clientKey == null)) throw invalid();
        if (clientKey != null) {
            UUID resolved = printerClientRefs.get(clientKey);
            if (resolved == null) throw invalid();
            return resolved;
        }
        try {
            return UUID.fromString(ref);
        } catch (IllegalArgumentException malformed) {
            throw invalid(malformed);
        }
    }

    private Set<UUID> refs(JsonNode values) {
        if (values == null || !values.isArray()) return Set.of();
        Set<UUID> result = new HashSet<>();
        for (JsonNode value : values) {
            try {
                result.add(UUID.fromString(text(value, "ref")));
            } catch (IllegalArgumentException invalid) {
                throw invalid(invalid);
            }
        }
        return result;
    }

    private Map<UUID, String> functionKeys(JsonNode values) {
        if (values == null || !values.isArray()) return Map.of();
        Map<UUID, String> result = new HashMap<>();
        for (JsonNode value : values) {
            UUID ref;
            try {
                ref = UUID.fromString(text(value, "ref"));
            } catch (IllegalArgumentException invalid) {
                throw invalid(invalid);
            }
            String key = text(value, "functionKey");
            if (result.putIfAbsent(ref, key) != null) throw invalid();
        }
        return result;
    }

    private static List<UUID> uuidList(JsonNode values) {
        if (!values.isArray()) throw invalid();
        List<UUID> result = new ArrayList<>();
        for (JsonNode value : values) {
            if (!value.isTextual()) throw invalid();
            try {
                result.add(UUID.fromString(value.textValue()));
            } catch (IllegalArgumentException invalid) {
                throw invalid(invalid);
            }
        }
        return List.copyOf(result);
    }

    private static List<String> stringList(JsonNode values) {
        if (!values.isArray()) throw invalid();
        List<String> result = new ArrayList<>();
        for (JsonNode value : values) {
            if (!value.isTextual() || value.textValue().isBlank()) throw invalid();
            result.add(value.textValue());
        }
        return List.copyOf(result);
    }

    private static String text(JsonNode node, String key) {
        String value = optionalText(node, key);
        if (value == null) throw invalid();
        return value;
    }

    private static String optionalText(JsonNode node, String key) {
        JsonNode value = node.get(key);
        return value == null || value.isNull() ? null : value.isTextual() ? value.textValue() : throwInvalid();
    }

    private static String throwInvalid() {
        throw invalid();
    }

    private static IllegalArgumentException invalid() {
        return new IllegalArgumentException("terminal configuration is invalid");
    }

    private static IllegalArgumentException invalid(Throwable cause) {
        return new IllegalArgumentException("terminal configuration is invalid", cause);
    }

    record Normalized(ObjectNode document, TerminalConfiguration configuration, Set<String> clientKeys) {
        Normalized {
            document = document.deepCopy();
            clientKeys = Set.copyOf(clientKeys);
        }
    }
}
