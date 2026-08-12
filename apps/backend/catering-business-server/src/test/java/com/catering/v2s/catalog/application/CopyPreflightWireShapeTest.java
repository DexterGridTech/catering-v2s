package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.app.edge.generated.wire.BrandCatalogCopyReadback;
import com.catering.v2s.app.edge.generated.wire.LocalCopyPreflight;
import com.catering.v2s.app.edge.generated.wire.LocalCopyReadback;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

class CopyPreflightWireShapeTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void bareCoordinatorDataIsWrappedAndProjectedToLocalWireContract() throws Exception {
        ObjectNode data = validData();
        data.putArray("closureEdges");
        data.putArray("mappingPreview");
        data.putArray("referenceRewritePreview");

        ObjectNode envelope = CopyPreflightWireShape.contractEnvelope(mapper, mapper.writeValueAsString(data), "request-1");
        LocalCopyPreflight wire = mapper.treeToValue(envelope, LocalCopyPreflight.class);

        assertEquals("CATALOG_INVENTORY_P1_20260806", wire.revision());
        assertEquals("request-1", wire.requestId());
        assertEquals("digest-1", wire.data().preflightDigest());
        assertEquals(1, wire.data().referenceMappings().size());
        assertFalse(envelope.path("data").has("closureEdges"));
        assertFalse(envelope.path("data").has("mappingPreview"));
        assertFalse(envelope.path("data").has("referenceRewritePreview"));
    }

    @Test
    void missingRequiredCopyFieldFailsClosedBeforeWireMapping() throws Exception {
        ObjectNode data = validData();
        data.remove("referenceMappings");

        assertThrows(IllegalArgumentException.class,
            () -> CopyPreflightWireShape.contractEnvelope(mapper, mapper.writeValueAsString(data), "request-2"));
    }

    @Test
    void localExecutionReadbackDropsInternalPlanningAndReceiptFields() throws Exception {
        ObjectNode data = validReadbackData(true);
        data.putArray("mappings");
        ObjectNode incoming = mapper.createObjectNode().put("revision", "CATALOG_INVENTORY_P1_20260806")
            .put("requestId", "request-3");
        incoming.set("data", data);
        incoming.put("receiptObjectFingerprint", "internal");
        ObjectNode envelope = CopyPreflightWireShape.contractLocalReadback(mapper,
            mapper.writeValueAsString(incoming), "request-3");
        LocalCopyReadback wire = mapper.treeToValue(envelope, LocalCopyReadback.class);

        assertEquals("digest-1", wire.data().preflightDigest());
        assertEquals(1, wire.data().ownerReadbacks().size());
        assertFalse(envelope.path("data").has("mappings"));
        assertFalse(envelope.has("receiptObjectFingerprint"));
    }

    @Test
    void brandExecutionReadbackProjectsTheSeparateBrandContract() throws Exception {
        ObjectNode data = validReadbackData(false);
        data.putArray("mappings");
        ObjectNode incoming = mapper.createObjectNode().put("revision", "CATALOG_INVENTORY_P1_20260806")
            .put("requestId", "request-4");
        incoming.set("data", data);
        incoming.put("receiptObjectFingerprint", "internal");
        ObjectNode envelope = CopyPreflightWireShape.contractBrandReadback(mapper,
            mapper.writeValueAsString(incoming), "request-4");
        BrandCatalogCopyReadback wire = mapper.treeToValue(envelope, BrandCatalogCopyReadback.class);

        assertEquals("digest-1", wire.data().preflightDigest());
        assertEquals(1, wire.data().referenceMappings().size());
        assertEquals(1, wire.data().ownerReadbacks().size());
        assertFalse(envelope.path("data").has("mappings"));
        assertFalse(envelope.has("receiptObjectFingerprint"));
    }

    @Test
    void executionReadbackMissingRequiredFieldFailsClosed() throws Exception {
        ObjectNode data = validReadbackData(true);
        data.remove("ownerReadbacks");

        IllegalArgumentException failure = assertThrows(IllegalArgumentException.class,
            () -> CopyPreflightWireShape.contractLocalReadback(mapper, mapper.writeValueAsString(data), "request-5"));
        CatalogOwnerApi.Problem problem = CopyPreflightWireShape.invalidReadback("local copy execution", failure);

        assertEquals("RESULT_UNKNOWN", problem.code());
        assertEquals("local copy execution readback is invalid: local copy execution data field is missing: ownerReadbacks", problem.getMessage());
    }

    @Test
    void executionReadbackNeverLeaksAnUnsafeDecoderMessage() {
        CatalogOwnerApi.Problem problem = CopyPreflightWireShape.invalidReadback("local copy execution",
            new IllegalArgumentException("password=not-for-diagnostics"));

        assertEquals("local copy execution readback is invalid: response could not be decoded", problem.getMessage());
    }

    private ObjectNode validData() {
        ObjectNode data = mapper.createObjectNode();
        data.putObject("sourceScope").put("ownerType", "DATA_NODE").put("ownerRef", "store").put("brandRef", "brand");
        data.putObject("targetScope").put("ownerType", "DATA_NODE").put("ownerRef", "store").put("brandRef", "brand");
        data.putArray("selectedItems").addObject().put("objectType", "CATALOG_ITEM").put("code", "SOURCE").put("name", "Source");
        data.putArray("closureItems").addObject().put("objectType", "CATALOG_ITEM").put("code", "SOURCE").put("name", "Source").put("action", "REPLACE");
        data.putArray("objectVersions").addObject().put("objectType", "CATALOG_ITEM").put("code", "SOURCE").put("sourceVersion", 1).put("targetVersion", 1);
        data.putArray("referenceMappings").addObject().put("objectType", "CATALOG_ITEM")
            .put("sourceRef", "00000000-0000-4000-8000-000000000001")
            .put("targetRef", "00000000-0000-4000-8000-000000000002")
            .put("targetCode", "TARGET");
        data.putArray("compatibilityResults").addObject().put("objectType", "CATALOG_ITEM").put("result", "CONFIRMABLE_REUSE").put("reason", "same shape");
        data.put("preflightDigest", "digest-1").put("selectedCount", 1).put("selectedLimit", 1)
            .put("closureCount", 1).put("closureLimit", 500).put("blockingCount", 0).put("confirmationRequiredCount", 1);
        return data;
    }

    private ObjectNode validReadbackData(boolean includeSkipped) {
        ObjectNode data = mapper.createObjectNode().put("preflightDigest", "digest-1");
        data.putArray("created");
        data.putArray("reused").addObject().put("objectType", "CATALOG_ITEM").put("code", "TARGET");
        if (includeSkipped) data.putArray("skipped");
        data.putArray("referenceMappings").addObject().put("objectType", "CATALOG_ITEM")
            .put("sourceRef", "00000000-0000-4000-8000-000000000001")
            .put("targetRef", "00000000-0000-4000-8000-000000000002")
            .put("targetCode", "TARGET");
        data.putArray("targetVersions").addObject().put("targetRef", "00000000-0000-4000-8000-000000000002").put("version", 2);
        data.putArray("ownerReadbacks").addObject().put("owner", "catalog").put("status", "COMMITTED").put("version", 2);
        return data;
    }
}
