package com.catering.v2s.audit.contract;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import com.fasterxml.jackson.databind.node.ArrayNode;

/** Strict wire-safe codec for the fixed audit change triplet; no nested values are accepted. */
public final class AuditChangeJson {
    private static final ObjectMapper JSON = new ObjectMapper();
    private AuditChangeJson() { }

    public static List<AuditChange> read(String source) {
        try {
            JsonNode root = JSON.readTree(source);
            if (!root.isArray()) throw new IllegalArgumentException("audit changes must be an array");
            List<AuditChange> result = new ArrayList<>();
            for (JsonNode node : root) {
                if (!node.isObject() || !node.has("fieldKey") || !node.path("fieldKey").isTextual() || (node.has("before") && !node.path("before").isTextual() && !node.path("before").isNull()) || (node.has("after") && !node.path("after").isTextual() && !node.path("after").isNull())) throw new IllegalArgumentException("audit change shape is invalid");
                result.add(new AuditChange(node.path("fieldKey").asText(), node.path("before").isMissingNode() || node.path("before").isNull() ? null : node.path("before").asText(), node.path("after").isMissingNode() || node.path("after").isNull() ? null : node.path("after").asText()));
            }
            return List.copyOf(result);
        } catch (Exception failure) { throw new IllegalArgumentException("audit changes are invalid", failure); }
    }

    /** The single strict writer for audit change arrays; values remain scalar and display-safe. */
    public static String write(List<AuditChange> changes) {
        if (changes == null) throw new IllegalArgumentException("audit changes are required");
        ArrayNode root = JSON.createArrayNode();
        for (AuditChange change : changes) {
            if (change == null) throw new IllegalArgumentException("audit change is required");
            var node = root.addObject();
            node.put("fieldKey", change.fieldKey());
            if (change.beforeValue() != null) node.put("before", change.beforeValue());
            if (change.afterValue() != null) node.put("after", change.afterValue());
        }
        try { return JSON.writeValueAsString(root); }
        catch (Exception failure) { throw new IllegalArgumentException("audit changes are not writable", failure); }
    }
}
