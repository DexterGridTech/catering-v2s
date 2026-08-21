package com.catering.v2s.catalog.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.LinkedHashSet;
import java.util.Set;

/** Runtime consumer of the generated copy-policy resource; numeric limits have one declaration point. */
record CopyLimitPolicy(int selectedItemCount, int closureItemCount, Set<String> dictionaryKinds) {
    static CopyLimitPolicy load(ObjectMapper mapper) {
        try (InputStream stream =
                CopyLimitPolicy.class.getClassLoader().getResourceAsStream("catalog-inventory-copy-policy.json")) {
            if (stream == null) throw new IllegalStateException("catalog copy policy resource missing");
            var policy = mapper.readTree(stream);
            var root = policy.path("limits");
            int selected = root.path("selectedItemCount").asInt();
            int closure = root.path("closureItemCount").asInt();
            if (selected < 1 || closure < selected)
                throw new IllegalStateException("catalog copy policy limits invalid");
            var kinds = new LinkedHashSet<String>();
            policy.path("dictionaryKinds").forEach(value -> {
                if (value.isTextual() && !value.asText().isBlank()) kinds.add(value.asText());
            });
            if (kinds.size() != 4) throw new IllegalStateException("catalog dictionary kind policy invalid");
            return new CopyLimitPolicy(selected, closure, Set.copyOf(kinds));
        } catch (Exception failure) {
            throw new IllegalStateException("catalog copy policy unreadable", failure);
        }
    }

    boolean allowsDictionaryKind(String value) {
        return value != null && dictionaryKinds.contains(value);
    }
}
