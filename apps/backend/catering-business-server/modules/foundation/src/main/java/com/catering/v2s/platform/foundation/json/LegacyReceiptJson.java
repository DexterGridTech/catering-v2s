package com.catering.v2s.platform.foundation.json;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Set;

/** One-shot reader for the pre-Jackson command-receipt projection. */
public final class LegacyReceiptJson {
    private LegacyReceiptJson() {}

    public static boolean looksLikeLegacy(ObjectMapper mapper, String source) {
        try {
            JsonNode root = mapper.readTree(source);
            if (root == null || !root.isObject() || root.isEmpty()) return false;
            var fields = root.fields();
            while (fields.hasNext()) {
                JsonNode value = fields.next().getValue();
                if (!value.isTextual()) return false;
            }
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    public static ObjectNode decode(ObjectMapper mapper, String source, Set<String> listFields, Set<String> mapFields) {
        try {
            JsonNode root = mapper.readTree(source);
            if (root == null || !root.isObject()) throw new IllegalArgumentException("receipt must be a JSON object");
            ObjectNode decoded = mapper.createObjectNode();
            var fields = root.fields();
            while (fields.hasNext()) {
                var field = fields.next();
                String encoded = field.getValue().asText();
                if ("-".equals(encoded)) {
                    decoded.putNull(field.getKey());
                    continue;
                }
                String value = decodeText(encoded);
                if (listFields.contains(field.getKey())) {
                    ArrayNode list = decoded.putArray(field.getKey());
                    if (!value.isEmpty()) for (String part : value.split(",", -1)) list.add(decodeText(part));
                } else if (mapFields.contains(field.getKey())) {
                    ObjectNode map = decoded.putObject(field.getKey());
                    if (!value.isEmpty())
                        for (String part : value.split(",", -1)) {
                            String[] pair = part.split(":", -1);
                            if (pair.length != 2) throw new IllegalArgumentException("invalid encoded receipt map");
                            map.put(decodeText(pair[0]), decodeText(pair[1]));
                        }
                } else {
                    decoded.put(field.getKey(), value);
                }
            }
            return decoded;
        } catch (Exception failure) {
            throw new IllegalArgumentException("legacy receipt JSON is invalid", failure);
        }
    }

    private static String decodeText(String encoded) {
        return new String(Base64.getDecoder().decode(encoded), StandardCharsets.UTF_8);
    }
}
