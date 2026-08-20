package com.catering.v2s.platform.foundation.collection;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Base64;
import java.util.Objects;
import java.util.UUID;

/** Encodes a collection query frontier without exposing its SQL offset to consumers. */
public final class OpaqueCollectionCursor {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();

    private OpaqueCollectionCursor() {}

    public static String encode(String queryIdentity, String sortKey, UUID tieBreaker) {
        Objects.requireNonNull(queryIdentity, "queryIdentity");
        Objects.requireNonNull(sortKey, "sortKey");
        Objects.requireNonNull(tieBreaker, "tieBreaker");
        try {
            byte[] payload = JSON.writeValueAsBytes(JSON.createObjectNode()
                    .put("version", 1)
                    .put("query", queryIdentity)
                    .put("key", sortKey)
                    .put("tie", tieBreaker.toString()));
            return ENCODER.encodeToString(payload);
        } catch (JsonProcessingException failure) {
            throw new IllegalStateException("collection cursor cannot be encoded", failure);
        }
    }

    public static Position decode(String token, String queryIdentity) {
        if (token == null || token.isBlank()) return null;
        Objects.requireNonNull(queryIdentity, "queryIdentity");
        try {
            JsonNode value = JSON.readTree(DECODER.decode(token));
            if (value == null
                    || value.path("version").asInt(-1) != 1
                    || !queryIdentity.equals(value.path("query").asText(null))) {
                throw new InvalidCursor("cursor does not belong to this query");
            }
            String sortKey = value.path("key").asText(null);
            UUID tieBreaker = UUID.fromString(value.path("tie").asText());
            if (sortKey == null) throw new InvalidCursor("cursor frontier is incomplete");
            return new Position(sortKey, tieBreaker);
        } catch (InvalidCursor failure) {
            throw failure;
        } catch (Exception failure) {
            throw new InvalidCursor("cursor is invalid", failure);
        }
    }

    public record Position(String sortKey, UUID tieBreaker) {}

    public static final class InvalidCursor extends IllegalArgumentException {
        public InvalidCursor(String message) {
            super(message);
        }

        public InvalidCursor(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
