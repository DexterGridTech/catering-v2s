package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static org.junit.jupiter.api.Assertions.*;

import com.catering.v2s.contracts.generated.cataloginventory.CatalogInventoryShapeManifest;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
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
            JsonNode attributeAssignmentsBefore) {}

    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_ATTRIBUTE_DEFINITIONS =
            new BackendAcceptanceTest.RouteIdentity(
                    "listOperationsCatalogAttributeDefinitions",
                    "/api/operations/catalog-inventory/attribute-definitions");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION_CREATE =
            new BackendAcceptanceTest.RouteIdentity(
                    "createOperationsCatalogAttributeDefinition",
                    "/api/operations/catalog-inventory/attribute-definitions");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION_UPDATE =
            new BackendAcceptanceTest.RouteIdentity(
                    "updateOperationsCatalogAttributeDefinition",
                    "/api/operations/catalog-inventory/attribute-definitions/{definitionRef}");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION_DELETE =
            new BackendAcceptanceTest.RouteIdentity(
                    "deleteOperationsCatalogAttributeDefinition",
                    "/api/operations/catalog-inventory/attribute-definitions/{definitionRef}");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_ORDER_OPTION_DEFINITIONS =
            new BackendAcceptanceTest.RouteIdentity(
                    "listOperationsCatalogOrderOptionDefinitions",
                    "/api/operations/catalog-inventory/order-option-definitions");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION_CREATE =
            new BackendAcceptanceTest.RouteIdentity(
                    "createOperationsCatalogOrderOptionDefinition",
                    "/api/operations/catalog-inventory/order-option-definitions");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION_UPDATE =
            new BackendAcceptanceTest.RouteIdentity(
                    "updateOperationsCatalogOrderOptionDefinition",
                    "/api/operations/catalog-inventory/order-option-definitions/{definitionRef}");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION_DELETE =
            new BackendAcceptanceTest.RouteIdentity(
                    "deleteOperationsCatalogOrderOptionDefinition",
                    "/api/operations/catalog-inventory/order-option-definitions/{definitionRef}");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_BRAND_COPY_PREFLIGHT =
            new BackendAcceptanceTest.RouteIdentity(
                    "preflightOperationsBrandCatalogCopy", "/api/operations/catalog-inventory/copy/brand/preflight");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_BRAND_COPY_EXECUTE =
            new BackendAcceptanceTest.RouteIdentity(
                    "executeOperationsBrandCatalogCopy", "/api/operations/catalog-inventory/copy/brand/execute");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_NAVIGATION =
            new BackendAcceptanceTest.RouteIdentity(
                    "getOperationsCatalogNavigation", "/api/operations/catalog-inventory/navigation");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_ITEMS =
            new BackendAcceptanceTest.RouteIdentity(
                    "getOperationsCatalogItems", "/api/operations/catalog-inventory/items");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_UNIT_CREATE =
            new BackendAcceptanceTest.RouteIdentity(
                    "createOperationsCatalogUnit", "/api/operations/catalog-inventory/units");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_UNIT_LIST =
            new BackendAcceptanceTest.RouteIdentity(
                    "listOperationsCatalogUnits", "/api/operations/catalog-inventory/units");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_UNIT_DISABLE =
            new BackendAcceptanceTest.RouteIdentity(
                    "disableOperationsCatalogUnit", "/api/operations/catalog-inventory/units/{unitRef}/disable");

    CatalogAcceptanceScenarios(BackendAcceptanceTest host) {
        this.host = host;
    }

    @AcceptanceScenario(
            id = "catalog.unit-list-boolean-query-and-status-filter",
            module = "CATALOG",
            operation = "listOperationsCatalogUnits")
    void unitListBooleanQueryAndStatusFilter(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        JsonNode created = createAcceptanceUnit(
                context,
                fixture,
                session,
                "ACC-UNIT-LIST-" + UUID.randomUUID().toString().substring(0, 8));
        JsonNode unit = created.path("result").path("unit");
        String unitRef = unit.path("unitRef").asText();
        long version = unit.path("version").asLong();
        String basePath = "/api/operations/catalog-inventory/units?dataNodeRef=" + fixture.storeId();

        Response enabled = context.get(
                OPERATIONS_CATALOG_UNIT_LIST, basePath + "&includeInactive=false", session.cookie(), Set.of(200));
        assertTrue(
                array(enabled.json().path("data").path("units")).stream()
                        .anyMatch(row -> unitRef.equals(row.path("unitRef").asText())
                                && "ENABLED".equals(row.path("status").asText())),
                "BUSINESS: false query value is decoded and enabled unit is a candidate");

        Response disabled = context.post(
                OPERATIONS_CATALOG_UNIT_DISABLE,
                "/api/operations/catalog-inventory/units/" + unitRef + "/disable",
                session.cookie(),
                Map.of("dataNodeRef", fixture.storeId().toString(), "unitRef", unitRef, "expectedVersion", version),
                idempotencyHeaders("unit-list-disable"),
                Set.of(200));
        assertEquals(
                "DISABLED",
                disabled.json().path("result").path("unit").path("status").asText(),
                "BUSINESS: disabling the unit changes its lifecycle status");

        Response candidates = context.get(
                OPERATIONS_CATALOG_UNIT_LIST, basePath + "&includeInactive=false", session.cookie(), Set.of(200));
        assertFalse(
                array(candidates.json().path("data").path("units")).stream()
                        .anyMatch(row -> unitRef.equals(row.path("unitRef").asText())),
                "BUSINESS: disabled unit is excluded from future candidates");

        Response maintenance = context.get(
                OPERATIONS_CATALOG_UNIT_LIST, basePath + "&includeInactive=true", session.cookie(), Set.of(200));
        assertTrue(
                array(maintenance.json().path("data").path("units")).stream()
                        .anyMatch(row -> unitRef.equals(row.path("unitRef").asText())
                                && "DISABLED".equals(row.path("status").asText())),
                "BUSINESS: true query value exposes disabled units to maintenance without restoring candidates");
    }

    @AcceptanceScenario(
            id = "inventory.count-truncates-converted-quantity-toward-zero",
            module = "CATALOG",
            operation = "countOperationsInventoryTarget")
    void inventoryCountTruncatesConvertedQuantityTowardZero(BackendAcceptanceTest.ScenarioContext context)
            throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        JsonNode grams = createAcceptanceUnit(context, fixture, session, "ACC-UNIT-GRAM-" + suffix, "克", "WEIGHT", 0);
        JsonNode kilograms =
                createAcceptanceUnit(context, fixture, session, "ACC-UNIT-KG-" + suffix, "千克", "WEIGHT", 3);
        String gramsRef = grams.path("result").path("unit").path("unitRef").asText();
        String kilogramsRef =
                kilograms.path("result").path("unit").path("unitRef").asText();
        assertFalse(gramsRef.isBlank(), "BUSINESS: truncation fixture has a gram consumption unit");
        assertFalse(kilogramsRef.isBlank(), "BUSINESS: truncation fixture has a kilogram counting unit");

        String itemCode = "ACC-TRUNCATE-" + suffix;
        CreatedItem created =
                createItemWithAttributes(context, fixture, session, itemCode, "truncate quantity", Map.of());
        saveIndependentSkuWithUnits(
                context,
                fixture,
                session,
                itemCode,
                created.version(),
                gramsRef,
                gramsRef,
                kilogramsRef,
                "1000",
                "ACC-TRUNCATE-SKU-" + suffix);
        JsonNode item = readItem(context, fixture, session, itemCode);
        String targetRef = item.path("inventoryBom").get(0).path("targetRef").asText();
        Response current = context.get(
                OPERATIONS_INVENTORY_TARGET_READ,
                "/api/operations/catalog-inventory/inventory-targets/" + targetRef + "?dataNodeRef="
                        + fixture.storeId(),
                session.cookie(),
                Set.of(200));
        long targetVersion = current.json().path("version").asLong();

        Response counted = context.post(
                OPERATIONS_INVENTORY_TARGET_COUNT,
                "/api/operations/catalog-inventory/inventory-targets/" + targetRef + "/count",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "targetRef",
                        targetRef,
                        "expectedVersion",
                        targetVersion,
                        "countedQuantity",
                        "0.3567",
                        "countingUnitRef",
                        kilogramsRef,
                        "zeroConfirmation",
                        false),
                idempotencyHeaders("inventory-truncate-count"),
                Set.of(200));
        assertEquals(
                "356",
                counted.json().path("result").path("after").asText(),
                "BUSINESS: 0.3567 kg times 1000 is truncated toward zero to 356 g, never rounded to 357 g");
        assertEquals(
                "356",
                counted.json().path("result").path("change").asText(),
                "BUSINESS: the ledger delta is the same consumption-unit value as the stored balance");

        JsonNode targetReadback = context.get(
                        OPERATIONS_INVENTORY_TARGET_READ,
                        "/api/operations/catalog-inventory/inventory-targets/" + targetRef + "?dataNodeRef="
                                + fixture.storeId(),
                        session.cookie(),
                        Set.of(200))
                .json();
        JsonNode target = targetReadback.path("target");
        assertEquals("356", targetReadback.path("balance").asText(), "BUSINESS: target balance is stored in grams");
        assertEquals(
                gramsRef,
                target.path("consumptionUnitSnapshot").path("unitRef").asText(),
                "BUSINESS: target consumption unit remains the base-unit snapshot");
        assertEquals(
                0,
                target.path("consumptionUnitSnapshot").path("precision").asInt(),
                "BUSINESS: the consumption unit's own precision governs truncation");

        JsonNode ledgerEntry = context.get(
                        OPERATIONS_INVENTORY_TARGET_LEDGER,
                        "/api/operations/catalog-inventory/inventory-targets/" + targetRef + "/ledger?dataNodeRef="
                                + fixture.storeId() + "&pageSize=20",
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("entries")
                .get(0);
        assertEquals(
                "356", ledgerEntry.path("afterQuantity").asText(), "BUSINESS: ledger stores the truncated after value");
        assertEquals(
                gramsRef,
                ledgerEntry.path("consumptionUnitSnapshot").path("unitRef").asText(),
                "BUSINESS: ledger stores the consumption-unit snapshot, not a live unit lookup");
        long gramsVersion = grams.path("result").path("unit").path("version").asLong();
        context.patch(
                OPERATIONS_CATALOG_UNIT_UPDATE,
                "/api/operations/catalog-inventory/units/" + gramsRef,
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "unitRef",
                        gramsRef,
                        "expectedVersion",
                        gramsVersion,
                        "name",
                        "克（改名）"),
                idempotencyHeaders("inventory-truncate-unit-rename"),
                Set.of(200));
        JsonNode historical = context.get(
                        OPERATIONS_INVENTORY_TARGET_LEDGER,
                        "/api/operations/catalog-inventory/inventory-targets/" + targetRef + "/ledger?dataNodeRef="
                                + fixture.storeId() + "&pageSize=20",
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("entries")
                .get(0)
                .path("consumptionUnitSnapshot");
        assertEquals(
                "克",
                historical.path("name").asText(),
                "BUSINESS: changing a unit definition later does not reinterpret the historical ledger snapshot");
    }

    @AcceptanceScenario(
            id = "inventory.count-preserves-consumption-precision-without-counting-unit",
            module = "CATALOG",
            operation = "countOperationsInventoryTarget")
    void inventoryCountPreservesConsumptionPrecisionWithoutCountingUnit(BackendAcceptanceTest.ScenarioContext context)
            throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        String kilogramCode = "ACC-UNIT-KG-NO-COUNTING-" + suffix;
        JsonNode kilograms = createAcceptanceUnit(context, fixture, session, kilogramCode, "千克", "WEIGHT", 3);
        String kilogramsRef =
                kilograms.path("result").path("unit").path("unitRef").asText();
        assertFalse(kilogramsRef.isBlank(), "BUSINESS: precision fixture has a kilogram consumption unit");

        String itemCode = "ACC-NO-COUNTING-PRECISION-" + suffix;
        CreatedItem created =
                createItemWithAttributes(context, fixture, session, itemCode, "no counting precision", Map.of());
        saveIndependentSkuWithUnits(
                context,
                fixture,
                session,
                itemCode,
                created.version(),
                kilogramsRef,
                kilogramsRef,
                null,
                "1",
                "ACC-NO-COUNTING-SKU-" + suffix);

        JsonNode item = readItem(context, fixture, session, itemCode);
        String targetRef = item.path("inventoryBom").get(0).path("targetRef").asText();
        Response current = context.get(
                OPERATIONS_INVENTORY_TARGET_READ,
                "/api/operations/catalog-inventory/inventory-targets/" + targetRef + "?dataNodeRef="
                        + fixture.storeId(),
                session.cookie(),
                Set.of(200));
        JsonNode currentTarget = current.json().path("target");
        assertTrue(
                currentTarget.path("countingUnitSnapshot").isNull(),
                "BUSINESS: an inventory target may have no counting-unit snapshot");
        assertEquals(
                3,
                currentTarget.path("consumptionUnitSnapshot").path("precision").asInt(),
                "BUSINESS: the consumption unit declares the source precision when no counting unit exists");

        Map<String, Object> countRequest = new LinkedHashMap<>();
        countRequest.put("dataNodeRef", fixture.storeId().toString());
        countRequest.put("targetRef", targetRef);
        countRequest.put("expectedVersion", current.json().path("version").asLong());
        countRequest.put("countedQuantity", "2.5");
        countRequest.put("countingUnitRef", null);
        countRequest.put("zeroConfirmation", false);
        Response counted = context.post(
                OPERATIONS_INVENTORY_TARGET_COUNT,
                "/api/operations/catalog-inventory/inventory-targets/" + targetRef + "/count",
                session.cookie(),
                countRequest,
                idempotencyHeaders("inventory-no-counting-precision"),
                Set.of(200));
        assertEquals(
                "2.5",
                counted.json().path("result").path("after").asText(),
                "BUSINESS: 2.5 kg remains 2.5 kg when the consumption unit has precision 3 and no counting unit");
        assertEquals(
                "2.5",
                counted.json().path("result").path("change").asText(),
                "BUSINESS: the ledger delta preserves the consumption-unit precision");

        JsonNode readback = context.get(
                        OPERATIONS_INVENTORY_TARGET_READ,
                        "/api/operations/catalog-inventory/inventory-targets/" + targetRef + "?dataNodeRef="
                                + fixture.storeId(),
                        session.cookie(),
                        Set.of(200))
                .json();
        String decimalBalanceMessage = "BUSINESS: target readback preserves the decimal balance";
        assertEquals("2.5", readback.path("balance").asText(), decimalBalanceMessage);
        assertTrue(
                readback.path("configuration").path("countingUnitSnapshot").isNull(),
                "BUSINESS: configuration readback keeps the absent counting unit absent");

        JsonNode ledgerEntry = context.get(
                        OPERATIONS_INVENTORY_TARGET_LEDGER,
                        "/api/operations/catalog-inventory/inventory-targets/" + targetRef + "/ledger?dataNodeRef="
                                + fixture.storeId() + "&pageSize=20",
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("entries")
                .get(0);
        assertEquals(
                "2.5",
                ledgerEntry.path("afterQuantity").asText(),
                "BUSINESS: ledger readback preserves the decimal after quantity");
        assertEquals(
                kilogramsRef,
                ledgerEntry.path("consumptionUnitSnapshot").path("unitRef").asText(),
                "BUSINESS: the ledger keeps the consumption-unit snapshot as its accounting unit");
    }

    @AcceptanceScenario(
            id = "catalog.base-measure-unit-change-blocked-by-existing-target",
            module = "CATALOG",
            operation = "saveOperationsCatalogItem")
    void baseMeasureUnitChangeBlockedByExistingTarget(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String itemCode = "ACC-BASE-UNIT-BLOCK-" + suffix;
        CreatedItem created =
                createItemWithAttributes(context, fixture, session, itemCode, "base unit guard", Map.of());
        saveIndependentSku(context, fixture, session, itemCode, created.version(), null, "ACC-BASE-UNIT-SKU-" + suffix);

        JsonNode before = readItem(context, fixture, session, itemCode);
        String oldBaseUnitRef = before.path("baseMeasureUnitRef").asText();
        String targetRef = before.path("inventoryBom").get(0).path("targetRef").asText();
        JsonNode targetBefore = context.get(
                        OPERATIONS_INVENTORY_TARGET_READ,
                        "/api/operations/catalog-inventory/inventory-targets/" + targetRef + "?dataNodeRef="
                                + fixture.storeId(),
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("target");
        long catalogVersion = before.path("version").asLong();
        long targetVersion = targetBefore.path("version").asLong();

        JsonNode replacement = createAcceptanceUnit(
                context, fixture, session, "ACC-UNIT-BASE-REPLACEMENT-" + suffix, "个（新）", "COUNT", 0);
        String replacementRef =
                replacement.path("result").path("unit").path("unitRef").asText();
        Map<String, Object> draft = itemDraft(context, fixture, session, itemCode);
        draft.put("baseMeasureUnitRef", replacementRef);
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("expectedCatalogVersion", catalogVersion);
        sections.put("catalogDraft", draft);
        sections.put("inventoryConfiguration", Map.of("nodes", List.of()));
        sections.put("expectedInventoryVersions", List.of());
        Response rejected = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(itemCode),
                session.cookie(),
                Map.of("dataNodeRef", fixture.storeId().toString(), "itemCode", itemCode, "sections", sections),
                idempotencyHeaders("catalog-base-unit-change-blocked"),
                Set.of(409));
        assertEquals(
                "CATALOG_BASE_MEASURE_UNIT_CHANGE_BLOCKED",
                rejected.problemCode(),
                "BUSINESS: catalog save rejects a base-unit change that would alter an existing target snapshot");

        JsonNode after = readItem(context, fixture, session, itemCode);
        assertEquals(
                catalogVersion,
                after.path("version").asLong(),
                "BUSINESS: the typed guard rejects inside the catalog save transaction before catalog UPDATE");
        assertEquals(
                oldBaseUnitRef,
                after.path("baseMeasureUnitRef").asText(),
                "BUSINESS: the catalog base-unit reference remains unchanged after rejection");
        JsonNode targetAfter = context.get(
                        OPERATIONS_INVENTORY_TARGET_READ,
                        "/api/operations/catalog-inventory/inventory-targets/" + targetRef + "?dataNodeRef="
                                + fixture.storeId(),
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("target");
        assertEquals(
                targetVersion,
                targetAfter.path("version").asLong(),
                "BUSINESS: the existing inventory target is not silently synchronized or rewritten");
        assertEquals(
                oldBaseUnitRef,
                targetAfter.path("consumptionUnitSnapshot").path("unitRef").asText(),
                "BUSINESS: the existing target keeps its original consumption-unit snapshot");
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
                itemCreateBody(
                        fixture.storeId().toString(),
                        itemCode,
                        "Acceptance matrix " + suffix,
                        "SKU_VARIANT_SALE_COUNTED",
                        null),
                Set.of(200));
        long createdVersion = created.json().path("result").path("version").asLong();
        assertTrue(createdVersion > 0, "BUSINESS: item shell creation returns a versioned owner fact");

        JsonNode each = createAcceptanceUnit(context, fixture, session, "ACC-UNIT-MATRIX-" + suffix, "个", "COUNT", 0);
        String eachRef = each.path("result").path("unit").path("unitRef").asText();
        Map<String, Object> saveBody =
                matrixSaveBody(fixture, itemCode, createdVersion, size, temperature, small, large, hot, cold, eachRef);
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

    @AcceptanceScenario(
            id = "pagination.catalog-dictionary-real-cursor",
            module = "CATALOG",
            operation = "getOperationsCatalogDictionary")
    void catalogDictionaryRealCursor(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        Fixture sibling = host.siblingStoreFixtureSameBrand(fixture, Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, sibling);
        Session siblingSession = host.login(context, sibling);
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        JsonNode requestedParent = createDictionaryEntry(
                context, fixture, session, "SKU_ATTRIBUTE", "ACC-PAGE-ATTRIBUTE-" + suffix, "Page attribute");
        JsonNode otherParent = createDictionaryEntry(
                context, fixture, session, "SKU_ATTRIBUTE", "ACC-OTHER-ATTRIBUTE-" + suffix, "Other attribute");
        Set<String> expectedCodes = new LinkedHashSet<>();
        for (int index = 0; index < 5; index++) {
            String code = "ACC-PAGE-DICT-" + suffix + "-" + index;
            expectedCodes.add(code);
            createDictionaryEntryWithoutReadback(
                    context,
                    fixture,
                    session,
                    fixture.storeId().toString(),
                    "SKU_ATTRIBUTE_VALUE",
                    code,
                    "Page value " + index,
                    requestedParent.path("entryRef").asText());
        }
        createDictionaryEntryWithoutReadback(
                context,
                fixture,
                session,
                fixture.storeId().toString(),
                "SKU_ATTRIBUTE_VALUE",
                "ACC-OTHER-DICT-" + suffix,
                "Other parent value",
                otherParent.path("entryRef").asText());
        JsonNode siblingParent = createDictionaryEntry(
                context,
                sibling,
                siblingSession,
                "SKU_ATTRIBUTE",
                "ACC-SIBLING-ATTRIBUTE-" + suffix,
                "Sibling attribute");
        createDictionaryEntryWithoutReadback(
                context,
                sibling,
                siblingSession,
                sibling.storeId().toString(),
                "SKU_ATTRIBUTE_VALUE",
                "ACC-PAGE-DICT-" + suffix + "-FOREIGN",
                "Foreign value",
                siblingParent.path("entryRef").asText());

        String dictionaryPath = "/api/operations/catalog-inventory/dictionaries/SKU_ATTRIBUTE_VALUE?dataNodeRef="
                + fixture.storeId()
                + "&parentEntryRef="
                + requestedParent.path("entryRef").asText()
                + "&pageSize=2";
        String firstDictionaryCursor = context.get(
                        OPERATIONS_CATALOG_DICTIONARY_READ, dictionaryPath, session.cookie(), Set.of(200))
                .json()
                .path("data")
                .path("cursor")
                .asText();
        assertFalse(
                firstDictionaryCursor.isBlank(),
                "BUSINESS: dictionary fixture exposes a cursor before a query-identity negative control");
        BackendAcceptanceTest.Response mismatchedDictionaryCursor = context.get(
                OPERATIONS_CATALOG_DICTIONARY_READ,
                "/api/operations/catalog-inventory/dictionaries/SKU_ATTRIBUTE_VALUE?dataNodeRef="
                        + fixture.storeId()
                        + "&parentEntryRef="
                        + otherParent.path("entryRef").asText()
                        + "&pageSize=2&cursor="
                        + java.net.URLEncoder.encode(firstDictionaryCursor, java.nio.charset.StandardCharsets.UTF_8),
                session.cookie(),
                Set.of(422));
        assertEquals(
                "VALIDATION_ERROR",
                mismatchedDictionaryCursor.problemCode(),
                "BUSINESS: a cursor from another dictionary query identity is rejected as a typed validation failure");

        Set<String> observed = collectCursorCodes(
                context,
                OPERATIONS_CATALOG_DICTIONARY_READ,
                dictionaryPath,
                session.cookie(),
                "entries",
                expectedCodes.size(),
                2,
                data -> assertEquals(
                        "SKU_ATTRIBUTE_VALUE",
                        data.path("dictionaryKind").asText(),
                        "BUSINESS: dictionary page keeps its requested kind"));
        assertEquals(
                expectedCodes,
                observed,
                "BUSINESS: dictionary cursor pages contain every requested parent value and no other scope/value");
    }

    @AcceptanceScenario(
            id = "pagination.production-tags-real-cursor",
            module = "CATALOG",
            operation = "getOperationsProductionTags")
    void productionTagsRealCursor(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        Fixture sibling = host.siblingStoreFixtureSameBrand(fixture, Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, sibling);
        Session siblingSession = host.login(context, sibling);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Set<String> expectedCodes = new LinkedHashSet<>();
        for (int index = 0; index < 5; index++) {
            String code = "ACC-PAGE-TAG-" + suffix + "-" + index;
            expectedCodes.add(code);
            createProductionTag(context, fixture, session, code, "Page production tag " + index);
        }
        createProductionTag(
                context, sibling, siblingSession, "ACC-PAGE-TAG-" + suffix + "-FOREIGN", "Foreign production tag");

        Set<String> observed = collectCursorCodes(
                context,
                OPERATIONS_PRODUCTION_TAGS,
                "/api/operations/catalog-inventory/production-tags?dataNodeRef=" + fixture.storeId() + "&pageSize=2",
                session.cookie(),
                "entries",
                expectedCodes.size(),
                2,
                data -> assertEquals(
                        fixture.storeId().toString(),
                        data.path("entries").get(0).path("ownerRef").asText(),
                        "BUSINESS: production-tag pages identify the requested data-node owner"));
        assertEquals(
                expectedCodes,
                observed,
                "BUSINESS: production-tag cursor pages contain every target-scope tag and no sibling-scope tag");
    }

    @AcceptanceScenario(
            id = "pagination.local-copy-candidates-real-cursor",
            module = "CATALOG",
            operation = "getOperationsLocalCatalogCopyCandidates")
    void localCopyCandidatesRealCursor(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        Fixture sibling = host.siblingStoreFixtureSameBrand(fixture, Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, sibling);
        Session siblingSession = host.login(context, sibling);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String prefix = "ACC-PAGE-LOCAL-" + suffix;
        Set<String> expectedCodes = new LinkedHashSet<>();
        for (int index = 0; index < 5; index++) {
            String code = prefix + "-" + index;
            expectedCodes.add(code);
            createItemWithAttributes(context, fixture, session, code, "Local candidate " + index, Map.of());
        }
        createItemWithAttributes(context, sibling, siblingSession, prefix + "-FOREIGN", "Foreign candidate", Map.of());

        Set<String> observed = collectCursorCodes(
                context,
                OPERATIONS_CATALOG_LOCAL_COPY_CANDIDATES,
                "/api/operations/catalog-inventory/copy/local/candidates?dataNodeRef="
                        + fixture.storeId()
                        + "&keyword="
                        + java.net.URLEncoder.encode(prefix, java.nio.charset.StandardCharsets.UTF_8)
                        + "&pageSize=2",
                session.cookie(),
                "items",
                expectedCodes.size(),
                2,
                data -> assertEquals(
                        fixture.storeId().toString(),
                        data.path("sourceScope").path("ownerRef").asText(),
                        "BUSINESS: local-copy candidates read only the requested source data node"));
        assertEquals(
                expectedCodes,
                observed,
                "BUSINESS: local-copy cursor pages contain every target-scope keyword match and no sibling match");
    }

    @AcceptanceScenario(
            id = "pagination.brand-copy-candidates-real-cursor",
            module = "CATALOG",
            operation = "getOperationsBrandCatalogCopyCandidates")
    void brandCopyCandidatesRealCursor(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BrandCopyFixtures fixtures = host.brandCopyFixtures(Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixtures.source());
        host.completeInvitation(context, fixtures.target());
        Session sourceSession = host.login(context, fixtures.source());
        Session targetSession = host.login(context, fixtures.target());
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String prefix = "ACC-PAGE-BRAND-" + suffix;
        Set<String> expectedCodes = new LinkedHashSet<>();
        for (int index = 0; index < 5; index++) {
            String code = prefix + "-" + index;
            expectedCodes.add(code);
            createItemWithAttributes(
                    context,
                    fixtures.source(),
                    sourceSession,
                    fixtures.source().headCompanyId().toString(),
                    code,
                    "Brand source candidate " + index,
                    Map.of(),
                    Map.of("X-Workspace-Brand-Ref", fixtures.source().brandId().toString()));
        }
        createItemWithAttributes(
                context,
                fixtures.target(),
                targetSession,
                fixtures.target().storeId().toString(),
                prefix + "-TARGET",
                "Target-only item",
                Map.of());

        Set<String> observed = collectCursorCodes(
                context,
                OPERATIONS_CATALOG_BRAND_COPY_CANDIDATES,
                "/api/operations/catalog-inventory/copy/brand/candidates?dataNodeRef="
                        + fixtures.target().storeId()
                        + "&keyword="
                        + java.net.URLEncoder.encode(prefix, java.nio.charset.StandardCharsets.UTF_8)
                        + "&pageSize=2",
                targetSession.cookie(),
                "items",
                expectedCodes.size(),
                2,
                data -> {
                    assertEquals(
                            "HEAD_COMPANY",
                            data.path("sourceScope").path("ownerType").asText(),
                            "BUSINESS: brand-copy source scope is a head company");
                    assertEquals(
                            fixtures.source().headCompanyId().toString(),
                            data.path("sourceScope").path("ownerRef").asText(),
                            "BUSINESS: brand-copy source scope is the authorized head company");
                    assertEquals(
                            fixtures.target().storeId().toString(),
                            data.path("targetScope").path("ownerRef").asText(),
                            "BUSINESS: brand-copy target scope remains the requested store");
                });
        assertEquals(
                expectedCodes,
                observed,
                "BUSINESS: brand-copy cursor pages contain all authorized head-company candidates and no target item");
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
        assertEquals(
                14, responseFields.size(), "BUSINESS: the generated shape field denominator includes both unit fields");
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
                    before.path("attributeAssignments").deepCopy()));
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
                foreignBefore.path("attributeAssignments").deepCopy()));

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
                    item.attributeAssignmentsBefore(),
                    after.path("attributeAssignments"),
                    "BUSINESS: batch status migration does not alter product attribute assignments");
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
                        OTHER_PNG,
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
                itemCreateBody(
                        fixture.storeId().toString(),
                        archivedCode,
                        "must not reuse archived code",
                        "STANDARD_SALE_COUNTED",
                        null),
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
        long boundVersion = saveCategoryRef(context, fixture, session, itemCode, createdVersion, categoryRef);
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
                        .path("categoryRef")
                        .asText(),
                "BUSINESS: rejected category deletion preserves the item's relation");

        long unboundVersion = saveCategoryRef(context, fixture, session, itemCode, boundVersion, null);
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

    /**
     * Fixture: creates two enabled catalog tags, binds only one to a catalog item, then reads the same owner facts
     * through navigation and the item page. It proves that tree counts include every enabled tag and that a tag
     * selection does not leak untagged items into the product list.
     */
    @AcceptanceScenario(
            id = "catalog.tag-navigation-and-filter",
            module = "CATALOG",
            operation = "getOperationsCatalogNavigation")
    void tagNavigationAndFilter(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        JsonNode selectedTag = createDictionaryEntry(
                context, fixture, session, "TAG", "ACC-TAG-SELECTED-" + suffix, "Selected tag " + suffix);
        JsonNode unusedTag = createDictionaryEntry(
                context, fixture, session, "TAG", "ACC-TAG-UNUSED-" + suffix, "Unused tag " + suffix);
        JsonNode disabledTag = createDictionaryEntry(
                context, fixture, session, "TAG", "ACC-TAG-DISABLED-" + suffix, "Disabled tag " + suffix);
        context.post(
                OPERATIONS_CATALOG_DICTIONARY_STATUS,
                "/api/operations/catalog-inventory/dictionaries/TAG/entries/"
                        + disabledTag.path("code").asText()
                        + "/status",
                session.cookie(),
                Map.of(
                        "dictionaryKind",
                        "TAG",
                        "entryCode",
                        disabledTag.path("code").asText(),
                        "expectedVersion",
                        disabledTag.path("version").asLong(),
                        "targetStatus",
                        "DISABLED",
                        "dataNodeRef",
                        fixture.storeId().toString()),
                Set.of(200));

        String taggedItemCode = "ACC-TAGGED-ITEM-" + suffix;
        long taggedItemVersion = createItem(context, fixture, session, taggedItemCode, "tagged item " + suffix);
        saveCatalogTags(
                context,
                fixture,
                session,
                taggedItemCode,
                taggedItemVersion,
                List.of(selectedTag.path("entryRef").asText()));
        String untaggedItemCode = "ACC-UNTAGGED-ITEM-" + suffix;
        createItem(context, fixture, session, untaggedItemCode, "untagged item " + suffix);

        Response navigation = context.get(
                OPERATIONS_CATALOG_NAVIGATION,
                "/api/operations/catalog-inventory/navigation?dataNodeRef=" + fixture.storeId(),
                session.cookie(),
                Set.of(200));
        JsonNode selectedNavigationTag = findByCode(
                navigation.json().path("data").path("tags"),
                selectedTag.path("code").asText());
        assertEquals(
                selectedTag.path("entryRef").asText(),
                selectedNavigationTag.path("tagRef").asText(),
                "BUSINESS: navigation returns the enabled catalog tag's opaque owner identity");
        assertEquals(
                1,
                selectedNavigationTag.path("count").asInt(),
                "BUSINESS: navigation count equals the number of non-voided products using this tag");
        assertEquals(
                0,
                findByCode(
                                navigation.json().path("data").path("tags"),
                                unusedTag.path("code").asText())
                        .path("count")
                        .asInt(),
                "BUSINESS: navigation retains enabled tags even when no product currently uses them");
        assertFalse(
                array(navigation.json().path("data").path("tags")).stream().anyMatch(tag -> disabledTag
                        .path("code")
                        .asText()
                        .equals(tag.path("code").asText())),
                "BUSINESS: navigation excludes disabled catalog tags from the tree collection");

        Response filtered = context.get(
                OPERATIONS_CATALOG_ITEMS,
                "/api/operations/catalog-inventory/items?dataNodeRef="
                        + fixture.storeId()
                        + "&tagRef="
                        + selectedTag.path("entryRef").asText()
                        + "&pageSize=20",
                session.cookie(),
                Set.of(200));
        List<String> filteredCodes = array(filtered.json().path("data").path("items")).stream()
                .map(item -> item.path("code").asText())
                .toList();
        assertEquals(
                1,
                filtered.json().path("data").path("total").asInt(),
                "BUSINESS: tag filter total is the matching item count");
        assertEquals(
                List.of(taggedItemCode),
                filteredCodes,
                "BUSINESS: tag filter returns the tagged product and excludes the untagged product "
                        + untaggedItemCode);
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
                skuRef.matches("[0-9a-f-]{36}")
                        && targetRef.matches("[0-9a-f-]{36}")
                        && sku.path("version").isIntegralNumber(),
                "BUSINESS: one real save creates linked SKU and inventory target facts; sku=" + sku);

        Map<String, Object> request = skuVoidRequest(before, savedVersion, skuRef);
        Response rejected = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(code),
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "itemCode",
                        code,
                        "sections",
                        request.get("sections"),
                        "skuTransitions",
                        request.get("skuTransitions")),
                Set.of(422));
        assertEquals(
                "REFERENCE_BLOCKS_VOID",
                rejected.problemCode(),
                "BUSINESS: a SKU referenced by Inventory cannot be silently archived or removed; response="
                        + rejected.raw());
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

        String compositeBlockedCode =
                "ACC-SKU-COMPOSITE-" + UUID.randomUUID().toString().substring(0, 8);
        CreatedItem compositeBlocked = createItemWithAttributes(
                context, fixture, session, compositeBlockedCode, "catalog composite guarded SKU", Map.of());
        long compositeVersion = saveIndependentSku(
                context, fixture, session, compositeBlockedCode, compositeBlocked.version(), null, "ACC-SKU-COMPOSITE");
        JsonNode compositeSku = readItem(context, fixture, session, compositeBlockedCode)
                .path("skus")
                .get(0);
        String compositeSkuRef = compositeSku.path("productSkuRef").asText();
        String compositeOwnerCode =
                "ACC-SKU-COMPOSITE-OWNER-" + UUID.randomUUID().toString().substring(0, 8);
        CreatedItem compositeOwner = createItemWithAttributes(
                context, fixture, session, compositeOwnerCode, "catalog composite owner", Map.of());
        Map<String, Object> compositeComponent = new LinkedHashMap<>();
        compositeComponent.put("itemRef", compositeBlocked.itemRef().toString());
        compositeComponent.put("productSkuRef", compositeSkuRef);
        compositeComponent.put("skuCode", compositeSku.path("skuCode").asText());
        compositeComponent.put("quantity", "1");
        compositeComponent.put("unit", "EA");
        compositeComponent.put("default", true);
        compositeComponent.put("status", "ENABLED");
        compositeComponent.put("displayOrder", 0);
        Map<String, Object> compositeGroup = new LinkedHashMap<>();
        compositeGroup.put("groupCode", "ACC-COMPOSITE");
        compositeGroup.put("groupName", "Acceptance composite");
        compositeGroup.put("selectionRule", "OPTIONAL");
        compositeGroup.put("minSelections", 0);
        compositeGroup.put("maxSelections", 1);
        compositeGroup.put("displayOrder", 0);
        compositeGroup.put("components", List.of(compositeComponent));
        Map<String, Object> compositeSections = new LinkedHashMap<>();
        compositeSections.put("expectedCatalogVersion", compositeOwner.version());
        compositeSections.put("catalogDraft", Map.of("compositeGroups", List.of(compositeGroup)));
        Response compositeSaved = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(compositeOwnerCode),
                session.cookie(),
                Map.of(
                        "dataNodeRef", fixture.storeId().toString(),
                        "itemCode", compositeOwnerCode,
                        "sections", compositeSections),
                Set.of(200));
        assertTrue(
                compositeSaved.json().path("version").asLong() > compositeOwner.version(),
                "BUSINESS: catalog composite fixture is persisted before the SKU guard is exercised");
        assertSkuRemovalBlocked(
                context, fixture, session, compositeBlockedCode, compositeVersion, compositeSkuRef, "catalog facts");

        String bomBlockedCode = "ACC-SKU-BOM-" + UUID.randomUUID().toString().substring(0, 8);
        CreatedItem bomBlocked =
                createItemWithAttributes(context, fixture, session, bomBlockedCode, "BOM guarded SKU", Map.of());
        long bomVersion = saveIndependentSku(
                context, fixture, session, bomBlockedCode, bomBlocked.version(), null, "ACC-SKU-BOM");
        JsonNode bomSku =
                readItem(context, fixture, session, bomBlockedCode).path("skus").get(0);
        String bomSkuRef = bomSku.path("productSkuRef").asText();
        bomVersion = saveSkuBom(context, fixture, session, bomBlockedCode, bomVersion, bomSkuRef, targetRef);
        assertSkuRemovalBlocked(context, fixture, session, bomBlockedCode, bomVersion, bomSkuRef, "BOM");
    }

    private void assertSkuRemovalBlocked(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            long expectedVersion,
            String skuRef,
            String sourceLabel)
            throws Exception {
        JsonNode current = readItem(context, fixture, session, itemCode);
        Map<String, Object> request = skuVoidRequest(current, expectedVersion, skuRef);
        Response rejected = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(itemCode),
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "itemCode",
                        itemCode,
                        "sections",
                        request.get("sections"),
                        "skuTransitions",
                        request.get("skuTransitions")),
                Set.of(422));
        assertEquals(
                422,
                rejected.status(),
                "BUSINESS: SKU blocker returns an unprocessable response; response=" + rejected.raw());
        assertEquals("REFERENCE_BLOCKS_VOID", rejected.problemCode(), "BUSINESS: SKU removal has a typed blocker");
        String detail = rejected.json().path("detail").asText();
        assertTrue(detail.contains(skuRef), "BUSINESS: blocker is attributable to the requested SKU ref");
        assertTrue(detail.contains(sourceLabel), "BUSINESS: blocker identifies its owning source " + sourceLabel);
        assertEquals(
                skuRef,
                current.path("skus").get(0).path("productSkuRef").asText(),
                "BUSINESS: blocked SKU remains after the rejected removal");
    }

    private Map<String, Object> skuVoidRequest(JsonNode current, long expectedCatalogVersion, String skuRef) {
        JsonNode sku = array(current.path("skus")).stream()
                .filter(candidate ->
                        skuRef.equals(candidate.path("productSkuRef").asText()))
                .findFirst()
                .orElseThrow();
        Map<String, Object> draft = new LinkedHashMap<>();
        draft.put("name", current.path("name").asText());
        draft.put("shapeKey", current.path("shapeKey").asText());
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("expectedCatalogVersion", expectedCatalogVersion);
        sections.put("catalogDraft", draft);
        Map<String, Object> transition = new LinkedHashMap<>();
        transition.put("skuRef", skuRef);
        transition.put("targetStatus", "VOIDED");
        transition.put("expectedVersion", sku.path("version").asLong());
        return Map.of("sections", sections, "skuTransitions", List.of(transition));
    }

    private long saveSkuBom(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            long expectedVersion,
            String skuRef,
            String targetRef)
            throws Exception {
        JsonNode item = readItem(context, fixture, session, itemCode);
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("mode", "BOM");
        entry.put("itemRef", item.path("itemRef").asText());
        entry.put("itemCode", itemCode);
        entry.put("productSkuRef", skuRef);
        entry.put("skuCode", item.path("skus").get(0).path("skuCode").asText());
        entry.put("targetRef", targetRef);
        entry.put("quantity", "1");
        entry.put("unit", "EA");
        entry.put("lineSign", "POSITIVE");
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("expectedCatalogVersion", expectedVersion);
        sections.put("catalogDraft", Map.of("inventoryBom", List.of(entry)));
        Response saved = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(itemCode),
                session.cookie(),
                Map.of("dataNodeRef", fixture.storeId().toString(), "itemCode", itemCode, "sections", sections),
                Set.of(200));
        long version = saved.json().path("version").asLong();
        assertTrue(version > expectedVersion, "BUSINESS: BOM fixture advances the catalog version");
        return version;
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
            id = "inventory-consumption-reference-isolation",
            module = "CATALOG",
            operation = "getOperationsInventoryTargetConsumptionReferences")
    void inventoryConsumptionReferenceIsolation(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        String targetCode = "ACC-REF-TARGET-" + suffix;
        long targetVersion = createItem(context, fixture, session, targetCode, "reference target");
        saveIndependentSku(context, fixture, session, targetCode, targetVersion, null, "ACC-REF-TARGET-SKU");
        String targetRef = readItem(context, fixture, session, targetCode)
                .path("inventoryBom")
                .get(0)
                .path("targetRef")
                .asText();

        String otherTargetCode = "ACC-REF-OTHER-TARGET-" + suffix;
        long otherTargetVersion = createItem(context, fixture, session, otherTargetCode, "other target");
        saveIndependentSku(
                context, fixture, session, otherTargetCode, otherTargetVersion, null, "ACC-REF-OTHER-TARGET-SKU");
        String otherTargetRef = readItem(context, fixture, session, otherTargetCode)
                .path("inventoryBom")
                .get(0)
                .path("targetRef")
                .asText();

        String sourceACode = "ACC-REF-SOURCE-A-" + suffix;
        CreatedItem sourceA =
                createItemWithAttributes(context, fixture, session, sourceACode, "reference source A", Map.of());
        long sourceAVersion = saveIndependentSku(
                context, fixture, session, sourceACode, sourceA.version(), null, "ACC-REF-SOURCE-A-SKU");
        JsonNode sourceARead = readItem(context, fixture, session, sourceACode);
        host.insertInventoryBomFixture(
                fixture.storeId(),
                fixture.brandId(),
                sourceA.itemRef(),
                UUID.fromString(
                        sourceARead.path("skus").get(0).path("productSkuRef").asText()),
                sourceACode,
                "ACC-REF-SOURCE-A-SKU",
                List.of(referenceRow(targetRef, null, "1")));
        assertTrue(sourceAVersion > 0, "BUSINESS: source A is created through the real catalog command");

        String sourceBCode = "ACC-REF-SOURCE-B-" + suffix;
        CreatedItem sourceB =
                createItemWithAttributes(context, fixture, session, sourceBCode, "reference source B", Map.of());
        long sourceBVersion = saveIndependentSku(
                context, fixture, session, sourceBCode, sourceB.version(), null, "ACC-REF-SOURCE-B-SKU");
        JsonNode sourceBRead = readItem(context, fixture, session, sourceBCode);
        host.insertInventoryBomFixture(
                fixture.storeId(),
                fixture.brandId(),
                sourceB.itemRef(),
                UUID.fromString(
                        sourceBRead.path("skus").get(0).path("productSkuRef").asText()),
                sourceBCode,
                "ACC-REF-SOURCE-B-SKU",
                List.of(referenceRow(null, targetRef, "2")));
        assertTrue(sourceBVersion > 0, "BUSINESS: source B is created through the real catalog command");

        String sourceCCode = "ACC-REF-SOURCE-C-" + suffix;
        CreatedItem sourceC =
                createItemWithAttributes(context, fixture, session, sourceCCode, "reference source C", Map.of());
        long sourceCVersion = saveIndependentSku(
                context, fixture, session, sourceCCode, sourceC.version(), null, "ACC-REF-SOURCE-C-SKU");
        JsonNode sourceCRead = readItem(context, fixture, session, sourceCCode);
        host.insertInventoryBomFixture(
                fixture.storeId(),
                fixture.brandId(),
                sourceC.itemRef(),
                UUID.fromString(
                        sourceCRead.path("skus").get(0).path("productSkuRef").asText()),
                sourceCCode,
                "ACC-REF-SOURCE-C-SKU",
                List.of(referenceRow(null, targetRef, "3")));
        assertTrue(sourceCVersion > 0, "BUSINESS: source C is created through the real catalog command");

        String distractorCode = "ACC-REF-DISTRACTOR-" + suffix;
        CreatedItem distractor =
                createItemWithAttributes(context, fixture, session, distractorCode, "reference distractor", Map.of());
        long distractorVersion = saveIndependentSku(
                context, fixture, session, distractorCode, distractor.version(), null, "ACC-REF-DISTRACTOR-SKU");
        JsonNode distractorRead = readItem(context, fixture, session, distractorCode);
        host.insertInventoryBomFixture(
                fixture.storeId(),
                fixture.brandId(),
                distractor.itemRef(),
                UUID.fromString(
                        distractorRead.path("skus").get(0).path("productSkuRef").asText()),
                distractorCode,
                "ACC-REF-DISTRACTOR-SKU",
                List.of(referenceRow(otherTargetRef, null, "4")));
        assertTrue(distractorVersion > 0, "BUSINESS: same-scope distractor is created through the real command");

        Fixture crossScope = host.siblingStoreFixture(fixture, Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(context, crossScope);
        Session crossSession = host.login(context, crossScope);
        String crossCode = "ACC-REF-CROSS-" + suffix;
        CreatedItem crossSource =
                createItemWithAttributes(context, crossScope, crossSession, crossCode, "cross scope source", Map.of());
        saveIndependentSku(
                context, crossScope, crossSession, crossCode, crossSource.version(), null, "ACC-REF-CROSS-SKU");
        JsonNode crossRead = readItem(context, crossScope, crossSession, crossCode);
        host.insertInventoryBomFixture(
                crossScope.storeId(),
                crossScope.brandId(),
                crossSource.itemRef(),
                UUID.fromString(
                        crossRead.path("skus").get(0).path("productSkuRef").asText()),
                crossCode,
                "ACC-REF-CROSS-SKU",
                List.of(referenceRow(targetRef, null, "5")));

        String basePath = "/api/operations/catalog-inventory/inventory-targets/" + targetRef
                + "/consumption-references?dataNodeRef=" + fixture.storeId() + "&pageSize=1";
        Set<String> observedSources = new LinkedHashSet<>();
        String cursor = "";
        int pages = 0;
        do {
            String path = cursor.isBlank()
                    ? basePath
                    : basePath + "&cursor="
                            + java.net.URLEncoder.encode(cursor, java.nio.charset.StandardCharsets.UTF_8);
            Response page =
                    context.get(OPERATIONS_INVENTORY_CONSUMPTION_REFERENCES, path, session.cookie(), Set.of(200));
            JsonNode data = page.json();
            assertEquals(3, data.path("total").asInt(), "BUSINESS: reference total excludes other scopes and targets");
            assertEquals(1, data.path("entries").size(), "BUSINESS: reference endpoint enforces one-entry pages");
            data.path("entries")
                    .forEach(entry -> assertTrue(
                            observedSources.add(entry.path("sourceCode").asText()),
                            "BUSINESS: cursor pages do not repeat a reference entry"));
            cursor = data.path("cursor").isNull() ? "" : data.path("cursor").asText("");
            pages++;
            assertTrue(pages <= 4, "BUSINESS: reference pagination terminates within the fixture's bounded pages");
        } while (!cursor.isBlank());
        assertEquals(
                Set.of(sourceACode, sourceBCode, sourceCCode),
                observedSources,
                "BUSINESS: current target returns all matching row shapes and no same/cross-scope distractor");
    }

    private Map<String, Object> referenceRow(String targetRef, String componentTargetRef, String quantity) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("nodeType", "SKU");
        row.put("targetRef", targetRef);
        row.put("componentTargetRef", componentTargetRef);
        row.put("quantity", quantity);
        row.put("lineSign", "POSITIVE");
        row.put("status", "ACTIVE");
        return row;
    }

    @AcceptanceScenario(
            id = "inventory-page-and-detail-readback",
            module = "CATALOG",
            operation = "getOperationsInventoryTargets")
    void inventoryPageAndDetailReadback(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String firstCode = "ACC-PAGE-" + suffix + "-A";
        String secondCode = "ACC-PAGE-" + suffix + "-B";
        long firstVersion = createItem(context, fixture, session, firstCode, "inventory page first");
        saveIndependentSku(context, fixture, session, firstCode, firstVersion, null, "ACC-PAGE-SKU-A");
        long secondVersion = createItem(context, fixture, session, secondCode, "inventory page second");
        saveIndependentSku(context, fixture, session, secondCode, secondVersion, null, "ACC-PAGE-SKU-B");
        JsonNode first = readItem(context, fixture, session, firstCode);
        JsonNode second = readItem(context, fixture, session, secondCode);
        String firstTargetRef =
                first.path("inventoryBom").get(0).path("targetRef").asText();
        String secondTargetRef =
                second.path("inventoryBom").get(0).path("targetRef").asText();
        assertTrue(
                firstTargetRef.matches("[0-9a-f-]{36}") && secondTargetRef.matches("[0-9a-f-]{36}"),
                "BUSINESS: fixture creates two typed inventory target identities");

        String pageQuery = "?dataNodeRef=" + fixture.storeId() + "&keyword=ACC-PAGE-" + suffix + "&pageSize=1";
        Response firstPage = context.get(
                OPERATIONS_INVENTORY_TARGETS,
                "/api/operations/catalog-inventory/inventory-targets" + pageQuery,
                session.cookie(),
                Set.of(200));
        JsonNode firstPageData = firstPage.json().path("data");
        assertEquals(
                2, firstPageData.path("total").asInt(), "BUSINESS: inventory page total matches both scoped targets");
        assertEquals(1, firstPageData.path("items").size(), "BUSINESS: inventory page applies the requested page size");
        String cursor = firstPageData.path("cursor").asText("");
        assertFalse(cursor.isBlank(), "BUSINESS: the first inventory page exposes a continuation cursor");

        Response secondPage = context.get(
                OPERATIONS_INVENTORY_TARGETS,
                "/api/operations/catalog-inventory/inventory-targets" + pageQuery + "&cursor=" + cursor,
                session.cookie(),
                Set.of(200));
        JsonNode secondPageData = secondPage.json().path("data");
        assertEquals(2, secondPageData.path("total").asInt(), "BUSINESS: cursor page retains the stable total");
        assertEquals(1, secondPageData.path("items").size(), "BUSINESS: cursor page returns the remaining target");
        assertNotEquals(
                firstPageData.path("items").get(0).path("targetRef").asText(),
                secondPageData.path("items").get(0).path("targetRef").asText(),
                "BUSINESS: cursor paging does not repeat the first target");

        for (String targetRef : List.of(firstTargetRef, secondTargetRef)) {
            Response detail = context.get(
                    OPERATIONS_INVENTORY_TARGET_READ,
                    "/api/operations/catalog-inventory/inventory-targets/" + targetRef + "?dataNodeRef="
                            + fixture.storeId(),
                    session.cookie(),
                    Set.of(200));
            assertEquals(
                    targetRef,
                    detail.json().path("target").path("targetRef").asText(),
                    "BUSINESS: detail readback returns the requested opaque target");
            assertTrue(
                    detail.json().path("changeSummary").isObject()
                            && detail.json().path("recentChanges").isArray(),
                    "BUSINESS: detail contains current-zone facts");
            assertTrue(
                    detail.json().path("references").isMissingNode()
                            && detail.json().path("ledger").isMissingNode(),
                    "BUSINESS: detail does not prefetch lazy reference or ledger zones");
        }
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
        String countingUnitRef = currentJson
                .path("configuration")
                .path("countingUnitSnapshot")
                .path("unitRef")
                .asText("");
        assertFalse(countingUnitRef.isBlank(), "BUSINESS: current target exposes its counting-unit reference");
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
                                "countingUnitRef",
                                countingUnitRef,
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
        String itemCode = "ACC-DICTIONARY-" + suffix;
        long createdVersion = createItem(context, fixture, session, itemCode, "dictionary lifecycle item");
        String unitRef = createAcceptanceUnit(context, fixture, session, "ACC-UNIT-DICTIONARY-" + suffix)
                .path("result")
                .path("unit")
                .path("unitRef")
                .asText();

        Map<String, Object> saveBody = new LinkedHashMap<>(matrixSaveBody(
                fixture,
                itemCode,
                createdVersion,
                attribute,
                preparation,
                referencedValue,
                bitterValue,
                hotValue,
                coldValue,
                unitRef));
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
                "/api/operations/catalog-inventory/dictionaries/SKU_ATTRIBUTE_VALUE/entries/"
                        + referencedValue.path("code").asText() + "/status",
                session.cookie(),
                Map.of(
                        "dictionaryKind",
                        "SKU_ATTRIBUTE_VALUE",
                        "entryCode",
                        referencedValue.path("code").asText(),
                        "expectedVersion",
                        renamedVersion,
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
                blocked.raw().contains(referencedValue.path("code").asText()),
                "BUSINESS: the typed rejection identifies the referenced SKU dictionary value");
        JsonNode afterBlocked = dictionaryEntry(
                context,
                fixture,
                session,
                "SKU_ATTRIBUTE_VALUE",
                referencedValue.path("code").asText());
        assertEquals(
                "ENABLED",
                afterBlocked.path("status").asText(),
                "BUSINESS: rejected void leaves the referenced dictionary lifecycle unchanged");
        assertEquals(
                renamedVersion,
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
        JsonNode material = createInventoryBackedMaterialItem(context, fixture, session, "local-" + suffix);
        JsonNode optionDefinition = createOrderOptionDefinition(
                context,
                fixture,
                session,
                "本地复制选项-" + suffix,
                "SINGLE",
                List.of(Map.of(
                        "name",
                        "本地选项值",
                        "displayOrder",
                        0,
                        "materials",
                        List.of(Map.of(
                                "materialItemRef", material.path("itemRef").asText())))));
        JsonNode optionValue = optionDefinition.path("values").get(0);
        JsonNode optionMaterial = optionValue.path("materials").get(0);
        sourceVersion = saveTypedItemFacts(
                context,
                fixture,
                session,
                sourceCode,
                sourceVersion,
                List.of(),
                List.of(orderOptionConfig(
                        optionDefinition.path("definitionRef").asText(),
                        false,
                        null,
                        null,
                        List.of(optionOverride(
                                optionValue.path("valueRef").asText(),
                                true,
                                null,
                                0L,
                                List.of(Map.of(
                                        "materialRef",
                                        optionMaterial.path("materialRef").asText(),
                                        "actualQuantity",
                                        7)))))));
        JsonNode savedOptionValue = readItem(context, fixture, session, sourceCode)
                .path("orderOptionConfigs")
                .get(0)
                .path("values")
                .get(0);
        assertTrue(
                savedOptionValue.path("defaultValue").asBoolean(),
                "BUSINESS: the owner persists the contract defaultValue field for the selected ordering option");
        assertFalse(
                savedOptionValue.has("default"),
                "CONTRACT: item detail exposes defaultValue rather than a retired default field");
        Map<String, Object> draft = itemDraft(context, fixture, session, sourceCode);
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
        sections.put("inventoryConfiguration", Map.of("nodes", List.of()));
        sections.put("expectedInventoryVersions", List.of());
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
                case "ORDER_OPTIONS" -> {
                    JsonNode copiedConfig = target.path("orderOptionConfigs").get(0);
                    JsonNode copiedValue = copiedConfig.path("values").get(0);
                    JsonNode copiedQuantity =
                            copiedValue.path("materialQuantities").get(0);
                    assertEquals(
                            optionDefinition.path("definitionRef").asText(),
                            copiedConfig.path("definitionRef").asText(),
                            "BUSINESS: local ORDER_OPTIONS copy rewrites the product config to the scope-owned defi"
                                    + "nition ref");
                    assertEquals(
                            optionValue.path("valueRef").asText(),
                            copiedValue.path("definitionValueRef").asText(),
                            "BUSINESS: local ORDER_OPTIONS copy retains the stable library value relation rather th"
                                    + "an a name/code surrogate");
                    assertEquals(
                            optionMaterial.path("materialRef").asText(),
                            copiedQuantity.path("materialRef").asText(),
                            "BUSINESS: local ORDER_OPTIONS copy preserves the definition-material opaque relation");
                    assertEquals(
                            7,
                            copiedQuantity.path("actualQuantity").asInt(),
                            "BUSINESS: local ORDER_OPTIONS copy preserves the option-value BOM quantity, not merely"
                                    + " a nonempty config");
                    assertTrue(
                            copiedValue.path("defaultValue").asBoolean(),
                            "BUSINESS: local ORDER_OPTIONS copy keeps the persisted default selection through owner"
                                    + " readback");
                    assertFalse(
                            copiedValue.has("default"),
                            "CONTRACT: copied item detail still exposes the canonical defaultValue field only");
                }
                case "PACKAGE_STRUCTURE" -> assertFalse(
                        target.path("compositeGroups").isEmpty(),
                        "BUSINESS: PACKAGE_STRUCTURE copies the persisted package relations");
                case "OPTION_VALUE_BOM" -> {
                    JsonNode copiedOptionBom = array(target.path("inventoryBom")).stream()
                            .filter(row -> optionValue
                                    .path("valueRef")
                                    .asText()
                                    .equals(row.path("optionValueRef").asText()))
                            .findFirst()
                            .orElseThrow(() -> new AssertionError(
                                    "BUSINESS: OPTION_VALUE_BOM copies the persisted option-value inventory owner"));
                    assertEquals(
                            target.path("itemRef").asText(),
                            copiedOptionBom.path("itemRef").asText(),
                            "BUSINESS: OPTION_VALUE_BOM belongs to the target product");
                }
                default -> assertTrue(
                        hasSkippedSourceAbsent(result, section),
                        "BUSINESS: an absent owner fact is reported as SKIPPED_SOURCE_ABSENT rather than silently "
                                + "ignored for "
                                + section);
            }
        }

        String closureTargetCode = "ACC-LOCAL-ORDER-BOM-" + suffix;
        long closureTargetVersion =
                createItem(context, fixture, session, closureTargetCode, "target order option BOM closure");
        localCopySections(
                context,
                fixture,
                session,
                sourceCode,
                closureTargetCode,
                sourceVersion,
                closureTargetVersion,
                List.of("ORDER_OPTIONS", "OPTION_VALUE_BOM"));
        JsonNode closureTarget = readItem(context, fixture, session, closureTargetCode);
        JsonNode closureConfig = closureTarget.path("orderOptionConfigs").get(0);
        JsonNode closureValue = closureConfig.path("values").get(0);
        assertEquals(
                optionDefinition.path("definitionRef").asText(),
                closureConfig.path("definitionRef").asText(),
                "BUSINESS: combined local copy keeps the option definition relationship opaque and scope-owned");
        assertEquals(
                optionValue.path("valueRef").asText(),
                closureValue.path("definitionValueRef").asText(),
                "BUSINESS: combined local copy maps the option-value relation without a display-code lookup");
        assertEquals(
                optionMaterial.path("materialRef").asText(),
                closureValue
                        .path("materialQuantities")
                        .get(0)
                        .path("materialRef")
                        .asText(),
                "BUSINESS: combined local copy carries the material-template relation into the target item config");
        JsonNode optionBom = array(closureTarget.path("inventoryBom")).stream()
                .filter(row -> optionValue
                        .path("valueRef")
                        .asText()
                        .equals(row.path("optionValueRef").asText()))
                .findFirst()
                .orElseThrow(() ->
                        new AssertionError("BUSINESS: combined local copy creates the target option-value BOM owner"));
        assertEquals(
                closureTarget.path("itemRef").asText(),
                optionBom.path("itemRef").asText(),
                "BUSINESS: copied option-value BOM belongs to the target product, not the source product");
        assertEquals(
                "OPTION_VALUE_BOM",
                optionBom.path("nodeType").asText(),
                "BUSINESS: an opaque option-value BOM remains classified by its owner ref even when its display cod"
                        + "e is absent");
        assertEquals(
                optionValue.path("code").asText(),
                optionBom.path("optionValueCode").asText(),
                "BUSINESS: copied option-value BOM readback keeps the library value code alongside its opaque ref");
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
        return localCopySections(
                context, fixture, session, sourceCode, targetCode, sourceVersion, targetVersion, List.of(section));
    }

    private JsonNode localCopySections(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String sourceCode,
            String targetCode,
            long sourceVersion,
            long targetVersion,
            List<String> sections)
            throws Exception {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("dataNodeRef", fixture.storeId().toString());
        request.put("sourceItemCode", sourceCode);
        request.put("targetItemCode", targetCode);
        request.put("selectedSections", sections);
        Response preflight = context.post(
                OPERATIONS_CATALOG_LOCAL_COPY_PREFLIGHT,
                "/api/operations/catalog-inventory/copy/local/preflight",
                session.cookie(),
                request,
                Set.of(200));
        String digest = preflight.json().path("data").path("preflightDigest").asText();
        assertFalse(digest.isBlank(), "BUSINESS: local-copy preflight produces a version-bound digest for " + sections);
        List<Map<String, Object>> compatibilityDispositions = new ArrayList<>();
        preflight.json().path("data").path("compatibilityResults").forEach(result -> {
            if (!"BLOCKED".equals(result.path("result").asText())) {
                compatibilityDispositions.add(
                        Map.of("compatibilityId", result.path("compatibilityId").asText(), "disposition", "CONFIRM"));
            }
        });
        assertFalse(
                compatibilityDispositions.isEmpty(),
                "BUSINESS: local-copy preflight exposes a confirmable compatibility fact for " + sections);
        JsonNode versionRow = StreamSupport.stream(
                        preflight.json().path("data").path("objectVersions").spliterator(), false)
                .filter(row -> sourceCode.equals(row.path("code").asText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError(
                        "BUSINESS: local-copy preflight returns the source/target version row for " + sections));
        assertEquals(
                sourceVersion,
                versionRow.path("sourceVersion").asLong(),
                "BUSINESS: local-copy preflight source version matches the fixture readback for " + sections);
        assertEquals(
                targetVersion,
                versionRow.path("targetVersion").asLong(),
                "BUSINESS: local-copy preflight target version matches the fixture readback for " + sections);
        request.put("preflightDigest", digest);
        request.put("expectedSourceVersion", versionRow.path("sourceVersion").asLong());
        request.put("expectedTargetVersion", versionRow.path("targetVersion").asLong());
        request.put("compatibilityDispositions", compatibilityDispositions);
        Response executed = context.post(
                OPERATIONS_CATALOG_LOCAL_COPY_EXECUTE,
                "/api/operations/catalog-inventory/copy/local/execute",
                session.cookie(),
                request,
                Set.of(200));
        return executed.json().path("data");
    }

    private static boolean hasSkippedSourceAbsent(JsonNode result, String section) {
        return StreamSupport.stream(result.path("skipped").spliterator(), false)
                .anyMatch(entry -> section.equals(entry.path("section").asText())
                        && "SKIPPED_SOURCE_ABSENT"
                                .equals(entry.path("reasonCode").asText()));
    }

    private Set<String> collectCursorCodes(
            BackendAcceptanceTest.ScenarioContext context,
            RouteIdentity route,
            String basePath,
            String cookie,
            String arrayField,
            int expectedTotal,
            int pageSize,
            Consumer<JsonNode> pageOracle)
            throws Exception {
        assertTrue(expectedTotal > pageSize, "BUSINESS: cursor fixture exceeds one requested page");
        Set<String> observed = new LinkedHashSet<>();
        Set<String> cursors = new LinkedHashSet<>();
        String cursor = "";
        int pages = 0;
        do {
            String path = cursor.isBlank()
                    ? basePath
                    : basePath
                            + "&cursor="
                            + java.net.URLEncoder.encode(cursor, java.nio.charset.StandardCharsets.UTF_8);
            JsonNode data = context.get(route, path, cookie, Set.of(200)).json().path("data");
            pageOracle.accept(data);
            assertEquals(
                    expectedTotal,
                    data.path("total").asInt(),
                    "BUSINESS: cursor total is the complete filtered set, not the current page length");
            JsonNode rows = data.path(arrayField);
            assertTrue(rows.isArray(), "BUSINESS: cursor response exposes the expected array field " + arrayField);
            assertTrue(rows.size() <= pageSize, "BUSINESS: cursor response never exceeds the requested page size");
            if (pages == 0) {
                assertEquals(pageSize, rows.size(), "BUSINESS: first cursor page is full and proves page traversal");
            }
            rows.forEach(row -> {
                String code = row.path("code").asText();
                assertFalse(code.isBlank(), "BUSINESS: every cursor row has a business code");
                assertTrue(observed.add(code), "BUSINESS: cursor pages do not repeat a business code");
            });
            JsonNode cursorNode = data.get("cursor");
            String nextCursor = cursorNode == null || cursorNode.isNull() ? "" : cursorNode.asText("");
            if (pages == 0) {
                assertFalse(nextCursor.isBlank(), "BUSINESS: first cursor page exposes a second-page cursor");
            }
            if (!nextCursor.isBlank()) {
                assertTrue(cursors.add(nextCursor), "BUSINESS: cursor advances instead of repeating a token");
            }
            cursor = nextCursor;
            pages++;
            assertTrue(pages <= expectedTotal + 1, "BUSINESS: cursor traversal terminates within fixture bounds");
        } while (!cursor.isBlank());
        assertTrue(pages >= 2, "BUSINESS: cursor fixture reached at least a second page");
        assertEquals(expectedTotal, observed.size(), "BUSINESS: cursor traversal has no omissions");
        return observed;
    }

    @AcceptanceScenario(
            id = "catalog.attribute-definition-create-update",
            module = "CATALOG",
            operation = "updateOperationsCatalogAttributeDefinition")
    void attributeDefinitionCreateUpdate(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Map<String, Object> threeMonthOption = Map.of("name", "三个月", "displayOrder", 0);
        Map<String, Object> sixMonthOption = Map.of("name", "六个月", "displayOrder", 1);
        JsonNode created = createAttributeDefinition(
                context,
                fixture,
                session,
                "ACC-EXPIRY-" + suffix,
                "保质期",
                "MULTI_SELECT",
                List.of(threeMonthOption, sixMonthOption));
        String ref = created.path("definitionRef").asText();
        Response updated = context.patch(
                OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION_UPDATE,
                "/api/operations/catalog-inventory/attribute-definitions/" + ref,
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "definitionRef",
                        ref,
                        "expectedVersion",
                        created.path("version").asLong(),
                        "code",
                        "ACC-EXPIRY-RENAMED-" + suffix,
                        "name",
                        "保质期说明",
                        "options",
                        List.of(
                                Map.of(
                                        "optionRef",
                                        created.path("options")
                                                .get(0)
                                                .path("optionRef")
                                                .asText(),
                                        "name",
                                        "三个月",
                                        "displayOrder",
                                        0),
                                Map.of(
                                        "optionRef",
                                        created.path("options")
                                                .get(1)
                                                .path("optionRef")
                                                .asText(),
                                        "name",
                                        "六个月",
                                        "displayOrder",
                                        1))),
                idempotencyHeaders("attribute-update"),
                Set.of(200));
        JsonNode definition = updated.json().path("result").path("definition");
        assertEquals(
                ref,
                definition.path("definitionRef").asText(),
                "BUSINESS: editable attribute code preserves stable references");
        assertEquals(
                "ACC-EXPIRY-RENAMED-" + suffix,
                definition.path("code").asText(),
                "BUSINESS: the changed code is returned from the owner fact");
        assertEquals(
                2,
                definition.path("options").size(),
                "BUSINESS: selection choices remain typed children of the attribute definition");
    }

    @AcceptanceScenario(
            id = "catalog.attribute-definition-delete-cascade",
            module = "CATALOG",
            operation = "deleteOperationsCatalogAttributeDefinition")
    void attributeDefinitionDeleteCascade(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        JsonNode definition = createAttributeDefinition(
                context, fixture, session, "ACC-DELETE-ATTR-" + suffix, "保存说明", "TEXT", List.of());
        String firstCode = "ACC-DELETE-ATTR-A-" + suffix;
        String secondCode = "ACC-DELETE-ATTR-B-" + suffix;
        long firstVersion = createItem(context, fixture, session, firstCode, "attribute cascade one");
        long secondVersion = createItem(context, fixture, session, secondCode, "attribute cascade two");
        Map<String, Object> assignment = Map.of(
                "definitionRef",
                definition.path("definitionRef").asText(),
                "textValue",
                "三个月",
                "optionRefs",
                List.of());
        saveTypedItemFacts(context, fixture, session, firstCode, firstVersion, List.of(assignment), List.of());
        saveTypedItemFacts(context, fixture, session, secondCode, secondVersion, List.of(assignment), List.of());
        Response deleted = context.delete(
                OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION_DELETE,
                "/api/operations/catalog-inventory/attribute-definitions/"
                        + definition.path("definitionRef").asText(),
                session.cookie(),
                Map.of(
                        "dataNodeRef", fixture.storeId().toString(),
                        "definitionRef", definition.path("definitionRef").asText(),
                        "expectedVersion", definition.path("version").asLong()),
                Set.of(200));
        assertEquals(
                2,
                deleted.json().path("result").path("deletedAssignmentCount").asInt(),
                "BUSINESS: delete receipt identifies both removed product assignments");
        assertTrue(
                readItem(context, fixture, session, firstCode)
                        .path("attributeAssignments")
                        .isEmpty(),
                "BUSINESS: deleting a definition removes assignment values but keeps the first product");
        assertTrue(
                readItem(context, fixture, session, secondCode)
                        .path("attributeAssignments")
                        .isEmpty(),
                "BUSINESS: deleting a definition removes assignment values but keeps the second product");
    }

    @AcceptanceScenario(
            id = "catalog.option-selection-mode-and-range",
            module = "CATALOG",
            operation = "saveOperationsCatalogItem")
    void optionSelectionModeAndRange(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        JsonNode definition = createOrderOptionDefinition(
                context,
                fixture,
                session,
                "蘸料-" + suffix,
                "MULTIPLE",
                List.of(
                        Map.of("name", "番茄酱", "displayOrder", 0, "materials", List.of()),
                        Map.of("name", "蛋黄酱", "displayOrder", 1, "materials", List.of())));
        String itemCode = "ACC-RANGE-" + suffix;
        long version = createItem(context, fixture, session, itemCode, "选择数量商品");
        List<JsonNode> values = array(definition.path("values"));
        List<Map<String, Object>> overrides = values.stream()
                .map(value -> optionOverride(value.path("valueRef").asText(), false, null, 0L, List.of()))
                .toList();
        version = saveTypedItemFacts(
                context,
                fixture,
                session,
                itemCode,
                version,
                List.of(),
                List.of(Map.of(
                        "definitionRef",
                        definition.path("definitionRef").asText(),
                        "required",
                        false,
                        "minSelectionCount",
                        0,
                        "maxSelectionCount",
                        1,
                        "values",
                        overrides)));
        JsonNode config = readItem(context, fixture, session, itemCode)
                .path("orderOptionConfigs")
                .get(0);
        assertEquals(
                "MULTIPLE",
                config.path("selectionMode").asText(),
                "BUSINESS: maximum one remains a multiple-choice library mode");
        assertEquals(
                1,
                config.path("maxSelectionCount").asInt(),
                "BUSINESS: product configuration owns the maximum selection count");
        assertTrue(
                version > 0, "BUSINESS: typed selection configuration is persisted through the product owner command");
    }

    @AcceptanceScenario(
            id = "catalog.order-option-definition-create-update",
            module = "CATALOG",
            operation = "createOperationsCatalogOrderOptionDefinition")
    void orderOptionDefinitionCreateUpdate(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        CreatedItem unprepared = createItemWithAttributes(
                context, fixture, session, "ACC-NO-TARGET" + "-" + suffix, "没有库存对象的原料", Map.of());
        Response rejected = context.post(
                OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION_CREATE,
                "/api/operations/catalog-inventory/order-option-definitions",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "code",
                        "ACC-MISSING-TARGET-" + suffix,
                        "name",
                        "缺少库存对象",
                        "selectionMode",
                        "SINGLE",
                        "values",
                        List.of(Map.of(
                                "code",
                                "ACC-MISSING-VALUE-" + suffix,
                                "name",
                                "黑松露酱",
                                "displayOrder",
                                0,
                                "materials",
                                List.of(Map.of(
                                        "materialItemRef", unprepared.itemRef().toString()))))),
                idempotencyHeaders("option-definition-missing-target"),
                Set.of(422));
        assertEquals(
                "INVENTORY_TARGET_REQUIRED_FOR_OPTION_MATERIAL",
                rejected.problemCode(),
                "BUSINESS: library definition, not product configuration, rejects a material without an existing in"
                        + "ventory object");

        JsonNode material = createInventoryBackedMaterialItem(context, fixture, session, suffix);
        JsonNode created = createOrderOptionDefinition(
                context,
                fixture,
                session,
                "蘸料-" + suffix,
                "SINGLE",
                List.of(
                        Map.of("name", "番茄酱", "displayOrder", 0, "materials", List.of()),
                        Map.of(
                                "name",
                                "黑松露酱",
                                "displayOrder",
                                1,
                                "materials",
                                List.of(Map.of(
                                        "materialItemRef",
                                        material.path("itemRef").asText())))));
        String definitionRef = created.path("definitionRef").asText();
        JsonNode blackTruffle = created.path("values").get(1);
        assertTrue(
                blackTruffle
                        .path("materials")
                        .get(0)
                        .path("stockTargetRef")
                        .asText()
                        .matches("[0-9a-f-]{36}"),
                "BUSINESS: successful library readback carries the inventory-resolved material target");
        Response updated = context.patch(
                OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION_UPDATE,
                "/api/operations/catalog-inventory/order-option-definitions/" + definitionRef,
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "definitionRef",
                        definitionRef,
                        "expectedVersion",
                        created.path("version").asLong(),
                        "name",
                        "蘸料说明-" + suffix,
                        "selectionMode",
                        "SINGLE",
                        "values",
                        List.of(
                                Map.of(
                                        "valueRef",
                                        created.path("values")
                                                .get(0)
                                                .path("valueRef")
                                                .asText(),
                                        "code",
                                        created.path("values")
                                                .get(0)
                                                .path("code")
                                                .asText(),
                                        "name",
                                        "番茄酱",
                                        "displayOrder",
                                        0,
                                        "materials",
                                        List.of()),
                                Map.of(
                                        "valueRef",
                                        blackTruffle.path("valueRef").asText(),
                                        "name",
                                        "黑松露酱",
                                        "code",
                                        blackTruffle.path("code").asText(),
                                        "displayOrder",
                                        1,
                                        "materials",
                                        List.of(Map.of(
                                                "materialItemRef",
                                                material.path("itemRef").asText()))))),
                idempotencyHeaders("option-definition-update"),
                Set.of(200));
        assertEquals(
                definitionRef,
                updated.json()
                        .path("result")
                        .path("definition")
                        .path("definitionRef")
                        .asText(),
                "BUSINESS: update preserves the option-group reference used by products");
        assertEquals(
                "SINGLE",
                updated.json()
                        .path("result")
                        .path("definition")
                        .path("selectionMode")
                        .asText(),
                "BUSINESS: definition readback retains the library-controlled choice mode");

        Map<String, Object> changedGroupCode = new LinkedHashMap<>();
        changedGroupCode.put("dataNodeRef", fixture.storeId().toString());
        changedGroupCode.put("definitionRef", definitionRef);
        changedGroupCode.put("expectedVersion", updated.json().path("version").asLong());
        changedGroupCode.put("code", "ACC-RENAMED-GROUP-" + suffix);
        changedGroupCode.put("name", "不允许改编码");
        changedGroupCode.put("selectionMode", "SINGLE");
        changedGroupCode.put(
                "values",
                List.of(
                        Map.of(
                                "valueRef",
                                        created.path("values")
                                                .get(0)
                                                .path("valueRef")
                                                .asText(),
                                "code",
                                        created.path("values")
                                                .get(0)
                                                .path("code")
                                                .asText(),
                                "name", "番茄酱",
                                "displayOrder", 0,
                                "materials", List.of()),
                        Map.of(
                                "valueRef", blackTruffle.path("valueRef").asText(),
                                "code", blackTruffle.path("code").asText(),
                                "name", "黑松露酱",
                                "displayOrder", 1,
                                "materials",
                                        List.of(Map.of(
                                                "materialItemRef",
                                                material.path("itemRef").asText())))));
        Response groupCodeRejected = context.patch(
                OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION_UPDATE,
                "/api/operations/catalog-inventory/order-option-definitions/" + definitionRef,
                session.cookie(),
                changedGroupCode,
                idempotencyHeaders("option-definition-group-code-immutable"),
                Set.of(422));
        assertEquals(
                "VALIDATION_ERROR",
                groupCodeRejected.problemCode(),
                "BUSINESS: group code is immutable after creation, so a changed group code is rejected by the catal"
                        + "og owner");

        Response valueCodeRejected = context.patch(
                OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION_UPDATE,
                "/api/operations/catalog-inventory/order-option-definitions/" + definitionRef,
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "definitionRef",
                        definitionRef,
                        "expectedVersion",
                        updated.json().path("version").asLong(),
                        "name",
                        "不允许改值编码",
                        "selectionMode",
                        "SINGLE",
                        "values",
                        List.of(
                                Map.of(
                                        "valueRef",
                                                created.path("values")
                                                        .get(0)
                                                        .path("valueRef")
                                                        .asText(),
                                        "code",
                                                created.path("values")
                                                        .get(0)
                                                        .path("code")
                                                        .asText(),
                                        "name", "番茄酱",
                                        "displayOrder", 0,
                                        "materials", List.of()),
                                Map.of(
                                        "valueRef",
                                        blackTruffle.path("valueRef").asText(),
                                        "code",
                                        "ACC-RENAMED-VALUE-" + suffix,
                                        "name",
                                        "黑松露酱",
                                        "displayOrder",
                                        1,
                                        "materials",
                                        List.of(Map.of(
                                                "materialItemRef",
                                                material.path("itemRef").asText()))))),
                idempotencyHeaders("option-definition-value-code-immutable"),
                Set.of(422));
        assertEquals(
                "VALIDATION_ERROR",
                valueCodeRejected.problemCode(),
                "BUSINESS: an existing option value cannot change its business code through update");
        Response readAfterRejectedCodes = context.get(
                OPERATIONS_CATALOG_ORDER_OPTION_DEFINITIONS,
                "/api/operations/catalog-inventory/order-option-definitions?dataNodeRef=" + fixture.storeId(),
                session.cookie(),
                Set.of(200));
        JsonNode unchanged = array(readAfterRejectedCodes.json().path("data").path("definitions")).stream()
                .filter(row -> definitionRef.equals(row.path("definitionRef").asText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("BUSINESS: rejected code changes leave the definition readable"));
        assertEquals(
                created.path("code").asText(),
                unchanged.path("code").asText(),
                "BUSINESS: rejected group code change leaves the original business code intact");
        assertEquals(
                blackTruffle.path("code").asText(),
                unchanged.path("values").get(1).path("code").asText(),
                "BUSINESS: rejected value code change leaves the original value code intact");
    }

    @AcceptanceScenario(
            id = "catalog.order-option-definition-delete-cascade",
            module = "CATALOG",
            operation = "deleteOperationsCatalogOrderOptionDefinition")
    void orderOptionDefinitionDeleteCascade(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        JsonNode material = createInventoryBackedMaterialItem(context, fixture, session, "delete-" + suffix);
        JsonNode definition = createOrderOptionDefinition(
                context,
                fixture,
                session,
                "删除级联蘸料-" + suffix,
                "SINGLE",
                List.of(Map.of(
                        "name",
                        "黑松露酱",
                        "displayOrder",
                        0,
                        "materials",
                        List.of(Map.of(
                                "materialItemRef", material.path("itemRef").asText())))));
        String itemCode = "ACC-OPTION-DELETE-" + suffix;
        long itemVersion = createItem(context, fixture, session, itemCode, "选项级联商品");
        JsonNode value = definition.path("values").get(0);
        JsonNode template = value.path("materials").get(0);
        itemVersion = saveTypedItemFacts(
                context,
                fixture,
                session,
                itemCode,
                itemVersion,
                List.of(),
                List.of(orderOptionConfig(
                        definition.path("definitionRef").asText(),
                        true,
                        null,
                        null,
                        List.of(optionOverride(
                                value.path("valueRef").asText(),
                                true,
                                200L,
                                0L,
                                List.of(Map.of(
                                        "materialRef",
                                        template.path("materialRef").asText(),
                                        "actualQuantity",
                                        5)))))));
        Response deleted = context.delete(
                OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION_DELETE,
                "/api/operations/catalog-inventory/order-option-definitions/"
                        + definition.path("definitionRef").asText(),
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "definitionRef",
                        definition.path("definitionRef").asText(),
                        "expectedVersion",
                        definition.path("version").asLong()),
                Set.of(200));
        assertEquals(
                1,
                deleted.json().path("result").path("deletedItemConfigCount").asInt(),
                "BUSINESS: group delete reports the product configuration removed by its cascade");
        assertTrue(
                readItem(context, fixture, session, itemCode)
                        .path("orderOptionConfigs")
                        .isEmpty(),
                "BUSINESS: group deletion removes the product configuration while keeping the product");
        assertEquals(
                material.path("itemRef").asText(),
                readItem(context, fixture, session, "ACC-OPTION-MATERIAL-delete-" + suffix)
                        .path("itemRef")
                        .asText(),
                "BUSINESS: group deletion preserves the material product and its inventory target");
        assertTrue(itemVersion > 0, "BUSINESS: product configuration existed before the definition delete command");
    }

    @AcceptanceScenario(
            id = "catalog.definition-list-limit",
            module = "CATALOG",
            operation = "listOperationsCatalogAttributeDefinitions")
    void definitionListLimit(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        for (int index = 0; index < 501; index++) {
            createAttributeDefinition(
                    context,
                    fixture,
                    session,
                    "ACC-LIMIT-ATTR-" + suffix + "-" + index,
                    "属性上界 " + index,
                    "TEXT",
                    List.of());
        }
        Response rejected = context.get(
                OPERATIONS_CATALOG_ATTRIBUTE_DEFINITIONS,
                "/api/operations/catalog-inventory/attribute-definitions?dataNodeRef=" + fixture.storeId(),
                session.cookie(),
                Set.of(422));
        assertEquals(
                "CATALOG_DEFINITION_LIMIT_EXCEEDED",
                rejected.problemCode(),
                "BUSINESS: the 501st definition rejects the complete library read instead of returning a truncated "
                        + "list");
    }

    @AcceptanceScenario(
            id = "catalog.order-option-definition-list-limit",
            module = "CATALOG",
            operation = "listOperationsCatalogOrderOptionDefinitions")
    void orderOptionDefinitionListLimit(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        for (int index = 0; index < 501; index++) {
            createOrderOptionDefinition(
                    context,
                    fixture,
                    session,
                    "选项上界 " + suffix + "-" + index,
                    "SINGLE",
                    List.of(Map.of("name", "选项值", "displayOrder", 0, "materials", List.of())));
        }
        Response rejected = context.get(
                OPERATIONS_CATALOG_ORDER_OPTION_DEFINITIONS,
                "/api/operations/catalog-inventory/order-option-definitions?dataNodeRef=" + fixture.storeId(),
                session.cookie(),
                Set.of(422));
        assertEquals(
                "CATALOG_DEFINITION_LIMIT_EXCEEDED",
                rejected.problemCode(),
                "BUSINESS: the 501st option definition rejects the complete library read instead of silently trimmi"
                        + "ng it");
    }

    @AcceptanceScenario(
            id = "catalog.order-option-definition-value-delete-cascade",
            module = "CATALOG",
            operation = "updateOperationsCatalogOrderOptionDefinition")
    void orderOptionDefinitionValueDeleteCascade(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        JsonNode definition = createOrderOptionDefinition(
                context,
                fixture,
                session,
                "值删除-" + suffix,
                "SINGLE",
                List.of(
                        Map.of("name", "保留值", "displayOrder", 0, "materials", List.of()),
                        Map.of("name", "删除值", "displayOrder", 1, "materials", List.of())));
        String itemCode = "ACC-VALUE-DIFF-" + suffix;
        long itemVersion = createItem(context, fixture, session, itemCode, "值差集商品");
        JsonNode keep = definition.path("values").get(0);
        JsonNode remove = definition.path("values").get(1);
        saveTypedItemFacts(
                context,
                fixture,
                session,
                itemCode,
                itemVersion,
                List.of(),
                List.of(orderOptionConfig(
                        definition.path("definitionRef").asText(),
                        false,
                        null,
                        null,
                        List.of(
                                optionOverride(keep.path("valueRef").asText(), true, null, 0L, List.of()),
                                optionOverride(remove.path("valueRef").asText(), false, null, 0L, List.of())))));
        Response updated = context.patch(
                OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION_UPDATE,
                "/api/operations/catalog-inventory/order-option-definitions/"
                        + definition.path("definitionRef").asText(),
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "definitionRef",
                        definition.path("definitionRef").asText(),
                        "expectedVersion",
                        definition.path("version").asLong(),
                        "name",
                        definition.path("name").asText(),
                        "selectionMode",
                        "SINGLE",
                        "values",
                        List.of(Map.of(
                                "valueRef",
                                keep.path("valueRef").asText(),
                                "name",
                                "保留值",
                                "code",
                                keep.path("code").asText(),
                                "displayOrder",
                                0,
                                "materials",
                                List.of()))),
                idempotencyHeaders("option-definition-value-delete"),
                Set.of(200));
        assertEquals(
                remove.path("valueRef").asText(),
                updated.json()
                        .path("result")
                        .path("deletedDefinitionValueRefs")
                        .get(0)
                        .asText(),
                "BUSINESS: update readback names the removed library value rather than treating it as a new group");
        JsonNode config = readItem(context, fixture, session, itemCode)
                .path("orderOptionConfigs")
                .get(0);
        assertEquals(
                1,
                config.path("values").size(),
                "BUSINESS: removing one library value cascades only its product override");
        assertEquals(
                keep.path("valueRef").asText(),
                config.path("values").get(0).path("definitionValueRef").asText(),
                "BUSINESS: the sibling library value and product override survive the diff update");
    }

    @AcceptanceScenario(
            id = "catalog.fixed-selection-rejected",
            module = "CATALOG",
            operation = "createOperationsCatalogOrderOptionDefinition")
    void fixedSelectionRejected(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        Response rejected = context.post(
                OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION_CREATE,
                "/api/operations/catalog-inventory/order-option-definitions",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "code",
                        "ACC-FIXED-" + UUID.randomUUID().toString().substring(0, 8),
                        "name",
                        "固定包含",
                        "selectionMode",
                        "FIXED",
                        "values",
                        List.of(Map.of(
                                "code",
                                "ACC-FIXED-VALUE-"
                                        + UUID.randomUUID().toString().substring(0, 8),
                                "name",
                                "不能保存",
                                "displayOrder",
                                0,
                                "materials",
                                List.of()))),
                idempotencyHeaders("fixed-selection"),
                Set.of(422));
        assertEquals(
                "VALIDATION_ERROR",
                rejected.problemCode(),
                "BUSINESS: the retired FIXED selection mode is rejected as typed business input");
    }

    @AcceptanceScenario(
            id = "catalog.item-create-draft-category",
            module = "CATALOG",
            operation = "createOperationsCatalogItem")
    void itemCreateDraftCategory(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Map<String, Object> categoryBody = new LinkedHashMap<>();
        categoryBody.put("dataNodeRef", fixture.storeId().toString());
        categoryBody.put("code", "ACC-CREATE-CAT-" + suffix);
        categoryBody.put("name", "创建分类");
        categoryBody.put("parentCategoryRef", null);
        Response category = context.post(
                OPERATIONS_CATALOG_CATEGORY_CREATE,
                "/api/operations/catalog-inventory/categories",
                session.cookie(),
                categoryBody,
                Set.of(200));
        String categoryRef = category.json().path("result").path("categoryRef").asText();
        String itemCode = "ACC-DRAFT-" + suffix;
        String storeId = fixture.storeId().toString();
        Map<String, Object> draftItem =
                itemCreateBody(storeId, itemCode, "两步创建商品", "STANDARD_SALE_COUNTED", categoryRef);
        Response created = context.post(
                OPERATIONS_CATALOG_ITEM_CREATE,
                "/api/operations/catalog-inventory/items",
                session.cookie(),
                draftItem,
                Set.of(200));
        assertTrue(
                created.json().path("result").path("version").asLong() > 0,
                "BUSINESS: first step atomically creates a versioned draft fact");
        JsonNode item = readItem(context, fixture, session, itemCode);
        assertEquals(
                categoryRef,
                item.path("categoryRef").asText(),
                "BUSINESS: first-step category is already persisted on the draft product");
        assertEquals(
                "DRAFT",
                item.path("lifecycle").path("status").asText(),
                "BUSINESS: first-step create produces a DRAFT rather than a half-created product");
    }

    /**
     * This covers the decided attribute-definition semantic conflict. The equivalent ordering-option-name/code The
     * order-option group/value code rule is a separate create-only immutable contract; this fixture deliberately proves
     * the attribute-definition semantic conflict and does not infer an order-option identity from a display name or
     * UUID.
     */
    @AcceptanceScenario(
            id = "catalog.copy-definition-semantic-conflict",
            module = "CATALOG",
            operation = "executeOperationsBrandCatalogCopy")
    void copyDefinitionSemanticConflict(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BrandCopyFixtures fixtures = host.brandCopyFixtures(Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixtures.source());
        host.completeInvitation(context, fixtures.target());
        Session sourceSession = host.login(context, fixtures.source());
        Session targetSession = host.login(context, fixtures.target());
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String definitionCode = "ACC-COPY-ATTRIBUTE-" + suffix;
        JsonNode sourceDefinition = createAttributeDefinitionAtNode(
                context,
                fixtures.source(),
                sourceSession,
                fixtures.source().headCompanyId().toString(),
                definitionCode,
                "来源属性",
                "SINGLE_SELECT",
                List.of(Map.of("name", "来源选项", "displayOrder", 0)));
        String sourceCode = "ACC-COPY-SOURCE-" + suffix;
        long sourceVersion = createItemWithAttributes(
                        context,
                        fixtures.source(),
                        sourceSession,
                        fixtures.source().headCompanyId().toString(),
                        sourceCode,
                        "属性冲突来源商品",
                        Map.of(),
                        brandHeaders(fixtures.source().brandId(), "copy-source-create"))
                .version();
        saveSourceAttributeAssignment(
                context,
                fixtures.source(),
                sourceSession,
                sourceCode,
                sourceVersion,
                sourceDefinition.path("definitionRef").asText(),
                sourceDefinition.path("options").get(0).path("optionRef").asText());
        String targetDefinitionName = "目标属性";
        createAttributeDefinition(
                context, fixtures.target(), targetSession, definitionCode, targetDefinitionName, "TEXT", List.of());

        Response preflight = context.post(
                OPERATIONS_CATALOG_BRAND_COPY_PREFLIGHT,
                "/api/operations/catalog-inventory/copy/brand/preflight",
                targetSession.cookie(),
                Map.of(
                        "dataNodeRef", fixtures.target().storeId().toString(),
                        "targetDataNodeRef", fixtures.target().storeId().toString(),
                        "selectedItemCodes", List.of(sourceCode)),
                idempotencyHeaders("copy-conflict-preflight"),
                Set.of(200));
        JsonNode conflict = array(preflight.json().path("compatibilityResults")).stream()
                .filter(row -> "CATALOG_ATTRIBUTE_DEFINITION"
                        .equals(row.path("objectType").asText()))
                .filter(row -> ("CATALOG_ATTRIBUTE_DEFINITION:" + definitionCode)
                        .equals(row.path("compatibilityId").asText()))
                .findFirst()
                .orElseThrow(() ->
                        new AssertionError("BUSINESS: preflight locates the same-code attribute definition conflict"));
        assertEquals(
                "BLOCKED",
                conflict.path("result").asText(),
                "BUSINESS: semantic definition mismatch is a hard copy block");
        assertEquals(
                "CATALOG_COPY_DEFINITION_CONFLICT",
                conflict.path("reasonCode").asText(),
                "BUSINESS: preflight exposes a typed, locatable definition conflict");
        assertTrue(
                preflight.json().path("blockingCount").asInt() > 0,
                "BUSINESS: the conflict is counted as blocking rather than confirmable");
        JsonNode selectedVersion = array(preflight.json().path("objectVersions")).stream()
                .filter(row -> "CATALOG_ITEM".equals(row.path("objectType").asText()))
                .filter(row -> sourceCode.equals(row.path("code").asText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError(
                        "BUSINESS: preflight exposes the selected item versions for execute recheck"));
        List<Map<String, Object>> confirmations = array(preflight.json().path("compatibilityResults")).stream()
                .filter(row -> !"BLOCKED".equals(row.path("result").asText()))
                .map(row -> Map.<String, Object>of(
                        "compatibilityId", row.path("compatibilityId").asText(), "disposition", "CONFIRM"))
                .toList();
        Response execution = context.post(
                OPERATIONS_CATALOG_BRAND_COPY_EXECUTE,
                "/api/operations/catalog-inventory/copy/brand/execute",
                targetSession.cookie(),
                Map.of(
                        "dataNodeRef", fixtures.target().storeId().toString(),
                        "targetDataNodeRef", fixtures.target().storeId().toString(),
                        "selectedItemCodes", List.of(sourceCode),
                        "preflightDigest",
                                preflight.json().path("preflightDigest").asText(),
                        "expectedSourceVersion",
                                selectedVersion.path("sourceVersion").asLong(),
                        "expectedTargetVersion",
                                selectedVersion.path("targetVersion").asLong(),
                        "compatibilityDispositions", confirmations),
                idempotencyHeaders("copy-conflict-execute"),
                Set.of(422));
        assertEquals(
                "CATALOG_COPY_DEFINITION_CONFLICT",
                execution.problemCode(),
                "BUSINESS: execute rechecks the blocked semantic conflict and has no confirm path for it");
        context.get(
                OPERATIONS_CATALOG_ITEM_READ,
                itemPath(sourceCode) + "?dataNodeRef=" + fixtures.target().storeId(),
                targetSession.cookie(),
                Set.of(404));
    }

    @AcceptanceScenario(
            id = "catalog.copy-order-option-definition-semantic-conflict",
            module = "CATALOG",
            operation = "executeOperationsBrandCatalogCopy")
    void copyOrderOptionDefinitionSemanticConflict(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BrandCopyFixtures fixtures = host.brandCopyFixtures(Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixtures.source());
        host.completeInvitation(context, fixtures.target());
        Session sourceSession = host.login(context, fixtures.source());
        Session targetSession = host.login(context, fixtures.target());
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String definitionCode = "ACC-COPY-OPTION-" + suffix;
        JsonNode sourceDefinition = createOrderOptionDefinitionAtNode(
                context,
                fixtures.source(),
                sourceSession,
                fixtures.source().headCompanyId().toString(),
                definitionCode,
                "来源蘸料",
                "SINGLE",
                List.of(Map.of(
                        "code",
                        "ACC-COPY-OPTION-VALUE-" + suffix,
                        "name",
                        "来源选项",
                        "displayOrder",
                        0,
                        "materials",
                        List.of())));
        String sourceCode = "ACC-COPY-OPTION-SOURCE-" + suffix;
        long sourceVersion = createItemWithAttributes(
                        context,
                        fixtures.source(),
                        sourceSession,
                        fixtures.source().headCompanyId().toString(),
                        sourceCode,
                        "点单选项冲突来源商品",
                        Map.of(),
                        brandHeaders(fixtures.source().brandId(), "copy-option-source-create"))
                .version();
        saveSourceOrderOptionConfig(
                context,
                fixtures.source(),
                sourceSession,
                sourceCode,
                sourceVersion,
                sourceDefinition.path("definitionRef").asText(),
                sourceDefinition.path("values").get(0).path("valueRef").asText());
        createOrderOptionDefinitionAtNode(
                context,
                fixtures.target(),
                targetSession,
                fixtures.target().storeId().toString(),
                definitionCode,
                "目标蘸料",
                "MULTIPLE",
                List.of(Map.of(
                        "code",
                        "ACC-COPY-OPTION-VALUE-" + suffix,
                        "name",
                        "来源选项",
                        "displayOrder",
                        0,
                        "materials",
                        List.of())));

        Response preflight = context.post(
                OPERATIONS_CATALOG_BRAND_COPY_PREFLIGHT,
                "/api/operations/catalog-inventory/copy/brand/preflight",
                targetSession.cookie(),
                Map.of(
                        "dataNodeRef", fixtures.target().storeId().toString(),
                        "targetDataNodeRef", fixtures.target().storeId().toString(),
                        "selectedItemCodes", List.of(sourceCode)),
                idempotencyHeaders("copy-option-conflict-preflight"),
                Set.of(200));
        JsonNode conflict = array(preflight.json().path("compatibilityResults")).stream()
                .filter(row -> "CATALOG_ORDER_OPTION_DEFINITION"
                        .equals(row.path("objectType").asText()))
                .filter(row -> ("CATALOG_ORDER_OPTION_DEFINITION:" + definitionCode)
                        .equals(row.path("compatibilityId").asText()))
                .findFirst()
                .orElseThrow(
                        () -> new AssertionError("BUSINESS: preflight locates the same-code ordering-option conflict"));
        assertEquals(
                "BLOCKED",
                conflict.path("result").asText(),
                "BUSINESS: same-code ordering-option mode mismatch is not confirmable");
        assertEquals(
                "CATALOG_COPY_DEFINITION_CONFLICT",
                conflict.path("reasonCode").asText(),
                "BUSINESS: ordering-option conflict keeps its typed owner reason");
        assertTrue(
                preflight.json().path("blockingCount").asInt() > 0,
                "BUSINESS: ordering-option conflict increments blockingCount");
        JsonNode selectedVersion = array(preflight.json().path("objectVersions")).stream()
                .filter(row -> sourceCode.equals(row.path("code").asText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError(
                        "BUSINESS: preflight exposes versions for ordering-option conflict recheck"));
        List<Map<String, Object>> confirmations = array(preflight.json().path("compatibilityResults")).stream()
                .filter(row -> !"BLOCKED".equals(row.path("result").asText()))
                .map(row -> Map.<String, Object>of(
                        "compatibilityId", row.path("compatibilityId").asText(), "disposition", "CONFIRM"))
                .toList();
        Response execution = context.post(
                OPERATIONS_CATALOG_BRAND_COPY_EXECUTE,
                "/api/operations/catalog-inventory/copy/brand/execute",
                targetSession.cookie(),
                Map.of(
                        "dataNodeRef", fixtures.target().storeId().toString(),
                        "targetDataNodeRef", fixtures.target().storeId().toString(),
                        "selectedItemCodes", List.of(sourceCode),
                        "preflightDigest",
                                preflight.json().path("preflightDigest").asText(),
                        "expectedSourceVersion",
                                selectedVersion.path("sourceVersion").asLong(),
                        "expectedTargetVersion",
                                selectedVersion.path("targetVersion").asLong(),
                        "compatibilityDispositions", confirmations),
                idempotencyHeaders("copy-option-conflict-execute"),
                Set.of(422));
        assertEquals(
                "CATALOG_COPY_DEFINITION_CONFLICT",
                execution.problemCode(),
                "BUSINESS: execute rechecks the ordering-option block before target writes");
        context.get(
                OPERATIONS_CATALOG_ITEM_READ,
                itemPath(sourceCode) + "?dataNodeRef=" + fixtures.target().storeId(),
                targetSession.cookie(),
                Set.of(404));
    }

    private Map<String, String> idempotencyHeaders(String operation) {
        return Map.of("Idempotency-Key", "acceptance-" + operation + "-" + UUID.randomUUID());
    }

    private static Map<String, Object> optionOverride(
            String definitionValueRef,
            boolean defaultValue,
            Object extraPrice,
            long expectedBomVersion,
            List<Map<String, Object>> materialQuantities) {
        Map<String, Object> override = new LinkedHashMap<>();
        override.put("definitionValueRef", definitionValueRef);
        override.put("defaultValue", defaultValue);
        override.put("extraPrice", extraPrice);
        override.put("expectedBomVersion", expectedBomVersion);
        override.put("materialQuantities", materialQuantities);
        return override;
    }

    private static Map<String, Object> orderOptionConfig(
            String definitionRef,
            boolean required,
            Integer minSelectionCount,
            Integer maxSelectionCount,
            List<Map<String, Object>> values) {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("definitionRef", definitionRef);
        config.put("required", required);
        config.put("minSelectionCount", minSelectionCount);
        config.put("maxSelectionCount", maxSelectionCount);
        config.put("values", values);
        return config;
    }

    private Map<String, Object> itemDraft(
            BackendAcceptanceTest.ScenarioContext context, Fixture fixture, Session session, String itemCode)
            throws Exception {
        return itemDraftAtDataNode(
                context, fixture, session, itemCode, fixture.storeId().toString());
    }

    private Map<String, Object> itemDraftAtDataNode(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            String dataNodeRef)
            throws Exception {
        JsonNode current = readItemAtDataNode(context, fixture, session, itemCode, dataNodeRef);
        Map<String, Object> draft = new LinkedHashMap<>();
        draft.put("name", current.path("name").asText());
        draft.put("shapeKey", current.path("shapeKey").asText());
        draft.put(
                "images",
                array(current.path("images")).stream().map(JsonNode::asText).toList());
        draft.put(
                "productionTagRefs",
                array(current.path("productionTagRefs")).stream()
                        .map(JsonNode::asText)
                        .toList());
        draft.put(
                "categoryRef",
                current.path("categoryRef").isNull()
                        ? null
                        : current.path("categoryRef").asText());
        draft.put(
                "salesUnitRef",
                current.path("salesUnitRef").isNull()
                        ? null
                        : current.path("salesUnitRef").asText());
        draft.put(
                "baseMeasureUnitRef",
                current.path("baseMeasureUnitRef").isNull()
                        ? null
                        : current.path("baseMeasureUnitRef").asText());
        // Save is a complete aggregate command for relational SKU facts as well as the
        // new definitions.  Carry their owner readback forward so a definition edit does
        // not accidentally express SKU retirement in an acceptance fixture.
        draft.put("skus", current.path("skus"));
        draft.put("skuVariantDimensions", current.path("skuVariantDimensions"));
        draft.put("attributeAssignments", current.path("attributeAssignments"));
        draft.put("orderOptionConfigs", orderOptionSaveFacts(current.path("orderOptionConfigs")));
        draft.put("compositeGroups", current.path("compositeGroups"));
        return draft;
    }

    private List<Map<String, Object>> orderOptionSaveFacts(JsonNode configs) {
        List<Map<String, Object>> result = new ArrayList<>();
        if (configs == null || !configs.isArray()) return result;
        for (JsonNode config : configs) {
            Map<String, Object> savedConfig = new LinkedHashMap<>();
            savedConfig.put("definitionRef", config.path("definitionRef").asText());
            savedConfig.put("required", config.path("required").asBoolean());
            savedConfig.put(
                    "minSelectionCount",
                    config.path("minSelectionCount").isNull()
                            ? null
                            : config.path("minSelectionCount").asInt());
            savedConfig.put(
                    "maxSelectionCount",
                    config.path("maxSelectionCount").isNull()
                            ? null
                            : config.path("maxSelectionCount").asInt());
            List<Map<String, Object>> values = new ArrayList<>();
            if (config.path("values").isArray())
                for (JsonNode value : config.path("values")) {
                    Map<String, Object> savedValue = new LinkedHashMap<>();
                    savedValue.put(
                            "definitionValueRef",
                            value.path("definitionValueRef").asText());
                    savedValue.put("defaultValue", value.path("defaultValue").asBoolean());
                    savedValue.put(
                            "extraPrice",
                            value.path("extraPrice").isNull()
                                    ? null
                                    : value.path("extraPrice").asLong());
                    savedValue.put(
                            "expectedBomVersion", value.path("bomVersion").asLong(0));
                    List<Map<String, Object>> quantities = new ArrayList<>();
                    if (value.path("materialQuantities").isArray())
                        for (JsonNode quantity : value.path("materialQuantities")) {
                            Map<String, Object> savedQuantity = new LinkedHashMap<>();
                            savedQuantity.put(
                                    "materialRef", quantity.path("materialRef").asText());
                            savedQuantity.put(
                                    "actualQuantity",
                                    quantity.path("actualQuantity").isNull()
                                            ? null
                                            : quantity.path("actualQuantity").decimalValue());
                            quantities.add(savedQuantity);
                        }
                    savedValue.put("materialQuantities", quantities);
                    values.add(savedValue);
                }
            savedConfig.put("values", values);
            result.add(savedConfig);
        }
        return result;
    }

    private long saveTypedItemFacts(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            long expectedVersion,
            List<Map<String, Object>> assignments,
            List<Map<String, Object>> orderOptionConfigs)
            throws Exception {
        Map<String, Object> draft = itemDraft(context, fixture, session, itemCode);
        draft.put("attributeAssignments", assignments);
        draft.put("orderOptionConfigs", orderOptionConfigs);
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("catalogDraft", draft);
        sections.put("inventoryConfiguration", Map.of("nodes", List.of()));
        sections.put("expectedCatalogVersion", expectedVersion);
        sections.put("expectedInventoryVersions", List.of());
        Response saved = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(itemCode),
                session.cookie(),
                Map.of("dataNodeRef", fixture.storeId().toString(), "itemCode", itemCode, "sections", sections),
                idempotencyHeaders("item-save"),
                Set.of(200));
        long version = saved.json().path("version").asLong();
        assertTrue(version > expectedVersion, "BUSINESS: typed product facts advance the catalog version");
        return version;
    }

    private JsonNode createAttributeDefinition(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String code,
            String name,
            String valueType,
            List<Map<String, Object>> options)
            throws Exception {
        Response response = context.post(
                OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION_CREATE,
                "/api/operations/catalog-inventory/attribute-definitions",
                session.cookie(),
                Map.of(
                        "dataNodeRef", fixture.storeId().toString(),
                        "code", code,
                        "name", name,
                        "valueType", valueType,
                        "options", options),
                idempotencyHeaders("attribute-create"),
                Set.of(200));
        JsonNode definition = response.json().path("result").path("definition");
        assertTrue(
                definition.path("definitionRef").asText().matches("[0-9a-f-]{36}"),
                "BUSINESS: attribute definition create returns a stable opaque definition reference");
        return definition;
    }

    private JsonNode createAttributeDefinitionAtNode(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String dataNodeRef,
            String code,
            String name,
            String valueType,
            List<Map<String, Object>> options)
            throws Exception {
        Response response = context.post(
                OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION_CREATE,
                "/api/operations/catalog-inventory/attribute-definitions",
                session.cookie(),
                Map.of(
                        "dataNodeRef", dataNodeRef,
                        "code", code,
                        "name", name,
                        "valueType", valueType,
                        "options", options),
                brandHeaders(fixture.brandId(), "source-attribute-create"),
                Set.of(200));
        return response.json().path("result").path("definition");
    }

    private Map<String, String> brandHeaders(UUID brandRef, String operation) {
        Map<String, String> headers = new LinkedHashMap<>(idempotencyHeaders(operation));
        headers.put("X-Workspace-Brand-Ref", brandRef.toString());
        return headers;
    }

    private void saveSourceAttributeAssignment(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture source,
            Session session,
            String itemCode,
            long expectedVersion,
            String definitionRef,
            String optionRef)
            throws Exception {
        Map<String, Object> assignment = new LinkedHashMap<>();
        assignment.put("definitionRef", definitionRef);
        assignment.put("textValue", null);
        assignment.put("optionRefs", List.of(optionRef));
        Map<String, Object> draft = itemDraftAtDataNode(
                context, source, session, itemCode, source.headCompanyId().toString());
        draft.put("name", "属性冲突来源商品");
        draft.put("attributeAssignments", List.of(assignment));
        draft.put("orderOptionConfigs", List.of());
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("catalogDraft", draft);
        sections.put("inventoryConfiguration", Map.of("nodes", List.of()));
        sections.put("expectedCatalogVersion", expectedVersion);
        sections.put("expectedInventoryVersions", List.of());
        Response saved = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(itemCode),
                session.cookie(),
                Map.of(
                        "dataNodeRef", source.headCompanyId().toString(),
                        "itemCode", itemCode,
                        "sections", sections),
                brandHeaders(source.brandId(), "source-attribute-save"),
                Set.of(200));
        assertTrue(
                saved.json().path("version").asLong() > expectedVersion,
                "BUSINESS: source product carries the attribute definition through the public save command");
    }

    private void saveSourceOrderOptionConfig(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture source,
            Session session,
            String itemCode,
            long expectedVersion,
            String definitionRef,
            String valueRef)
            throws Exception {
        Map<String, Object> draft = itemDraftAtDataNode(
                context, source, session, itemCode, source.headCompanyId().toString());
        draft.put("name", "点单选项冲突来源商品");
        draft.put("attributeAssignments", List.of());
        draft.put(
                "orderOptionConfigs",
                List.of(orderOptionConfig(
                        definitionRef,
                        false,
                        null,
                        null,
                        List.of(optionOverride(valueRef, false, null, 0L, List.of())))));
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("catalogDraft", draft);
        sections.put("inventoryConfiguration", Map.of("nodes", List.of()));
        sections.put("expectedCatalogVersion", expectedVersion);
        sections.put("expectedInventoryVersions", List.of());
        Response saved = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(itemCode),
                session.cookie(),
                Map.of(
                        "dataNodeRef", source.headCompanyId().toString(),
                        "itemCode", itemCode,
                        "sections", sections),
                brandHeaders(source.brandId(), "copy-option-source-save"),
                Set.of(200));
        assertTrue(
                saved.json().path("version").asLong() > expectedVersion,
                "BUSINESS: source product persists a relation to the ordering-option definition before copy");
    }

    private JsonNode createOrderOptionDefinition(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String name,
            String selectionMode,
            List<Map<String, Object>> values)
            throws Exception {
        String definitionCode =
                "ACC-OPTION-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase(Locale.ROOT);
        List<Map<String, Object>> codedValues = new ArrayList<>();
        for (int index = 0; index < values.size(); index++) {
            Map<String, Object> value = new LinkedHashMap<>(values.get(index));
            value.putIfAbsent(
                    "code",
                    "ACC-OPTION-VALUE-"
                            + UUID.randomUUID().toString().substring(0, 12).toUpperCase(Locale.ROOT) + "-" + index);
            codedValues.add(value);
        }
        Response response = context.post(
                OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION_CREATE,
                "/api/operations/catalog-inventory/order-option-definitions",
                session.cookie(),
                Map.of(
                        "dataNodeRef", fixture.storeId().toString(),
                        "code", definitionCode,
                        "name", name,
                        "selectionMode", selectionMode,
                        "values", codedValues),
                idempotencyHeaders("option-definition-create"),
                Set.of(200));
        JsonNode definition = response.json().path("result").path("definition");
        assertTrue(
                definition.path("definitionRef").asText().matches("[0-9a-f-]{36}"),
                "BUSINESS: ordering option definition create returns a stable opaque definition reference");
        return definition;
    }

    private JsonNode createOrderOptionDefinitionAtNode(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String dataNodeRef,
            String code,
            String name,
            String selectionMode,
            List<Map<String, Object>> values)
            throws Exception {
        Response response = context.post(
                OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION_CREATE,
                "/api/operations/catalog-inventory/order-option-definitions",
                session.cookie(),
                Map.of(
                        "dataNodeRef", dataNodeRef,
                        "code", code,
                        "name", name,
                        "selectionMode", selectionMode,
                        "values", values),
                brandHeaders(fixture.brandId(), "copy-option-definition-create"),
                Set.of(200));
        JsonNode definition = response.json().path("result").path("definition");
        assertEquals(
                code,
                definition.path("code").asText(),
                "BUSINESS: copy fixture creates the exact scope-local ordering-option business code");
        return definition;
    }

    private JsonNode createInventoryBackedMaterialItem(
            BackendAcceptanceTest.ScenarioContext context, Fixture fixture, Session session, String suffix)
            throws Exception {
        String code = "ACC-OPTION-MATERIAL-" + suffix;
        long createdVersion = createItem(context, fixture, session, code, "option material " + suffix);
        saveIndependentSku(context, fixture, session, code, createdVersion, null, "ACC-MATERIAL-SKU-" + suffix);
        JsonNode material = readItem(context, fixture, session, code);
        assertTrue(
                material.path("inventoryBom").isArray()
                        && !material.path("inventoryBom").isEmpty(),
                "BUSINESS: material fixture has an inventory-owned StockTarget before the library command");
        return material;
    }

    private void createProductionTag(
            BackendAcceptanceTest.ScenarioContext context, Fixture fixture, Session session, String code, String name)
            throws Exception {
        Response created = context.post(
                OPERATIONS_PRODUCTION_TAG_CREATE,
                "/api/operations/catalog-inventory/production-tags",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "code",
                        code,
                        "tagKind",
                        "PRODUCTION",
                        "name",
                        name),
                Map.of("Idempotency-Key", "acceptance-production-tag-" + UUID.randomUUID()),
                Set.of(200));
        assertEquals(
                code,
                created.json().path("result").path("code").asText(),
                "BUSINESS: production-tag fixture is created through the real owner command");
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
        createDictionaryEntryWithoutReadback(
                context, fixture, session, fixture.storeId().toString(), kind, code, name, parentEntryRef);
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

    private void createDictionaryEntryWithoutReadback(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String dataNodeRef,
            String kind,
            String code,
            String name,
            String parentEntryRef)
            throws Exception {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("dictionaryKind", kind);
        request.put("code", code);
        request.put("name", name);
        request.put("dataNodeRef", dataNodeRef);
        if (parentEntryRef != null) request.put("parentEntryRef", parentEntryRef);
        context.post(
                OPERATIONS_CATALOG_DICTIONARY_CREATE,
                "/api/operations/catalog-inventory/dictionaries/" + kind + "/entries",
                session.cookie(),
                request,
                Set.of(200));
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
        return createItemWithAttributes(
                context, fixture, session, fixture.storeId().toString(), code, name, attributes);
    }

    private CreatedItem createItemWithAttributes(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String dataNodeRef,
            String code,
            String name,
            Map<String, Object> attributes)
            throws Exception {
        return createItemWithAttributes(context, fixture, session, dataNodeRef, code, name, attributes, Map.of());
    }

    private CreatedItem createItemWithAttributes(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String dataNodeRef,
            String code,
            String name,
            Map<String, Object> attributes,
            Map<String, String> headers)
            throws Exception {
        // The remaining callers retain this fixture helper name while legacy scenarios are
        // migrated.  The current create contract intentionally accepts only the first-step
        // identity/category/shape facts; product attributes belong to the typed save command.
        Response created = context.post(
                OPERATIONS_CATALOG_ITEM_CREATE,
                "/api/operations/catalog-inventory/items",
                session.cookie(),
                itemCreateBody(dataNodeRef, code, name, "STANDARD_SALE_COUNTED", null),
                headers,
                Set.of(200));
        JsonNode result = created.json().path("result");
        long version = result.path("version").asLong();
        String resourceRef = result.path("resourceRef").asText();
        assertTrue(
                version > 0 && !resourceRef.isBlank(),
                "BUSINESS: catalog item creation exposes an opaque, versioned owner fact");
        JsonNode defaultUnit = createAcceptanceUnitAtDataNode(
                context,
                fixture,
                session,
                dataNodeRef,
                "ACC-UNIT-DEFAULT-" + UUID.randomUUID().toString().substring(0, 8),
                "个",
                "COUNT",
                0,
                headers);
        String unitRef = defaultUnit.path("result").path("unit").path("unitRef").asText();
        assertFalse(unitRef.isBlank(), "BUSINESS: standard item fixture obtains a default sales/base unit");
        Map<String, Object> draft = new LinkedHashMap<>();
        draft.put("name", name);
        draft.put("shapeKey", "STANDARD_SALE_COUNTED");
        draft.put("images", List.of());
        draft.put("productionTagRefs", List.of());
        draft.put("categoryRef", null);
        draft.put("salesUnitRef", unitRef);
        draft.put("baseMeasureUnitRef", unitRef);
        draft.put("skus", List.of());
        draft.put("skuVariantDimensions", List.of());
        draft.put("attributeAssignments", List.of());
        draft.put("orderOptionConfigs", List.of());
        draft.put("compositeGroups", List.of());
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("catalogDraft", draft);
        sections.put("inventoryConfiguration", Map.of("nodes", List.of()));
        sections.put("expectedCatalogVersion", version);
        sections.put("expectedInventoryVersions", List.of());
        Response initialized = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(code),
                session.cookie(),
                Map.of("dataNodeRef", dataNodeRef, "itemCode", code, "sections", sections),
                withIdempotency(headers, "default-unit-save-" + code),
                Set.of(200));
        long initializedVersion = initialized.json().path("version").asLong();
        assertTrue(
                initializedVersion > version,
                "BUSINESS: standard item fixture persists default sales/base units before later scenario edits");
        return new CreatedItem(UUID.fromString(resourceRef), initializedVersion);
    }

    private static Map<String, Object> itemCreateBody(
            String dataNodeRef, String code, String name, String shapeKey, String categoryRef) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("dataNodeRef", dataNodeRef);
        body.put("code", code);
        body.put("name", name);
        body.put("categoryRef", categoryRef);
        body.put("shapeKey", shapeKey);
        return body;
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

    private long saveCategoryRef(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            long expectedVersion,
            String categoryRef)
            throws Exception {
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("expectedCatalogVersion", expectedVersion);
        Map<String, Object> draft = itemDraft(context, fixture, session, itemCode);
        draft.put("categoryRef", categoryRef);
        sections.put("catalogDraft", draft);
        sections.put("inventoryConfiguration", Map.of("nodes", List.of()));
        sections.put("expectedInventoryVersions", List.of());
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

    private long saveCatalogTags(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            long expectedVersion,
            List<String> tagRefs)
            throws Exception {
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("expectedCatalogVersion", expectedVersion);
        Map<String, Object> draft = itemDraft(context, fixture, session, itemCode);
        draft.put("tagRefs", tagRefs);
        sections.put("catalogDraft", draft);
        sections.put("inventoryConfiguration", Map.of("nodes", List.of()));
        sections.put("expectedInventoryVersions", List.of());
        Response saved = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(itemCode),
                session.cookie(),
                Map.of("dataNodeRef", fixture.storeId().toString(), "itemCode", itemCode, "sections", sections),
                Set.of(200));
        long version = saved.json().path("version").asLong();
        assertTrue(version > expectedVersion, "BUSINESS: catalog tag relation save advances the item version");
        return version;
    }

    private static JsonNode findByCode(JsonNode rows, String code) {
        return array(rows).stream()
                .filter(row -> code.equals(row.path("code").asText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("BUSINESS: expected catalog tag is present in navigation"));
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
        JsonNode current = skuRef == null ? null : readItem(context, fixture, session, itemCode);
        String unitRef;
        if (current == null) {
            JsonNode unit = createAcceptanceUnit(
                    context,
                    fixture,
                    session,
                    "ACC-UNIT-" + UUID.randomUUID().toString().substring(0, 8));
            unitRef = unit.path("result").path("unit").path("unitRef").asText();
        } else {
            // A SKU-code edit is a relational identity change only. Reuse the already
            // effective base/counting unit so the fixture does not accidentally express
            // the separately guarded base-unit transition.
            unitRef = current.path("baseMeasureUnitRef").asText("");
        }
        assertFalse(unitRef.isBlank(), "BUSINESS: acceptance fixture obtains a catalog unit opaque reference");
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
        inventoryNode.put(
                "configuration", Map.of("allowNegative", false, "countingUnitRef", unitRef, "conversionFactor", "1"));
        if (skuRef != null) inventoryNode.put("productSkuRef", skuRef);
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("expectedCatalogVersion", expectedVersion);
        sections.put("expectedInventoryVersions", List.of());
        Map<String, Object> draft = itemDraft(context, fixture, session, itemCode);
        draft.put("salesUnitRef", unitRef);
        draft.put("baseMeasureUnitRef", unitRef);
        draft.put("skus", List.of(sku));
        sections.put("catalogDraft", draft);
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

    private JsonNode createAcceptanceUnit(
            BackendAcceptanceTest.ScenarioContext context, Fixture fixture, Session session, String code)
            throws Exception {
        return createAcceptanceUnit(context, fixture, session, code, "个", "COUNT", 0);
    }

    private JsonNode createAcceptanceUnit(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String code,
            String name,
            String unitDimension,
            int precision)
            throws Exception {
        return createAcceptanceUnitAtDataNode(
                context,
                fixture,
                session,
                fixture.storeId().toString(),
                code,
                name,
                unitDimension,
                precision,
                Map.of());
    }

    private JsonNode createAcceptanceUnitAtDataNode(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String dataNodeRef,
            String code,
            String name,
            String unitDimension,
            int precision,
            Map<String, String> additionalHeaders)
            throws Exception {
        Response response = context.post(
                OPERATIONS_CATALOG_UNIT_CREATE,
                "/api/operations/catalog-inventory/units",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        dataNodeRef,
                        "code",
                        code,
                        "name",
                        name,
                        "unitDimension",
                        unitDimension,
                        "precision",
                        precision),
                withIdempotency(additionalHeaders, "unit-create-" + code),
                Set.of(200));
        return response.json();
    }

    private Map<String, String> withIdempotency(Map<String, String> headers, String operation) {
        Map<String, String> merged = new LinkedHashMap<>();
        if (headers != null) merged.putAll(headers);
        merged.put("Idempotency-Key", "acceptance-" + operation + "-" + UUID.randomUUID());
        return merged;
    }

    private long saveIndependentSkuWithUnits(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            long expectedVersion,
            String salesUnitRef,
            String baseMeasureUnitRef,
            String countingUnitRef,
            String conversionFactor,
            String skuCode)
            throws Exception {
        Map<String, Object> sku = new LinkedHashMap<>();
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
        Map<String, Object> configuration = new LinkedHashMap<>();
        configuration.put("allowNegative", false);
        configuration.put("countingUnitRef", countingUnitRef);
        configuration.put("conversionFactor", conversionFactor);
        inventoryNode.put("configuration", configuration);
        Map<String, Object> draft = itemDraft(context, fixture, session, itemCode);
        draft.put("salesUnitRef", salesUnitRef);
        draft.put("baseMeasureUnitRef", baseMeasureUnitRef);
        draft.put("skus", List.of(sku));
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("expectedCatalogVersion", expectedVersion);
        sections.put("expectedInventoryVersions", List.of());
        sections.put("catalogDraft", draft);
        sections.put("inventoryConfiguration", Map.of("nodes", List.of(inventoryNode)));
        Response saved = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(itemCode),
                session.cookie(),
                Map.of("dataNodeRef", fixture.storeId().toString(), "itemCode", itemCode, "sections", sections),
                idempotencyHeaders("unitful-item-save-" + itemCode),
                Set.of(200));
        long version = saved.json().path("version").asLong();
        assertTrue(version > expectedVersion, "BUSINESS: unitful SKU fixture advances the catalog version");
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
            JsonNode cold,
            String unitRef) {
        List<Map<String, Object>> axes =
                List.of(axis(size, List.of(small, large)), axis(temperature, List.of(hot, cold)));
        List<Map<String, Object>> skus = new ArrayList<>();
        skus.add(sku("SMALL-HOT", "Small hot", size, small, temperature, hot, true, 0));
        skus.add(sku("SMALL-COLD", "Small cold", size, small, temperature, cold, false, 1));
        skus.add(sku("LARGE-HOT", "Large hot", size, large, temperature, hot, false, 2));
        skus.add(sku("LARGE-COLD", "Large cold", size, large, temperature, cold, false, 3));
        Map<String, Object> draft = new LinkedHashMap<>();
        draft.put("salesUnitRef", unitRef);
        draft.put("baseMeasureUnitRef", unitRef);
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
        return readItemAtDataNode(
                context, fixture, session, itemCode, fixture.storeId().toString());
    }

    private JsonNode readItemAtDataNode(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            String dataNodeRef)
            throws Exception {
        Map<String, String> headers = dataNodeRef.equals(String.valueOf(fixture.headCompanyId()))
                ? Map.of("X-Workspace-Brand-Ref", fixture.brandId().toString())
                : Map.of();
        return context.get(
                        OPERATIONS_CATALOG_ITEM_READ,
                        itemPath(itemCode) + "?dataNodeRef=" + dataNodeRef,
                        session.cookie(),
                        headers,
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
