package com.catering.v2s.app.edge.extension;

import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.extension.api.ExtensionSubmission;
import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Converts the JSON-object extension payload to the owner-native typed field list. */
public final class ExtensionSubmissionWireMapper {
    private static final ObjectMapper JSON = new ObjectMapper();

    private ExtensionSubmissionWireMapper() {}

    public static ExtensionSubmission toSubmission(JsonNode values) {
        if (values == null || values.isNull()) return new ExtensionSubmission(List.of());
        if (values.isObject()) return objectValues(values);
        throw new InvalidEdgeRequestException("extension values must be a JSON object");
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

}
