package com.catering.v2s.workspace.iam.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.extension.application.ExtensionCommandReceiptService;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.extension.application.persistence.ExtensionDefinitionPersistence;
import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.WorkspaceAssignmentScopeLookup;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OrganizationCommandService;
import com.catering.v2s.organization.application.OrganizationHierarchyService;
import com.catering.v2s.organization.application.OrganizationTaskPathService;
import com.catering.v2s.platform.access.PlatformExecutionContext;
import com.catering.v2s.platform.foundation.workspace.WorkspaceStatusLookup;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import java.time.Instant;
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
class WorkspaceUserTaskScopeTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static final long NOW = 1_785_000_000_000L;
    private static Flyway flyway;
    private static JdbcTemplate jdbc;
    private static UUID workspace;
    private static UUID commercialGroup;
    private static UUID role;

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
        workspace = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, "
                        + "name_normalized, operations_title, status, revision, version, created_at_epoch_millis, "
                        + "updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, 'scope-test', 'Scope "
                        + "test', "
                        + "'scope test', 'Scope test', 'ENABLED', 1, 1, ?, ?, ?)",
                workspace,
                NOW,
                NOW,
                NOW);
        long groupWorkspaceId = jdbc.queryForObject(
                "SELECT id FROM platform_workspace.group_workspace WHERE group_workspace_key='scope-test'", Long.class);
        new OrganizationCommandService(jdbc, WORKSPACE_STATUSES, () -> NOW)
                .execute(
                        new PlatformExecutionContext(
                                "scope-test", "platform-admin", Instant.ofEpochMilli(NOW + 60_000L), "scope-test"),
                        workspace,
                        "scope-test",
                        groupWorkspaceId,
                        "scope-test-commercial-group-0001",
                        "SCOPE-ROOT",
                        "Scope root",
                        com.catering.v2s.audit.contract.AuditActor.system());
        commercialGroup = jdbc.queryForObject(
                "SELECT commercial_group_uuid FROM organization.commercial_group WHERE "
                        + "group_workspace_key='scope-test'",
                UUID.class);
        role = new WorkspaceRoleService(jdbc, () -> NOW)
                .create(workspace, "scope-test", "Project operator", "PROJECT", null, Set.of(), Set.of())
                .id();
    }

    @Test
    void regionOperatorOpeningProjectUserManagementReturnsProjectPersonnelAndExcludesPeerBranch() {
        OrganizationHierarchyService hierarchy = new OrganizationHierarchyService(jdbc, () -> NOW, groups(commercialGroup));
        UUID group = commercialGroup;
        UUID region = hierarchy
                .createRegion(workspace, "scope-test", "scope-region", "Scope region")
                .id();
        UUID includedProject = hierarchy
                .create(workspace, "scope-test", "PROJECT", region, "included-project", "Included project")
                .id();
        UUID peerRegion = hierarchy
                .createRegion(workspace, "scope-test", "peer-region", "Peer region")
                .id();
        UUID excludedProject = hierarchy
                .create(workspace, "scope-test", "PROJECT", peerRegion, "excluded-project", "Excluded project")
                .id();
        UUID included = account("13800000031", "included");
        UUID excluded = account("13800000032", "excluded");
        assignment(included, includedProject);
        assignment(excluded, excludedProject);
        CommercialGroupLookup groups = groups(group);
        WorkspaceUserService service = new WorkspaceUserService(
                jdbc,
                hierarchy,
                new BusinessEntityService(
                        jdbc,
                        () -> NOW,
                        new ExtensionDefinitionService(
                                new ExtensionDefinitionPersistence(jdbc, () -> NOW),
                                new ExtensionCommandReceiptService(jdbc, () -> NOW),
                                WORKSPACE_STATUSES),
                        hierarchy),
                new WorkspaceRoleService(jdbc, () -> NOW),
                groups,
                (w, k, t) -> List.of(),
                (w, k, current) -> new WorkspaceAssignmentScopeLookup.AssignmentScope("REGION", region),
                new OrganizationTaskPathService(jdbc, groups));
        WorkspaceSessionReadback session = session(UUID.randomUUID(), "PROJECT", includedProject);
        var page = operationsPage(service, session, "PROJECT", includedProject, 1, 20, null, null);
        assertEquals(1, page.total());
        assertEquals(included, page.items().getFirst().accountId());
        assertEquals("PROJECT", page.targetOrganizationType());
        assertEquals(includedProject.toString(), page.scopeRef());
    }

    @Test
    void groupOperatorOpeningStoreUserManagementProjectsOnlyTheExactStoreAssignmentsInListAndDetail() {
        OrganizationHierarchyService hierarchy = new OrganizationHierarchyService(jdbc, () -> NOW, groups(commercialGroup));
        UUID group = commercialGroup;
        UUID region = hierarchy
                .createRegion(workspace, "scope-test", "group-store-region", "Group store region")
                .id();
        UUID project = hierarchy
                .create(workspace, "scope-test", "PROJECT", region, "group-store-project", "Group store project")
                .id();
        UUID store = store(project, "group-store");
        UUID siblingStore = store(project, "group-store-sibling");
        WorkspaceRoleService roles = new WorkspaceRoleService(jdbc, () -> NOW);
        UUID groupRole = roles.create(workspace, "scope-test", "Group operator", "GROUP", null, Set.of(), Set.of())
                .id();
        UUID projectRole = roles.create(
                        workspace, "scope-test", "Project operator for projection", "PROJECT", null, Set.of(), Set.of())
                .id();
        UUID storeRole = roles.create(workspace, "scope-test", "Store operator", "STORE", null, Set.of(), Set.of())
                .id();
        UUID account = account("13800000033", "store-user");
        assignment(account, group, "GROUP", groupRole);
        assignment(account, project, "PROJECT", projectRole);
        assignment(account, siblingStore, "STORE", storeRole);
        assignment(account, store, "STORE", storeRole);
        CommercialGroupLookup groups = groups(group);
        WorkspaceUserService service =
                service(hierarchy, groups, new WorkspaceAssignmentScopeLookup.AssignmentScope("GROUP", group));
        WorkspaceSessionReadback session = session(group, "STORE", store);
        var page = operationsPage(service, session, "STORE", store, 1, 20, null, null);
        assertEquals(1, page.total());
        assertEquals(account, page.items().getFirst().accountId());
        assertEquals("STORE", page.targetOrganizationType());
        assertEquals(1, page.items().getFirst().activeAssignmentCount());
        assertEquals(
                List.of("Store operator"),
                page.items().getFirst().assignments().stream()
                        .map(WorkspaceUserService.Assignment::roleName)
                        .toList());
        var detail = service.detail(WorkspaceUserService.AccountDetailQuery.forOperations(session, "STORE", account));
        assertEquals(1, detail.activeAssignmentCount());
        assertEquals(
                List.of("Store operator"),
                detail.assignments().stream()
                        .map(WorkspaceUserService.Assignment::roleName)
                        .toList());
    }

    @Test
    void fixedGroupUserPageMayUseTheCurrentGroupAssignmentWhenNoDataScopeIsRequired() {
        OrganizationHierarchyService hierarchy = new OrganizationHierarchyService(jdbc, () -> NOW, groups(commercialGroup));
        UUID group = commercialGroup;
        CommercialGroupLookup groups = groups(group);
        WorkspaceUserService service =
                service(hierarchy, groups, new WorkspaceAssignmentScopeLookup.AssignmentScope("GROUP", group));
        WorkspaceSessionReadback session = session(group, null);
        var scope = service.resolveTaskScope(session, "GROUP", null);
        assertEquals("GROUP", scope.targetType());
        assertEquals(group, scope.targetId());
    }

    @Test
    void fixedGroupUserPageIgnoresStaleVisibleDataScopeFromAnotherPage() {
        OrganizationHierarchyService hierarchy = new OrganizationHierarchyService(jdbc, () -> NOW, groups(commercialGroup));
        UUID group = commercialGroup;
        CommercialGroupLookup groups = groups(group);
        WorkspaceUserService service =
                service(hierarchy, groups, new WorkspaceAssignmentScopeLookup.AssignmentScope("GROUP", group));
        var scope = service.resolveTaskScope(session(group, UUID.randomUUID()), "GROUP", UUID.randomUUID());
        assertEquals("GROUP", scope.targetType());
        assertEquals(group, scope.targetId());
    }

    @Test
    void groupOperatorOpeningHeadCompanyUserManagementUsesTheExplicitHeadCompanySelection() {
        OrganizationHierarchyService hierarchy = new OrganizationHierarchyService(jdbc, () -> NOW, groups(commercialGroup));
        UUID group = commercialGroup;
        UUID headCompany = headCompany("aggregate-head-company");
        WorkspaceRoleService roles = new WorkspaceRoleService(jdbc, () -> NOW);
        UUID headRole = roles.create(
                        workspace, "scope-test", "Head company operator", "HEAD_COMPANY", null, Set.of(), Set.of())
                .id();
        UUID account = account("13800000036", "head-company-user");
        assignment(account, headCompany, "HEAD_COMPANY", headRole);
        WorkspaceUserService service =
                service(hierarchy, groups(group), new WorkspaceAssignmentScopeLookup.AssignmentScope("GROUP", group));
        var page = operationsPage(
                service, session(group, "HEAD_COMPANY", headCompany), "HEAD_COMPANY", headCompany, 1, 20, null, null);
        assertEquals(1, page.total());
        assertEquals(account, page.items().getFirst().accountId());
        assertEquals("HEAD_COMPANY", page.targetOrganizationType());
        assertEquals(headCompany.toString(), page.scopeRef());
        assertThrows(
                WorkspaceUserService.TaskScopeDeniedException.class,
                () -> operationsPage(
                        service,
                        session(group, "PROJECT", UUID.randomUUID()),
                        "HEAD_COMPANY",
                        headCompany,
                        1,
                        20,
                        null,
                        null));
    }

    @Test
    void commandTargetResolverUsesTheExplicitHeadCompanyTargetInsteadOfTheVisibleScope() {
        OrganizationHierarchyService hierarchy = new OrganizationHierarchyService(jdbc, () -> NOW, groups(commercialGroup));
        UUID group = commercialGroup;
        UUID headCompany = headCompany("command-target-head-company");
        WorkspaceUserService service =
                service(hierarchy, groups(group), new WorkspaceAssignmentScopeLookup.AssignmentScope("GROUP", group));
        var target = service.resolveCommandTarget(session(group, UUID.randomUUID()), "HEAD_COMPANY", headCompany);
        assertEquals("HEAD_COMPANY", target.targetType());
        assertEquals(headCompany, target.targetId());
    }

    @Test
    void pageBundlesOneHundredAccountsAndThreeAssignmentsWithoutChangingPageBoundaries() {
        OrganizationHierarchyService hierarchy = new OrganizationHierarchyService(jdbc, () -> NOW, groups(commercialGroup));
        UUID group = commercialGroup;
        UUID region = hierarchy
                .createRegion(workspace, "scope-test", "bundle-region", "Bundle region")
                .id();
        UUID project = hierarchy
                .create(workspace, "scope-test", "PROJECT", region, "bundle-project", "Bundle project")
                .id();
        WorkspaceRoleService roles = new WorkspaceRoleService(jdbc, () -> NOW);
        UUID secondRole = roles.create(workspace, "scope-test", "Bundle role two", "PROJECT", null, Set.of(), Set.of())
                .id();
        UUID thirdRole = roles.create(workspace, "scope-test", "Bundle role three", "PROJECT", null, Set.of(), Set.of())
                .id();
        for (int index = 0; index < 100; index++) {
            UUID account = account(String.format("139%08d", index), String.format("bundle-%03d", index));
            assignment(account, project, "PROJECT", role);
            assignment(account, project, "PROJECT", secondRole);
            assignment(account, project, "PROJECT", thirdRole);
        }
        WorkspaceUserService service = service(
                hierarchy, groups(group), new WorkspaceAssignmentScopeLookup.AssignmentScope("PROJECT", project));
        var first = operationsPage(service, session(project, project), "PROJECT", project, 1, 100, null, null);
        var third = operationsPage(service, session(project, project), "PROJECT", project, 3, 40, null, null);
        assertEquals(100, first.total());
        assertEquals(100, first.items().size());
        assertEquals(3, first.items().getFirst().activeAssignmentCount());
        assertEquals(20, third.items().size());
        assertEquals(3, third.page());
    }

    @Test
    void operationsUserPageUsesOnlyConcreteAccountSortKeysAndAStableAccountIdTieBreaker() {
        OrganizationHierarchyService hierarchy = new OrganizationHierarchyService(jdbc, () -> NOW, groups(commercialGroup));
        UUID group = commercialGroup;
        UUID region = hierarchy
                .createRegion(workspace, "scope-test", "sort-region", "Sort region")
                .id();
        UUID project = hierarchy
                .create(workspace, "scope-test", "PROJECT", region, "sort-project", "Sort project")
                .id();
        UUID first = account(
                UUID.fromString("00000000-0000-0000-0000-000000000001"), "13800000041", "same-login-a", "Same name");
        UUID second = account(
                UUID.fromString("00000000-0000-0000-0000-000000000002"), "13800000042", "same-login-b", "Same name");
        UUID third =
                account(UUID.fromString("00000000-0000-0000-0000-000000000003"), "13800000043", "z-login", "Zulu name");
        assignment(first, project);
        assignment(second, project);
        assignment(third, project);
        WorkspaceUserService service = service(
                hierarchy, groups(group), new WorkspaceAssignmentScopeLookup.AssignmentScope("PROJECT", project));
        WorkspaceSessionReadback session = session(project, project);

        var displayNamePage = operationsPage(service, session, "PROJECT", project, 1, 20, "DISPLAY_NAME", "ASC");
        var defaultPage = operationsPage(service, session, "PROJECT", project, 1, 20, null, null);

        assertEquals(
                List.of(first, second, third),
                displayNamePage.items().stream()
                        .map(WorkspaceUserService.User::accountId)
                        .toList());
        assertEquals("DISPLAY_NAME", displayNamePage.sort());
        assertEquals("ASC", displayNamePage.direction());
        assertEquals("LOGIN_NAME", defaultPage.sort());
        assertEquals("ASC", defaultPage.direction());
        assertThrows(
                WorkspaceAccountService.AccountNotFoundException.class,
                () -> operationsPage(service, session, "PROJECT", project, 1, 20, "ROLE_NAME", "ASC"));
    }

    @Test
    void platformAccountPageSortsUpdatedAtWithStableAccountIdTieBreaker() {
        OrganizationHierarchyService hierarchy = new OrganizationHierarchyService(jdbc, () -> NOW, groups(commercialGroup));
        UUID first = account(
                UUID.fromString("00000000-0000-0000-0000-000000000011"),
                "13800000051",
                "platform-same-login-a",
                "First");
        UUID second = account(
                UUID.fromString("00000000-0000-0000-0000-000000000012"),
                "13800000052",
                "platform-same-login-b",
                "Second");
        UUID latest = account(
                UUID.fromString("00000000-0000-0000-0000-000000000013"), "13800000053", "platform-z-login", "Latest");
        jdbc.update(
                "UPDATE workspace_iam.workspace_account SET updated_at_epoch_millis=? WHERE id IN (?, ?)",
                NOW + 1_000L,
                first,
                second);
        jdbc.update(
                "UPDATE workspace_iam.workspace_account SET updated_at_epoch_millis=? WHERE id=?",
                NOW + 2_000L,
                latest);
        WorkspaceUserService service = service(
                hierarchy,
                groups(UUID.randomUUID()),
                new WorkspaceAssignmentScopeLookup.AssignmentScope("GROUP", UUID.randomUUID()));

        var updatedAtPage = platformPage(service, null, null, 1, 20, "UPDATED_AT", "DESC");
        var defaultPage = platformPage(service, null, null, 1, 20, null, null);

        assertEquals(
                List.of(latest, first, second),
                updatedAtPage.items().stream()
                        .limit(3)
                        .map(WorkspaceUserService.User::accountId)
                        .toList());
        assertEquals("UPDATED_AT", updatedAtPage.sort());
        assertEquals("DESC", updatedAtPage.direction());
        assertEquals("LOGIN_NAME", defaultPage.sort());
        assertEquals("ASC", defaultPage.direction());
        assertThrows(
                WorkspaceAccountService.AccountNotFoundException.class,
                () -> platformPage(service, null, null, 1, 20, "ROLE_NAME", "ASC"));
    }

    @Test
    void accountRoleCandidateQueryUsesTheCanonicalOwnerReadWithoutAnInvitationTarget() {
        OrganizationHierarchyService hierarchy = new OrganizationHierarchyService(jdbc, () -> NOW, groups(commercialGroup));
        WorkspaceRoleService roles = new WorkspaceRoleService(jdbc, () -> NOW);
        String roleName = "Account filter candidate " + UUID.randomUUID();
        roles.create(workspace, "scope-test", roleName, "GROUP", null, Set.of(), Set.of());
        WorkspaceUserService service = service(
                hierarchy,
                groups(UUID.randomUUID()),
                new WorkspaceAssignmentScopeLookup.AssignmentScope("GROUP", UUID.randomUUID()));

        var page = service.candidates(WorkspaceUserService.CandidateQuery.forPlatform(
                workspace, "scope-test", "GROUP", "ROLE", "LIST_FILTER", roleName, 1, 20, null));

        assertEquals(
                List.of(roleName),
                page.roles().stream()
                        .map(com.catering.v2s.workspace.iam.api.WorkspaceRoleReadback::name)
                        .toList());
        assertThrows(
                IllegalArgumentException.class,
                () -> service.candidates(WorkspaceUserService.CandidateQuery.forPlatform(
                        workspace, "scope-test", "GROUP", "ROLE", "INVITATION_TARGET", roleName, 1, 20, null)));
    }

    @Test
    void peerRegionProjectScopeIsDenied() {
        OrganizationHierarchyService hierarchy = new OrganizationHierarchyService(jdbc, () -> NOW, groups(commercialGroup));
        UUID group = commercialGroup;
        UUID region = hierarchy
                .createRegion(workspace, "scope-test", "peer-current-region", "Peer current region")
                .id();
        UUID peer = hierarchy
                .createRegion(workspace, "scope-test", "peer-other-region", "Peer other region")
                .id();
        UUID peerProject = hierarchy
                .create(workspace, "scope-test", "PROJECT", peer, "peer-other-project", "Peer other project")
                .id();
        WorkspaceUserService service =
                service(hierarchy, groups(group), new WorkspaceAssignmentScopeLookup.AssignmentScope("REGION", region));
        assertThrows(
                WorkspaceUserService.TaskScopeDeniedException.class,
                () -> service.resolveTaskScope(session(region, peerProject), "PROJECT", peerProject));
    }

    @Test
    void crossGroupProjectIdIsDenied() {
        OrganizationHierarchyService hierarchy = new OrganizationHierarchyService(jdbc, () -> NOW, groups(commercialGroup));
        UUID group = commercialGroup;
        UUID region = hierarchy
                .createRegion(workspace, "scope-test", "cross-current-region", "Cross current region")
                .id();
        UUID foreignWorkspace = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, "
                        + "name_normalized, operations_title, status, revision, version, created_at_epoch_millis, "
                        + "updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, 'foreign-scope', "
                        + "'Foreign "
                        + "scope', 'foreign scope', 'Foreign scope', 'ENABLED', 1, 1, ?, ?, ?)",
                foreignWorkspace,
                NOW,
                NOW,
                NOW);
        UUID foreignRegion = hierarchy
                .createRegion(foreignWorkspace, "foreign-scope", "foreign-region", "Foreign region")
                .id();
        UUID foreignProject = hierarchy
                .create(
                        foreignWorkspace,
                        "foreign-scope",
                        "PROJECT",
                        foreignRegion,
                        "foreign-project",
                        "Foreign project")
                .id();
        WorkspaceUserService service =
                service(hierarchy, groups(group), new WorkspaceAssignmentScopeLookup.AssignmentScope("REGION", region));
        assertThrows(
                OrganizationTaskPathService.TaskPathNotFoundException.class,
                () -> service.resolveTaskScope(session(region, foreignProject), "PROJECT", foreignProject));
    }

    @Test
    void storeAssignmentCannotSelectAnotherStore() {
        OrganizationHierarchyService hierarchy = new OrganizationHierarchyService(jdbc, () -> NOW, groups(commercialGroup));
        UUID group = commercialGroup;
        UUID region = hierarchy
                .createRegion(workspace, "scope-test", "store-current-region", "Store current region")
                .id();
        UUID project = hierarchy
                .create(workspace, "scope-test", "PROJECT", region, "store-current-project", "Store current project")
                .id();
        UUID ownStore = store(project, "own-store");
        UUID foreignStore = store(project, "foreign-store");
        WorkspaceUserService service = service(
                hierarchy, groups(group), new WorkspaceAssignmentScopeLookup.AssignmentScope("STORE", ownStore));
        assertThrows(
                WorkspaceUserService.TaskScopeDeniedException.class,
                () -> service.resolveTaskScope(session(ownStore, foreignStore), "STORE", foreignStore));
    }

    @Test
    void projectRevokeRequiresProjectRoleRevokeCapabilityBeforeReceiptReplay() {
        OrganizationHierarchyService hierarchy = new OrganizationHierarchyService(jdbc, () -> NOW, groups(commercialGroup));
        UUID group = commercialGroup;
        UUID region = hierarchy
                .createRegion(workspace, "scope-test", "revoke-region", "Revoke region")
                .id();
        UUID project = hierarchy
                .create(workspace, "scope-test", "PROJECT", region, "revoke-project", "Revoke project")
                .id();
        WorkspaceRoleService roles = new WorkspaceRoleService(jdbc, () -> NOW);
        UUID actorRole = roles.create(
                        workspace,
                        "scope-test",
                        "Project revoke authority",
                        "REGION",
                        null,
                        Set.of(),
                        Set.of("BC-IAM-PROJECT-ROLE-REVOKE"))
                .id();
        UUID actor = account("13800000034", "revoke-actor");
        UUID target = account("13800000035", "revoke-target");
        UUID actorAssignment = assignment(actor, region, "REGION", actorRole);
        UUID targetAssignment = assignment(target, project, "PROJECT", role);
        CommercialGroupLookup groups = groups(group);
        WorkspaceCommandAuthorizationService authorization = new WorkspaceCommandAuthorizationService(
                jdbc,
                (w, k, current) -> new WorkspaceAssignmentScopeLookup.AssignmentScope("REGION", region),
                new OrganizationTaskPathService(jdbc, groups));
        WorkspaceAccountService accounts = new WorkspaceAccountService(jdbc, () -> NOW, authorization);
        String idempotencyKey = "operations-assignment-revoke-001";
        var actorSnapshot = com.catering.v2s.audit.contract.AuditActor.system();
        UUID first = accounts.revokeAssignmentForOperations(
                workspace,
                "scope-test",
                actorAssignment,
                "PROJECT",
                targetAssignment,
                1L,
                idempotencyKey,
                actorSnapshot);
        UUID replay = accounts.revokeAssignmentForOperations(
                workspace,
                "scope-test",
                actorAssignment,
                "PROJECT",
                targetAssignment,
                1L,
                idempotencyKey,
                actorSnapshot);
        assertEquals(target, first);
        assertEquals(first, replay);
        assertEquals(
                "REVOKED",
                jdbc.queryForObject(
                        "SELECT status FROM workspace_iam.role_assignment WHERE id=?", String.class, targetAssignment));
        assertEquals(
                1L,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM workspace_iam.audit_event WHERE "
                                + "action='WORKSPACE_ACCOUNT_ASSIGNMENT_REVOKED' AND entity_ref_text=?",
                        Long.class,
                        target.toString()));
        assertThrows(
                WorkspaceIamCommandReceiptService.WorkspaceIamIdempotencyConflictException.class,
                () -> accounts.revokeAssignmentForOperations(
                        workspace,
                        "scope-test",
                        actorAssignment,
                        "PROJECT",
                        targetAssignment,
                        2L,
                        idempotencyKey,
                        actorSnapshot));
        assertThrows(
                WorkspaceCommandAuthorizationService.AuthorizationDeniedException.class,
                () -> accounts.revokeAssignmentForOperations(
                        workspace,
                        "scope-test",
                        actorAssignment,
                        "GROUP",
                        targetAssignment,
                        1L,
                        idempotencyKey,
                        actorSnapshot));
    }

    private static UUID account(String mobile, String login) {
        return account(UUID.randomUUID(), mobile, login, login);
    }

    private static UUID account(UUID id, String mobile, String login, String displayName) {
        jdbc.update(
                "INSERT INTO workspace_iam.workspace_account (id, workspace_uuid, group_workspace_key, "
                        + "mobile_normalized, login_name_normalized, display_name, status, version, "
                        + "created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, 'scope-test', ?, ?, ?, "
                        + "'ENABLED', 1, ?, ?)",
                id,
                workspace,
                mobile,
                login,
                displayName,
                NOW,
                NOW);
        return id;
    }

    private static WorkspaceUserService service(
            OrganizationHierarchyService hierarchy,
            CommercialGroupLookup groups,
            WorkspaceAssignmentScopeLookup.AssignmentScope scope) {
        return new WorkspaceUserService(
                jdbc,
                hierarchy,
                new BusinessEntityService(
                        jdbc,
                        () -> NOW,
                        new ExtensionDefinitionService(
                                new ExtensionDefinitionPersistence(jdbc, () -> NOW),
                                new ExtensionCommandReceiptService(jdbc, () -> NOW),
                                WORKSPACE_STATUSES),
                        hierarchy),
                new WorkspaceRoleService(jdbc, () -> NOW),
                groups,
                (w, k, t) -> List.of(),
                (w, k, current) -> scope,
                new OrganizationTaskPathService(jdbc, groups));
    }

    private static WorkspaceUserService.AccountPage operationsPage(
            WorkspaceUserService service,
            WorkspaceSessionReadback session,
            String targetType,
            UUID scopeRef,
            int page,
            int pageSize,
            String sort,
            String direction) {
        return service.page(WorkspaceUserService.AccountPageQuery.forOperations(
                session, targetType, scopeRef, null, null, null, null, sort, direction, page, pageSize));
    }

    private static WorkspaceUserService.AccountPage platformPage(
            WorkspaceUserService service,
            String targetType,
            UUID organizationRef,
            int page,
            int pageSize,
            String sort,
            String direction) {
        return service.page(WorkspaceUserService.AccountPageQuery.forPlatform(
                workspace,
                "scope-test",
                null,
                null,
                null,
                null,
                null,
                targetType,
                organizationRef,
                sort,
                direction,
                page,
                pageSize));
    }

    private static WorkspaceSessionReadback session(UUID assignmentNode, UUID selectedScope) {
        return session(assignmentNode, "PROJECT", selectedScope);
    }

    private static WorkspaceSessionReadback session(UUID assignmentNode, String selectedType, UUID selectedScope) {
        var selected = selectedScope == null
                ? null
                : new com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback.VisibleDataNodeCandidate(
                        selectedType,
                        selectedScope,
                        "Selected scope",
                        "SELECTED",
                        List.of("Selected scope"),
                        "REGION".equals(selectedType) ? selectedScope : null,
                        "PROJECT".equals(selectedType) ? selectedScope : null,
                        "STORE".equals(selectedType) ? selectedScope : null,
                        "HEAD_COMPANY".equals(selectedType) ? selectedScope : null);
        var scopeContext = new com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback.ScopeContext(
                "REGION".equals(selectedType) ? selected : null,
                "PROJECT".equals(selectedType) ? selected : null,
                "STORE".equals(selectedType) ? selected : null,
                "HEAD_COMPANY".equals(selectedType) ? selected : null);
        return new WorkspaceSessionReadback(
                UUID.randomUUID(),
                workspace,
                "scope-test",
                UUID.randomUUID(),
                UUID.randomUUID(),
                scopeContext,
                7L,
                1L,
                Set.of(),
                Set.of(),
                "Scope operator");
    }

    private static UUID store(UUID project, String code) {
        UUID tenant = UUID.randomUUID();
        UUID brand = UUID.randomUUID();
        UUID id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO organization.tenant (id, workspace_uuid, group_workspace_key, code, name, legal_name, "
                        + "credit_code, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, "
                        + "?, "
                        + "'scope-test', ?, ?, ?, ?, 'ENABLED', 1, ?, ?)",
                tenant,
                workspace,
                code + "-tenant",
                code + " tenant",
                code + " tenant legal",
                code + "-credit",
                NOW,
                NOW);
        jdbc.update(
                "INSERT INTO organization.brand (id, workspace_uuid, group_workspace_key, code, name, status, version, "
                        + "created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, 'scope-test', ?, ?, "
                        + "'ENABLED', "
                        + "1, ?, ?)",
                brand,
                workspace,
                code + "-brand",
                code + " brand",
                NOW,
                NOW);
        jdbc.update(
                "INSERT INTO organization.store (id, workspace_uuid, group_workspace_key, project_id, tenant_id, "
                        + "brand_id, code, name, status, version, created_at_epoch_millis, updated_at_epoch_millis) "
                        + "VALUES "
                        + "(?, ?, 'scope-test', ?, ?, ?, ?, ?, 'ENABLED', 1, ?, ?)",
                id,
                workspace,
                project,
                tenant,
                brand,
                code,
                code + " store",
                NOW,
                NOW);
        return id;
    }

    private static UUID headCompany(String code) {
        UUID id = UUID.randomUUID();
        String creditCode = "hc-" + id.toString().replace("-", "").substring(0, 24);
        jdbc.update(
                "INSERT INTO organization.head_company (id, workspace_uuid, group_workspace_key, code, name, "
                        + "legal_name, credit_code, status, version, created_at_epoch_millis, updated_at_epoch_millis) "
                        + "VALUES (?, ?, 'scope-test', ?, ?, ?, ?, 'ENABLED', 1, ?, ?)",
                id,
                workspace,
                code,
                code + " head company",
                code + " legal",
                creditCode,
                NOW,
                NOW);
        return id;
    }

    private static void assignment(UUID account, UUID target) {
        assignment(account, target, "PROJECT", role);
    }

    private static void assignment(UUID account, UUID target, String targetType) {
        assignment(account, target, targetType, role);
    }

    private static UUID assignment(UUID account, UUID target, String targetType, UUID assignedRole) {
        UUID id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO workspace_iam.role_assignment (id, workspace_uuid, group_workspace_key, account_id, "
                        + "role_id, source_invitation_id, service_node_type, service_node_id, status, version, "
                        + "created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, 'scope-test', ?, ?, ?, ?, "
                        + "?, "
                        + "'ACTIVE', 1, ?, ?)",
                id,
                workspace,
                account,
                assignedRole,
                invitation(),
                targetType,
                target,
                NOW,
                NOW);
        return id;
    }

    private static UUID invitation() {
        UUID id = UUID.randomUUID();
        String tokenHash = UUID.randomUUID().toString().replace("-", "")
                + UUID.randomUUID().toString().replace("-", "");
        jdbc.update(
                "INSERT INTO workspace_iam.invitation (id, workspace_uuid, group_workspace_key, token_hash, "
                        + "mobile_normalized, status, expires_at_epoch_millis, version, created_at_epoch_millis) "
                        + "VALUES "
                        + "(?, ?, 'scope-test', ?, ?, 'COMPLETED', ?, 1, ?)",
                id,
                workspace,
                tokenHash,
                "fixture-" + id.toString().substring(0, 20),
                NOW + 86_400_000L,
                NOW);
        return id;
    }

    private static CommercialGroupLookup groups(UUID ref) {
        return new CommercialGroupLookup() {
            @Override
            public UUID requireCommercialGroupRef(UUID w, String k) {
                return ref;
            }

            @Override
            public boolean isEnterableCommercialGroup(UUID w, String k, UUID candidate) {
                return ref.equals(candidate);
            }

            @Override
            public String describeCommercialGroup(UUID w, String k, UUID candidate) {
                return "group Scope test";
            }
        };
    }

    @AfterAll
    static void cleanup() {
        if (flyway != null) flyway.clean();
    }
}
