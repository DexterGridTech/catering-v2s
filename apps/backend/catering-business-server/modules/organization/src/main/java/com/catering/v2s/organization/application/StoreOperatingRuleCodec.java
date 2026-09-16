package com.catering.v2s.organization.application;

import com.catering.v2s.organization.domain.generated.StoreOperatingRuleCatalog;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.Serializable;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/** JSON boundary for the generated Store operating-rule catalog. */
public final class StoreOperatingRuleCodec {
    private static final ObjectMapper JSON = new ObjectMapper();

    private StoreOperatingRuleCodec() {}

    /** Validates a command object and returns its catalog-order copy. */
    public static Map<String, Serializable> commandValues(Map<String, ?> values, boolean requireComplete) {
        try {
            StoreOperatingRuleCatalog.validate(values, requireComplete);
        } catch (IllegalArgumentException invalid) {
            throw new InvalidValuesException(invalid);
        }
        if (values == null || values.isEmpty()) return Map.of();
        return orderedCopy(values);
    }

    /** Owner-boundary validation that remains distinguishable from unrelated Store validation. */
    public static final class InvalidValuesException extends IllegalArgumentException {
        public InvalidValuesException(Throwable cause) {
            super("operating rule values are invalid", cause);
        }
    }

    /** Converts stored values to the complete resolved map, applying defaults and ignoring unknown persisted keys. */
    public static Map<String, Serializable> resolved(String source) {
        Map<String, Serializable> stored = decode(source);
        var known = new LinkedHashMap<String, Serializable>();
        for (StoreOperatingRuleCatalog.Definition definition : StoreOperatingRuleCatalog.definitions()) {
            if (stored.containsKey(definition.key()))
                known.put(definition.key(), (Serializable) stored.get(definition.key()));
        }
        var complete = new LinkedHashMap<String, Serializable>(StoreOperatingRuleCatalog.defaults());
        complete.putAll(known);
        return Collections.unmodifiableMap(new LinkedHashMap<>(StoreOperatingRuleCatalog.resolved(complete)));
    }

    public static String stored(StoreOperatingRuleCatalog.Values values) {
        return stored(values == null ? null : values.asMap());
    }

    /** Keeps create omission as an empty stored object; a supplied object is stored in catalog order. */
    public static String stored(Map<String, ?> values) {
        if (values == null || values.isEmpty()) return "{}";
        Map<String, ?> ordered = commandValues(values, true);
        try {
            return JSON.writeValueAsString(ordered);
        } catch (IOException failure) {
            throw new IllegalArgumentException("operating rule values cannot be encoded", failure);
        }
    }

    public static Map<String, Serializable> decode(String source) {
        if (source == null || source.isBlank()) return Map.of();
        try {
            JsonNode node = JSON.readTree(source);
            if (node == null || !node.isObject()) throw new IllegalArgumentException("operating rule JSON must be an object");
            var values = new LinkedHashMap<String, Serializable>();
            node.fields().forEachRemaining(
                    entry -> values.put(entry.getKey(), (Serializable) scalar(entry.getValue())));
            return values;
        } catch (IOException failure) {
            throw new IllegalArgumentException("operating rule JSON is invalid", failure);
        }
    }

    private static Map<String, Serializable> orderedCopy(Map<String, ?> values) {
        var ordered = new LinkedHashMap<String, Serializable>();
        for (StoreOperatingRuleCatalog.Definition definition : StoreOperatingRuleCatalog.definitions())
            ordered.put(definition.key(), (Serializable) values.get(definition.key()));
        return Collections.unmodifiableMap(ordered);
    }

    private static Object scalar(JsonNode value) {
        if (value == null || value.isNull()) return null;
        if (value.isBoolean()) return value.booleanValue();
        if (value.isNumber()) return value.numberValue();
        if (value.isTextual()) return value.textValue();
        throw new IllegalArgumentException("operating rule value must be scalar");
    }
}
