package com.catering.v2s.audit.contract;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.util.ArrayList;
import java.util.List;

/** Strict wire-safe codec for scalar audit changes; legacy triplets remain readable without guessing empty state. */
public final class AuditChangeJson {
    private static final ObjectMapper JSON = new ObjectMapper();

    private AuditChangeJson() {}

    public static List<AuditChange> read(String source) {
        try {
            JsonNode root = JSON.readTree(source);
            if (!root.isArray()) throw new IllegalArgumentException("audit changes must be an array");
            List<AuditChange> result = new ArrayList<>();
            for (JsonNode node : root) {
                if (!node.isObject()
                        || !node.has("fieldKey")
                        || !node.path("fieldKey").isTextual()
                        || (node.has("fieldLabelSnapshot")
                                && !node.path("fieldLabelSnapshot").isTextual()
                                && !node.path("fieldLabelSnapshot").isNull())
                        || (node.has("beforeState")
                                && !node.path("beforeState").isTextual()
                                && !node.path("beforeState").isNull())
                        || (node.has("afterState")
                                && !node.path("afterState").isTextual()
                                && !node.path("afterState").isNull())
                        || (node.has("beforeValue")
                                && !node.path("beforeValue").isTextual()
                                && !node.path("beforeValue").isNull())
                        || (node.has("afterValue")
                                && !node.path("afterValue").isTextual()
                                && !node.path("afterValue").isNull())
                        || (node.has("before")
                                && !node.path("before").isTextual()
                                && !node.path("before").isNull())
                        || (node.has("after")
                                && !node.path("after").isTextual()
                                && !node.path("after").isNull()))
                    throw new IllegalArgumentException("audit change shape is invalid");
                AuditValueState beforeState = state(node, "beforeState");
                AuditValueState afterState = state(node, "afterState");
                String before = scalar(node, "beforeValue", "before");
                String after = scalar(node, "afterValue", "after");
                result.add(new AuditChange(
                        node.path("fieldKey").asText(),
                        node.path("fieldLabelSnapshot").isTextual()
                                ? node.path("fieldLabelSnapshot").asText()
                                : null,
                        beforeState,
                        before,
                        afterState,
                        after));
            }
            return List.copyOf(result);
        } catch (Exception failure) {
            throw new IllegalArgumentException("audit changes are invalid", failure);
        }
    }

    /** The single strict writer for audit change arrays; values remain scalar and display-safe. */
    public static String write(List<AuditChange> changes) {
        if (changes == null) throw new IllegalArgumentException("audit changes are required");
        ArrayNode root = JSON.createArrayNode();
        for (AuditChange change : changes) {
            if (change == null) throw new IllegalArgumentException("audit change is required");
            var node = root.addObject();
            node.put("fieldKey", change.fieldKey());
            if (change.fieldLabelSnapshot() != null) node.put("fieldLabelSnapshot", change.fieldLabelSnapshot());
            if (change.beforeState() != null)
                node.put("beforeState", change.beforeState().name());
            if (change.beforeValue() != null) node.put("beforeValue", change.beforeValue());
            if (change.afterState() != null)
                node.put("afterState", change.afterState().name());
            if (change.afterValue() != null) node.put("afterValue", change.afterValue());
        }
        try {
            return JSON.writeValueAsString(root);
        } catch (Exception failure) {
            throw new IllegalArgumentException("audit changes are not writable", failure);
        }
    }

    private static AuditValueState state(JsonNode node, String field) {
        if (!node.path(field).isTextual()) return null;
        try {
            return AuditValueState.valueOf(node.path(field).asText());
        } catch (IllegalArgumentException failure) {
            throw new IllegalArgumentException("audit value state is invalid", failure);
        }
    }

    private static String scalar(JsonNode node, String preferred, String legacy) {
        JsonNode value = node.has(preferred) ? node.path(preferred) : node.path(legacy);
        return value.isMissingNode() || value.isNull() ? null : value.asText();
    }
}
