package com.catering.v2s.platform.foundation.collection;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Canonical, delimiter-safe encoding for the owner dimensions bound into an opaque cursor.
 *
 * <p>Each component is length-prefixed and null is encoded distinctly from the text {@code "null"}. Owners still
 * choose and validate their dimensions; this class only prevents a wire identity from changing when a value contains
 * the old delimiter.
 */
public final class CanonicalCursorIdentity {
    private CanonicalCursorIdentity() {}

    public static String encode(String... components) {
        Objects.requireNonNull(components, "components");
        StringBuilder encoded = new StringBuilder();
        for (String component : components) {
            if (component == null) {
                encoded.append("-1:");
                continue;
            }
            encoded.append(component.length()).append(':').append(component);
        }
        return encoded.toString();
    }

    public static List<String> decode(String encoded, int componentCount) {
        Objects.requireNonNull(encoded, "encoded");
        if (componentCount < 0) throw new IllegalArgumentException("componentCount must be non-negative");
        List<String> components = new ArrayList<>(componentCount);
        int offset = 0;
        for (int index = 0; index < componentCount; index++) {
            int delimiter = encoded.indexOf(':', offset);
            if (delimiter < 1) throw new IllegalArgumentException("cursor identity length is missing");
            int length;
            try {
                length = Integer.parseInt(encoded.substring(offset, delimiter));
            } catch (NumberFormatException failure) {
                throw new IllegalArgumentException("cursor identity length is invalid", failure);
            }
            offset = delimiter + 1;
            if (length == -1) {
                components.add(null);
                continue;
            }
            if (length < 0 || encoded.length() - offset < length) {
                throw new IllegalArgumentException("cursor identity component is truncated");
            }
            components.add(encoded.substring(offset, offset + length));
            offset += length;
        }
        if (offset != encoded.length()) throw new IllegalArgumentException("cursor identity has extra components");
        return Collections.unmodifiableList(components);
    }
}
