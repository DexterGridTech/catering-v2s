package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class CatalogInventoryCoordinatorCopySourceAuthorityTest {
    @Test
    void workbenchContextExplainsUnavailableCopySourceAndClearsReasonWhenAvailable() {
        ObjectMapper mapper = new ObjectMapper();
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        CatalogScopeLookup scopes = mock(CatalogScopeLookup.class);
        UUID dataNodeRef = UUID.randomUUID();
        UUID workspaceUuid = UUID.randomUUID();
        UUID sourceDataNodeRef = UUID.randomUUID();
        ObjectNode base = mapper.createObjectNode();
        base.putObject("data")
                .putObject("actionAvailability")
                .put("canCreate", true)
                .put("canEdit", true)
                .put("canCopy", true)
                .putArray("reasons");
        when(catalog.readWorkbenchContext(dataNodeRef.toString(), "brand", "request"))
                .thenReturn(base.deepCopy(), base.deepCopy());
        when(scopes.resolveCatalogCopySource(workspaceUuid, "group", "STORE", dataNodeRef, "brand"))
                .thenThrow(new IllegalArgumentException("source not authorized"))
                .thenReturn(sourceDataNodeRef);
        CatalogInventoryCoordinator service =
                new CatalogInventoryCoordinator(catalog, null, null, null, mapper, null, scopes);

        var unavailable = service.readCatalogWorkbenchContext(
                        dataNodeRef.toString(), "brand", "request", "STORE", "head-company", workspaceUuid, "group")
                .path("data");
        assertFalse(unavailable.path("copySourceAvailable").asBoolean());
        assertFalse(unavailable.path("actionAvailability").path("canCopy").asBoolean());
        assertEquals(1, unavailable.path("actionAvailability").path("reasons").size());
        assertEquals(
                "COPY_SOURCE_UNAVAILABLE",
                unavailable.path("actionAvailability").path("reasons").get(0).asText());
        assertTrue(unavailable.path("actionAvailability").path("canCreate").asBoolean());
        assertTrue(unavailable.path("actionAvailability").path("canEdit").asBoolean());

        var available = service.readCatalogWorkbenchContext(
                        dataNodeRef.toString(), "brand", "request", "STORE", "head-company", workspaceUuid, "group")
                .path("data");
        assertTrue(available.path("copySourceAvailable").asBoolean());
        assertTrue(available.path("actionAvailability").path("canCopy").asBoolean());
        assertTrue(available.path("actionAvailability").path("reasons").isEmpty());
    }

    @Test
    void inventoryCatalogFilterDoesNotMaterializeOrRejectLargeCatalogResults() {
        ObjectMapper mapper = new ObjectMapper();
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        CatalogInventoryCoordinator service =
                new CatalogInventoryCoordinator(catalog, inventory, null, null, mapper, null, null);
        ObjectNode inventoryPage = mapper.createObjectNode();
        inventoryPage.putObject("data").putArray("items");
        when(inventory.readTargets(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.any(ObjectNode.class),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(inventoryPage);

        assertEquals(
                inventoryPage,
                service.readInventoryTargets(
                        "scope", "brand", mapper.createObjectNode().put("keyword", "latte"), "request", "STORE"));

        verifyNoInteractions(catalog);
        verify(inventory)
                .readTargets(
                        org.mockito.ArgumentMatchers.eq("scope"),
                        org.mockito.ArgumentMatchers.eq("brand"),
                        org.mockito.ArgumentMatchers.any(ObjectNode.class),
                        org.mockito.ArgumentMatchers.eq("request"),
                        org.mockito.ArgumentMatchers.eq("STORE"));
    }

    @Test
    void inventoryCatalogCategoryFilterIsForwardedToTheSetBasedOwnerRead() {
        ObjectMapper mapper = new ObjectMapper();
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        CatalogInventoryCoordinator service =
                new CatalogInventoryCoordinator(catalog, inventory, null, null, mapper, null, null);
        ObjectNode inventoryPage = mapper.createObjectNode();
        inventoryPage.putObject("data").putArray("items");
        when(inventory.readTargets(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.any(ObjectNode.class),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(inventoryPage);

        assertEquals(
                inventoryPage,
                service.readInventoryTargets(
                        "scope",
                        "brand",
                        mapper.createObjectNode()
                                .put("categoryRef", UUID.randomUUID().toString())
                                .put("includeSubCategories", true),
                        "request",
                        "STORE"));

        verifyNoInteractions(catalog);
        verify(inventory)
                .readTargets(
                        org.mockito.ArgumentMatchers.eq("scope"),
                        org.mockito.ArgumentMatchers.eq("brand"),
                        org.mockito.ArgumentMatchers.argThat(
                                value -> value.path("categoryRef").isTextual()
                                        && value.path("includeSubCategories").asBoolean()),
                        org.mockito.ArgumentMatchers.eq("request"),
                        org.mockito.ArgumentMatchers.eq("STORE"));
    }

    @Test
    void inventoryCatalogKeywordRemainsAvailableToTheSetBasedOwnerRead() {
        ObjectMapper mapper = new ObjectMapper();
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        CatalogInventoryCoordinator service =
                new CatalogInventoryCoordinator(catalog, inventory, null, null, mapper, null, null);
        ObjectNode inventoryPage = mapper.createObjectNode();
        inventoryPage.putObject("data").putArray("items");
        when(inventory.readTargets(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.any(ObjectNode.class),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(inventoryPage);

        service.readInventoryTargets(
                "scope", "brand", mapper.createObjectNode().put("keyword", "咖啡豆"), "request", "STORE");

        ArgumentCaptor<ObjectNode> forwarded = ArgumentCaptor.forClass(ObjectNode.class);
        verify(inventory)
                .readTargets(
                        org.mockito.ArgumentMatchers.eq("scope"),
                        org.mockito.ArgumentMatchers.eq("brand"),
                        forwarded.capture(),
                        org.mockito.ArgumentMatchers.eq("request"),
                        org.mockito.ArgumentMatchers.eq("STORE"));
        assertEquals("咖啡豆", forwarded.getValue().path("keyword").asText());
        verifyNoInteractions(catalog);
    }

    @Test
    void inventoryTargetListUsesCatalogCategoryNameInsteadOfOpaqueCategoryRef() {
        ObjectMapper mapper = new ObjectMapper();
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        CatalogInventoryCoordinator service =
                new CatalogInventoryCoordinator(catalog, inventory, null, null, mapper, null, null);
        UUID itemRef = UUID.randomUUID();
        ObjectNode inventoryPage = mapper.createObjectNode();
        inventoryPage.putObject("data").putArray("items").addObject().put("itemRef", itemRef.toString());
        when(inventory.readTargets(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.any(ObjectNode.class),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(inventoryPage);
        when(catalog.readInventoryDisplayFacts(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyList()))
                .thenReturn(List.of(inventoryDisplayFact(itemRef)));

        JsonNode result = service.readInventoryTargets("scope", "brand", mapper.createObjectNode(), "request", "STORE");

        assertEquals(
                "beverage",
                result.path("data").path("items").path(0).path("categoryName").asText());
        verify(catalog)
                .readInventoryDisplayFacts(
                        org.mockito.ArgumentMatchers.eq("scope"),
                        org.mockito.ArgumentMatchers.eq("brand"),
                        org.mockito.ArgumentMatchers.eq(List.of(itemRef)));
        verify(catalog, never())
                .readItems(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.any(ObjectNode.class),
                        org.mockito.ArgumentMatchers.anyString());
        verify(catalog, never())
                .readNavigation(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.any(ObjectNode.class),
                        org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void inventoryTargetDetailKeepsTheGenericReadItemsProjection() {
        ObjectMapper mapper = new ObjectMapper();
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        CatalogInventoryCoordinator service =
                new CatalogInventoryCoordinator(catalog, inventory, null, null, mapper, null, null);
        UUID itemRef = UUID.randomUUID();
        ObjectNode target = mapper.createObjectNode().put("itemRef", itemRef.toString());
        ObjectNode inventoryDetail = mapper.createObjectNode();
        inventoryDetail.putObject("target").set("itemRef", target.path("itemRef"));
        when(inventory.readTarget(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(inventoryDetail);
        when(catalog.readInventoryTargetDisplayFact(
                        org.mockito.ArgumentMatchers.eq("scope"),
                        org.mockito.ArgumentMatchers.eq("brand"),
                        org.mockito.ArgumentMatchers.eq(itemRef),
                        org.mockito.ArgumentMatchers.isNull()))
                .thenReturn(new CatalogOwnerApi.InventoryTargetDisplayFact(itemRef, "咖啡豆", "MATERIAL", null));

        service.readInventoryTarget("scope", "brand", "target", "request", "STORE");

        verify(catalog).readInventoryTargetDisplayFact("scope", "brand", itemRef, null);
        verify(catalog, never())
                .readItems(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.any(ObjectNode.class),
                        org.mockito.ArgumentMatchers.anyString());
        verify(catalog, never())
                .readInventoryDisplayFacts(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyList());
    }

    private static CatalogOwnerApi.InventoryDisplayFact inventoryDisplayFact(UUID itemRef) {
        return new CatalogOwnerApi.InventoryDisplayFact(itemRef, "coffee beans", "default", "MATERIAL", "beverage");
    }

    @Test
    void catalogItemDetailExplainsBomConsumptionAsItsOwnVoidBlockingReason() {
        ObjectMapper mapper = new ObjectMapper();
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi production =
                mock(com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi.class);
        CatalogInventoryCoordinator service =
                new CatalogInventoryCoordinator(catalog, inventory, production, null, mapper, null, null);
        UUID itemRef = UUID.randomUUID();
        UUID targetRef = UUID.randomUUID();
        ObjectNode detail = mapper.createObjectNode();
        detail.putObject("data")
                .putObject("item")
                .put("itemRef", itemRef.toString())
                .put("code", "ITEM-1")
                .put("name", "测试商品")
                .put("shapeKey", "STANDARD_SALE_COUNTED");
        ObjectNode data = (ObjectNode) detail.path("data");
        data.putObject("actionAvailability")
                .putObject("voidAvailability")
                .put("canVoid", true)
                .putArray("blockingReferences");
        ((ObjectNode) data.path("actionAvailability").path("voidAvailability")).putArray("dependentFacts");
        ObjectNode definition = mapper.createObjectNode();
        ObjectNode inventoryNode = definition
                .putObject("data")
                .putObject("inventoryRules")
                .putArray("nodes")
                .addObject();
        inventoryNode
                .putObject("owner")
                .put("ownerType", "ITEM")
                .put("itemRef", itemRef.toString())
                .putNull("productSkuRef")
                .putNull("optionValueRef");
        inventoryNode.put("mode", "BOM").putNull("directConfiguration");
        inventoryNode.putObject("bom").putArray("lines").addObject().put("targetRef", targetRef.toString());
        when(catalog.readItem(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(detail);
        when(inventory.readCatalogInventoryDefinition(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(definition);
        JsonNode result = service.readCatalogItem("scope", "brand", "ITEM-1", mapper.createObjectNode(), "request");
        JsonNode availability = result.path("data").path("actionAvailability").path("voidAvailability");

        assertFalse(availability.path("canVoid").asBoolean());
        assertEquals(
                targetRef.toString(),
                availability
                        .path("blockingReferences")
                        .path(0)
                        .path("referenceRef")
                        .asText());
        assertEquals(
                "INVENTORY_BOM",
                availability.path("dependentFacts").path(0).path("factKind").asText());
        assertEquals("已配置用料", availability.path("blockingReasons").path(0).path("label").asText());
        assertEquals(1, availability.path("blockingReasons").path(0).path("count").asInt());
        verify(production, never())
                .readTags(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.any(com.fasterxml.jackson.databind.node.ObjectNode.class),
                org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void catalogItemDetailExplainsWhenAnInventoryTargetBlocksSkuVoid() {
        ObjectMapper mapper = new ObjectMapper();
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        CatalogInventoryCoordinator service =
                new CatalogInventoryCoordinator(catalog, inventory, null, null, mapper, null, null);
        UUID itemRef = UUID.randomUUID();
        UUID skuRef = UUID.randomUUID();
        UUID targetRef = UUID.randomUUID();
        ObjectNode detail = mapper.createObjectNode();
        ObjectNode item = detail.putObject("data")
                .putObject("item")
                .put("itemRef", itemRef.toString())
                .put("code", "ITEM-1")
                .put("name", "测试商品")
                .put("shapeKey", "SKU_MANAGED");
        ObjectNode skuAvailability = item.putArray("skus")
                .addObject()
                .put("productSkuRef", skuRef.toString())
                .put("skuCode", "ITEM-1-S")
                .put("status", "ENABLED")
                .putObject("voidAvailability");
        skuAvailability.put("canVoid", true).putArray("blockingReferences");
        skuAvailability.putArray("dependentFacts").removeAll();
        skuAvailability.putArray("blockingReasons").removeAll();
        ObjectNode definition = mapper.createObjectNode();
        ObjectNode inventoryNode = definition
                .putObject("data")
                .putObject("inventoryRules")
                .putArray("nodes")
                .addObject();
        inventoryNode
                .putObject("owner")
                .put("ownerType", "SKU")
                .put("itemRef", itemRef.toString())
                .put("productSkuRef", skuRef.toString())
                .putNull("optionValueRef");
        inventoryNode.put("mode", "DIRECT").putObject("directConfiguration").put("targetRef", targetRef.toString());
        inventoryNode.putNull("bom");
        when(catalog.readItem(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(detail);
        when(inventory.readCatalogInventoryDefinition(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(definition);

        JsonNode availability = service
                .readCatalogItem("scope", "brand", "ITEM-1", mapper.createObjectNode(), "request")
                .path("data")
                .path("item")
                .path("skus")
                .path(0)
                .path("voidAvailability");

        assertFalse(availability.path("canVoid").asBoolean());
        assertEquals("INVENTORY_TARGET", availability.path("dependentFacts").path(0).path("factKind").asText());
        assertEquals("已配置库存对象", availability.path("blockingReasons").path(0).path("label").asText());
        assertEquals(1, availability.path("blockingReasons").path(0).path("count").asInt());
        JsonNode itemAvailability = service
                .readCatalogItem("scope", "brand", "ITEM-1", mapper.createObjectNode(), "request")
                .path("data")
                .path("actionAvailability")
                .path("voidAvailability");
        assertFalse(itemAvailability.path("canVoid").asBoolean());
        assertEquals("INVENTORY_TARGET", itemAvailability.path("dependentFacts").path(0).path("factKind").asText());
        assertEquals("已配置库存对象", itemAvailability.path("blockingReasons").path(0).path("label").asText());
        assertEquals(1, itemAvailability.path("blockingReasons").path(0).path("count").asInt());
    }

    @Test
    void catalogItemDetailKeepsBomFactKindForBothSkuAndItemVoidAvailability() {
        ObjectMapper mapper = new ObjectMapper();
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        CatalogInventoryCoordinator service =
                new CatalogInventoryCoordinator(catalog, inventory, null, null, mapper, null, null);
        UUID itemRef = UUID.randomUUID();
        UUID skuRef = UUID.randomUUID();
        UUID targetRef = UUID.randomUUID();
        ObjectNode detail = mapper.createObjectNode();
        ObjectNode item = detail.putObject("data")
                .putObject("item")
                .put("itemRef", itemRef.toString())
                .put("code", "ITEM-1")
                .put("name", "测试商品")
                .put("shapeKey", "SKU_MANAGED");
        ObjectNode skuAvailability = item.putArray("skus")
                .addObject()
                .put("productSkuRef", skuRef.toString())
                .put("skuCode", "ITEM-1-S")
                .put("status", "ENABLED")
                .putObject("voidAvailability");
        skuAvailability.put("canVoid", true).putArray("blockingReferences");
        skuAvailability.putArray("dependentFacts").removeAll();
        skuAvailability.putArray("blockingReasons").removeAll();
        ObjectNode definition = mapper.createObjectNode();
        ObjectNode inventoryNode = definition
                .putObject("data")
                .putObject("inventoryRules")
                .putArray("nodes")
                .addObject();
        inventoryNode
                .putObject("owner")
                .put("ownerType", "SKU")
                .put("itemRef", itemRef.toString())
                .put("productSkuRef", skuRef.toString())
                .putNull("optionValueRef");
        inventoryNode.put("mode", "BOM").putNull("directConfiguration");
        inventoryNode.putObject("bom").putArray("lines").addObject().put("targetRef", targetRef.toString());
        when(catalog.readItem(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(detail);
        when(inventory.readCatalogInventoryDefinition(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(definition);

        JsonNode result = service.readCatalogItem("scope", "brand", "ITEM-1", mapper.createObjectNode(), "request");
        JsonNode skuAvailabilityResult = result.path("data").path("item").path("skus").path(0).path("voidAvailability");
        JsonNode itemAvailability = result.path("data").path("actionAvailability").path("voidAvailability");
        for (JsonNode availability : List.of(skuAvailabilityResult, itemAvailability)) {
            assertFalse(availability.path("canVoid").asBoolean());
            assertEquals("INVENTORY_BOM", availability.path("dependentFacts").path(0).path("factKind").asText());
            assertEquals("已配置用料", availability.path("blockingReasons").path(0).path("label").asText());
        }
    }

    @Test
    void copyBridgeCarriesOpaqueItemAndProductionTagDefinitionRefsRatherThanCodes() {
        CatalogInventoryCoordinator service =
                new CatalogInventoryCoordinator(null, null, null, null, new ObjectMapper(), null, null);
        ObjectMapper mapper = new ObjectMapper();
        UUID itemRef = UUID.randomUUID();
        UUID targetItemRef = UUID.randomUUID();
        UUID tagRef = UUID.randomUUID();
        UUID targetTagRef = UUID.randomUUID();
        ObjectNode preflight = mapper.createObjectNode();
        var mappings = preflight.putArray("referenceMappings");
        mappings.addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("sourceRef", itemRef.toString())
                .put("targetRef", targetItemRef.toString())
                .put("targetCode", "LATTE");
        mappings.addObject()
                .put("objectType", "PRODUCTION_TAG")
                .put("sourceRef", tagRef.toString())
                .put("targetRef", targetTagRef.toString())
                .put("targetCode", "HOT_DISH");

        CatalogInventoryCoordinator.CopyReferencePlan plan = service.copyReferencePlan(preflight);

        assertEquals(
                java.util.List.of(itemRef.toString()),
                mapper.convertValue(plan.closureItemRefs(), java.util.List.class));
        assertEquals(
                java.util.List.of(tagRef.toString()),
                mapper.convertValue(plan.productionTagDefinitionRefs(), java.util.List.class));
        assertEquals(
                targetItemRef.toString(),
                plan.referenceMappings().get(0).path("targetRef").asText());
    }

    @Test
    void mergedClosureLimitCountsCrossOwnerObjectsAfterDeDuplication() {
        CatalogInventoryCoordinator service =
                new CatalogInventoryCoordinator(null, null, null, null, new ObjectMapper(), null, null);
        ObjectMapper mapper = new ObjectMapper();
        ObjectNode data = mapper.createObjectNode().put("closureLimit", 2);
        ArrayNode closureItems = data.putArray("closureItems");
        closureItems.addObject().put("objectType", "CATALOG_ITEM").put("code", "LATTE-001");
        closureItems.addObject().put("objectType", "CATALOG_ITEM").put("code", "LATTE-001");
        closureItems.addObject().put("objectType", "STOCK_TARGET").put("code", "LATTE-001|M");
        closureItems.addObject().put("objectType", "PRODUCTION_TAG").put("code", "HOT-DISH");

        CatalogOwnerApi.Problem failure =
                assertThrows(CatalogOwnerApi.Problem.class, () -> service.enforceMergedClosureLimit(data));

        assertEquals("COPY_CLOSURE_TOO_LARGE", failure.code());
    }

    @Test
    void catalogSaveRequestCanonicalizationRejectsMalformedEnvelope() {
        CatalogInventoryCoordinator service =
                new CatalogInventoryCoordinator(null, null, null, null, new ObjectMapper(), null, null);
        ObjectMapper mapper = new ObjectMapper();

        Object result = canonicalSaveRequest(
                service, "{\"itemCode\":\"LATTE-001\",\"sections\":{\"catalogDraft\":{\"name\":\"拿铁\"}}}");
        assertFalse(result == null);

        CatalogOwnerApi.Problem invalidJson =
                assertThrows(CatalogOwnerApi.Problem.class, () -> canonicalSaveRequest(service, "not-json"));
        assertEquals("VALIDATION_ERROR", invalidJson.code());

        CatalogOwnerApi.Problem nonObject =
                assertThrows(CatalogOwnerApi.Problem.class, () -> canonicalSaveRequest(service, "[]"));
        assertEquals("VALIDATION_ERROR", nonObject.code());

        ObjectNode oversizedRequest = mapper.createObjectNode();
        oversizedRequest
                .putObject("sections")
                .putObject("catalogDraft")
                .putObject("preparationProfile")
                .put("preparationNotes", "x".repeat(256 * 1024));
        CatalogOwnerApi.Problem oversizedDraft = assertThrows(
                CatalogOwnerApi.Problem.class, () -> canonicalSaveRequest(service, oversizedRequest.toString()));
        assertEquals("VALIDATION_ERROR", oversizedDraft.code());

        CatalogOwnerApi.Problem malformedRequest =
                assertThrows(CatalogOwnerApi.Problem.class, () -> canonicalSaveRequest(service, "null"));
        assertEquals("VALIDATION_ERROR", malformedRequest.code());
    }

    @Test
    void compatibilityDispositionsUseStableIdsAndIgnoreBlockedFacts() {
        ObjectMapper mapper = new ObjectMapper();
        ArrayNode results = mapper.createArrayNode();
        results.add(compatibilityResult(mapper, "CATALOG_ITEM", "CATALOG_ITEM:item-1", "REUSE"));
        results.add(compatibilityResult(mapper, "STOCK_TARGET", "STOCK_TARGET:item-1:sku-1", "CREATE"));
        results.add(compatibilityResult(mapper, "PRODUCTION_TAG", "PRODUCTION_TAG:tag-1", "BLOCKED"));

        CatalogInventoryCoordinator.validateCompatibilityDispositions(
                results,
                List.of(
                        new CatalogOwnerApi.CompatibilityDisposition("STOCK_TARGET:item-1:sku-1", "CONFIRM"),
                        new CatalogOwnerApi.CompatibilityDisposition("CATALOG_ITEM:item-1", "CONFIRM")));
    }

    @Test
    void confirmationCountUsesEveryNonBlockedCatalogAndOwnerCompatibilityFact() {
        ObjectMapper mapper = new ObjectMapper();
        ArrayNode results = mapper.createArrayNode();
        results.add(compatibilityResult(mapper, "CATALOG_ITEM", "CATALOG_ITEM:item-1", "REUSE"));
        results.add(compatibilityResult(mapper, "STOCK_TARGET", "STOCK_TARGET:item-1:sku-1", "CREATE"));
        results.add(compatibilityResult(mapper, "PRODUCTION_TAG", "PRODUCTION_TAG:tag-1", "BLOCKED"));

        assertEquals(2, CatalogInventoryCoordinator.requiredCompatibilityCount(results));
    }

    @Test
    void compatibilityDispositionsRejectUnknownDuplicateOrMissingIdentity() {
        ObjectMapper mapper = new ObjectMapper();
        ArrayNode results = mapper.createArrayNode();
        results.add(compatibilityResult(mapper, "CATALOG_ITEM", "CATALOG_ITEM:item-1", "REUSE"));

        CatalogOwnerApi.Problem unknown = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> CatalogInventoryCoordinator.validateCompatibilityDispositions(
                        results,
                        List.of(new CatalogOwnerApi.CompatibilityDisposition("CATALOG_ITEM:other", "CONFIRM"))));
        assertEquals("VALIDATION_ERROR", unknown.code());

        CatalogOwnerApi.Problem duplicate = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> CatalogInventoryCoordinator.validateCompatibilityDispositions(
                        results,
                        List.of(
                                new CatalogOwnerApi.CompatibilityDisposition("CATALOG_ITEM:item-1", "CONFIRM"),
                                new CatalogOwnerApi.CompatibilityDisposition("CATALOG_ITEM:item-1", "CONFIRM"))));
        assertEquals("VALIDATION_ERROR", duplicate.code());

        CatalogOwnerApi.Problem missing = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> CatalogInventoryCoordinator.validateCompatibilityDispositions(results, List.of()));
        assertEquals("VALIDATION_ERROR", missing.code());
    }

    private static ObjectNode compatibilityResult(
            ObjectMapper mapper, String objectType, String compatibilityId, String result) {
        ObjectNode row = mapper.createObjectNode()
                .put("objectType", objectType)
                .put("compatibilityId", compatibilityId)
                .put("result", result)
                .put("reason", "test compatibility fact")
                .put("reasonCode", "REUSE_CONFIRMATION_REQUIRED");
        row.putObject("canonicalTuple")
                .put(
                        "ownerRef",
                        UUID.fromString("00000000-0000-0000-0000-000000000001").toString())
                .put("brandRef", "brand")
                .put("objectType", objectType)
                .putArray("parts")
                .add(compatibilityId);
        return row;
    }

    private static Object canonicalSaveRequest(CatalogInventoryCoordinator service, String canonicalJson) {
        try {
            Method method = CatalogInventoryCoordinator.class.getDeclaredMethod("canonicalSaveRequest", String.class);
            method.setAccessible(true);
            return method.invoke(service, canonicalJson);
        } catch (InvocationTargetException failure) {
            if (failure.getCause() instanceof RuntimeException runtime) throw runtime;
            throw new AssertionError(failure.getCause());
        } catch (ReflectiveOperationException failure) {
            throw new AssertionError(failure);
        }
    }
}
