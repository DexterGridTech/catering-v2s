package com.catering.v2s.catalog.application.operations;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.app.edge.generated.wire.BrandCatalogCopyReadback;
import com.catering.v2s.app.edge.generated.wire.LocalCopyPreflight;
import com.catering.v2s.app.edge.generated.wire.LocalCopyReadback;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
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

        ObjectNode envelope =
                CopyPreflightWireShape.contractEnvelope(mapper, mapper.writeValueAsString(data), "request-1");
        LocalCopyPreflight wire = mapper.treeToValue(envelope, LocalCopyPreflight.class);

        assertEquals("CATALOG_INVENTORY_P1_20260806", wire.revision());
        assertEquals("request-1", wire.requestId());
        assertEquals("digest-1", wire.data().preflightDigest());
        assertEquals(1, wire.data().referenceMappings().size());
        assertTrue(envelope.path("data").has("closureEdges"));
        assertTrue(envelope.path("data").has("mappingPreview"));
        assertTrue(envelope.path("data").has("referenceRewritePreview"));
    }

    @Test
    void closureEdgesRejectNonUuidReferencesBeforeWireMapping() throws Exception {
        ObjectNode data = validData();
        data.putArray("closureEdges")
                .addObject()
                .put("fromRef", "CATALOG_UNIT")
                .put("toRef", "unit-code-or-ref")
                .put("referenceKind", "CATALOG_UNIT");

        assertThrows(
                IllegalArgumentException.class,
                () -> CopyPreflightWireShape.contractEnvelope(
                        mapper, mapper.writeValueAsString(data), "request-opaque"));
    }

    @Test
    void missingRequiredCopyFieldFailsClosedBeforeWireMapping() throws Exception {
        ObjectNode data = validData();
        data.remove("referenceMappings");

        assertThrows(
                IllegalArgumentException.class,
                () -> CopyPreflightWireShape.contractEnvelope(mapper, mapper.writeValueAsString(data), "request-2"));
    }

    @Test
    void missingCompatibilityIdentityFailsClosedBeforeWireMapping() throws Exception {
        ObjectNode data = validData();
        ((ObjectNode) data.path("compatibilityResults").get(0)).remove("compatibilityId");

        assertThrows(
                IllegalArgumentException.class,
                () -> CopyPreflightWireShape.contractEnvelope(
                        mapper, mapper.writeValueAsString(data), "request-identity-missing"));
    }

    @Test
    void duplicateCompatibilityIdentityFailsClosedBeforeWireMapping() throws Exception {
        ObjectNode data = validData();
        ((ArrayNode) data.path("compatibilityResults"))
                .add(data.path("compatibilityResults").get(0).deepCopy());

        assertThrows(
                IllegalArgumentException.class,
                () -> CopyPreflightWireShape.contractEnvelope(
                        mapper, mapper.writeValueAsString(data), "request-identity-duplicate"));
    }

    @Test
    void malformedCanonicalTupleFailsClosedBeforeWireMapping() throws Exception {
        ObjectNode data = validData();
        ((ObjectNode) data.path("mappingPreview").get(0).path("canonicalTuple")).put("ownerRef", "not-a-uuid");

        assertThrows(
                IllegalArgumentException.class,
                () -> CopyPreflightWireShape.contractEnvelope(
                        mapper, mapper.writeValueAsString(data), "request-tuple-invalid"));
    }

    @Test
    void malformedReferenceRewriteFailsClosedBeforeWireMapping() throws Exception {
        ObjectNode data = validData();
        ((ObjectNode) data.path("referenceRewritePreview").get(0)).put("targetRef", "not-a-uuid");

        assertThrows(
                IllegalArgumentException.class,
                () -> CopyPreflightWireShape.contractEnvelope(
                        mapper, mapper.writeValueAsString(data), "request-rewrite-invalid"));
    }

    @Test
    void unknownCompatibilityReasonCodeFailsClosedBeforeWireMapping() throws Exception {
        ObjectNode data = validData();
        ((ObjectNode) data.path("compatibilityResults").get(0)).put("reasonCode", "UNREGISTERED");

        assertThrows(
                IllegalArgumentException.class,
                () -> CopyPreflightWireShape.contractEnvelope(
                        mapper, mapper.writeValueAsString(data), "request-reason-invalid"));
    }

    @Test
    void localExecutionReadbackDropsInternalPlanningAndReceiptFields() throws Exception {
        ObjectNode data = validReadbackData(true);
        data.putArray("mappings");
        ObjectNode incoming = mapper.createObjectNode()
                .put("revision", "CATALOG_INVENTORY_P1_20260806")
                .put("requestId", "request-3");
        incoming.set("data", data);
        incoming.put("receiptObjectFingerprint", "internal");
        ObjectNode envelope =
                CopyPreflightWireShape.contractLocalReadback(mapper, mapper.writeValueAsString(incoming), "request-3");
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
        ObjectNode incoming = mapper.createObjectNode()
                .put("revision", "CATALOG_INVENTORY_P1_20260806")
                .put("requestId", "request-4");
        incoming.set("data", data);
        incoming.put("receiptObjectFingerprint", "internal");
        ObjectNode envelope =
                CopyPreflightWireShape.contractBrandReadback(mapper, mapper.writeValueAsString(incoming), "request-4");
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

        IllegalArgumentException failure = assertThrows(
                IllegalArgumentException.class,
                () -> CopyPreflightWireShape.contractLocalReadback(
                        mapper, mapper.writeValueAsString(data), "request-5"));
        CatalogOwnerApi.Problem problem = CopyPreflightWireShape.invalidReadback("local copy execution", failure);

        assertEquals("RESULT_UNKNOWN", problem.code());
        assertEquals(
                "local copy execution readback is invalid: local copy execution data field is missing: ownerReadbacks",
                problem.getMessage());
    }

    @Test
    void executionReadbackNeverLeaksAnUnsafeDecoderMessage() {
        CatalogOwnerApi.Problem problem = CopyPreflightWireShape.invalidReadback(
                "local copy execution", new IllegalArgumentException("password=not-for-diagnostics"));

        assertEquals("local copy execution readback is invalid: response could not be decoded", problem.getMessage());
    }

    private ObjectNode validData() {
        ObjectNode data = mapper.createObjectNode();
        data.putObject("sourceScope")
                .put("ownerType", "DATA_NODE")
                .put("ownerRef", "00000000-0000-4000-8000-000000000010")
                .put("brandRef", "00000000-0000-4000-8000-000000000011");
        data.putObject("targetScope")
                .put("ownerType", "DATA_NODE")
                .put("ownerRef", "00000000-0000-4000-8000-000000000010")
                .put("brandRef", "00000000-0000-4000-8000-000000000011");
        data.putArray("selectedItems")
                .addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("code", "SOURCE")
                .put("name", "Source");
        data.putArray("closureItems")
                .addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("code", "SOURCE")
                .put("name", "Source")
                .put("action", "REPLACE");
        data.putArray("objectVersions")
                .addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("code", "SOURCE")
                .put("sourceVersion", 1)
                .put("targetVersion", 1);
        data.putArray("skipped");
        data.putArray("referenceMappings")
                .addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("sourceRef", "00000000-0000-4000-8000-000000000001")
                .put("targetRef", "00000000-0000-4000-8000-000000000002")
                .put("targetCode", "TARGET");
        data.putArray("closureEdges")
                .addObject()
                .put("fromRef", "00000000-0000-4000-8000-000000000001")
                .put("toRef", "00000000-0000-4000-8000-000000000002")
                .put("referenceKind", "CATALOG_ITEM");
        ObjectNode canonicalTuple = mapper.createObjectNode()
                .put("ownerRef", "00000000-0000-4000-8000-000000000010")
                .put("brandRef", "00000000-0000-4000-8000-000000000011")
                .put("objectType", "CATALOG_ITEM");
        canonicalTuple.putArray("parts").add("SOURCE");
        data.putArray("mappingPreview")
                .addObject()
                .put("fromCode", "SOURCE")
                .put("toCode", "TARGET")
                .put("referenceKind", "CATALOG_ITEM")
                .put("status", "REUSE")
                .set("canonicalTuple", canonicalTuple.deepCopy());
        data.putArray("referenceRewritePreview")
                .addObject()
                .put("sourceRef", "00000000-0000-4000-8000-000000000001")
                .put("targetRef", "00000000-0000-4000-8000-000000000002")
                .put("referenceKind", "CATALOG_ITEM");
        data.putArray("compatibilityResults")
                .addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("compatibilityId", "CATALOG_ITEM:00000000-0000-4000-8000-000000000001")
                .put("result", "CONFIRMABLE_REUSE")
                .put("reason", "same shape")
                .put("reasonCode", "REUSE_CONFIRMATION_REQUIRED")
                .set("canonicalTuple", canonicalTuple.deepCopy());
        data.put("preflightDigest", "digest-1")
                .put("selectedCount", 1)
                .put("selectedLimit", 1)
                .put("closureCount", 1)
                .put("closureLimit", 500)
                .put("blockingCount", 0)
                .put("confirmationRequiredCount", 1);
        return data;
    }

    private ObjectNode validReadbackData(boolean includeSkipped) {
        ObjectNode data = mapper.createObjectNode().put("preflightDigest", "digest-1");
        data.putArray("created");
        data.putArray("reused").addObject().put("objectType", "CATALOG_ITEM").put("code", "TARGET");
        if (includeSkipped) data.putArray("skipped");
        data.putArray("referenceMappings")
                .addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("sourceRef", "00000000-0000-4000-8000-000000000001")
                .put("targetRef", "00000000-0000-4000-8000-000000000002")
                .put("targetCode", "TARGET");
        data.putArray("targetVersions")
                .addObject()
                .put("targetRef", "00000000-0000-4000-8000-000000000002")
                .put("version", 2);
        data.putArray("ownerReadbacks")
                .addObject()
                .put("owner", "catalog")
                .put("status", "COMMITTED")
                .put("version", 2);
        return data;
    }
}
