package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.catalog.api.CatalogProductionTagOwnerApi;
import com.catering.v2s.catalog.application.persistence.CatalogProductionTagOwnerPersistence;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.lang.reflect.InvocationTargetException;
import java.util.List;
import java.util.Set;
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
        CatalogProductionTagOwnerService service = new CatalogProductionTagOwnerService(
                new CatalogProductionTagOwnerPersistence(jdbc, () -> 1L), mapper);

        CatalogProductionTagOwnerApi.Problem failure = assertThrows(
                CatalogProductionTagOwnerApi.Problem.class,
                () -> service.write(
                        "createOperationsProductionTag",
                        targetId.toString(),
                        "brand",
                        mapper.createObjectNode(),
                        "request",
                        "receipt",
                        workspaceId,
                        "production-owner-test",
                        "HEAD_COMPANY",
                        grant(workspaceId, "production-owner-test", UUID.randomUUID())));

        assertEquals("SCOPE_FORBIDDEN", failure.code());
        verifyNoInteractions(jdbc);
    }

    @Test
    void protectedPreflightRejectsSourceGrantWhenCopyTargetDiffersBeforeOwnerReads() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID workspaceId = UUID.randomUUID();
        UUID sourceId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        CatalogProductionTagOwnerService service = new CatalogProductionTagOwnerService(
                new CatalogProductionTagOwnerPersistence(jdbc, () -> 1L), mapper);

        CatalogProductionTagOwnerApi.Problem failure = assertThrows(
                CatalogProductionTagOwnerApi.Problem.class,
                () -> service.preflightCopy(
                        sourceId.toString(),
                        targetId.toString(),
                        "brand",
                        mapper.createObjectNode(),
                        workspaceId,
                        "production-owner-test",
                        "STORE",
                        grant(workspaceId, "production-owner-test", sourceId)));

        assertEquals("SCOPE_FORBIDDEN", failure.code());
        verifyNoInteractions(jdbc);
    }

    @Test
    void writeRejectsScopeMatchingInventoryCapabilityBeforeProductionReceiptReplay() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID workspaceId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        CatalogProductionTagOwnerService service = new CatalogProductionTagOwnerService(
                new CatalogProductionTagOwnerPersistence(jdbc, () -> 1L), mapper);

        CatalogProductionTagOwnerApi.Problem failure = assertThrows(
                CatalogProductionTagOwnerApi.Problem.class,
                () -> service.write(
                        "createOperationsProductionTag",
                        targetId.toString(),
                        "brand",
                        mapper.createObjectNode(),
                        "request",
                        "receipt",
                        workspaceId,
                        "production-owner-test",
                        "STORE",
                        grant(workspaceId, "production-owner-test", targetId, "EDIT_STORE_INVENTORY")));

        assertEquals("SCOPE_FORBIDDEN", failure.code());
        verifyNoInteractions(jdbc);
    }

    @Test
    void typedWriteRejectsMismatchedGrantBeforeProductionReceiptReplay() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID targetId = UUID.randomUUID();
        CatalogProductionTagOwnerService service = new CatalogProductionTagOwnerService(
                new CatalogProductionTagOwnerPersistence(jdbc, () -> 1L), mapper);
        CatalogProductionTagOwnerApi.Problem failure = assertThrows(
                CatalogProductionTagOwnerApi.Problem.class,
                () -> service.write(typedContextWithMismatchedGrant(targetId), validCreateRequest(), "receipt"));

        assertEquals("SCOPE_FORBIDDEN", failure.code());
        verifyNoInteractions(jdbc);
    }

    @Test
    void productionReceiptRequestBindsTheBrandBeforeReplayLookup() {
        CatalogProductionTagOwnerService service = new CatalogProductionTagOwnerService(
                new CatalogProductionTagOwnerPersistence(mock(JdbcTemplate.class), () -> 1L), mapper);
        ObjectNode request =
                mapper.createObjectNode().put("code", "TAG-RECEIPT").put("name", "receipt tag");

        ObjectNode brandA = receiptRequest(service, request, "BRAND-A");
        ObjectNode brandB = receiptRequest(service, request, "BRAND-B");

        assertEquals("BRAND-A", brandA.path("receiptBrandRef").asText());
        assertEquals("BRAND-B", brandB.path("receiptBrandRef").asText());
        assertEquals("TAG-RECEIPT", brandA.path("code").asText());
        assertEquals("TAG-RECEIPT", brandB.path("code").asText());
    }

    private ObjectNode validCreateRequest() {
        return mapper.createObjectNode().put("code", "TAG-AUTH").put("name", "authorization tag");
    }

    private static ObjectNode receiptRequest(
            CatalogProductionTagOwnerService service, ObjectNode request, String brand) {
        try {
            var method = CatalogProductionTagOwnerService.class.getDeclaredMethod(
                    "receiptRequest", com.fasterxml.jackson.databind.JsonNode.class, String.class);
            method.setAccessible(true);
            return (ObjectNode) method.invoke(service, request, brand);
        } catch (InvocationTargetException failure) {
            if (failure.getCause() instanceof RuntimeException runtime) throw runtime;
            throw new AssertionError(failure.getCause());
        } catch (ReflectiveOperationException failure) {
            throw new AssertionError(failure);
        }
    }

    private static WorkspaceExecutionContext<CatalogAuthorizationScope> typedContextWithMismatchedGrant(UUID targetId) {
        UUID workspaceId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        var token = CatalogInventoryWorkspaceCommandTokens.CREATE_OPERATIONS_PRODUCTION_TAG;
        var selectedStore = new WorkspaceSessionEntryReadback.VisibleDataNodeCandidate(
                "STORE",
                targetId,
                "Production test store",
                "PRODUCTION-TEST-STORE",
                List.of(),
                null,
                null,
                targetId,
                null);
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(
                UUID.randomUUID(),
                workspaceId,
                "production-owner-test",
                accountId,
                assignmentId,
                new WorkspaceSessionEntryReadback.ScopeContext(null, null, selectedStore, null),
                1L,
                1L,
                Set.of(),
                Set.of(token.capabilityFor("STORE")),
                "production test",
                "STORE",
                targetId);
        WorkspaceAuthenticationService sessions = mock(WorkspaceAuthenticationService.class);
        when(sessions.commandAuthorizationFacts("typed-context-session"))
                .thenReturn(new com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationFacts(
                        session, UUID.randomUUID(), "STORE", targetId));
        WorkspaceCapabilityScopeResolver capabilities = mock(WorkspaceCapabilityScopeResolver.class);
        when(capabilities.resolveGeneratedCatalogOperation(
                        any(), eq(token.requirementId()), eq(token.capabilityFor("STORE")), any(), any()))
                .thenReturn(new WorkspaceCapabilityScopeResolver.CatalogScopeResolution(
                        new WorkspaceCapabilityScopeResolver.ScopeResolution(
                                WorkspaceCapabilityScopeResolver.Decision.ALLOW,
                                token.capabilityFor("STORE"),
                                new WorkspaceCapabilityScopeResolver.FirstOwnerQueryPredicate(
                                        workspaceId,
                                        "production-owner-test",
                                        "STORE",
                                        UUID.randomUUID(),
                                        "STORE",
                                        targetId,
                                        List.of(targetId))),
                        new CatalogScopeLookup.CatalogBrandJudgment(
                                "brand", "TEST_ORGANIZATION_JUDGMENT", "TEST_REVISION"),
                        null));
        CatalogScopeLookup catalogScopes = mock(CatalogScopeLookup.class);
        return new CommandExecutionContextResolver(
                        capabilities, catalogScopes, sessions, (workspace, group, targetType, storeId) -> {})
                .resolveCatalog(
                        "typed-context-session",
                        token,
                        targetId.toString(),
                        CatalogScopeLookup.CatalogBrandSelection.fromRequestValue("brand"),
                        "typed-correlation",
                        "typed-request");
    }

    private static OperationsOwnerScopeGrant grant(UUID workspaceId, String groupWorkspaceKey, UUID targetId) {
        return grant(workspaceId, groupWorkspaceKey, targetId, "EDIT_STORE_CATALOG");
    }

    private static OperationsOwnerScopeGrant grant(
            UUID workspaceId, String groupWorkspaceKey, UUID targetId, String capabilityKey) {
        return new OperationsOwnerScopeGrant(
                workspaceId,
                groupWorkspaceKey,
                "PRODUCTION_OWNER_TEST",
                capabilityKey,
                "STORE",
                targetId,
                "STORE",
                targetId,
                List.of(targetId));
    }
}
