package com.catering.v2s.app.edge.extension;

import com.catering.v2s.extension.api.ExtensionSubmission;
import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Converts the current JSON-object extension payload and the legacy field-list payload at the edge. */
public final class ExtensionSubmissionWireMapper {
    private static final ObjectMapper JSON = new ObjectMapper();

    private ExtensionSubmissionWireMapper() {}

    public static ExtensionSubmission toSubmission(JsonNode values) {
        if (values == null || values.isNull()) return new ExtensionSubmission(List.of());
        if (values.isObject()) return objectValues(values);
        if (values.isArray()) return legacyFields(values);
        throw new IllegalArgumentException("extension values must be a JSON object");
    }

    private static ExtensionSubmission objectValues(JsonNode values) {
        List<ExtensionSubmission.ExtensionFieldValue> fields = new ArrayList<>();
        values.properties().forEach(entry -> {
            try {
                if (entry.getValue() == null || entry.getValue().isNull()) {
                    fields.add(ExtensionSubmission.ExtensionFieldValue.clear(entry.getKey()));
                } else {
                    fields.add(new ExtensionSubmission.ExtensionFieldValue(
                            entry.getKey(), JSON.writeValueAsString(entry.getValue()), ExtensionSubmission.Mode.SET));
                }
            } catch (Exception failure) {
                throw new IllegalArgumentException("extension value is not JSON serializable", failure);
            }
        });
        return new ExtensionSubmission(fields);
    }

    private static ExtensionSubmission legacyFields(JsonNode values) {
        List<ExtensionSubmission.ExtensionFieldValue> fields = new ArrayList<>();
        values.forEach(value -> {
            if (!value.isObject()) throw new IllegalArgumentException("extension field must be an object");
            String key = text(value, "fieldKey");
            String mode = text(value, "mode");
            String valueJson = value.path("valueJson").asText("");
            fields.add(new ExtensionSubmission.ExtensionFieldValue(
                    key, valueJson, ExtensionSubmission.Mode.valueOf(mode)));
        });
        return new ExtensionSubmission(fields);
    }

    private static String text(JsonNode value, String field) {
        String result = value.path(field).asText("");
        if (result.isBlank()) throw new IllegalArgumentException(field + " is required");
        return result;
    }
}
