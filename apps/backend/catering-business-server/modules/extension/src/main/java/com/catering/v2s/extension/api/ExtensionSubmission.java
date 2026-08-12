package com.catering.v2s.extension.api;

import java.util.List;
import java.util.HashSet;
import java.util.Set;

/**
 * Owner-native submission of dynamic extension fields.
 *
 * <p>An omitted field is not submitted. {@link Mode#SET} carries canonical JSON text that only
 * the extension owner interprets against the current definition; {@link Mode#CLEAR} removes the
 * field and must not encode that business meaning as {@code null} or the string {@code "null"}.
 */
public record ExtensionSubmission(List<ExtensionFieldValue> fields) {
    public ExtensionSubmission {
        fields = fields == null ? List.of() : List.copyOf(fields);
        Set<String> fieldKeys = new HashSet<>();
        for (ExtensionFieldValue field : fields) {
            if (field == null || field.fieldKey() == null || field.fieldKey().isBlank() || field.mode() == null) {
                throw new IllegalArgumentException("extension submission requires a field key and mode");
            }
            if (!fieldKeys.add(field.fieldKey())) {
                throw new IllegalArgumentException("extension submission field keys must be unique");
            }
            if (field.mode() == Mode.SET && (field.valueJson() == null || "null".equals(field.valueJson().trim()))) {
                throw new IllegalArgumentException("extension SET requires canonical JSON distinct from null");
            }
            if (field.mode() == Mode.CLEAR && !"".equals(field.valueJson())) {
                throw new IllegalArgumentException("extension CLEAR must use the explicit empty valueJson sentinel");
            }
        }
    }

    /**
     * One explicitly addressed field. SET carries canonical JSON text; CLEAR carries the empty
     * string so the explicit mode—not a Java null or JSON null—alone carries removal intent.
     */
    public record ExtensionFieldValue(String fieldKey, String valueJson, Mode mode) {
        public static ExtensionFieldValue clear(String fieldKey) {
            return new ExtensionFieldValue(fieldKey, "", Mode.CLEAR);
        }
    }

    /** Explicit mutation intent; absence from {@link ExtensionSubmission#fields()} means no submission. */
    public enum Mode {
        SET,
        CLEAR
    }
}
