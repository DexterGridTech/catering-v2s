package com.catering.v2s.workspace.iam.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.extension.application.ExtensionCommandReceiptService;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.extension.application.persistence.ExtensionDefinitionPersistence;
import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.OrganizationVisibilityLookup;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OrganizationHierarchyService;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.foundation.workspace.WorkspaceStatusLookup;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class WorkspaceAuthenticationContextVersionTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static final long NOW = 1_785_000_000_000L;
    private static final UUID COMMERCIAL_GROUP_REF = UUID.randomUUID();
    private static Flyway flyway;
    private static JdbcTemplate jdbc;
    private static UUID workspaceId;
    private static OrganizationHierarchyService hierarchy;
    private static WorkspaceRoleService roles;
    private static final WorkspaceStatusLookup WORKSPACE_STATUSES = (id, key) -> jdbc.queryForObject(
            "SELECT status FROM platform_workspace.group_workspace WHERE workspace_uuid=? AND group_workspace_key=?",
            String.class,
            id,
            key);

    @BeforeAll
    static void setup() {
        flyway = Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("filesystem:../../src/main/resources/db/migration")
                .schemas("public")
                .defaultSchema("public")
                .cleanDisabled(false)
                .load();
        flyway.migrate();
        jdbc = new JdbcTemplate(
                new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
        workspaceId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, "
                        + "name_normalized, operations_title, status, revision, version, created_at_epoch_millis, "
                        + "updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, 'context-version-test', "
                        + "'Context version test', 'context version test', 'Context version test', 'ENABLED', 1, 1, ?, "
                        + "?, "
                        + "?)",
                workspaceId,
                NOW,
                NOW,
                NOW);
        hierarchy = new OrganizationHierarchyService(jdbc, () -> NOW, commercialGroups());
        roles = new WorkspaceRoleService(jdbc, () -> NOW);
    }

    @Test
    void assignmentAndDataNodeSelectionEachAdvanceContextVersionAndAStaleCompareAndSetCannotAdvanceItAgain() {
        UUID regionId = hierarchy.createRegion(workspaceId, "context-version-test", "context-region", "Context region")
                .id();
        UUID accountId = UUID.randomUUID();
        UUID roleId = roles.create(
                        workspaceId, "context-version-test", "Context operator", "REGION", null, Set.of(), Set.of())
                .id();
        UUID assignmentId = UUID.randomUUID();
        String token = "context-version-token";
        jdbc.update(
                "INSERT INTO workspace_iam.workspace_account (id, workspace_uuid, group_workspace_key, "
                        + "mobile_normalized, login_name_normalized, display_name, status, version, "
                        + "created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, 'context-version-test', "
                        + "'13800000111', 'context-user', 'Context user', 'ENABLED', 1, ?, ?)",
                accountId,
                workspaceId,
                NOW,
                NOW);
        // Credential hashes are globally unique.  This test does not authenticate, but its
        // fixture must still satisfy the production constraint so it remains independent of
        // all other Testcontainers test class fixtures.
        jdbc.update(
                "INSERT INTO workspace_iam.workspace_credential (account_id, password_hash, algorithm, "
                        + "changed_at_epoch_millis, failed_attempts, version) VALUES (?, ?, 'fixture', ?, 0, 1)",
                accountId,
                "not-used-by-context-test-" + accountId,
                NOW);
        UUID invitationId = insertCompletedInvitation(accountId);
        jdbc.update(
                "INSERT INTO workspace_iam.role_assignment (id, workspace_uuid, group_workspace_key, account_id, "
                        + "role_id, source_invitation_id, service_node_type, service_node_id, status, version, "
                        + "created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, 'context-version-test', ?, "
                        + "?, "
                        + "?, 'REGION', ?, 'ACTIVE', 1, ?, ?)",
                assignmentId,
                workspaceId,
                accountId,
                roleId,
                invitationId,
                regionId,
                NOW,
                NOW);
        jdbc.update(
                "INSERT INTO workspace_iam.workspace_session (id, workspace_uuid, group_workspace_key, account_id, "
                        + "token_hash, context_version, authorization_revision, status, expires_at_epoch_millis) "
                        + "VALUES "
                        + "(?, ?, 'context-version-test', ?, ?, 1, 1, 'ACTIVE', ?)",
                UUID.randomUUID(),
                workspaceId,
                accountId,
                sha256(token),
                NOW + 60_000L);

        WorkspaceAuthenticationService authentication = authentication(regionId);
        var afterContextSelection = authentication.selectContext(token, assignmentId, 1L);
        assertEquals("Context version test", afterContextSelection.workspaceName());
        assertEquals("Context version test", afterContextSelection.operationsTitle());
        assertEquals(null, afterContextSelection.logoAssetRef());
        assertEquals(2L, afterContextSelection.contextVersion());
        assertEquals(regionId, afterContextSelection.scopeContext().region().dataNodeId());
        var afterDataNodeSelection = authentication.selectDataNode(token, "REGION", regionId, 2L);
        assertEquals("Context version test", afterDataNodeSelection.workspaceName());
        assertEquals("Context version test", afterDataNodeSelection.operationsTitle());
        assertEquals(null, afterDataNodeSelection.logoAssetRef());
        assertEquals(3L, afterDataNodeSelection.contextVersion());
        assertThrows(
                WorkspaceAuthenticationService.SessionConflictException.class,
                () -> authentication.selectDataNode(token, "REGION", regionId, 2L));
        assertEquals(
                3L,
                jdbc.queryForObject(
                        "SELECT context_version FROM workspace_iam.workspace_session WHERE token_hash=?",
                        Long.class,
                        sha256(token)));
    }

    @Test
    void sessionEntryKeepsIdentitySelectionWhenTheSessionHasNoCurrentAssignment() {
        UUID regionId = hierarchy.createRegion(workspaceId, "context-version-test", "identity-region", "Identity region")
                .id();
        UUID accountId = UUID.randomUUID();
        UUID roleId = roles.create(
                        workspaceId, "context-version-test", "Identity operator", "REGION", null, Set.of(), Set.of())
                .id();
        UUID assignmentId = UUID.randomUUID();
        String token = "identity-selection-token";
        insertAccountAndCredential(accountId, "identity-user", false);
        UUID invitationId = insertCompletedInvitation(accountId);
        jdbc.update(
                "INSERT INTO workspace_iam.role_assignment (id, workspace_uuid, group_workspace_key, account_id, "
                        + "role_id, source_invitation_id, service_node_type, service_node_id, status, version, "
                        + "created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, 'context-version-test', ?, "
                        + "?, "
                        + "?, 'REGION', ?, 'ACTIVE', 1, ?, ?)",
                assignmentId,
                workspaceId,
                accountId,
                roleId,
                invitationId,
                regionId,
                NOW,
                NOW);
        insertSession(accountId, token);

        var entry = authentication(regionId).sessionEntry(token, "context-version-test");

        assertEquals(WorkspaceSessionEntryReadback.Outcome.SELECT_IDENTITY, entry.outcome());
        assertEquals(accountId, entry.accountId());
        assertEquals(assignmentId, entry.candidates().getFirst().roleAssignmentId());
        assertEquals("Identity operator", entry.candidates().getFirst().roleName());
    }

    @Test
    void sessionEntryKeepsPasswordChangeRequiredAheadOfMissingCurrentAssignment() {
        UUID accountId = UUID.randomUUID();
        String token = "password-change-session-entry-token";
        insertAccountAndCredential(accountId, "password-change-user", true);
        insertSession(accountId, token);

        var entry = authentication(UUID.randomUUID()).sessionEntry(token, "context-version-test");

        assertEquals(WorkspaceSessionEntryReadback.Outcome.PASSWORD_CHANGE_REQUIRED, entry.outcome());
        assertEquals(accountId, entry.accountId());
        assertEquals(WorkspaceSessionEntryReadback.Mode.EMPTY, entry.mode());
    }

    private static void insertAccountAndCredential(UUID accountId, String loginName, boolean passwordChangeRequired) {
        jdbc.update(
                "INSERT INTO workspace_iam.workspace_account (id, workspace_uuid, group_workspace_key, "
                        + "mobile_normalized, login_name_normalized, display_name, status, version, "
                        + "created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, 'context-version-test', ?, "
                        + "?, "
                        + "?, 'ENABLED', 1, ?, ?)",
                accountId,
                workspaceId,
                "138" + Math.abs(accountId.hashCode()),
                loginName,
                loginName,
                NOW,
                NOW);
        jdbc.update(
                "INSERT INTO workspace_iam.workspace_credential (account_id, password_hash, algorithm, "
                        + "changed_at_epoch_millis, failed_attempts, version, password_change_required) VALUES (?, ?, "
                        + "'fixture', ?, 0, 1, ?)",
                accountId,
                "session-entry-fixture-" + accountId,
                NOW,
                passwordChangeRequired);
    }

    private static UUID insertCompletedInvitation(UUID accountId) {
        UUID invitationId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO workspace_iam.invitation (id, workspace_uuid, group_workspace_key, token_hash, "
                        + "mobile_normalized, status, expires_at_epoch_millis, version, created_at_epoch_millis) "
                        + "VALUES "
                        + "(?, ?, 'context-version-test', ?, ?, 'COMPLETED', ?, 1, ?)",
                invitationId,
                workspaceId,
                sha256("context-invitation-token-" + accountId),
                "138" + Math.abs(accountId.hashCode()),
                NOW + 60_000L,
                NOW);
        return invitationId;
    }

    private static void insertSession(UUID accountId, String token) {
        jdbc.update(
                "INSERT INTO workspace_iam.workspace_session (id, workspace_uuid, group_workspace_key, account_id, "
                        + "token_hash, context_version, authorization_revision, status, expires_at_epoch_millis) "
                        + "VALUES "
                        + "(?, ?, 'context-version-test', ?, ?, 1, 1, 'ACTIVE', ?)",
                UUID.randomUUID(),
                workspaceId,
                accountId,
                sha256(token),
                NOW + 60_000L);
    }

    private static WorkspaceAuthenticationService authentication(UUID visibleNodeId) {
        TimeProvider time = () -> NOW;
        BusinessEntityService entities = new BusinessEntityService(
                jdbc,
                time,
                new ExtensionDefinitionService(
                        new ExtensionDefinitionPersistence(jdbc, time),
                        new ExtensionCommandReceiptService(jdbc, time),
                        WORKSPACE_STATUSES),
                hierarchy);
        CommercialGroupLookup groups = new CommercialGroupLookup() {
            @Override
            public UUID requireCommercialGroupRef(UUID workspaceUuid, String groupWorkspaceKey) {
                return visibleNodeId;
            }

            @Override
            public boolean isEnterableCommercialGroup(
                    UUID workspaceUuid, String groupWorkspaceKey, UUID commercialGroupRef) {
                return visibleNodeId.equals(commercialGroupRef);
            }

            @Override
            public String describeCommercialGroup(
                    UUID workspaceUuid, String groupWorkspaceKey, UUID commercialGroupRef) {
                return "Context group";
            }
        };
        OrganizationVisibilityLookup visibility = new OrganizationVisibilityLookup() {
            @Override
            public boolean isVisibleDataNodeAllowed(
                    UUID workspaceUuid,
                    String groupWorkspaceKey,
                    String assignmentNodeType,
                    UUID assignmentNodeId,
                    UUID candidateVisibleNodeId) {
                return visibleNodeId.equals(candidateVisibleNodeId);
            }

            @Override
            public List<VisibleDataNodeCandidate> listVisibleDataNodeCandidates(
                    UUID workspaceUuid, String groupWorkspaceKey, String assignmentNodeType, UUID assignmentNodeId) {
                return List.of(new VisibleDataNodeCandidate(
                        "REGION",
                        visibleNodeId,
                        "Context region",
                        "CTX-R",
                        List.of("Context region"),
                        visibleNodeId,
                        null,
                        null,
                        null));
            }
        };
        return new WorkspaceAuthenticationService(
                jdbc,
                time,
                roles,
                hierarchy,
                entities,
                entities,
                groups,
                new WorkspaceLoginRateLimitService(jdbc, time),
                new WorkspaceOtpRateLimitService(jdbc, time),
                (workspaceUuid, groupWorkspaceKey) -> "ENABLED",
                visibility,
                new WorkspaceSessionRequestCache(false),
                null);
    }

    private static String sha256(String value) {
        try {
            return java.util.HexFormat.of()
                    .formatHex(java.security.MessageDigest.getInstance("SHA-256")
                            .digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (Exception failure) {
            throw new IllegalStateException(failure);
        }
    }

    private static CommercialGroupLookup commercialGroups() {
        return new CommercialGroupLookup() {
            @Override
            public UUID requireCommercialGroupRef(UUID candidateWorkspace, String groupWorkspaceKey) {
                if (!workspaceId.equals(candidateWorkspace) || !"context-version-test".equals(groupWorkspaceKey)) {
                    throw new IllegalArgumentException("fixture commercial group is unavailable");
                }
                return COMMERCIAL_GROUP_REF;
            }

            @Override
            public boolean isEnterableCommercialGroup(
                    UUID candidateWorkspace, String groupWorkspaceKey, UUID commercialGroupRef) {
                return workspaceId.equals(candidateWorkspace)
                        && "context-version-test".equals(groupWorkspaceKey)
                        && COMMERCIAL_GROUP_REF.equals(commercialGroupRef);
            }

            @Override
            public String describeCommercialGroup(
                    UUID candidateWorkspace, String groupWorkspaceKey, UUID commercialGroupRef) {
                return "Context test group";
            }
        };
    }

    @AfterAll
    static void cleanup() {
        if (flyway != null) flyway.clean();
    }
}
