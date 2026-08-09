package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CatalogInventoryCoordinatorCopySourceAuthorityTest {
    @Test
    void forgedRequestSourceCannotOverrideOrganizationResolution() {
        UUID workspace = UUID.randomUUID();
        UUID target = UUID.randomUUID();
        UUID forged = UUID.randomUUID();
        UUID approved = UUID.randomUUID();
        CatalogInventoryCoordinator service = new CatalogInventoryCoordinator(
            null, null, null, null, new ObjectMapper(), null,
            new FixedCatalogScopeLookup(approved)
        );
        ObjectNode request = new ObjectMapper().createObjectNode().put("sourceDataNodeRef", forged.toString());

        String source = service.resolveBrandCopySource(
            request, workspace, "GROUP-1", ServiceNodeTypes.STORE, target.toString(), "BRAND-1"
        );

        assertEquals(approved.toString(), source);
        assertFalse(request.has("_resolvedCatalogCopySource"));
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

    private static final class FixedCatalogScopeLookup implements CatalogScopeLookup {
        private final UUID approved;

        private FixedCatalogScopeLookup(UUID approved) {
            this.approved = approved;
        }

        @Override
        public CatalogBrandJudgment resolveCatalogBrand(UUID workspaceUuid, String groupWorkspaceKey, String dataNodeType, UUID dataNodeId, CatalogBrandSelection selection) {
            return new CatalogBrandJudgment(selection.value(), "TEST_ORGANIZATION_JUDGMENT", "test-revision");
        }

        @Override
        public void requireCatalogCopySource(UUID workspaceUuid, String groupWorkspaceKey, String targetDataNodeType, UUID targetDataNodeId, UUID sourceDataNodeId, String brandRef) {
            if (!approved.equals(sourceDataNodeId)) throw new AssertionError("unexpected source");
        }

        @Override
        public UUID resolveCatalogCopySource(UUID workspaceUuid, String groupWorkspaceKey, String targetDataNodeType, UUID targetDataNodeId, String brandRef) {
            return approved;
        }
    }
}
