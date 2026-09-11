package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static org.junit.jupiter.api.Assertions.*;

import com.catering.v2s.contracts.generated.cataloginventory.CatalogInventoryShapeManifest;
import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

/**
 * Catalog business scenarios are intentionally isolated from the shared HTTP/Testcontainers host. This first scenario
 * establishes the real HTTP fixture shape used by the remaining P3-1 catalog cases; it is registered with the catalog
 * acceptance group.
 */
final class CatalogAcceptanceScenarios {
    private final BackendAcceptanceTest host;

    @FunctionalInterface
    private interface DraftCustomizer {
        void accept(Map<String, Object> draft) throws Exception;
    }

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
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION_STATUS =
            new BackendAcceptanceTest.RouteIdentity(
                    "transitionOperationsCatalogAttributeDefinitionStatus",
                    "/api/operations/catalog-inventory/attribute-definitions/{definitionRef}/status");
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
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION_STATUS =
            new BackendAcceptanceTest.RouteIdentity(
                    "transitionOperationsCatalogOrderOptionDefinitionStatus",
                    "/api/operations/catalog-inventory/order-option-definitions/{definitionRef}/status");
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
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_CATEGORY_UPDATE =
            new BackendAcceptanceTest.RouteIdentity(
                    "updateOperationsCatalogCategory", "/api/operations/catalog-inventory/categories/{categoryRef}");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_CATEGORY_MOVE =
            new BackendAcceptanceTest.RouteIdentity(
                    "moveOperationsCatalogCategory", "/api/operations/catalog-inventory/categories/{categoryRef}/move");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_CATEGORY_CANDIDATES =
            new BackendAcceptanceTest.RouteIdentity(
                    "getOperationsCatalogCategoryCandidates", "/api/operations/catalog-inventory/category-candidates");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_ITEM_SKUS =
            new BackendAcceptanceTest.RouteIdentity(
                    "getOperationsCatalogItemSkus", "/api/operations/catalog-inventory/items/{itemCode}/skus");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_UNIT_CREATE =
            new BackendAcceptanceTest.RouteIdentity(
                    "createOperationsCatalogUnit", "/api/operations/catalog-inventory/units");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_UNIT_LIST =
            new BackendAcceptanceTest.RouteIdentity(
                    "listOperationsCatalogUnits", "/api/operations/catalog-inventory/units");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_UNIT_STATUS =
            new BackendAcceptanceTest.RouteIdentity(
                    "transitionOperationsCatalogUnitStatus",
                    "/api/operations/catalog-inventory/units/{unitRef}/status");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_CATALOG_CATEGORY_STATUS =
            new BackendAcceptanceTest.RouteIdentity(
                    "transitionOperationsCatalogCategoryStatus",
                    "/api/operations/catalog-inventory/categories/{categoryRef}/status");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_INVENTORY_TARGET_INCREASE =
            new BackendAcceptanceTest.RouteIdentity(
                    "increaseOperationsInventoryTarget",
                    "/api/operations/catalog-inventory/inventory-targets/{targetRef}/increase");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_INVENTORY_TARGET_ADJUST =
            new BackendAcceptanceTest.RouteIdentity(
                    "adjustOperationsInventoryTarget",
                    "/api/operations/catalog-inventory/inventory-targets/{targetRef}/adjust");
    private static final BackendAcceptanceTest.RouteIdentity OPERATIONS_INVENTORY_TARGET_CONFIGURATION =
            new BackendAcceptanceTest.RouteIdentity(
                    "updateOperationsInventoryTargetConfiguration",
                    "/api/operations/catalog-inventory/inventory-targets/{targetRef}/configuration");

    CatalogAcceptanceScenarios(BackendAcceptanceTest host) {
        this.host = host;
    }

    @AcceptanceScenario(
            id = "catalog.inventory-rule-admission-matrix",
            module = "CATALOG",
            operation = "saveOperationsCatalogItem")
    void inventoryRuleAdmissionMatrix(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        JsonNode component = createInventoryBackedMaterialItem(context, fixture, session, "matrix-component-" + suffix);
        String componentTargetRef = inventoryRuleNodes(component)
                .get(0)
                .path("directConfiguration")
                .path("targetRef")
                .asText();
        assertFalse(componentTargetRef.isBlank(), "BUSINESS: matrix fixture has a real component StockTarget");

        List<String> shapes = List.of(
                "STANDARD_SALE_COUNTED",
                "STANDARD_SALE_WEIGHED",
                "SKU_VARIANT_SALE_COUNTED",
                "MATERIAL",
                "COMPOSITE",
                "SERVICE",
                "BENEFIT_SHELL");
        List<String> ownerTypes = List.of("ITEM", "SKU", "OPTION_VALUE");
        List<String> modes = List.of("NONE", "DIRECT", "BOM");
        int executed = 0;
        for (String shape : shapes) {
            for (String ownerType : ownerTypes) {
                for (String mode : modes) {
                    executed++;
                    String code = "ACC-MATRIX-" + suffix + "-" + executed;
                    if ("BENEFIT_SHELL".equals(shape)) {
                        Response rejectedShape = context.post(
                                OPERATIONS_CATALOG_ITEM_CREATE,
                                "/api/operations/catalog-inventory/items",
                                session.cookie(),
                                itemCreateBody(
                                        fixture.storeId().toString(),
                                        code,
                                        "admission " + shape + " " + ownerType + " " + mode,
                                        shape,
                                        null),
                                Set.of(422));
                        assertEquals(
                                "VALIDATION_ERROR",
                                rejectedShape.problemCode(),
                                "BUSINESS: disabled BENEFIT_SHELL is rejected before inventory owner admission");
                        continue;
                    }
                    CreatedItem created = createItemWithShape(
                            context,
                            fixture,
                            session,
                            fixture.storeId().toString(),
                            code,
                            "admission " + shape + " " + ownerType + " " + mode,
                            Map.of(),
                            Map.of(),
                            shape);
                    String optionValueRef = null;
                    String optionValueCode = null;
                    long currentVersion = created.version();
                    if (("STANDARD_SALE_COUNTED".equals(shape) || "STANDARD_SALE_WEIGHED".equals(shape))
                            && "OPTION_VALUE".equals(ownerType)) {
                        Map<String, Object> optionValue = new LinkedHashMap<>();
                        optionValue.put("name", "矩阵选项");
                        optionValue.put("displayOrder", 0);
                        optionValue.put(
                                "materials",
                                List.of(Map.of(
                                        "materialItemRef",
                                        component.path("itemRef").asText())));
                        JsonNode definition = createOrderOptionDefinition(
                                context, fixture, session, "矩阵选项-" + executed, "SINGLE", List.of(optionValue));
                        currentVersion = saveTypedItemFacts(
                                context,
                                fixture,
                                session,
                                code,
                                currentVersion,
                                List.of(),
                                List.of(orderOptionConfig(
                                        definition.path("definitionRef").asText(),
                                        false,
                                        null,
                                        null,
                                        List.of(optionOverride(
                                                definition
                                                        .path("values")
                                                        .get(0)
                                                        .path("valueRef")
                                                        .asText(),
                                                false,
                                                null,
                                                0L,
                                                List.of())))));
                        JsonNode configured = readItem(context, fixture, session, code);
                        JsonNode value = configured
                                .path("orderOptionConfigs")
                                .get(0)
                                .path("values")
                                .get(0);
                        optionValueRef = value.path("definitionValueRef").asText();
                        optionValueCode = value.path("valueCode")
                                .asText(value.path("name").asText());
                    }

                    boolean allowed = admissionCaseAllowed(shape, ownerType, mode);
                    JsonNode current = readItem(context, fixture, session, code);
                    Map<String, Object> consumptionUnitSnapshot =
                            allowed && "DIRECT".equals(mode) ? unitSnapshotFromItem(current) : null;
                    Map<String, Object> rule;
                    if ("SKU".equals(ownerType)) {
                        String skuCode = "MATRIX-SKU-" + executed;
                        if (allowed) {
                            JsonNode saved = saveSkuVariantMode(
                                    context, fixture, session, code, currentVersion, skuCode, mode, componentTargetRef);
                            assertEquals(
                                    mode,
                                    inventoryRuleForSku(saved, inventoryRuleForSkuRef(saved, skuCode))
                                            .path("mode")
                                            .asText(),
                                    "BUSINESS: legal SKU owner persists the requested mode");
                            continue;
                        }
                        rule = inventoryRuleForMode(
                                ownerType,
                                UUID.randomUUID().toString(),
                                null,
                                code,
                                skuCode,
                                mode,
                                consumptionUnitSnapshot,
                                componentTargetRef,
                                null,
                                null);
                    } else if ("OPTION_VALUE".equals(ownerType)) {
                        rule = inventoryRuleForMode(
                                ownerType,
                                readItem(context, fixture, session, code)
                                        .path("itemRef")
                                        .asText(),
                                optionValueRef == null ? UUID.randomUUID().toString() : optionValueRef,
                                code,
                                optionValueCode,
                                mode,
                                consumptionUnitSnapshot,
                                componentTargetRef,
                                null,
                                null);
                    } else {
                        rule = inventoryRuleForMode(
                                ownerType,
                                current.path("itemRef").asText(),
                                null,
                                code,
                                null,
                                mode,
                                consumptionUnitSnapshot,
                                componentTargetRef,
                                null,
                                null);
                    }

                    JsonNode before = current;
                    Response response = saveInventoryNodes(
                            context,
                            fixture,
                            session,
                            code,
                            before.path("version").asLong(),
                            List.of(rule),
                            allowed ? Set.of(200) : Set.of(409, 422));
                    if (allowed) {
                        assertEquals(
                                200,
                                response.status(),
                                "BUSINESS: legal matrix case saves through whole catalog command");
                        JsonNode after = readItem(context, fixture, session, code);
                        JsonNode owner = findInventoryOwner(
                                after, ownerType, after.path("itemRef").asText(), optionValueRef, null);
                        assertEquals(mode, owner.path("mode").asText(), "BUSINESS: legal matrix mode is read back");
                    } else {
                        assertTrue(
                                Set.of("REFERENCE_MAPPING_UNRESOLVED", "INVENTORY_DEDUCTION_MODE_NOT_ALLOWED")
                                        .contains(response.problemCode()),
                                "BUSINESS: illegal matrix request is rejected by an owner typed problem");
                        JsonNode after = readItem(context, fixture, session, code);
                        assertEquals(
                                before.path("version").asLong(),
                                after.path("version").asLong(),
                                "BUSINESS: illegal matrix request leaves catalog version unchanged");
                    }
                }
            }
        }
        assertEquals(63, executed, "BUSINESS: admission matrix executes all 7x3x3 cases");

        // Sentinel case after the 7x3x3 matrix: BOM is an admitted mode for a
        // standard item, but an empty active line set is not a configured BOM.
        String emptyBomCode = "ACC-MATRIX-" + suffix + "-EMPTY-BOM";
        CreatedItem emptyBomItem = createItemWithShape(
                context,
                fixture,
                session,
                fixture.storeId().toString(),
                emptyBomCode,
                "admission empty BOM",
                Map.of(),
                Map.of(),
                "STANDARD_SALE_COUNTED");
        JsonNode emptyBomBefore = readItem(context, fixture, session, emptyBomCode);
        Map<String, Object> emptyBomRule = bomInventoryRule(
                "ITEM", emptyBomBefore.path("itemRef").asText(), null, emptyBomCode, null, null, List.of());
        Response emptyBomResponse = saveInventoryNodes(
                context, fixture, session, emptyBomCode, emptyBomItem.version(), List.of(emptyBomRule), Set.of(422));
        assertEquals(
                "INVENTORY_BOM_EMPTY",
                emptyBomResponse.problemCode(),
                "BUSINESS: the admission matrix sentinel rejects BOM with zero active lines");
        JsonNode emptyBomAfter = readItem(context, fixture, session, emptyBomCode);
        assertEquals(
                emptyBomBefore.path("version").asLong(),
                emptyBomAfter.path("version").asLong(),
                "BUSINESS: empty BOM rejection leaves catalog version unchanged");

        String cipgUnitRef = sharedAcceptanceUnitRef(context, fixture, session, suffix);
        runItemIdentifiersAndDefaultPreparation(context, fixture, session, suffix, cipgUnitRef);
        runIdentificationPreparationAdmissionMatrix(context, fixture, session, suffix, cipgUnitRef);
    }

    private String sharedAcceptanceUnitRef(
            BackendAcceptanceTest.ScenarioContext context, Fixture fixture, Session session, String suffix)
            throws Exception {
        // spotless:off
        JsonNode created = createAcceptanceUnit(
                context,
                fixture,
                session,
                "ACC-CIPG-UNIT-" + suffix,
                "个",
                "COUNT",
                0);
        // spotless:on
        String unitRef = created.path("result").path("unit").path("unitRef").asText();
        assertFalse(unitRef.isBlank(), "BUSINESS: CIPG acceptance fixture has one shared catalog unit");
        return unitRef;
    }

    private void runItemIdentifiersAndDefaultPreparation(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String suffix,
            String unitRef)
            throws Exception {
        String tagRef = createProductionTag(context, fixture, session, "ACC-CIPG-PRODUCTION-TAG-" + suffix, "热厨");
        CreatedItem ordinary = createItemWithShape(
                context,
                fixture,
                session,
                fixture.storeId().toString(),
                "ACC-CIPG-ORDINARY-" + suffix,
                "条码与制作信息商品",
                Map.of(),
                Map.of(),
                "STANDARD_SALE_COUNTED",
                unitRef);
        Map<String, Object> ordinaryProfile = preparationProfile("热厨制作", 100000L, "按默认流程制作");
        Response ordinarySaved = saveCatalogDraft(
                context,
                fixture,
                session,
                "ACC-CIPG-ORDINARY-" + suffix,
                draft -> {
                    draft.put(
                            "identifiers",
                            List.of(
                                    identifierFact("BARCODE", "000123"),
                                    identifierFact("MNEMONIC", "Kitchen Default")));
                    draft.put("productionTagRef", tagRef);
                    draft.put("preparationProfile", ordinaryProfile);
                },
                Set.of(200));
        assertTrue(
                ordinarySaved.json().path("version").asLong() > ordinary.version(),
                "BUSINESS: item identifier and default preparation whole-save advances version");
        JsonNode ordinaryRead = readItem(context, fixture, session, "ACC-CIPG-ORDINARY-" + suffix);
        assertIdentifier(
                ordinaryRead,
                "CATALOG_ITEM",
                "BARCODE",
                "000123",
                "000123",
                "BUSINESS: ordinary item preserves a leading-zero barcode");
        assertIdentifier(
                ordinaryRead,
                "CATALOG_ITEM",
                "MNEMONIC",
                "Kitchen Default",
                "kitchen default",
                "BUSINESS: mnemonic readback preserves display value and derives case-insensitive normalization");
        assertEquals(
                "热厨制作",
                ordinaryRead
                        .path("preparationProfile")
                        .path("productionDisplayName")
                        .asText(),
                "BUSINESS: item default preparation display name is read back");
        assertEquals(
                100000,
                ordinaryRead
                        .path("preparationProfile")
                        .path("estimatedPreparationSeconds")
                        .asInt(),
                "BUSINESS: preparation accepts a non-negative integer well above one day");
        assertEquals(
                tagRef,
                ordinaryRead.path("productionTagRef").asText(),
                "BUSINESS: item owns one production tag independently of preparation profile");
        JsonNode ordinaryBeforeDuplicate = ordinaryRead.deepCopy();
        Response duplicateMnemonic = saveCatalogDraft(
                context,
                fixture,
                session,
                "ACC-CIPG-ORDINARY-" + suffix,
                draft -> draft.put(
                        "identifiers",
                        List.of(
                                identifierFact("BARCODE", "000123"),
                                identifierFact("MNEMONIC", "Kitchen Default"),
                                identifierFact("MNEMONIC", "KITCHEN DEFAULT"))),
                Set.of(422));
        assertEquals(
                "CATALOG_IDENTIFIER_DUPLICATE",
                duplicateMnemonic.problemCode(),
                "BUSINESS: duplicate normalized mnemonic is rejected by the owner");
        JsonNode ordinaryAfterDuplicate = readItem(context, fixture, session, "ACC-CIPG-ORDINARY-" + suffix);
        assertEquals(
                ordinaryBeforeDuplicate.path("version").asLong(),
                ordinaryAfterDuplicate.path("version").asLong(),
                "BUSINESS: duplicate identifier rejection leaves item version unchanged");
        assertEquals(
                ordinaryBeforeDuplicate.path("identifiers"),
                ordinaryAfterDuplicate.path("identifiers"),
                "BUSINESS: duplicate identifier rejection leaves prior identifier facts unchanged");

        CreatedItem weighed = createItemWithShape(
                context,
                fixture,
                session,
                fixture.storeId().toString(),
                "ACC-CIPG-WEIGHED-" + suffix,
                "称重识别商品",
                Map.of(),
                Map.of(),
                "STANDARD_SALE_WEIGHED",
                unitRef);
        Response weighedSaved = saveCatalogDraft(
                context,
                fixture,
                session,
                "ACC-CIPG-WEIGHED-" + suffix,
                draft -> draft.put("identifiers", List.of(identifierFact("PLU", "00123"))),
                Set.of(200));
        assertTrue(
                weighedSaved.json().path("version").asLong() > weighed.version(),
                "BUSINESS: weighed item accepts a PLU through the whole-save owner command");
        assertIdentifier(
                readItem(context, fixture, session, "ACC-CIPG-WEIGHED-" + suffix),
                "CATALOG_ITEM",
                "PLU",
                "00123",
                "00123",
                "BUSINESS: weighed item reads back the PLU unchanged");

        String serviceCode = "ACC-CIPG-SERVICE-" + suffix;
        createItemWithShape(
                context,
                fixture,
                session,
                fixture.storeId().toString(),
                serviceCode,
                "服务识别商品",
                Map.of(),
                Map.of(),
                "SERVICE",
                unitRef);
        Response serviceSaved = saveCatalogDraft(
                context,
                fixture,
                session,
                serviceCode,
                draft -> draft.put("identifiers", List.of(identifierFact("MNEMONIC", "Service Code"))),
                Set.of(200));
        assertEquals(200, serviceSaved.status(), "BUSINESS: service item accepts a mnemonic");
        JsonNode serviceBeforeRejectedTypes = readItem(context, fixture, session, serviceCode);
        for (String rejectedType : List.of("BARCODE", "PLU")) {
            Response serviceRejected = saveCatalogDraft(
                    context,
                    fixture,
                    session,
                    serviceCode,
                    draft -> draft.put("identifiers", List.of(identifierFact(rejectedType, "SERVICE-" + rejectedType))),
                    Set.of(422));
            assertEquals(
                    "CATALOG_IDENTIFIER_TYPE_NOT_ALLOWED",
                    serviceRejected.problemCode(),
                    "BUSINESS: service item rejects " + rejectedType + " at owner admission");
            JsonNode serviceAfterRejected = readItem(context, fixture, session, serviceCode);
            assertEquals(
                    serviceBeforeRejectedTypes.path("version").asLong(),
                    serviceAfterRejected.path("version").asLong(),
                    "BUSINESS: service " + rejectedType + " rejection leaves version unchanged");
        }
    }

    private void runIdentificationPreparationAdmissionMatrix(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String suffix,
            String unitRef)
            throws Exception {
        List<String> shapes = List.of(
                "STANDARD_SALE_COUNTED",
                "SKU_VARIANT_SALE_COUNTED",
                "STANDARD_SALE_WEIGHED",
                "MATERIAL",
                "COMPOSITE",
                "SERVICE",
                "BENEFIT_SHELL");
        List<String> grains = List.of("CATALOG_ITEM", "SKU");
        List<String> types = List.of("BARCODE", "PLU", "MNEMONIC");
        int identifierCells = 0;
        for (String shape : shapes) {
            for (String grain : grains) {
                for (String type : types) {
                    identifierCells++;
                    String cell = shape + ":" + grain + ":" + type;
                    if ("BENEFIT_SHELL".equals(shape)) {
                        Response rejectedShape = context.post(
                                OPERATIONS_CATALOG_ITEM_CREATE,
                                "/api/operations/catalog-inventory/items",
                                session.cookie(),
                                itemCreateBody(
                                        fixture.storeId().toString(),
                                        "ACC-CIPG-BENEFIT-" + suffix + "-" + identifierCells,
                                        "权益商品准入 " + cell,
                                        shape,
                                        null),
                                Set.of(422));
                        assertEquals(
                                "VALIDATION_ERROR",
                                rejectedShape.problemCode(),
                                "BUSINESS: disabled benefit shell is rejected before a save can create a target");
                        continue;
                    }
                    String code = "ACC-CIPG-ID-" + suffix + "-" + identifierCells;
                    createItemWithShape(
                            context,
                            fixture,
                            session,
                            fixture.storeId().toString(),
                            code,
                            "识别准入 " + cell,
                            Map.of(),
                            Map.of(),
                            shape,
                            unitRef);
                    JsonNode before = readItem(context, fixture, session, code);
                    int cellNumber = identifierCells;
                    String value = "CIPG-" + suffix + "-" + cellNumber;
                    Response saved = saveCatalogDraft(
                            context,
                            fixture,
                            session,
                            code,
                            draft -> {
                                if ("CATALOG_ITEM".equals(grain)) {
                                    draft.put("identifiers", List.of(identifierFact(type, value)));
                                } else {
                                    Map<String, Object> sku = acceptanceSkuFact(
                                            before,
                                            "CIPG-SKU-" + cellNumber,
                                            List.of(identifierFact(type, value)),
                                            inheritPreparationOverride());
                                    draft.put("skus", List.of(sku));
                                }
                            },
                            Set.of(200, 422));
                    boolean allowed = identifierAdmissionAllowed(shape, grain, type);
                    if (allowed) {
                        assertEquals(200, saved.status(), "BUSINESS: admitted identifier cell saves " + cell);
                        assertIdentifier(
                                readItem(context, fixture, session, code),
                                grain,
                                type,
                                value,
                                "MNEMONIC".equals(type) ? value.toLowerCase(Locale.ROOT) : value,
                                "BUSINESS: admitted identifier cell reads back its derived owner " + cell);
                    } else {
                        assertEquals(
                                "CATALOG_IDENTIFIER_TYPE_NOT_ALLOWED",
                                saved.problemCode(),
                                "BUSINESS: rejected identifier cell returns typed owner problem " + cell);
                        JsonNode after = readItem(context, fixture, session, code);
                        assertEquals(
                                before.path("version").asLong(),
                                after.path("version").asLong(),
                                "BUSINESS: rejected identifier cell leaves version unchanged " + cell);
                        assertEquals(
                                before.path("identifiers"),
                                after.path("identifiers"),
                                "BUSINESS: rejected identifier cell leaves item identifiers unchanged " + cell);
                    }
                }
            }
        }
        assertEquals(42, identifierCells, "BUSINESS: identifier admission executes all 7x2x3 cells");

        String tagRef = createProductionTag(context, fixture, session, "ACC-CIPG-PREP-TAG-" + suffix, "冷菜");
        int preparationCells = 0;
        for (String shape : shapes) {
            for (String targetKind : List.of("ITEM", "SKU", "OPTION_VALUE")) {
                preparationCells++;
                String cell = shape + ":" + targetKind;
                if ("BENEFIT_SHELL".equals(shape)) {
                    Response rejectedShape = context.post(
                            OPERATIONS_CATALOG_ITEM_CREATE,
                            "/api/operations/catalog-inventory/items",
                            session.cookie(),
                            itemCreateBody(
                                    fixture.storeId().toString(),
                                    "ACC-CIPG-BENEFIT-PREP-" + suffix + "-" + preparationCells,
                                    "权益制作准入 " + cell,
                                    shape,
                                    null),
                            Set.of(422));
                    assertEquals(
                            "VALIDATION_ERROR",
                            rejectedShape.problemCode(),
                            "BUSINESS: benefit shell preparation target has no creatable owner");
                    continue;
                }
                String code = "ACC-CIPG-PREP-" + suffix + "-" + preparationCells;
                createItemWithShape(
                        context,
                        fixture,
                        session,
                        fixture.storeId().toString(),
                        code,
                        "制作准入 " + cell,
                        Map.of(),
                        Map.of(),
                        shape,
                        unitRef);
                JsonNode before = readItem(context, fixture, session, code);
                int cellNumber = preparationCells;
                Response saved = saveCatalogDraft(
                        context,
                        fixture,
                        session,
                        code,
                        draft -> applyPreparationTarget(
                                context, fixture, session, draft, before, targetKind, tagRef, suffix, cellNumber),
                        Set.of(200, 422));
                boolean allowed = preparationAdmissionAllowed(shape, targetKind);
                if (allowed) {
                    assertEquals(200, saved.status(), "BUSINESS: admitted preparation target saves " + cell);
                    JsonNode after = readItem(context, fixture, session, code);
                    if ("ITEM".equals(targetKind)) {
                        assertEquals(
                                "CIPG default " + cell,
                                after.path("preparationProfile")
                                        .path("productionDisplayName")
                                        .asText(),
                                "BUSINESS: item preparation target reads back the typed profile " + cell);
                    } else {
                        assertTrue(
                                StreamSupport.stream(
                                                        after.path("orderOptionConfigs")
                                                                .spliterator(),
                                                        false)
                                                .flatMap(config -> StreamSupport.stream(
                                                        config.path("values").spliterator(), false))
                                                .anyMatch(value -> value.path("preparationEffect")
                                                        .isObject())
                                        || StreamSupport.stream(
                                                        after.path("skus").spliterator(), false)
                                                .anyMatch(sku -> "SKU_OVERRIDE"
                                                        .equals(sku.path("preparationSource")
                                                                .asText())),
                                "BUSINESS: admitted preparation target reads back its concrete target " + cell);
                    }
                } else {
                    assertEquals(
                            "CATALOG_PREPARATION_NOT_ALLOWED",
                            saved.problemCode(),
                            "BUSINESS: rejected preparation target returns typed owner problem " + cell);
                    JsonNode after = readItem(context, fixture, session, code);
                    assertEquals(
                            before.path("version").asLong(),
                            after.path("version").asLong(),
                            "BUSINESS: rejected preparation target leaves version unchanged " + cell);
                }
            }
        }
        assertEquals(21, preparationCells, "BUSINESS: preparation admission executes all 7x3 cells");
    }

    private void applyPreparationTarget(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            Map<String, Object> draft,
            JsonNode current,
            String targetKind,
            String tagRef,
            String suffix,
            int cell)
            throws Exception {
        if ("ITEM".equals(targetKind)) {
            draft.put(
                    "preparationProfile",
                    preparationProfile(
                            "CIPG default " + current.path("shapeKey").asText() + ":ITEM", 5L, "默认制作说明"));
            draft.put("productionTagRef", tagRef);
            return;
        }
        if ("SKU".equals(targetKind)) {
            Map<String, Object> sku = acceptanceSkuFact(
                    current,
                    "CIPG-PREP-SKU-" + suffix + "-" + cell,
                    List.of(),
                    Map.of(
                            "mode",
                            "OVERRIDE",
                            "profile",
                            preparationProfile(
                                    "CIPG default " + ""
                                            + current.path("shapeKey").asText() + ":SKU",
                                    7L,
                                    "规格制作说明")));
            draft.put("skus", List.of(sku));
            return;
        }
        JsonNode definition = createOrderOptionDefinition(
                context,
                fixture,
                session,
                "制作变化选项 " + cell,
                "SINGLE",
                List.of(Map.of("name", "增加冷菜处理", "displayOrder", 1, "materials", List.of())));
        JsonNode value = definition.path("values").get(0);
        Map<String, Object> effect = new LinkedHashMap<>();
        effect.put("instruction", "最后加冷菜处理");
        effect.put("preparationSecondsDelta", 3);
        Map<String, Object> option = optionOverride(value.path("valueRef").asText(), false, null, 0L, List.of());
        option.put("preparationEffect", effect);
        draft.put(
                "orderOptionConfigs",
                List.of(orderOptionConfig(
                        definition.path("definitionRef").asText(), false, null, null, List.of(option))));
    }

    private Response saveCatalogDraft(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            DraftCustomizer draftCustomizer,
            Set<Integer> expectedStatuses)
            throws Exception {
        Map<String, Object> draft = itemDraft(context, fixture, session, itemCode);
        draftCustomizer.accept(draft);
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put(
                "expectedCatalogVersion",
                readItem(context, fixture, session, itemCode).path("version").asLong());
        sections.put("catalogDraft", draft);
        sections.put("inventoryRules", Map.of("nodes", List.of()));
        return context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(itemCode),
                session.cookie(),
                Map.of("dataNodeRef", fixture.storeId().toString(), "itemCode", itemCode, "sections", sections),
                idempotencyHeaders("cipg-save-" + itemCode),
                expectedStatuses);
    }

    private static Map<String, Object> identifierFact(String type, String value) {
        return Map.of("identifierType", type, "identifierValue", value);
    }

    private static Map<String, Object> preparationProfile(String displayName, long seconds, String notes) {
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("productionDisplayName", displayName);
        profile.put("estimatedPreparationSeconds", seconds);
        profile.put("preparationNotes", notes);
        return profile;
    }

    private static Map<String, Object> acceptanceSkuFact(
            JsonNode current,
            String skuCode,
            List<Map<String, Object>> identifiers,
            Map<String, Object> preparationOverride) {
        Map<String, Object> sku = new LinkedHashMap<>();
        sku.put("productSkuRef", null);
        sku.put("skuCode", skuCode);
        sku.put("skuName", skuCode);
        sku.put("displayOrder", 0);
        sku.put("attributeValueRefs", List.of());
        sku.put("standardSalePrice", null);
        sku.put("isDefault", true);
        sku.put("status", "ENABLED");
        sku.put("mediaRefs", List.of());
        sku.put(
                "salesUnitOverrideRef",
                current.path("salesUnitRef").isNull()
                        ? null
                        : current.path("salesUnitRef").asText());
        sku.put(
                "baseMeasureUnitOverrideRef",
                current.path("baseMeasureUnitRef").isNull()
                        ? null
                        : current.path("baseMeasureUnitRef").asText());
        sku.put("identifiers", identifiers);
        sku.put("preparationOverride", preparationOverride);
        return sku;
    }

    private static boolean identifierAdmissionAllowed(String shape, String grain, String type) {
        if ("STANDARD_SALE_COUNTED".equals(shape) || "MATERIAL".equals(shape) || "COMPOSITE".equals(shape))
            return "CATALOG_ITEM".equals(grain) && Set.of("BARCODE", "MNEMONIC").contains(type);
        if ("SKU_VARIANT_SALE_COUNTED".equals(shape))
            return "SKU".equals(grain) && Set.of("BARCODE", "MNEMONIC").contains(type);
        if ("STANDARD_SALE_WEIGHED".equals(shape))
            return "CATALOG_ITEM".equals(grain)
                    && Set.of("BARCODE", "PLU", "MNEMONIC").contains(type);
        return "SERVICE".equals(shape) && "CATALOG_ITEM".equals(grain) && "MNEMONIC".equals(type);
    }

    private static boolean preparationAdmissionAllowed(String shape, String targetKind) {
        if (Set.of("STANDARD_SALE_COUNTED", "STANDARD_SALE_WEIGHED").contains(shape))
            return Set.of("ITEM", "OPTION_VALUE").contains(targetKind);
        if ("SKU_VARIANT_SALE_COUNTED".equals(shape))
            return Set.of("ITEM", "SKU").contains(targetKind);
        return false;
    }

    private static void assertIdentifier(
            JsonNode item, String ownerType, String type, String value, String normalized, String message) {
        boolean present;
        if ("CATALOG_ITEM".equals(ownerType)) {
            present = StreamSupport.stream(item.path("identifiers").spliterator(), false)
                    .anyMatch(identifier -> type.equals(
                                    identifier.path("identifierType").asText())
                            && value.equals(identifier.path("identifierValue").asText())
                            && normalized.equals(
                                    identifier.path("normalizedValue").asText())
                            && ownerType.equals(identifier.path("ownerType").asText()));
        } else {
            present = StreamSupport.stream(item.path("skus").spliterator(), false)
                    .flatMap(sku -> StreamSupport.stream(sku.path("identifiers").spliterator(), false))
                    .anyMatch(identifier -> type.equals(
                                    identifier.path("identifierType").asText())
                            && value.equals(identifier.path("identifierValue").asText())
                            && normalized.equals(
                                    identifier.path("normalizedValue").asText())
                            && ownerType.equals(identifier.path("ownerType").asText()));
        }
        assertTrue(present, message);
    }

    @AcceptanceScenario(
            id = "catalog.inventory-component-option-and-unit-semantics",
            module = "CATALOG",
            operation = "getOperationsInventoryConsumptionTargetCandidates")
    void inventoryComponentOptionAndUnitSemantics(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        List<String> eligibleTargets = new ArrayList<>();
        JsonNode firstMaterial = createInventoryBackedMaterialItem(context, fixture, session, "candidate-0-" + suffix);
        String componentTargetRef = inventoryTargetRef(firstMaterial);
        eligibleTargets.add(componentTargetRef);
        String sharedBaseUnitRef = firstMaterial.path("baseMeasureUnitRef").asText();
        for (int index = 1; index < 101; index++) {
            JsonNode material = createInventoryBackedMaterialItem(
                    context, fixture, session, "candidate-" + index + "-" + suffix, sharedBaseUnitRef);
            eligibleTargets.add(inventoryTargetRef(material));
        }
        Response firstPage = context.get(
                OPERATIONS_INVENTORY_CONSUMPTION_TARGET_CANDIDATES,
                "/api/operations/catalog-inventory/inventory-consumption-target-candidates?dataNodeRef="
                        + fixture.storeId()
                        + "&pageSize=100",
                session.cookie(),
                Set.of(200));
        JsonNode firstData = firstPage.json().path("data");
        assertEquals(101, firstData.path("total").asInt(), "BUSINESS: candidate total is the complete 101-row set");
        assertEquals(100, firstData.path("items").size(), "BUSINESS: first candidate page is bounded at 100");
        JsonNode firstCandidate = StreamSupport.stream(firstData.path("items").spliterator(), false)
                .filter(candidate ->
                        componentTargetRef.equals(candidate.path("targetRef").asText()))
                .findFirst()
                .orElseThrow(
                        () -> new AssertionError("BUSINESS: first material remains present in the candidate page"));
        assertEquals(
                firstMaterial.path("name").asText(),
                firstCandidate.path("itemName").asText(),
                "BUSINESS: component candidates expose the catalog material name, not its code");
        assertNotEquals(
                firstMaterial.path("code").asText(),
                firstCandidate.path("itemName").asText(),
                "BUSINESS: a material code must never stand in for its display name");
        String nextCursor = firstData.path("nextCursor").asText();
        assertFalse(
                nextCursor.isBlank() || "null".equals(nextCursor),
                "BUSINESS: candidate page exposes a continuation cursor");
        Response secondPage = context.get(
                OPERATIONS_INVENTORY_CONSUMPTION_TARGET_CANDIDATES,
                "/api/operations/catalog-inventory/inventory-consumption-target-candidates?dataNodeRef="
                        + fixture.storeId()
                        + "&pageSize=100&cursor="
                        + nextCursor,
                session.cookie(),
                Set.of(200));
        JsonNode secondData = secondPage.json().path("data");
        assertEquals(
                1,
                secondData.path("items").size(),
                "BUSINESS: second candidate page contains the one remaining target");
        Set<String> observed = new LinkedHashSet<>();
        firstData
                .path("items")
                .forEach(item -> observed.add(item.path("targetRef").asText()));
        secondData
                .path("items")
                .forEach(item -> observed.add(item.path("targetRef").asText()));
        assertEquals(
                new LinkedHashSet<>(eligibleTargets),
                observed,
                "BUSINESS: candidate pages have no overlap or omission");

        Fixture foreignFixture =
                host.siblingStoreFixture(fixture, Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(context, foreignFixture);
        Session foreignSession = host.login(context, foreignFixture);
        JsonNode foreignMaterial =
                createInventoryBackedMaterialItem(context, foreignFixture, foreignSession, "foreign-" + suffix);
        String foreignTargetRef = inventoryTargetRef(foreignMaterial);
        CreatedItem crossScopeOwner = createItemWithAttributes(
                context, fixture, session, "ACC-COMPONENT-CROSS-SCOPE-" + suffix, "cross scope component", Map.of());
        Response crossScope = saveInventoryNodes(
                context,
                fixture,
                session,
                "ACC-COMPONENT-CROSS-SCOPE-" + suffix,
                crossScopeOwner.version(),
                List.of(itemBomRuleForExistingItem(
                        context, fixture, session, "ACC-COMPONENT-CROSS-SCOPE-" + suffix, foreignTargetRef)),
                Set.of(422));
        assertEquals(
                "INVENTORY_BOM_COMPONENT_NOT_ELIGIBLE",
                crossScope.problemCode(),
                "BUSINESS: cross-scope component is rejected");

        JsonNode unavailableMaterial =
                createInventoryBackedMaterialItem(context, fixture, session, "unavailable-" + suffix);
        String unavailableCode = unavailableMaterial.path("code").asText();
        String unavailableTarget = inventoryTargetRef(unavailableMaterial);
        saveInventoryNodes(
                context,
                fixture,
                session,
                unavailableCode,
                unavailableMaterial.path("version").asLong(),
                List.of(noneInventoryRule(
                        "ITEM", unavailableMaterial.path("itemRef").asText(), null, unavailableCode, null)),
                Set.of(200));
        CreatedItem unavailableOwner = createItemWithAttributes(
                context, fixture, session, "ACC-COMPONENT-UNAVAILABLE-" + suffix, "unavailable component", Map.of());
        Response unavailable = saveInventoryNodes(
                context,
                fixture,
                session,
                unavailableOwnerCode(unavailableOwner, "ACC-COMPONENT-UNAVAILABLE-" + suffix),
                unavailableOwner.version(),
                List.of(itemBomRuleForExistingItem(
                        context, fixture, session, "ACC-COMPONENT-UNAVAILABLE-" + suffix, unavailableTarget)),
                Set.of(422));
        assertEquals(
                "INVENTORY_BOM_COMPONENT_NOT_ELIGIBLE",
                unavailable.problemCode(),
                "BUSINESS: disabled target is rejected");

        CreatedItem nonComponent = createItemWithAttributes(
                context, fixture, session, "ACC-COMPONENT-CAPABILITY-" + suffix, "non component", Map.of());
        saveDirectItem(
                context,
                fixture,
                session,
                "ACC-COMPONENT-CAPABILITY-" + suffix,
                nonComponent.version(),
                "non-component");
        JsonNode nonComponentRead = readItem(context, fixture, session, "ACC-COMPONENT-CAPABILITY-" + suffix);
        String nonComponentTarget = inventoryTargetRef(nonComponentRead);
        CreatedItem capabilityOwner = createItemWithAttributes(
                context, fixture, session, "ACC-COMPONENT-CAPABILITY-OWNER-" + suffix, "capability owner", Map.of());
        Response capability = saveInventoryNodes(
                context,
                fixture,
                session,
                "ACC-COMPONENT-CAPABILITY-OWNER-" + suffix,
                capabilityOwner.version(),
                List.of(itemBomRuleForExistingItem(
                        context, fixture, session, "ACC-COMPONENT-CAPABILITY-OWNER-" + suffix, nonComponentTarget)),
                Set.of(422));
        assertEquals(
                "INVENTORY_BOM_COMPONENT_NOT_ELIGIBLE",
                capability.problemCode(),
                "BUSINESS: non-BOM_COMPONENT target is rejected");

        CreatedItem noTarget = createMaterialItem(
                context, fixture, session, "ACC-COMPONENT-NO-TARGET-" + suffix, "no target material");
        JsonNode noTargetRead = readItem(context, fixture, session, "ACC-COMPONENT-NO-TARGET-" + suffix);
        assertTrue(
                inventoryRuleNodes(noTargetRead).isEmpty()
                        || inventoryRuleNodes(noTargetRead)
                                .get(0)
                                .path("mode")
                                .asText()
                                .equals("NONE"),
                "BUSINESS: material can exist with a base unit but without a StockTarget");
        CreatedItem noTargetOwner = createItemWithAttributes(
                context, fixture, session, "ACC-COMPONENT-NO-TARGET-OWNER-" + suffix, "no target owner", Map.of());
        Response noTargetResponse = saveInventoryNodes(
                context,
                fixture,
                session,
                "ACC-COMPONENT-NO-TARGET-OWNER-" + suffix,
                noTargetOwner.version(),
                List.of(itemBomRuleForExistingItem(
                        context,
                        fixture,
                        session,
                        "ACC-COMPONENT-NO-TARGET-OWNER-" + suffix,
                        inventoryTargetRefOrMissing(noTargetRead))),
                Set.of(422));
        assertEquals(
                "INVENTORY_BOM_COMPONENT_NOT_ELIGIBLE",
                noTargetResponse.problemCode(),
                "BUSINESS: a material without StockTarget is rejected");

        JsonNode grams =
                createAcceptanceUnit(context, fixture, session, "ACC-COMPONENT-GRAM-" + suffix, "克", "WEIGHT", 0);
        JsonNode kilograms =
                createAcceptanceUnit(context, fixture, session, "ACC-COMPONENT-KG-" + suffix, "千克", "WEIGHT", 3);
        String gramsRef = grams.path("result").path("unit").path("unitRef").asText();
        String kilogramsRef =
                kilograms.path("result").path("unit").path("unitRef").asText();
        CreatedItem incomplete = createMaterialItem(
                context, fixture, session, "ACC-COMPONENT-INCOMPLETE-" + suffix, "incomplete unit target");
        UUID incompleteTargetRef = UUID.randomUUID();
        host.insertInventoryTargetFixture(
                fixture.storeId(),
                fixture.brandId(),
                incompleteTargetRef,
                incomplete.itemRef(),
                "ACC-COMPONENT-INCOMPLETE-" + suffix,
                null,
                null,
                null,
                null,
                true);
        CreatedItem incompleteOwner = createItemWithAttributes(
                context, fixture, session, "ACC-COMPONENT-INCOMPLETE-OWNER-" + suffix, "incomplete owner", Map.of());
        Response incompleteResponse = saveInventoryNodes(
                context,
                fixture,
                session,
                "ACC-COMPONENT-INCOMPLETE-OWNER-" + suffix,
                incompleteOwner.version(),
                List.of(itemBomRuleForExistingItem(
                        context,
                        fixture,
                        session,
                        "ACC-COMPONENT-INCOMPLETE-OWNER-" + suffix,
                        incompleteTargetRef.toString())),
                Set.of(422));
        assertEquals(
                "INVENTORY_BOM_COMPONENT_NOT_ELIGIBLE",
                incompleteResponse.problemCode(),
                "BUSINESS: incomplete unit snapshot is rejected");

        CreatedItem self = createItemWithShape(
                context,
                fixture,
                session,
                fixture.storeId().toString(),
                "ACC-COMPONENT-SELF-" + suffix,
                "self component",
                Map.of(),
                Map.of(),
                "STANDARD_SALE_COUNTED",
                gramsRef);
        JsonNode selfRead = readItem(context, fixture, session, "ACC-COMPONENT-SELF-" + suffix);
        String selfTargetRef = UUID.randomUUID().toString();
        host.insertInventoryTargetFixture(
                fixture.storeId(),
                fixture.brandId(),
                UUID.fromString(selfTargetRef),
                self.itemRef(),
                "ACC-COMPONENT-SELF-" + suffix,
                gramsRef,
                "ACC-COMPONENT-GRAM-" + suffix,
                "克",
                "WEIGHT",
                true);
        Response selfResponse = saveInventoryNodes(
                context,
                fixture,
                session,
                "ACC-COMPONENT-SELF-" + suffix,
                selfRead.path("version").asLong(),
                List.of(itemBomRuleForExistingItem(
                        context, fixture, session, "ACC-COMPONENT-SELF-" + suffix, selfTargetRef)),
                Set.of(422));
        assertEquals(
                "INVENTORY_BOM_SELF_REFERENCE",
                selfResponse.problemCode(),
                "BUSINESS: self-referencing BOM is rejected after candidate eligibility");

        Map<String, Object> positiveValue = new LinkedHashMap<>();
        positiveValue.put("name", "加珍珠");
        positiveValue.put("displayOrder", 0);
        positiveValue.put(
                "materials",
                List.of(Map.of("materialItemRef", firstMaterial.path("itemRef").asText())));
        Map<String, Object> replacementValue = new LinkedHashMap<>();
        replacementValue.put("name", "换燕麦奶");
        replacementValue.put("displayOrder", 1);
        replacementValue.put(
                "materials",
                List.of(Map.of("materialItemRef", firstMaterial.path("itemRef").asText())));
        List<Map<String, Object>> optionBomValues = List.of(positiveValue, replacementValue);
        String optionName = "加料与替换-" + suffix;
        JsonNode optionDefinition =
                createOrderOptionDefinition(context, fixture, session, optionName, "MULTIPLE", optionBomValues);
        CreatedItem optionItem = createItemWithAttributes(
                context, fixture, session, "ACC-COMPONENT-OPTION-" + suffix, "option component product", Map.of());
        List<Map<String, Object>> configuredValues = new ArrayList<>();
        for (JsonNode value : optionDefinition.path("values"))
            configuredValues.add(optionOverride(value.path("valueRef").asText(), false, null, 0L, List.of()));
        long optionVersion = saveTypedItemFacts(
                context,
                fixture,
                session,
                "ACC-COMPONENT-OPTION-" + suffix,
                optionItem.version(),
                List.of(),
                List.of(orderOptionConfig(
                        optionDefinition.path("definitionRef").asText(), false, 0, 2, configuredValues)));
        JsonNode optionRead = readItem(context, fixture, session, "ACC-COMPONENT-OPTION-" + suffix);
        JsonNode optionValues = optionRead.path("orderOptionConfigs").get(0).path("values");
        String positiveRef = optionValues.get(0).path("definitionValueRef").asText();
        String negativeRef = optionValues.get(1).path("definitionValueRef").asText();
        JsonNode replacementMaterial =
                createInventoryBackedMaterialItem(context, fixture, session, "replacement-" + suffix);
        String replacementTargetRef = inventoryTargetRef(replacementMaterial);
        optionVersion = saveOptionValueBomLines(
                context,
                fixture,
                session,
                "ACC-COMPONENT-OPTION-" + suffix,
                optionVersion,
                positiveRef,
                "加珍珠",
                List.of(bomLine(componentTargetRef, "POSITIVE", "1.25")));
        saveOptionValueBomLines(
                context,
                fixture,
                session,
                "ACC-COMPONENT-OPTION-" + suffix,
                optionVersion,
                negativeRef,
                "换燕麦奶",
                List.of(
                        bomLine(componentTargetRef, "NEGATIVE", "0.50"),
                        bomLine(replacementTargetRef, "POSITIVE", "0.75")));
        JsonNode optionAfter = readItem(context, fixture, session, "ACC-COMPONENT-OPTION-" + suffix);
        assertOptionBomLines(optionAfter, positiveRef, "POSITIVE", "1.25");
        assertOptionBomLines(optionAfter, negativeRef, "NEGATIVE", "0.50");
        assertOptionBomLines(optionAfter, negativeRef, "POSITIVE", "0.75");
        assertOptionBomLineDisplayName(
                optionAfter,
                positiveRef,
                componentTargetRef,
                firstMaterial.path("name").asText(),
                firstMaterial.path("code").asText());

        CreatedItem decimalItem = createMaterialItem(
                context, fixture, session, "ACC-COMPONENT-DECIMAL-" + suffix, "decimal material", kilogramsRef);
        saveDirectItemWithUnits(
                context,
                fixture,
                session,
                "ACC-COMPONENT-DECIMAL-" + suffix,
                decimalItem.version(),
                null,
                kilogramsRef,
                null,
                "1");
        JsonNode decimalRead = readItem(context, fixture, session, "ACC-COMPONENT-DECIMAL-" + suffix);
        String decimalTarget = inventoryTargetRef(decimalRead);
        Response decimalCurrent = context.get(
                OPERATIONS_INVENTORY_TARGET_READ,
                "/api/operations/catalog-inventory/inventory-targets/"
                        + decimalTarget
                        + "?dataNodeRef="
                        + fixture.storeId(),
                session.cookie(),
                Set.of(200));
        Map<String, Object> decimalCountRequest = new LinkedHashMap<>();
        decimalCountRequest.put("dataNodeRef", fixture.storeId().toString());
        decimalCountRequest.put("targetRef", decimalTarget);
        decimalCountRequest.put(
                "expectedVersion", decimalCurrent.json().path("version").asLong());
        decimalCountRequest.put("countedQuantity", "2.5");
        decimalCountRequest.put("countingUnitRef", null);
        decimalCountRequest.put("zeroConfirmation", false);
        Response decimalCount = context.post(
                OPERATIONS_INVENTORY_TARGET_COUNT,
                "/api/operations/catalog-inventory/inventory-targets/" + decimalTarget + "/count",
                session.cookie(),
                decimalCountRequest,
                idempotencyHeaders("component-decimal-count"),
                Set.of(200));
        assertInventoryMutationOperationOracle(
                decimalCount.json(),
                "countOperationsInventoryTarget",
                decimalTarget,
                "0",
                "2.5",
                "2.5",
                "OK",
                "BUSINESS: no counting unit falls back to consumption precision");

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
                        "克（历史）"),
                idempotencyHeaders("component-unit-rename"),
                Set.of(200));
        JsonNode gramsAfterRename = context.get(
                        OPERATIONS_CATALOG_UNIT_LIST,
                        "/api/operations/catalog-inventory/units?dataNodeRef="
                                + fixture.storeId()
                                + "&includeInactive=true",
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("data")
                .path("units");
        JsonNode renamed = StreamSupport.stream(gramsAfterRename.spliterator(), false)
                .filter(unit -> gramsRef.equals(unit.path("unitRef").asText()))
                .findFirst()
                .orElseThrow();
        context.post(
                OPERATIONS_CATALOG_UNIT_STATUS,
                "/api/operations/catalog-inventory/units/" + gramsRef + "/status",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "unitRef",
                        gramsRef,
                        "expectedVersion",
                        renamed.path("version").asLong(),
                        "targetStatus",
                        "DISABLED"),
                idempotencyHeaders("component-unit-disable"),
                Set.of(200));
        JsonNode decimalTargetAfter = context.get(
                        OPERATIONS_INVENTORY_TARGET_READ,
                        "/api/operations/catalog-inventory/inventory-targets/"
                                + decimalTarget
                                + "?dataNodeRef="
                                + fixture.storeId(),
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("target");
        assertEquals(
                kilogramsRef,
                decimalTargetAfter
                        .path("consumptionUnitSnapshot")
                        .path("unitRef")
                        .asText(),
                "BUSINESS: later unit lifecycle changes do not reinterpret the target snapshot");
    }

    @AcceptanceScenario(
            id = "catalog.inventory-mode-switch-guard",
            module = "CATALOG",
            operation = "saveOperationsCatalogItem")
    void inventoryModeSwitchGuard(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        JsonNode component = createInventoryBackedMaterialItem(context, fixture, session, "switch-component-" + suffix);
        String componentTargetRef = inventoryTargetRef(component);

        for (String kind :
                List.of("BALANCE_ABSENT", "LEDGER_ABSENT", "BOM_REFERENCE_ABSENT", "HISTORICAL_DEFINITION_ABSENT")) {
            String itemCode = "ACC-SWITCH-POSITIVE-" + kind + "-" + suffix;
            CreatedItem created =
                    createItemWithAttributes(context, fixture, session, itemCode, "switch positive " + kind, Map.of());
            saveDirectItem(context, fixture, session, itemCode, created.version(), "switch-positive");
            JsonNode before = readItem(context, fixture, session, itemCode);
            JsonNode switched = saveItemInventoryMode(
                    context, fixture, session, itemCode, before.path("version").asLong(), "BOM", componentTargetRef);
            assertEquals(
                    "BOM",
                    findInventoryOwner(
                                    switched, "ITEM", switched.path("itemRef").asText(), null, null)
                            .path("mode")
                            .asText(),
                    "BUSINESS: first switch succeeds when " + kind + " is absent");
        }

        List<String> blockers = List.of("BALANCE", "LEDGER", "BOM_REFERENCE", "HISTORICAL_DEFINITION");
        for (String blocker : blockers) {
            String itemCode = "ACC-SWITCH-REJECT-" + blocker + "-" + suffix;
            CreatedItem created =
                    createItemWithAttributes(context, fixture, session, itemCode, "switch reject " + blocker, Map.of());
            saveDirectItem(context, fixture, session, itemCode, created.version(), "switch-reject");
            JsonNode direct = readItem(context, fixture, session, itemCode);
            String targetRef = inventoryTargetRef(direct);
            if ("BALANCE".equals(blocker)) {
                countTarget(context, fixture, session, targetRef, "1", false, "switch-balance");
            } else if ("LEDGER".equals(blocker)) {
                countTarget(context, fixture, session, targetRef, "1", false, "switch-ledger-increase");
                countTarget(context, fixture, session, targetRef, "0", true, "switch-ledger-zero");
            } else if ("BOM_REFERENCE".equals(blocker)) {
                host.insertInventoryBomFixture(
                        fixture.storeId(),
                        fixture.brandId(),
                        UUID.fromString(component.path("itemRef").asText()),
                        null,
                        component.path("code").asText(),
                        null,
                        List.of(bomLine(targetRef, "POSITIVE", "1")));
            } else {
                JsonNode switched = saveItemInventoryMode(
                        context,
                        fixture,
                        session,
                        itemCode,
                        direct.path("version").asLong(),
                        "BOM",
                        componentTargetRef);
                assertEquals(
                        "BOM",
                        findInventoryOwner(
                                        switched,
                                        "ITEM",
                                        switched.path("itemRef").asText(),
                                        null,
                                        null)
                                .path("mode")
                                .asText());
                direct = readItem(context, fixture, session, itemCode);
            }
            JsonNode beforeReject = readItem(context, fixture, session, itemCode);
            long catalogVersion = beforeReject.path("version").asLong();
            Map<String, Object> rejectedRule = "HISTORICAL_DEFINITION".equals(blocker)
                    ? itemDirectRuleForExistingItem(context, fixture, session, itemCode)
                    : itemBomRuleForExistingItem(context, fixture, session, itemCode, componentTargetRef);
            Response rejected = saveInventoryNodes(
                    context, fixture, session, itemCode, catalogVersion, List.of(rejectedRule), Set.of(409));
            assertEquals(
                    "INVENTORY_DEDUCTION_MODE_CHANGE_BLOCKED",
                    rejected.problemCode(),
                    "BUSINESS: blocker " + blocker + " rejects mode switch");
            Set<String> expectedBlockingKinds =
                    "BALANCE".equals(blocker) ? Set.of("BALANCE", "LEDGER") : Set.of(blocker);
            assertBlockingFacts(rejected.json(), expectedBlockingKinds);
            JsonNode afterReject = readItem(context, fixture, session, itemCode);
            assertEquals(
                    catalogVersion,
                    afterReject.path("version").asLong(),
                    "BUSINESS: rejected switch leaves catalog version unchanged");
            if ("HISTORICAL_DEFINITION".equals(blocker)) {
                assertEquals(
                        "BOM",
                        findInventoryOwner(
                                        afterReject,
                                        "ITEM",
                                        afterReject.path("itemRef").asText(),
                                        null,
                                        null)
                                .path("mode")
                                .asText(),
                        "BUSINESS: historical blocker leaves the existing BOM definition active");
            }
        }
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
        Response searched = context.get(
                OPERATIONS_CATALOG_UNIT_LIST,
                basePath + "&includeInactive=true&query="
                        + java.net.URLEncoder.encode(
                                unit.path("code").asText(), java.nio.charset.StandardCharsets.UTF_8),
                session.cookie(),
                Set.of(200));
        assertTrue(
                array(searched.json().path("data").path("units")).stream()
                        .allMatch(row -> unitRef.equals(row.path("unitRef").asText())),
                "BUSINESS: unit search is owner-filtered by the requested business code, not only the loaded page");

        Response disabled = context.post(
                OPERATIONS_CATALOG_UNIT_STATUS,
                "/api/operations/catalog-inventory/units/" + unitRef + "/status",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "unitRef",
                        unitRef,
                        "expectedVersion",
                        version,
                        "targetStatus",
                        "DISABLED"),
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
        Response disabledOnly = context.get(
                OPERATIONS_CATALOG_UNIT_LIST,
                basePath + "&includeInactive=true&status=DISABLED&query="
                        + java.net.URLEncoder.encode(
                                unit.path("code").asText(), java.nio.charset.StandardCharsets.UTF_8),
                session.cookie(),
                Set.of(200));
        assertEquals(
                List.of(unitRef),
                array(disabledOnly.json().path("data").path("units")).stream()
                        .map(row -> row.path("unitRef").asText())
                        .toList(),
                "BUSINESS: unit lifecycle filter is an exact owner query fact");
    }

    @AcceptanceScenario(
            id = "inventory.counting-unit-precision-semantics",
            module = "CATALOG",
            operation = "countOperationsInventoryTarget")
    void countingUnitPrecisionSemantics(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        inventoryCountTruncatesConvertedQuantityTowardZeroSubcase(context);
        inventoryCountPreservesConsumptionPrecisionWithoutCountingUnitSubcase(context);
    }

    private void inventoryCountTruncatesConvertedQuantityTowardZeroSubcase(
            BackendAcceptanceTest.ScenarioContext context) throws Exception {
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
        saveDirectItemWithUnits(
                context, fixture, session, itemCode, created.version(), gramsRef, gramsRef, kilogramsRef, "1000");
        JsonNode item = readItem(context, fixture, session, itemCode);
        String targetRef = inventoryRuleNodes(item)
                .get(0)
                .path("directConfiguration")
                .path("targetRef")
                .asText();
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

    private void inventoryCountPreservesConsumptionPrecisionWithoutCountingUnitSubcase(
            BackendAcceptanceTest.ScenarioContext context) throws Exception {
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
        saveDirectItemWithUnits(
                context, fixture, session, itemCode, created.version(), kilogramsRef, kilogramsRef, null, "1");

        JsonNode item = readItem(context, fixture, session, itemCode);
        String targetRef = inventoryRuleNodes(item)
                .get(0)
                .path("directConfiguration")
                .path("targetRef")
                .asText();
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
        saveDirectItem(context, fixture, session, itemCode, created.version(), "ACC-BASE-UNIT-SKU-" + suffix);

        JsonNode before = readItem(context, fixture, session, itemCode);
        String oldBaseUnitRef = before.path("baseMeasureUnitRef").asText();
        String targetRef = inventoryRuleNodes(before)
                .get(0)
                .path("directConfiguration")
                .path("targetRef")
                .asText();
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
        sections.put("inventoryRules", Map.of("nodes", List.of()));
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
        String disabledValueCode = "ACC-PAGE-DISABLED-" + suffix;
        createDictionaryEntryWithoutReadback(
                context,
                fixture,
                session,
                fixture.storeId().toString(),
                "SKU_ATTRIBUTE_VALUE",
                disabledValueCode,
                "Disabled page value",
                requestedParent.path("entryRef").asText());
        context.post(
                OPERATIONS_CATALOG_DICTIONARY_STATUS,
                "/api/operations/catalog-inventory/dictionaries/SKU_ATTRIBUTE_VALUE/entries/" + disabledValueCode
                        + "/status",
                session.cookie(),
                Map.of(
                        "dictionaryKind",
                        "SKU_ATTRIBUTE_VALUE",
                        "entryCode",
                        disabledValueCode,
                        "expectedVersion",
                        1,
                        "targetStatus",
                        "DISABLED",
                        "dataNodeRef",
                        fixture.storeId().toString()),
                Set.of(200));
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
                + "&query=ACC-PAGE-DICT-"
                + suffix
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

        Response disabledDictionary = context.get(
                OPERATIONS_CATALOG_DICTIONARY_READ,
                "/api/operations/catalog-inventory/dictionaries/SKU_ATTRIBUTE_VALUE?dataNodeRef="
                        + fixture.storeId()
                        + "&parentEntryRef="
                        + requestedParent.path("entryRef").asText()
                        + "&status=DISABLED&query=ACC-PAGE-DISABLED-"
                        + suffix,
                session.cookie(),
                Set.of(200));
        assertEquals(
                List.of(disabledValueCode),
                array(disabledDictionary.json().path("data").path("entries")).stream()
                        .map(entry -> entry.path("code").asText())
                        .toList(),
                "BUSINESS: dictionary lifecycle status and search filter the owner collection together");

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
        for (int index = 0; index < 22; index++) {
            String code = "ACC-PAGE-TAG-" + suffix + "-" + index;
            expectedCodes.add(code);
            createProductionTag(context, fixture, session, code, "Page production tag " + index);
        }
        String disabledCode = "ACC-PAGE-TAG-" + suffix + "-20";
        transitionProductionTag(context, fixture, session, disabledCode, "DISABLED");
        createProductionTag(
                context, sibling, siblingSession, "ACC-PAGE-TAG-" + suffix + "-FOREIGN", "Foreign production tag");

        Set<String> observedManagement = collectCursorCodes(
                context,
                OPERATIONS_PRODUCTION_TAGS,
                "/api/operations/catalog-inventory/production-tags?dataNodeRef=" + fixture.storeId() + "&pageSize=20",
                session.cookie(),
                "entries",
                expectedCodes.size(),
                20,
                data -> {
                    assertEquals(
                            expectedCodes.size(),
                            data.path("total").asInt(),
                            "BUSINESS: management usage counts enabled and disabled tags together");
                    assertEquals(
                            fixture.storeId().toString(),
                            data.path("entries").get(0).path("ownerRef").asText(),
                            "BUSINESS: production-tag pages identify the requested data-node owner");
                });
        assertEquals(
                expectedCodes,
                observedManagement,
                "BUSINESS: management cursor pages contain every target-scope tag, including disabled "
                        + "tags, and no sibling-scope tag");

        Set<String> expectedEnabledCodes = new LinkedHashSet<>(expectedCodes);
        expectedEnabledCodes.remove(disabledCode);
        Set<String> observedCandidates = collectCursorCodes(
                context,
                OPERATIONS_PRODUCTION_TAGS,
                "/api/operations/catalog-inventory/production-tags?dataNodeRef="
                        + fixture.storeId()
                        + "&usage=BINDABLE_CANDIDATE&query=ACC-PAGE-TAG-"
                        + suffix
                        + "&pageSize=20",
                session.cookie(),
                "entries",
                expectedEnabledCodes.size(),
                20,
                data -> {
                    assertEquals(
                            expectedEnabledCodes.size(),
                            data.path("total").asInt(),
                            "BUSINESS: bindable candidates exclude disabled tags from the filtered total");
                    for (JsonNode entry : data.path("entries"))
                        assertEquals(
                                "ENABLED",
                                entry.path("status").asText(),
                                "BUSINESS: bindable candidates contain enabled tags only");
                });
        assertEquals(
                expectedEnabledCodes,
                observedCandidates,
                "BUSINESS: bindable candidate query returns every enabled matching tag and no disabled/foreign tag");

        Response disabledManagement = context.get(
                OPERATIONS_PRODUCTION_TAGS,
                "/api/operations/catalog-inventory/production-tags?dataNodeRef="
                        + fixture.storeId()
                        + "&usage=MANAGEMENT&status=DISABLED&query="
                        + java.net.URLEncoder.encode(disabledCode, java.nio.charset.StandardCharsets.UTF_8),
                session.cookie(),
                Set.of(200));
        assertEquals(
                List.of(disabledCode),
                array(disabledManagement.json().path("data").path("entries")).stream()
                        .map(entry -> entry.path("code").asText())
                        .toList(),
                "BUSINESS: production-tag status and search filter the owner collection together");

        Response firstManagementPage = context.get(
                OPERATIONS_PRODUCTION_TAGS,
                "/api/operations/catalog-inventory/production-tags?dataNodeRef=" + fixture.storeId() + "&pageSize=20",
                session.cookie(),
                Set.of(200));
        String managementCursor =
                firstManagementPage.json().path("data").path("cursor").asText();
        assertFalse(managementCursor.isBlank(), "BUSINESS: management page exposes a cursor for the second page");
        Response usageChangedCursor = context.get(
                OPERATIONS_PRODUCTION_TAGS,
                "/api/operations/catalog-inventory/production-tags?dataNodeRef="
                        + fixture.storeId()
                        + "&usage=BINDABLE_CANDIDATE&pageSize=20&cursor="
                        + java.net.URLEncoder.encode(managementCursor, java.nio.charset.StandardCharsets.UTF_8),
                session.cookie(),
                Set.of(422));
        assertEquals(
                "VALIDATION_ERROR",
                usageChangedCursor.problemCode(),
                "BUSINESS: a cursor cannot cross from management to bindable-candidate usage");
        Response queryChangedCursor = context.get(
                OPERATIONS_PRODUCTION_TAGS,
                "/api/operations/catalog-inventory/production-tags?dataNodeRef="
                        + fixture.storeId()
                        + "&query=ACC-PAGE-TAG-"
                        + suffix
                        + "-0&pageSize=20&cursor="
                        + java.net.URLEncoder.encode(managementCursor, java.nio.charset.StandardCharsets.UTF_8),
                session.cookie(),
                Set.of(422));
        assertEquals(
                "VALIDATION_ERROR",
                queryChangedCursor.problemCode(),
                "BUSINESS: a cursor cannot cross from the management query to a filtered query");
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
                13, responseFields.size(), "BUSINESS: the generated shape field denominator is the current field set");
        Set<String> fieldKeys = new LinkedHashSet<>();
        responseFields.forEach(field -> fieldKeys.add(field.path("fieldKey").asText()));
        assertTrue(
                fieldKeys.contains("salesUnitRef") && fieldKeys.contains("baseMeasureUnitRef"),
                "BUSINESS: the generated shape field set includes both sales and base measurement unit fields");
    }

    /** Creates a bounded real batch (default twenty) and proves the ordered per-item outcome contract. */
    @AcceptanceScenario(
            id = "catalog.batch-status-partial-outcome",
            module = "CATALOG",
            operation = "batchTransitionOperationsCatalogItemStatus")
    void batchStatusPartialOutcome(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        int batchSize = batchStatusCalibrationCardinality();

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

        // The request contract permits up to 100 items while the fixture's owner-local unit library permits 99
        // definitions.  Create one real unit and reuse it so the N=100 calibration measures the batch command rather
        // than failing while manufacturing one unrelated unit per item.
        JsonNode sharedUnit = createAcceptanceUnitAtDataNode(
                context,
                fixture,
                session,
                fixture.storeId().toString(),
                "ACC-UNIT-BATCH-" + suffix,
                "个",
                "COUNT",
                0,
                Map.of());
        String sharedBaseUnitRef =
                sharedUnit.path("result").path("unit").path("unitRef").asText();
        assertFalse(sharedBaseUnitRef.isBlank(), "BUSINESS: batch fixture obtains one reusable base unit");

        List<BatchItem> items = new ArrayList<>();
        for (int index = 0; index < batchSize; index++) {
            String code = "ACC-BATCH-" + suffix + "-" + String.format("%02d", index);
            CreatedItem created = createItemWithShape(
                    context,
                    fixture,
                    session,
                    fixture.storeId().toString(),
                    code,
                    "Batch item " + index,
                    Map.of(),
                    Map.of(),
                    "STANDARD_SALE_COUNTED",
                    sharedBaseUnitRef);
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

        // Make exactly the thirteenth request item's expected version stale when the selected
        // calibration cardinality includes that item. N=1 remains a clean all-success boundary.
        if (batchSize > 12) {
            BatchItem staleItem = items.get(12);
            context.post(
                    OPERATIONS_CATALOG_ITEM_STATUS,
                    itemPath(staleItem.code()) + "/status",
                    staleItem.session().cookie(),
                    Map.of(
                            "dataNodeRef", staleItem.fixture().storeId().toString(),
                            "itemCode", staleItem.code(),
                            "expectedVersion", staleItem.expectedVersion(),
                            "targetStatus", "DISABLED"),
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
                Map.of("dataNodeRef", fixture.storeId().toString(), "targetStatus", "VOIDED", "items", requestItems),
                Set.of(200));
        JsonNode results = batch.json().path("results");
        assertEquals(
                batchSize,
                results.size(),
                "BUSINESS: batch readback contains one ordered result for every submitted item");

        int failures = 0;
        for (int index = 0; index < items.size(); index++) {
            BatchItem item = items.get(index);
            JsonNode result = results.get(index);
            assertEquals(
                    item.itemRef().toString(),
                    result.path("itemRef").asText(),
                    "BUSINESS: batch result order matches request order");
            assertEquals(
                    item.code(), result.path("itemCode").asText(), "BUSINESS: owner returns authoritative item code");
            boolean expectedFailure = batchSize > 12 && index == 12;
            if (expectedFailure) {
                failures++;
                assertEquals("FAILED", result.path("outcome").asText(), "BUSINESS: stale item is a failed outcome");
                assertEquals(
                        "VERSION_CONFLICT",
                        result.path("problemCode").asText(),
                        "BUSINESS: each failed item exposes its typed reason");
                assertFalse(result.path("reason").asText().isBlank(), "BUSINESS: failure exposes owner reason");
                assertTrue(result.path("version").isNull(), "BUSINESS: failure has no resulting version");
            } else {
                assertEquals(
                        "SUCCEEDED",
                        result.path("outcome").asText(),
                        "BUSINESS: successful item commits independently");
                assertTrue(result.path("problemCode").isNull(), "BUSINESS: success has no problem code");
                assertTrue(result.path("reason").isNull(), "BUSINESS: success has no failure reason");
                assertTrue(result.path("version").isIntegralNumber(), "BUSINESS: success returns the new version");
                assertEquals(
                        "VOIDED",
                        readItem(context, item.fixture(), item.session(), item.code())
                                .path("lifecycle")
                                .path("status")
                                .asText(),
                        "BUSINESS: successful item reaches the requested status");
            }
            JsonNode after = readItem(context, item.fixture(), item.session(), item.code());
            if (expectedFailure) {
                assertEquals(
                        "DISABLED",
                        after.path("lifecycle").path("status").asText(),
                        "BUSINESS: stale batch receipt leaves the independently committed owner status intact");
                assertTrue(
                        after.path("version").asLong() > item.expectedVersion(),
                        "BUSINESS: stale batch receipt reads the owner version that made the request stale");
            } else {
                assertEquals(
                        result.path("version").asLong(),
                        after.path("version").asLong(),
                        "BUSINESS: each successful batch receipt is verified against its own owner version");
            }
            assertEquals(
                    item.imagesBefore(),
                    after.path("images"),
                    "BUSINESS: batch status migration does not alter images");
            assertEquals(
                    item.attributeAssignmentsBefore(),
                    after.path("attributeAssignments"),
                    "BUSINESS: batch status migration does not alter product attribute assignments");
        }
        assertEquals(
                batchSize > 12 ? 1 : 0,
                failures,
                "BUSINESS: only the deliberately stale item fails when the selected cardinality includes it");
    }

    private int batchStatusCalibrationCardinality() {
        String configured = System.getenv("V2S_BACKEND_ACCEPTANCE_BATCH_CARDINALITY");
        if (configured == null || configured.isBlank()) return 20;
        try {
            int cardinality = Integer.parseInt(configured);
            if (cardinality < 1 || cardinality > 100) throw new NumberFormatException("out of range");
            return cardinality;
        } catch (NumberFormatException failure) {
            throw new IllegalArgumentException(
                    "V2S_BACKEND_ACCEPTANCE_BATCH_CARDINALITY must be an integer from 1 through 100", failure);
        }
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

        String disabledCode = "ACC-DISABLED-" + suffix;
        long disabledVersion = createItem(context, fixture, session, disabledCode, "disabled source");
        Response disabled = context.post(
                OPERATIONS_CATALOG_ITEM_STATUS,
                itemPath(disabledCode) + "/status",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "itemCode",
                        disabledCode,
                        "expectedVersion",
                        disabledVersion,
                        "targetStatus",
                        "DISABLED"),
                Set.of(200));
        assertEquals(
                "DISABLED",
                disabled.json().path("result").path("status").asText(),
                "BUSINESS: lifecycle command persists the disabled state");
        Response duplicate = context.post(
                OPERATIONS_CATALOG_ITEM_CREATE,
                "/api/operations/catalog-inventory/items",
                session.cookie(),
                itemCreateBody(
                        fixture.storeId().toString(),
                        disabledCode,
                        "must not reuse disabled code",
                        "STANDARD_SALE_COUNTED",
                        null),
                Set.of(409, 422));
        assertEquals(
                "DUPLICATE_CODE",
                duplicate.problemCode(),
                "BUSINESS: disabled item retains code reservation while it remains an active business identity");
    }

    /**
     * Fixture: creates a category and binds it through the catalog save command. It proves both directions of the
     * relation: deletion is blocked while the item owns the relation and succeeds immediately after the same owner
     * command removes only that relation.
     */
    @AcceptanceScenario(
            id = "catalog.category-relation-integrity",
            module = "CATALOG",
            operation = "transitionOperationsCatalogCategoryStatus")
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
        assertCatalogOperationOracle(
                category.json(),
                "createOperationsCatalogCategory",
                "/result/categoryRef",
                host.mapper.valueToTree(categoryRef),
                "BUSINESS: category create returns the exact opaque category reference");
        assertCatalogOperationOracle(
                category.json(),
                "createOperationsCatalogCategory",
                "/result/name",
                host.mapper.valueToTree(categoryBody.get("name")),
                "BUSINESS: category create returns the exact requested category name");
        assertTrue(
                categoryRef.matches("[0-9a-f-]{36}") && categoryVersion > 0,
                "BUSINESS: category create returns an opaque, versioned category identity");

        JsonNode parent = createAcceptanceCategory(
                context, fixture, session, "ACC-CATEGORY-PARENT-" + suffix, "Acceptance parent " + suffix, null);
        String parentRef = parent.path("result").path("categoryRef").asText();
        String updatedCategoryName = "Acceptance category updated " + suffix;
        Response updated = context.patch(
                OPERATIONS_CATALOG_CATEGORY_UPDATE,
                "/api/operations/catalog-inventory/categories/" + categoryRef,
                session.cookie(),
                Map.of(
                        "dataNodeRef", fixture.storeId().toString(),
                        "categoryRef", categoryRef,
                        "expectedVersion", categoryVersion,
                        "name", updatedCategoryName),
                idempotencyHeaders("category-update-" + suffix),
                Set.of(200));
        assertCatalogOperationOracle(
                updated.json(),
                "updateOperationsCatalogCategory",
                "/result/categoryRef",
                host.mapper.valueToTree(categoryRef),
                "BUSINESS: category update preserves the category identity");
        assertCatalogOperationOracle(
                updated.json(),
                "updateOperationsCatalogCategory",
                "/result/name",
                host.mapper.valueToTree(updatedCategoryName),
                "BUSINESS: category update returns the exact renamed value");
        categoryVersion = updated.json().path("result").path("version").asLong();

        Response moved = context.post(
                OPERATIONS_CATALOG_CATEGORY_MOVE,
                "/api/operations/catalog-inventory/categories/" + categoryRef + "/move",
                session.cookie(),
                Map.of(
                        "dataNodeRef", fixture.storeId().toString(),
                        "categoryRef", categoryRef,
                        "expectedVersion", categoryVersion,
                        "action", "REPARENT",
                        "parentCategoryRef", parentRef),
                idempotencyHeaders("category-move-" + suffix),
                Set.of(200));
        assertCatalogOperationOracle(
                moved.json(),
                "moveOperationsCatalogCategory",
                "/result/categoryRef",
                host.mapper.valueToTree(categoryRef),
                "BUSINESS: category move preserves the category identity");
        assertCatalogOperationOracle(
                moved.json(),
                "moveOperationsCatalogCategory",
                "/result/name",
                host.mapper.valueToTree(updatedCategoryName),
                "BUSINESS: category move keeps the exact renamed value");
        categoryVersion = moved.json().path("result").path("version").asLong();

        String itemCode = "ACC-CATEGORY-ITEM-" + suffix;
        long createdVersion = createItem(context, fixture, session, itemCode, "category relation item");
        long boundVersion = saveCategoryRef(context, fixture, session, itemCode, createdVersion, categoryRef);
        Response blocked = context.post(
                OPERATIONS_CATALOG_CATEGORY_STATUS,
                "/api/operations/catalog-inventory/categories/" + categoryRef + "/status",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "categoryRef",
                        categoryRef,
                        "expectedVersion",
                        categoryVersion,
                        "targetStatus",
                        "VOIDED"),
                Set.of(422));
        assertEquals(
                "REFERENCE_BLOCKS_VOID",
                blocked.problemCode(),
                "BUSINESS: category void is blocked while an item relation still exists");
        assertEquals(
                categoryRef,
                readItem(context, fixture, session, itemCode)
                        .path("categoryRef")
                        .asText(),
                "BUSINESS: rejected category deletion preserves the item's relation");

        long unboundVersion = saveCategoryRef(context, fixture, session, itemCode, boundVersion, null);
        assertTrue(
                unboundVersion > boundVersion, "BUSINESS: the catalog owner versions removal of one category relation");
        Response voided = context.post(
                OPERATIONS_CATALOG_CATEGORY_STATUS,
                "/api/operations/catalog-inventory/categories/" + categoryRef + "/status",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "categoryRef",
                        categoryRef,
                        "expectedVersion",
                        categoryVersion,
                        "targetStatus",
                        "VOIDED"),
                Set.of(200));
        assertEquals(
                categoryRef,
                voided.json().path("result").path("categoryRef").asText(),
                "BUSINESS: removing the item relation makes the category voidable");
        assertEquals(
                "VOIDED",
                voided.json().path("result").path("status").asText(),
                "BUSINESS: category transition returns the terminal lifecycle state");
        assertCatalogOperationOracle(
                voided.json(),
                "transitionOperationsCatalogCategoryStatus",
                "/result/categoryRef",
                host.mapper.valueToTree(categoryRef),
                "BUSINESS: category transition returns the exact category identity");
        assertCatalogOperationOracle(
                voided.json(),
                "transitionOperationsCatalogCategoryStatus",
                "/result/status",
                host.mapper.valueToTree("VOIDED"),
                "BUSINESS: category transition returns the exact terminal status");
    }

    @AcceptanceScenario(id = "catalog.tag-navigation", module = "CATALOG", operation = "getOperationsCatalogNavigation")
    void tagNavigation(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        tagNavigationAndFilterSubcase(context, true);
    }

    @AcceptanceScenario(id = "catalog.item-tag-filter", module = "CATALOG", operation = "getOperationsCatalogItems")
    void itemTagFilter(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        tagNavigationAndFilterSubcase(context, false);
    }

    /**
     * Fixture: creates two enabled catalog tags, binds only one to a catalog item, then reads the same owner facts
     * through navigation and the item page. The two read tasks are separate operation-identity subcases so each
     * scenario is measured against the HTTP operation it actually exercises.
     */
    private void tagNavigationAndFilterSubcase(BackendAcceptanceTest.ScenarioContext context, boolean readNavigation)
            throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        JsonNode selectedTag = createDictionaryEntry(
                context, fixture, session, "TAG", "ACC-TAG-SELECTED-" + suffix, "Selected tag " + suffix);
        JsonNode laterTag = createDictionaryEntry(
                context, fixture, session, "TAG", "ACC-TAG-LATER-" + suffix, "Later tag " + suffix);
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

        String selectedProductionTagCode = "ACC-PRODUCTION-TAG-SELECTED-" + suffix;
        String selectedProductionTagRef = createProductionTag(
                context, fixture, session, selectedProductionTagCode, "Selected production tag " + suffix);
        String disabledProductionTagCode = "ACC-PRODUCTION-TAG-DISABLED-" + suffix;
        String disabledProductionTagRef = createProductionTag(
                context, fixture, session, disabledProductionTagCode, "Disabled production tag " + suffix);

        String taggedItemCode = "ACC-TAGGED-ITEM-" + suffix;
        long taggedItemVersion = createItem(context, fixture, session, taggedItemCode, "tagged item " + suffix);
        saveCatalogTags(
                context,
                fixture,
                session,
                taggedItemCode,
                taggedItemVersion,
                List.of(
                        laterTag.path("entryRef").asText(),
                        selectedTag.path("entryRef").asText()));
        long taggedWithProductionTagVersion = saveCatalogProductionTag(
                context,
                fixture,
                session,
                taggedItemCode,
                readItem(context, fixture, session, taggedItemCode)
                        .path("version")
                        .asLong(),
                selectedProductionTagRef);
        String disabledTaggedItemCode = "ACC-DISABLED-TAGGED-ITEM-" + suffix;
        long disabledTaggedItemVersion =
                createItem(context, fixture, session, disabledTaggedItemCode, "disabled tagged item " + suffix);
        saveCatalogProductionTag(
                context, fixture, session, disabledTaggedItemCode, disabledTaggedItemVersion, disabledProductionTagRef);
        transitionProductionTag(context, fixture, session, disabledProductionTagCode, "DISABLED");
        String untaggedItemCode = "ACC-UNTAGGED-ITEM-" + suffix;
        createItem(context, fixture, session, untaggedItemCode, "untagged item " + suffix);
        JsonNode categoryRoot =
                createAcceptanceCategory(context, fixture, session, "ACC-NAV-ROOT-" + suffix, "导航根分类", null);
        JsonNode categoryBranch = createAcceptanceCategory(
                context,
                fixture,
                session,
                "ACC-NAV-BRANCH-" + suffix,
                "导航中间分类",
                categoryRoot.path("result").path("categoryRef").asText());
        JsonNode categoryLeaf = createAcceptanceCategory(
                context,
                fixture,
                session,
                "ACC-NAV-LEAF-" + suffix,
                "导航叶分类",
                categoryBranch.path("result").path("categoryRef").asText());
        JsonNode taggedItemReadback = readItem(context, fixture, session, taggedItemCode);
        long taggedWithCategoryVersion = saveCategoryRef(
                context,
                fixture,
                session,
                taggedItemCode,
                taggedItemReadback.path("version").asLong(),
                categoryBranch.path("result").path("categoryRef").asText());

        if (readNavigation) {
            Response navigation = context.get(
                    OPERATIONS_CATALOG_NAVIGATION,
                    "/api/operations/catalog-inventory/navigation?dataNodeRef=" + fixture.storeId(),
                    session.cookie(),
                    Set.of(200));
            assertCatalogOperationOracle(
                    navigation.json(),
                    "getOperationsCatalogNavigation",
                    "/data/tree",
                    host.mapper.valueToTree(List.of(
                            catalogNavigationCategoryFact(
                                    categoryRoot,
                                    null,
                                    1,
                                    0,
                                    3,
                                    false,
                                    taggedItemReadback.path("itemRef").asText(),
                                    taggedItemReadback.path("code").asText(),
                                    taggedItemReadback.path("name").asText()),
                            catalogNavigationCategoryFact(
                                    categoryBranch,
                                    categoryRoot
                                            .path("result")
                                            .path("categoryRef")
                                            .asText(),
                                    1,
                                    1,
                                    2,
                                    false,
                                    taggedItemReadback.path("itemRef").asText(),
                                    taggedItemReadback.path("code").asText(),
                                    taggedItemReadback.path("name").asText()),
                            catalogNavigationCategoryFact(
                                    categoryLeaf,
                                    categoryBranch
                                            .path("result")
                                            .path("categoryRef")
                                            .asText(),
                                    0,
                                    0,
                                    1,
                                    true,
                                    null,
                                    null,
                                    null))),
                    "BUSINESS: navigation returns the exact ordered category tree facts");
            assertCatalogOperationOracle(
                    navigation.json(),
                    "getOperationsCatalogNavigation",
                    "/data/tags",
                    host.mapper.valueToTree(List.of(
                            catalogTagFact(
                                    selectedTag.path("entryRef").asText(),
                                    selectedTag.path("code").asText(),
                                    selectedTag.path("name").asText(),
                                    1),
                            catalogTagFact(
                                    laterTag.path("entryRef").asText(),
                                    laterTag.path("code").asText(),
                                    laterTag.path("name").asText(),
                                    1),
                            catalogTagFact(
                                    unusedTag.path("entryRef").asText(),
                                    unusedTag.path("code").asText(),
                                    unusedTag.path("name").asText(),
                                    0))),
                    "BUSINESS: navigation returns the exact enabled tag facts in owner order");
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
            JsonNode selectedNavigationProductionTag =
                    findByCode(navigation.json().path("data").path("productionTags"), selectedProductionTagCode);
            assertEquals(
                    selectedProductionTagRef,
                    selectedNavigationProductionTag.path("tagRef").asText(),
                    "BUSINESS: navigation exposes the bound production tag identity");
            assertEquals(
                    1,
                    selectedNavigationProductionTag.path("count").asInt(),
                    "BUSINESS: production-tag navigation count equals the matching parent product count");
            JsonNode disabledNavigationProductionTag =
                    findByCode(navigation.json().path("data").path("productionTags"), disabledProductionTagCode);
            assertEquals(
                    "DISABLED",
                    disabledNavigationProductionTag.path("status").asText(),
                    "BUSINESS: navigation keeps a disabled production tag visible for existing bindings");
            assertEquals(
                    1,
                    disabledNavigationProductionTag.path("count").asInt(),
                    "BUSINESS: navigation counts the parent product that keeps the disabled production-tag binding");
            JsonNode rootNavigationCategory =
                    findByCode(navigation.json().path("data").path("tree"), "ACC-NAV-ROOT-" + suffix);
            assertEquals(
                    3,
                    rootNavigationCategory
                            .path("deletionAvailability")
                            .path("subtreeSize")
                            .asInt(),
                    "BUSINESS: category navigation counts every descendant, not only the direct child level");
        } else {
            Response filtered = context.get(
                    OPERATIONS_CATALOG_ITEMS,
                    "/api/operations/catalog-inventory/items?dataNodeRef="
                            + fixture.storeId()
                            + "&tagRef="
                            + selectedTag.path("entryRef").asText()
                            + "&pageSize=20",
                    session.cookie(),
                    Set.of(200));
            JsonNode expectedCategoryPath = host.mapper.valueToTree(List.of(
                    catalogCategoryFact(
                            categoryRoot.path("result").path("categoryRef").asText(),
                            categoryRoot.path("result").path("code").asText(),
                            categoryRoot.path("result").path("name").asText()),
                    catalogCategoryFact(
                            categoryBranch.path("result").path("categoryRef").asText(),
                            categoryBranch.path("result").path("code").asText(),
                            categoryBranch.path("result").path("name").asText())));
            assertCatalogOperationOracle(
                    filtered.json(),
                    "getOperationsCatalogItems",
                    "/data/items/0/categoryPath",
                    expectedCategoryPath,
                    "BUSINESS: item list returns the exact ordered category path");
            assertCatalogOperationOracle(
                    filtered.json(),
                    "getOperationsCatalogItems",
                    "/data/items/0/tags",
                    host.mapper.valueToTree(List.of(
                            catalogTagFact(
                                    selectedTag.path("entryRef").asText(),
                                    selectedTag.path("code").asText(),
                                    selectedTag.path("name").asText()),
                            catalogTagFact(
                                    laterTag.path("entryRef").asText(),
                                    laterTag.path("code").asText(),
                                    laterTag.path("name").asText()))),
                    "BUSINESS: item list returns exact ordered tag facts");
            assertCatalogAbsent(
                    filtered.json(),
                    "/data/items/0/categoryPathLabels",
                    "BUSINESS: item list does not retain the retired category-label field");
            Response itemDetail = context.get(
                    OPERATIONS_CATALOG_ITEM_READ,
                    itemPath(taggedItemCode) + "?dataNodeRef=" + fixture.storeId(),
                    session.cookie(),
                    Set.of(200));
            assertCatalogOperationOracle(
                    itemDetail.json(),
                    "getOperationsCatalogItem",
                    "/data/item/categoryPath",
                    expectedCategoryPath,
                    "BUSINESS: item detail returns the same exact ordered category path");
            assertCatalogOperationOracle(
                    itemDetail.json(),
                    "getOperationsCatalogItem",
                    "/data/references",
                    host.mapper.createArrayNode(),
                    "BUSINESS: item detail returns an exact empty reference collection for this fixture");
            assertCatalogAbsent(
                    itemDetail.json(),
                    "/data/item/categoryPathLabels",
                    "BUSINESS: item detail does not retain the retired category-label field");
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
            assertEquals(
                    List.of(
                            selectedTag.path("name").asText(),
                            laterTag.path("name").asText()),
                    array(filtered.json().path("data").path("items").get(0).path("tags")).stream()
                            .map(tag -> tag.path("name").asText())
                            .toList(),
                    "BUSINESS: item page projects catalog-tag business labels in dictionary display order,"
                            + " not submitted ref order");
            Response productionFiltered = context.get(
                    OPERATIONS_CATALOG_ITEMS,
                    "/api/operations/catalog-inventory/items?dataNodeRef="
                            + fixture.storeId()
                            + "&productionTagRef="
                            + selectedProductionTagRef
                            + "&pageSize=20",
                    session.cookie(),
                    Set.of(200));
            List<JsonNode> productionRows =
                    array(productionFiltered.json().path("data").path("items"));
            assertEquals(
                    1,
                    productionFiltered.json().path("data").path("total").asInt(),
                    "BUSINESS: production-tag filter total is the matching parent product count");
            assertEquals(
                    List.of(taggedItemCode),
                    productionRows.stream()
                            .map(item -> item.path("code").asText())
                            .toList(),
                    "BUSINESS: production-tag filter returns the parent product once and excludes unrelated products");
            assertEquals(
                    List.of(
                            selectedTag.path("name").asText(),
                            laterTag.path("name").asText()),
                    array(productionRows.getFirst().path("tags")).stream()
                            .map(tag -> tag.path("name").asText())
                            .toList(),
                    "BUSINESS: production-tag filtering remains independent while the parent row retains "
                            + "its catalog-tag business labels");
            assertEquals(
                    ("Selected production tag " + suffix),
                    productionRows
                            .getFirst()
                            .path("preparationFacts")
                            .path("productionTag")
                            .path("name")
                            .asText(),
                    "BUSINESS: parent row projects the bound production tag business name rather than a "
                            + "generic configured marker");
            assertTrue(
                    taggedWithProductionTagVersion > taggedItemVersion,
                    "BUSINESS: production-tag binding is versioned by the catalog owner");
            assertTrue(
                    taggedWithCategoryVersion > taggedWithProductionTagVersion,
                    "BUSINESS: category binding is versioned by the catalog owner");
            Response disabledProductionFiltered = context.get(
                    OPERATIONS_CATALOG_ITEMS,
                    "/api/operations/catalog-inventory/items?dataNodeRef="
                            + fixture.storeId()
                            + "&productionTagRef="
                            + disabledProductionTagRef
                            + "&pageSize=20",
                    session.cookie(),
                    Set.of(200));
            assertEquals(
                    List.of(disabledTaggedItemCode),
                    array(disabledProductionFiltered.json().path("data").path("items")).stream()
                            .map(item -> item.path("code").asText())
                            .toList(),
                    "BUSINESS: a disabled production tag remains a valid filter for its existing product binding");
        }
    }

    @AcceptanceScenario(
            id = "catalog.item-sku-page-contract",
            module = "CATALOG",
            operation = "getOperationsCatalogItemSkus")
    void itemSkuPageContract(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        JsonNode size = createDictionaryEntry(
                context, fixture, session, "SKU_ATTRIBUTE", "ACC-PAGE-SIZE-" + suffix, "Page size");
        JsonNode temperature = createDictionaryEntry(
                context, fixture, session, "SKU_ATTRIBUTE", "ACC-PAGE-TEMP-" + suffix, "Page temperature");
        JsonNode small = createDictionaryEntry(
                context,
                fixture,
                session,
                "SKU_ATTRIBUTE_VALUE",
                "ACC-PAGE-SMALL-" + suffix,
                "Small",
                size.path("entryRef").asText());
        JsonNode large = createDictionaryEntry(
                context,
                fixture,
                session,
                "SKU_ATTRIBUTE_VALUE",
                "ACC-PAGE-LARGE-" + suffix,
                "Large",
                size.path("entryRef").asText());
        JsonNode hot = createDictionaryEntry(
                context,
                fixture,
                session,
                "SKU_ATTRIBUTE_VALUE",
                "ACC-PAGE-HOT-" + suffix,
                "Hot",
                temperature.path("entryRef").asText());
        JsonNode cold = createDictionaryEntry(
                context,
                fixture,
                session,
                "SKU_ATTRIBUTE_VALUE",
                "ACC-PAGE-COLD-" + suffix,
                "Cold",
                temperature.path("entryRef").asText());
        String itemCode = "ACC-SKU-PAGE-" + suffix;
        Response created = context.post(
                OPERATIONS_CATALOG_ITEM_CREATE,
                "/api/operations/catalog-inventory/items",
                session.cookie(),
                itemCreateBody(
                        fixture.storeId().toString(),
                        itemCode,
                        "SKU page fixture " + suffix,
                        "SKU_VARIANT_SALE_COUNTED",
                        null),
                Set.of(200));
        String unitRef = createAcceptanceUnit(context, fixture, session, "ACC-PAGE-UNIT-" + suffix)
                .path("result")
                .path("unit")
                .path("unitRef")
                .asText();
        String productionTagRef = createProductionTag(
                context, fixture, session, "ACC-PAGE-PRODUCTION-TAG-" + suffix, "Page production tag " + suffix);
        context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(itemCode),
                session.cookie(),
                matrixSaveBody(
                        fixture,
                        itemCode,
                        created.json().path("result").path("version").asLong(),
                        size,
                        temperature,
                        small,
                        large,
                        hot,
                        cold,
                        unitRef,
                        productionTagRef),
                Set.of(200));

        JsonNode savedDetail = context.get(
                        OPERATIONS_CATALOG_ITEM_READ,
                        "/api/operations/catalog-inventory/items/" + itemCode + "?dataNodeRef=" + fixture.storeId(),
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("data")
                .path("item");
        Map<String, JsonNode> savedSkuFactsByRef = new LinkedHashMap<>();
        array(savedDetail.path("skus"))
                .forEach(sku -> savedSkuFactsByRef.put(sku.path("productSkuRef").asText(), sku));

        String basePath = "/api/operations/catalog-inventory/items/" + itemCode + "/skus?dataNodeRef="
                + fixture.storeId() + "&pageSize=3";
        JsonNode beforeParentList = context.get(
                        OPERATIONS_CATALOG_ITEMS,
                        "/api/operations/catalog-inventory/items?dataNodeRef=" + fixture.storeId() + "&pageSize=100",
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("data");
        JsonNode skuManagedParent = array(beforeParentList.path("items")).stream()
                .filter(row -> itemCode.equals(row.path("code").asText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("BUSINESS: SKU-managed parent remains present in the item list"));
        JsonNode skuManagedParentInventory = skuManagedParent.path("inventoryDeductionSummary");
        assertEquals(
                "SKU",
                skuManagedParentInventory.path("grain").asText(),
                "BUSINESS: a SKU-managed parent tells the user that inventory is configured by specification");
        assertTrue(
                skuManagedParentInventory.path("mode").isNull()
                        && skuManagedParentInventory
                                .path("consumptionUnitSnapshot")
                                .isNull()
                        && skuManagedParentInventory.path("bomLineCount").isNull(),
                "BUSINESS: the parent list never presents its edit-only ITEM/NONE zero state as an inventory mode;"
                        + " each SKU owns its deduction setting");
        Response firstSkuPageResponse =
                context.get(OPERATIONS_CATALOG_ITEM_SKUS, basePath, session.cookie(), Set.of(200));
        JsonNode firstSkuPageJson = firstSkuPageResponse.json();
        JsonNode firstData = firstSkuPageJson.path("data");
        assertEquals(4, firstData.path("total").asInt(), "BUSINESS: SKU task read reports the complete parent total");
        assertEquals(3, firstData.path("items").size(), "BUSINESS: SKU task read respects the requested page size");
        assertTrue(firstData.path("cursor").isNull(), "BUSINESS: the first SKU page has no echoed cursor");
        String nextCursor = firstData.path("nextCursor").asText();
        assertFalse(nextCursor.isBlank(), "BUSINESS: the first SKU page exposes a continuation cursor");
        Set<String> firstRefs = new LinkedHashSet<>();
        firstData.path("items").forEach(row -> {
            assertFalse(row.path("productSkuRef").asText().isBlank(), "BUSINESS: SKU page exposes stable SKU identity");
            assertFalse(row.path("skuCode").asText().isBlank(), "BUSINESS: SKU page exposes the business SKU code");
            assertTrue(row.path("attributeValueRefs").isArray(), "BUSINESS: SKU page exposes specification values");
            JsonNode detailSkuFacts =
                    savedSkuFactsByRef.get(row.path("productSkuRef").asText());
            assertTrue(detailSkuFacts != null, "BUSINESS: SKU page row resolves to the same owner SKU fact");
            assertEquals(
                    detailSkuFacts.path("attributeValueRefs"),
                    row.path("attributeValueRefs"),
                    "BUSINESS: SKU page preserves the exact owner specification facts, including the business label, "
                            + "status and display order");
            assertTrue(row.path("attributeFacts").isArray(), "BUSINESS: SKU page exposes structured attribute facts");
            assertEquals(
                    row.path("attributeValueRefs"),
                    row.path("attributeFacts"),
                    "BUSINESS: SKU page preserves structured specification facts exactly");
            assertEquals(
                    "Page production tag " + suffix,
                    row.path("preparationFacts")
                            .path("productionTag")
                            .path("name")
                            .asText(),
                    "BUSINESS: SKU page projects the bound production tag business name as a typed fact");
            assertTrue(
                    row.path("inventoryDeductionSummary").isObject(), "BUSINESS: SKU page exposes inventory summary");
            assertEquals(
                    "NONE",
                    row.path("inventoryDeductionSummary").path("mode").asText(),
                    "BUSINESS: a concrete SKU with no deduction rule is explicitly shown as "
                            + "not participating in inventory; "
                            + "only the SKU-managed parent summary uses a null mode");
            assertTrue(
                    firstRefs.add(row.path("productSkuRef").asText()),
                    "BUSINESS: first SKU page has no duplicate identity");
        });
        for (int index = 0; index < firstData.path("items").size(); index++) {
            JsonNode row = firstData.path("items").get(index);
            JsonNode detailSkuFacts =
                    savedSkuFactsByRef.get(row.path("productSkuRef").asText());
            assertCatalogOperationOracle(
                    firstSkuPageJson,
                    "getOperationsCatalogItemSkus",
                    "/data/items/" + index + "/attributeFacts",
                    detailSkuFacts.path("attributeValueRefs"),
                    "BUSINESS: SKU page returns the exact ordered typed attribute facts from the owner readback");
        }
        assertCatalogSkuItemsOracle(
                firstSkuPageJson,
                "getOperationsCatalogItemSkus",
                savedSkuFactsByRef,
                3,
                "Page production tag " + suffix,
                "BUSINESS: SKU page returns the complete ordered structured item projection");

        Response secondSkuPageResponse = context.get(
                OPERATIONS_CATALOG_ITEM_SKUS,
                basePath + "&cursor=" + java.net.URLEncoder.encode(nextCursor, java.nio.charset.StandardCharsets.UTF_8),
                session.cookie(),
                Set.of(200));
        JsonNode secondSkuPageJson = secondSkuPageResponse.json();
        JsonNode secondData = secondSkuPageJson.path("data");
        assertEquals(
                nextCursor,
                secondData.path("cursor").asText(),
                "BUSINESS: SKU page echoes the exact continuation cursor");
        assertEquals(
                4,
                secondData.path("total").asInt(),
                "BUSINESS: continuation SKU page keeps the complete parent total rather than the remaining rows");
        assertEquals(1, secondData.path("items").size(), "BUSINESS: second SKU page contains the remaining SKU");
        secondData.path("items").forEach(row -> {
            assertTrue(firstRefs.add(row.path("productSkuRef").asText()), "BUSINESS: SKU pages do not overlap");
            assertTrue(
                    row.path("attributeValueRefs").isArray(),
                    "BUSINESS: the second page keeps the SKU specification shape");
            assertEquals(
                    row.path("attributeValueRefs"),
                    row.path("attributeFacts"),
                    "BUSINESS: every SKU page keeps the structured specification facts");
        });
        JsonNode secondSku = secondData.path("items").get(0);
        assertCatalogOperationOracle(
                secondSkuPageJson,
                "getOperationsCatalogItemSkus",
                "/data/items/0/attributeFacts",
                savedSkuFactsByRef.get(secondSku.path("productSkuRef").asText()).path("attributeValueRefs"),
                "BUSINESS: continuation SKU page returns the exact ordered typed attribute facts");
        assertEquals(4, firstRefs.size(), "BUSINESS: SKU pages have no omission");
        assertTrue(secondData.path("nextCursor").isNull(), "BUSINESS: the final SKU page has no further cursor");
        int afterSkuPageTotal = context.get(
                        OPERATIONS_CATALOG_ITEMS,
                        "/api/operations/catalog-inventory/items?dataNodeRef=" + fixture.storeId() + "&pageSize=100",
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("data")
                .path("total")
                .asInt();
        assertEquals(
                beforeParentList.path("total").asInt(),
                afterSkuPageTotal,
                "BUSINESS: SKU task read does not change the parent item total");

        String noSkuCode = "ACC-NO-SKU-PAGE-" + suffix;
        createItem(context, fixture, session, noSkuCode, "No SKU page fixture " + suffix);
        JsonNode noSkuData = context.get(
                        OPERATIONS_CATALOG_ITEM_SKUS,
                        "/api/operations/catalog-inventory/items/" + noSkuCode + "/skus?dataNodeRef="
                                + fixture.storeId() + "&pageSize=2",
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("data");
        assertEquals(0, noSkuData.path("total").asInt(), "BUSINESS: a product without SKU has an empty SKU result");
        assertTrue(
                noSkuData.path("items").isArray() && noSkuData.path("items").isEmpty(),
                "BUSINESS: no-SKU read returns no synthetic child");
        assertTrue(noSkuData.path("nextCursor").isNull(), "BUSINESS: no-SKU read has no continuation cursor");

        Fixture sibling = host.siblingStoreFixtureSameBrand(fixture, Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, sibling);
        Session siblingSession = host.login(context, sibling);
        Response scopeRejected =
                context.get(OPERATIONS_CATALOG_ITEM_SKUS, basePath, siblingSession.cookie(), Set.of(403));
        assertEquals(
                "SCOPE_FORBIDDEN", scopeRejected.problemCode(), "BUSINESS: SKU task read cannot cross the store scope");
        int beforeParentTotal = beforeParentList.path("total").asInt();
        int afterParentTotal = context.get(
                        OPERATIONS_CATALOG_ITEMS,
                        "/api/operations/catalog-inventory/items?dataNodeRef=" + fixture.storeId() + "&pageSize=100",
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("data")
                .path("total")
                .asInt();
        assertEquals(
                beforeParentTotal + 1,
                afterParentTotal,
                "BUSINESS: SKU page read does not create or duplicate parent rows");
    }

    @AcceptanceScenario(
            id = "catalog.category-candidate-hierarchy",
            module = "CATALOG",
            operation = "getOperationsCatalogCategoryCandidates")
    void categoryCandidateHierarchy(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        // spotless:off
        JsonNode root = createAcceptanceCategory(
                context,
                fixture,
                session,
                "ACC-CAND-ROOT-" + suffix,
                "候选根分类",
                null);
        JsonNode siblingOne = createAcceptanceCategory(
                context,
                fixture,
                session,
                "ACC-CAND-SIBLING-1-" + suffix,
                "候选同级一",
                null);
        JsonNode siblingTwo = createAcceptanceCategory(
                context,
                fixture,
                session,
                "ACC-CAND-SIBLING-2-" + suffix,
                "候选同级二",
                null);
        // spotless:on
        JsonNode branch = createAcceptanceCategory(
                context,
                fixture,
                session,
                "ACC-CAND-BRANCH-" + suffix,
                "候选中间分类",
                root.path("result").path("categoryRef").asText());
        JsonNode leaf = createAcceptanceCategory(
                context,
                fixture,
                session,
                "ACC-CAND-LEAF-" + suffix,
                "候选叶分类",
                branch.path("result").path("categoryRef").asText());
        String moveRootCode = "ACC-CAND-MOVE-ROOT-" + suffix;
        JsonNode moveRoot = createAcceptanceCategory(context, fixture, session, moveRootCode, "移动根分类", null);
        JsonNode moveChild = createAcceptanceCategory(
                context,
                fixture,
                session,
                "ACC-CAND-MOVE-CHILD-" + suffix,
                "移动子分类",
                moveRoot.path("result").path("categoryRef").asText());
        String basePath = "/api/operations/catalog-inventory/category-candidates?dataNodeRef=" + fixture.storeId()
                + "&usage=ITEM_ASSIGNMENT&pageSize=2";
        JsonNode firstData = context.get(
                        OPERATIONS_CATALOG_CATEGORY_CANDIDATES, basePath, session.cookie(), Set.of(200))
                .json()
                .path("data");
        assertTrue(
                firstData.path("total").asInt() >= 3, "BUSINESS: category candidate total includes all root siblings");
        assertEquals(2, firstData.path("items").size(), "BUSINESS: category candidates respect page size");
        Set<String> observed = new LinkedHashSet<>();
        firstData.path("items").forEach(row -> {
            assertTrue(row.path("parentCategoryRef").isNull(), "BUSINESS: first candidate page is the root level");
            assertTrue(
                    row.path("selectable").asBoolean(), "BUSINESS: normal item-assignment candidates are selectable");
            assertTrue(row.path("disabledReason").isNull(), "BUSINESS: selectable candidates have no disabled reason");
            assertTrue(
                    observed.add(row.path("categoryRef").asText()), "BUSINESS: first category page has no duplicate");
        });
        String nextCursor = firstData.path("nextCursor").asText();
        assertFalse(nextCursor.isBlank(), "BUSINESS: category candidate page exposes a continuation cursor");
        JsonNode secondData = context.get(
                        OPERATIONS_CATALOG_CATEGORY_CANDIDATES,
                        basePath + "&cursor="
                                + java.net.URLEncoder.encode(nextCursor, java.nio.charset.StandardCharsets.UTF_8),
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("data");
        assertEquals(nextCursor, secondData.path("cursor").asText(), "BUSINESS: category candidates echo the cursor");
        assertEquals(
                firstData.path("total").asInt(),
                secondData.path("total").asInt(),
                "BUSINESS: continuation category page keeps the complete matching total "
                        + "rather than the remaining rows");
        secondData
                .path("items")
                .forEach(row -> assertTrue(
                        observed.add(row.path("categoryRef").asText()), "BUSINESS: category pages do not overlap"));
        assertEquals(firstData.path("total").asInt(), observed.size(), "BUSINESS: category pages have no omission");

        String rootCode = "ACC-CAND-ROOT-" + suffix;
        String branchCode = "ACC-CAND-BRANCH-" + suffix;
        String leafCode = "ACC-CAND-LEAF-" + suffix;
        JsonNode searched = context.get(
                        OPERATIONS_CATALOG_CATEGORY_CANDIDATES,
                        "/api/operations/catalog-inventory/category-candidates?dataNodeRef=" + fixture.storeId()
                                + "&usage=ITEM_ASSIGNMENT&keyword="
                                + java.net.URLEncoder.encode(leafCode, java.nio.charset.StandardCharsets.UTF_8)
                                + "&pageSize=20",
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("data");
        JsonNode leafRow = array(searched.path("items")).stream()
                .filter(row -> leafCode.equals(row.path("code").asText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("BUSINESS: category search returns the matching leaf"));
        assertTrue(
                leafRow.path("path").isArray() && leafRow.path("path").size() >= 3,
                "BUSINESS: category search returns the complete ancestor path");
        assertEquals(rootCode, leafRow.path("path").get(0).path("code").asText(), "BUSINESS: path starts at the root");
        assertEquals(
                branchCode,
                leafRow.path("path").get(1).path("code").asText(),
                "BUSINESS: path contains the intermediate category");

        JsonNode createCandidates = context.get(
                        OPERATIONS_CATALOG_CATEGORY_CANDIDATES,
                        "/api/operations/catalog-inventory/category-candidates?dataNodeRef=" + fixture.storeId()
                                + "&usage=CATEGORY_CREATE&keyword="
                                + java.net.URLEncoder.encode(leafCode, java.nio.charset.StandardCharsets.UTF_8)
                                + "&pageSize=20",
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("data");
        JsonNode createLeaf = array(createCandidates.path("items")).stream()
                .filter(row -> leafCode.equals(row.path("code").asText()))
                .findFirst()
                .orElseThrow(() ->
                        new AssertionError("BUSINESS: create candidates return the matching third-level category"));
        assertFalse(createLeaf.path("selectable").asBoolean(), "BUSINESS: third-level category cannot accept a child");
        assertEquals(
                "商品分类最多只能建立三级",
                createLeaf.path("disabledReason").asText(),
                "BUSINESS: create candidates explain the three-level category limit in business language");

        String rejectedFourthLevelCode = "ACC-CAND-FOURTH-" + suffix;
        Response fourthLevelRejected = context.post(
                OPERATIONS_CATALOG_CATEGORY_CREATE,
                "/api/operations/catalog-inventory/categories",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "code",
                        rejectedFourthLevelCode,
                        "name",
                        "不应创建的第四级",
                        "parentCategoryRef",
                        leaf.path("result").path("categoryRef").asText()),
                Set.of(422));
        assertEquals(
                "CATEGORY_DEPTH_EXCEEDED",
                fourthLevelRejected.problemCode(),
                "BUSINESS: owner rejects a fourth category level rather than accepting a UI-only limit");
        JsonNode noFourthLevel = context.get(
                        OPERATIONS_CATALOG_CATEGORY_CANDIDATES,
                        "/api/operations/catalog-inventory/category-candidates?dataNodeRef=" + fixture.storeId()
                                + "&usage=ITEM_ASSIGNMENT&keyword="
                                + java.net.URLEncoder.encode(
                                        rejectedFourthLevelCode, java.nio.charset.StandardCharsets.UTF_8)
                                + "&pageSize=20",
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("data");
        assertTrue(
                array(noFourthLevel.path("items")).stream()
                        .noneMatch(row ->
                                rejectedFourthLevelCode.equals(row.path("code").asText())),
                "BUSINESS: rejected fourth level leaves no category fact behind");

        String rootRef = root.path("result").path("categoryRef").asText();
        JsonNode reparent = context.get(
                        OPERATIONS_CATALOG_CATEGORY_CANDIDATES,
                        "/api/operations/catalog-inventory/category-candidates?dataNodeRef=" + fixture.storeId()
                                + "&usage=CATEGORY_REPARENT&currentCategoryRef=" + rootRef
                                + "&keyword="
                                + java.net.URLEncoder.encode(leafCode, java.nio.charset.StandardCharsets.UTF_8)
                                + "&pageSize=20",
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("data");
        assertTrue(
                array(reparent.path("items")).stream()
                        .filter(row -> rootRef.equals(row.path("categoryRef").asText()))
                        .allMatch(row -> !row.path("selectable").asBoolean()
                                && "不能选择当前分类或其下级分类"
                                        .equals(row.path("disabledReason").asText())),
                "BUSINESS: reparent candidates disable the current category");
        assertTrue(
                array(reparent.path("items")).stream()
                        .filter(row -> branch.path("result")
                                .path("categoryRef")
                                .asText()
                                .equals(row.path("categoryRef").asText()))
                        .allMatch(row -> !row.path("selectable").asBoolean()
                                && !row.path("disabledReason").asText().isBlank()),
                "BUSINESS: reparent candidates disable descendants with a reason");

        String moveRootRef = moveRoot.path("result").path("categoryRef").asText();
        JsonNode tooDeepReparentCandidates = context.get(
                        OPERATIONS_CATALOG_CATEGORY_CANDIDATES,
                        "/api/operations/catalog-inventory/category-candidates?dataNodeRef=" + fixture.storeId()
                                + "&usage=CATEGORY_REPARENT&currentCategoryRef=" + moveRootRef
                                + "&keyword="
                                + java.net.URLEncoder.encode(leafCode, java.nio.charset.StandardCharsets.UTF_8)
                                + "&pageSize=20",
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("data");
        JsonNode tooDeepTarget = array(tooDeepReparentCandidates.path("items")).stream()
                .filter(row -> leafCode.equals(row.path("code").asText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("BUSINESS: reparent candidates return the third-level target"));
        assertFalse(
                tooDeepTarget.path("selectable").asBoolean(),
                "BUSINESS: a subtree cannot move under a third-level category"
                        + " when it would exceed the three-level limit");
        assertEquals(
                "移动后分类不能超过三级",
                tooDeepTarget.path("disabledReason").asText(),
                "BUSINESS: reparent candidates explain the category depth limit in business language");
        Response tooDeepMoveRejected = context.post(
                new BackendAcceptanceTest.RouteIdentity(
                        "moveOperationsCatalogCategory",
                        "/api/operations/catalog-inventory/categories/{categoryRef}/move"),
                "/api/operations/catalog-inventory/categories/" + moveRootRef + "/move",
                session.cookie(),
                Map.of(
                        "dataNodeRef", fixture.storeId().toString(),
                        "categoryRef", moveRootRef,
                        "expectedVersion",
                                moveRoot.path("result").path("version").asLong(),
                        "action", "REPARENT",
                        "parentCategoryRef",
                                leaf.path("result").path("categoryRef").asText()),
                Set.of(422));
        assertEquals(
                "CATEGORY_DEPTH_EXCEEDED",
                tooDeepMoveRejected.problemCode(),
                "BUSINESS: owner rejects a move that would create fourth- and fifth-level categories");
        JsonNode retainedMoveChild = context.get(
                        OPERATIONS_CATALOG_CATEGORY_CANDIDATES,
                        "/api/operations/catalog-inventory/category-candidates?dataNodeRef=" + fixture.storeId()
                                + "&usage=ITEM_ASSIGNMENT&keyword="
                                + java.net.URLEncoder.encode(
                                        "ACC-CAND-MOVE-CHILD-" + suffix, java.nio.charset.StandardCharsets.UTF_8)
                                + "&pageSize=20",
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("data");
        JsonNode moveChildRow = array(retainedMoveChild.path("items")).stream()
                .filter(row -> ("ACC-CAND-MOVE-CHILD-" + suffix)
                        .equals(row.path("code").asText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("BUSINESS: rejected reparent retains the original child fact"));
        assertEquals(
                moveRootRef,
                moveChildRow.path("parentCategoryRef").asText(),
                "BUSINESS: rejected reparent leaves the subtree at its original parent");
        Fixture sibling = host.siblingStoreFixtureSameBrand(fixture, Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, sibling);
        Session siblingSession = host.login(context, sibling);
        Response scopeRejected =
                context.get(OPERATIONS_CATALOG_CATEGORY_CANDIDATES, basePath, siblingSession.cookie(), Set.of(403));
        assertEquals(
                "SCOPE_FORBIDDEN",
                scopeRejected.problemCode(),
                "BUSINESS: category candidates cannot cross the store scope");
        assertFalse(
                siblingOne.path("result").path("categoryRef").asText().isBlank(),
                "BUSINESS: same-level category fixture is real");
        assertFalse(
                siblingTwo.path("result").path("categoryRef").asText().isBlank(),
                "BUSINESS: page overflow fixtures are real");
    }

    /** Preserves both SKU inventory-identity and removal guard subcases under one save operation. */
    @AcceptanceScenario(
            id = "catalog.sku-inventory-identity-and-removal",
            module = "CATALOG",
            operation = "saveOperationsCatalogItem")
    void skuInventoryIdentityAndRemoval(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        skuOwnInventoryRetirementSubcase(context);
        skuCodeChangeKeepsInventorySubcase(context);
    }

    /** Proves an SKU-owned inventory definition is retired with the SKU rather than blocking its removal. */
    private void skuOwnInventoryRetirementSubcase(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String code = "ACC-SKU-GUARD-" + UUID.randomUUID().toString().substring(0, 8);
        JsonNode bomComponent =
                createInventoryBackedMaterialItem(context, fixture, session, "sku-removal-component-" + code);
        String bomComponentTargetRef = inventoryTargetRef(bomComponent);
        long createdVersion = createSkuVariantItem(context, fixture, session, code, "inventory guarded SKU")
                .version();
        long savedVersion = saveSkuVariantDirect(context, fixture, session, code, createdVersion, null, "ACC-SKU-1");
        JsonNode before = readItem(context, fixture, session, code);
        JsonNode sku = before.path("skus").get(0);
        String skuRef = sku.path("productSkuRef").asText();
        String targetRef = inventoryRuleForSku(before, skuRef)
                .path("directConfiguration")
                .path("targetRef")
                .asText();
        assertTrue(
                skuRef.matches("[0-9a-f-]{36}")
                        && targetRef.matches("[0-9a-f-]{36}")
                        && sku.path("version").isIntegralNumber(),
                "BUSINESS: one real save creates linked SKU and inventory target facts; sku=" + sku);

        Map<String, Object> request = skuVoidRequest(before, savedVersion, skuRef);
        Response voided = context.patch(
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
                Set.of(200));
        assertEquals(
                "VOIDED",
                voided.json()
                        .path("result")
                        .path("skuTransitions")
                        .get(0)
                        .path("targetStatus")
                        .asText(),
                "BUSINESS: a SKU-owned inventory definition does not block SKU retirement; response=" + voided.raw());
        assertEquals(
                0,
                readItem(context, fixture, session, code).path("skus").size(),
                "BUSINESS: a voided SKU is removed from the active SKU readback");
        Response retiredTarget = context.get(
                OPERATIONS_INVENTORY_TARGET_READ,
                "/api/operations/catalog-inventory/inventory-targets/" + targetRef + "?dataNodeRef="
                        + fixture.storeId(),
                session.cookie(),
                Set.of(404));
        assertEquals(
                "NOT_FOUND",
                retiredTarget.problemCode(),
                "BUSINESS: a retired SKU target is not exposed as a current inventory object");

        String compositeBlockedCode =
                "ACC-SKU-COMPOSITE-" + UUID.randomUUID().toString().substring(0, 8);
        CreatedItem compositeBlocked =
                createSkuVariantItem(context, fixture, session, compositeBlockedCode, "catalog composite guarded SKU");
        long compositeVersion = saveSkuVariantDirect(
                context, fixture, session, compositeBlockedCode, compositeBlocked.version(), null, "ACC-SKU-COMPOSITE");
        JsonNode compositeSku = readItem(context, fixture, session, compositeBlockedCode)
                .path("skus")
                .get(0);
        String compositeSkuRef = compositeSku.path("productSkuRef").asText();
        JsonNode compositeBlockedReadback = readItem(context, fixture, session, compositeBlockedCode);
        Response enabledCompositeItem = context.post(
                OPERATIONS_CATALOG_ITEM_STATUS,
                itemPath(compositeBlockedCode) + "/status",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "itemCode",
                        compositeBlockedCode,
                        "expectedVersion",
                        compositeBlockedReadback.path("version").asLong(),
                        "targetStatus",
                        "ENABLED"),
                Set.of(200));
        assertEquals(
                "ENABLED",
                enabledCompositeItem.json().path("result").path("status").asText(),
                "BUSINESS: a newly referenced composite component is enabled before the relation is created");
        compositeVersion = readItem(context, fixture, session, compositeBlockedCode)
                .path("version")
                .asLong();
        String compositeOwnerCode =
                "ACC-SKU-COMPOSITE-OWNER-" + UUID.randomUUID().toString().substring(0, 8);
        CreatedItem compositeOwner = createItemWithShape(
                context,
                fixture,
                session,
                fixture.storeId().toString(),
                compositeOwnerCode,
                "catalog composite owner",
                Map.of(),
                Map.of(),
                "COMPOSITE");
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
        compositeSections.put("inventoryRules", Map.of("nodes", List.of()));
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
        JsonNode compositeOwnerReadback = readItem(context, fixture, session, compositeOwnerCode);
        assertFalse(
                compositeOwnerReadback.path("compositeGroups").isEmpty(),
                "BUSINESS: the composite owner readback contains the persisted package relation");
        assertEquals(
                compositeSkuRef,
                compositeOwnerReadback
                        .path("compositeGroups")
                        .get(0)
                        .path("components")
                        .get(0)
                        .path("productSkuRef")
                        .asText(),
                "BUSINESS: the persisted package relation points to the guarded SKU");
        assertSkuRemovalBlocked(
                context,
                fixture,
                session,
                compositeBlockedCode,
                compositeVersion,
                compositeSkuRef,
                "该规格已被套餐内容使用，暂不能作废");

        String bomBlockedCode = "ACC-SKU-BOM-" + UUID.randomUUID().toString().substring(0, 8);
        CreatedItem bomBlocked = createSkuVariantItem(context, fixture, session, bomBlockedCode, "BOM guarded SKU");
        long bomVersion = saveSkuVariantDirect(
                context, fixture, session, bomBlockedCode, bomBlocked.version(), null, "ACC-SKU-BOM");
        JsonNode bomSku =
                readItem(context, fixture, session, bomBlockedCode).path("skus").get(0);
        String bomSkuRef = bomSku.path("productSkuRef").asText();
        bomVersion =
                saveSkuBom(context, fixture, session, bomBlockedCode, bomVersion, bomSkuRef, bomComponentTargetRef);
        JsonNode bomBeforeVoid = readItem(context, fixture, session, bomBlockedCode);
        JsonNode bomRule = inventoryRuleForSku(bomBeforeVoid, bomSkuRef);
        assertEquals(
                "BOM", bomRule.path("mode").asText(), "BUSINESS: the SKU-owned BOM is active before SKU retirement");
        assertFalse(
                bomRule.path("bom").path("lines").isEmpty(),
                "BUSINESS: the SKU-owned BOM has a persisted component line before SKU retirement");
        Map<String, Object> bomVoidRequest = skuVoidRequest(bomBeforeVoid, bomVersion, bomSkuRef);
        Response bomVoided = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(bomBlockedCode),
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "itemCode",
                        bomBlockedCode,
                        "sections",
                        bomVoidRequest.get("sections"),
                        "skuTransitions",
                        bomVoidRequest.get("skuTransitions")),
                Set.of(200));
        assertEquals(
                "VOIDED",
                bomVoided
                        .json()
                        .path("result")
                        .path("skuTransitions")
                        .get(0)
                        .path("targetStatus")
                        .asText(),
                "BUSINESS: an SKU-owned BOM is retired in the same transaction as SKU retirement");
        JsonNode bomAfterVoid = readItem(context, fixture, session, bomBlockedCode);
        assertTrue(
                bomAfterVoid.path("skus").isEmpty(),
                "BUSINESS: the SKU with its own BOM is removed from active catalog readback");
        assertTrue(
                StreamSupport.stream(inventoryRuleNodes(bomAfterVoid).spliterator(), false)
                        .noneMatch(node -> bomSkuRef.equals(
                                node.path("owner").path("productSkuRef").asText())),
                "BUSINESS: the SKU-owned BOM is no longer exposed as a current inventory definition");
    }

    private void assertSkuRemovalBlocked(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            long expectedVersion,
            String skuRef,
            String expectedDetail)
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
        assertEquals(expectedDetail, detail, "BUSINESS: blocker gives the owner-approved business reason");
        assertFalse(detail.contains(skuRef), "BUSINESS: blocker never leaks the opaque SKU identity");
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
        sections.put("inventoryRules", Map.of("nodes", List.of()));
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
        String skuCode = item.path("skus").get(0).path("skuCode").asText();
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("expectedCatalogVersion", expectedVersion);
        sections.put("catalogDraft", itemDraft(context, fixture, session, itemCode));
        sections.put(
                "inventoryRules",
                Map.of(
                        "nodes",
                        List.of(bomInventoryRule(
                                "SKU",
                                item.path("itemRef").asText(),
                                skuRef,
                                itemCode,
                                skuCode,
                                null,
                                List.of(bomLine(targetRef, "POSITIVE", "1"))))));
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
    private void skuCodeChangeKeepsInventorySubcase(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String code = "ACC-SKU-RENAME-" + UUID.randomUUID().toString().substring(0, 8);
        long createdVersion = createSkuVariantItem(context, fixture, session, code, "renamed inventory SKU")
                .version();
        long savedVersion = saveSkuVariantDirect(context, fixture, session, code, createdVersion, null, "ACC-SKU-OLD");
        JsonNode before = readItem(context, fixture, session, code);
        String skuRef = before.path("skus").get(0).path("productSkuRef").asText();
        String targetRef = inventoryRuleForSku(before, skuRef)
                .path("directConfiguration")
                .path("targetRef")
                .asText();
        saveSkuVariantDirect(context, fixture, session, code, savedVersion, skuRef, "ACC-SKU-NEW");
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
        saveDirectItem(context, fixture, session, targetCode, targetVersion, "ACC-REF-TARGET-SKU");
        String targetRef = inventoryRuleNodes(readItem(context, fixture, session, targetCode))
                .get(0)
                .path("directConfiguration")
                .path("targetRef")
                .asText();

        String otherTargetCode = "ACC-REF-OTHER-TARGET-" + suffix;
        long otherTargetVersion = createItem(context, fixture, session, otherTargetCode, "other target");
        saveDirectItem(context, fixture, session, otherTargetCode, otherTargetVersion, "ACC-REF-OTHER-TARGET-SKU");
        String otherTargetRef = inventoryRuleNodes(readItem(context, fixture, session, otherTargetCode))
                .get(0)
                .path("directConfiguration")
                .path("targetRef")
                .asText();

        String sourceACode = "ACC-REF-SOURCE-A-" + suffix;
        CreatedItem sourceA = createSkuVariantItem(context, fixture, session, sourceACode, "reference source A");
        long sourceAVersion = saveSkuVariantDirect(
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
        CreatedItem sourceB = createSkuVariantItem(context, fixture, session, sourceBCode, "reference source B");
        long sourceBVersion = saveSkuVariantDirect(
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
        CreatedItem sourceC = createSkuVariantItem(context, fixture, session, sourceCCode, "reference source C");
        long sourceCVersion = saveSkuVariantDirect(
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
                createSkuVariantItem(context, fixture, session, distractorCode, "reference distractor");
        long distractorVersion = saveSkuVariantDirect(
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
        CreatedItem crossSource = createItemWithShape(
                context,
                crossScope,
                crossSession,
                crossScope.storeId().toString(),
                crossCode,
                "cross scope source",
                Map.of(),
                Map.of(),
                "SKU_VARIANT_SALE_COUNTED");
        saveSkuVariantDirect(
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
        String firstName = "inventory page first";
        String secondName = "inventory page second";
        long firstVersion = createItem(context, fixture, session, firstCode, firstName);
        saveDirectItem(context, fixture, session, firstCode, firstVersion, "ACC-PAGE-SKU-A");
        long secondVersion = createItem(context, fixture, session, secondCode, secondName);
        saveDirectItem(context, fixture, session, secondCode, secondVersion, "ACC-PAGE-SKU-B");
        JsonNode first = readItem(context, fixture, session, firstCode);
        JsonNode second = readItem(context, fixture, session, secondCode);
        String firstTargetRef = inventoryRuleNodes(first)
                .get(0)
                .path("directConfiguration")
                .path("targetRef")
                .asText();
        String secondTargetRef = inventoryRuleNodes(second)
                .get(0)
                .path("directConfiguration")
                .path("targetRef")
                .asText();
        assertTrue(
                firstTargetRef.matches("[0-9a-f-]{36}") && secondTargetRef.matches("[0-9a-f-]{36}"),
                "BUSINESS: fixture creates two typed inventory target identities");

        String pageQuery = "?dataNodeRef=" + fixture.storeId() + "&keyword=ACC-PAGE-" + suffix + "&pageSize=1";
        Response firstPage = context.get(
                OPERATIONS_INVENTORY_TARGETS,
                "/api/operations/catalog-inventory/inventory-targets" + pageQuery,
                session.cookie(),
                Set.of(200));
        assertCatalogOperationOracle(
                firstPage.json(),
                "getOperationsInventoryTargets",
                "/data/items/0/productName",
                host.mapper.valueToTree(firstName),
                "BUSINESS: inventory list returns the exact catalog-owned product name");
        assertCatalogOperationOracle(
                firstPage.json(),
                "getOperationsInventoryTargets",
                "/data/items/0/targetRef",
                host.mapper.valueToTree(firstTargetRef),
                "BUSINESS: inventory list returns the exact opaque target reference");
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
        Map<String, String> expectedNames = Map.of(firstCode, firstName, secondCode, secondName);
        for (JsonNode pageItem : List.of(
                firstPageData.path("items").get(0), secondPageData.path("items").get(0))) {
            String code = pageItem.path("productCode").asText();
            assertEquals(
                    expectedNames.get(code),
                    pageItem.path("productName").asText(),
                    "BUSINESS: inventory list projects the catalog-owned product name, not only its code");
        }

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
            assertCatalogOperationOracle(
                    detail.json(),
                    "getOperationsInventoryTarget",
                    "/target/targetRef",
                    host.mapper.valueToTree(targetRef),
                    "BUSINESS: inventory detail returns the exact opaque target reference");
            String productCode =
                    detail.json().path("target").path("productCode").asText();
            assertCatalogOperationOracle(
                    detail.json(),
                    "getOperationsInventoryTarget",
                    "/target/productName",
                    host.mapper.valueToTree(expectedNames.get(productCode)),
                    "BUSINESS: inventory detail returns the exact catalog-owned product name");
            assertCatalogOperationOracle(
                    detail.json(),
                    "getOperationsInventoryTarget",
                    "/changeSummary",
                    host.mapper.valueToTree(emptyInventoryChangeSummary()),
                    "BUSINESS: inventory detail returns the exact empty current-zone change summary");
            assertEquals(
                    expectedNames.get(productCode),
                    detail.json().path("target").path("productName").asText(),
                    "BUSINESS: inventory detail projects the catalog-owned product name, not only its code");
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
        JsonNode created = readItem(context, fixture, session, code);
        String unitRef = created.path("baseMeasureUnitRef").asText("");
        assertFalse(unitRef.isBlank(), "BUSINESS: current readback fixture obtains a catalog unit");
        // Preserve the pre-existing scenario fact: this lazy-zone readback path exercises a configured
        // counting unit. The separate no-counting-unit precision scenario covers the nullable branch.
        saveDirectItemWithUnits(context, fixture, session, code, createdVersion, unitRef, unitRef, unitRef, "1");
        JsonNode item = readItem(context, fixture, session, code);
        String targetRef = inventoryRuleNodes(item)
                .get(0)
                .path("directConfiguration")
                .path("targetRef")
                .asText();
        String path = "/api/operations/catalog-inventory/inventory-targets/" + targetRef;
        Response current = context.get(
                OPERATIONS_INVENTORY_TARGET_READ,
                path + "?dataNodeRef=" + fixture.storeId(),
                session.cookie(),
                Set.of(200));
        JsonNode currentJson = current.json();
        assertCatalogOperationOracle(
                currentJson,
                "getOperationsInventoryTarget",
                "/changeSummary",
                host.mapper.valueToTree(emptyInventoryChangeSummary()),
                "BUSINESS: current readback returns exact empty change windows before any mutation");
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
                OPERATIONS_INVENTORY_TARGET_CONFIGURATION,
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
        Map<String, Object> expectedConfiguration = new LinkedHashMap<>();
        expectedConfiguration.put("allowNegative", false);
        expectedConfiguration.put("lowStockThreshold", "0");
        expectedConfiguration.put("countingUnitSnapshot", currentJson.at("/configuration/countingUnitSnapshot"));
        expectedConfiguration.put("conversionFactor", "1");
        assertCatalogOperationOracle(
                updated.json(),
                "updateOperationsInventoryTargetConfiguration",
                "/configuration",
                host.mapper.valueToTree(expectedConfiguration),
                "BUSINESS: configuration readback returns exact typed unit and conversion facts");
        assertCatalogOperationOracle(
                updated.json(),
                "updateOperationsInventoryTargetConfiguration",
                "/changeSummary",
                host.mapper.valueToTree(emptyInventoryChangeSummary()),
                "BUSINESS: configuration readback returns exact unchanged change windows");
        assertTrue(
                updated.json().path("changeSummary").isObject()
                        && updated.json().path("references").isMissingNode()
                        && updated.json().path("ledger").isMissingNode(),
                "BUSINESS: configuration command readback follows the same lazy-zone contract");

        Response increased = context.post(
                OPERATIONS_INVENTORY_TARGET_INCREASE,
                path + "/increase",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "targetRef",
                        targetRef,
                        "expectedVersion",
                        updated.json().path("version").asLong(),
                        "quantity",
                        "1",
                        "countingUnitRef",
                        countingUnitRef,
                        "note",
                        "A-2 increase"),
                idempotencyHeaders("current-readback-increase"),
                Set.of(200));
        assertInventoryMutationOperationOracle(
                increased.json(),
                "increaseOperationsInventoryTarget",
                targetRef,
                "0",
                "1",
                "1",
                "OK",
                "BUSINESS: increase readback is an exact typed result");

        Response adjusted = context.post(
                OPERATIONS_INVENTORY_TARGET_ADJUST,
                path + "/adjust",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "targetRef",
                        targetRef,
                        "expectedVersion",
                        increased.json().path("version").asLong(),
                        "direction",
                        "DECREASE",
                        "quantity",
                        "1",
                        "countingUnitRef",
                        countingUnitRef,
                        "reasonCode",
                        "CORRECTION",
                        "note",
                        "A-2 adjust"),
                idempotencyHeaders("current-readback-adjust"),
                Set.of(200));
        assertInventoryMutationOperationOracle(
                adjusted.json(),
                "adjustOperationsInventoryTarget",
                targetRef,
                "1",
                "-1",
                "0",
                "OUT",
                "BUSINESS: adjust readback is an exact typed result");
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
        sourceVersion = saveDirectItem(context, fixture, session, sourceCode, sourceVersion, "LOCAL-SKU-" + suffix);
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
        String materialTargetRef = inventoryRuleNodes(material)
                .get(0)
                .path("directConfiguration")
                .path("targetRef")
                .asText();
        sourceVersion = saveOptionValueBom(
                context,
                fixture,
                session,
                sourceCode,
                sourceVersion,
                optionValue.path("valueRef").asText(),
                optionValue.path("code").asText(optionValue.path("name").asText()),
                materialTargetRef,
                "7");
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
        String packageSourceCode = "ACC-LOCAL-PACKAGE-SOURCE-" + suffix;
        long packageSourceVersion = createItemWithShape(
                        context,
                        fixture,
                        session,
                        fixture.storeId().toString(),
                        packageSourceCode,
                        "Local package source " + suffix,
                        Map.of(),
                        Map.of(),
                        "COMPOSITE")
                .version();
        Map<String, Object> packageDraft = itemDraft(context, fixture, session, packageSourceCode);
        Map<String, Object> packageGroup = new LinkedHashMap<>();
        packageGroup.put("groupCode", "LOCAL-PACKAGE");
        packageGroup.put("groupName", "Local package");
        packageGroup.put("selectionRule", "OPTIONAL");
        packageGroup.put("minSelections", 0);
        packageGroup.put("maxSelections", 1);
        packageGroup.put("components", List.of());
        packageDraft.put("compositeGroups", List.of(packageGroup));
        Map<String, Object> packageSections = new LinkedHashMap<>();
        packageSections.put("expectedCatalogVersion", packageSourceVersion);
        packageSections.put("catalogDraft", packageDraft);
        JsonNode packageWithInventoryFacts = readItem(context, fixture, session, packageSourceCode);
        List<Map<String, Object>> preservedInventoryRules = StreamSupport.stream(
                        inventoryRuleNodes(packageWithInventoryFacts).spliterator(), false)
                .map(CatalogAcceptanceScenarios::inventoryRuleDraftFromReadback)
                .toList();
        packageSections.put("inventoryRules", Map.of("nodes", preservedInventoryRules));
        Response sourceSaved = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(packageSourceCode),
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "itemCode",
                        packageSourceCode,
                        "sections",
                        packageSections),
                Set.of(200));
        packageSourceVersion = sourceSaved.json().path("version").asLong();
        assertTrue(
                packageSourceVersion > 0,
                "BUSINESS: the package source uses the COMPOSITE shape before PACKAGE_STRUCTURE copy");

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
            boolean packageSection = "PACKAGE_STRUCTURE".equals(section);
            String copySourceCode = packageSection ? packageSourceCode : sourceCode;
            long copySourceVersion = packageSection ? packageSourceVersion : sourceVersion;
            long targetVersion = packageSection
                    ? createItemWithShape(
                                    context,
                                    fixture,
                                    session,
                                    fixture.storeId().toString(),
                                    targetCode,
                                    "target package before " + section,
                                    Map.of(),
                                    Map.of(),
                                    "COMPOSITE")
                            .version()
                    : createItem(context, fixture, session, targetCode, "target before " + section);
            if ("OPTION_VALUE_BOM".equals(section)) {
                // An option-value BOM is an inventory owner only for an option value that the target
                // catalog item actually configures.  Establish that catalog prerequisite before
                // copying the inventory section; an orphan owner would be deliberately hidden by
                // the shape-derived detail readback.
                targetVersion = saveTypedItemFacts(
                        context,
                        fixture,
                        session,
                        targetCode,
                        targetVersion,
                        List.of(),
                        List.of(orderOptionConfig(
                                optionDefinition.path("definitionRef").asText(),
                                false,
                                null,
                                null,
                                List.of(optionOverride(
                                        optionValue.path("valueRef").asText(), true, null, 0L, List.of())))));
            }
            JsonNode result = localCopy(
                    context, fixture, session, copySourceCode, targetCode, copySourceVersion, targetVersion, section);
            JsonNode target = readItem(context, fixture, session, targetCode);
            switch (section) {
                case "BASIC_INFO" -> assertEquals(
                        "Local copy source " + suffix,
                        target.path("name").asText(),
                        "BUSINESS: BASIC_INFO copies the catalog column fact, not a nonexistent JSON key");
                case "SKU_STRUCTURE" -> assertTrue(
                        hasSkippedSourceAbsent(result, section),
                        "BUSINESS: ordinary product shape has no SKU structure to copy");
                case "ORDER_OPTIONS" -> {
                    JsonNode copiedConfig = target.path("orderOptionConfigs").get(0);
                    JsonNode copiedValue = copiedConfig.path("values").get(0);
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
                    assertFalse(
                            copiedValue.has("bom"),
                            "CONTRACT: local ORDER_OPTIONS copy keeps component usage in inventoryRules");
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
                    JsonNode copiedOptionBom = StreamSupport.stream(
                                    inventoryRuleNodes(target).spliterator(), false)
                            .filter(row -> optionValue
                                    .path("valueRef")
                                    .asText()
                                    .equals(row.path("owner")
                                            .path("optionValueRef")
                                            .asText()))
                            .findFirst()
                            .orElseThrow(() -> new AssertionError(
                                    "BUSINESS: OPTION_VALUE_BOM copies the persisted option-value inventory owner"));
                    assertEquals(
                            target.path("itemRef").asText(),
                            copiedOptionBom.path("owner").path("itemRef").asText(),
                            "BUSINESS: OPTION_VALUE_BOM belongs to the target product");
                    assertEquals(
                            "7",
                            copiedOptionBom
                                    .path("bom")
                                    .path("lines")
                                    .get(0)
                                    .path("quantity")
                                    .asText(),
                            "BUSINESS: copied option-value BOM preserves actual component quantity in inventory owner");
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
        assertFalse(
                closureValue.has("bom"),
                "CONTRACT: combined local copy keeps option component usage out of catalog option configuration");
        JsonNode optionBom = StreamSupport.stream(
                        inventoryRuleNodes(closureTarget).spliterator(), false)
                .filter(row -> optionValue
                        .path("valueRef")
                        .asText()
                        .equals(row.path("owner").path("optionValueRef").asText()))
                .findFirst()
                .orElseThrow(() ->
                        new AssertionError("BUSINESS: combined local copy creates the target option-value BOM owner"));
        assertEquals(
                closureTarget.path("itemRef").asText(),
                optionBom.path("owner").path("itemRef").asText(),
                "BUSINESS: copied option-value BOM belongs to the target product, not the source product");
        assertEquals(
                "7",
                optionBom.path("bom").path("lines").get(0).path("quantity").asText(),
                "BUSINESS: combined local copy preserves actual option component quantity in inventory owner");
        assertEquals(
                "OPTION_VALUE",
                optionBom.path("owner").path("ownerType").asText(),
                "BUSINESS: an opaque option-value BOM remains classified by its owner identity even when its display "
                        + "code is absent");
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
        JsonNode targetBeforePreflight = readItem(context, fixture, session, targetCode);
        assertEquals(
                targetVersion,
                targetBeforePreflight.path("version").asLong(),
                "BUSINESS: local-copy preflight begins from the requested target owner version for " + sections);
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
        JsonNode targetAfterExecute = readItem(context, fixture, session, targetCode);
        assertEquals(
                targetBeforePreflight.path("itemRef").asText(),
                targetAfterExecute.path("itemRef").asText(),
                "BUSINESS: local-copy execution keeps the target owner identity for " + sections);
        assertEquals(
                targetCode,
                targetAfterExecute.path("code").asText(),
                "BUSINESS: local-copy execution is read back from the requested target owner for " + sections);
        assertTrue(
                targetAfterExecute.path("version").asLong() >= targetVersion,
                "BUSINESS: local-copy execution either advances a copied owner fact or preserves a skipped target for "
                        + sections);
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

    private void assertAttributeDefinitionCreate(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        JsonNode created = createAttributeDefinition(
                context,
                fixture,
                session,
                "ACC-ATTRIBUTE-CREATE-" + suffix,
                "保质期",
                "MULTI_SELECT",
                List.of(Map.of("name", "三个月", "displayOrder", 0)));
        assertEquals(
                "ACC-ATTRIBUTE-CREATE-" + suffix,
                created.path("code").asText(),
                "BUSINESS: attribute create readback preserves its business code");
        assertEquals(
                1,
                created.path("options").size(),
                "BUSINESS: attribute create readback preserves its typed selection option");
    }

    @AcceptanceScenario(
            id = "catalog.attribute-definition-create",
            module = "CATALOG",
            operation = "createOperationsCatalogAttributeDefinition")
    void attributeDefinitionCreate(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        assertAttributeDefinitionCreate(context);
    }

    @AcceptanceScenario(
            id = "catalog.attribute-definition-update",
            module = "CATALOG",
            operation = "updateOperationsCatalogAttributeDefinition")
    void attributeDefinitionUpdate(BackendAcceptanceTest.ScenarioContext context) throws Exception {
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
        JsonNode ownerDefinition = definitionByRef(
                context.get(
                                OPERATIONS_CATALOG_ATTRIBUTE_DEFINITIONS,
                                "/api/operations/catalog-inventory/attribute-definitions?dataNodeRef="
                                        + fixture.storeId(),
                                session.cookie(),
                                Set.of(200))
                        .json()
                        .path("data")
                        .path("definitions"),
                ref,
                "updated attribute definition");
        assertEquals(
                "ACC-EXPIRY-RENAMED-" + suffix,
                ownerDefinition.path("code").asText(),
                "BUSINESS: attribute update is read back from the owner dictionary, not only its receipt");
        assertEquals(
                definition.path("version").asLong(),
                ownerDefinition.path("version").asLong(),
                "BUSINESS: attribute owner dictionary exposes the updated version");
    }

    @AcceptanceScenario(
            id = "catalog.attribute-definition-delete-cascade",
            module = "CATALOG",
            operation = "transitionOperationsCatalogAttributeDefinitionStatus")
    void attributeDefinitionDeleteCascade(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        JsonNode definition = createAttributeDefinition(
                context,
                fixture,
                session,
                "ACC-DELETE-ATTR-" + suffix,
                "保存说明",
                "MULTI_SELECT",
                List.of(Map.of("name", "半年", "displayOrder", 1), Map.of("name", "三个月", "displayOrder", 0)));
        String firstCode = "ACC-DELETE-ATTR-A-" + suffix;
        String secondCode = "ACC-DELETE-ATTR-B-" + suffix;
        long firstVersion = createItem(context, fixture, session, firstCode, "attribute cascade one");
        long secondVersion = createItem(context, fixture, session, secondCode, "attribute cascade two");
        Map<String, Object> assignment = new LinkedHashMap<>();
        assignment.put("definitionRef", definition.path("definitionRef").asText());
        assignment.put("textValue", null);
        assignment.put(
                "optionRefs",
                List.of(
                        definition.path("options").get(0).path("optionRef").asText(),
                        definition.path("options").get(1).path("optionRef").asText()));
        saveTypedItemFacts(context, fixture, session, firstCode, firstVersion, List.of(assignment), List.of());
        saveTypedItemFacts(context, fixture, session, secondCode, secondVersion, List.of(assignment), List.of());
        JsonNode listedFirst = array(context.get(
                                OPERATIONS_CATALOG_ITEMS,
                                "/api/operations/catalog-inventory/items?dataNodeRef=" + fixture.storeId()
                                        + "&pageSize=100",
                                session.cookie(),
                                Set.of(200))
                        .json()
                        .path("data")
                        .path("items"))
                .stream()
                .filter(item -> firstCode.equals(item.path("code").asText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("BUSINESS: item page returns the saved attribute fixture"));
        JsonNode listedAttributeFact = array(listedFirst.path("attributeFacts")).stream()
                .filter(fact -> definition
                        .path("definitionRef")
                        .asText()
                        .equals(fact.path("definitionRef").asText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("BUSINESS: item page returns the saved attribute fact"));
        assertEquals(
                Set.of(
                        definition.path("options").get(0).path("optionRef").asText(),
                        definition.path("options").get(1).path("optionRef").asText()),
                new LinkedHashSet<>(array(listedAttributeFact.path("optionRefs")).stream()
                        .map(JsonNode::asText)
                        .toList()),
                "BUSINESS: item page returns selected attribute references as structured facts");
        Response blocked = context.post(
                OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION_STATUS,
                "/api/operations/catalog-inventory/attribute-definitions/"
                        + definition.path("definitionRef").asText()
                        + "/status",
                session.cookie(),
                Map.of(
                        "dataNodeRef", fixture.storeId().toString(),
                        "definitionRef", definition.path("definitionRef").asText(),
                        "expectedVersion", definition.path("version").asLong(),
                        "targetStatus", "VOIDED"),
                Set.of(422));
        assertEquals(
                "REFERENCE_BLOCKS_VOID",
                blocked.problemCode(),
                "BUSINESS: a referenced attribute definition cannot be voided");
        long firstUnboundVersion = saveTypedItemFacts(
                context,
                fixture,
                session,
                firstCode,
                readItem(context, fixture, session, firstCode).path("version").asLong(),
                List.of(),
                List.of());
        long secondUnboundVersion = saveTypedItemFacts(
                context,
                fixture,
                session,
                secondCode,
                readItem(context, fixture, session, secondCode).path("version").asLong(),
                List.of(),
                List.of());
        assertTrue(
                firstUnboundVersion > firstVersion,
                "BUSINESS: clearing the first assignment advances its item version");
        assertTrue(
                secondUnboundVersion > secondVersion,
                "BUSINESS: clearing the second assignment advances its item version");
        Response voided = context.post(
                OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION_STATUS,
                "/api/operations/catalog-inventory/attribute-definitions/"
                        + definition.path("definitionRef").asText()
                        + "/status",
                session.cookie(),
                Map.of(
                        "dataNodeRef", fixture.storeId().toString(),
                        "definitionRef", definition.path("definitionRef").asText(),
                        "expectedVersion", definition.path("version").asLong(),
                        "targetStatus", "VOIDED"),
                Set.of(200));
        assertEquals(
                "VOIDED",
                voided.json().path("result").path("definition").path("status").asText(),
                "BUSINESS: the definition transition returns the terminal lifecycle state");
        assertTrue(
                readItem(context, fixture, session, firstCode)
                        .path("attributeAssignments")
                        .isEmpty(),
                "BUSINESS: clearing references leaves the first product readable");
        assertTrue(
                readItem(context, fixture, session, secondCode)
                        .path("attributeAssignments")
                        .isEmpty(),
                "BUSINESS: clearing references leaves the second product readable");
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
                        "displayOrder",
                        0,
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

    private void assertOrderOptionDefinitionCreate(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        // spotless:off
        CreatedItem unprepared = createItemWithAttributes(
                context,
                fixture,
                session,
                "ACC-NO-TARGET-" + suffix,
                "没有库存对象的原料",
                Map.of());
        // spotless:on
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
                "BUSINESS: definition create rejects a material without an existing inventory object");
        JsonNode created = createOrderOptionDefinition(
                context,
                fixture,
                session,
                "创建蘸料-" + suffix,
                "SINGLE",
                List.of(Map.of("name", "番茄酱", "displayOrder", 0, "materials", List.of())));
        assertEquals(
                1,
                created.path("values").size(),
                "BUSINESS: definition create readback preserves its typed option value");
    }

    private void assertOrderOptionDefinitionUpdate(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
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
        JsonNode ownerDefinition = definitionByRef(
                context.get(
                                OPERATIONS_CATALOG_ORDER_OPTION_DEFINITIONS,
                                "/api/operations/catalog-inventory/order-option-definitions?dataNodeRef="
                                        + fixture.storeId(),
                                session.cookie(),
                                Set.of(200))
                        .json()
                        .path("data")
                        .path("definitions"),
                definitionRef,
                "updated ordering-option definition");
        assertEquals(
                "蘸料说明-" + suffix,
                ownerDefinition.path("name").asText(),
                "BUSINESS: ordering-option update is read back from the owner dictionary, not only its receipt");
        assertEquals(
                updated.json().path("version").asLong(),
                ownerDefinition.path("version").asLong(),
                "BUSINESS: ordering-option owner dictionary exposes the updated version");

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
            operation = "transitionOperationsCatalogOrderOptionDefinitionStatus")
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
        Response blocked = context.post(
                OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION_STATUS,
                "/api/operations/catalog-inventory/order-option-definitions/"
                        + definition.path("definitionRef").asText()
                        + "/status",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "definitionRef",
                        definition.path("definitionRef").asText(),
                        "expectedVersion",
                        definition.path("version").asLong(),
                        "targetStatus",
                        "VOIDED"),
                Set.of(422));
        assertEquals(
                "REFERENCE_BLOCKS_VOID",
                blocked.problemCode(),
                "BUSINESS: a referenced order-option definition cannot be voided");
        itemVersion = saveTypedItemFacts(
                context,
                fixture,
                session,
                itemCode,
                readItem(context, fixture, session, itemCode).path("version").asLong(),
                List.of(),
                List.of());
        Response voided = context.post(
                OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION_STATUS,
                "/api/operations/catalog-inventory/order-option-definitions/"
                        + definition.path("definitionRef").asText()
                        + "/status",
                session.cookie(),
                Map.of(
                        "dataNodeRef", fixture.storeId().toString(),
                        "definitionRef", definition.path("definitionRef").asText(),
                        "expectedVersion", definition.path("version").asLong(),
                        "targetStatus", "VOIDED"),
                Set.of(200));
        assertEquals(
                "VOIDED",
                voided.json().path("result").path("definition").path("status").asText(),
                "BUSINESS: the definition transition returns the terminal lifecycle state");
        assertTrue(
                readItem(context, fixture, session, itemCode)
                        .path("orderOptionConfigs")
                        .isEmpty(),
                "BUSINESS: clearing references leaves the product configuration empty");
        assertEquals(
                material.path("itemRef").asText(),
                readItem(context, fixture, session, "ACC-OPTION-MATERIAL-delete-" + suffix)
                        .path("itemRef")
                        .asText(),
                "BUSINESS: voiding the definition preserves the material product and its inventory target");
        assertTrue(itemVersion > 0, "BUSINESS: product configuration was cleared through the item owner");
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
        assertOrderOptionDefinitionUpdate(context);
    }

    @AcceptanceScenario(
            id = "catalog.fixed-selection-rejected",
            module = "CATALOG",
            operation = "createOperationsCatalogOrderOptionDefinition")
    void fixedSelectionRejected(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        Session session = host.login(context, fixture);
        String rejectedCode = "ACC-FIXED-" + UUID.randomUUID().toString().substring(0, 8);
        Response rejected = context.post(
                OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION_CREATE,
                "/api/operations/catalog-inventory/order-option-definitions",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "code",
                        rejectedCode,
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
        assertTrue(
                array(context.get(
                                        OPERATIONS_CATALOG_ORDER_OPTION_DEFINITIONS,
                                        "/api/operations/catalog-inventory/order-option-definitions?dataNodeRef="
                                                + fixture.storeId(),
                                        session.cookie(),
                                        Set.of(200))
                                .json()
                                .path("data")
                                .path("definitions"))
                        .stream()
                        .noneMatch(definition ->
                                rejectedCode.equals(definition.path("code").asText())),
                "BUSINESS: rejected FIXED input creates no owner definition");
        assertOrderOptionDefinitionCreate(context);
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
        String itemCode = "ACC-DISABLED-" + suffix;
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
                "BUSINESS: first step atomically creates a versioned disabled fact");
        JsonNode item = readItem(context, fixture, session, itemCode);
        assertEquals(
                created.json().path("result").path("resourceRef").asText(),
                item.path("itemRef").asText(),
                "BUSINESS: create receipt is read back through the same catalog owner identity");
        assertEquals(
                created.json().path("result").path("version").asLong(),
                item.path("version").asLong(),
                "BUSINESS: create receipt version is read back through the catalog owner");
        assertEquals(
                categoryRef,
                item.path("categoryRef").asText(),
                "BUSINESS: first-step category is already persisted on the disabled product");
        assertEquals(
                "DISABLED",
                item.path("lifecycle").path("status").asText(),
                "BUSINESS: first-step create produces DISABLED per the three-state lifecycle");
    }

    /**
     * This covers the decided attribute-definition semantic conflict. The equivalent ordering-option-name/code The
     * order-option group/value code rule is a separate create-only immutable contract; this fixture deliberately proves
     * the attribute-definition semantic conflict and does not infer an order-option identity from a display name or
     * UUID.
     */
    @AcceptanceScenario(
            id = "catalog.copy-definition-semantic-conflicts",
            module = "CATALOG",
            operation = "executeOperationsBrandCatalogCopy")
    void copyDefinitionSemanticConflicts(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        copyDefinitionSemanticConflictSubcase(context);
        copyOrderOptionDefinitionSemanticConflictSubcase(context);
    }

    private void copyDefinitionSemanticConflictSubcase(BackendAcceptanceTest.ScenarioContext context) throws Exception {
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

    private void copyOrderOptionDefinitionSemanticConflictSubcase(BackendAcceptanceTest.ScenarioContext context)
            throws Exception {
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
            List<Map<String, Object>> ignoredTemplates) {
        Map<String, Object> override = new LinkedHashMap<>();
        override.put("definitionValueRef", definitionValueRef);
        override.put("defaultValue", defaultValue);
        override.put("extraPrice", extraPrice);
        override.put("expectedBomVersion", expectedBomVersion);
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
        config.put("displayOrder", 0);
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
                "tagRefs",
                array(current.path("tagRefs")).stream().map(JsonNode::asText).toList());
        draft.put(
                "categoryRef",
                current.path("categoryRef").isNull()
                        ? null
                        : current.path("categoryRef").asText());
        draft.put(
                "productionTagRef",
                current.path("productionTagRef").isNull()
                        ? null
                        : current.path("productionTagRef").asText());
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
        // new definitions.  Carry only request-owned fields forward: the detail projection
        // also contains owner refs, snapshots, versions and effective facts that are not
        // accepted write fields.
        draft.put("identifiers", identifierSaveFacts(current.path("identifiers")));
        draft.put(
                "preparationProfile",
                current.has("preparationProfile")
                        ? current.path("preparationProfile").deepCopy()
                        : null);
        draft.put("skus", skuSaveFacts(current.path("skus")));
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
            savedConfig.put("displayOrder", config.path("displayOrder").asInt(0));
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
                    JsonNode effect = value.get("preparationEffect");
                    if (effect == null || effect.isNull() || !effect.isObject()) {
                        savedValue.put("preparationEffect", null);
                    } else {
                        Map<String, Object> savedEffect = new LinkedHashMap<>();
                        if (effect.has("instruction"))
                            savedEffect.put(
                                    "instruction",
                                    effect.path("instruction").isNull()
                                            ? null
                                            : effect.path("instruction").asText());
                        if (effect.has("preparationSecondsDelta"))
                            savedEffect.put(
                                    "preparationSecondsDelta",
                                    effect.path("preparationSecondsDelta").isNull()
                                            ? null
                                            : effect.path("preparationSecondsDelta")
                                                    .asLong());
                        savedValue.put("preparationEffect", savedEffect);
                    }
                    values.add(savedValue);
                }
            savedConfig.put("values", values);
            result.add(savedConfig);
        }
        return result;
    }

    private List<Map<String, Object>> identifierSaveFacts(JsonNode identifiers) {
        List<Map<String, Object>> result = new ArrayList<>();
        if (identifiers == null || !identifiers.isArray()) return result;
        for (JsonNode identifier : identifiers) {
            Map<String, Object> value = new LinkedHashMap<>();
            value.put("identifierType", identifier.path("identifierType").asText());
            value.put("identifierValue", identifier.path("identifierValue").asText());
            result.add(value);
        }
        return result;
    }

    private List<Map<String, Object>> skuSaveFacts(JsonNode skus) {
        List<Map<String, Object>> result = new ArrayList<>();
        if (skus == null || !skus.isArray()) return result;
        for (JsonNode source : skus) {
            Map<String, Object> target = new LinkedHashMap<>();
            if (source.hasNonNull("productSkuRef"))
                target.put("productSkuRef", source.path("productSkuRef").asText());
            target.put("skuCode", source.path("skuCode").asText());
            target.put("skuName", source.path("skuName").asText());
            target.put("displayOrder", source.path("displayOrder").asInt(0));
            target.put("attributeValueRefs", source.path("attributeValueRefs").deepCopy());
            target.put(
                    "standardSalePrice",
                    source.path("standardSalePrice").isNull()
                            ? null
                            : source.path("standardSalePrice").asLong());
            target.put("isDefault", source.path("isDefault").asBoolean(false));
            target.put("status", source.path("status").asText("ENABLED"));
            List<String> mediaRefs = array(source.path("mediaRefs")).stream()
                    .map(JsonNode::asText)
                    .toList();
            target.put("mediaRefs", mediaRefs);
            target.put(
                    "salesUnitOverrideRef",
                    source.path("salesUnitOverrideRef").isNull()
                            ? null
                            : source.path("salesUnitOverrideRef").asText());
            target.put(
                    "baseMeasureUnitOverrideRef",
                    source.path("baseMeasureUnitOverrideRef").isNull()
                            ? null
                            : source.path("baseMeasureUnitOverrideRef").asText());
            target.put("identifiers", identifierSaveFacts(source.path("identifiers")));
            JsonNode override = source.get("preparationOverride");
            if (override == null || override.isNull() || !override.isObject())
                target.put("preparationOverride", inheritPreparationOverride());
            else target.put("preparationOverride", override.deepCopy());
            result.add(target);
        }
        return result;
    }

    private Map<String, Object> inheritPreparationOverride() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("mode", "INHERIT_ITEM");
        result.put("profile", null);
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
        sections.put("inventoryRules", Map.of("nodes", List.of()));
        sections.put("expectedCatalogVersion", expectedVersion);
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
        sections.put("inventoryRules", Map.of("nodes", List.of()));
        sections.put("expectedCatalogVersion", expectedVersion);
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
        sections.put("inventoryRules", Map.of("nodes", List.of()));
        sections.put("expectedCatalogVersion", expectedVersion);
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
        return createInventoryBackedMaterialItem(context, fixture, session, suffix, null);
    }

    private JsonNode createInventoryBackedMaterialItem(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String suffix,
            String sharedBaseUnitRef)
            throws Exception {
        String code = "ACC-OPTION-MATERIAL-" + suffix;
        CreatedItem created =
                createMaterialItem(context, fixture, session, code, "option material " + suffix, sharedBaseUnitRef);
        JsonNode createdItem = readItem(context, fixture, session, code);
        String baseUnitRef = createdItem.path("baseMeasureUnitRef").asText();
        saveDirectItemWithUnits(context, fixture, session, code, created.version(), null, baseUnitRef, null, "1");
        JsonNode material = readItem(context, fixture, session, code);
        assertTrue(
                !inventoryRuleNodes(material).isEmpty()
                        && "DIRECT"
                                .equals(inventoryRuleNodes(material)
                                        .get(0)
                                        .path("mode")
                                        .asText()),
                "BUSINESS: material fixture has an inventory-owned StockTarget before the library command");
        assertTrue(
                inventoryRuleNodes(material).get(0).path("componentEligible").asBoolean(false),
                "BUSINESS: material fixture's StockTarget is eligible for the BOM component candidate owner read");
        return material;
    }

    private String createProductionTag(
            BackendAcceptanceTest.ScenarioContext context, Fixture fixture, Session session, String code, String name)
            throws Exception {
        Response created = context.post(
                OPERATIONS_PRODUCTION_TAG_CREATE,
                "/api/operations/catalog-inventory/production-tags",
                session.cookie(),
                Map.of("dataNodeRef", fixture.storeId().toString(), "code", code, "name", name),
                Map.of("Idempotency-Key", "acceptance-production-tag-" + UUID.randomUUID()),
                Set.of(200));
        assertEquals(
                code,
                created.json().path("result").path("code").asText(),
                "BUSINESS: production-tag fixture is created through the real owner command");
        String ref = created.json().path("result").path("tagRef").asText();
        assertFalse(ref.isBlank(), "BUSINESS: production-tag fixture exposes its owner reference");
        return ref;
    }

    private void transitionProductionTag(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String code,
            String targetStatus)
            throws Exception {
        Response transitioned = context.post(
                OPERATIONS_PRODUCTION_TAG_STATUS,
                "/api/operations/catalog-inventory/production-tags/" + code + "/status",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "tagCode",
                        code,
                        "expectedVersion",
                        1,
                        "targetStatus",
                        targetStatus),
                Map.of("Idempotency-Key", "acceptance-production-tag-transition-" + UUID.randomUUID()),
                Set.of(200));
        assertEquals(
                targetStatus,
                transitioned.json().path("result").path("status").asText(),
                "BUSINESS: production-tag fixture reaches the requested lifecycle status");
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
        JsonNode current = readItem(context, fixture, session, itemCode);
        List<Map<String, Object>> preservedInventoryRules = StreamSupport.stream(
                        inventoryRuleNodes(current).spliterator(), false)
                .map(CatalogAcceptanceScenarios::inventoryRuleDraftFromReadback)
                .toList();
        sections.put("inventoryRules", Map.of("nodes", preservedInventoryRules));
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
        return createItemWithShape(
                context, fixture, session, dataNodeRef, code, name, attributes, headers, "STANDARD_SALE_COUNTED");
    }

    private CreatedItem createItemWithShape(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String dataNodeRef,
            String code,
            String name,
            Map<String, Object> attributes,
            Map<String, String> headers,
            String shapeKey)
            throws Exception {
        return createItemWithShape(
                context, fixture, session, dataNodeRef, code, name, attributes, headers, shapeKey, null);
    }

    private CreatedItem createItemWithShape(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String dataNodeRef,
            String code,
            String name,
            Map<String, Object> attributes,
            Map<String, String> headers,
            String shapeKey,
            String sharedBaseUnitRef)
            throws Exception {
        // The remaining callers retain this fixture helper name while legacy scenarios are
        // migrated.  The current create contract intentionally accepts only the first-step
        // identity/category/shape facts; product attributes belong to the typed save command.
        Response created = context.post(
                OPERATIONS_CATALOG_ITEM_CREATE,
                "/api/operations/catalog-inventory/items",
                session.cookie(),
                itemCreateBody(dataNodeRef, code, name, shapeKey, null),
                headers,
                Set.of(200));
        JsonNode result = created.json().path("result");
        long version = result.path("version").asLong();
        String resourceRef = result.path("resourceRef").asText();
        assertTrue(
                version > 0 && !resourceRef.isBlank(),
                "BUSINESS: catalog item creation exposes an opaque, versioned owner fact");
        boolean inventorylessShape =
                Set.of("COMPOSITE", "SERVICE", "BENEFIT_SHELL").contains(shapeKey);
        String unitRef = sharedBaseUnitRef;
        if (unitRef == null || unitRef.isBlank()) {
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
            unitRef = defaultUnit.path("result").path("unit").path("unitRef").asText();
        }
        assertFalse(unitRef.isBlank(), "BUSINESS: sellable item fixture obtains a default sales unit");
        Map<String, Object> draft = new LinkedHashMap<>();
        draft.put("name", name);
        draft.put("shapeKey", shapeKey);
        draft.put("images", List.of());
        draft.put("tagRefs", List.of());
        draft.put("identifiers", List.of());
        draft.put("preparationProfile", null);
        draft.put("categoryRef", null);
        draft.put("salesUnitRef", unitRef);
        draft.put("baseMeasureUnitRef", inventorylessShape ? null : unitRef);
        draft.put("skus", List.of());
        draft.put("skuVariantDimensions", List.of());
        draft.put("attributeAssignments", List.of());
        draft.put("orderOptionConfigs", List.of());
        draft.put("compositeGroups", List.of());
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("catalogDraft", draft);
        sections.put("inventoryRules", Map.of("nodes", List.of()));
        sections.put("expectedCatalogVersion", version);
        Response initialized = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(code),
                session.cookie(),
                Map.of("dataNodeRef", dataNodeRef, "itemCode", code, "sections", sections),
                withIdempotency(headers, "default-unit-save-" + code),
                Set.of(200));
        long initializedVersion = initialized.json().path("version").asLong();
        assertTrue(
                initialized.status() == 200 && initializedVersion > version,
                "BUSINESS: item fixture persists its effective sales/base units shape=" + shapeKey);
        return new CreatedItem(UUID.fromString(resourceRef), initializedVersion);
    }

    private CreatedItem createSkuVariantItem(
            BackendAcceptanceTest.ScenarioContext context, Fixture fixture, Session session, String code, String name)
            throws Exception {
        return createItemWithShape(
                context,
                fixture,
                session,
                fixture.storeId().toString(),
                code,
                name,
                Map.of(),
                Map.of(),
                "SKU_VARIANT_SALE_COUNTED");
    }

    private CreatedItem createMaterialItem(
            BackendAcceptanceTest.ScenarioContext context, Fixture fixture, Session session, String code, String name)
            throws Exception {
        return createMaterialItem(context, fixture, session, code, name, null);
    }

    private CreatedItem createMaterialItem(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String code,
            String name,
            String sharedBaseUnitRef)
            throws Exception {
        return createItemWithShape(
                context,
                fixture,
                session,
                fixture.storeId().toString(),
                code,
                name,
                Map.of(),
                Map.of(),
                "MATERIAL",
                sharedBaseUnitRef);
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

    private JsonNode createAcceptanceCategory(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String code,
            String name,
            String parentCategoryRef)
            throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("dataNodeRef", fixture.storeId().toString());
        body.put("code", code);
        body.put("name", name);
        body.put("parentCategoryRef", parentCategoryRef);
        Response created = context.post(
                OPERATIONS_CATALOG_CATEGORY_CREATE,
                "/api/operations/catalog-inventory/categories",
                session.cookie(),
                body,
                Set.of(200));
        assertFalse(
                created.json().path("result").path("categoryRef").asText().isBlank(),
                "BUSINESS: category fixture is created by the public owner command");
        return created.json();
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
        sections.put("inventoryRules", Map.of("nodes", List.of()));
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
        sections.put("inventoryRules", Map.of("nodes", List.of()));
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
        sections.put("inventoryRules", Map.of("nodes", List.of()));
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

    private long saveCatalogProductionTag(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            long expectedVersion,
            String productionTagRef)
            throws Exception {
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("expectedCatalogVersion", expectedVersion);
        Map<String, Object> draft = itemDraft(context, fixture, session, itemCode);
        draft.put("productionTagRef", productionTagRef);
        sections.put("catalogDraft", draft);
        sections.put("inventoryRules", Map.of("nodes", List.of()));
        Response saved = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(itemCode),
                session.cookie(),
                Map.of("dataNodeRef", fixture.storeId().toString(), "itemCode", itemCode, "sections", sections),
                Set.of(200));
        long version = saved.json().path("version").asLong();
        assertTrue(version > expectedVersion, "BUSINESS: production-tag binding advances the item version");
        return version;
    }

    private static JsonNode findByCode(JsonNode rows, String code) {
        return array(rows).stream()
                .filter(row -> code.equals(row.path("code").asText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("BUSINESS: expected catalog tag is present in navigation"));
    }

    private static JsonNode definitionByRef(JsonNode definitions, String definitionRef, String context) {
        return array(definitions).stream()
                .filter(definition ->
                        definitionRef.equals(definition.path("definitionRef").asText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError(
                        "BUSINESS: catalog owner dictionary is missing " + context + " " + definitionRef));
    }

    private static JsonNode inventoryRuleNodes(JsonNode item) {
        JsonNode nodes = item.path("inventoryRules").path("nodes");
        if (!nodes.isArray()) throw new AssertionError("BUSINESS: catalog readback must expose inventoryRules.nodes");
        return nodes;
    }

    private static JsonNode inventoryRuleForSku(JsonNode item, String skuRef) {
        return StreamSupport.stream(inventoryRuleNodes(item).spliterator(), false)
                .filter(node ->
                        "SKU".equals(node.path("owner").path("ownerType").asText()))
                .filter(node ->
                        skuRef.equals(node.path("owner").path("productSkuRef").asText()))
                .findFirst()
                .orElseThrow(() ->
                        new AssertionError("BUSINESS: catalog readback must expose the requested SKU inventory owner"));
    }

    private static String inventoryRuleForSkuRef(JsonNode item, String skuCode) {
        return StreamSupport.stream(inventoryRuleNodes(item).spliterator(), false)
                .filter(node ->
                        "SKU".equals(node.path("owner").path("ownerType").asText()))
                .filter(node ->
                        skuCode.equals(node.path("owner").path("skuCode").asText()))
                .map(node -> node.path("owner").path("productSkuRef").asText())
                .findFirst()
                .orElseThrow(() -> new AssertionError("BUSINESS: SKU fixture must expose the created productSkuRef"));
    }

    private static String inventoryTargetRef(JsonNode item) {
        return StreamSupport.stream(inventoryRuleNodes(item).spliterator(), false)
                .map(node -> node.path("directConfiguration").path("targetRef").asText(""))
                .filter(ref -> !ref.isBlank())
                .findFirst()
                .orElseThrow(() -> new AssertionError("BUSINESS: item fixture must expose a direct inventory target"));
    }

    private static String inventoryTargetRefOrMissing(JsonNode item) {
        return StreamSupport.stream(inventoryRuleNodes(item).spliterator(), false)
                .map(node -> node.path("directConfiguration").path("targetRef").asText(""))
                .filter(ref -> !ref.isBlank())
                .findFirst()
                .orElse(UUID.randomUUID().toString());
    }

    private static String unavailableOwnerCode(CreatedItem ignored, String code) {
        return code;
    }

    private static boolean admissionCaseAllowed(String shape, String ownerType, String mode) {
        if ("STANDARD_SALE_COUNTED".equals(shape) || "STANDARD_SALE_WEIGHED".equals(shape))
            return ("ITEM".equals(ownerType) && Set.of("NONE", "DIRECT", "BOM").contains(mode))
                    || ("OPTION_VALUE".equals(ownerType)
                            && Set.of("NONE", "BOM").contains(mode));
        if ("SKU_VARIANT_SALE_COUNTED".equals(shape))
            return ("SKU".equals(ownerType) && Set.of("NONE", "DIRECT", "BOM").contains(mode))
                    || ("ITEM".equals(ownerType) && "NONE".equals(mode));
        if ("MATERIAL".equals(shape))
            return "ITEM".equals(ownerType) && Set.of("NONE", "DIRECT").contains(mode);
        return false;
    }

    private static JsonNode findInventoryOwner(
            JsonNode item, String ownerType, String itemRef, String optionValueRef, String productSkuRef) {
        return StreamSupport.stream(inventoryRuleNodes(item).spliterator(), false)
                .filter(node ->
                        ownerType.equals(node.path("owner").path("ownerType").asText()))
                .filter(node ->
                        itemRef.equals(node.path("owner").path("itemRef").asText()))
                .filter(node -> optionValueRef == null
                        || optionValueRef.equals(
                                node.path("owner").path("optionValueRef").asText()))
                .filter(node -> productSkuRef == null
                        || productSkuRef.equals(
                                node.path("owner").path("productSkuRef").asText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("BUSINESS: requested inventory owner is present in readback"));
    }

    private static Map<String, Object> noneInventoryRule(
            String ownerType, String itemRef, String referenceRef, String itemCode, String displayCode) {
        Map<String, Object> rule = new LinkedHashMap<>();
        rule.put(
                "owner",
                inventoryOwner(
                        ownerType,
                        itemRef,
                        "SKU".equals(ownerType) ? referenceRef : null,
                        "OPTION_VALUE".equals(ownerType) ? referenceRef : null,
                        itemCode,
                        displayCode));
        rule.put("mode", "NONE");
        rule.put("consumptionUnitSnapshot", null);
        rule.put("expectedTargetVersion", null);
        rule.put("expectedBomVersion", null);
        rule.put("directConfiguration", null);
        rule.put("bom", null);
        return rule;
    }

    private static Map<String, Object> inventoryRuleForMode(
            String ownerType,
            String itemRef,
            String referenceRef,
            String itemCode,
            String displayCode,
            String mode,
            Map<String, Object> consumptionUnitSnapshot,
            String componentTargetRef,
            Long expectedTargetVersion,
            Long expectedBomVersion) {
        if ("NONE".equals(mode)) return noneInventoryRule(ownerType, itemRef, referenceRef, itemCode, displayCode);
        if ("DIRECT".equals(mode))
            return directInventoryRule(
                    ownerType,
                    itemRef,
                    "SKU".equals(ownerType) ? referenceRef : null,
                    itemCode,
                    "SKU".equals(ownerType) ? displayCode : null,
                    consumptionUnitSnapshot,
                    expectedTargetVersion,
                    null,
                    "1");
        List<Map<String, Object>> lines = List.of(bomLine(componentTargetRef, "POSITIVE", "1"));
        if ("OPTION_VALUE".equals(ownerType))
            return optionValueBomInventoryRule(itemRef, referenceRef, itemCode, displayCode, expectedBomVersion, lines);
        return bomInventoryRule(
                ownerType,
                itemRef,
                "SKU".equals(ownerType) ? referenceRef : null,
                itemCode,
                "SKU".equals(ownerType) ? displayCode : null,
                expectedBomVersion,
                lines);
    }

    private static Map<String, Object> unitSnapshotFromItem(JsonNode item) {
        JsonNode unit = item.path("baseMeasureUnit");
        if (!unit.isObject()
                || unit.path("unitRef").asText().isBlank()
                || unit.path("code").asText().isBlank()
                || unit.path("name").asText().isBlank()
                || unit.path("unitDimension").asText().isBlank()
                || !unit.path("precision").isIntegralNumber()) {
            throw new AssertionError("BUSINESS: direct inventory fixture must expose a complete base-unit snapshot");
        }
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("unitRef", unit.path("unitRef").asText());
        snapshot.put("code", unit.path("code").asText());
        snapshot.put("name", unit.path("name").asText());
        snapshot.put("unitDimension", unit.path("unitDimension").asText());
        snapshot.put("precision", unit.path("precision").asInt());
        return snapshot;
    }

    private Map<String, Object> itemBomRuleForExistingItem(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            String componentTargetRef)
            throws Exception {
        JsonNode current = readItem(context, fixture, session, itemCode);
        return inventoryRuleForMode(
                "ITEM",
                current.path("itemRef").asText(),
                null,
                itemCode,
                null,
                "BOM",
                null,
                componentTargetRef,
                null,
                null);
    }

    private Map<String, Object> itemDirectRuleForExistingItem(
            BackendAcceptanceTest.ScenarioContext context, Fixture fixture, Session session, String itemCode)
            throws Exception {
        JsonNode current = readItem(context, fixture, session, itemCode);
        return inventoryRuleForMode(
                "ITEM",
                current.path("itemRef").asText(),
                null,
                itemCode,
                null,
                "DIRECT",
                unitSnapshotFromItem(current),
                null,
                null,
                null);
    }

    private Response saveInventoryNodes(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            long expectedCatalogVersion,
            List<Map<String, Object>> nodes,
            Set<Integer> expectedStatuses)
            throws Exception {
        return saveInventoryNodes(
                context, fixture, session, itemCode, expectedCatalogVersion, nodes, draft -> {}, expectedStatuses);
    }

    private Response saveInventoryNodes(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            long expectedCatalogVersion,
            List<Map<String, Object>> nodes,
            Consumer<Map<String, Object>> draftCustomizer,
            Set<Integer> expectedStatuses)
            throws Exception {
        Map<String, Object> draft = itemDraft(context, fixture, session, itemCode);
        draftCustomizer.accept(draft);
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("expectedCatalogVersion", expectedCatalogVersion);
        sections.put("catalogDraft", draft);
        sections.put("inventoryRules", Map.of("nodes", nodes));
        return context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(itemCode),
                session.cookie(),
                Map.of("dataNodeRef", fixture.storeId().toString(), "itemCode", itemCode, "sections", sections),
                idempotencyHeaders("inventory-rule-save-" + itemCode),
                expectedStatuses);
    }

    private JsonNode saveItemInventoryMode(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            long expectedCatalogVersion,
            String mode,
            String componentTargetRef)
            throws Exception {
        JsonNode current = readItem(context, fixture, session, itemCode);
        Map<String, Object> rule = inventoryRuleForMode(
                "ITEM",
                current.path("itemRef").asText(),
                null,
                itemCode,
                null,
                mode,
                unitSnapshotFromItem(current),
                componentTargetRef,
                null,
                null);
        Response saved = saveInventoryNodes(
                context, fixture, session, itemCode, expectedCatalogVersion, List.of(rule), Set.of(200));
        assertEquals(200, saved.status(), "BUSINESS: item inventory mode whole-save succeeds");
        return readItem(context, fixture, session, itemCode);
    }

    private JsonNode saveSkuVariantMode(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            long expectedCatalogVersion,
            String skuCode,
            String mode,
            String componentTargetRef)
            throws Exception {
        JsonNode current = readItem(context, fixture, session, itemCode);
        String itemRef = current.path("itemRef").asText();
        String unitRef = current.path("baseMeasureUnitRef").asText();
        Map<String, Object> sku = new LinkedHashMap<>();
        sku.put("productSkuRef", null);
        sku.put("skuCode", skuCode);
        sku.put("skuName", skuCode);
        sku.put("displayOrder", 0);
        sku.put("attributeValueRefs", List.of());
        sku.put("isDefault", true);
        sku.put("status", "ENABLED");
        sku.put("mediaRefs", List.of());
        sku.put("salesUnitOverrideRef", unitRef);
        sku.put("baseMeasureUnitOverrideRef", unitRef);
        sku.put("identifiers", List.of());
        sku.put("preparationOverride", inheritPreparationOverride());
        Map<String, Object> rule = inventoryRuleForMode(
                "SKU",
                itemRef,
                null,
                itemCode,
                skuCode,
                mode,
                unitSnapshotFromItem(current),
                componentTargetRef,
                null,
                null);
        Response saved = saveInventoryNodes(
                context,
                fixture,
                session,
                itemCode,
                expectedCatalogVersion,
                List.of(rule),
                draft -> draft.put("skus", List.of(sku)),
                Set.of(200));
        assertEquals(200, saved.status(), "BUSINESS: SKU inventory mode whole-save succeeds");
        return readItem(context, fixture, session, itemCode);
    }

    private void countTarget(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String targetRef,
            String quantity,
            boolean zeroConfirmation,
            String operation)
            throws Exception {
        Response current = context.get(
                OPERATIONS_INVENTORY_TARGET_READ,
                "/api/operations/catalog-inventory/inventory-targets/"
                        + targetRef
                        + "?dataNodeRef="
                        + fixture.storeId(),
                session.cookie(),
                Set.of(200));
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("dataNodeRef", fixture.storeId().toString());
        request.put("targetRef", targetRef);
        request.put("expectedVersion", current.json().path("version").asLong());
        request.put("countedQuantity", quantity);
        request.put("countingUnitRef", null);
        request.put("zeroConfirmation", zeroConfirmation);
        context.post(
                OPERATIONS_INVENTORY_TARGET_COUNT,
                "/api/operations/catalog-inventory/inventory-targets/" + targetRef + "/count",
                session.cookie(),
                request,
                idempotencyHeaders(operation),
                Set.of(200));
    }

    private static void assertBlockingFacts(JsonNode response, Set<String> expectedKinds) {
        JsonNode facts = response.path("details").path("blockingFacts");
        if (!facts.isArray()) facts = response.path("problem").path("details").path("blockingFacts");
        String observed = StreamSupport.stream(facts.spliterator(), false)
                .map(fact ->
                        fact.path("kind").asText() + "=" + fact.path("count").asLong())
                .collect(Collectors.joining(","));
        assertEquals(
                4,
                facts.size(),
                "BUSINESS: mode-switch problem exposes the four fixed blocking facts observed=" + observed);
        Set<String> kinds = new LinkedHashSet<>();
        for (JsonNode fact : facts) {
            kinds.add(fact.path("kind").asText());
            long count = fact.path("count").asLong();
            if (expectedKinds.contains(fact.path("kind").asText()))
                assertTrue(count > 0, "BUSINESS: named blocker has a positive count");
            else
                assertEquals(
                        0,
                        count,
                        "BUSINESS: unrelated blocker remains absent expected=" + expectedKinds + " observed="
                                + observed);
        }
        assertEquals(
                Set.of("BALANCE", "LEDGER", "BOM_REFERENCE", "HISTORICAL_DEFINITION"),
                kinds,
                "BUSINESS: blockingFacts kinds are closed and stable");
    }

    private static void assertOptionBomLines(JsonNode item, String optionValueRef, String sign, String quantity) {
        JsonNode node =
                findInventoryOwner(item, "OPTION_VALUE", item.path("itemRef").asText(), optionValueRef, null);
        BigDecimal expectedQuantity = new BigDecimal(quantity);
        assertTrue(
                StreamSupport.stream(node.path("bom").path("lines").spliterator(), false)
                        .anyMatch(line -> sign.equals(line.path("lineSign").asText())
                                && expectedQuantity.compareTo(new BigDecimal(
                                                line.path("quantity").asText()))
                                        == 0),
                "BUSINESS: option-value BOM preserves its sign and actual quantity");
    }

    private static void assertOptionBomLineDisplayName(
            JsonNode item, String optionValueRef, String targetRef, String expectedName, String prohibitedCode) {
        JsonNode node =
                findInventoryOwner(item, "OPTION_VALUE", item.path("itemRef").asText(), optionValueRef, null);
        JsonNode line = StreamSupport.stream(node.path("bom").path("lines").spliterator(), false)
                .filter(candidate ->
                        targetRef.equals(candidate.path("targetRef").asText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("BUSINESS: option-value BOM line remains present in readback"));
        assertEquals(
                expectedName,
                line.path("itemName").asText(),
                "BUSINESS: saved BOM readback exposes the component's catalog name");
        assertNotEquals(
                prohibitedCode,
                line.path("itemName").asText(),
                "BUSINESS: saved BOM readback must not project a component code as its name");
    }

    private static Map<String, Object> inventoryOwner(
            String ownerType,
            String itemRef,
            String productSkuRef,
            String optionValueRef,
            String itemCode,
            String skuCode) {
        Map<String, Object> owner = new LinkedHashMap<>();
        owner.put("ownerType", ownerType);
        owner.put("itemRef", itemRef);
        owner.put("productSkuRef", productSkuRef);
        owner.put("optionValueRef", optionValueRef);
        if (itemCode != null) owner.put("itemCode", itemCode);
        if ("OPTION_VALUE".equals(ownerType) && skuCode != null) owner.put("optionValueCode", skuCode);
        else if (skuCode != null) owner.put("skuCode", skuCode);
        return owner;
    }

    private static Map<String, Object> directInventoryRule(
            String ownerType,
            String itemRef,
            String productSkuRef,
            String itemCode,
            String skuCode,
            Map<String, Object> consumptionUnitSnapshot,
            Long expectedTargetVersion,
            String countingUnitRef,
            String conversionFactor) {
        Map<String, Object> rule = new LinkedHashMap<>();
        rule.put("owner", inventoryOwner(ownerType, itemRef, productSkuRef, null, itemCode, skuCode));
        rule.put("mode", "DIRECT");
        rule.put("consumptionUnitSnapshot", consumptionUnitSnapshot);
        rule.put("expectedTargetVersion", expectedTargetVersion);
        rule.put("expectedBomVersion", null);
        Map<String, Object> configuration = new LinkedHashMap<>();
        configuration.put("allowNegative", false);
        configuration.put("lowStockThreshold", null);
        configuration.put("countingUnitRef", countingUnitRef);
        configuration.put("conversionFactor", conversionFactor == null ? "1" : conversionFactor);
        rule.put("directConfiguration", configuration);
        rule.put("bom", null);
        return rule;
    }

    private static Map<String, Object> bomInventoryRule(
            String ownerType,
            String itemRef,
            String productSkuRef,
            String itemCode,
            String skuCode,
            Long expectedBomVersion,
            List<Map<String, Object>> lines) {
        Map<String, Object> rule = new LinkedHashMap<>();
        rule.put("owner", inventoryOwner(ownerType, itemRef, productSkuRef, null, itemCode, skuCode));
        rule.put("mode", "BOM");
        rule.put("consumptionUnitSnapshot", null);
        rule.put("expectedTargetVersion", null);
        rule.put("expectedBomVersion", expectedBomVersion);
        rule.put("directConfiguration", null);
        rule.put("bom", Map.of("lines", lines));
        return rule;
    }

    private static Map<String, Object> optionValueBomInventoryRule(
            String itemRef,
            String optionValueRef,
            String itemCode,
            String optionValueCode,
            Long expectedBomVersion,
            List<Map<String, Object>> lines) {
        Map<String, Object> rule = new LinkedHashMap<>();
        rule.put("owner", inventoryOwner("OPTION_VALUE", itemRef, null, optionValueRef, itemCode, optionValueCode));
        rule.put("mode", "BOM");
        rule.put("consumptionUnitSnapshot", null);
        rule.put("expectedTargetVersion", null);
        rule.put("expectedBomVersion", expectedBomVersion);
        rule.put("directConfiguration", null);
        rule.put("bom", Map.of("lines", lines));
        return rule;
    }

    private static Map<String, Object> inventoryRuleDraftFromReadback(JsonNode node) {
        Map<String, Object> draft = new LinkedHashMap<>();
        Map<String, Object> owner = new LinkedHashMap<>();
        JsonNode readbackOwner = node.path("owner");
        for (String field : List.of(
                "ownerType", "itemRef", "productSkuRef", "optionValueRef", "itemCode", "skuCode", "optionValueCode"))
            owner.put(
                    field,
                    readbackOwner.path(field).isMissingNode()
                                    || readbackOwner.path(field).isNull()
                            ? null
                            : readbackOwner.path(field).asText());
        draft.put("owner", owner);
        draft.put("mode", node.path("mode").asText("NONE"));
        JsonNode direct = node.path("directConfiguration");
        JsonNode consumption = direct.path("consumptionUnitSnapshot");
        draft.put("consumptionUnitSnapshot", consumption.isObject() ? consumption : null);
        draft.put(
                "expectedTargetVersion",
                direct.path("version").isIntegralNumber()
                        ? direct.path("version").asLong()
                        : null);
        JsonNode bom = node.path("bom");
        draft.put(
                "expectedBomVersion",
                bom.path("version").isIntegralNumber() ? bom.path("version").asLong() : null);
        if ("DIRECT".equals(node.path("mode").asText())) {
            Map<String, Object> configuration = new LinkedHashMap<>();
            configuration.put("allowNegative", direct.path("allowNegative").asBoolean(false));
            configuration.put(
                    "lowStockThreshold",
                    direct.path("lowStockThreshold").isNull()
                                    || direct.path("lowStockThreshold").isMissingNode()
                            ? null
                            : direct.path("lowStockThreshold").asText());
            JsonNode counting = direct.path("countingUnitSnapshot");
            configuration.put(
                    "countingUnitRef",
                    counting.isObject() ? counting.path("unitRef").asText() : null);
            configuration.put(
                    "conversionFactor",
                    direct.path("conversionFactor").isNull()
                                    || direct.path("conversionFactor").isMissingNode()
                            ? null
                            : direct.path("conversionFactor").asText());
            draft.put("directConfiguration", configuration);
        } else draft.put("directConfiguration", null);
        if ("BOM".equals(node.path("mode").asText())) {
            List<Map<String, Object>> lines = new ArrayList<>();
            if (bom.path("lines").isArray())
                for (JsonNode line : bom.path("lines"))
                    lines.add(bomLine(
                            line.path("targetRef").asText(),
                            line.path("lineSign").asText("POSITIVE"),
                            line.path("quantity").asText()));
            draft.put("bom", Map.of("lines", lines));
        } else draft.put("bom", null);
        return draft;
    }

    private long saveOptionValueBom(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            long expectedVersion,
            String optionValueRef,
            String optionValueCode,
            String componentTargetRef,
            String quantity)
            throws Exception {
        JsonNode current = readItem(context, fixture, session, itemCode);
        List<Map<String, Object>> nodes = new ArrayList<>();
        JsonNode existing = null;
        for (JsonNode node : inventoryRuleNodes(current)) {
            if (optionValueRef.equals(node.path("owner").path("optionValueRef").asText())) existing = node;
            else nodes.add(inventoryRuleDraftFromReadback(node));
        }
        Long expectedBomVersion =
                existing == null || existing.path("bom").path("version").isNull()
                        ? null
                        : existing.path("bom").path("version").asLong();
        nodes.add(optionValueBomInventoryRule(
                current.path("itemRef").asText(),
                optionValueRef,
                itemCode,
                optionValueCode,
                expectedBomVersion,
                List.of(bomLine(componentTargetRef, "POSITIVE", quantity))));
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("expectedCatalogVersion", expectedVersion);
        sections.put("catalogDraft", itemDraft(context, fixture, session, itemCode));
        sections.put("inventoryRules", Map.of("nodes", nodes));
        Response saved = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(itemCode),
                session.cookie(),
                Map.of("dataNodeRef", fixture.storeId().toString(), "itemCode", itemCode, "sections", sections),
                idempotencyHeaders("option-value-bom-" + itemCode),
                Set.of(200));
        long version = saved.json().path("version").asLong();
        assertTrue(version > expectedVersion, "BUSINESS: option-value BOM fixture advances the catalog version");
        return version;
    }

    private long saveOptionValueBomLines(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            long expectedVersion,
            String optionValueRef,
            String optionValueCode,
            List<Map<String, Object>> lines)
            throws Exception {
        JsonNode current = readItem(context, fixture, session, itemCode);
        List<Map<String, Object>> nodes = new ArrayList<>();
        JsonNode existing = null;
        for (JsonNode node : inventoryRuleNodes(current)) {
            if (optionValueRef.equals(node.path("owner").path("optionValueRef").asText())) existing = node;
            else nodes.add(inventoryRuleDraftFromReadback(node));
        }
        Long expectedBomVersion =
                existing == null || existing.path("bom").path("version").isNull()
                        ? null
                        : existing.path("bom").path("version").asLong();
        nodes.add(optionValueBomInventoryRule(
                current.path("itemRef").asText(),
                optionValueRef,
                itemCode,
                optionValueCode,
                expectedBomVersion,
                lines));
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("expectedCatalogVersion", expectedVersion);
        sections.put("catalogDraft", itemDraft(context, fixture, session, itemCode));
        sections.put("inventoryRules", Map.of("nodes", nodes));
        Response saved = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(itemCode),
                session.cookie(),
                Map.of("dataNodeRef", fixture.storeId().toString(), "itemCode", itemCode, "sections", sections),
                idempotencyHeaders("option-value-bom-lines-" + itemCode + "-" + optionValueRef),
                Set.of(200));
        long version = saved.json().path("version").asLong();
        assertTrue(version > expectedVersion, "BUSINESS: option BOM line aggregate advances the catalog version");
        return version;
    }

    private static Map<String, Object> bomLine(String targetRef, String lineSign, String quantity) {
        return Map.of("targetRef", targetRef, "lineSign", lineSign, "quantity", quantity);
    }

    private long saveDirectItemWithUnits(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            long expectedVersion,
            String salesUnitRef,
            String baseMeasureUnitRef,
            String countingUnitRef,
            String conversionFactor)
            throws Exception {
        JsonNode current = readItem(context, fixture, session, itemCode);
        String itemRef = current.path("itemRef").asText();
        JsonNode existing = StreamSupport.stream(inventoryRuleNodes(current).spliterator(), false)
                .filter(node ->
                        "ITEM".equals(node.path("owner").path("ownerType").asText()))
                .findFirst()
                .orElse(null);
        Long expectedTargetVersion = existing == null
                        || existing.path("directConfiguration").path("version").isNull()
                ? null
                : existing.path("directConfiguration").path("version").asLong();
        Map<String, Object> draft = itemDraft(context, fixture, session, itemCode);
        draft.put("salesUnitRef", salesUnitRef);
        draft.put("baseMeasureUnitRef", baseMeasureUnitRef);
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("expectedCatalogVersion", expectedVersion);
        sections.put("catalogDraft", draft);
        sections.put(
                "inventoryRules",
                Map.of(
                        "nodes",
                        List.of(directInventoryRule(
                                "ITEM",
                                itemRef,
                                null,
                                itemCode,
                                null,
                                unitSnapshotFromItem(current),
                                expectedTargetVersion,
                                countingUnitRef,
                                conversionFactor))));
        Response saved = context.patch(
                OPERATIONS_CATALOG_ITEM_SAVE,
                itemPath(itemCode),
                session.cookie(),
                Map.of("dataNodeRef", fixture.storeId().toString(), "itemCode", itemCode, "sections", sections),
                idempotencyHeaders("direct-item-save-" + itemCode),
                Set.of(200));
        long version = saved.json().path("version").asLong();
        assertTrue(version > expectedVersion, "BUSINESS: direct item inventory fixture advances the catalog version");
        return version;
    }

    private long saveDirectItem(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            long expectedVersion,
            String fixtureLabel)
            throws Exception {
        JsonNode current = readItem(context, fixture, session, itemCode);
        String baseUnitRef = current.path("baseMeasureUnitRef").asText("");
        assertFalse(baseUnitRef.isBlank(), "BUSINESS: direct item fixture has a base measurement unit");
        return saveDirectItemWithUnits(
                context,
                fixture,
                session,
                itemCode,
                expectedVersion,
                current.path("salesUnitRef").asText(null),
                baseUnitRef,
                null,
                "1");
    }

    private long saveSkuVariantDirect(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            long expectedVersion,
            String skuRef,
            String skuCode)
            throws Exception {
        JsonNode current = readItem(context, fixture, session, itemCode);
        String unitRef = current.path("baseMeasureUnitRef").asText("");
        assertFalse(unitRef.isBlank(), "BUSINESS: acceptance fixture obtains a catalog unit opaque reference");
        JsonNode existing = skuRef == null
                ? null
                : StreamSupport.stream(inventoryRuleNodes(current).spliterator(), false)
                        .filter(node -> skuRef.equals(
                                node.path("owner").path("productSkuRef").asText()))
                        .findFirst()
                        .orElse(null);
        Long expectedTargetVersion = existing == null
                        || existing.path("directConfiguration").path("version").isNull()
                ? null
                : existing.path("directConfiguration").path("version").asLong();
        Map<String, Object> sku = new LinkedHashMap<>();
        if (skuRef != null) sku.put("productSkuRef", skuRef);
        sku.put("skuCode", skuCode);
        sku.put("skuName", skuCode);
        sku.put("displayOrder", 0);
        sku.put("attributeValueRefs", List.of());
        sku.put("isDefault", true);
        sku.put("status", "ENABLED");
        sku.put("mediaRefs", List.of());
        sku.put("salesUnitOverrideRef", unitRef);
        sku.put("baseMeasureUnitOverrideRef", unitRef);
        sku.put("identifiers", List.of());
        sku.put("preparationOverride", inheritPreparationOverride());
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("expectedCatalogVersion", expectedVersion);
        Map<String, Object> draft = itemDraft(context, fixture, session, itemCode);
        draft.put("salesUnitRef", unitRef);
        draft.put("baseMeasureUnitRef", unitRef);
        draft.put("skus", List.of(sku));
        sections.put("catalogDraft", draft);
        sections.put(
                "inventoryRules",
                Map.of(
                        "nodes",
                        List.of(directInventoryRule(
                                "SKU",
                                current.path("itemRef").asText(),
                                skuRef,
                                itemCode,
                                skuCode,
                                unitSnapshotFromItem(current),
                                expectedTargetVersion,
                                null,
                                "1"))));
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
        return matrixSaveBody(
                fixture, itemCode, expectedVersion, size, temperature, small, large, hot, cold, unitRef, null);
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
            String unitRef,
            String productionTagRef) {
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
        if (productionTagRef != null) draft.put("productionTagRef", productionTagRef);
        draft.put("skuVariantDimensions", axes);
        draft.put("skus", skus);
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("expectedCatalogVersion", expectedVersion);
        sections.put("catalogDraft", draft);
        sections.put("inventoryRules", Map.of("nodes", List.of()));
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
        result.put("standardSalePrice", null);
        result.put("isDefault", defaultSku);
        result.put("status", "ENABLED");
        result.put("mediaRefs", List.of());
        result.put("salesUnitOverrideRef", null);
        result.put("baseMeasureUnitOverrideRef", null);
        result.put("identifiers", List.of());
        result.put("preparationOverride", inheritPreparationOverride());
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

    private static void assertCatalogJson(JsonNode json, String pointer, JsonNode expected, String message) {
        JsonNode actual = json.at(pointer);
        assertFalse(actual.isMissingNode(), message + ": missing " + pointer);
        assertCatalogJsonValue(expected, actual, message, pointer);
    }

    /**
     * A registry-bound oracle keeps the operation identity next to the HTTP response it verifies. The operation id is
     * intentionally explicit at each call site so the static gate cannot mistake a family marker for a real oracle.
     */
    private static void assertCatalogOperationOracle(
            JsonNode json, String operationId, String pointer, JsonNode expected, String message) {
        assertFalse(operationId.isBlank(), message + ": operation identity is required");
        JsonNode actual = json.at(pointer);
        assertFalse(actual.isMissingNode(), message + ": missing " + pointer);
        assertCatalogJsonValue(expected, actual, message, pointer);
    }

    /**
     * Compare JSON facts by their wire-level type and value. Jackson may materialize a Java Long expected value as a
     * LongNode while parsing the same HTTP integer back into an IntNode; that implementation width is not a JSON
     * business fact, but numeric kind, exact value, object membership and array order remain asserted here.
     */
    private static void assertCatalogJsonValue(JsonNode expected, JsonNode actual, String message, String pointer) {
        assertEquals(expected.getNodeType(), actual.getNodeType(), message + ": type at " + pointer);
        if (expected.isObject()) {
            assertEquals(expected.size(), actual.size(), message + ": object size at " + pointer);
            var fields = expected.fieldNames();
            while (fields.hasNext()) {
                String field = fields.next();
                assertTrue(actual.has(field), message + ": missing field at " + pointer + "/" + field);
                assertCatalogJsonValue(expected.get(field), actual.get(field), message, pointer + "/" + field);
            }
            return;
        }
        if (expected.isArray()) {
            assertEquals(expected.size(), actual.size(), message + ": array size at " + pointer);
            for (int index = 0; index < expected.size(); index++)
                assertCatalogJsonValue(expected.get(index), actual.get(index), message, pointer + "/" + index);
            return;
        }
        if (expected.isNumber()) {
            assertEquals(
                    expected.isIntegralNumber(), actual.isIntegralNumber(), message + ": numeric kind at " + pointer);
            if (expected.isIntegralNumber())
                assertEquals(
                        expected.bigIntegerValue(),
                        actual.bigIntegerValue(),
                        message + ": numeric value at " + pointer);
            else
                assertEquals(
                        expected.decimalValue().stripTrailingZeros(),
                        actual.decimalValue().stripTrailingZeros(),
                        message + ": numeric value at " + pointer);
            return;
        }
        assertEquals(expected, actual, message + ": value at " + pointer);
    }

    private static Map<String, Object> catalogNavigationCategoryFact(
            JsonNode category,
            String parentCategoryRef,
            long count,
            long directCount,
            long subtreeSize,
            boolean canDelete,
            String blockingReference,
            String blockingCode,
            String blockingName) {
        JsonNode result = category.path("result");
        Map<String, Object> fact = new LinkedHashMap<>();
        fact.put("categoryRef", result.path("categoryRef").asText());
        fact.put("code", result.path("code").asText());
        fact.put("name", result.path("name").asText());
        fact.put("parentCategoryRef", parentCategoryRef);
        fact.put("version", result.path("version").asLong());
        fact.put("displayOrder", result.path("displayOrder").asInt());
        fact.put("count", count);
        fact.put("directCount", directCount);
        fact.put("countSemantics", "SELF_AND_DESCENDANTS");
        Map<String, Object> deletionAvailability = new LinkedHashMap<>();
        deletionAvailability.put("canDelete", canDelete);
        deletionAvailability.put("subtreeSize", subtreeSize);
        deletionAvailability.put("blockingReferenceCount", blockingReference == null ? 0L : 1L);
        Map<String, Object> blockingReferences = new LinkedHashMap<>();
        blockingReferences.put("count", blockingReference == null ? 0L : 1L);
        if (blockingReference == null) blockingReferences.put("references", List.of());
        else {
            blockingReferences.put(
                    "references",
                    List.of(Map.of(
                            "referenceKind",
                            "CATALOG_ITEM",
                            "referenceRef",
                            blockingReference,
                            "code",
                            blockingCode,
                            "name",
                            blockingName,
                            "direction",
                            "INBOUND")));
        }
        deletionAvailability.put("blockingReferences", blockingReferences);
        fact.put("deletionAvailability", deletionAvailability);
        return fact;
    }

    private static void assertCatalogSkuItemsOracle(
            JsonNode json,
            String operationId,
            Map<String, JsonNode> ownerFacts,
            int expectedPageSize,
            String expectedProductionTagName,
            String message) {
        assertFalse(operationId.isBlank(), message + ": operation identity is required");
        JsonNode items = json.at("/data/items");
        assertFalse(items.isMissingNode(), message + ": missing /data/items");
        assertTrue(items.isArray(), message + ": /data/items is an array");
        assertEquals(expectedPageSize, items.size(), message + ": exact page cardinality");
        List<String> expectedRefs = new ArrayList<>(ownerFacts.keySet()).subList(0, expectedPageSize);
        for (int index = 0; index < items.size(); index++) {
            JsonNode actual = items.get(index);
            JsonNode expected = ownerFacts.get(expectedRefs.get(index));
            assertTrue(actual.isObject(), message + ": row is an object at index " + index);
            assertEquals(expectedRefs.get(index), actual.at("/productSkuRef").asText(), message + ": ordered SKU ref");
            assertEquals(expected.at("/skuCode"), actual.at("/skuCode"), message + ": SKU code");
            assertEquals(expected.at("/skuName"), actual.at("/skuName"), message + ": SKU name");
            assertEquals(
                    expected.at("/attributeValueRefs"),
                    actual.at("/attributeValueRefs"),
                    message + ": owner attribute values");
            assertEquals(
                    actual.at("/attributeValueRefs"),
                    actual.at("/attributeFacts"),
                    message + ": structured attribute facts");
            assertEquals(
                    expectedProductionTagName,
                    actual.at("/preparationFacts/productionTag/name").asText(),
                    message + ": preparation production tag");
            assertEquals("SKU", actual.at("/inventoryDeductionSummary/grain").asText(), message + ": SKU grain");
            assertEquals("NONE", actual.at("/inventoryDeductionSummary/mode").asText(), message + ": SKU mode");
        }
    }

    private static Map<String, Object> emptyInventoryChangeSummary() {
        Map<String, Object> emptyPeriod = Map.of("increase", "0", "decrease", "0", "netChange", "0", "entryCount", 0);
        return Map.of("today", emptyPeriod, "sevenDays", emptyPeriod, "thirtyDays", emptyPeriod);
    }

    private static void assertInventoryMutationOperationOracle(
            JsonNode json,
            String operationId,
            String targetRef,
            String before,
            String change,
            String after,
            String stockState,
            String message) {
        assertFalse(operationId.isBlank(), message + ": operation identity is required");
        JsonNode result = json.at("/result");
        assertFalse(result.isMissingNode(), message + ": missing /result");
        assertTrue(result.isObject(), message + ": /result is an object");
        assertEquals(7, result.size(), message + ": result contains the complete typed mutation shape");
        assertEquals(targetRef, result.at("/targetRef").asText(), message + ": targetRef");
        assertEquals(before, result.at("/before").asText(), message + ": before");
        assertEquals(change, result.at("/change").asText(), message + ": change");
        assertEquals(after, result.at("/after").asText(), message + ": after");
        JsonNode ledgerEntryRef = result.at("/ledgerEntryRef");
        assertTrue(ledgerEntryRef.isTextual(), message + ": ledgerEntryRef is typed");
        assertTrue(ledgerEntryRef.asText().matches("[0-9a-f-]{36}"), message + ": ledgerEntryRef is opaque");
        assertEquals(stockState, result.at("/stockState").asText(), message + ": stockState");
        assertTrue(result.at("/version").isIntegralNumber(), message + ": result version is typed");
        assertTrue(json.at("/version").isIntegralNumber(), message + ": response version is typed");
    }

    private static void assertCatalogAbsent(JsonNode json, String pointer, String message) {
        assertTrue(json.at(pointer).isMissingNode(), message + ": unexpected " + pointer);
    }

    private static Map<String, Object> catalogTagFact(String tagRef, String code, String name) {
        return Map.of("tagRef", tagRef, "code", code, "name", name);
    }

    private static Map<String, Object> catalogTagFact(String tagRef, String code, String name, int count) {
        return Map.of("tagRef", tagRef, "code", code, "name", name, "count", count);
    }

    private static Map<String, Object> catalogCategoryFact(String categoryRef, String code, String name) {
        return Map.of("categoryRef", categoryRef, "code", code, "name", name);
    }

    private static void assertInventoryMutationResult(
            JsonNode json, String targetRef, String before, String change, String after, String message) {
        JsonNode actualTargetRef = json.at("/result/targetRef");
        assertTrue(actualTargetRef.isTextual(), message + ": targetRef is typed");
        assertEquals(targetRef, actualTargetRef.asText(), message + ": targetRef");
        JsonNode actualBefore = json.at("/result/before");
        assertTrue(actualBefore.isTextual(), message + ": before is typed");
        assertEquals(before, actualBefore.asText(), message + ": before");
        JsonNode actualChange = json.at("/result/change");
        assertTrue(actualChange.isTextual(), message + ": change is typed");
        assertEquals(change, actualChange.asText(), message + ": change");
        JsonNode actualAfter = json.at("/result/after");
        assertTrue(actualAfter.isTextual(), message + ": after is typed");
        assertEquals(after, actualAfter.asText(), message + ": after");
        JsonNode ledgerEntryRef = json.at("/result/ledgerEntryRef");
        assertTrue(ledgerEntryRef.isTextual(), message + ": ledgerEntryRef is typed");
        assertTrue(ledgerEntryRef.asText().matches("[0-9a-f-]{36}"), message + ": ledgerEntryRef is an opaque UUID");
        JsonNode stockState = json.at("/result/stockState");
        assertTrue(stockState.isTextual() && !stockState.asText().isBlank(), message + ": stockState is typed");
        assertTrue(json.at("/result/version").isIntegralNumber(), message + ": result version is typed");
        assertTrue(json.at("/version").isIntegralNumber(), message + ": response version is typed");
    }

    /* Package-private calibration fixtures. These keep CP-05 recipes on the same real HTTP
     * predecessor chain as the business scenarios without making private scenario helpers a
     * second contract or changing the 80-case acceptance catalog. */
    JsonNode calibrationCreateInventoryMaterial(
            BackendAcceptanceTest.ScenarioContext context, Fixture fixture, Session session, String suffix)
            throws Exception {
        return createInventoryBackedMaterialItem(context, fixture, session, suffix);
    }

    JsonNode calibrationCreatePlainItem(
            BackendAcceptanceTest.ScenarioContext context, Fixture fixture, Session session, String code, String name)
            throws Exception {
        createItemWithAttributes(context, fixture, session, code, name, Map.of());
        return readItem(context, fixture, session, code);
    }

    /** Business-scenario fixture bridge; it delegates to the catalog owner’s existing item chain. */
    JsonNode acceptanceCreatePlainItem(
            BackendAcceptanceTest.ScenarioContext context, Fixture fixture, Session session, String code, String name)
            throws Exception {
        JsonNode item = calibrationCreatePlainItem(context, fixture, session, code, name);
        return enableAcceptanceItem(context, fixture, session, code, item);
    }

    /** Business-scenario bridge for a real Catalog owner rename followed by authoritative readback. */
    JsonNode acceptanceRenamePlainItem(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            String newName)
            throws Exception {
        JsonNode current = readItem(context, fixture, session, itemCode);
        long expectedVersion = current.path("version").asLong();
        Response saved = saveInventoryNodes(
                context,
                fixture,
                session,
                itemCode,
                expectedVersion,
                List.of(),
                draft -> draft.put("name", newName),
                Set.of(200));
        long savedVersion = saved.json().path("version").asLong();
        assertTrue(savedVersion > expectedVersion, "BUSINESS: Catalog owner rename advances the versioned item fact");
        JsonNode readback = readItem(context, fixture, session, itemCode);
        assertEquals(
                newName,
                readback.path("name").asText(),
                "BUSINESS: Catalog owner rename is visible in authoritative readback");
        return readback;
    }

    /** Business-scenario fixture bridge for the existing catalog-to-inventory ITEM target chain. */
    JsonNode acceptanceCreateInventoryBackedPlainItem(
            BackendAcceptanceTest.ScenarioContext context, Fixture fixture, Session session, String code, String name)
            throws Exception {
        CreatedItem created = createItemWithAttributes(context, fixture, session, code, name, Map.of());
        saveDirectItem(context, fixture, session, code, created.version(), "sales-menu inventory fixture");
        return enableAcceptanceItem(context, fixture, session, code, readItem(context, fixture, session, code));
    }

    /** Business-scenario bridge for the inventory owner's real count command; no direct DB fixture is used. */
    void acceptanceCountInventoryTarget(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            JsonNode item,
            String quantity,
            boolean zeroConfirmation,
            String operation)
            throws Exception {
        countTarget(context, fixture, session, inventoryTargetRef(item), quantity, zeroConfirmation, operation);
    }

    /** Business-scenario bridge for the inventory owner's real configuration command. */
    void acceptanceConfigureInventoryTarget(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            JsonNode item,
            boolean allowNegative,
            String lowStockThreshold,
            String operation)
            throws Exception {
        String targetRef = inventoryTargetRef(item);
        Response current = context.get(
                OPERATIONS_INVENTORY_TARGET_READ,
                "/api/operations/catalog-inventory/inventory-targets/"
                        + targetRef
                        + "?dataNodeRef="
                        + fixture.storeId(),
                session.cookie(),
                Set.of(200));
        JsonNode currentConfiguration = current.json().path("configuration");
        JsonNode countingSnapshot = currentConfiguration.path("countingUnitSnapshot");
        Map<String, Object> configuration = new LinkedHashMap<>();
        configuration.put("allowNegative", allowNegative);
        configuration.put("lowStockThreshold", lowStockThreshold);
        configuration.put(
                "countingUnitRef",
                countingSnapshot.isObject() ? countingSnapshot.path("unitRef").asText() : null);
        configuration.put(
                "conversionFactor",
                currentConfiguration.path("conversionFactor").asText("1"));
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("dataNodeRef", fixture.storeId().toString());
        request.put("targetRef", targetRef);
        request.put("expectedVersion", current.json().path("version").asLong());
        request.put("configuration", configuration);
        Response updated = context.patch(
                OPERATIONS_INVENTORY_TARGET_CONFIGURATION,
                "/api/operations/catalog-inventory/inventory-targets/" + targetRef + "/configuration",
                session.cookie(),
                request,
                idempotencyHeaders(operation),
                Set.of(200));
        assertEquals(
                targetRef,
                updated.json().path("target").path("targetRef").asText(),
                "BUSINESS: inventory configuration readback keeps the target identity");
        assertTrue(
                updated.json().path("version").asLong()
                        > current.json().path("version").asLong(),
                "BUSINESS: inventory configuration command advances the target version");
    }

    /** Business-scenario bridge for the inventory owner's real directed adjustment command. */
    void acceptanceAdjustInventoryTarget(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            JsonNode item,
            String direction,
            String quantity,
            String reasonCode,
            String operation)
            throws Exception {
        String targetRef = inventoryTargetRef(item);
        Response current = context.get(
                OPERATIONS_INVENTORY_TARGET_READ,
                "/api/operations/catalog-inventory/inventory-targets/"
                        + targetRef
                        + "?dataNodeRef="
                        + fixture.storeId(),
                session.cookie(),
                Set.of(200));
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("dataNodeRef", fixture.storeId().toString());
        request.put("targetRef", targetRef);
        request.put("expectedVersion", current.json().path("version").asLong());
        request.put("direction", direction);
        request.put("quantity", quantity);
        request.put("countingUnitRef", null);
        request.put("reasonCode", reasonCode);
        request.put("note", "sales-menu availability fixture");
        Response adjusted = context.post(
                OPERATIONS_INVENTORY_TARGET_ADJUST,
                "/api/operations/catalog-inventory/inventory-targets/" + targetRef + "/adjust",
                session.cookie(),
                request,
                idempotencyHeaders(operation),
                Set.of(200));
        String before = current.json().path("balance").asText();
        assertFalse(before.isBlank(), "BUSINESS: inventory target readback exposes a typed balance");
        BigDecimal signedQuantity = new BigDecimal(quantity);
        if ("DECREASE".equals(direction)) signedQuantity = signedQuantity.negate();
        String change = signedQuantity.stripTrailingZeros().toPlainString();
        String after =
                new BigDecimal(before).add(signedQuantity).stripTrailingZeros().toPlainString();
        String stockState =
                new BigDecimal(after).signum() < 0 ? "NEGATIVE" : new BigDecimal(after).signum() == 0 ? "OUT" : "OK";
        assertInventoryMutationOperationOracle(
                adjusted.json(),
                "adjustOperationsInventoryTarget",
                targetRef,
                before,
                change,
                after,
                stockState,
                "BUSINESS: inventory adjustment readback preserves the exact owner mutation result");
    }

    /** Business-scenario fixture bridge for the catalog owner’s existing SKU item chain. */
    JsonNode acceptanceCreateSkuItem(
            BackendAcceptanceTest.ScenarioContext context, Fixture fixture, Session session, String code, String name)
            throws Exception {
        CreatedItem created = createSkuVariantItem(context, fixture, session, code, name);
        String skuCode = "ACCEPTANCE-SKU-" + UUID.randomUUID().toString().substring(0, 8);
        JsonNode current = readItem(context, fixture, session, code);
        saveInventoryNodes(
                context,
                fixture,
                session,
                code,
                created.version(),
                List.of(),
                draft -> {
                    Map<String, Object> sku =
                            acceptanceSkuFact(current, skuCode, List.of(), inheritPreparationOverride());
                    sku.put("standardSalePrice", 1299L);
                    draft.put("skus", List.of(sku));
                },
                Set.of(200));
        return enableAcceptanceItem(context, fixture, session, code, readItem(context, fixture, session, code));
    }

    /** Business-scenario bridge for one Catalog product with two independently selectable enabled SKUs. */
    JsonNode acceptanceCreateSkuItemWithTwoEnabledSkus(
            BackendAcceptanceTest.ScenarioContext context, Fixture fixture, Session session, String code, String name)
            throws Exception {
        CreatedItem created = createSkuVariantItem(context, fixture, session, code, name);
        JsonNode current = readItem(context, fixture, session, code);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        JsonNode attribute = createDictionaryEntry(
                context, fixture, session, "SKU_ATTRIBUTE", "ACC-SALES-MENU-ATTRIBUTE-" + suffix, name + " variant");
        JsonNode valueA = createDictionaryEntry(
                context,
                fixture,
                session,
                "SKU_ATTRIBUTE_VALUE",
                "ACC-SALES-MENU-VALUE-A-" + suffix,
                name + " A",
                attribute.path("entryRef").asText());
        JsonNode valueB = createDictionaryEntry(
                context,
                fixture,
                session,
                "SKU_ATTRIBUTE_VALUE",
                "ACC-SALES-MENU-VALUE-B-" + suffix,
                name + " B",
                attribute.path("entryRef").asText());
        Map<String, Object> first = acceptanceSkuFact(
                current,
                "ACCEPTANCE-SKU-A-" + UUID.randomUUID().toString().substring(0, 8),
                List.of(),
                inheritPreparationOverride());
        first.put("skuName", name + " A");
        first.put("displayOrder", 0);
        first.put("attributeValueRefs", List.of(attributeValueRef(attribute, valueA, 0)));
        first.put("standardSalePrice", 1299L);
        first.put("isDefault", true);
        Map<String, Object> second = acceptanceSkuFact(
                current,
                "ACCEPTANCE-SKU-B-" + UUID.randomUUID().toString().substring(0, 8),
                List.of(),
                inheritPreparationOverride());
        second.put("skuName", name + " B");
        second.put("displayOrder", 1);
        second.put("attributeValueRefs", List.of(attributeValueRef(attribute, valueB, 0)));
        second.put("standardSalePrice", 1499L);
        second.put("isDefault", false);
        saveInventoryNodes(
                context,
                fixture,
                session,
                code,
                created.version(),
                List.of(),
                draft -> {
                    draft.put("skuVariantDimensions", List.of(axis(attribute, List.of(valueA, valueB))));
                    draft.put("skus", List.of(first, second));
                },
                Set.of(200));
        return enableAcceptanceItem(context, fixture, session, code, readItem(context, fixture, session, code));
    }

    /** Business-scenario bridge for a real Catalog SKU lifecycle transition. */
    JsonNode acceptanceSetSkuStatus(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String itemCode,
            String skuCode,
            String status)
            throws Exception {
        JsonNode current = readItem(context, fixture, session, itemCode);
        if ("VOIDED".equals(status)) {
            JsonNode target = StreamSupport.stream(current.path("skus").spliterator(), false)
                    .filter(sku -> skuCode.equals(sku.path("skuCode").asText()))
                    .findFirst()
                    .orElseThrow(() -> new AssertionError("BUSINESS: Catalog SKU status fixture target is absent"));
            Map<String, Object> sections = new LinkedHashMap<>();
            sections.put("expectedCatalogVersion", current.path("version").asLong());
            sections.put(
                    "catalogDraft",
                    Map.of(
                            "name",
                            current.path("name").asText(),
                            "shapeKey",
                            current.path("shapeKey").asText()));
            sections.put("inventoryRules", Map.of("nodes", List.of()));
            Map<String, Object> transition = new LinkedHashMap<>();
            transition.put("skuRef", target.path("productSkuRef").asText());
            transition.put("targetStatus", "VOIDED");
            transition.put("expectedVersion", target.path("version").asLong());
            Response voided = context.patch(
                    OPERATIONS_CATALOG_ITEM_SAVE,
                    itemPath(itemCode),
                    session.cookie(),
                    Map.of(
                            "dataNodeRef",
                            fixture.storeId().toString(),
                            "itemCode",
                            itemCode,
                            "sections",
                            sections,
                            "skuTransitions",
                            List.of(transition)),
                    idempotencyHeaders("sku-void-" + itemCode + "-" + skuCode),
                    Set.of(200));
            assertEquals(
                    "VOIDED",
                    voided.json()
                            .path("result")
                            .path("skuTransitions")
                            .get(0)
                            .path("targetStatus")
                            .asText(),
                    "BUSINESS: Catalog SKU void transition is a real owner fact");
            return readItem(context, fixture, session, itemCode);
        }
        saveInventoryNodes(
                context,
                fixture,
                session,
                itemCode,
                current.path("version").asLong(),
                List.of(),
                draft -> {
                    List<Map<String, Object>> skus = new ArrayList<>();
                    Object rawSkus = draft.get("skus");
                    if (rawSkus instanceof List<?> existingSkus) {
                        for (Object rawSku : existingSkus) {
                            if (!(rawSku instanceof Map<?, ?> existingSku)) continue;
                            Map<String, Object> sku = new LinkedHashMap<>();
                            existingSku.forEach((key, value) -> sku.put(String.valueOf(key), value));
                            if (skuCode.equals(String.valueOf(sku.get("skuCode")))) sku.put("status", status);
                            skus.add(sku);
                        }
                    }
                    draft.put("skus", skus);
                },
                Set.of(200));
        JsonNode readback = readItem(context, fixture, session, itemCode);
        for (JsonNode sku : readback.path("skus")) {
            if (skuCode.equals(sku.path("skuCode").asText())) {
                assertEquals(status, sku.path("status").asText(), "BUSINESS: Catalog SKU status is read back");
                return readback;
            }
        }
        throw new AssertionError("BUSINESS: Catalog SKU status fixture target is absent");
    }

    /** Business-scenario bridge for an ordinary product with required and optional order-option groups. */
    JsonNode acceptanceCreateOrderOptionItem(
            BackendAcceptanceTest.ScenarioContext context, Fixture fixture, Session session, String code, String name)
            throws Exception {
        CreatedItem created = createItemWithAttributes(context, fixture, session, code, name, Map.of());
        JsonNode requiredDefinition = createOrderOptionDefinition(
                context,
                fixture,
                session,
                name + " required options",
                "MULTIPLE",
                List.of(
                        Map.of("name", name + " required A", "displayOrder", 0, "materials", List.of()),
                        Map.of("name", name + " required B", "displayOrder", 1, "materials", List.of()),
                        Map.of("name", name + " required C", "displayOrder", 2, "materials", List.of())));
        JsonNode optionalDefinition = createOrderOptionDefinition(
                context,
                fixture,
                session,
                name + " optional options",
                "SINGLE",
                List.of(
                        Map.of("name", name + " optional A", "displayOrder", 0, "materials", List.of()),
                        Map.of("name", name + " optional B", "displayOrder", 1, "materials", List.of())));
        Map<String, Object> requiredConfig = orderOptionConfig(
                requiredDefinition.path("definitionRef").asText(), true, 1, 2, optionOverrides(requiredDefinition));
        Map<String, Object> optionalConfig = orderOptionConfig(
                optionalDefinition.path("definitionRef").asText(),
                false,
                null,
                null,
                optionOverrides(optionalDefinition));
        optionalConfig.put("displayOrder", 1);
        saveTypedItemFacts(
                context, fixture, session, code, created.version(), List.of(), List.of(requiredConfig, optionalConfig));
        return enableAcceptanceItem(context, fixture, session, code, readItem(context, fixture, session, code));
    }

    private static List<Map<String, Object>> optionOverrides(JsonNode definition) {
        List<Map<String, Object>> values = new ArrayList<>();
        for (JsonNode value : definition.path("values")) {
            values.add(optionOverride(value.path("valueRef").asText(), false, null, 0L, List.of()));
        }
        return values;
    }

    /** Business-scenario fixture bridge for the catalog owner’s existing shape-specific create chain. */
    JsonNode acceptanceCreateItemWithShape(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String code,
            String name,
            String shapeKey)
            throws Exception {
        createItemWithShape(
                context, fixture, session, fixture.storeId().toString(), code, name, Map.of(), Map.of(), shapeKey);
        return enableAcceptanceItem(context, fixture, session, code, readItem(context, fixture, session, code));
    }

    /**
     * Sales-menu and asset business scenarios need an enabled catalog predecessor. The generic catalog create fixture
     * intentionally preserves its owner default (DISABLED), so this bridge performs the existing real HTTP status
     * transition and reads the authoritative item back instead of changing catalog semantics for other cases.
     */
    private JsonNode enableAcceptanceItem(
            BackendAcceptanceTest.ScenarioContext context, Fixture fixture, Session session, String code, JsonNode item)
            throws Exception {
        Response enabled = context.post(
                OPERATIONS_CATALOG_ITEM_STATUS,
                itemPath(code) + "/status",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        fixture.storeId().toString(),
                        "itemCode",
                        code,
                        "expectedVersion",
                        item.path("version").asLong(),
                        "targetStatus",
                        "ENABLED"),
                Set.of(200));
        assertEquals(
                "ENABLED",
                enabled.json().path("result").path("status").asText(),
                "BUSINESS: sales-menu predecessor is enabled through the catalog owner command");
        JsonNode readback = readItem(context, fixture, session, code);
        assertEquals(
                "ENABLED",
                readback.path("lifecycle").path("status").asText(),
                "BUSINESS: sales-menu predecessor status is enabled in authoritative catalog readback");
        return readback;
    }

    /**
     * Creates the same minimal catalog item through the real HTTP command at an explicitly selected catalog node.
     *
     * <p>This is intentionally a calibration fixture rather than a second request shape: head-company catalog facts
     * require the caller's selected brand context, whereas the store helper above correctly relies on the session's
     * default store context.
     */
    void calibrationCreatePlainItemAtNode(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String dataNodeRef,
            String code,
            String name,
            Map<String, String> headers)
            throws Exception {
        createItemWithAttributes(context, fixture, session, dataNodeRef, code, name, Map.of(), headers);
    }

    JsonNode calibrationCreateUnit(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String code,
            String name,
            String dimension,
            int precision)
            throws Exception {
        return createAcceptanceUnit(context, fixture, session, code, name, dimension, precision);
    }

    void calibrationCreateProductionTag(
            BackendAcceptanceTest.ScenarioContext context, Fixture fixture, Session session, String code, String name)
            throws Exception {
        createProductionTag(context, fixture, session, code, name);
    }

    JsonNode calibrationCreateDictionaryEntry(
            BackendAcceptanceTest.ScenarioContext context,
            Fixture fixture,
            Session session,
            String kind,
            String code,
            String name)
            throws Exception {
        return createDictionaryEntry(context, fixture, session, kind, code, name);
    }

    JsonNode calibrationReadItem(
            BackendAcceptanceTest.ScenarioContext context, Fixture fixture, Session session, String code)
            throws Exception {
        return readItem(context, fixture, session, code);
    }

    static String calibrationInventoryTargetRef(JsonNode item) {
        return inventoryTargetRef(item);
    }
}
