package com.catering.v2s.app.edge.diagnostic;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/** Reads the generated edge route/owner/consumer truth without deriving operation identity from input. */
public final class EdgeRouteFaceRegistry {
    private EdgeRouteFaceRegistry() { }

    public static Map<String, Definition> load(ObjectMapper mapper) {
        try {
            Map<String, Definition> result = new HashMap<>();
            loadResource(mapper, "generated/edge-route-face-registry.json", result, false);
            return Map.copyOf(result);
        } catch (IOException error) {
            throw new IllegalStateException("generated edge route registry unreadable", error);
        }
    }

    /** Extended runtime observation registry; the historical R5 base registry remains byte-stable. */
    public static Map<String, Definition> loadExtended(ObjectMapper mapper) {
        try {
            Map<String, Definition> result = new HashMap<>();
            loadResource(mapper, "generated/edge-route-face-registry.json", result, false);
            // The catalog generator stores contract-relative paths while the
            // Spring edge is mounted below /api. Normalize this supplemental
            // registry only at the diagnostics boundary.
            loadResource(mapper, "generated/catalog-inventory-edge-route-registry.json", result, true);
            return Map.copyOf(result);
        } catch (IOException error) {
            throw new IllegalStateException("generated edge route registry unreadable", error);
        }
    }

    private static void loadResource(ObjectMapper mapper, String resource, Map<String, Definition> result, boolean apiPrefix) throws IOException {
        try (InputStream stream = EdgeRouteFaceRegistry.class.getClassLoader().getResourceAsStream(resource)) {
            if (stream == null) {
                if (resource.contains("catalog-inventory")) return;
                throw new IllegalStateException("generated edge route registry missing");
            }
            JsonNode root = mapper.readTree(stream);
            for (JsonNode entry : root.path("operations")) {
                String operationId = entry.path("operationId").asText();
                String method = entry.path("method").asText().toUpperCase(java.util.Locale.ROOT);
                String path = entry.path("path").asText();
                if (apiPrefix && !path.startsWith("/api/")) path = "/api" + (path.startsWith("/") ? path : "/" + path);
                String owner = entry.path("owner").asText();
                JsonNode faces = entry.path("consumerFaces");
                if (operationId.isBlank() || path.isBlank() || owner.isBlank() || !faces.isArray() || faces.size() != 1 || faces.get(0).asText().isBlank()) throw new IllegalStateException("invalid generated edge route registry");
                String key = method + " " + path;
                if (result.put(key, new Definition(operationId, method, path, owner, faces.get(0).asText())) != null) throw new IllegalStateException("duplicate generated edge route registry entry");
            }
        }
    }

    public record Definition(String operationId, String method, String path, String owner, String consumerFace) { }
}
