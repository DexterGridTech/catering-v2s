package com.catering.v2s.inventory.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class InventoryOwnerScopeGrantTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void writeRejectsWrongGrantBeforeInventoryReceiptReplay() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID workspaceId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        InventoryOwnerService service = new InventoryOwnerService(jdbc, mapper, () -> 1L);

        InventoryOwnerApi.Problem failure = assertThrows(InventoryOwnerApi.Problem.class, () -> service.write(
            "countOperationsInventoryTarget", targetId.toString(), "brand", mapper.createObjectNode(), "request", "receipt", "STORE",
            workspaceId, "inventory-owner-test", grant(workspaceId, "inventory-owner-test", UUID.randomUUID())));

        assertEquals("SCOPE_FORBIDDEN", failure.code());
        verifyNoInteractions(jdbc);
    }

    @Test
    void protectedPreflightRejectsSourceGrantWhenCopyTargetDiffersBeforeOwnerReads() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID workspaceId = UUID.randomUUID();
        UUID sourceId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        InventoryOwnerService service = new InventoryOwnerService(jdbc, mapper, () -> 1L);

        InventoryOwnerApi.Problem failure = assertThrows(InventoryOwnerApi.Problem.class, () -> service.preflightCopy(
            sourceId.toString(), targetId.toString(), "brand", mapper.createObjectNode(), workspaceId, "inventory-owner-test", "STORE",
            grant(workspaceId, "inventory-owner-test", sourceId, "STORE", "EDIT_STORE_CATALOG")));

        assertEquals("SCOPE_FORBIDDEN", failure.code());
        verifyNoInteractions(jdbc);
    }

    @Test
    void writeRejectsScopeMatchingCatalogCapabilityBeforeInventoryReceiptReplay() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID workspaceId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        InventoryOwnerService service = new InventoryOwnerService(jdbc, mapper, () -> 1L);

        InventoryOwnerApi.Problem failure = assertThrows(InventoryOwnerApi.Problem.class, () -> service.write(
            "countOperationsInventoryTarget", targetId.toString(), "brand", mapper.createObjectNode(), "request", "receipt", "STORE",
            workspaceId, "inventory-owner-test", grant(workspaceId, "inventory-owner-test", targetId, "STORE", "EDIT_STORE_CATALOG")));

        assertEquals("SCOPE_FORBIDDEN", failure.code());
        verifyNoInteractions(jdbc);
    }

    @Test
    void definitionCommandsRejectCatalogCapabilityWithoutWholeSaveRequirementBeforeReceiptAccess() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID workspaceId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        InventoryOwnerService service = new InventoryOwnerService(jdbc, mapper, () -> 1L);
        OperationsOwnerScopeGrant catalogGrant = grant(workspaceId, "inventory-owner-test", targetId, "STORE", "EDIT_STORE_CATALOG");

        InventoryOwnerApi.Problem ensure = assertThrows(InventoryOwnerApi.Problem.class, () -> service.ensureCatalogInventoryTarget(
            targetId.toString(), "brand", mapper.createObjectNode(), "request", "receipt", workspaceId, "inventory-owner-test", "STORE", catalogGrant));
        InventoryOwnerApi.Problem bom = assertThrows(InventoryOwnerApi.Problem.class, () -> service.saveCatalogProductBom(
            targetId.toString(), "brand", mapper.createObjectNode(), "request", "receipt", workspaceId, "inventory-owner-test", "STORE", catalogGrant));

        assertEquals("SCOPE_FORBIDDEN", ensure.code());
        assertEquals("SCOPE_FORBIDDEN", bom.code());
        verifyNoInteractions(jdbc);
    }

    @Test
    void definitionCommandsRejectWholeSaveRequirementWithInventoryCapabilityBeforeReceiptAccess() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID workspaceId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        InventoryOwnerService service = new InventoryOwnerService(jdbc, mapper, () -> 1L);
        OperationsOwnerScopeGrant inventoryGrant = grant(workspaceId, "inventory-owner-test", targetId, "STORE",
            "CATALOG_INVENTORY_OPERATION_SAVE_OPERATIONS_CATALOG_ITEM", "EDIT_STORE_INVENTORY");

        InventoryOwnerApi.Problem ensure = assertThrows(InventoryOwnerApi.Problem.class, () -> service.ensureCatalogInventoryTarget(
            targetId.toString(), "brand", mapper.createObjectNode(), "request", "receipt", workspaceId, "inventory-owner-test", "STORE", inventoryGrant));
        InventoryOwnerApi.Problem bom = assertThrows(InventoryOwnerApi.Problem.class, () -> service.saveCatalogProductBom(
            targetId.toString(), "brand", mapper.createObjectNode(), "request", "receipt", workspaceId, "inventory-owner-test", "STORE", inventoryGrant));

        assertEquals("SCOPE_FORBIDDEN", ensure.code());
        assertEquals("SCOPE_FORBIDDEN", bom.code());
        verifyNoInteractions(jdbc);
    }

    @Test
    void headCompanyCatalogGrantPassesTemplateDefinitionAuthorization() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID workspaceId = UUID.randomUUID();
        UUID headCompanyId = UUID.randomUUID();
        InventoryOwnerService service = new InventoryOwnerService(jdbc, mapper, () -> 1L);
        OperationsOwnerScopeGrant catalogGrant = grant(workspaceId, "inventory-owner-test", headCompanyId, "HEAD_COMPANY",
            "CATALOG_INVENTORY_OPERATION_SAVE_OPERATIONS_CATALOG_ITEM", "EDIT_HEAD_COMPANY_CATALOG");

        InventoryOwnerApi.Problem ensure = assertThrows(InventoryOwnerApi.Problem.class, () -> service.ensureCatalogInventoryTarget(
            headCompanyId.toString(), "brand", mapper.createObjectNode().put("itemCode", "ITEM-001").put("mode", "BOM"),
            "request", "receipt", workspaceId, "inventory-owner-test", "HEAD_COMPANY", catalogGrant));
        InventoryOwnerApi.Problem bom = assertThrows(InventoryOwnerApi.Problem.class, () -> service.saveCatalogProductBom(
            headCompanyId.toString(), "brand", mapper.createObjectNode().put("itemCode", "ITEM-001"),
            "request", "receipt", workspaceId, "inventory-owner-test", "HEAD_COMPANY", catalogGrant));

        assertEquals("VALIDATION_ERROR", ensure.code());
        assertEquals("VALIDATION_ERROR", bom.code());
        verifyNoInteractions(jdbc);
    }

    @Test
    void storeCatalogWholeSaveGrantPassesDefinitionAuthorization() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID workspaceId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        InventoryOwnerService service = new InventoryOwnerService(jdbc, mapper, () -> 1L);
        OperationsOwnerScopeGrant catalogGrant = grant(workspaceId, "inventory-owner-test", storeId, "STORE",
            "CATALOG_INVENTORY_OPERATION_SAVE_OPERATIONS_CATALOG_ITEM", "EDIT_STORE_CATALOG");

        InventoryOwnerApi.Problem ensure = assertThrows(InventoryOwnerApi.Problem.class, () -> service.ensureCatalogInventoryTarget(
            storeId.toString(), "brand", mapper.createObjectNode().put("itemCode", "ITEM-001").put("mode", "BOM"),
            "request", "receipt", workspaceId, "inventory-owner-test", "STORE", catalogGrant));
        InventoryOwnerApi.Problem bom = assertThrows(InventoryOwnerApi.Problem.class, () -> service.saveCatalogProductBom(
            storeId.toString(), "brand", mapper.createObjectNode().put("itemCode", "ITEM-001"),
            "request", "receipt", workspaceId, "inventory-owner-test", "STORE", catalogGrant));

        assertEquals("VALIDATION_ERROR", ensure.code());
        assertEquals("VALIDATION_ERROR", bom.code());
        verifyNoInteractions(jdbc);
    }

    @Test
    void catalogCopyPreflightRejectsScopeMatchingInventoryCapabilityBeforeOwnerReads() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID workspaceId = UUID.randomUUID();
        UUID sourceId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        InventoryOwnerService service = new InventoryOwnerService(jdbc, mapper, () -> 1L);

        InventoryOwnerApi.Problem failure = assertThrows(InventoryOwnerApi.Problem.class, () -> service.preflightCopy(
            sourceId.toString(), targetId.toString(), "brand", mapper.createObjectNode(), workspaceId, "inventory-owner-test", "STORE",
            grant(workspaceId, "inventory-owner-test", targetId, "STORE", "EDIT_STORE_INVENTORY")));

        assertEquals("SCOPE_FORBIDDEN", failure.code());
        verifyNoInteractions(jdbc);
    }

    private static OperationsOwnerScopeGrant grant(UUID workspaceId, String groupWorkspaceKey, UUID targetId) {
        return grant(workspaceId, groupWorkspaceKey, targetId, "STORE", "EDIT_STORE_INVENTORY");
    }

    private static OperationsOwnerScopeGrant grant(UUID workspaceId, String groupWorkspaceKey, UUID targetId, String targetType, String capabilityKey) {
        return grant(workspaceId, groupWorkspaceKey, targetId, targetType, "INVENTORY_OWNER_TEST", capabilityKey);
    }

    private static OperationsOwnerScopeGrant grant(UUID workspaceId, String groupWorkspaceKey, UUID targetId, String targetType,
                                                   String requirementId, String capabilityKey) {
        return new OperationsOwnerScopeGrant(workspaceId, groupWorkspaceKey, requirementId, capabilityKey, targetType, targetId, targetType, targetId, List.of(targetId));
    }
}
