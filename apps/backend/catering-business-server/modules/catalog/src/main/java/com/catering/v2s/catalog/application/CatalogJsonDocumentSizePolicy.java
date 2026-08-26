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
        requireNodeWithin(draft, "preparationProfile", "sections.catalogDraft.preparationProfile");
        JsonNode skus = draft.get("skus");
        if (skus != null && skus.isArray()) {
            for (int index = 0; index < skus.size(); index++) {
                JsonNode sku = skus.get(index);
                if (sku != null && sku.isObject())
                    requireNodeWithin(
                            sku,
                            "preparationOverride",
                            "sections.catalogDraft.skus[" + index + "].preparationOverride");
            }
        }
        JsonNode options = draft.get("orderOptionConfigs");
        if (options != null && options.isArray()) {
            for (int configIndex = 0; configIndex < options.size(); configIndex++) {
                JsonNode config = options.get(configIndex);
                JsonNode values = config == null ? null : config.path("values");
                if (values != null && values.isArray())
                    for (int valueIndex = 0; valueIndex < values.size(); valueIndex++)
                        requireNodeWithin(
                                values.get(valueIndex),
                                "preparationEffect",
                                "sections.catalogDraft.orderOptionConfigs[" + configIndex + "].values[" + valueIndex
                                        + "].preparationEffect");
            }
        }
    }

    private static void requireNodeWithin(JsonNode parent, String field, String path) {
        JsonNode value = parent.get(field);
        if (value != null && !value.isNull()) requireWithin(path, value.toString());
    }
}
