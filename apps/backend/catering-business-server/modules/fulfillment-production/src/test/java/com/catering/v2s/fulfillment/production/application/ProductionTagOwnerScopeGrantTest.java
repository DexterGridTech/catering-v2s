package com.catering.v2s.fulfillment.production.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class ProductionTagOwnerScopeGrantTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void writeRejectsWrongGrantBeforeProductionReceiptReplay() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID workspaceId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        ProductionTagOwnerService service = new ProductionTagOwnerService(jdbc, mapper, () -> 1L);

        ProductionTagOwnerApi.Problem failure = assertThrows(ProductionTagOwnerApi.Problem.class, () -> service.write(
            "createOperationsProductionTag", targetId.toString(), "brand", mapper.createObjectNode(), "request", "receipt",
            workspaceId, "production-owner-test", "HEAD_COMPANY", grant(workspaceId, "production-owner-test", UUID.randomUUID())));

        assertEquals("SCOPE_FORBIDDEN", failure.code());
        verifyNoInteractions(jdbc);
    }

    @Test
    void protectedPreflightRejectsSourceGrantWhenCopyTargetDiffersBeforeOwnerReads() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID workspaceId = UUID.randomUUID();
        UUID sourceId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        ProductionTagOwnerService service = new ProductionTagOwnerService(jdbc, mapper, () -> 1L);

        ProductionTagOwnerApi.Problem failure = assertThrows(ProductionTagOwnerApi.Problem.class, () -> service.preflightCopy(
            sourceId.toString(), targetId.toString(), "brand", mapper.createObjectNode(), workspaceId, "production-owner-test", "STORE",
            grant(workspaceId, "production-owner-test", sourceId)));

        assertEquals("SCOPE_FORBIDDEN", failure.code());
        verifyNoInteractions(jdbc);
    }

    @Test
    void writeRejectsScopeMatchingInventoryCapabilityBeforeProductionReceiptReplay() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID workspaceId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        ProductionTagOwnerService service = new ProductionTagOwnerService(jdbc, mapper, () -> 1L);

        ProductionTagOwnerApi.Problem failure = assertThrows(ProductionTagOwnerApi.Problem.class, () -> service.write(
            "createOperationsProductionTag", targetId.toString(), "brand", mapper.createObjectNode(), "request", "receipt",
            workspaceId, "production-owner-test", "STORE", grant(workspaceId, "production-owner-test", targetId, "EDIT_STORE_INVENTORY")));

        assertEquals("SCOPE_FORBIDDEN", failure.code());
        verifyNoInteractions(jdbc);
    }

    @Test
    void typedWriteRejectsOpaqueGrantBeforeProductionReceiptReplay() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID targetId = UUID.randomUUID();
        ProductionTagOwnerService service = new ProductionTagOwnerService(jdbc, mapper, () -> 1L);
        ProductionTagOwnerApi.Problem failure = assertThrows(ProductionTagOwnerApi.Problem.class, () -> service.write(
            typedContext(targetId), mapper.createObjectNode(), "receipt"));

        assertEquals("SCOPE_FORBIDDEN", failure.code());
        verifyNoInteractions(jdbc);
    }

    @SuppressWarnings("unchecked")
    private static WorkspaceExecutionContext<CatalogAuthorizationScope> typedContext(UUID targetId) {
        WorkspaceExecutionContext<CatalogAuthorizationScope> context = mock(WorkspaceExecutionContext.class);
        CatalogAuthorizationScope scope = mock(CatalogAuthorizationScope.class);
        when(context.workspaceUuid()).thenReturn(UUID.randomUUID());
        when(context.groupWorkspaceKey()).thenReturn("production-owner-test");
        when(context.consumerFace()).thenReturn("operations-admin");
        when(context.operationToken()).thenReturn(CatalogInventoryWorkspaceCommandTokens.CREATE_OPERATIONS_PRODUCTION_TAG);
        when(context.ownerScope()).thenReturn(scope);
        when(context.ownerGrant()).thenReturn(mock(com.catering.v2s.platform.command.OwnerGrant.class));
        when(scope.dataNodeType()).thenReturn("STORE");
        when(scope.dataNodeId()).thenReturn(targetId);
        when(scope.brandRef()).thenReturn("brand");
        return context;
    }

    private static OperationsOwnerScopeGrant grant(UUID workspaceId, String groupWorkspaceKey, UUID targetId) {
        return grant(workspaceId, groupWorkspaceKey, targetId, "EDIT_STORE_CATALOG");
    }

    private static OperationsOwnerScopeGrant grant(UUID workspaceId, String groupWorkspaceKey, UUID targetId, String capabilityKey) {
        return new OperationsOwnerScopeGrant(workspaceId, groupWorkspaceKey, "PRODUCTION_OWNER_TEST", capabilityKey, "STORE", targetId, "STORE", targetId, List.of(targetId));
    }
}
