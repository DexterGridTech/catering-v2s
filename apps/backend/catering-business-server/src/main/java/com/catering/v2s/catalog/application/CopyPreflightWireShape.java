package com.catering.v2s.catalog.application;

import com.catering.v2s.app.edge.generated.wire.BrandCatalogCopyReadback;
import com.catering.v2s.app.edge.generated.wire.LocalCopyReadback;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.UUID;

/**
 * Adapts owner/coordinator copy plans to the already generated HTTP wire
 * shapes.  The coordinator may carry internal planning arrays while it
 * composes owners; the edge response remains the closed OpenAPI projection.
 */
final class CopyPreflightWireShape {
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private static final List<String> DATA_FIELDS = List.of(
        "sourceScope", "targetScope", "selectedItems", "closureItems", "objectVersions",
        "referenceMappings", "compatibilityResults", "skipped", "preflightDigest", "selectedCount",
        "selectedLimit", "closureCount", "closureLimit", "blockingCount", "confirmationRequiredCount"
    );
    private static final List<String> LOCAL_READBACK_FIELDS = List.of(
        "preflightDigest", "created", "reused", "skipped", "referenceMappings", "targetVersions", "ownerReadbacks"
    );
    private static final List<String> BRAND_READBACK_FIELDS = List.of(
        "preflightDigest", "created", "reused", "referenceMappings", "targetVersions", "ownerReadbacks"
    );

    private CopyPreflightWireShape() { }

    static ObjectNode ensureEnvelope(ObjectMapper mapper, JsonNode value, String requestId) {
        if (value == null || !value.isObject()) throw new IllegalArgumentException("copy preflight readback must be an object");
        if (requestId == null || requestId.isBlank()) throw new IllegalArgumentException("copy preflight requestId is required");
        JsonNode data = value.path("data");
        ObjectNode envelope = mapper.createObjectNode();
        if (data.isObject()) {
            envelope.put("revision", value.path("revision").isTextual() && !value.path("revision").asText().isBlank() ? value.path("revision").asText() : REVISION);
            envelope.put("requestId", value.path("requestId").isTextual() && !value.path("requestId").asText().isBlank() ? value.path("requestId").asText() : requestId);
            envelope.set("data", data.deepCopy());
            return envelope;
        }
        return envelope
            .put("revision", REVISION)
            .put("requestId", requestId)
            .set("data", value.deepCopy());
    }

    static ObjectNode contractEnvelope(ObjectMapper mapper, String canonicalJson, String requestId) {
        final JsonNode parsed;
        try {
            parsed = mapper.readTree(canonicalJson);
        } catch (Exception failure) {
            throw new IllegalArgumentException("copy preflight readback is not valid JSON", failure);
        }
        ObjectNode envelope = ensureEnvelope(mapper, parsed, requestId);
        JsonNode data = envelope.path("data");
        if (!data.isObject()) throw new IllegalArgumentException("copy preflight data is required");
        for (String field : DATA_FIELDS) {
            if (!data.has(field) || data.path(field).isNull()) {
                throw new IllegalArgumentException("copy preflight data field is missing: " + field);
            }
        }
        ObjectNode projected = mapper.createObjectNode();
        for (String field : DATA_FIELDS) projected.set(field, data.path(field).deepCopy());
        envelope.set("data", projected);
        return envelope;
    }

    static ObjectNode contractLocalReadback(ObjectMapper mapper, String canonicalJson, String requestId) {
        return contractReadback(mapper, canonicalJson, requestId, LOCAL_READBACK_FIELDS, "local copy execution");
    }

    static ObjectNode contractBrandReadback(ObjectMapper mapper, String canonicalJson, String requestId) {
        return contractReadback(mapper, canonicalJson, requestId, BRAND_READBACK_FIELDS, "brand copy execution");
    }

    /** Execution adapters receive this already-typed edge value; no owner JSON is decoded after a write. */
    static LocalCopyReadback localReadback(String requestId, CatalogOwnerApi.CopyExecutionReadback catalog,
                                           List<CatalogOwnerApi.CopyOwnerReadback> ownerReadbacks) {
        requireExecution(requestId, catalog, ownerReadbacks, "local copy execution");
        return new LocalCopyReadback(REVISION, requestId, new LocalCopyReadback.Data(
            catalog.preflightDigest(),
            catalog.created().stream().map(value -> new LocalCopyReadback.Data.CreatedItem(value.objectType(), value.code())).toList(),
            catalog.reused().stream().map(value -> new LocalCopyReadback.Data.ReusedItem(value.objectType(), value.code())).toList(),
            catalog.skipped().stream().map(value -> new LocalCopyReadback.Data.SkippedItem(value.section(), value.reasonCode())).toList(),
            catalog.referenceMappings().stream().map(value -> new LocalCopyReadback.Data.ReferenceMappingsItem(value.objectType(), uuid(value.sourceRef()), uuid(value.targetRef()), value.targetCode(), value.targetSkuCode(), value.targetOptionValueCode())).toList(),
            catalog.targetVersions().stream().map(value -> new LocalCopyReadback.Data.TargetVersionsItem(uuid(value.targetRef()), value.version())).toList(),
            ownerReadbacks.stream().map(value -> new LocalCopyReadback.Data.OwnerReadbacksItem(value.owner(), value.status(), value.version())).toList()
        ));
    }

    static BrandCatalogCopyReadback brandReadback(String requestId, CatalogOwnerApi.CopyExecutionReadback catalog,
                                                   List<CatalogOwnerApi.CopyOwnerReadback> ownerReadbacks) {
        requireExecution(requestId, catalog, ownerReadbacks, "brand copy execution");
        return new BrandCatalogCopyReadback(REVISION, requestId, new BrandCatalogCopyReadback.Data(
            catalog.preflightDigest(),
            catalog.created().stream().map(value -> new BrandCatalogCopyReadback.Data.CreatedItem(value.objectType(), value.code())).toList(),
            catalog.reused().stream().map(value -> new BrandCatalogCopyReadback.Data.ReusedItem(value.objectType(), value.code())).toList(),
            catalog.referenceMappings().stream().map(value -> new BrandCatalogCopyReadback.Data.ReferenceMappingsItem(value.objectType(), uuid(value.sourceRef()), uuid(value.targetRef()), value.targetCode(), value.targetSkuCode(), value.targetOptionValueCode())).toList(),
            catalog.targetVersions().stream().map(value -> new BrandCatalogCopyReadback.Data.TargetVersionsItem(uuid(value.targetRef()), value.version())).toList(),
            ownerReadbacks.stream().map(value -> new BrandCatalogCopyReadback.Data.OwnerReadbacksItem(value.owner(), value.status(), value.version())).toList()
        ));
    }

    private static void requireExecution(String requestId, CatalogOwnerApi.CopyExecutionReadback catalog,
                                         List<CatalogOwnerApi.CopyOwnerReadback> ownerReadbacks, String label) {
        if (requestId == null || requestId.isBlank()) throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, label + " readback is invalid: requestId is required");
        if (catalog == null) throw missingTypedExecutionField(label, "catalog");
        if (catalog.preflightDigest() == null || catalog.preflightDigest().isBlank()) throw missingTypedExecutionField(label, "preflightDigest");
        if (catalog.created() == null) throw missingTypedExecutionField(label, "created");
        if (catalog.reused() == null) throw missingTypedExecutionField(label, "reused");
        if (catalog.skipped() == null) throw missingTypedExecutionField(label, "skipped");
        if (catalog.referenceMappings() == null) throw missingTypedExecutionField(label, "referenceMappings");
        if (catalog.targetVersions() == null) throw missingTypedExecutionField(label, "targetVersions");
        if (catalog.ownerReadbacks() == null || ownerReadbacks == null) throw missingTypedExecutionField(label, "ownerReadbacks");
    }

    private static CatalogOwnerApi.Problem missingTypedExecutionField(String label, String field) {
        return new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500,
            label + " readback is invalid: required typed field is missing: " + field);
    }

    private static UUID uuid(String value) {
        return value == null || value.isBlank() ? null : UUID.fromString(value);
    }

    /**
     * The adapters sit inside REQUIRED transactions.  A contract projection
     * failure must therefore be a throwing problem (so Spring rolls back),
     * but its public diagnostic may only contain the field-level, schema-safe
     * reason produced in this class.  Never relay Jackson text or owner JSON.
     */
    static CatalogOwnerApi.Problem invalidReadback(String label, Exception failure) {
        return new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500,
            label + " readback is invalid: " + safeDiagnostic(failure), failure);
    }

    private static String safeDiagnostic(Exception failure) {
        String message = failure.getMessage();
        if (message == null) return "response could not be decoded";
        if (message.matches("(?:copy preflight|local copy execution|brand copy execution) data field is missing: [A-Za-z][A-Za-z0-9]*")) {
            return message;
        }
        if (message.matches("(?:copy preflight|local copy execution|brand copy execution) data is required")) {
            return message;
        }
        if (message.matches("(?:copy preflight|local copy execution|brand copy execution) readback is not valid JSON")) {
            return message;
        }
        return "response could not be decoded";
    }

    private static ObjectNode contractReadback(ObjectMapper mapper, String canonicalJson, String requestId,
                                                List<String> fields, String label) {
        final JsonNode parsed;
        try {
            parsed = mapper.readTree(canonicalJson);
        } catch (Exception failure) {
            throw new IllegalArgumentException(label + " readback is not valid JSON", failure);
        }
        ObjectNode envelope = ensureEnvelope(mapper, parsed, requestId);
        JsonNode data = envelope.path("data");
        if (!data.isObject()) throw new IllegalArgumentException(label + " data is required");
        for (String field : fields) {
            if (!data.has(field) || data.path(field).isNull()) {
                throw new IllegalArgumentException(label + " data field is missing: " + field);
            }
        }
        ObjectNode projected = mapper.createObjectNode();
        for (String field : fields) projected.set(field, data.path(field).deepCopy());
        envelope.set("data", projected);
        return envelope;
    }
}
