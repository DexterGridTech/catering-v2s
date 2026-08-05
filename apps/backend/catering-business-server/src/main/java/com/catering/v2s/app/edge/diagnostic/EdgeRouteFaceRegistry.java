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
        try (InputStream stream = EdgeRouteFaceRegistry.class.getClassLoader().getResourceAsStream("generated/edge-route-face-registry.json")) {
            if (stream == null) throw new IllegalStateException("generated edge route registry missing");
            JsonNode root = mapper.readTree(stream);
            Map<String, Definition> result = new HashMap<>();
            for (JsonNode entry : root.path("operations")) {
                String operationId = entry.path("operationId").asText();
                String method = entry.path("method").asText().toUpperCase(java.util.Locale.ROOT);
                String path = entry.path("path").asText();
                String owner = entry.path("owner").asText();
                JsonNode faces = entry.path("consumerFaces");
                if (operationId.isBlank() || path.isBlank() || owner.isBlank() || !faces.isArray() || faces.size() != 1 || faces.get(0).asText().isBlank()) {
                    throw new IllegalStateException("invalid generated edge route registry");
                }
                String key = method + " " + path;
                if (result.put(key, new Definition(operationId, method, path, owner, faces.get(0).asText())) != null) {
                    throw new IllegalStateException("duplicate generated edge route registry entry");
                }
            }
            return Map.copyOf(result);
        } catch (IOException error) {
            throw new IllegalStateException("generated edge route registry unreadable", error);
        }
    }

    public record Definition(String operationId, String method, String path, String owner, String consumerFace) { }
}
