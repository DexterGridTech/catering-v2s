package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static org.junit.jupiter.api.Assertions.*;

import com.catering.v2s.contracts.generated.cataloginventory.CatalogInventoryShapeManifest;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.StreamSupport;

/**
 * Catalog business scenarios are intentionally isolated from the shared HTTP/Testcontainers host. This first scenario
 * establishes the real HTTP fixture shape used by the remaining P3-1 catalog cases; it is registered with the catalog
 * acceptance group.
 */
final class CatalogAcceptanceScenarios {
    private final BackendAcceptanceTest host;

    private record CreatedItem(UUID itemRef, long version) {}

    private record BatchItem(
            Fixture fixture,
            Session session,
            String code,
            UUID itemRef,
            long expectedVersion,
            JsonNode imagesBefore,
            JsonNode attributesBefore) {}

    CatalogAcceptanceScenarios(BackendAcceptanceTest host) {
        this.host = host;
    }

    /**
     * Fixture: creates two attributes and two values for each through the public dictionary route, then creates an item
     * shell and saves a four-SKU matrix through the public owner command. Proves server minting and combination
     * identity; it deliberately does not prove matrix rebuild.
     */
    @AcceptanceScenario(
            id = "catalog.item-with-sku-matrix-create",
            module = "CATALOG",
            operation = "saveOperationsCatalogItem")
    void itemWithSkuMatrixCreate(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        JsonNode size = createDictionaryEntry(
                context, fixture, session, "SKU_ATTRIBUTE", "ACC-SIZE-" + suffix, "Acceptance size");
        JsonNode temperature = createDictionaryEntry(
                context, fixture, session, "SKU_ATTRIBUTE", "ACC-TEMP-" + suffix, "Acceptance temperature");
        JsonNode small = createDictionaryEntry(
                context,
                fixture,
                session,
                "SKU_ATTRIBUTE_VALUE",
                "ACC-SMALL-" + suffix,
                "Small",
                size.path("entryRef").asText());
        JsonNode large = createDictionaryEntry(
                context,
                fixture,
                session,
                "SKU_ATTRIBUTE_VALUE",
                "ACC-LARGE-" + suffix,
                "Large",
                size.path("entryRef").asText());
        JsonNode hot = createDictionaryEntry(
                context,
                fixture,
                session,
                "SKU_ATTRIBUTE_VALUE",
                "ACC-HOT-" + suffix,
                "Hot",
                temperature.path("entryRef").asText());
        JsonNode cold = createDictionaryEntry(
                context,
                fixture,
                session,
                "SKU_ATTRIBUTE_VALUE",
                "ACC-COLD-" + suffix,
                "Cold",
                temperature.path("entryRef").asText());

        String itemCode = "ACC-MATRIX-" + suffix;
        Response created = context.post(
                OPERATIONS_CATALOG_ITEM_CREATE,
                "/api/operations/catalog-inventory/items",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "code",
                        itemCode,
                        "name",
                        "Acceptance matrix " + suffix,
                        "shapeKey",
                        "SKU_VARIANT_SALE_COUNTED",
                        "attributes",
                        Map.of()),
                Set.of(200));
        long createdVersion = created.json().path("result").path("version").asLong();
        assertTrue(createdVersion > 0, "BUSINESS: item shell creation returns a versioned owner fact");

        Map<String, Object> saveBody =
                matrixSaveBody(fixture, itemCode, createdVersion, size, temperature, small, large, hot, cold);
        context.patch(OPERATIONS_CATALOG_ITEM_SAVE, itemPath(itemCode), session.cookie(), saveBody, Set.of(200));
        JsonNode item = readItem(context, fixture, session, itemCode);
        List<JsonNode> skus = array(item.path("skus"));
        assertEquals(4, skus.size(), "BUSINESS: two axes with two values each persist four SKU facts");
        Set<String> skuRefs = new LinkedHashSet<>();
        Set<String> digests = new LinkedHashSet<>();
        for (JsonNode sku : skus) {
            String skuRef = sku.path("productSkuRef").asText();
            String digest = sku.path("variantCombinationDigest").asText();
            assertTrue(
                    skuRef.matches("[0-9a-f-]{36}"),
                    "BUSINESS: server mints an opaque SKU ref when the request omits one");
            assertFalse(digest.isBlank(), "BUSINESS: each SKU projects a persisted variant-combination digest");
            skuRefs.add(skuRef);
            digests.add(digest);
        }
        assertEquals(4, skuRefs.size(), "BUSINESS: the four matrix rows receive different server-minted identities");
        assertEquals(4, digests.size(), "BUSINESS: distinct matrix combinations do not collapse to one digest");
    }

    /** The public read projection must expose the same fields block as the generated owner manifest. */
    @AcceptanceScenario(
            id = "catalog.shape-manifest-fields-project-through-http",
            module = "CATALOG",
            operation = "getOperationsCatalogShapeManifest")
    void shapeManifestFieldsProjectThroughHttp(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);

        JsonNode responseFields = context.get(
                        OPERATIONS_CATALOG_SHAPE_MANIFEST,
                        "/api/operations/catalog-inventory/shape-manifest?dataNodeRef=" + fixture.storeId(),
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("data")
                .path("fields");
        JsonNode generatedFields = host.mapper
                .readTree(CatalogInventoryShapeManifest.MANIFEST_JSON)
                .path("fields");

        assertFalse(responseFields.isMissingNode(), "BUSINESS: shape-manifest HTTP response exposes fields");
        assertEquals(
                generatedFields,
                responseFields,
                "BUSINESS: owner projection preserves generated fields verbatim through real HTTP");
        assertEquals(10, responseFields.size(), "BUSINESS: the closed B3 field denominator is exactly ten entries");
    }

    /**
     * Creates fifty real catalog facts, then proves the batch command commits successful items independently while
     * preserving every non-status fact. Two stale versions and one foreign brand reference are deliberate per-item
     * failures; the other forty-seven items must archive.
     */
    @AcceptanceScenario(
            id = "catalog.batch-status-partial-failure-preserves-facts",
            module = "CATALOG",
            operation = "batchTransitionOperationsCatalogItemStatus")
    void batchStatusPartialFailurePreservesFacts(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        Response staged = context.multipartAsset(
                OPERATIONS_ASSET_STAGE,
                fixture,
                session.cookie(),
                fixture.storeId().toString(),
                BackendAcceptanceTest.sha256(PNG),
                Set.of(200));
        JsonNode stagedResult = staged.json().path("result");
        String assetRef = stagedResult.path("assetRef").asText();
        String bindGrant = stagedResult.path("bindGrant").asText();
        assertDoesNotThrow(
                () -> UUID.fromString(assetRef), "BUSINESS: batch fixture has an opaque UUID asset reference");
        assertFalse(bindGrant.isBlank(), "BUSINESS: batch fixture has a real staged catalog bind proof");

        List<BatchItem> items = new ArrayList<>();
        for (int index = 0; index < 49; index++) {
            String code = "ACC-BATCH-" + suffix + "-" + String.format("%02d", index);
            CreatedItem created = createItemWithAttributes(
                    context,
                    fixture,
                    session,
                    code,
                    "Batch item " + index,
                    Map.of("description", "batch-description-" + index));
            long savedVersion = saveImage(
                    context, fixture, session, code, created.version(), assetRef, index == 0 ? bindGrant : null);
            JsonNode before = readItem(context, fixture, session, code);
            assertEquals(
                    assetRef,
                    before.path("images").get(0).asText(),
                    "BUSINESS: each fixture item carries the shared active image reference");
            items.add(new BatchItem(
                    fixture,
                    session,
                    code,
                    created.itemRef(),
                    savedVersion,
                    before.path("images").deepCopy(),
                    before.path("attributes").deepCopy()));
        }

        Fixture foreignFixture = host.siblingStoreFixture(fixture, Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, foreignFixture);
        Session foreignSession = host.login(context, foreignFixture);
        String foreignCode = "ACC-BATCH-" + suffix + "-FOREIGN";
        CreatedItem foreignCreated = createItemWithAttributes(
                context,
                foreignFixture,
                foreignSession,
                foreignCode,
                "Foreign batch item",
                Map.of("description", "batch-description-foreign"));
        long foreignVersion = saveImage(
                context, foreignFixture, foreignSession, foreignCode, foreignCreated.version(), assetRef, null);
        JsonNode foreignBefore = readItem(context, foreignFixture, foreignSession, foreignCode);
        items.add(new BatchItem(
                foreignFixture,
                foreignSession,
                foreignCode,
                foreignCreated.itemRef(),
                foreignVersion,
                foreignBefore.path("images").deepCopy(),
                foreignBefore.path("attributes").deepCopy()));

        // Make exactly two local expected versions stale; both items remain readable so their
        // non-status facts can be checked after the per-item failures are returned.
        for (int index : List.of(0, 1)) {
            BatchItem item = items.get(index);
            context.post(
                    OPERATIONS_CATALOG_ITEM_STATUS,
                    itemPath(item.code()) + "/status",
                    item.session().cookie(),
                    Map.of(
                            "dataNodeRef",
                            item.fixture().storeId().toString(),
                            "itemCode",
                            item.code(),
                            "expectedVersion",
                            item.expectedVersion(),
                            "targetStatus",
                            "DISABLED"),
                    Set.of(200));
        }

        List<Map<String, Object>> requestItems = items.stream()
                .map(item -> Map.<String, Object>of(
                        "itemRef", item.itemRef().toString(), "expectedVersion", item.expectedVersion()))
                .toList();
        Response batch = context.post(
                OPERATIONS_CATALOG_BATCH_STATUS,
                "/api/operations/catalog-inventory/items/status",
                session.cookie(),
                Map.of("dataNodeRef", fixture.storeId().toString(), "targetStatus", "ARCHIVED", "items", requestItems),
                Set.of(200));
        JsonNode results = batch.json().path("results");
        assertEquals(
                50, results.size(), "BUSINESS: batch readback contains one ordered result for every submitted item");

        int failures = 0;
        for (int index = 0; index < items.size(); index++) {
            BatchItem item = items.get(index);
            JsonNode result = results.get(index);
            assertEquals(
                    item.itemRef().toString(),
                    result.path("itemRef").asText(),
                    "BUSINESS: batch result order matches request order");
            boolean expectedFailure = index < 2 || index == 49;
            if (expectedFailure) {
                failures++;
                assertFalse(result.path("ok").asBoolean(), "BUSINESS: the deliberate per-item failure is visible");
                String expectedCode = index == 49 ? "SCOPE_FORBIDDEN" : "VERSION_CONFLICT";
                assertEquals(
                        expectedCode,
                        result.path("failureCode").asText(),
                        "BUSINESS: each failed item exposes its typed reason");
            } else {
                assertTrue(result.path("ok").asBoolean(), "BUSINESS: successful item commits independently");
                assertEquals(
                        "ARCHIVED",
                        readItem(context, item.fixture(), item.session(), item.code())
                                .path("lifecycle")
                                .path("status")
                                .asText(),
                        "BUSINESS: successful item reaches the requested status");
            }
            JsonNode after = readItem(context, item.fixture(), item.session(), item.code());
            assertEquals(
                    item.imagesBefore(),
                    after.path("images"),
                    "BUSINESS: batch status migration does not alter images");
            assertEquals(
                    item.attributesBefore(),
                    after.path("attributes"),
                    "BUSINESS: batch status migration does not alter description attributes");
        }
        assertEquals(3, failures, "BUSINESS: exactly three items fail while forty-seven commit");
    }

    @AcceptanceScenario(
            id = "catalog.save-asset-reference-lifecycle",
            module = "CATALOG",
            operation = "saveOperationsCatalogItem")
    void saveAssetReferenceLifecycle(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        Fixture siblingFixture = host.siblingStoreFixture(fixture, Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, siblingFixture);
        Session siblingSession = host.login(context, siblingFixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        JsonNode oldStaged = context.multipartAsset(
                        OPERATIONS_ASSET_STAGE,
                        fixture,
                        session.cookie(),
                        fixture.storeId().toString(),
                        BackendAcceptanceTest.sha256(PNG),
                        Set.of(200))
                .json()
                .path("result");
        String oldAssetRef = oldStaged.path("assetRef").asText();
        String oldBindGrant = oldStaged.path("bindGrant").asText();
        String firstCode = "ACC-ASSET-FIRST-" + suffix;
        String siblingCode = "ACC-ASSET-SIBLING-" + suffix;
        CreatedItem first = createItemWithAttributes(context, fixture, session, firstCode, "First", Map.of());
        saveImage(context, fixture, session, firstCode, first.version(), oldAssetRef, oldBindGrant);
        CreatedItem sibling =
                createItemWithAttributes(context, siblingFixture, siblingSession, siblingCode, "Sibling", Map.of());
        saveImage(context, siblingFixture, siblingSession, siblingCode, sibling.version(), oldAssetRef, null);

        JsonNode replacementStaged = context.multipartAsset(
                        OPERATIONS_ASSET_STAGE,
                        fixture,
                        session.cookie(),
                        fixture.storeId().toString(),
                        BackendAcceptanceTest.sha256(OTHER_PNG),
                        Set.of(200))
                .json()
                .path("result");
        String replacementRef = replacementStaged.path("assetRef").asText();
        long firstUpdatedVersion = saveImage(
                context,
                fixture,
                session,
                firstCode,
                readItem(context, fixture, session, firstCode).path("version").asLong(),
                replacementRef,
                replacementStaged.path("bindGrant").asText());

        assertTrue(firstUpdatedVersion > first.version(), "BUSINESS: replacing an image advances the first item");
        assertEquals(
                replacementRef,
                readItem(context, fixture, session, firstCode)
                        .path("images")
                        .get(0)
                        .asText(),
                "BUSINESS: the replaced item reads back the new asset reference");
        assertEquals(
                oldAssetRef,
                readItem(context, siblingFixture, siblingSession, siblingCode)
                        .path("images")
                        .get(0)
                        .asText(),
                "BUSINESS: an old asset still referenced by another scope remains intact");
    }

    /**
     * Fixture: creates two independent item shells and drives their lifecycle through real HTTP. Proves the
     * lifecycle-specific code reservation rule, not historical read behaviour.
     */
    @AcceptanceScenario(
            id = "catalog.code-release-voided-not-archived",
            module = "CATALOG",
            operation = "transitionOperationsCatalogItemStatus")
    void codeReleaseVoidedNotArchived(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        String voidedCode = "ACC-VOIDED-" + suffix;
        long voidedVersion = createItem(context, fixture, session, voidedCode, "voided source");
        Response voided = context.post(
                OPERATIONS_CATALOG_ITEM_STATUS,
                itemPath(voidedCode) + "/status",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "itemCode",
                        voidedCode,
                        "expectedVersion",
                        voidedVersion,
                        "targetStatus",
                        "VOIDED"),
                Set.of(200));
        assertEquals(
                "VOIDED",
                voided.json().path("result").path("status").asText(),
                "BUSINESS: lifecycle command persists the voided state");
        long replacementVersion = createItem(context, fixture, session, voidedCode, "replacement after void");
        assertTrue(replacementVersion > 0, "BUSINESS: a voided item releases its code for a new catalog fact");

        String archivedCode = "ACC-ARCHIVED-" + suffix;
        long archivedVersion = createItem(context, fixture, session, archivedCode, "archived source");
        Response archived = context.post(
                OPERATIONS_CATALOG_ITEM_STATUS,
                itemPath(archivedCode) + "/status",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "itemCode",
                        archivedCode,
                        "expectedVersion",
                        archivedVersion,
                        "targetStatus",
                        "ARCHIVED"),
                Set.of(200));
        assertEquals(
                "ARCHIVED",
                archived.json().path("result").path("status").asText(),
                "BUSINESS: lifecycle command persists the archived state");
        Response duplicate = context.post(
                OPERATIONS_CATALOG_ITEM_CREATE,
                "/api/operations/catalog-inventory/items",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "code",
                        archivedCode,
                        "name",
                        "must not reuse archived code",
                        "shapeKey",
                        "STANDARD_SALE_COUNTED",
                        "attributes",
                        Map.of()),
                Set.of(409, 422));
        assertEquals(
                "DUPLICATE_CODE",
                duplicate.problemCode(),
                "BUSINESS: archive retains code reservation instead of releasing an active historical identity");
    }

    /**
     * Fixture: creates a category and binds it through the catalog save command. It proves both directions of the
     * relation: deletion is blocked while the item owns the relation and succeeds immediately after the same owner
     * command removes only that relation.
     */
    @AcceptanceScenario(
            id = "catalog.category-relation-integrity",
            module = "CATALOG",
            operation = "deleteOperationsCatalogCategory")
    void categoryRelationIntegrity(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Map<String, Object> categoryBody = new LinkedHashMap<>();
        categoryBody.put("dataNodeRef", fixture.storeId().toString());
        categoryBody.put("code", "ACC-CATEGORY-" + suffix);
        categoryBody.put("name", "Acceptance category " + suffix);
        categoryBody.put("parentCategoryRef", null);
        Response category = context.post(
                OPERATIONS_CATALOG_CATEGORY_CREATE,
                "/api/operations/catalog-inventory/categories",
                session.cookie(),
                categoryBody,
                Set.of(200));
        String categoryRef = category.json().path("result").path("categoryRef").asText();
        long categoryVersion = category.json().path("result").path("version").asLong();
        assertTrue(
                categoryRef.matches("[0-9a-f-]{36}") && categoryVersion > 0,
                "BUSINESS: category create returns an opaque, versioned category identity");

        String itemCode = "ACC-CATEGORY-ITEM-" + suffix;
        long createdVersion = createItem(context, fixture, session, itemCode, "category relation item");
        long boundVersion = saveCategoryRefs(context, fixture, session, itemCode, createdVersion, List.of(categoryRef));
        Response blocked = context.delete(
                OPERATIONS_CATALOG_CATEGORY_DELETE,
                "/api/operations/catalog-inventory/categories/" + categoryRef,
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "categoryRef",
                        categoryRef,
                        "expectedVersion",
                        categoryVersion),
                Set.of(422));
        assertEquals(
                "REFERENCE_BLOCKS_DELETE",
                blocked.problemCode(),
                "BUSINESS: category deletion is blocked while an item relation still exists");
        assertEquals(
                categoryRef,
                readItem(context, fixture, session, itemCode)
                        .path("categoryRefs")
                        .get(0)
                        .asText(),
                "BUSINESS: rejected category deletion preserves the item's relation");

        long unboundVersion = saveCategoryRefs(context, fixture, session, itemCode, boundVersion, List.of());
        assertTrue(
                unboundVersion > boundVersion, "BUSINESS: the catalog owner versions removal of one category relation");
        Response deleted = context.delete(
                OPERATIONS_CATALOG_CATEGORY_DELETE,
                "/api/operations/catalog-inventory/categories/" + categoryRef,
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "categoryRef",
                        categoryRef,
                        "expectedVersion",
                        categoryVersion),
                Set.of(200));
        assertEquals(
                categoryRef,
                deleted.json().path("result").path("categoryRef").asText(),
                "BUSINESS: removing the item relation makes the category deletable");
    }

    /** Proves an inventory-owned SKU reference blocks removal without permitting a partial catalog write. */
    @AcceptanceScenario(
            id = "catalog.sku-removal-blocked-by-inventory",
            module = "CATALOG",
            operation = "saveOperationsCatalogItem")
    void skuRemovalBlockedByInventory(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String code = "ACC-SKU-GUARD-" + UUID.randomUUID().toString().substring(0, 8);
        long createdVersion = createItem(context, fixture, session, code, "inventory guarded SKU");
        long savedVersion = saveIndependentSku(context, fixture, session, code, createdVersion, null, "ACC-SKU-1");
        JsonNode before = readItem(context, fixture, session, code);
        JsonNode sku = before.path("skus").get(0);
        String skuRef = sku.path("productSkuRef").asText();
        String targetRef = before.path("inventoryBom").get(0).path("targetRef").asText();
        assertTrue(
                skuRef.matches("[0-9a-f-]{36}") && targetRef.matches("[0-9a-f-]{36}"),
                "BUSINESS: one real save creates linked SKU and inventory target facts");

        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("expectedCatalogVersion", savedVersion);
        sections.put("catalogDraft", Map.of("skus", List.of()));
        Response rejected = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(code),
                session.cookie(),
                Map.of("dataNodeRef", fixture.storeId().toString(), "itemCode", code, "sections", sections),
                Set.of(422));
        assertEquals(
                "REFERENCE_BLOCKS_VOID",
                rejected.problemCode(),
                "BUSINESS: a SKU referenced by Inventory cannot be silently archived or removed");
        String rejectionDetail = rejected.json().path("detail").asText();
        assertTrue(
                rejectionDetail.contains("库存对象"),
                () -> "BUSINESS: rejection identifies the inventory reference source instead of a generic failure; "
                        + "detail="
                        + rejectionDetail);
        assertFalse(
                rejectionDetail.contains("stock_target"), "BUSINESS: rejection does not expose inventory schema names");
        assertFalse(
                rejectionDetail.contains("product_sku_ref"),
                "BUSINESS: rejection does not expose inventory column names");
        assertEquals(
                skuRef,
                readItem(context, fixture, session, code)
                        .path("skus")
                        .get(0)
                        .path("productSkuRef")
                        .asText(),
                "BUSINESS: rejected removal leaves the catalog SKU unchanged");
        JsonNode target = context.get(
                        OPERATIONS_INVENTORY_TARGET_READ,
                        "/api/operations/catalog-inventory/inventory-targets/" + targetRef + "?dataNodeRef="
                                + fixture.storeId(),
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("target");
        assertEquals(
                skuRef,
                target.path("productSkuRef").asText(),
                "BUSINESS: rejected removal leaves the Inventory target linked to its opaque SKU identity");
    }

    /** Proves the catalog-to-inventory relation is keyed by SKU ref rather than mutable business code. */
    @AcceptanceScenario(
            id = "catalog.sku-code-change-keeps-inventory",
            module = "CATALOG",
            operation = "saveOperationsCatalogItem")
    void skuCodeChangeKeepsInventory(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String code = "ACC-SKU-RENAME-" + UUID.randomUUID().toString().substring(0, 8);
        long createdVersion = createItem(context, fixture, session, code, "renamed inventory SKU");
        long savedVersion = saveIndependentSku(context, fixture, session, code, createdVersion, null, "ACC-SKU-OLD");
        JsonNode before = readItem(context, fixture, session, code);
        String skuRef = before.path("skus").get(0).path("productSkuRef").asText();
        String targetRef = before.path("inventoryBom").get(0).path("targetRef").asText();
        saveIndependentSku(context, fixture, session, code, savedVersion, skuRef, "ACC-SKU-NEW");
        JsonNode after = readItem(context, fixture, session, code);
        assertEquals(
                "ACC-SKU-NEW",
                after.path("skus").get(0).path("skuCode").asText(),
                "BUSINESS: the visible catalog SKU code changes through the owner command");
        assertEquals(
                skuRef,
                after.path("skus").get(0).path("productSkuRef").asText(),
                "BUSINESS: SKU code change preserves the opaque SKU identity");
        JsonNode target = context.get(
                        OPERATIONS_INVENTORY_TARGET_READ,
                        "/api/operations/catalog-inventory/inventory-targets/" + targetRef + "?dataNodeRef="
                                + fixture.storeId(),
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("target");
        assertEquals(
                skuRef,
                target.path("productSkuRef").asText(),
                "BUSINESS: Inventory remains attached by SKU ref after a code rename");
    }

    @AcceptanceScenario(
            id = "inventory.current-readback-separates-lazy-zones",
            module = "CATALOG",
            operation = "getOperationsInventoryTarget")
    void inventoryCurrentReadbackSeparatesLazyZones(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String code = "ACC-INVENTORY-CURRENT-" + UUID.randomUUID().toString().substring(0, 8);
        long createdVersion = createItem(context, fixture, session, code, "current readback target");
        saveIndependentSku(context, fixture, session, code, createdVersion, null, "ACC-INVENTORY-SKU");
        JsonNode item = readItem(context, fixture, session, code);
        String targetRef = item.path("inventoryBom").get(0).path("targetRef").asText();
        String path = "/api/operations/catalog-inventory/inventory-targets/" + targetRef;
        Response current = context.get(
                OPERATIONS_INVENTORY_TARGET_READ,
                path + "?dataNodeRef=" + fixture.storeId(),
                session.cookie(),
                Set.of(200));
        JsonNode currentJson = current.json();
        assertTrue(
                currentJson.path("changeSummary").isObject()
                        && currentJson.path("recentChanges").isArray(),
                "BUSINESS: current readback keeps the current-zone change facts");
        assertTrue(
                currentJson.path("references").isMissingNode()
                        && currentJson.path("ledger").isMissingNode(),
                "BUSINESS: current readback does not prefetch lazy reference and ledger zones");

        long version = currentJson.path("version").asLong();
        Response updated = context.patch(
                new RouteIdentity(
                        "updateOperationsInventoryTargetConfiguration",
                        "/api/operations/catalog-inventory/inventory-targets/{targetRef}/configuration"),
                path + "/configuration",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "targetRef",
                        targetRef,
                        "expectedVersion",
                        version,
                        "configuration",
                        Map.of(
                                "allowNegative",
                                false,
                                "lowStockThreshold",
                                "0",
                                "countingUnit",
                                "EA",
                                "conversionFactor",
                                "1")),
                Map.of("Idempotency-Key", "acceptance-current-readback-" + UUID.randomUUID()),
                Set.of(200));
        assertTrue(
                updated.json().path("changeSummary").isObject()
                        && updated.json().path("references").isMissingNode()
                        && updated.json().path("ledger").isMissingNode(),
                "BUSINESS: configuration command readback follows the same lazy-zone contract");
    }

    /**
     * Fixture: persists one SKU axis and one order-option value referring to the same dictionary entry through the
     * public catalog save command. It proves the two intentionally different lifecycle consequences: rename is
     * projected from the dictionary owner, while VOIDED is rejected once any catalog fact still holds that dictionary
     * identity.
     */
    @AcceptanceScenario(
            id = "catalog.dictionary-rename-and-void",
            module = "CATALOG",
            operation = "updateOperationsCatalogDictionaryEntry")
    void dictionaryRenameAndVoid(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        JsonNode attribute =
                createDictionaryEntry(context, fixture, session, "SKU_ATTRIBUTE", "ACC-FLAVOUR-" + suffix, "Flavour");
        JsonNode preparation = createDictionaryEntry(
                context, fixture, session, "SKU_ATTRIBUTE", "ACC-PREPARATION-" + suffix, "Preparation");
        JsonNode referencedValue = createDictionaryEntry(
                context,
                fixture,
                session,
                "SKU_ATTRIBUTE_VALUE",
                "ACC-SWEET-" + suffix,
                "Sweet",
                attribute.path("entryRef").asText());
        JsonNode bitterValue = createDictionaryEntry(
                context,
                fixture,
                session,
                "SKU_ATTRIBUTE_VALUE",
                "ACC-BITTER-" + suffix,
                "Bitter",
                attribute.path("entryRef").asText());
        JsonNode hotValue = createDictionaryEntry(
                context,
                fixture,
                session,
                "SKU_ATTRIBUTE_VALUE",
                "ACC-HOT-" + suffix,
                "Hot",
                preparation.path("entryRef").asText());
        JsonNode coldValue = createDictionaryEntry(
                context,
                fixture,
                session,
                "SKU_ATTRIBUTE_VALUE",
                "ACC-COLD-" + suffix,
                "Cold",
                preparation.path("entryRef").asText());
        JsonNode freeValue = createDictionaryEntry(
                context,
                fixture,
                session,
                "SKU_ATTRIBUTE_VALUE",
                "ACC-FREE-" + suffix,
                "Free value",
                preparation.path("entryRef").asText());
        JsonNode optionValue = createDictionaryEntry(
                context, fixture, session, "ORDER_OPTION_VALUE", "ACC-OPTION-" + suffix, "Option value");
        String itemCode = "ACC-DICTIONARY-" + suffix;
        long createdVersion = createItem(context, fixture, session, itemCode, "dictionary lifecycle item");

        Map<String, Object> saveBody = new LinkedHashMap<>(matrixSaveBody(
                fixture,
                itemCode,
                createdVersion,
                attribute,
                preparation,
                referencedValue,
                bitterValue,
                hotValue,
                coldValue));
        @SuppressWarnings("unchecked")
        Map<String, Object> sections = (Map<String, Object>) saveBody.get("sections");
        @SuppressWarnings("unchecked")
        Map<String, Object> draft = (Map<String, Object>) sections.get("catalogDraft");
        draft.put(
                "orderOptions",
                List.of(Map.of(
                        "groupCode",
                        "FLAVOUR",
                        "groupName",
                        "Flavour",
                        "selectionMode",
                        "SINGLE",
                        "required",
                        false,
                        "displayOrder",
                        0,
                        "values",
                        List.of(Map.of(
                                "code",
                                "SWEET",
                                "name",
                                "Sweet",
                                "default",
                                true,
                                "attributeValueRef",
                                optionValue.path("entryRef").asText(),
                                "productionEffects",
                                List.of(),
                                "displayOrder",
                                0)))));
        context.patch(OPERATIONS_CATALOG_ITEM_SAVE, itemPath(itemCode), session.cookie(), saveBody, Set.of(200));

        long referencedVersion = referencedValue.path("version").asLong();
        Response renamed = context.patch(
                OPERATIONS_CATALOG_DICTIONARY_UPDATE,
                "/api/operations/catalog-inventory/dictionaries/SKU_ATTRIBUTE_VALUE/entries/"
                        + referencedValue.path("code").asText(),
                session.cookie(),
                Map.of(
                        "dictionaryKind",
                        "SKU_ATTRIBUTE_VALUE",
                        "entryCode",
                        referencedValue.path("code").asText(),
                        "expectedVersion",
                        referencedVersion,
                        "name",
                        "Less sweet",
                        "dataNodeRef",
                        fixture.storeId().toString()),
                Set.of(200));
        assertEquals(
                "Less sweet",
                renamed.json().path("result").path("name").asText(),
                "BUSINESS: the dictionary owner persists the renamed value");
        JsonNode renamedItem = readItem(context, fixture, session, itemCode);
        assertEquals(
                "Less sweet",
                renamedItem
                        .path("skuVariantDimensions")
                        .get(0)
                        .path("values")
                        .get(0)
                        .path("valueLabel")
                        .asText(),
                "BUSINESS: SKU dimension readback resolves the current dictionary label instead of retaining a stale "
                        + "snapshot");

        long renamedVersion = renamed.json().path("result").path("version").asLong();
        Response blocked = context.post(
                OPERATIONS_CATALOG_DICTIONARY_STATUS,
                "/api/operations/catalog-inventory/dictionaries/ORDER_OPTION_VALUE/entries/"
                        + optionValue.path("code").asText() + "/status",
                session.cookie(),
                Map.of(
                        "dictionaryKind",
                        "ORDER_OPTION_VALUE",
                        "entryCode",
                        optionValue.path("code").asText(),
                        "expectedVersion",
                        optionValue.path("version").asLong(),
                        "targetStatus",
                        "VOIDED",
                        "dataNodeRef",
                        fixture.storeId().toString()),
                Set.of(422));
        assertEquals(
                "REFERENCE_BLOCKS_VOID",
                blocked.problemCode(),
                "BUSINESS: a catalog-referenced dictionary value cannot be voided");
        assertTrue(
                blocked.raw().contains("选项组FLAVOUR的选项值SWEET"),
                "BUSINESS: the typed rejection identifies the concrete catalog reference source");
        JsonNode afterBlocked = dictionaryEntry(
                context,
                fixture,
                session,
                "ORDER_OPTION_VALUE",
                optionValue.path("code").asText());
        assertEquals(
                "ENABLED",
                afterBlocked.path("status").asText(),
                "BUSINESS: rejected void leaves the referenced dictionary lifecycle unchanged");
        assertEquals(
                optionValue.path("version").asLong(),
                afterBlocked.path("version").asLong(),
                "BUSINESS: rejected void performs no hidden dictionary write");
        assertEquals(
                "Less sweet",
                readItem(context, fixture, session, itemCode)
                        .path("skuVariantDimensions")
                        .get(0)
                        .path("values")
                        .get(0)
                        .path("valueLabel")
                        .asText(),
                "BUSINESS: rejected void leaves the referencing catalog projection complete");

        long freeVersion = freeValue.path("version").asLong();
        Response voided = context.post(
                OPERATIONS_CATALOG_DICTIONARY_STATUS,
                "/api/operations/catalog-inventory/dictionaries/SKU_ATTRIBUTE_VALUE/entries/"
                        + freeValue.path("code").asText() + "/status",
                session.cookie(),
                Map.of(
                        "dictionaryKind",
                        "SKU_ATTRIBUTE_VALUE",
                        "entryCode",
                        freeValue.path("code").asText(),
                        "expectedVersion",
                        freeVersion,
                        "targetStatus",
                        "VOIDED",
                        "dataNodeRef",
                        fixture.storeId().toString()),
                Set.of(200));
        assertEquals(
                "VOIDED",
                voided.json().path("result").path("status").asText(),
                "BUSINESS: an unreferenced dictionary value can complete its lifecycle transition");
        assertEquals(
                freeVersion + 1,
                voided.json().path("result").path("version").asLong(),
                "BUSINESS: successful void versions the free dictionary fact");
    }

    /**
     * Fixture: stages identical bytes in two isolated workspaces and in two separately authorized brands of one
     * workspace. The former must own independent logical assets; the latter must reuse one ACTIVE workspace-owned
     * logical asset rather than inventing brand-owned copies.
     */
    @AcceptanceScenario(
            id = "catalog.asset-ref-scope-isolation",
            module = "CATALOG",
            operation = "releaseOperationsCatalogStagedAsset")
    void catalogAssetRefScopeIsolation(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        String digest = BackendAcceptanceTest.sha256(PNG);
        Fixture workspaceA = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        Fixture workspaceB = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, workspaceA);
        host.completeInvitation(context, workspaceB);
        Session sessionA = host.login(context, workspaceA);
        Session sessionB = host.login(context, workspaceB);

        Response stagedA = context.multipartAsset(
                OPERATIONS_ASSET_STAGE,
                workspaceA,
                sessionA.cookie(),
                workspaceA.storeId().toString(),
                digest,
                Set.of(200));
        Response stagedB = context.multipartAsset(
                OPERATIONS_ASSET_STAGE,
                workspaceB,
                sessionB.cookie(),
                workspaceB.storeId().toString(),
                digest,
                Set.of(200));
        String assetA = stagedA.json().path("result").path("assetRef").asText();
        String assetB = stagedB.json().path("result").path("assetRef").asText();
        assertNotEquals(
                assetA,
                assetB,
                "BUSINESS: identical content in distinct workspaces receives independent logical asset identities");
        Response releasedA = context.post(
                OPERATIONS_ASSET_RELEASE,
                "/api/operations/catalog-inventory/assets/" + assetA + "/release",
                sessionA.cookie(),
                Map.of(
                        "assetRef",
                        assetA,
                        "expectedVersion",
                        stagedA.json().path("result").path("version").asLong(),
                        "dataNodeRef",
                        workspaceA.storeId().toString()),
                Set.of(200));
        assertEquals(
                "RELEASED",
                releasedA.json().path("result").path("disposition").asText(),
                "BUSINESS: workspace A can release its own unclaimed logical asset");
        Response releasedB = context.post(
                OPERATIONS_ASSET_RELEASE,
                "/api/operations/catalog-inventory/assets/" + assetB + "/release",
                sessionB.cookie(),
                Map.of(
                        "assetRef",
                        assetB,
                        "expectedVersion",
                        stagedB.json().path("result").path("version").asLong(),
                        "dataNodeRef",
                        workspaceB.storeId().toString()),
                Set.of(200));
        assertEquals(
                "RELEASED",
                releasedB.json().path("result").path("disposition").asText(),
                "BUSINESS: releasing workspace A does not invalidate workspace B's logical asset");

        Fixture sharedWorkspaceBrandA = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        Fixture sharedWorkspaceBrandB = host.siblingStoreFixture(sharedWorkspaceBrandA, Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, sharedWorkspaceBrandA);
        host.completeInvitation(context, sharedWorkspaceBrandB);
        Session sharedSessionA = host.login(context, sharedWorkspaceBrandA);
        Session sharedSessionB = host.login(context, sharedWorkspaceBrandB);
        Response stagedSharedA = context.multipartAsset(
                OPERATIONS_ASSET_STAGE,
                sharedWorkspaceBrandA,
                sharedSessionA.cookie(),
                sharedWorkspaceBrandA.storeId().toString(),
                digest,
                Set.of(200));
        String sharedAssetRef =
                stagedSharedA.json().path("result").path("assetRef").asText();
        activateCatalogAsset(
                context,
                sharedWorkspaceBrandA,
                sharedSessionA,
                sharedAssetRef,
                stagedSharedA.json().path("result").path("bindGrant").asText());
        Response stagedSharedB = context.multipartAsset(
                OPERATIONS_ASSET_STAGE,
                sharedWorkspaceBrandB,
                sharedSessionB.cookie(),
                sharedWorkspaceBrandB.storeId().toString(),
                digest,
                Set.of(200));
        assertEquals(
                sharedAssetRef,
                stagedSharedB.json().path("result").path("assetRef").asText(),
                "BUSINESS: two brands in one workspace reuse the same ACTIVE workspace-owned logical asset for "
                        + "identical bytes");
        assertEquals(
                "ACTIVE",
                stagedSharedB.json().path("result").path("status").asText(),
                "BUSINESS: the reused logical asset remains active instead of being recreated as a brand-local staged "
                        + "row");
    }

    /**
     * Drives every published local-copy section over HTTP. Catalog-owned facts must materialize on the target;
     * Inventory/production facts which the fixture deliberately does not create must be explicit source-absence
     * results, never silent no-ops.
     */
    @AcceptanceScenario(
            id = "catalog.local-copy-section-outcomes",
            module = "CATALOG",
            operation = "executeOperationsLocalCatalogCopy")
    void localCopySectionOutcomes(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String sourceCode = "ACC-LOCAL-SOURCE-" + suffix;
        long sourceVersion = createItem(context, fixture, session, sourceCode, "Local copy source " + suffix);
        sourceVersion =
                saveIndependentSku(context, fixture, session, sourceCode, sourceVersion, null, "LOCAL-SKU-" + suffix);
        JsonNode attribute = createDictionaryEntry(
                context, fixture, session, "SKU_ATTRIBUTE", "LOCAL-ATTR-" + suffix, "Local attribute");
        JsonNode value = createDictionaryEntry(
                context,
                fixture,
                session,
                "SKU_ATTRIBUTE_VALUE",
                "LOCAL-VALUE-" + suffix,
                "Local value",
                attribute.path("entryRef").asText());
        Map<String, Object> draft = new LinkedHashMap<>();
        draft.put(
                "orderOptions",
                List.of(Map.of(
                        "groupCode",
                        "LOCAL",
                        "groupName",
                        "Local option",
                        "selectionMode",
                        "SINGLE",
                        "required",
                        false,
                        "displayOrder",
                        0,
                        "values",
                        List.of(Map.of(
                                "code",
                                "LOCAL-VALUE",
                                "name",
                                "Local value",
                                "default",
                                true,
                                "attributeValueRef",
                                value.path("entryRef").asText(),
                                "productionEffects",
                                List.of(),
                                "displayOrder",
                                0)))));
        Map<String, Object> composite = new LinkedHashMap<>();
        composite.put("groupCode", "LOCAL-PACKAGE");
        composite.put("groupName", "Local package");
        composite.put("selectionRule", "OPTIONAL");
        composite.put("minSelections", 0);
        composite.put("maxSelections", 1);
        composite.put("components", List.of());
        draft.put("compositeGroups", List.of(composite));
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("expectedCatalogVersion", sourceVersion);
        sections.put("catalogDraft", draft);
        Response sourceSaved = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(sourceCode),
                session.cookie(),
                Map.of("dataNodeRef", fixture.storeId().toString(), "itemCode", sourceCode, "sections", sections),
                Set.of(200));
        sourceVersion = sourceSaved.json().path("version").asLong();
        assertTrue(
                sourceVersion > 0,
                "BUSINESS: source item contains actual SKU, order-option and package facts before local copy");

        for (String section : List.of(
                "BASIC_INFO",
                "SKU_STRUCTURE",
                "ORDER_OPTIONS",
                "PACKAGE_STRUCTURE",
                "PRODUCTION_PROMPTS",
                "SKU_BOM",
                "OPTION_VALUE_BOM",
                "ITEM_BOM")) {
            String targetCode = "ACC-LOCAL-" + section + "-" + suffix;
            long targetVersion = createItem(context, fixture, session, targetCode, "target before " + section);
            JsonNode result =
                    localCopy(context, fixture, session, sourceCode, targetCode, sourceVersion, targetVersion, section);
            JsonNode target = readItem(context, fixture, session, targetCode);
            switch (section) {
                case "BASIC_INFO" -> assertEquals(
                        "Local copy source " + suffix,
                        target.path("name").asText(),
                        "BUSINESS: BASIC_INFO copies the catalog column fact, not a nonexistent JSON key");
                case "SKU_STRUCTURE" -> assertFalse(
                        target.path("skus").isEmpty(),
                        "BUSINESS: SKU_STRUCTURE copies the persisted SKU relation facts");
                case "ORDER_OPTIONS" -> assertFalse(
                        target.path("orderOptions").isEmpty(),
                        "BUSINESS: ORDER_OPTIONS copies the persisted option relations");
                case "PACKAGE_STRUCTURE" -> assertFalse(
                        target.path("compositeGroups").isEmpty(),
                        "BUSINESS: PACKAGE_STRUCTURE copies the persisted package relations");
                default -> assertTrue(
                        hasSkippedSourceAbsent(result, section),
                        "BUSINESS: an absent owner fact is reported as SKIPPED_SOURCE_ABSENT rather than silently "
                                + "ignored for "
                                + section);
            }
        }
    }

    private JsonNode localCopy(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String sourceCode,
            String targetCode,
            long sourceVersion,
            long targetVersion,
            String section)
            throws Exception {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("dataNodeRef", fixture.storeId().toString());
        request.put("sourceItemCode", sourceCode);
        request.put("targetItemCode", targetCode);
        request.put("selectedSections", List.of(section));
        Response preflight = context.post(
                OPERATIONS_CATALOG_LOCAL_COPY_PREFLIGHT,
                "/api/operations/catalog-inventory/copy/local/preflight",
                session.cookie(),
                request,
                Set.of(200));
        String digest = preflight.json().path("data").path("preflightDigest").asText();
        assertFalse(digest.isBlank(), "BUSINESS: local-copy preflight produces a version-bound digest for " + section);
        request.put("preflightDigest", digest);
        request.put("expectedSourceVersion", sourceVersion);
        request.put("expectedTargetVersion", targetVersion);
        return context.post(
                        OPERATIONS_CATALOG_LOCAL_COPY_EXECUTE,
                        "/api/operations/catalog-inventory/copy/local/execute",
                        session.cookie(),
                        request,
                        Set.of(200))
                .json()
                .path("data");
    }

    private static boolean hasSkippedSourceAbsent(JsonNode result, String section) {
        return StreamSupport.stream(result.path("skipped").spliterator(), false)
                .anyMatch(entry -> section.equals(entry.path("section").asText())
                        && "SKIPPED_SOURCE_ABSENT"
                                .equals(entry.path("reasonCode").asText()));
    }

    private JsonNode createDictionaryEntry(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String kind,
            String code,
            String name)
            throws Exception {
        return createDictionaryEntry(context, fixture, session, kind, code, name, null);
    }

    private JsonNode createDictionaryEntry(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String kind,
            String code,
            String name,
            String parentEntryRef)
            throws Exception {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("dictionaryKind", kind);
        request.put("code", code);
        request.put("name", name);
        request.put("dataNodeRef", fixture.storeId().toString());
        if (parentEntryRef != null) request.put("parentEntryRef", parentEntryRef);
        context.post(
                OPERATIONS_CATALOG_DICTIONARY_CREATE,
                "/api/operations/catalog-inventory/dictionaries/" + kind + "/entries",
                session.cookie(),
                request,
                Set.of(200));
        Response dictionary = context.get(
                OPERATIONS_CATALOG_DICTIONARY_READ,
                "/api/operations/catalog-inventory/dictionaries/" + kind + "?dataNodeRef=" + fixture.storeId(),
                session.cookie(),
                Set.of(200));
        return StreamSupport.stream(
                        dictionary.json().path("data").path("entries").spliterator(), false)
                .filter(entry -> code.equals(entry.path("code").asText()))
                .findFirst()
                .orElseThrow(() ->
                        new AssertionError("BUSINESS: created dictionary entry is readable by its business code"));
    }

    private JsonNode dictionaryEntry(
            BackendAcceptanceTest.ScenarioContext context, Fixture fixture, Session session, String kind, String code)
            throws Exception {
        Response dictionary = context.get(
                OPERATIONS_CATALOG_DICTIONARY_READ,
                "/api/operations/catalog-inventory/dictionaries/" + kind + "?dataNodeRef=" + fixture.storeId(),
                session.cookie(),
                Set.of(200));
        return StreamSupport.stream(
                        dictionary.json().path("data").path("entries").spliterator(), false)
                .filter(entry -> code.equals(entry.path("code").asText()))
                .findFirst()
                .orElseThrow(
                        () -> new AssertionError("BUSINESS: dictionary entry remains readable by its business code"));
    }

    private void activateCatalogAsset(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String assetRef,
            String bindGrant)
            throws Exception {
        String itemCode = "ACC-ASSET-ACTIVE-" + UUID.randomUUID().toString().substring(0, 8);
        long createdVersion = createItem(context, fixture, session, itemCode, "asset activation item");
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("expectedCatalogVersion", createdVersion);
        sections.put("catalogDraft", Map.of("images", List.of(assetRef)));
        Response saved = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(itemCode),
                session.cookie(),
                Map.of("dataNodeRef", fixture.storeId().toString(), "itemCode", itemCode, "sections", sections),
                Map.of("X-Catalog-Asset-Bind-Grants", "{\"" + assetRef + "\":\"" + bindGrant + "\"}"),
                Set.of(200));
        assertTrue(
                saved.json().path("version").asLong() > createdVersion,
                "BUSINESS: catalog save claims the staged asset through the one-time bind grant");
        assertEquals(
                assetRef,
                readItem(context, fixture, session, itemCode)
                        .path("images")
                        .get(0)
                        .asText(),
                "BUSINESS: the claimed asset is persisted in the catalog fact before cross-brand reuse is tested");
    }

    private long createItem(
            BackendAcceptanceTest.ScenarioContext context, Fixture fixture, Session session, String code, String name)
            throws Exception {
        return createItemWithAttributes(context, fixture, session, code, name, Map.of())
                .version();
    }

    private CreatedItem createItemWithAttributes(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String code,
            String name,
            Map<String, Object> attributes)
            throws Exception {
        Response created = context.post(
                OPERATIONS_CATALOG_ITEM_CREATE,
                "/api/operations/catalog-inventory/items",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "code",
                        code,
                        "name",
                        name,
                        "shapeKey",
                        "STANDARD_SALE_COUNTED",
                        "attributes",
                        attributes),
                Set.of(200));
        JsonNode result = created.json().path("result");
        long version = result.path("version").asLong();
        String resourceRef = result.path("resourceRef").asText();
        assertTrue(
                version > 0 && !resourceRef.isBlank(),
                "BUSINESS: catalog item creation exposes an opaque, versioned owner fact");
        return new CreatedItem(UUID.fromString(resourceRef), version);
    }

    private long saveImage(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            long expectedVersion,
            String assetRef,
            String bindGrant)
            throws Exception {
        return saveImages(context, fixture, session, itemCode, expectedVersion, List.of(assetRef), bindGrant);
    }

    private long saveImages(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            long expectedVersion,
            List<String> assetRefs,
            String bindGrant)
            throws Exception {
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("expectedCatalogVersion", expectedVersion);
        sections.put("catalogDraft", Map.of("images", assetRefs));
        Map<String, String> headers = bindGrant == null
                ? Map.of()
                : Map.of("X-Catalog-Asset-Bind-Grants", "{\"" + assetRefs.get(0) + "\":\"" + bindGrant + "\"}");
        Response saved = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(itemCode),
                session.cookie(),
                Map.of("dataNodeRef", fixture.storeId().toString(), "itemCode", itemCode, "sections", sections),
                headers,
                Set.of(200));
        long version = saved.json().path("version").asLong();
        assertTrue(version > expectedVersion, "BUSINESS: catalog image save advances the owner version");
        return version;
    }

    private long saveCategoryRefs(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            long expectedVersion,
            List<String> categoryRefs)
            throws Exception {
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("expectedCatalogVersion", expectedVersion);
        sections.put("catalogDraft", Map.of("categoryRefs", categoryRefs));
        Response saved = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(itemCode),
                session.cookie(),
                Map.of("dataNodeRef", fixture.storeId().toString(), "itemCode", itemCode, "sections", sections),
                Set.of(200));
        long version = saved.json().path("version").asLong();
        assertTrue(version > expectedVersion, "BUSINESS: category relation save advances the item version");
        return version;
    }

    private long saveIndependentSku(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            long expectedVersion,
            String skuRef,
            String skuCode)
            throws Exception {
        Map<String, Object> sku = new LinkedHashMap<>();
        if (skuRef != null) sku.put("productSkuRef", skuRef);
        sku.put("skuCode", skuCode);
        sku.put("skuName", skuCode);
        sku.put("displayOrder", 0);
        sku.put("attributeValueRefs", List.of());
        sku.put("skuBarcode", "");
        sku.put("isDefault", true);
        sku.put("status", "ENABLED");
        sku.put("mediaRefs", List.of());
        Map<String, Object> inventoryNode = new LinkedHashMap<>();
        inventoryNode.put("nodeType", "SKU");
        inventoryNode.put("mode", "INDEPENDENT_STOCK");
        inventoryNode.put("skuCode", skuCode);
        inventoryNode.put("consumptionUnit", "EA");
        inventoryNode.put(
                "configuration", Map.of("allowNegative", false, "countingUnit", "EA", "conversionFactor", "1"));
        if (skuRef != null) inventoryNode.put("productSkuRef", skuRef);
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("expectedCatalogVersion", expectedVersion);
        sections.put("expectedInventoryVersions", List.of());
        sections.put("catalogDraft", Map.of("skus", List.of(sku)));
        sections.put("inventoryConfiguration", Map.of("nodes", List.of(inventoryNode)));
        Response saved = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(itemCode),
                session.cookie(),
                Map.of("dataNodeRef", fixture.storeId().toString(), "itemCode", itemCode, "sections", sections),
                Set.of(200));
        long version = saved.json().path("version").asLong();
        assertTrue(
                version > expectedVersion, "BUSINESS: coordinated SKU and Inventory save advances the catalog version");
        return version;
    }

    private Map<String, Object> matrixSaveBody(
            Fixture fixture,
            String itemCode,
            long expectedVersion,
            JsonNode size,
            JsonNode temperature,
            JsonNode small,
            JsonNode large,
            JsonNode hot,
            JsonNode cold) {
        List<Map<String, Object>> axes =
                List.of(axis(size, List.of(small, large)), axis(temperature, List.of(hot, cold)));
        List<Map<String, Object>> skus = new ArrayList<>();
        skus.add(sku("SMALL-HOT", "Small hot", size, small, temperature, hot, true, 0));
        skus.add(sku("SMALL-COLD", "Small cold", size, small, temperature, cold, false, 1));
        skus.add(sku("LARGE-HOT", "Large hot", size, large, temperature, hot, false, 2));
        skus.add(sku("LARGE-COLD", "Large cold", size, large, temperature, cold, false, 3));
        Map<String, Object> draft = new LinkedHashMap<>();
        draft.put("skuVariantDimensions", axes);
        draft.put("skus", skus);
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("expectedCatalogVersion", expectedVersion);
        sections.put("catalogDraft", draft);
        return Map.of("dataNodeRef", fixture.storeId().toString(), "itemCode", itemCode, "sections", sections);
    }

    private Map<String, Object> axis(JsonNode attribute, List<JsonNode> values) {
        List<Map<String, Object>> mappedValues = new ArrayList<>();
        for (int index = 0; index < values.size(); index++) {
            JsonNode value = values.get(index);
            mappedValues.add(Map.of(
                    "valueRef",
                    value.path("entryRef").asText(),
                    "valueCode",
                    value.path("code").asText(),
                    "valueLabel",
                    value.path("name").asText(),
                    "displayOrder",
                    index,
                    "status",
                    value.path("status").asText()));
        }
        return Map.of(
                "attributeRef",
                attribute.path("entryRef").asText(),
                "attributeCode",
                attribute.path("code").asText(),
                "attributeName",
                attribute.path("name").asText(),
                "values",
                mappedValues);
    }

    private Map<String, Object> sku(
            String code,
            String name,
            JsonNode firstAttribute,
            JsonNode firstValue,
            JsonNode secondAttribute,
            JsonNode secondValue,
            boolean defaultSku,
            int displayOrder) {
        List<Map<String, Object>> refs = List.of(
                attributeValueRef(firstAttribute, firstValue, 0), attributeValueRef(secondAttribute, secondValue, 1));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("skuCode", code);
        result.put("skuName", name);
        result.put("displayOrder", displayOrder);
        result.put("attributeValueRefs", refs);
        result.put("skuBarcode", "");
        result.put("standardSalePrice", null);
        result.put("isDefault", defaultSku);
        result.put("status", "ENABLED");
        result.put("mediaRefs", List.of());
        return result;
    }

    private Map<String, Object> attributeValueRef(JsonNode attribute, JsonNode value, int displayOrder) {
        return Map.of(
                "attributeRef", attribute.path("entryRef").asText(),
                "attributeCode", attribute.path("code").asText(),
                "attributeName", attribute.path("name").asText(),
                "attributeValueRef", value.path("entryRef").asText(),
                "valueCode", value.path("code").asText(),
                "valueLabel", value.path("name").asText(),
                "displayOrder", displayOrder,
                "status", value.path("status").asText());
    }

    private JsonNode readItem(
            BackendAcceptanceTest.ScenarioContext context, Fixture fixture, Session session, String itemCode)
            throws Exception {
        return context.get(
                        OPERATIONS_CATALOG_ITEM_READ,
                        itemPath(itemCode) + "?dataNodeRef=" + fixture.storeId(),
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("data")
                .path("item");
    }

    private static String itemPath(String itemCode) {
        return "/api/operations/catalog-inventory/items/" + itemCode;
    }

    private static List<JsonNode> array(JsonNode value) {
        return StreamSupport.stream(value.spliterator(), false).toList();
    }
}
