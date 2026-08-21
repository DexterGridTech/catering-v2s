package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.fasterxml.jackson.databind.JsonNode;
import java.nio.charset.StandardCharsets;

/** Bounds the remaining intentionally open catalog JSON documents; typed product definitions are relational. */
final class CatalogJsonDocumentSizePolicy {
    static final int MAX_BYTES = 256 * 1024;

    private CatalogJsonDocumentSizePolicy() {}

    static void requireWithin(String field, String canonicalJson) {
        if (canonicalJson == null) return;
        int actualBytes = canonicalJson.getBytes(StandardCharsets.UTF_8).length;
        if (actualBytes > MAX_BYTES) {
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR",
                    422,
                    field + " exceeds " + MAX_BYTES + " bytes by " + (actualBytes - MAX_BYTES) + " bytes (actual="
                            + actualBytes + ", limit=" + MAX_BYTES + ")");
        }
    }

    static void validateCatalogDraft(JsonNode request) {
        JsonNode draft = request == null ? null : request.path("sections").path("catalogDraft");
        if (draft == null || !draft.isObject()) return;
        JsonNode profiles = draft.get("productionProfiles");
        if (profiles == null || !profiles.isObject()) return;
        requireNodeWithin(profiles, "item", "sections.catalogDraft.productionProfiles.item");
        requireNodeWithin(profiles, "sku", "sections.catalogDraft.productionProfiles.sku");
        requireNodeWithin(profiles, "optionValue", "sections.catalogDraft.productionProfiles.optionValue");
    }

    private static void requireNodeWithin(JsonNode parent, String field, String path) {
        JsonNode value = parent.get(field);
        if (value != null && !value.isNull()) requireWithin(path, value.toString());
    }
}
