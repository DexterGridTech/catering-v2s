package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.api.CatalogOwnerTypes;
import com.catering.v2s.fulfillment.production.application.ProductionTagOwnerService;
import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.asset.api.CatalogAssetReferenceLock;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class CatalogCategoryOwnerIntegrationTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String BRAND = "BRAND";
    private static final UUID WORKSPACE = UUID.randomUUID();
    private static final UUID SCOPE = UUID.randomUUID();
    private static final UUID COPY_TARGET_SCOPE = UUID.randomUUID();
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    @Container static final PostgreSQLContainer<?> LEGACY_POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    private static Flyway flyway;
    private static JdbcTemplate jdbc;
    private static CatalogOwnerService service;
    private static ProductionTagOwnerService production;

    @BeforeAll static void setup() {
        flyway = flyway(POSTGRES, null);
        flyway.migrate();
        jdbc = jdbc(POSTGRES);
        service = new CatalogOwnerService(jdbc, MAPPER, (TimeProvider) () -> 1_785_000_000_000L, mock(CatalogAssetReferenceLock.class));
        production = new ProductionTagOwnerService(jdbc, MAPPER, (TimeProvider) () -> 1_785_000_000_000L);
    }

    @Test void categoryOperationsUseOpaqueRefsAndAllowDeleteThenCodeReuse() {
        JsonNode rootA = create("CAT-A", "A", null);
        JsonNode rootB = create("CAT-B", "B", null);
        JsonNode childC = create("CAT-C", "C", rootA.path("categoryRef").asText());
        JsonNode childD = create("CAT-D", "D", rootB.path("categoryRef").asText());

        JsonNode tree = navigation();
        JsonNode treeC = category(tree, childC.path("categoryRef").asText());
        assertEquals(childC.path("categoryRef").asText(), treeC.path("categoryRef").asText());
        assertTrue(treeC.path("version").asLong() > 0);
        assertEquals(rootA.path("categoryRef").asText(), treeC.path("parentCategoryRef").asText());

        JsonNode moved = write("moveOperationsCatalogCategory", MAPPER.createObjectNode()
            .put("categoryRef", childC.path("categoryRef").asText())
            .put("expectedVersion", childC.path("version").asLong())
            .put("action", "REPARENT")
            .put("parentCategoryRef", rootB.path("categoryRef").asText()));
        assertEquals(rootB.path("categoryRef").asText(), moved.path("parentCategoryRef").asText());
        CatalogOwnerApi.Problem staleMove = assertThrows(CatalogOwnerApi.Problem.class, () -> write("moveOperationsCatalogCategory", MAPPER.createObjectNode()
            .put("categoryRef", childC.path("categoryRef").asText())
            .put("expectedVersion", childC.path("version").asLong())
            .put("action", "UP")));
        assertEquals("VERSION_CONFLICT", staleMove.code());

        JsonNode movedUp = write("moveOperationsCatalogCategory", MAPPER.createObjectNode()
            .put("categoryRef", childC.path("categoryRef").asText())
            .put("expectedVersion", moved.path("version").asLong())
            .put("action", "UP"));
        assertEquals(0, movedUp.path("displayOrder").asInt());
        JsonNode movedDown = write("moveOperationsCatalogCategory", MAPPER.createObjectNode()
            .put("categoryRef", childC.path("categoryRef").asText())
            .put("expectedVersion", movedUp.path("version").asLong())
            .put("action", "DOWN"));
        assertTrue(movedDown.path("displayOrder").asInt() > movedUp.path("displayOrder").asInt());

        JsonNode deletion = write("deleteOperationsCatalogCategory", MAPPER.createObjectNode()
            .put("categoryRef", rootA.path("categoryRef").asText())
            .put("expectedVersion", rootA.path("version").asLong()));
        assertEquals(rootA.path("categoryRef").asText(), deletion.path("categoryRef").asText());
        assertEquals(1, deletion.path("deletedSubtreeSize").asInt());
        assertEquals(List.of("CAT-A"), MAPPER.convertValue(deletion.path("deletedCategoryCodes"), new com.fasterxml.jackson.core.type.TypeReference<List<String>>() { }));
        assertTrue(!deletion.has("deletedCount"));
        JsonNode recreated = create("CAT-A", "A-recreated", null);
        assertEquals("CAT-A", recreated.path("code").asText());
    }

    @Test void categoryDeleteReturnsTheCanonicalSubtreeReadbackAndReplaysOnlyAfterOwnerFactRecheck() {
        JsonNode root = create("DELETE-ROOT", "delete root", null);
        create("DELETE-CHILD", "delete child", root.path("categoryRef").asText());
        ObjectNode request = MAPPER.createObjectNode()
            .put("categoryRef", root.path("categoryRef").asText())
            .put("expectedVersion", root.path("version").asLong());

        JsonNode first = writeFull("deleteOperationsCatalogCategory", request, "delete-first", "delete-replay-key");
        JsonNode result = first.path("result");
        assertEquals(root.path("categoryRef").asText(), result.path("categoryRef").asText());
        assertEquals(2, result.path("deletedSubtreeSize").asInt());
        assertEquals(List.of("DELETE-CHILD", "DELETE-ROOT"), MAPPER.convertValue(result.path("deletedCategoryCodes"), new com.fasterxml.jackson.core.type.TypeReference<List<String>>() { }));
        assertTrue(!result.has("deletedCount"));

        JsonNode replay = writeFull("deleteOperationsCatalogCategory", request, "delete-replay", "delete-replay-key");
        JsonNode replayResult = replay.path("result");
        assertEquals(3, replayResult.size());
        assertEquals(root.path("categoryRef").asText(), replayResult.path("categoryRef").asText());
        assertEquals(2, replayResult.path("deletedSubtreeSize").asInt());
        assertEquals(List.of("DELETE-CHILD", "DELETE-ROOT"), MAPPER.convertValue(replayResult.path("deletedCategoryCodes"), new com.fasterxml.jackson.core.type.TypeReference<List<String>>() { }));
        assertTrue(!replayResult.has("deletedCount"));

        CatalogOwnerApi.Problem mismatchedReplay = assertThrows(CatalogOwnerApi.Problem.class, () -> writeFull(
            "deleteOperationsCatalogCategory", request.deepCopy().put("expectedVersion", root.path("version").asLong() + 1), "delete-mismatch", "delete-replay-key"));
        assertEquals("IDEMPOTENCY_MISMATCH", mismatchedReplay.code());

        CatalogOwnerApi.Problem newKeyAfterDelete = assertThrows(CatalogOwnerApi.Problem.class, () -> writeFull(
            "deleteOperationsCatalogCategory", request, "delete-new-key", "delete-new-key"));
        assertEquals("NOT_FOUND", newKeyAfterDelete.code());

        JsonNode stale = create("DELETE-STALE", "delete stale", null);
        JsonNode updated = write("updateOperationsCatalogCategory", MAPPER.createObjectNode()
            .put("categoryRef", stale.path("categoryRef").asText())
            .put("expectedVersion", stale.path("version").asLong())
            .put("name", "delete stale updated"));
        assertEquals(stale.path("version").asLong() + 1, updated.path("version").asLong());
        CatalogOwnerApi.Problem staleDelete = assertThrows(CatalogOwnerApi.Problem.class, () -> writeFull(
            "deleteOperationsCatalogCategory", MAPPER.createObjectNode().put("categoryRef", stale.path("categoryRef").asText()).put("expectedVersion", stale.path("version").asLong()), "delete-stale", "delete-stale-key"));
        assertEquals("VERSION_CONFLICT", staleDelete.code());
    }

    @Test void catalogSaveReceiptRejectsAStaleReadbackAfterAnotherSaveButKeepsImmediateReplayAndMismatchRules() {
        String code = generatedCatalogCode("SAVE-RECEIPT");
        JsonNode created = write("createOperationsCatalogItem", MAPPER.createObjectNode()
            .put("code", code).put("name", "receipt item").put("shapeKey", "STANDARD_SALE_COUNTED"));
        ObjectNode original = MAPPER.createObjectNode().put("itemCode", code);
        original.putObject("sections").put("expectedCatalogVersion", created.path("version").asLong())
            .putObject("catalogDraft").put("shortName", "first");

        JsonNode first = writeFull("saveOperationsCatalogItem", original, "save-first", "save-replay-key");
        assertEquals(2L, first.path("result").path("version").asLong());
        JsonNode replay = writeFull("saveOperationsCatalogItem", original, "save-immediate-replay", "save-replay-key");
        assertEquals(4, replay.size());
        assertEquals(CatalogOwnerTypes.REVISION, replay.path("revision").asText());
        assertEquals("save-first", replay.path("requestId").asText());
        assertEquals(2L, replay.path("version").asLong());
        JsonNode replayResult = replay.path("result");
        assertEquals(4, replayResult.size());
        assertEquals("CATALOG_ITEM", replayResult.path("item").path("factType").asText());
        assertEquals(CatalogOwnerTypes.REVISION, replayResult.path("item").path("revision").asText());
        assertTrue(replayResult.path("inventoryBom").isArray());
        assertEquals(0, replayResult.path("inventoryBom").size());
        assertTrue(replayResult.path("productionTags").isArray());
        assertEquals(0, replayResult.path("productionTags").size());
        assertEquals(2L, replayResult.path("version").asLong());

        ObjectNode mismatched = original.deepCopy();
        ((ObjectNode) mismatched.path("sections").path("catalogDraft")).put("shortName", "different");
        CatalogOwnerApi.Problem mismatch = assertThrows(CatalogOwnerApi.Problem.class, () -> writeFull(
            "saveOperationsCatalogItem", mismatched, "save-mismatch", "save-replay-key"));
        assertEquals("IDEMPOTENCY_MISMATCH", mismatch.code());

        ObjectNode later = MAPPER.createObjectNode().put("itemCode", code);
        later.putObject("sections").put("expectedCatalogVersion", 2L).putObject("catalogDraft").put("shortName", "later");
        JsonNode second = writeFull("saveOperationsCatalogItem", later, "save-later", "save-later-key");
        assertEquals(3L, second.path("result").path("version").asLong());

        CatalogOwnerApi.Problem staleReplay = assertThrows(CatalogOwnerApi.Problem.class, () -> writeFull(
            "saveOperationsCatalogItem", original, "save-stale-replay", "save-replay-key"));
        assertEquals("VERSION_CONFLICT", staleReplay.code());
        assertEquals(3L, jdbc.queryForObject("SELECT version FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=?", Long.class,
            SCOPE.toString(), BRAND, code));
    }

    @Test void temporaryPromotionUsesTheCanonicalEnvelopeAndRejectsStaleOrNonTemporaryItems() {
        String temporaryCode = generatedCatalogCode("TEMP-PROMOTION");
        JsonNode created = write("createOperationsCatalogItem", MAPPER.createObjectNode()
            .put("code", temporaryCode).put("name", "temporary item").put("shapeKey", "STANDARD_SALE_COUNTED"));
        long createdVersion = created.path("version").asLong();
        ObjectNode temporarySave = MAPPER.createObjectNode().put("itemCode", temporaryCode);
        ObjectNode temporaryDraft = temporarySave.putObject("sections")
            .put("expectedCatalogVersion", createdVersion)
            .putObject("catalogDraft");
        temporaryDraft.put("source", "EXTERNAL_ORDER_TEMPORARY").put("governanceStatus", "GOVERNANCE_TODO");
        temporaryDraft.putObject("externalIdentity")
            .put("sourceOrderRef", "ORDER-" + temporaryCode)
            .put("sourceRecordRef", "RECORD-" + temporaryCode)
            .put("sourceItemRef", "ITEM-" + temporaryCode);
        long sourceVersion = write("saveOperationsCatalogItem", temporarySave).path("version").asLong();

        ObjectNode preflightRequest = promotionRequest(temporaryCode, sourceVersion, generatedCatalogCode("FORMAL"));
        JsonNode preflight = writeFull(
            "preflightOperationsTemporaryCatalogItemPromotion", preflightRequest, "temporary-preflight", "temporary-preflight-key");
        assertEquals(temporaryCode, preflight.path("data").path("item").path("code").asText());
        assertEquals(sourceVersion, preflight.path("data").path("sourceVersion").asLong());
        assertTrue(preflight.path("data").path("canPromote").asBoolean());
        assertTrue(!preflight.path("data").has("data"));

        ObjectNode mutation = MAPPER.createObjectNode().put("itemCode", temporaryCode);
        mutation.putObject("sections").put("expectedCatalogVersion", sourceVersion)
            .putObject("catalogDraft").put("shortName", "changed after preflight");
        assertEquals(sourceVersion + 1, write("saveOperationsCatalogItem", mutation).path("version").asLong());
        ObjectNode staleExecute = preflightRequest.deepCopy()
            .put("expectedVersion", sourceVersion)
            .put("preflightDigest", preflight.path("data").path("preflightDigest").asText());
        CatalogOwnerApi.Problem stale = assertThrows(CatalogOwnerApi.Problem.class, () -> writeFull(
            "executeOperationsTemporaryCatalogItemPromotion", staleExecute, "temporary-stale-execute", "temporary-stale-execute-key"));
        assertEquals("STALE_COPY_PREFLIGHT", stale.code());

        String normalCode = generatedCatalogCode("NORMAL-PROMOTION");
        JsonNode normal = write("createOperationsCatalogItem", MAPPER.createObjectNode()
            .put("code", normalCode).put("name", "normal item").put("shapeKey", "STANDARD_SALE_COUNTED"));
        long normalVersion = normal.path("version").asLong();
        ObjectNode normalRequest = promotionRequest(normalCode, normalVersion, generatedCatalogCode("FORMAL"));
        JsonNode normalPreflight = writeFull(
            "preflightOperationsTemporaryCatalogItemPromotion", normalRequest, "normal-preflight", "normal-preflight-key");
        assertTrue(!normalPreflight.path("data").path("canPromote").asBoolean());
        CatalogOwnerApi.Problem nonTemporary = assertThrows(CatalogOwnerApi.Problem.class, () -> writeFull(
            "executeOperationsTemporaryCatalogItemPromotion", normalRequest.deepCopy()
                .put("expectedVersion", normalVersion)
                .put("preflightDigest", normalPreflight.path("data").path("preflightDigest").asText()),
            "normal-execute", "normal-execute-key"));
        assertEquals("VALIDATION_ERROR", nonTemporary.code());
    }

    @Test void deleteIsBlockedByAnyReferencedDescendantAndSaveRejectsBusinessCodes() {
        JsonNode root = create("BLOCK-ROOT", "root", null);
        JsonNode child = create("BLOCK-CHILD", "child", root.path("categoryRef").asText());
        jdbc.update("INSERT INTO catalog.catalog_item (item_ref,data_node_ref,brand_ref,code,name,shape_key,status,attributes,sections,version,created_at_epoch_millis,updated_at_epoch_millis) VALUES (?,?,?,?,?,'STANDARD_SALE_COUNTED','DRAFT','{}'::jsonb,CAST(? AS JSONB),1,1,1)", UUID.randomUUID(), SCOPE.toString(), BRAND, "BLOCKING-ITEM", "Blocking item", "{\"categoryRefs\":[\"" + child.path("categoryRef").asText() + "\"]}");

        CatalogOwnerApi.Problem blocked = assertThrows(CatalogOwnerApi.Problem.class, () -> write("deleteOperationsCatalogCategory", MAPPER.createObjectNode()
            .put("categoryRef", root.path("categoryRef").asText())
            .put("expectedVersion", root.path("version").asLong())));
        assertEquals("REFERENCE_BLOCKS_DELETE", blocked.code());
        JsonNode rootNavigation = category(navigation(), root.path("categoryRef").asText());
        assertTrue(!rootNavigation.path("deletionAvailability").path("canDelete").asBoolean());
        assertEquals(1, rootNavigation.path("deletionAvailability").path("blockingReferenceCount").asInt());
        assertEquals("Blocking item", rootNavigation.path("deletionAvailability").path("blockingReferenceLabels").get(0).asText());

        JsonNode item = write("createOperationsCatalogItem", MAPPER.createObjectNode().put("code", "REF-VALIDATION").put("name", "Ref validation").put("shapeKey", "STANDARD_SALE_COUNTED"));
        ObjectNode save = MAPPER.createObjectNode().put("itemCode", "REF-VALIDATION");
        ObjectNode sections = save.putObject("sections").put("expectedCatalogVersion", item.path("version").asLong());
        sections.putObject("catalogDraft").putArray("categoryRefs").add("BLOCK-CHILD");
        CatalogOwnerApi.Problem codeRejected = assertThrows(CatalogOwnerApi.Problem.class, () -> write("saveOperationsCatalogItem", save));
        assertEquals("REFERENCE_MAPPING_UNRESOLVED", codeRejected.code());
    }

    @Test void categoryDeleteObservesACompletedSaveAsItsLinearizedReferenceState() {
        JsonNode category = create("SAVE-DELETE", "save-delete", null);
        JsonNode item = write("createOperationsCatalogItem", MAPPER.createObjectNode().put("code", "SAVE-DELETE-ITEM").put("name", "save-delete item").put("shapeKey", "STANDARD_SALE_COUNTED"));
        ObjectNode save = MAPPER.createObjectNode().put("itemCode", "SAVE-DELETE-ITEM");
        save.putObject("sections").put("expectedCatalogVersion", item.path("version").asLong()).putObject("catalogDraft")
            .putArray("categoryRefs").add(category.path("categoryRef").asText());
        assertEquals(2L, write("saveOperationsCatalogItem", save).path("version").asLong());
        CatalogOwnerApi.Problem blocked = assertThrows(CatalogOwnerApi.Problem.class, () -> write("deleteOperationsCatalogCategory", MAPPER.createObjectNode()
            .put("categoryRef", category.path("categoryRef").asText()).put("expectedVersion", category.path("version").asLong())));
        assertEquals("REFERENCE_BLOCKS_DELETE", blocked.code());
    }

    @Test void declaredDictionaryPathsPersistOnlyScopedOpaqueRefs() {
        write("createOperationsCatalogDictionaryEntry", MAPPER.createObjectNode().put("dictionaryKind", "TAG").put("code", "TAG-RED").put("name", "Red"));
        JsonNode entries = service.read("getOperationsCatalogDictionary", SCOPE.toString(), BRAND, MAPPER.createObjectNode().put("dictionaryKind", "TAG"), "dictionary").path("data").path("entries");
        String tagRef = entries.get(0).path("entryRef").asText();
        assertTrue(UUID.fromString(tagRef).version() >= 0);
        JsonNode item = write("createOperationsCatalogItem", MAPPER.createObjectNode().put("code", "TAGGED-ITEM").put("name", "Tagged item").put("shapeKey", "STANDARD_SALE_COUNTED"));
        ObjectNode save = MAPPER.createObjectNode().put("itemCode", "TAGGED-ITEM");
        ObjectNode sections = save.putObject("sections").put("expectedCatalogVersion", item.path("version").asLong());
        sections.putObject("catalogDraft").putArray("tagRefs").add(tagRef);
        assertEquals(2L, write("saveOperationsCatalogItem", save).path("version").asLong());
    }

    @Test void dictionaryReferenceSnapshotKeepsPerEntryVoidAvailability() {
        write("createOperationsCatalogDictionaryEntry", MAPPER.createObjectNode().put("dictionaryKind", "TAG").put("code", "SNAPSHOT-USED").put("name", "Snapshot used"));
        write("createOperationsCatalogDictionaryEntry", MAPPER.createObjectNode().put("dictionaryKind", "TAG").put("code", "SNAPSHOT-FREE").put("name", "Snapshot free"));
        JsonNode before = service.read("getOperationsCatalogDictionary", SCOPE.toString(), BRAND, MAPPER.createObjectNode().put("dictionaryKind", "TAG"), "dictionary-snapshot-before").path("data").path("entries");
        String usedRef = dictionaryEntry(before, "SNAPSHOT-USED").path("entryRef").asText();
        JsonNode item = write("createOperationsCatalogItem", MAPPER.createObjectNode().put("code", "SNAPSHOT-ITEM").put("name", "Snapshot item").put("shapeKey", "STANDARD_SALE_COUNTED"));
        ObjectNode save = MAPPER.createObjectNode().put("itemCode", "SNAPSHOT-ITEM");
        save.putObject("sections").put("expectedCatalogVersion", item.path("version").asLong()).putObject("catalogDraft").putArray("tagRefs").add(usedRef);
        write("saveOperationsCatalogItem", save);

        JsonNode entries = service.read("getOperationsCatalogDictionary", SCOPE.toString(), BRAND, MAPPER.createObjectNode().put("dictionaryKind", "TAG"), "dictionary-snapshot-after").path("data").path("entries");
        assertTrue(!dictionaryEntry(entries, "SNAPSHOT-USED").path("voidAvailability").path("canVoid").asBoolean());
        assertTrue(dictionaryEntry(entries, "SNAPSHOT-FREE").path("voidAvailability").path("canVoid").asBoolean());
        CatalogOwnerApi.Problem blocked = assertThrows(CatalogOwnerApi.Problem.class, () -> write("transitionOperationsCatalogDictionaryEntryStatus", MAPPER.createObjectNode()
            .put("dictionaryKind", "TAG").put("entryCode", "SNAPSHOT-USED").put("expectedVersion", 1).put("targetStatus", "VOIDED")));
        assertEquals("REFERENCE_BLOCKS_VOID", blocked.code(), blocked.getMessage());
    }

    @Test void productSkuRefCannotCrossTheDeclaredItemRelation() {
        UUID ownerItemRef = UUID.randomUUID(), currentItemRef = UUID.randomUUID(), ownerSkuRef = UUID.randomUUID(), mismatchedSkuRef = UUID.randomUUID();
        jdbc.update("INSERT INTO catalog.catalog_item (item_ref,data_node_ref,brand_ref,code,name,shape_key,status,attributes,sections,version,created_at_epoch_millis,updated_at_epoch_millis) VALUES (?,?,?,?,?,'STANDARD_SALE_COUNTED','DRAFT','{}'::jsonb,CAST(? AS JSONB),1,1,1)", ownerItemRef, SCOPE.toString(), BRAND, "SKU-OWNER", "SKU owner", "{\"skus\":[{\"productSkuRef\":\"" + ownerSkuRef + "\"}]}");
        jdbc.update("INSERT INTO catalog.catalog_item (item_ref,data_node_ref,brand_ref,code,name,shape_key,status,attributes,sections,version,created_at_epoch_millis,updated_at_epoch_millis) VALUES (?,?,?,?,?,'STANDARD_SALE_COUNTED','DRAFT','{}'::jsonb,'{}'::jsonb,1,1,1)", currentItemRef, SCOPE.toString(), BRAND, "SKU-CROSS", "SKU cross");
        ObjectNode save = MAPPER.createObjectNode().put("itemCode", "SKU-CROSS");
        ObjectNode draft = save.putObject("sections").put("expectedCatalogVersion", 1).putObject("catalogDraft");
        draft.putArray("inventoryBom").addObject().put("itemRef", ownerItemRef.toString()).put("productSkuRef", mismatchedSkuRef.toString());
        CatalogOwnerApi.Problem rejected = assertThrows(CatalogOwnerApi.Problem.class, () -> write("saveOperationsCatalogItem", save));
        assertEquals("REFERENCE_MAPPING_UNRESOLVED", rejected.code());
    }

    @Test void copyPreflightAndExecuteUseOpaqueReferenceMappingsAndTargetReadLabels() {
        UUID sourceCategory = UUID.randomUUID(), targetCategory = UUID.randomUUID();
        UUID sourceValue = UUID.randomUUID(), targetValue = UUID.randomUUID();
        UUID sourceItem = UUID.randomUUID(), targetItem = UUID.randomUUID();
        UUID sourceBomComponent = UUID.randomUUID(), targetBomComponent = UUID.randomUUID();
        UUID sourceSku = UUID.randomUUID(), targetSku = UUID.randomUUID();
        UUID sourceTag = UUID.randomUUID(), targetTag = UUID.randomUUID();
        insertCategory(SCOPE, sourceCategory, "COPY-CATEGORY"); insertCategory(COPY_TARGET_SCOPE, targetCategory, "COPY-CATEGORY");
        insertDictionary(SCOPE, sourceValue, "SKU_ATTRIBUTE_VALUE", "COPY-OPTION"); insertDictionary(COPY_TARGET_SCOPE, targetValue, "SKU_ATTRIBUTE_VALUE", "COPY-OPTION");
        insertProductionTag(SCOPE, sourceTag, "COPY-TAG"); insertProductionTag(COPY_TARGET_SCOPE, targetTag, "COPY-TAG");
        insertItem(SCOPE, sourceBomComponent, UUID.randomUUID(), sourceCategory, sourceValue, sourceTag, "COPY-BOM-COMPONENT");
        insertItem(COPY_TARGET_SCOPE, targetBomComponent, UUID.randomUUID(), targetCategory, targetValue, targetTag, "COPY-BOM-COMPONENT");
        // itemCode is an operator-facing label only.  Its deliberately stale
        // value proves closure follows inventoryBom.itemRef, not its code.
        insertItem(SCOPE, sourceItem, sourceSku, sourceCategory, sourceValue, sourceTag, "COPY-ITEM", sourceBomComponent);
        insertItem(COPY_TARGET_SCOPE, targetItem, targetSku, targetCategory, targetValue, targetTag, "COPY-ITEM", targetBomComponent);

        ObjectNode selection = MAPPER.createObjectNode(); selection.putArray("selectedItemCodes").add("COPY-ITEM");
        JsonNode preflight = service.copy("preflightOperationsBrandCatalogCopy", SCOPE.toString(), COPY_TARGET_SCOPE.toString(), BRAND, selection, "catalog-copy-preflight", null, WORKSPACE, "catalog-copy-test", "STORE", copyGrant());
        // Brand copy is an owner-to-coordinator preflight and deliberately
        // returns the bare data object; the edge later wraps the merged result.
        JsonNode data = preflight;
        JsonNode mappings = data.path("referenceMappings");
        assertMapping(mappings, "CATALOG_ITEM", sourceItem, targetItem, "COPY-ITEM", null, null);
        assertMapping(mappings, "CATALOG_ITEM", sourceBomComponent, targetBomComponent, "COPY-BOM-COMPONENT", null, null);
        assertMapping(mappings, "PRODUCT_SKU", sourceSku, targetSku, null, "COPY-SKU", null);
        assertMapping(mappings, "SKU_ATTRIBUTE_VALUE", sourceValue, targetValue, null, null, "COPY-OPTION");

        ObjectNode productionRequest = MAPPER.createObjectNode(); productionRequest.putArray("productionTagRefs").add(sourceTag.toString());
        JsonNode productionPreflight = production.preflightCopy(SCOPE.toString(), COPY_TARGET_SCOPE.toString(), BRAND, productionRequest, WORKSPACE, "catalog-copy-test", "STORE", copyGrant());
        assertMapping(productionPreflight.path("referenceMappings"), "PRODUCTION_TAG", sourceTag, targetTag, "COPY-TAG", null, null);

        ObjectNode execute = selection.deepCopy();
        execute.put("expectedSourceVersion", data.path("sourceVersion").asLong());
        execute.put("expectedTargetVersion", data.path("targetVersion").asLong());
        execute.put("preflightDigest", data.path("preflightDigest").asText());
        ArrayNode allMappings = execute.putArray("referenceMappings");
        mappings.forEach(value -> allMappings.add(value.deepCopy())); productionPreflight.path("referenceMappings").forEach(value -> allMappings.add(value.deepCopy()));
        JsonNode executed = service.copy("executeOperationsBrandCatalogCopy", SCOPE.toString(), COPY_TARGET_SCOPE.toString(), BRAND, execute, "catalog-copy-execute", "catalog-copy-receipt", WORKSPACE, "catalog-copy-test", "STORE", copyGrant());
        JsonNode executionMappings = executed.path("data").path("referenceMappings");
        assertMapping(executionMappings, "CATALOG_ITEM", sourceItem, targetItem, "COPY-ITEM", null, null);
        assertMapping(executionMappings, "CATALOG_ITEM", sourceBomComponent, targetBomComponent, "COPY-BOM-COMPONENT", null, null);
        assertMapping(executionMappings, "PRODUCT_SKU", sourceSku, targetSku, null, "COPY-SKU", null);
        assertMapping(executionMappings, "SKU_ATTRIBUTE_VALUE", sourceValue, targetValue, null, null, "COPY-OPTION");
        assertMapping(executionMappings, "PRODUCTION_TAG", sourceTag, targetTag, "COPY-TAG", null, null);

        // A receipt is not a historic authorization to return stale copy data:
        // changing target facts after the first success rejects the same key.
        jdbc.update("UPDATE catalog.catalog_item SET version=version+1 WHERE item_ref=?", targetItem);
        CatalogOwnerApi.Problem catalogReplay = assertThrows(CatalogOwnerApi.Problem.class, () -> service.copy(
            "executeOperationsBrandCatalogCopy", SCOPE.toString(), COPY_TARGET_SCOPE.toString(), BRAND, execute,
            "catalog-copy-replay", "catalog-copy-receipt", WORKSPACE, "catalog-copy-test", "STORE", copyGrant()));
        assertEquals("STALE_COPY_PREFLIGHT", catalogReplay.code());

        productionRequest.put("productionPreflightDigest", productionPreflight.path("digest").asText());
        production.copy(SCOPE.toString(), COPY_TARGET_SCOPE.toString(), BRAND, productionRequest,
            "production-copy-execute", "production-copy-receipt", WORKSPACE, "catalog-copy-test", "STORE", copyGrant());
        jdbc.update("UPDATE fulfillment_production.production_tag_definition SET version=version+1 WHERE tag_ref=?", targetTag);
        ProductionTagOwnerApi.Problem productionReplay = assertThrows(ProductionTagOwnerApi.Problem.class, () -> production.copy(
            SCOPE.toString(), COPY_TARGET_SCOPE.toString(), BRAND, productionRequest,
            "production-copy-replay", "production-copy-receipt", WORKSPACE, "catalog-copy-test", "STORE", copyGrant()));
        assertEquals("STALE_COPY_PREFLIGHT", productionReplay.code());

    }

    @Test void legacyVoidedCategoryReferenceFailsFlywayBeforeDeletion() {
        Flyway legacy = flyway(LEGACY_POSTGRES, "20260808.130000.000");
        legacy.migrate();
        JdbcTemplate legacyJdbc = jdbc(LEGACY_POSTGRES);
        UUID category = UUID.randomUUID();
        UUID item = UUID.randomUUID();
        legacyJdbc.update("INSERT INTO catalog.catalog_category (category_ref,data_node_ref,brand_ref,code,name,status,version,created_at_epoch_millis,updated_at_epoch_millis) VALUES (?,?,?,'LEGACY-VOID','legacy','VOIDED',1,1,1)", category, "legacy-scope", BRAND);
        legacyJdbc.update("INSERT INTO catalog.catalog_item (item_ref,data_node_ref,brand_ref,code,name,shape_key,status,attributes,sections,version,created_at_epoch_millis,updated_at_epoch_millis) VALUES (?,?,?,'LEGACY-ITEM','legacy item','STANDARD_SALE_COUNTED','DRAFT','{}'::jsonb,CAST(? AS JSONB),1,1,1)", item, "legacy-scope", BRAND, "{\"categoryRefs\":[\"LEGACY-VOID\"]}");
        assertThrows(RuntimeException.class, () -> flyway(LEGACY_POSTGRES, null).migrate());
    }

    private static void insertCategory(UUID scope, UUID ref, String code) {
        jdbc.update("INSERT INTO catalog.catalog_category (category_ref,data_node_ref,brand_ref,code,name,status,display_order,version,created_at_epoch_millis,updated_at_epoch_millis) VALUES (?,?,?,?,?,'ENABLED',0,1,1,1)", ref, scope.toString(), BRAND, code, code);
    }

    private static void insertDictionary(UUID scope, UUID ref, String kind, String code) {
        jdbc.update("INSERT INTO catalog.dictionary_entry (entry_ref,data_node_ref,brand_ref,dictionary_kind,code,name,status,display_order,version,created_at_epoch_millis,updated_at_epoch_millis) VALUES (?,?,?,?,?,?,'ENABLED',0,1,1,1)", ref, scope.toString(), BRAND, kind, code, code);
    }

    private static void insertProductionTag(UUID scope, UUID ref, String code) {
        jdbc.update("INSERT INTO fulfillment_production.production_tag_definition (tag_ref,data_node_ref,brand_ref,code,tag_kind,name,status,version,created_at_epoch_millis,updated_at_epoch_millis) VALUES (?,?,?,?,? ,?,'ENABLED',1,1,1)", ref, scope.toString(), BRAND, code, "PRODUCTION", code);
    }

    private static void insertItem(UUID scope, UUID itemRef, UUID skuRef, UUID categoryRef, UUID optionRef, UUID tagRef, String code) {
        insertItem(scope, itemRef, skuRef, categoryRef, optionRef, tagRef, code, null);
    }

    private static void insertItem(UUID scope, UUID itemRef, UUID skuRef, UUID categoryRef, UUID optionRef, UUID tagRef, String code, UUID inventoryBomItemRef) {
        ObjectNode sections = MAPPER.createObjectNode();
        sections.putArray("categoryRefs").add(categoryRef.toString());
        ObjectNode sku = sections.putArray("skus").addObject(); sku.put("productSkuRef", skuRef.toString()).put("skuCode", "COPY-SKU");
        sku.putArray("attributeValueRefs").addObject().put("attributeValueRef", optionRef.toString()).put("valueCode", "COPY-OPTION");
        sections.putArray("orderOptions").addObject().putArray("values").addObject().put("attributeValueRef", optionRef.toString()).put("code", "COPY-OPTION");
        sections.putArray("productionTagRefs").add(tagRef.toString()); sections.putArray("productionTags").addObject().put("tagRef", tagRef.toString());
        if (inventoryBomItemRef != null) sections.putArray("inventoryBom").addObject()
            .put("itemRef", inventoryBomItemRef.toString())
            .put("itemCode", "STALE-BOM-DISPLAY-LABEL");
        jdbc.update("INSERT INTO catalog.catalog_item (item_ref,data_node_ref,brand_ref,code,name,shape_key,status,attributes,sections,version,created_at_epoch_millis,updated_at_epoch_millis) VALUES (?,?,?,?,?,'STANDARD_SALE_COUNTED','DRAFT','{}'::jsonb,CAST(? AS JSONB),1,1,1)", itemRef, scope.toString(), BRAND, code, code, sections.toString());
    }

    private static void assertMapping(JsonNode mappings, String objectType, UUID sourceRef, UUID targetRef, String targetCode, String targetSkuCode, String targetOptionValueCode) {
        JsonNode found = null; for (JsonNode mapping : mappings) if (objectType.equals(mapping.path("objectType").asText()) && sourceRef.toString().equals(mapping.path("sourceRef").asText())) { found = mapping; break; }
        assertTrue(found != null, "missing " + objectType + " mapping");
        assertEquals(targetRef.toString(), found.path("targetRef").asText());
        if (targetCode == null) assertTrue(found.path("targetCode").isNull()); else assertEquals(targetCode, found.path("targetCode").asText());
        if (targetSkuCode == null) assertTrue(found.path("targetSkuCode").isNull()); else assertEquals(targetSkuCode, found.path("targetSkuCode").asText());
        if (targetOptionValueCode == null) assertTrue(found.path("targetOptionValueCode").isNull()); else assertEquals(targetOptionValueCode, found.path("targetOptionValueCode").asText());
    }

    @AfterAll static void cleanup() {
        if (flyway != null) flyway.clean();
        Flyway.configure().dataSource(LEGACY_POSTGRES.getJdbcUrl(), LEGACY_POSTGRES.getUsername(), LEGACY_POSTGRES.getPassword()).cleanDisabled(false).load().clean();
    }

    private static JsonNode create(String code, String name, String parentCategoryRef) {
        ObjectNode request = MAPPER.createObjectNode().put("code", code).put("name", name);
        if (parentCategoryRef == null) request.putNull("parentCategoryRef"); else request.put("parentCategoryRef", parentCategoryRef);
        return write("createOperationsCatalogCategory", request);
    }

    private static ObjectNode promotionRequest(String itemCode, long expectedSourceVersion, String formalCode) {
        return MAPPER.createObjectNode()
            .put("itemCode", itemCode)
            .put("formalCode", formalCode)
            .put("shapeKey", "STANDARD_SALE_COUNTED")
            .put("name", "formal item")
            .put("expectedSourceVersion", expectedSourceVersion)
            .set("attributes", MAPPER.createObjectNode());
    }

    private static String generatedCatalogCode(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(java.util.Locale.ROOT);
    }

    private static JsonNode write(String operation, ObjectNode request) {
        JsonNode response = service.write(operation, SCOPE.toString(), BRAND, request, operation + UUID.randomUUID(), UUID.randomUUID().toString(), WORKSPACE, "catalog-category-test", "STORE", grant());
        return response.path("result");
    }

    private static JsonNode writeFull(String operation, ObjectNode request, String requestId, String idempotencyKey) {
        return service.write(operation, SCOPE.toString(), BRAND, request, requestId, idempotencyKey, WORKSPACE, "catalog-category-test", "STORE", grant());
    }

    private static JsonNode navigation() {
        return service.read("getOperationsCatalogNavigation", SCOPE.toString(), BRAND, MAPPER.createObjectNode(), "navigation").path("data").path("tree");
    }

    private static JsonNode category(JsonNode tree, String categoryRef) {
        for (JsonNode node : tree) if (categoryRef.equals(node.path("categoryRef").asText())) return node;
        throw new AssertionError("category not found: " + categoryRef);
    }

    private static JsonNode dictionaryEntry(JsonNode entries, String code) {
        for (JsonNode entry : entries) if (code.equals(entry.path("code").asText())) return entry;
        throw new AssertionError("missing dictionary entry " + code);
    }

    private static OperationsOwnerScopeGrant grant() {
        return new OperationsOwnerScopeGrant(WORKSPACE, "catalog-category-test", "CATALOG_CATEGORY_TEST", "EDIT_STORE_CATALOG", "STORE", SCOPE, "STORE", SCOPE, List.of(SCOPE));
    }

    private static OperationsOwnerScopeGrant copyGrant() {
        return new OperationsOwnerScopeGrant(WORKSPACE, "catalog-copy-test", "CATALOG_COPY_TEST", "EDIT_STORE_CATALOG", "STORE", COPY_TARGET_SCOPE, "STORE", COPY_TARGET_SCOPE, List.of(COPY_TARGET_SCOPE));
    }

    private static JdbcTemplate jdbc(PostgreSQLContainer<?> postgres) {
        return new JdbcTemplate(new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()));
    }

    private static Flyway flyway(PostgreSQLContainer<?> postgres, String target) {
        var configuration = Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()).locations("filesystem:../../src/main/resources/db/migration").schemas("public").defaultSchema("public").cleanDisabled(false);
        if (target != null) configuration.target(target);
        return configuration.load();
    }
}
