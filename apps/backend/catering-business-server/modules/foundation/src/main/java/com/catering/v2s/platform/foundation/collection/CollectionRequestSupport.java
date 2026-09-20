package com.catering.v2s.platform.foundation.collection;

import com.fasterxml.jackson.databind.JsonNode;

/** Shared parsing for collection request boundaries; owners map invalid values to their own problem codes. */
public final class CollectionRequestSupport {
    private CollectionRequestSupport() {}

    public static String optional(JsonNode request, String key) {
        JsonNode value = request == null ? null : request.get(key);
        return value == null || value.isNull() ? null : value.asText();
    }

    public static int pageSize(JsonNode request, String key, int fallback) {
        String value = optional(request, key);
        return pageSizeValue(value, key, fallback);
    }

    public static int pageSize(String value, String key, int fallback) {
        return pageSizeValue(value, key, fallback);
    }

    private static int pageSizeValue(String value, String key, int fallback) {
        if (value == null || value.isBlank()) return fallback;
        try {
            int parsed = Integer.parseInt(value);
            if (parsed < 1 || parsed > 100) throw new NumberFormatException();
            return parsed;
        } catch (NumberFormatException failure) {
            throw new InvalidRequestValue(key, key + " must be between 1 and 100", failure);
        }
    }

    public static long cursor(JsonNode request, String key) {
        String value = optional(request, key);
        return cursorValue(value, key);
    }

    public static long cursor(String value, String key) {
        return cursorValue(value, key);
    }

    private static long cursorValue(String value, String key) {
        if (value == null || value.isBlank()) return 0L;
        try {
            long parsed = Long.parseLong(value);
            if (parsed < 0) throw new NumberFormatException();
            return parsed;
        } catch (NumberFormatException failure) {
            throw new InvalidRequestValue(key, key + " must be a non-negative opaque cursor", failure);
        }
    }

    public static boolean booleanValue(JsonNode request, String key, boolean fallback) {
        String value = optional(request, key);
        if (value == null || value.isBlank()) return fallback;
        if (request != null && request.path(key).isBoolean()) return request.path(key).asBoolean();
        if ("true".equalsIgnoreCase(value)) return true;
        if ("false".equalsIgnoreCase(value)) return false;
        throw new InvalidRequestValue(key, key + " must be boolean");
    }

    public static final class InvalidRequestValue extends IllegalArgumentException {
        private final String field;

        public InvalidRequestValue(String field, String message) {
            super(message);
            this.field = field;
        }

        public InvalidRequestValue(String field, String message, Throwable cause) {
            super(message, cause);
            this.field = field;
        }

        public String field() {
            return field;
        }
    }
}
