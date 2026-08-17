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
        ObjectNode catalogPage = mapper.createObjectNode();
        catalogPage
                .putObject("data")
                .putArray("items")
                .addObject()
                .put("itemRef", itemRef.toString())
                .put("name", "咖啡豆")
                .put("shapeKey", "MATERIAL")
                .putArray("skus");
        when(inventory.readTarget(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(inventoryDetail);
        when(catalog.readItems(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.any(ObjectNode.class),
                        org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(catalogPage);

        service.readInventoryTarget("scope", "brand", "target", "request", "STORE");

        verify(catalog)
                .readItems(
                        org.mockito.ArgumentMatchers.eq("scope"),
                        org.mockito.ArgumentMatchers.eq("brand"),
                        org.mockito.ArgumentMatchers.argThat(
                                value -> value.path("itemRefs").path(0).asText().equals(itemRef.toString())),
                        org.mockito.ArgumentMatchers.eq("request"));
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
    void catalogItemDetailIncludesInventoryTargetAsVoidBlockingReference() {
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
        detail.putObject("data").putObject("item").put("itemRef", itemRef.toString());
        ObjectNode data = (ObjectNode) detail.path("data");
        data.putObject("actionAvailability")
                .putObject("voidAvailability")
                .put("canVoid", true)
                .putArray("blockingReferences");
        ((ObjectNode) data.path("actionAvailability").path("voidAvailability")).putArray("dependentFacts");
        ObjectNode definition = mapper.createObjectNode();
        definition.putObject("data").putArray("nodes").addObject().put("targetRef", targetRef.toString());
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
        verify(production, never())
                .readTags(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void copyBridgeCarriesOpaqueItemAndProductionTagRefsRatherThanCodes() {
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
                mapper.convertValue(plan.productionTagRefs(), java.util.List.class));
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
    void catalogSaveInventoryReadbackRequiresEnvelopeDataAndNonBlankTargetRef() {
        CatalogInventoryCoordinator service =
                new CatalogInventoryCoordinator(null, null, null, null, new ObjectMapper(), null, null);

        Object result = parseCatalogSaveOwnerReadback(
                service,
                "{\"revision\":\"v1\",\"requestId\":\"req-1\",\"data\":{\"targetRef\":\"target-1\",\"version\":1,\"crea"
                        + "ted\":true}}");
        assertFalse(result == null);

        CatalogOwnerApi.Problem absentData = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> parseCatalogSaveOwnerReadback(service, "{\"targetRef\":\"target-1\"}"));
        assertEquals("RESULT_UNKNOWN", absentData.code());

        CatalogOwnerApi.Problem blankTargetRef = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> parseCatalogSaveOwnerReadback(
                        service, "{\"data\":{\"targetRef\":\"\",\"version\":1,\"created\":true}}"));
        assertEquals("RESULT_UNKNOWN", blankTargetRef.code());

        CatalogOwnerApi.Problem incompleteOwnerPayload = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> parseCatalogSaveOwnerReadback(service, "{\"data\":{\"targetRef\":\"target-1\"}}"));
        assertEquals("RESULT_UNKNOWN", incompleteOwnerPayload.code());

        CatalogOwnerApi.Problem unknownOwnerPayload = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> parseCatalogSaveOwnerReadback(
                        service,
                        "{\"data\":{\"targetRef\":\"target-1\",\"version\":1,\"created\":true,\"unexpected\":true}}"));
        assertEquals("RESULT_UNKNOWN", unknownOwnerPayload.code());
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

    private static Object parseCatalogSaveOwnerReadback(CatalogInventoryCoordinator service, String canonicalJson) {
        try {
            Method method =
                    CatalogInventoryCoordinator.class.getDeclaredMethod("parseCatalogSaveOwnerReadback", String.class);
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
