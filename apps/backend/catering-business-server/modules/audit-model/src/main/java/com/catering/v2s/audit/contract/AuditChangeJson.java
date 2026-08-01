package com.catering.v2s.audit.contract;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;

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
}
