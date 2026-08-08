package com.catering.v2s.app.application.cataloginventory;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CatalogCopySourceAuthorityTest {
    @Test
    void forgedRequestSourceCannotOverrideOrganizationResolution() {
        UUID workspace = UUID.randomUUID();
        UUID target = UUID.randomUUID();
        UUID forged = UUID.randomUUID();
        UUID approved = UUID.randomUUID();
        CatalogInventoryApplicationService service = new CatalogInventoryApplicationService(
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
    void brandCopyCarriesInventoryBomComponentCodesIntoOwnerClosure() {
        CatalogInventoryApplicationService service = new CatalogInventoryApplicationService(
            null, null, null, null, new ObjectMapper(), null, null
        );
        ObjectMapper mapper = new ObjectMapper();
        ArrayNode catalogCodes = mapper.createArrayNode().add("LATTE");
        ObjectNode inventoryJudgement = mapper.createObjectNode();
        inventoryJudgement.putArray("closureItems")
            .addObject().put("objectType", "STOCK_TARGET").put("itemCode", "COFFEE_BEANS");

        ArrayNode closure = service.combinedClosureCodes(catalogCodes, inventoryJudgement);

        assertEquals(java.util.List.of("LATTE", "COFFEE_BEANS"), mapper.convertValue(closure, java.util.List.class));
    }

    @Test
    void mergedClosureLimitCountsCrossOwnerObjectsAfterDeDuplication() {
        CatalogInventoryApplicationService service = new CatalogInventoryApplicationService(
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
        public String requireCatalogBrand(UUID workspaceUuid, String groupWorkspaceKey, String dataNodeType, UUID dataNodeId, String requestedBrandRef) {
            return requestedBrandRef;
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
