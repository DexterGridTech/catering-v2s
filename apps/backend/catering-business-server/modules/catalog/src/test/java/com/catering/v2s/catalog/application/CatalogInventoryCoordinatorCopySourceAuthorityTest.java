package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.UUID;
import org.junit.jupiter.api.Test;

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
        base.putObject("data").putObject("actionAvailability")
            .put("canCreate", true).put("canEdit", true).put("canCopy", true).putArray("reasons");
        when(catalog.readWorkbenchContext(dataNodeRef.toString(), "brand", "request"))
            .thenReturn(base.deepCopy(), base.deepCopy());
        when(scopes.resolveCatalogCopySource(workspaceUuid, "group", "STORE", dataNodeRef, "brand"))
            .thenThrow(new IllegalArgumentException("source not authorized"))
            .thenReturn(sourceDataNodeRef);
        CatalogInventoryCoordinator service = new CatalogInventoryCoordinator(
            catalog, null, null, null, mapper, null, scopes
        );

        var unavailable = service.readCatalogWorkbenchContext(dataNodeRef.toString(), "brand", "request",
            "STORE", "head-company", workspaceUuid, "group").path("data");
        assertFalse(unavailable.path("copySourceAvailable").asBoolean());
        assertFalse(unavailable.path("actionAvailability").path("canCopy").asBoolean());
        assertEquals(1, unavailable.path("actionAvailability").path("reasons").size());
        assertEquals("COPY_SOURCE_UNAVAILABLE", unavailable.path("actionAvailability").path("reasons").get(0).asText());
        assertTrue(unavailable.path("actionAvailability").path("canCreate").asBoolean());
        assertTrue(unavailable.path("actionAvailability").path("canEdit").asBoolean());

        var available = service.readCatalogWorkbenchContext(dataNodeRef.toString(), "brand", "request",
            "STORE", "head-company", workspaceUuid, "group").path("data");
        assertTrue(available.path("copySourceAvailable").asBoolean());
        assertTrue(available.path("actionAvailability").path("canCopy").asBoolean());
        assertTrue(available.path("actionAvailability").path("reasons").isEmpty());
    }

    @Test
    void inventoryPrefilterRejectsMoreThanFiveThousandCatalogItemsBeforeCallingInventory() {
        ObjectMapper mapper = new ObjectMapper();
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        CatalogInventoryCoordinator service = new CatalogInventoryCoordinator(
            catalog, inventory, null, null, mapper, null, null
        );
        ObjectNode catalogPage = mapper.createObjectNode();
        catalogPage.putObject("data").put("total", 5001).putArray("items");
        when(catalog.readItems(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.any(ObjectNode.class), org.mockito.ArgumentMatchers.anyString())).thenReturn(catalogPage);

        ObjectNode request = mapper.createObjectNode().put("keyword", "latte");
        CatalogOwnerApi.Problem failure = assertThrows(CatalogOwnerApi.Problem.class,
            () -> service.readInventoryTargets("scope", "brand", request, "request", "STORE"));

        assertEquals("VALIDATION_ERROR", failure.code());
        assertEquals(422, failure.status());
        assertEquals(true, failure.getMessage().contains("5000"));
        verifyNoInteractions(inventory);
    }

    @Test
    void inventoryPrefilterAllowsExactlyFiveThousandCatalogItems() {
        ObjectMapper mapper = new ObjectMapper();
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        CatalogInventoryCoordinator service = new CatalogInventoryCoordinator(
            catalog, inventory, null, null, mapper, null, null
        );
        ObjectNode catalogPage = mapper.createObjectNode();
        catalogPage.putObject("data").put("total", 5000).putArray("items");
        ObjectNode inventoryPage = mapper.createObjectNode();
        inventoryPage.putObject("data").putArray("items");
        when(catalog.readItems(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.any(ObjectNode.class), org.mockito.ArgumentMatchers.anyString())).thenReturn(catalogPage);
        when(inventory.readTargets(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.any(ObjectNode.class), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString()))
            .thenReturn(inventoryPage);

        assertEquals(inventoryPage, service.readInventoryTargets("scope", "brand",
            mapper.createObjectNode().put("keyword", "latte"), "request", "STORE"));

        verify(inventory).readTargets(org.mockito.ArgumentMatchers.eq("scope"), org.mockito.ArgumentMatchers.eq("brand"),
            org.mockito.ArgumentMatchers.any(ObjectNode.class), org.mockito.ArgumentMatchers.eq("request"), org.mockito.ArgumentMatchers.eq("STORE"));
    }

    @Test
    void copyBridgeCarriesOpaqueItemAndProductionTagRefsRatherThanCodes() {
        CatalogInventoryCoordinator service = new CatalogInventoryCoordinator(
            null, null, null, null, new ObjectMapper(), null, null
        );
        ObjectMapper mapper = new ObjectMapper();
        UUID itemRef = UUID.randomUUID();
        UUID targetItemRef = UUID.randomUUID();
        UUID tagRef = UUID.randomUUID();
        UUID targetTagRef = UUID.randomUUID();
        ObjectNode preflight = mapper.createObjectNode();
        var mappings = preflight.putArray("referenceMappings");
        mappings.addObject().put("objectType", "CATALOG_ITEM").put("sourceRef", itemRef.toString()).put("targetRef", targetItemRef.toString()).put("targetCode", "LATTE");
        mappings.addObject().put("objectType", "PRODUCTION_TAG").put("sourceRef", tagRef.toString()).put("targetRef", targetTagRef.toString()).put("targetCode", "HOT_DISH");

        CatalogInventoryCoordinator.CopyReferencePlan plan = service.copyReferencePlan(preflight);

        assertEquals(java.util.List.of(itemRef.toString()), mapper.convertValue(plan.closureItemRefs(), java.util.List.class));
        assertEquals(java.util.List.of(tagRef.toString()), mapper.convertValue(plan.productionTagRefs(), java.util.List.class));
        assertEquals(targetItemRef.toString(), plan.referenceMappings().get(0).path("targetRef").asText());
    }

    @Test
    void mergedClosureLimitCountsCrossOwnerObjectsAfterDeDuplication() {
        CatalogInventoryCoordinator service = new CatalogInventoryCoordinator(
            null, null, null, null, new ObjectMapper(), null, null
        );
        ObjectMapper mapper = new ObjectMapper();
        ObjectNode data = mapper.createObjectNode().put("closureLimit", 2);
        ArrayNode closureItems = data.putArray("closureItems");
        closureItems.addObject().put("objectType", "CATALOG_ITEM").put("code", "LATTE-001");
        closureItems.addObject().put("objectType", "CATALOG_ITEM").put("code", "LATTE-001");
        closureItems.addObject().put("objectType", "STOCK_TARGET").put("code", "LATTE-001|M");
        closureItems.addObject().put("objectType", "PRODUCTION_TAG").put("code", "HOT-DISH");

        CatalogOwnerApi.Problem failure = assertThrows(CatalogOwnerApi.Problem.class, () -> service.enforceMergedClosureLimit(data));

        assertEquals("COPY_CLOSURE_TOO_LARGE", failure.code());
    }

    @Test
    void catalogSaveInventoryReadbackRequiresEnvelopeDataAndNonBlankTargetRef() {
        CatalogInventoryCoordinator service = new CatalogInventoryCoordinator(
            null, null, null, null, new ObjectMapper(), null, null
        );

        Object result = parseCatalogSaveOwnerReadback(service, "{\"revision\":\"v1\",\"requestId\":\"req-1\",\"data\":{\"targetRef\":\"target-1\",\"version\":1,\"created\":true}}");
        assertFalse(result == null);

        CatalogOwnerApi.Problem absentData = assertThrows(CatalogOwnerApi.Problem.class,
            () -> parseCatalogSaveOwnerReadback(service, "{\"targetRef\":\"target-1\"}"));
        assertEquals("RESULT_UNKNOWN", absentData.code());

        CatalogOwnerApi.Problem blankTargetRef = assertThrows(CatalogOwnerApi.Problem.class,
            () -> parseCatalogSaveOwnerReadback(service, "{\"data\":{\"targetRef\":\"\",\"version\":1,\"created\":true}}"));
        assertEquals("RESULT_UNKNOWN", blankTargetRef.code());

        CatalogOwnerApi.Problem incompleteOwnerPayload = assertThrows(CatalogOwnerApi.Problem.class,
            () -> parseCatalogSaveOwnerReadback(service, "{\"data\":{\"targetRef\":\"target-1\"}}"));
        assertEquals("RESULT_UNKNOWN", incompleteOwnerPayload.code());

        CatalogOwnerApi.Problem unknownOwnerPayload = assertThrows(CatalogOwnerApi.Problem.class,
            () -> parseCatalogSaveOwnerReadback(service, "{\"data\":{\"targetRef\":\"target-1\",\"version\":1,\"created\":true,\"unexpected\":true}}"));
        assertEquals("RESULT_UNKNOWN", unknownOwnerPayload.code());
    }

    private static Object parseCatalogSaveOwnerReadback(CatalogInventoryCoordinator service, String canonicalJson) {
        try {
            Method method = CatalogInventoryCoordinator.class.getDeclaredMethod("parseCatalogSaveOwnerReadback", String.class);
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
