package database;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.audit.contract.AuditActor;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.catering.v2s.contract.application.BusinessDateProvider;
import com.catering.v2s.contract.application.ContractCommandService;
import com.catering.v2s.contract.application.ContractTaskReadService;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OrganizationHierarchyService;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService;
import com.catering.v2s.organization.application.OrganizationVisibilityService;
import com.catering.v2s.organization.application.OrganizationCommandService;
import com.catering.v2s.organization.application.OrganizationTaskPathService;
import com.catering.v2s.organization.application.OrganizationAssignmentCandidateService;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.platform.asset.application.AssetObjectStorage;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.workspace.iam.application.WorkspaceRoleService;
import com.catering.v2s.workspace.iam.application.WorkspaceAccountService;
import com.catering.v2s.workspace.iam.application.WorkspaceAssignmentScopeService;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationService;
import com.catering.v2s.workspace.iam.application.WorkspaceIamCommandReceiptService;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;
import com.catering.v2s.workspace.iam.application.WorkspaceLoginRateLimitService;
import com.catering.v2s.workspace.iam.application.WorkspaceOtpRateLimitService;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import com.catering.v2s.workspace.iam.application.WorkspaceSessionRequestCache;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import java.io.PrintWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.SQLFeatureNotSupportedException;
import java.sql.Statement;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.logging.Logger;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Real PostgreSQL SQL-budget harness. Fixture writes use {@link #setupJdbc}; every production
 * collaborator under measurement receives the one {@link #countedJdbc} backed by the same
 * {@link CountingDataSource}. The counter therefore sees statement execution, not merely one
 * JdbcTemplate overload.
 */
@Testcontainers
class P4SqlOperationBudgetTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    private static final long NOW = 1_785_000_000_000L;
    private static final String KEY = "p4-budget";
    private static final String LEDGER_RELATIVE_PATH = "doc/evidence/platform/rm1/p4/canonical-performance-ledger.json";

    /** The executable set is deliberately bound to the canonical ledger below. */
    private static final Set<String> REQUIRED_LEDGER_IDS = Set.of(
        "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "M12", "M13",
        "S1", "S2", "S3", "S4", "S5", "S6", "O1", "O2", "O3", "O4", "O5", "O6", "R8"
    );

    /** Named source identities: no row may silently disappear while fixtures are being added. */
    private static final Map<String, String> NAMED_LEDGER_OPERATIONS = Map.ofEntries(
        Map.entry("M2", "ContractTaskReadService#fixedStoreContracts"),
        Map.entry("M3", "ContractTaskReadService#list"),
        Map.entry("M4", "ContractTaskReadService#list"),
        Map.entry("M5", "ContractCommandService#list"),
        Map.entry("M6", "WorkspaceRoleService#list"),
        Map.entry("M7", "BusinessEntityService#listEntities"),
        Map.entry("M8", "BusinessEntityService#authorizedBrands"),
        Map.entry("M9", "BusinessEntityService#authorizedBrandAuthorizations"),
        Map.entry("M10", "ExtensionDefinitionService#listDefinitions"),
        Map.entry("M11", "OrganizationVisibilityService#listVisibleDataNodeCandidates"),
        Map.entry("M12", "OrganizationCommandService#describeCommercialGroup"),
        Map.entry("M13", "PlatformAssetService#requireActivePublicReference"),
        Map.entry("S1", "WorkspaceAuthenticationService#login"),
        Map.entry("S2", "WorkspaceAuthenticationService#sessionEntry"),
        Map.entry("S3", "WorkspaceInvitationService#managementPage"),
        Map.entry("S4", "WorkspaceInvitationService#managementView"),
        Map.entry("S5", "WorkspaceUserService#candidates"),
        Map.entry("S6", "WorkspaceInvitationService#managementPageForOperations"),
        Map.entry("O1", "WorkspaceUserService#page"),
        Map.entry("O2", "WorkspaceUserService#page"),
        Map.entry("O3", "OrganizationOverviewTaskReadService#page"),
        Map.entry("O4", "OrganizationOverviewTaskReadService#detail"),
        Map.entry("O5", "OrganizationAssignmentCandidateService#listEnabled"),
        Map.entry("O6", "WorkspaceAccountService#list"),
        Map.entry("R8", "OrganizationHierarchyService#requireNode")
    );

    private static Flyway flyway;
    private static JdbcTemplate setupJdbc;
    private static JdbcTemplate countedJdbc;
    private static CountingDataSource countedDataSource;
    private static UUID workspace;
    private static UUID regionId;
    private static UUID projectId;
    private static UUID headCompanyId;
    private static UUID commercialGroupId;
    private static List<UUID> accountIds;
    private static List<UUID> projectRoleIds;
    private static UUID firstProjectAssignmentId;
    private static List<UUID> storeIds;
    private static BusinessEntityService countedEntities;
    private static ExtensionDefinitionService countedDefinitions;
    private static OrganizationHierarchyService countedHierarchy;
    private static OrganizationOverviewTaskReadService overview;
    private static OrganizationVisibilityService visibility;
    private static ContractTaskReadService contracts;
    private static ContractCommandService contractCommands;
    private static WorkspaceRoleService roles;
    private static WorkspaceAccountService accounts;
    private static WorkspaceAdministrationService workspaceAdministration;
    private static OrganizationCommandService organizationCommands;
    private static OrganizationTaskPathService taskPaths;
    private static OrganizationAssignmentCandidateService assignmentCandidates;
    private static WorkspaceAssignmentScopeService assignmentScopes;
    private static WorkspaceUserService users;
    private static WorkspaceInvitationService invitations;
    private static WorkspaceAuthenticationService authentication;
    private static Map<String, LedgerRow> canonicalLedger;
    private static final List<String> exactBudgetDrifts = new ArrayList<>();
    private static String oneAssignmentSessionToken;
    private static String hundredAssignmentSessionToken;
    private static UUID regionRoleId;
    private static List<com.catering.v2s.workspace.iam.api.WorkspaceInvitationReadback> invitationFixtures;

    @BeforeAll
    static void setup() {
        flyway = Flyway.configure()
            .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .schemas("public").defaultSchema("public").locations("classpath:db/migration").cleanDisabled(false).load();
        flyway.migrate();
        canonicalLedger = readCanonicalLedger();

        DriverManagerDataSource raw = new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        setupJdbc = new JdbcTemplate(raw);
        countedDataSource = new CountingDataSource(raw);
        countedJdbc = new JdbcTemplate(countedDataSource);
        workspace = UUID.randomUUID();
        setupJdbc.update("INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, name_normalized, operations_title, status, revision, version, created_at_epoch_millis, updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, ?, 'P4 budget', 'p4 budget', 'P4 budget', 'ENABLED', 1, 1, ?, ?, ?)", workspace, KEY, NOW, NOW, NOW);
        long workspaceId = setupJdbc.queryForObject("SELECT id FROM platform_workspace.group_workspace WHERE workspace_uuid=?", Long.class, workspace);
        commercialGroupId = UUID.randomUUID();
        setupJdbc.update("INSERT INTO organization.commercial_group (group_workspace_key, group_workspace_id, commercial_group_code, commercial_group_name, created_by_platform_subject, commercial_group_uuid, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, 'p4-group', 'P4 group', 'system', ?, ?, ?)", KEY, workspaceId, commercialGroupId, NOW, NOW);

        TimeProvider time = () -> NOW;
        ExtensionDefinitionService setupDefinitions = new ExtensionDefinitionService(setupJdbc, time);
        OrganizationHierarchyService setupHierarchy = new OrganizationHierarchyService(setupJdbc, time);
        BusinessEntityService setupEntities = new BusinessEntityService(setupJdbc, time, setupDefinitions, setupHierarchy);
        var region = setupHierarchy.create(workspace, KEY, "REGION", null, "p4-region", "P4 region");
        regionId = region.id();
        var project = setupHierarchy.create(workspace, KEY, "PROJECT", region.id(), "p4-project", "P4 project");
        projectId = project.id();
        var brand = setupEntities.createEntity("BRAND", workspace, KEY, "p4-brand", "P4 brand", null, null, Map.of());
        var tenant = setupEntities.createEntity("TENANT", workspace, KEY, "p4-tenant", "P4 tenant", "P4 tenant", "91310000P4", Map.of());
        var head = setupEntities.createEntity("HEAD_COMPANY", workspace, KEY, "p4-head", "P4 head", "P4 head", "91310000P4HEAD", Map.of());
        headCompanyId = head.id();
        setupEntities.addHeadCompanyBrandAuthorization(workspace, KEY, headCompanyId, brand.id(), "p4-brand-authority", AuditActor.system());
        for (int index = 1; index < 100; index++) {
            var extraBrand = setupEntities.createEntity("BRAND", workspace, KEY, "p4-brand-%03d".formatted(index), "P4 brand %03d".formatted(index), null, null, Map.of());
            setupEntities.addHeadCompanyBrandAuthorization(workspace, KEY, headCompanyId, extraBrand.id(), "p4-brand-authority-%03d".formatted(index), AuditActor.system());
            setupHierarchy.create(workspace, KEY, "REGION", null, "p4-region-%03d".formatted(index), "P4 region %03d".formatted(index));
        }
        storeIds = java.util.stream.IntStream.range(0, 100)
            .mapToObj(index -> setupEntities.createStore(workspace, KEY, projectId, tenant.id(), brand.id(), headCompanyId, "p4-store-%03d".formatted(index), "P4 store %03d".formatted(index), Map.of()).id())
            .toList();
        for (String hostType : List.of("BRAND", "TENANT", "HEAD_COMPANY", "STORE")) {
            setupDefinitions.replace(workspace, KEY, hostType, 0, List.of(new ExtensionDefinitionService.Field("floorArea", "Floor area", "NUMBER", false, List.of(), "ENABLED", 0, null)));
        }
        WorkspaceRoleService setupRoles = new WorkspaceRoleService(setupJdbc, time);
        accountIds = new ArrayList<>();
        projectRoleIds = new ArrayList<>();
        for (int index = 0; index < 100; index++) {
            projectRoleIds.add(setupRoles.create(workspace, KEY, "P4 role %03d".formatted(index), "PROJECT", null, Set.of(), Set.of()).id());
            UUID accountId = UUID.randomUUID();
            accountIds.add(accountId);
            setupJdbc.update(
                "INSERT INTO workspace_iam.workspace_account (id, workspace_uuid, group_workspace_key, mobile_normalized, login_name_normalized, display_name, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, 'ENABLED', 1, ?, ?)",
                accountId, workspace, KEY, "139%08d".formatted(index), "p4-account-%03d".formatted(index), "P4 account %03d".formatted(index), NOW, NOW
            );
        }
        UUID assignmentInvitation = UUID.randomUUID();
        setupJdbc.update("INSERT INTO workspace_iam.invitation (id, workspace_uuid, group_workspace_key, token_hash, mobile_normalized, status, expires_at_epoch_millis, version, created_at_epoch_millis) VALUES (?, ?, ?, ?, 'p4-assignment-fixture', 'COMPLETED', ?, 1, ?)", assignmentInvitation, workspace, KEY, "a".repeat(64), NOW + 86_400_000L, NOW);
        setupJdbc.update("INSERT INTO workspace_iam.invitation_assignment_intent (invitation_id, role_id, service_node_type, service_node_id) VALUES (?, ?, 'PROJECT', ?)", assignmentInvitation, projectRoleIds.getFirst(), projectId);
        for (UUID accountId : accountIds) {
            for (int index = 0; index < 3; index++) {
                UUID assignmentId = UUID.randomUUID();
                setupJdbc.update("INSERT INTO workspace_iam.role_assignment (id, workspace_uuid, group_workspace_key, account_id, role_id, source_invitation_id, service_node_type, service_node_id, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, 'PROJECT', ?, 'ACTIVE', 1, ?, ?)", assignmentId, workspace, KEY, accountId, projectRoleIds.get(index), assignmentInvitation, projectId, NOW, NOW);
                if (firstProjectAssignmentId == null) firstProjectAssignmentId = assignmentId;
            }
        }
        ContractCommandService setupContracts = new ContractCommandService(setupJdbc, time, new BusinessDateProvider(time), setupEntities, setupDefinitions);
        for (int index = 0; index < 100; index++) {
            setupContracts.create(workspace, KEY, "p4-contract-%03d".formatted(index), storeIds.get(index), projectId,
                LocalDate.of(2026, 1, 1), null, null,
                List.of(new ContractCommandService.ItemInput("p4-item-%03d".formatted(index), "P4 item %03d".formatted(index))), Map.of());
        }
        setupDefinitions.replace(workspace, KEY, "CONTRACT", 0, List.of(new ExtensionDefinitionService.Field("floorArea", "Floor area", "NUMBER", false, List.of(), "ENABLED", 0, null)));

        // Every nested owner collaborator below shares the same counted real JDBC datasource.
        countedDefinitions = new ExtensionDefinitionService(countedJdbc, time);
        countedHierarchy = new OrganizationHierarchyService(countedJdbc, time);
        countedEntities = new BusinessEntityService(countedJdbc, time, countedDefinitions, countedHierarchy);
        overview = new OrganizationOverviewTaskReadService(countedJdbc, null, countedEntities);
        visibility = new OrganizationVisibilityService(countedJdbc);
        contracts = new ContractTaskReadService(countedJdbc, new BusinessDateProvider(time));
        contractCommands = new ContractCommandService(countedJdbc, time, new BusinessDateProvider(time), countedEntities, countedDefinitions);
        roles = new WorkspaceRoleService(countedJdbc, time);
        accounts = new WorkspaceAccountService(countedJdbc, time);
        workspaceAdministration = new WorkspaceAdministrationService(countedJdbc, time, null, null, null);
        organizationCommands = new OrganizationCommandService(countedJdbc, workspaceAdministration, time);
        taskPaths = new OrganizationTaskPathService(countedJdbc, organizationCommands);
        assignmentCandidates = new OrganizationAssignmentCandidateService(countedJdbc, organizationCommands, taskPaths);
        assignmentScopes = new WorkspaceAssignmentScopeService(countedJdbc);
        users = new WorkspaceUserService(countedJdbc, countedHierarchy, countedEntities, roles, organizationCommands, assignmentCandidates, assignmentScopes, taskPaths);
        WorkspaceCommandAuthorizationService commands = new WorkspaceCommandAuthorizationService(countedJdbc, assignmentScopes, taskPaths);
        invitations = new WorkspaceInvitationService(countedJdbc, time, roles, countedHierarchy, countedEntities, countedEntities, organizationCommands,
            new WorkspaceOtpRateLimitService(countedJdbc, time), new WorkspaceIamCommandReceiptService(countedJdbc, time), commands, users, taskPaths, assignmentCandidates);
        authentication = new WorkspaceAuthenticationService(countedJdbc, time, roles, countedHierarchy, countedEntities, countedEntities,
            organizationCommands, new WorkspaceLoginRateLimitService(countedJdbc, time, "p4-fixture-hmac"),
            new WorkspaceOtpRateLimitService(countedJdbc, time), workspaceAdministration, visibility,
            new WorkspaceSessionRequestCache(), taskPaths);
        regionRoleId = roles.create(workspace, KEY, "P4 region invitation role", "REGION", null, Set.of(), Set.of()).id();
        oneAssignmentSessionToken = authenticationFixture("one", 1, true);
        hundredAssignmentSessionToken = authenticationFixture("hundred", 100, true);
        invitationFixtures = java.util.stream.IntStream.range(0, 100).mapToObj(index -> invitations.create(
            workspace, KEY, "136%08d".formatted(index),
            List.of(new WorkspaceInvitationService.AssignmentIntent(regionRoleId, "REGION", regionId)), NOW + 86_400_000L
        )).toList();
    }

    @Test
    void executableCanonicalRowsUseRealProductionCalls() {
        exactBudgetDrifts.clear();
        assertEquals(REQUIRED_LEDGER_IDS, NAMED_LEDGER_OPERATIONS.keySet(), "named mapping must be an exact ledger set");
        Map<String, Integer> executed = new LinkedHashMap<>();

        assertFixed(executed, "M2",
            () -> contracts.fixedStoreContracts(workspace, KEY, storeIds.getFirst()),
            () -> contracts.fixedStoreContracts(workspace, KEY, storeIds.getLast()));
        assertFixed(executed, "M3",
            () -> contracts.list(workspace, KEY, new ContractTaskReadService.ContractListQuery(projectId, null, null, null, null, null, null, null, null, "UPDATED_AT", "DESC", 1, 1)),
            () -> contracts.list(workspace, KEY, new ContractTaskReadService.ContractListQuery(projectId, null, null, null, null, null, null, null, null, "UPDATED_AT", "DESC", 1, 100)));
        assertFixed(executed, "M4",
            () -> contracts.list(workspace, KEY, new ContractTaskReadService.ContractListQuery(null, null, null, "p4-contract", "p4-phase", "p4-item", null, null, null, "UPDATED_AT", "DESC", 1, 1)),
            () -> contracts.list(workspace, KEY, new ContractTaskReadService.ContractListQuery(null, null, null, "p4-contract", "p4-phase", "p4-item", null, null, null, "UPDATED_AT", "DESC", 1, 100)));
        assertFixed(executed, "M5",
            () -> assertEquals(100, contractCommands.list(workspace, KEY).size()),
            () -> assertEquals(100, contractCommands.list(workspace, KEY).size()));
        assertFixed(executed, "M6",
            () -> assertEquals(101, roles.list(workspace, KEY).size()),
            () -> assertEquals(101, roles.list(workspace, KEY).size()));
        assertFixed(executed, "M7",
            () -> assertEquals(100, countedEntities.listEntities("STORE", workspace, KEY).size()),
            () -> assertEquals(100, countedEntities.listEntities("STORE", workspace, KEY).size()));
        assertFixed(executed, "M8",
            () -> assertEquals(100, countedEntities.authorizedBrands(workspace, KEY, headCompanyId).size()),
            () -> assertEquals(100, countedEntities.authorizedBrands(workspace, KEY, headCompanyId).size()));
        assertFixed(executed, "M9",
            () -> assertEquals(100, countedEntities.authorizedBrandAuthorizations(workspace, KEY, headCompanyId).size()),
            () -> assertEquals(100, countedEntities.authorizedBrandAuthorizations(workspace, KEY, headCompanyId).size()));
        assertFixed(executed, "M10",
            () -> assertEquals(5, countedDefinitions.listDefinitions(workspace, KEY).size()),
            () -> assertEquals(5, countedDefinitions.listDefinitions(workspace, KEY).size()));
        assertFixed(executed, "M12",
            () -> assertEquals("P4 group（p4-group）", organizationCommands.describeCommercialGroup(workspace, KEY, commercialGroupId)),
            () -> assertEquals("P4 group（p4-group）", organizationCommands.describeCommercialGroup(workspace, KEY, commercialGroupId)));
        assertFixed(executed, "M11",
            () -> assertTrue(visibility.listVisibleDataNodeCandidates(workspace, KEY, "REGION", regionId).size() >= 100),
            () -> assertTrue(visibility.listVisibleDataNodeCandidates(workspace, KEY, "REGION", regionId).size() >= 100));
        assertFixed(executed, "O3",
            () -> assertEquals(1, overview.page(workspace, KEY, "STORE", 1, 1).items().size()),
            () -> assertEquals(100, overview.page(workspace, KEY, "STORE", 1, 100).items().size()));
        assertFixed(executed, "O4",
            () -> overview.detail(workspace, KEY, "STORE", storeIds.getFirst()),
            () -> overview.detail(workspace, KEY, "STORE", storeIds.getFirst()));
        assertFixed(executed, "O6",
            () -> assertEquals(102, accounts.list(workspace, KEY).size()),
            () -> assertEquals(102, accounts.list(workspace, KEY).size()));
        assertFixed(executed, "O5",
            () -> assertEquals(100, assignmentCandidates.listEnabled(workspace, KEY, "STORE").size()),
            () -> assertEquals(100, assignmentCandidates.listEnabled(workspace, KEY, "STORE").size()));
        int s1One = measure("S1-DIRECT-A1", () -> assertTrue(authentication.login(KEY, "p4-auth-one", "p4-password".toCharArray()).session().currentAssignmentId() != null));
        int s1Hundred = measure("S1-SELECT-A100", () -> assertTrue(authentication.login(KEY, "p4-auth-hundred", "p4-password".toCharArray()).session().currentAssignmentId() == null));
        assertExactLedgerBudget(executed, "S1", "DIRECT_A1", s1One);
        assertExactLedgerBudget(executed, "S1", "SELECT_A100", s1Hundred);
        int s2One = measure("S2-A1", () -> assertEquals(com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback.Mode.DIRECT, authentication.sessionEntry(oneAssignmentSessionToken).mode()));
        int s2Hundred = measure("S2-A100", () -> assertEquals(com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback.Mode.SELECT, authentication.sessionEntry(hundredAssignmentSessionToken).mode()));
        assertExactLedgerBudget(executed, "S2", "DIRECT_A1", s2One);
        assertExactLedgerBudget(executed, "S2", "SELECT_A100", s2Hundred);
        assertFixed(executed, "S3",
            () -> assertInvitationPage(invitations.managementPage(workspace, KEY, invitationPageRequest(1)), 1, 103),
            () -> assertInvitationPage(invitations.managementPage(workspace, KEY, invitationPageRequest(100)), 100, 103));
        assertFixed(executed, "S4",
            () -> invitations.managementView(invitationFixtures.getFirst()),
            () -> invitations.managementView(invitationFixtures.getLast()));
        assertFixed(executed, "S5",
            P4SqlOperationBudgetTest::candidateFamiliesAndRoleList,
            P4SqlOperationBudgetTest::candidateFamiliesAndRoleList);
        WorkspaceSessionReadback regionSession = authentication.session(oneAssignmentSessionToken);
        assertFixed(executed, "S6",
            () -> assertInvitationPage(invitations.managementPageForOperations(regionSession, "REGION", regionId, invitationPageRequest(1)), 1, 102),
            () -> assertInvitationPage(invitations.managementPageForOperations(regionSession, "REGION", regionId, invitationPageRequest(100)), 100, 102));
        assertExactLedgerBudget(executed, "M13", "SINGLE_CALL", m13SqlMeasurement());
        var selectedProject = new com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback.VisibleDataNodeCandidate("PROJECT", projectId, "P4 project", "P4-PROJECT", List.of("P4 project"), regionId, projectId, null, null);
        WorkspaceSessionReadback projectSession = new WorkspaceSessionReadback(UUID.randomUUID(), workspace, KEY, accountIds.getFirst(), firstProjectAssignmentId, new com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback.ScopeContext(null, selectedProject, null, null), 7L, 1L, Set.of(), Set.of(), "P4 project operator");
        assertFixed(executed, "O1",
            () -> assertEquals(1, users.page(WorkspaceUserService.AccountPageQuery.forOperations(projectSession, "PROJECT", projectId, null, null, null, null, null, null, 1, 1)).items().size()),
            () -> assertEquals(100, users.page(WorkspaceUserService.AccountPageQuery.forOperations(projectSession, "PROJECT", projectId, null, null, null, null, null, null, 1, 100)).items().size()));
        assertFixed(executed, "O2",
            () -> assertEquals(1, users.page(WorkspaceUserService.AccountPageQuery.forPlatform(workspace, KEY, null, null, null, null, null, "PROJECT", projectId, null, null, 1, 1)).items().size()),
            () -> assertEquals(100, users.page(WorkspaceUserService.AccountPageQuery.forPlatform(workspace, KEY, null, null, null, null, null, "PROJECT", projectId, null, null, 1, 100)).items().size()));
        assertFixed(executed, "R8",
            () -> countedHierarchy.requireNode(workspace, KEY, projectId, "PROJECT"),
            () -> countedHierarchy.requireNode(workspace, KEY, projectId, "PROJECT"));

        assertEquals(requiredLedgerCases(), executed.keySet(), "every canonical ledger case must execute a real production call");
        System.out.println("P4_SQL_OBSERVED=" + executed);
        if (!exactBudgetDrifts.isEmpty()) throw new AssertionError("exact SQL budget drifts: " + exactBudgetDrifts);
    }

    private static String authenticationFixture(String label, int assignmentCount, boolean selectedSession) {
        UUID account = UUID.randomUUID();
        String login = "p4-auth-" + label;
        setupJdbc.update("INSERT INTO workspace_iam.workspace_account (id, workspace_uuid, group_workspace_key, mobile_normalized, login_name_normalized, display_name, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, 'ENABLED', 1, ?, ?)",
            account, workspace, KEY, "137%08d".formatted(assignmentCount), login, "P4 auth " + label, NOW, NOW);
        setupJdbc.update("INSERT INTO workspace_iam.workspace_credential (account_id, password_hash, algorithm, changed_at_epoch_millis, version) VALUES (?, ?, 'bcrypt', ?, 1)",
            account, "$2y$04$woctri5b5u2LqIzgFG7hPeLRW9cOxJ4E64SrXe01iU7skUhEfgYQu", NOW);
        UUID invitation = UUID.randomUUID();
        setupJdbc.update("INSERT INTO workspace_iam.invitation (id, workspace_uuid, group_workspace_key, token_hash, mobile_normalized, status, expires_at_epoch_millis, version, created_at_epoch_millis) VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?, 1, ?)",
            invitation, workspace, KEY, UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", ""), "p4-auth-invitation-" + label, NOW + 86_400_000L, NOW);
        setupJdbc.update("INSERT INTO workspace_iam.invitation_assignment_intent (invitation_id, role_id, service_node_type, service_node_id) VALUES (?, ?, 'REGION', ?)", invitation, regionRoleId, regionId);
        UUID selected = null;
        for (int index = 0; index < assignmentCount; index++) {
            UUID assignment = UUID.randomUUID();
            setupJdbc.update("INSERT INTO workspace_iam.role_assignment (id, workspace_uuid, group_workspace_key, account_id, role_id, source_invitation_id, service_node_type, service_node_id, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, 'REGION', ?, 'ACTIVE', 1, ?, ?)",
                assignment, workspace, KEY, account, regionRoleId, invitation, regionId, NOW, NOW);
            if (selected == null) selected = assignment;
        }
        String token = "p4-session-" + label;
        if (selectedSession) {
            setupJdbc.update("INSERT INTO workspace_iam.workspace_session (id, workspace_uuid, group_workspace_key, account_id, token_hash, current_assignment_id, visible_data_node_id, selected_region_id, context_version, authorization_revision, status, expires_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 'ACTIVE', ?)",
                UUID.randomUUID(), workspace, KEY, account, sha256(token), selected, regionId, regionId, NOW + 86_400_000L);
        }
        return token;
    }

    private static WorkspaceInvitationService.ManagementInvitationPageRequest invitationPageRequest(int pageSize) {
        return new WorkspaceInvitationService.ManagementInvitationPageRequest(null, null, null, null, null, null, null, "CREATED_AT", "DESC", 1, pageSize);
    }

    private static void assertInvitationPage(WorkspaceInvitationService.ManagementInvitationPage page, int itemCount, long total) {
        assertEquals(itemCount, page.items().size());
        assertEquals(total, page.total());
    }

    private static void candidateFamiliesAndRoleList() {
        assertCandidateOrganization("GROUP", 1);
        assertCandidateOrganization("REGION", 100);
        assertCandidateOrganization("PROJECT", 1);
        assertCandidateOrganization("HEAD_COMPANY", 1);
        assertCandidateOrganization("STORE", 100);

        WorkspaceUserService.CandidatePage rolePage = users.candidates(
            WorkspaceUserService.CandidateQuery.forPlatform(
                workspace, KEY, "PROJECT", "ROLE", "LIST_FILTER", null, 1, 100, null
            )
        );
        assertEquals("ROLE", rolePage.metadata().subjectType());
        assertEquals(100, rolePage.metadata().total());
        assertEquals(100, rolePage.roles().size());
    }

    private static void assertCandidateOrganization(String targetType, int expectedCount) {
        WorkspaceUserService.CandidatePage page = users.candidates(
            WorkspaceUserService.CandidateQuery.forPlatform(
                workspace, KEY, targetType, "ORGANIZATION", "LIST_FILTER", null, 1, 100, null
            )
        );
        assertEquals("ORGANIZATION", page.metadata().subjectType());
        assertEquals(expectedCount, page.metadata().total());
        assertEquals(Math.min(expectedCount, 100), page.organizations().size());
    }

    private static String sha256(String value) {
        try { return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
    }

    @Test
    void counterSeesAllJdbcStatementExecutionAndTheExistingRepeatedReadMutationIsRed() {
        int one = measure("COUNTER-ONE", () -> assertEquals(1, countedEntities.requireEntities("STORE", workspace, KEY, storeIds.subList(0, 1)).size()));
        int hundred = measure("COUNTER-HUNDRED", () -> assertEquals(100, countedEntities.requireEntities("STORE", workspace, KEY, storeIds).size()));
        assertEquals(one, hundred);
        AssertionError red = assertThrows(AssertionError.class, () -> assertAtMost(1, measure("COUNTER-RED", () -> storeIds.forEach(storeId -> contracts.derivedStoreStatus(workspace, KEY, storeId)))));
        assertTrue(red.getMessage().contains("SQL budget exceeded"));
    }

    @Test
    void m13ClosesTheJdbcResultSetBeforeTheAssetObjectProbe() {
        assertExactLedgerBudget(new LinkedHashMap<>(), "M13", "SINGLE_CALL", m13SqlMeasurement());
    }

    private static int m13SqlMeasurement() {
        UUID assetRef = UUID.randomUUID();
        String objectKey = "p4/m13/" + assetRef;
        setupJdbc.update(
            "INSERT INTO platform_asset.staged_asset (asset_ref, usage, workspace_uuid, group_workspace_key, storage_key, bucket_name, object_key, content_type, size_bytes, sha256, status, created_at_epoch_millis, activated_at_epoch_millis, version) VALUES (?, 'GROUP_WORKSPACE_LOGO', ?, ?, ?, 'p4-assets', ?, 'image/png', 1, ?, 'ACTIVE', ?, ?, 1)",
            assetRef, workspace, KEY, objectKey, objectKey, "a".repeat(64), NOW, NOW
        );
        CursorOrderObjects objects = new CursorOrderObjects(countedDataSource, objectKey);
        PlatformAssetService assets = new PlatformAssetService(countedJdbc, () -> NOW, objects);

        int sql = measure("M13", () -> assertEquals("image/png", assets.requireActivePublicReference(assetRef).contentType()));
        assertTrue(objects.checkedAfterResultSetClose(), "object I/O must occur after the JDBC extractor has released its ResultSet");
        return sql;
    }

    @Test
    void p4IndexesAreBoundToTheirQueryPlans() {
        assertUsesIndex("ix_workspace_role_assignment_account", "SELECT id FROM workspace_iam.role_assignment WHERE account_id='" + accountIds.getFirst() + "'::uuid");
        assertUsesIndex("ix_workspace_role_assignment_service_node", "SELECT id FROM workspace_iam.role_assignment WHERE service_node_type='PROJECT' AND service_node_id='" + projectId + "'::uuid");
        assertUsesIndex("ix_contract_store_contract_store", "SELECT id FROM contract.store_contract WHERE store_id='" + storeIds.getFirst() + "'::uuid");
        assertUsesIndex("ix_organization_store_project", "SELECT id FROM organization.store WHERE project_id='" + projectId + "'::uuid");
        assertUsesIndex("ix_organization_store_head_company", "SELECT id FROM organization.store WHERE head_company_id='" + headCompanyId + "'::uuid");
        assertUsesIndex("ix_operations_password_recovery_account_active", "SELECT id FROM workspace_iam.operations_password_recovery WHERE account_id='00000000-0000-0000-0000-000000000006'::uuid AND status IN ('PENDING', 'OTP_VERIFIED')");
        assertUsesIndex("ix_platform_session_platform_admin", "SELECT id FROM platform_iam.platform_session WHERE platform_admin_id='00000000-0000-0000-0000-000000000007'::uuid");
    }

    private static void assertFixed(Map<String, Integer> executed, String id, SqlOperation one, SqlOperation hundred) {
        int oneCount = measure(id, one);
        int hundredCount = measure(id, hundred);
        assertExactLedgerBudget(executed, id, "FIRST_CALL", oneCount);
        assertExactLedgerBudget(executed, id, "SECOND_CALL", hundredCount);
    }

    private static void assertExactLedgerBudget(Map<String, Integer> executed, String id, String caseId, int actual) {
        LedgerRow row = canonicalLedger.get(id);
        if (row == null) throw new AssertionError("canonical ledger row missing: " + id);
        assertEquals(NAMED_LEDGER_OPERATIONS.get(id), row.callerSymbol(), "ledger caller identity drift: " + id);
        Integer ledgerExpected = row.exactStatements().get(caseId);
        if (ledgerExpected == null) throw new AssertionError("canonical ledger case missing: " + id + "#" + caseId);
        executed.put(id + "#" + caseId, actual);
        if (ledgerExpected.intValue() != actual) exactBudgetDrifts.add(id + "#" + caseId + " expected=" + ledgerExpected + " actual=" + actual);
    }

    private static Set<String> requiredLedgerCases() {
        return canonicalLedger.entrySet().stream().flatMap(entry -> entry.getValue().exactStatements().keySet().stream().map(caseId -> entry.getKey() + "#" + caseId)).collect(Collectors.toSet());
    }

    private static Map<String, LedgerRow> readCanonicalLedger() {
        Path root = Path.of("").toAbsolutePath();
        while (root != null && !Files.isRegularFile(root.resolve(LEDGER_RELATIVE_PATH))) root = root.getParent();
        if (root == null) throw new AssertionError("canonical ledger file not found from test working directory");
        try {
            Map<String, LedgerRow> rows = new LinkedHashMap<>();
            for (JsonNode row : new ObjectMapper().readTree(Files.readString(root.resolve(LEDGER_RELATIVE_PATH))).path("rows")) {
                if (!"EXACT_SQL_STATEMENTS".equals(row.path("budget").path("mode").asText())) throw new AssertionError("ledger budget mode invalid: " + row.path("id").asText());
                Map<String, Integer> cases = new LinkedHashMap<>();
                for (JsonNode value : row.path("budget").path("cases")) {
                    String caseId = value.path("id").asText(); int expected = value.path("expectedStatements").asInt(-1);
                    if (caseId.isBlank() || expected < 1 || cases.put(caseId, expected) != null) throw new AssertionError("ledger exact case invalid: " + row.path("id").asText());
                }
                String id = row.path("id").asText();
                if (id.isBlank() || cases.isEmpty() || rows.put(id, new LedgerRow(row.path("identity").path("callerSymbol").asText(), Map.copyOf(cases))) != null) throw new AssertionError("ledger row invalid: " + id);
            }
            return Map.copyOf(rows);
        } catch (IOException failure) { throw new AssertionError("canonical ledger unreadable", failure); }
    }

    private record LedgerRow(String callerSymbol, Map<String, Integer> exactStatements) { }

    private static int measure(String id, SqlOperation operation) {
        countedDataSource.reset();
        operation.run();
        int count = countedDataSource.statementCount();
        if (count == 0) throw new AssertionError(id + " did not execute real JDBC SQL");
        if (id.startsWith("S1")) System.out.println("P4_SQL_TRACE=" + id + ";STATEMENTS=" + countedDataSource.executedSql());
        return count;
    }

    private static void assertAtMost(int budget, int actual) {
        if (actual > budget) throw new AssertionError("SQL budget exceeded: actual=%d budget=%d".formatted(actual, budget));
    }

    private static void assertUsesIndex(String index, String query) {
        try (Connection connection = setupJdbc.getDataSource().getConnection(); Statement statement = connection.createStatement()) {
            statement.execute("SET enable_seqscan TO off");
            try (ResultSet result = statement.executeQuery("EXPLAIN (COSTS OFF) " + query)) {
                List<String> lines = new ArrayList<>(); while (result.next()) lines.add(result.getString(1));
                String plan = String.join("\n", lines);
                assertTrue(plan.contains(index), () -> "expected " + index + " in:\n" + plan);
            }
        } catch (SQLException failure) { throw new AssertionError(failure); }
    }

    @FunctionalInterface
    private interface SqlOperation { void run(); }

    /** Counts JDBC execute* calls for every JdbcTemplate/service sharing this real datasource. */
    private static final class CountingDataSource implements DataSource {
        private final DataSource delegate;
        private final AtomicInteger statements = new AtomicInteger();
        private final AtomicInteger openResultSets = new AtomicInteger();
        private final List<String> executedSql = Collections.synchronizedList(new ArrayList<>());

        private CountingDataSource(DataSource delegate) { this.delegate = delegate; }
        private void reset() { statements.set(0); executedSql.clear(); }
        private int statementCount() { return statements.get(); }
        private int openResultSetCount() { return openResultSets.get(); }
        private List<String> executedSql() { synchronized (executedSql) { return List.copyOf(executedSql); } }

        @Override public Connection getConnection() throws SQLException { return connection(delegate.getConnection()); }
        @Override public Connection getConnection(String username, String password) throws SQLException { return connection(delegate.getConnection(username, password)); }
        @Override public PrintWriter getLogWriter() throws SQLException { return delegate.getLogWriter(); }
        @Override public void setLogWriter(PrintWriter out) throws SQLException { delegate.setLogWriter(out); }
        @Override public void setLoginTimeout(int seconds) throws SQLException { delegate.setLoginTimeout(seconds); }
        @Override public int getLoginTimeout() throws SQLException { return delegate.getLoginTimeout(); }
        @Override public Logger getParentLogger() throws SQLFeatureNotSupportedException { return delegate.getParentLogger(); }
        @Override public <T> T unwrap(Class<T> iface) throws SQLException { return delegate.unwrap(iface); }
        @Override public boolean isWrapperFor(Class<?> iface) throws SQLException { return delegate.isWrapperFor(iface); }

        private Connection connection(Connection connection) {
            return (Connection) Proxy.newProxyInstance(Connection.class.getClassLoader(), new Class<?>[] { Connection.class }, (proxy, method, arguments) -> {
                Object result = invoke(connection, method, arguments);
                String preparedSql = arguments != null && arguments.length > 0 && arguments[0] instanceof String sql ? sql : null;
                return result instanceof Statement statement && Statement.class.isAssignableFrom(method.getReturnType()) ? statement(statement, preparedSql) : result;
            });
        }

        private Statement statement(Statement statement, String preparedSql) {
            return (Statement) Proxy.newProxyInstance(Statement.class.getClassLoader(), statementInterfaces(statement), (proxy, method, arguments) -> {
                if (method.getName().startsWith("execute")) {
                    statements.incrementAndGet();
                    String sql = arguments != null && arguments.length > 0 && arguments[0] instanceof String explicitSql ? explicitSql : preparedSql;
                    executedSql.add(sql == null ? method.getName() : method.getName() + " " + sql.replaceAll("\\s+", " ").trim());
                }
                Object result = invoke(statement, method, arguments);
                return result instanceof ResultSet resultSet ? resultSet(resultSet) : result;
            });
        }

        private ResultSet resultSet(ResultSet resultSet) {
            AtomicInteger closes = new AtomicInteger();
            openResultSets.incrementAndGet();
            return (ResultSet) Proxy.newProxyInstance(ResultSet.class.getClassLoader(), new Class<?>[] { ResultSet.class }, (proxy, method, arguments) -> {
                if ("close".equals(method.getName()) && closes.getAndIncrement() == 0) openResultSets.decrementAndGet();
                return invoke(resultSet, method, arguments);
            });
        }

        private static Class<?>[] statementInterfaces(Statement statement) {
            if (statement instanceof java.sql.CallableStatement) return new Class<?>[] { java.sql.CallableStatement.class };
            if (statement instanceof java.sql.PreparedStatement) return new Class<?>[] { java.sql.PreparedStatement.class };
            return new Class<?>[] { Statement.class };
        }

        private static Object invoke(Object target, java.lang.reflect.Method method, Object[] arguments) throws Throwable {
            try { return method.invoke(target, arguments); }
            catch (InvocationTargetException exception) { throw exception.getCause(); }
        }
    }

    /** Test-only object port that rejects any attempt to inspect an object while JDBC still owns a cursor. */
    private static final class CursorOrderObjects implements AssetObjectStorage {
        private final CountingDataSource dataSource;
        private final String existingKey;
        private boolean checkedAfterResultSetClose;

        private CursorOrderObjects(CountingDataSource dataSource, String existingKey) {
            this.dataSource = dataSource;
            this.existingKey = existingKey;
        }

        @Override public String bucketName() { return "p4-assets"; }
        @Override public String objectKey(String suffix) { return suffix; }
        @Override public boolean ownsObjectKey(String objectKey) { return true; }
        @Override public void put(String objectKey, String contentType, long sizeBytes, java.io.InputStream bytes) { throw new UnsupportedOperationException(); }
        @Override public boolean exists(String objectKey) {
            checkedAfterResultSetClose = dataSource.openResultSetCount() == 0;
            if (!checkedAfterResultSetClose) throw new AssertionError("object I/O occurred with a live JDBC ResultSet");
            return existingKey.equals(objectKey);
        }
        @Override public String publicUrl(String objectKey) { return "https://assets.invalid/" + objectKey; }
        @Override public void delete(String objectKey) { throw new UnsupportedOperationException(); }
        private boolean checkedAfterResultSetClose() { return checkedAfterResultSetClose; }
    }

    @AfterAll
    static void cleanup() {
        if (flyway != null) flyway.clean();
    }
}
