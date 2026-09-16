package com.catering.v2s.workspace.iam.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.WorkspaceAssignmentScopeLookup;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.platform.command.WorkspaceCommandOperationToken;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CommandExecutionContextResolverTest {
    private static final UUID WORKSPACE = UUID.randomUUID();
    private static final String GROUP = "command-context-test";
    private static final UUID ASSIGNMENT = UUID.randomUUID();
    private static final UUID STORE = UUID.randomUUID();
    private static final UUID BRAND = UUID.randomUUID();
    private static final UUID BRAND_COPY_SOURCE = UUID.randomUUID();

    @Test
    void carriesOnlyOrganizationJudgedBrandAndBrandCopySource() {
        CatalogScopeLookup lookup = lookup();
        CommandExecutionContextResolver resolver = new CommandExecutionContextResolver(
                capabilities(), lookup, null, (workspace, group, targetType, storeId) -> {});
        WorkspaceCommandOperationToken token =
                CatalogInventoryWorkspaceCommandTokens.EXECUTE_OPERATIONS_BRAND_CATALOG_COPY;

        var context = resolver.resolveCatalogFromResolvedSession(
                session(token.capabilityFor("STORE")),
                token,
                "STORE",
                STORE,
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(BRAND.toString()),
                "correlation",
                "request");

        CatalogAuthorizationScope scope = context.ownerScope();
        assertEquals(BRAND.toString(), scope.brandRef());
        assertEquals("TEST_ORGANIZATION_JUDGMENT", scope.judgmentSource());
        assertEquals(CatalogAuthorizationScope.CopyRole.COPY_TARGET, scope.copyRole());
        assertEquals(WorkspaceCommandOperationToken.CopySourcePolicy.ORGANIZATION_JUDGMENT, scope.copySourcePolicy());
        assertEquals(BRAND_COPY_SOURCE, scope.copySourceDataNodeId());
        assertTrue(context.ownerGrant().verifyFor(token.requirementId(), token.capabilityFor("STORE"), "STORE", STORE));
        assertFalse(
                context.ownerGrant().verifyFor("another-requirement", token.capabilityFor("STORE"), "STORE", STORE));
    }

    @Test
    void leavesLocalAndTemporarySourcesToTheirStaticOwnerPolicies() {
        CatalogScopeLookup lookup = lookup();
        CommandExecutionContextResolver resolver = new CommandExecutionContextResolver(
                capabilities(), lookup, null, (workspace, group, targetType, storeId) -> {});
        WorkspaceCommandOperationToken local =
                CatalogInventoryWorkspaceCommandTokens.PREFLIGHT_OPERATIONS_LOCAL_CATALOG_COPY;
        WorkspaceCommandOperationToken promotion =
                CatalogInventoryWorkspaceCommandTokens.PREFLIGHT_OPERATIONS_TEMPORARY_CATALOG_ITEM_PROMOTION;

        var localContext = resolver.resolveCatalogFromResolvedSession(
                session(local.capabilityFor("STORE")),
                local,
                "STORE",
                STORE,
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(BRAND.toString()),
                "correlation-local",
                "request-local");
        var promotionContext = resolver.resolveCatalogFromResolvedSession(
                session(promotion.capabilityFor("STORE")),
                promotion,
                "STORE",
                STORE,
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(BRAND.toString()),
                "correlation-promotion",
                "request-promotion");

        assertEquals(
                WorkspaceCommandOperationToken.CopySourcePolicy.TARGET_SCOPE,
                localContext.ownerScope().copySourcePolicy());
        assertNull(localContext.ownerScope().copySourceDataNodeId());
        assertEquals(
                WorkspaceCommandOperationToken.CopySourcePolicy.CATALOG_ITEM,
                promotionContext.ownerScope().copySourcePolicy());
        assertNull(promotionContext.ownerScope().copySourceDataNodeId());
    }

    @Test
    void mapsAuthenticatedCatalogScopeOutsideTheGeneratedTokenToTypedForbidden() {
        CommandExecutionContextResolver resolver = new CommandExecutionContextResolver(
                capabilities(), lookup(), null, (workspace, group, targetType, storeId) -> {});
        WorkspaceCommandOperationToken token =
                CatalogInventoryWorkspaceCommandTokens.TRANSITION_OPERATIONS_PRODUCTION_TAG_STATUS;

        assertThrows(
                CommandExecutionContextResolver.CatalogScopeForbiddenException.class,
                () -> resolver.resolveCatalogFromResolvedSession(
                        session(token.capabilityFor("STORE")),
                        token,
                        "PROJECT",
                        UUID.randomUUID(),
                        CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(BRAND.toString()),
                        "correlation",
                        "request"));
    }

    @Test
    void resolvesNonCatalogOperationsFromOneFreshCommandFactLoad() {
        WorkspaceSessionReadback session = session("EDIT_STORE_CATALOG");
        RecordingAuthenticationService authentication = new RecordingAuthenticationService(commandFacts(session));
        CommandExecutionContextResolver resolver =
                new CommandExecutionContextResolver(
                        capabilities(), lookup(), authentication, (workspace, group, targetType, storeId) -> {});

        WorkspaceCommandAuthorizationFacts facts = resolver.resolveOperations("fresh-session-credential", GROUP);

        assertEquals(session, facts.sessionReadback());
        assertEquals(1, authentication.commandFactsCalls());
        assertEquals("fresh-session-credential", authentication.lastCredential());
    }

    @Test
    void rejectsMismatchedWorkspaceBeforeAnyTargetOrCatalogJudgment() {
        RecordingAuthenticationService authentication =
                new RecordingAuthenticationService(commandFacts(session("EDIT_STORE_CATALOG")));
        CommandExecutionContextResolver resolver =
                new CommandExecutionContextResolver(
                        capabilities(), lookup(), authentication, (workspace, group, targetType, storeId) -> {});

        assertThrows(
                WorkspaceAuthenticationService.SessionInvalidException.class,
                () -> resolver.resolveOperations("fresh-session-credential", "other-workspace"));
        assertEquals(1, authentication.commandFactsCalls());
    }

    @Test
    void rejectsStaleContextVersionAfterExactlyOneFreshCommandFactLoad() {
        RecordingAuthenticationService authentication =
                new RecordingAuthenticationService(commandFacts(session("EDIT_STORE_CATALOG")));
        CommandExecutionContextResolver resolver =
                new CommandExecutionContextResolver(
                        capabilities(), lookup(), authentication, (workspace, group, targetType, storeId) -> {});

        assertThrows(
                WorkspaceAuthenticationService.SessionConflictException.class,
                () -> resolver.resolveOperationsAtContextVersion("fresh-session-credential", GROUP, 8L));
        assertEquals(1, authentication.commandFactsCalls());
    }

    private static CommandExecutionContextResolver resolver(CatalogScopeLookup lookup) {
        return new CommandExecutionContextResolver(
                capabilities(), lookup, null, (workspace, group, targetType, storeId) -> {});
    }

    private static WorkspaceCapabilityScopeResolver capabilities() {
        WorkspaceAssignmentScopeLookup assignments =
                (workspace, group, assignment) -> new WorkspaceAssignmentScopeLookup.AssignmentScope("STORE", STORE);
        OrganizationTaskPathLookup paths = new WorkspaceTestTaskPathLookup() {
            @Override
            public TaskPath requireTaskPath(UUID workspace, String group, String targetType, UUID targetId) {
                return new TaskPath(targetType, targetId, List.of(STORE), "test store");
            }

            @Override
            public CatalogCommandScopeFacts resolveCatalogCommandScopeFacts(
                    UUID workspace,
                    String group,
                    String targetType,
                    UUID targetId,
                    CatalogScopeLookup.CatalogBrandSelection selection) {
                return new CatalogCommandScopeFacts(
                        new TaskPath(targetType, targetId, List.of(STORE), "test store"),
                        new CatalogScopeLookup.CatalogBrandJudgment(
                                BRAND.toString(), "TEST_ORGANIZATION_JUDGMENT", "TEST_REVISION:1"));
            }

            @Override
            public boolean isScopeAllowed(
                    UUID workspace, String group, String scopeType, UUID scopeId, TaskPath target) {
                return "STORE".equals(scopeType) && STORE.equals(scopeId) && STORE.equals(target.targetId());
            }
        };
        return new WorkspaceCapabilityScopeResolver(assignments, paths);
    }

    private static WorkspaceSessionReadback session(String capability) {
        return new WorkspaceSessionReadback(
                UUID.randomUUID(),
                WORKSPACE,
                GROUP,
                UUID.randomUUID(),
                ASSIGNMENT,
                WorkspaceSessionEntryReadback.ScopeContext.empty(),
                7L,
                11L,
                Set.of(),
                Set.of(capability),
                "命令上下文测试人员",
                "STORE",
                STORE);
    }

    private static WorkspaceCommandAuthorizationFacts commandFacts(WorkspaceSessionReadback session) {
        return new WorkspaceCommandAuthorizationFacts(session, UUID.randomUUID(), "STORE", STORE);
    }

    private static final class RecordingAuthenticationService extends WorkspaceAuthenticationService {
        private final WorkspaceCommandAuthorizationFacts facts;
        private int commandFactsCalls;
        private String lastCredential;

        private RecordingAuthenticationService(WorkspaceCommandAuthorizationFacts facts) {
            super(
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    new WorkspaceSessionRequestCache(false),
                    null,
                    new com.catering.v2s.platform.foundation.security.OtpDebugExposurePolicy("", false));
            this.facts = facts;
        }

        @Override
        public WorkspaceCommandAuthorizationFacts commandAuthorizationFacts(String rawToken) {
            commandFactsCalls++;
            lastCredential = rawToken;
            return facts;
        }

        private int commandFactsCalls() {
            return commandFactsCalls;
        }

        private String lastCredential() {
            return lastCredential;
        }
    }

    private static CatalogScopeLookup lookup() {
        return new CatalogScopeLookup() {
            @Override
            public CatalogBrandJudgment resolveCatalogBrand(
                    UUID workspace, String group, String type, UUID node, CatalogBrandSelection selection) {
                if (!WORKSPACE.equals(workspace)
                        || !GROUP.equals(group)
                        || !STORE.equals(node)
                        || !BRAND.toString().equals(selection.value())) {
                    throw new IllegalArgumentException("unexpected catalog brand selection");
                }
                return new CatalogBrandJudgment(BRAND.toString(), "TEST_ORGANIZATION_JUDGMENT", "TEST_REVISION:1");
            }

            @Override
            public void requireCatalogCopySource(
                    UUID workspace, String group, String type, UUID target, UUID source, String brand) {
                if (!BRAND_COPY_SOURCE.equals(source)) throw new IllegalArgumentException("unexpected source");
            }

            @Override
            public UUID resolveCatalogCopySource(UUID workspace, String group, String type, UUID target, String brand) {
                if (!"STORE".equals(type)
                        || !STORE.equals(target)
                        || !BRAND.toString().equals(brand))
                    throw new IllegalArgumentException("unexpected source judgment");
                return BRAND_COPY_SOURCE;
            }
        };
    }
}
