package com.catering.v2s.contract.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.extension.application.ExtensionCommandReceiptService;
import com.catering.v2s.extension.application.persistence.ExtensionDefinitionPersistence;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OrganizationHierarchyService;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.foundation.workspace.WorkspaceStatusLookup;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class ContractCommandServiceTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static Flyway flyway;
    private static ContractCommandService contracts;
    private static ContractTaskReadService reads;
    private static UUID workspaceId;
    private static UUID storeId;
    private static UUID tenantId;
    private static UUID secondWorkspaceId;
    private static UUID secondStoreId;
    private static UUID secondProjectId;
    private static long now = 1_785_000_000_000L;

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
        JdbcTemplate jdbc = new JdbcTemplate(
                new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
        TimeProvider time = () -> now;
        workspaceId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, "
                        + "name_normalized, operations_title, status, revision, version, created_at_epoch_millis, "
                        + "updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, 'contract-test', "
                        + "'Contract "
                        + "test', 'contract test', 'Contract test', 'ENABLED', 1, 1, ?, ?, ?)",
                workspaceId,
                now,
                now,
                now);
        WorkspaceStatusLookup workspaceStatuses = (id, key) -> jdbc.queryForObject(
                "SELECT status FROM platform_workspace.group_workspace "
                        + "WHERE workspace_uuid=? AND group_workspace_key=?",
                String.class,
                id,
                key);
        ExtensionDefinitionService definitions = new ExtensionDefinitionService(
                new ExtensionDefinitionPersistence(jdbc, time),
                new ExtensionCommandReceiptService(jdbc, time),
                workspaceStatuses);
        OrganizationHierarchyService hierarchy = new OrganizationHierarchyService(jdbc, time);
        BusinessEntityService entities = new BusinessEntityService(jdbc, time, definitions, hierarchy);
        var region = hierarchy.create(workspaceId, "contract-test", "REGION", null, "region", "Region");
        var project = hierarchy.create(workspaceId, "contract-test", "PROJECT", region.id(), "project", "Project");
        hierarchy.replaceProjectPhaseNames(
                workspaceId, "contract-test", project.id(), project.version(), List.of("筹备", "营运"));
        var brand =
                entities.createEntity("BRAND", workspaceId, "contract-test", "brand", "Brand", null, null, Map.of());
        var tenant = entities.createEntity(
                "TENANT",
                workspaceId,
                "contract-test",
                "tenant-code",
                "Tenant",
                "Tenant legal",
                "91310000TEST",
                Map.of());
        tenantId = tenant.id();
        storeId = entities.createStore(
                        workspaceId,
                        "contract-test",
                        project.id(),
                        tenant.id(),
                        brand.id(),
                        null,
                        "store-code",
                        "Store",
                        Map.of())
                .id();
        secondWorkspaceId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, "
                        + "name_normalized, operations_title, status, revision, version, created_at_epoch_millis, "
                        + "updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, 'contract-test-b', "
                        + "'Contract test B', 'contract test b', 'Contract test B', 'ENABLED', 1, 1, ?, ?, ?)",
                secondWorkspaceId,
                now,
                now,
                now);
        var secondRegion =
                hierarchy.create(secondWorkspaceId, "contract-test-b", "REGION", null, "region-b", "Region B");
        var secondProject = hierarchy.create(
                secondWorkspaceId, "contract-test-b", "PROJECT", secondRegion.id(), "project-b", "Project B");
        hierarchy.replaceProjectPhaseNames(
                secondWorkspaceId,
                "contract-test-b",
                secondProject.id(),
                secondProject.version(),
                List.of(
                        "筹备",
                        /* format-wrap */
                        "营运"));
        var secondBrand = entities.createEntity(
                "BRAND", secondWorkspaceId, "contract-test-b", "brand-b", "Brand B", null, null, Map.of());
        var secondTenant = entities.createEntity(
                "TENANT",
                secondWorkspaceId,
                "contract-test-b",
                "tenant-code-b",
                "Tenant B",
                "Tenant legal B",
                "91310000TESTB",
                Map.of());
        secondProjectId = secondProject.id();
        secondStoreId = entities.createStore(
                        secondWorkspaceId,
                        "contract-test-b",
                        secondProject.id(),
                        secondTenant.id(),
                        secondBrand.id(),
                        null,
                        "store-code-b",
                        "Store B",
                        Map.of())
                .id();
        contracts = new ContractCommandService(jdbc, time, new BusinessDateProvider(time), entities, definitions);
        reads = new ContractTaskReadService(jdbc);
    }

    @AfterEach
    void isolateSharedFixtureRows() {
        jdbc().update("UPDATE organization.store SET status='ENABLED' WHERE id=?", storeId);
        jdbc().update("UPDATE organization.tenant SET status='ENABLED' WHERE id=?", tenantId);
        jdbc().update("DELETE FROM contract.store_contract WHERE workspace_uuid=?", workspaceId);
        jdbc().update("DELETE FROM contract.store_contract WHERE workspace_uuid=?", secondWorkspaceId);
        jdbc().update("DELETE FROM organization.store WHERE workspace_uuid=? AND id<>?", workspaceId, storeId);
        jdbc().update(
                        "DELETE FROM organization.store WHERE workspace_uuid=? AND id<>?",
                        secondWorkspaceId,
                        secondStoreId);
    }

    @Test
    void createRejectsDisabledStoreOrTenantBeforeContractWrite() {
        UUID projectId =
                jdbc().queryForObject("SELECT project_id FROM organization.store WHERE id=?", UUID.class, storeId);
        jdbc().update("UPDATE organization.store SET status='DISABLED' WHERE id=?", storeId);
        assertThrows(
                ContractCommandService.ContractValidationException.class,
                () -> contracts.create(
                        workspaceId,
                        "contract-test",
                        "CT-disabled-store",
                        storeId,
                        projectId,
                        LocalDate.of(2026, 8, 1),
                        null,
                        "筹备",
                        List.of(new ContractCommandService.ItemInput("tea-disabled-store", "茶")),
                        Map.of()));
        assertEquals(
                0,
                jdbc().queryForObject(
                                "SELECT COUNT(*) FROM contract.store_contract WHERE contract_no='CT-disabled-store'",
                                Integer.class));

        jdbc().update("UPDATE organization.store SET status='ENABLED' WHERE id=?", storeId);
        jdbc().update("UPDATE organization.tenant SET status='DISABLED' WHERE id=?", tenantId);
        assertThrows(
                ContractCommandService.ContractValidationException.class,
                () -> contracts.create(
                        workspaceId,
                        "contract-test",
                        "CT-disabled-tenant",
                        storeId,
                        projectId,
                        LocalDate.of(2026, 8, 1),
                        null,
                        "筹备",
                        List.of(new ContractCommandService.ItemInput("tea-disabled-tenant", "茶")),
                        Map.of()));
        assertEquals(
                0,
                jdbc().queryForObject(
                                "SELECT COUNT(*) FROM contract.store_contract WHERE contract_no='CT-disabled-tenant'",
                                Integer.class));
    }

    @Test
    void createsUpdatesInvalidatesAndDerivesStoreStatusFromBusinessDate() {
        UUID projectId =
                jdbc().queryForObject("SELECT project_id FROM organization.store WHERE id=?", UUID.class, storeId);
        var created = contracts.create(
                workspaceId,
                "contract-test",
                "CT-001",
                storeId,
                projectId,
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2026, 12, 31),
                "营运",
                List.of(new ContractCommandService.ItemInput("tea", "茶")),
                Map.of());
        assertEquals("OPERATING", contracts.derivedStoreStatus(workspaceId, "contract-test", storeId));
        var updated = contracts.update(
                workspaceId,
                "contract-test",
                created.id(),
                LocalDate.of(2026, 8, 1),
                null,
                "筹备",
                List.of(new ContractCommandService.ItemInput("coffee", "咖啡")),
                created.version(),
                Map.of());
        assertEquals("coffee", updated.items().getFirst().itemCode());
        var invalidated = contracts.invalidate(workspaceId, "contract-test", updated.id(), updated.version());
        assertEquals("INVALID", invalidated.status());
        assertEquals("NOT_OPERATING", contracts.derivedStoreStatus(workspaceId, "contract-test", storeId));
    }

    @Test
    void commandAndTaskReadsUseTheSameBoundedDerivedStoreStatusFact() {
        UUID projectId =
                jdbc().queryForObject("SELECT project_id FROM organization.store WHERE id=?", UUID.class, storeId);
        contracts.create(
                workspaceId,
                "contract-test",
                "CT-PREPARING",
                storeId,
                projectId,
                LocalDate.of(2026, 12, 1),
                null,
                "筹备",
                List.of(new ContractCommandService.ItemInput("tea", "茶")),
                Map.of());

        ContractTaskReadService taskReads = new ContractTaskReadService(jdbc(), new BusinessDateProvider(() -> now));
        assertEquals("PREPARING", contracts.derivedStoreStatus(workspaceId, "contract-test", storeId));
        assertEquals("PREPARING", taskReads.derivedStoreStatus(workspaceId, "contract-test", storeId));
        assertEquals(
                "PREPARING",
                taskReads
                        .derivedStoreStatuses(workspaceId, "contract-test", List.of(storeId))
                        .get(storeId));
    }

    @Test
    void rejectsInvalidDatesDuplicateItemCodesAndUnknownPhase() {
        UUID projectId =
                jdbc().queryForObject("SELECT project_id FROM organization.store WHERE id=?", UUID.class, storeId);
        assertThrows(
                ContractCommandService.ContractValidationException.class,
                () -> contracts.create(
                        workspaceId,
                        "contract-test",
                        "CT-bad-date",
                        storeId,
                        projectId,
                        LocalDate.of(2026, 8, 2),
                        LocalDate.of(2026, 8, 1),
                        null,
                        List.of(new ContractCommandService.ItemInput("tea", "茶")),
                        Map.of()));
        assertThrows(
                ContractCommandService.ContractValidationException.class,
                () -> contracts.create(
                        workspaceId,
                        "contract-test",
                        "CT-bad-item",
                        storeId,
                        projectId,
                        LocalDate.of(2026, 8, 1),
                        null,
                        null,
                        List.of(
                                new ContractCommandService.ItemInput("tea", "茶"),
                                new ContractCommandService.ItemInput("tea", "另一杯茶")),
                        Map.of()));
        assertThrows(
                ContractCommandService.ContractValidationException.class,
                () -> contracts.create(
                        workspaceId,
                        "contract-test",
                        "CT-bad-phase",
                        storeId,
                        projectId,
                        LocalDate.of(2026, 8, 1),
                        null,
                        "不存在",
                        List.of(new ContractCommandService.ItemInput("tea", "茶")),
                        Map.of()));
    }

    @Test
    void candidateReadKeepsDisabledStoreAndReturnsProjectPhases() {
        JdbcTemplate jdbc = jdbc();
        UUID disabledStore = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO organization.store (id, workspace_uuid, group_workspace_key, project_id, tenant_id, "
                        + "brand_id, code, name, status, version, created_at_epoch_millis, updated_at_epoch_millis) "
                        + "SELECT "
                        + "?, workspace_uuid, group_workspace_key, project_id, tenant_id, brand_id, 'store-disabled', "
                        + "'Disabled store', 'DISABLED', 1, ?, ? FROM organization.store WHERE id=?",
                disabledStore,
                now,
                now,
                storeId);
        UUID projectId =
                jdbc.queryForObject("SELECT project_id FROM organization.store WHERE id=?", UUID.class, storeId);
        var page = reads.candidates(workspaceId, "contract-test", projectId, "store", 1, 20);
        assertEquals(2, page.stores().size());
        assertEquals(
                "DISABLED",
                page.stores().stream()
                        .filter(value -> value.id().equals(disabledStore))
                        .findFirst()
                        .orElseThrow()
                        .storeStatus());
        assertEquals(List.of("筹备", "营运"), page.phases());
    }

    @Test
    void candidateReadPreservesSelectedStoreOutsideCurrentPage() {
        JdbcTemplate jdbc = jdbc();
        UUID projectId =
                jdbc.queryForObject("SELECT project_id FROM organization.store WHERE id=?", UUID.class, storeId);
        UUID secondStore = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO organization.store (id, workspace_uuid, group_workspace_key, project_id, tenant_id, "
                        + "brand_id, code, name, status, version, created_at_epoch_millis, updated_at_epoch_millis) "
                        + "SELECT "
                        + "?, workspace_uuid, group_workspace_key, project_id, tenant_id, brand_id, 'store-second', "
                        + "'Second store', 'ENABLED', 1, ?, ? FROM organization.store WHERE id=?",
                secondStore,
                now,
                now,
                storeId);
        var page = reads.candidates(workspaceId, "contract-test", projectId, secondStore, "nomatch", 1, 1);
        assertEquals(0, page.metadata().total());
        assertEquals(secondStore, page.stores().getFirst().id());
    }

    @Test
    void taskPageKeepsTheSelectedProjectAndFiltersByBusinessFields() {
        UUID projectId =
                jdbc().queryForObject("SELECT project_id FROM organization.store WHERE id=?", UUID.class, storeId);
        UUID tenantId =
                jdbc().queryForObject("SELECT tenant_id FROM organization.store WHERE id=?", UUID.class, storeId);
        contracts.create(
                workspaceId,
                "contract-test",
                "CT-page",
                storeId,
                projectId,
                LocalDate.of(2026, 8, 1),
                null,
                "筹备",
                List.of(new ContractCommandService.ItemInput("tea-001", "茉莉茶")),
                Map.of());
        var page = reads.list(
                workspaceId,
                "contract-test",
                new ContractTaskReadService.ContractListQuery(
                        projectId,
                        storeId,
                        tenantId,
                        "CT-page",
                        "筹备",
                        "tea-001",
                        LocalDate.of(2026, 8, 1),
                        LocalDate.of(2026, 8, 31),
                        "VALID",
                        "CONTRACT_NO",
                        "ASC",
                        1,
                        20));
        assertEquals(projectId, page.metadata().projectRef());
        assertEquals(1, page.items().size());
        assertEquals("CT-page", page.items().getFirst().contractNo());
        assertEquals("VALID", page.items().getFirst().status());
        assertEquals("tea-001", page.items().getFirst().items().getFirst().code());
    }

    @Test
    void ownerActorIdempotentCreateReplaysAndPlatformOverviewKeepsValidStatus() {
        UUID projectId =
                jdbc().queryForObject("SELECT project_id FROM organization.store WHERE id=?", UUID.class, storeId);
        UUID tenantId =
                jdbc().queryForObject("SELECT tenant_id FROM organization.store WHERE id=?", UUID.class, storeId);
        AuditActor actor = new AuditActor("WORKSPACE_ACCOUNT", UUID.randomUUID(), "Operations tester");
        String idempotencyKey = "contract-owner-receipt-001";
        OperationsOwnerScopeGrant grant = new OperationsOwnerScopeGrant(
                workspaceId,
                "contract-test",
                "REQ_CREATE_OPERATIONS_CONTRACT",
                "BC-CONTRACT-CREATE",
                "PROJECT",
                projectId,
                "PROJECT",
                projectId,
                List.of(projectId));
        var first = contracts.create(
                workspaceId,
                "contract-test",
                "CT-owner-receipt",
                storeId,
                projectId,
                LocalDate.of(2026, 8, 1),
                null,
                "筹备",
                "owner actor",
                List.of(new ContractCommandService.ItemInput("tea-owner", "茉莉茶")),
                Map.of(),
                idempotencyKey,
                actor,
                grant);
        var replay = contracts.create(
                workspaceId,
                "contract-test",
                "CT-owner-receipt",
                storeId,
                projectId,
                LocalDate.of(2026, 8, 1),
                null,
                "筹备",
                "owner actor",
                List.of(new ContractCommandService.ItemInput("tea-owner", "茉莉茶")),
                Map.of(),
                idempotencyKey,
                actor,
                grant);
        assertEquals(first, replay);
        OperationsOwnerScopeGrant staleGrant = new OperationsOwnerScopeGrant(
                workspaceId,
                "contract-test",
                "REQ_CREATE_OPERATIONS_CONTRACT",
                "BC-CONTRACT-CREATE",
                "PROJECT",
                UUID.randomUUID(),
                "PROJECT",
                projectId,
                List.of(projectId));
        assertThrows(
                ContractCommandService.ContractAuthorizationException.class,
                () -> contracts.create(
                        workspaceId,
                        "contract-test",
                        "CT-owner-receipt",
                        storeId,
                        projectId,
                        LocalDate.of(2026, 8, 1),
                        null,
                        "筹备",
                        "owner actor",
                        List.of(new ContractCommandService.ItemInput("tea-owner", "茉莉茶")),
                        Map.of(),
                        idempotencyKey,
                        actor,
                        staleGrant));
        assertThrows(
                ContractCommandService.ContractAuthorizationException.class,
                () -> contracts.create(
                        workspaceId,
                        "contract-test",
                        "CT-owner-receipt",
                        storeId,
                        projectId,
                        LocalDate.of(2026, 8, 1),
                        null,
                        "筹备",
                        "owner actor",
                        List.of(new ContractCommandService.ItemInput("tea-owner", "茉莉茶")),
                        Map.of(),
                        idempotencyKey,
                        actor,
                        null));
        assertEquals(
                first.id(), reads.view(workspaceId, "contract-test", first.id()).id());
        assertEquals(
                "VALID",
                reads
                        .list(workspaceId, "contract-test", ContractTaskReadService.ContractListQuery.empty())
                        .items()
                        .stream()
                        .filter(item -> item.id().equals(first.id()))
                        .findFirst()
                        .orElseThrow()
                        .status());
        var byProjectAndStore = reads.list(
                workspaceId,
                "contract-test",
                new ContractTaskReadService.ContractListQuery(
                        projectId,
                        storeId,
                        null,
                        "CT-owner-receipt",
                        null,
                        null,
                        null,
                        null,
                        null,
                        "CONTRACT_NO",
                        "ASC",
                        1,
                        20));
        var byTenantId = reads.list(
                workspaceId,
                "contract-test",
                new ContractTaskReadService.ContractListQuery(
                        null,
                        null,
                        tenantId,
                        "CT-owner-receipt",
                        null,
                        null,
                        null,
                        null,
                        null,
                        "CONTRACT_NO",
                        "ASC",
                        1,
                        20));
        var projectAndStoreItem = byProjectAndStore.items().stream()
                .filter(item -> item.id().equals(first.id()))
                .findFirst()
                .orElseThrow();
        assertEquals(first.id(), projectAndStoreItem.id());
        assertEquals(projectId, projectAndStoreItem.project().id());
        assertEquals("tea-owner", projectAndStoreItem.items().getFirst().code());
        assertEquals(
                first.id(),
                byTenantId.items().stream()
                        .filter(item -> item.id().equals(first.id()))
                        .findFirst()
                        .orElseThrow()
                        .id());
    }

    @Test
    void receiptIdentityIsWorkspaceScopedWhileSameWorkspaceMismatchStillConflicts() {
        UUID projectId =
                jdbc().queryForObject("SELECT project_id FROM organization.store WHERE id=?", UUID.class, storeId);
        String sharedKey = "contract-scope-key-0001";
        var first = contracts.create(
                workspaceId,
                "contract-test",
                "CT-scope-a",
                storeId,
                projectId,
                LocalDate.of(2026, 8, 1),
                null,
                "筹备",
                "scope A",
                List.of(new ContractCommandService.ItemInput("tea-a", "茶 A")),
                Map.of(),
                sharedKey);
        var second = contracts.create(
                secondWorkspaceId,
                "contract-test-b",
                "CT-scope-b",
                secondStoreId,
                secondProjectId,
                LocalDate.of(2026, 8, 1),
                null,
                "筹备",
                "scope B",
                List.of(new ContractCommandService.ItemInput("tea-b", "茶 B")),
                Map.of(),
                sharedKey);

        assertNotEquals(first.id(), second.id());
        assertEquals(
                first,
                contracts.create(
                        workspaceId,
                        "contract-test",
                        "CT-scope-a",
                        storeId,
                        projectId,
                        LocalDate.of(2026, 8, 1),
                        null,
                        "筹备",
                        "scope A",
                        List.of(new ContractCommandService.ItemInput("tea-a", "茶 A")),
                        Map.of(),
                        sharedKey));
        assertEquals(
                second,
                contracts.create(
                        secondWorkspaceId,
                        "contract-test-b",
                        "CT-scope-b",
                        secondStoreId,
                        secondProjectId,
                        LocalDate.of(2026, 8, 1),
                        null,
                        "筹备",
                        "scope B",
                        List.of(new ContractCommandService.ItemInput("tea-b", "茶 B")),
                        Map.of(),
                        sharedKey));
        assertEquals(
                2,
                jdbc().queryForObject(
                                "SELECT count(*) FROM contract.contract_command_receipt WHERE idempotency_key=?",
                                Integer.class,
                                sharedKey));
        assertThrows(
                ContractCommandReceiptService.ContractIdempotencyConflictException.class,
                () -> contracts.create(
                        workspaceId,
                        "contract-test",
                        "CT-scope-a-changed",
                        storeId,
                        projectId,
                        LocalDate.of(2026, 8, 1),
                        null,
                        "筹备",
                        "scope A",
                        List.of(new ContractCommandService.ItemInput("tea-a", "茶 A")),
                        Map.of(),
                        sharedKey));
    }

    private static JdbcTemplate jdbc() {
        return new JdbcTemplate(
                new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
    }

    @AfterAll
    static void cleanup() {
        if (flyway != null) flyway.clean();
    }
}
