package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.asset.api.CatalogAssetReferenceLock;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class CatalogOwnerScopeGrantTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void writeRejectsWrongGrantBeforeCatalogReceiptReplay() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID workspaceId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        CatalogOwnerService service = new CatalogOwnerService(jdbc, mapper, () -> 1L, mock(CatalogAssetReferenceLock.class));

        CatalogOwnerApi.Problem failure = assertThrows(CatalogOwnerApi.Problem.class, () -> service.write(
            "createOperationsCatalogItem", targetId.toString(), "brand", mapper.createObjectNode(), "request", "receipt",
            workspaceId, "catalog-owner-test", "STORE", grant(workspaceId, "catalog-owner-test", UUID.randomUUID())));

        assertEquals("SCOPE_FORBIDDEN", failure.code());
        verifyNoInteractions(jdbc);
    }

    @Test
    void copyRejectsSourceGrantWhenTargetScopeDiffersBeforePreflightReads() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID workspaceId = UUID.randomUUID();
        UUID sourceId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        CatalogOwnerService service = new CatalogOwnerService(jdbc, mapper, () -> 1L, mock(CatalogAssetReferenceLock.class));

        CatalogOwnerApi.Problem failure = assertThrows(CatalogOwnerApi.Problem.class, () -> service.copy(
            "preflightOperationsBrandCatalogCopy", sourceId.toString(), targetId.toString(), "brand", mapper.createObjectNode(), "request", null,
            workspaceId, "catalog-owner-test", "STORE", grant(workspaceId, "catalog-owner-test", sourceId)));

        assertEquals("SCOPE_FORBIDDEN", failure.code());
        verifyNoInteractions(jdbc);
    }

    @Test
    void writeRejectsScopeMatchingInventoryCapabilityBeforeCatalogReceiptReplay() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID workspaceId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        CatalogOwnerService service = new CatalogOwnerService(jdbc, mapper, () -> 1L, mock(CatalogAssetReferenceLock.class));

        CatalogOwnerApi.Problem failure = assertThrows(CatalogOwnerApi.Problem.class, () -> service.write(
            "createOperationsCatalogItem", targetId.toString(), "brand", mapper.createObjectNode(), "request", "receipt",
            workspaceId, "catalog-owner-test", "STORE", grant(workspaceId, "catalog-owner-test", targetId, "EDIT_STORE_INVENTORY")));

        assertEquals("SCOPE_FORBIDDEN", failure.code());
        verifyNoInteractions(jdbc);
    }

    @Test
    void typedWriteRejectsOpaqueGrantBeforeCatalogReceiptReplay() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID targetId = UUID.randomUUID();
        CatalogOwnerService service = new CatalogOwnerService(jdbc, mapper, () -> 1L, mock(CatalogAssetReferenceLock.class));

        CatalogOwnerApi.Problem failure = assertThrows(CatalogOwnerApi.Problem.class, () -> service.write(
            typedContext(CatalogInventoryWorkspaceCommandTokens.CREATE_OPERATIONS_CATALOG_ITEM, targetId), mapper.createObjectNode(), "receipt"));

        assertEquals("SCOPE_FORBIDDEN", failure.code());
        verifyNoInteractions(jdbc);
    }

    @SuppressWarnings("unchecked")
    private static WorkspaceExecutionContext<CatalogAuthorizationScope> typedContext(
        com.catering.v2s.platform.command.WorkspaceCommandOperationToken token, UUID targetId
    ) {
        WorkspaceExecutionContext<CatalogAuthorizationScope> context = mock(WorkspaceExecutionContext.class);
        CatalogAuthorizationScope scope = mock(CatalogAuthorizationScope.class);
        when(context.workspaceUuid()).thenReturn(UUID.randomUUID());
        when(context.groupWorkspaceKey()).thenReturn("catalog-owner-test");
        when(context.consumerFace()).thenReturn("operations-admin");
        when(context.operationToken()).thenReturn(token);
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
        return new OperationsOwnerScopeGrant(workspaceId, groupWorkspaceKey, "CATALOG_OWNER_TEST", capabilityKey, "STORE", targetId, "STORE", targetId, List.of(targetId));
    }
}
