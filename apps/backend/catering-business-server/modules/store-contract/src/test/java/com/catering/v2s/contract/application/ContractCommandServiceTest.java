package com.catering.v2s.contract.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OrganizationHierarchyService;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
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
class ContractCommandServiceTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    private static Flyway flyway;
    private static ContractCommandService contracts;
    private static ContractTaskReadService reads;
    private static UUID workspaceId;
    private static UUID storeId;
    private static UUID tenantId;
    private static long now = 1_785_000_000_000L;

    @BeforeAll static void setup() {
        flyway = Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()).locations("filesystem:../../src/main/resources/db/migration").schemas("public").defaultSchema("public").cleanDisabled(false).load();
        flyway.migrate();
        JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
        TimeProvider time = () -> now;
        workspaceId = UUID.randomUUID();
        jdbc.update("INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, name_normalized, operations_title, status, revision, version, created_at_epoch_millis, updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, 'contract-test', 'Contract test', 'contract test', 'Contract test', 'ENABLED', 1, 1, ?, ?, ?)", workspaceId, now, now, now);
        ExtensionDefinitionService definitions = new ExtensionDefinitionService(jdbc, time);
        OrganizationHierarchyService hierarchy = new OrganizationHierarchyService(jdbc, time);
        BusinessEntityService entities = new BusinessEntityService(jdbc, time, definitions, hierarchy);
        var region = hierarchy.create(workspaceId, "contract-test", "REGION", null, "region", "Region");
        var project = hierarchy.create(workspaceId, "contract-test", "PROJECT", region.id(), "project", "Project");
        hierarchy.replaceProjectPhaseNames(workspaceId, "contract-test", project.id(), project.version(), List.of("筹备", "营运"));
        var brand = entities.createEntity("BRAND", workspaceId, "contract-test", "brand", "Brand", null, null, Map.of());
        var tenant = entities.createEntity("TENANT", workspaceId, "contract-test", "tenant", "Tenant", "Tenant legal", "91310000TEST", Map.of());
        tenantId = tenant.id();
        storeId = entities.createStore(workspaceId, "contract-test", project.id(), tenant.id(), brand.id(), null, "store", "Store", Map.of()).id();
        contracts = new ContractCommandService(jdbc, time, new BusinessDateProvider(time), entities, definitions);
        reads = new ContractTaskReadService(jdbc);
    }

    @Test void createsUpdatesInvalidatesAndDerivesStoreStatusFromBusinessDate() {
        UUID projectId = jdbc().queryForObject("SELECT project_id FROM organization.store WHERE id=?", UUID.class, storeId);
        var created = contracts.create(workspaceId, "contract-test", "CT-001", storeId, projectId, LocalDate.of(2026, 7, 1), LocalDate.of(2026, 12, 31), "营运", List.of(new ContractCommandService.ItemInput("tea", "茶")), Map.of());
        assertEquals("OPERATING", contracts.derivedStoreStatus(workspaceId, "contract-test", storeId));
        var updated = contracts.update(workspaceId, "contract-test", created.id(), LocalDate.of(2026, 8, 1), null, "筹备", List.of(new ContractCommandService.ItemInput("coffee", "咖啡")), created.version(), Map.of());
        assertEquals("coffee", updated.items().getFirst().itemCode());
        var invalidated = contracts.invalidate(workspaceId, "contract-test", updated.id(), updated.version());
        assertEquals("INVALID", invalidated.status());
        assertEquals("NOT_OPERATING", contracts.derivedStoreStatus(workspaceId, "contract-test", storeId));
    }

    @Test void rejectsInvalidDatesDuplicateItemCodesAndUnknownPhase() {
        UUID projectId = jdbc().queryForObject("SELECT project_id FROM organization.store WHERE id=?", UUID.class, storeId);
        assertThrows(ContractCommandService.ContractValidationException.class, () -> contracts.create(workspaceId, "contract-test", "CT-bad-date", storeId, projectId, LocalDate.of(2026, 8, 2), LocalDate.of(2026, 8, 1), null, List.of(new ContractCommandService.ItemInput("tea", "茶")), Map.of()));
        assertThrows(ContractCommandService.ContractValidationException.class, () -> contracts.create(workspaceId, "contract-test", "CT-bad-item", storeId, projectId, LocalDate.of(2026, 8, 1), null, null, List.of(new ContractCommandService.ItemInput("tea", "茶"), new ContractCommandService.ItemInput("tea", "另一杯茶")), Map.of()));
        assertThrows(ContractCommandService.ContractValidationException.class, () -> contracts.create(workspaceId, "contract-test", "CT-bad-phase", storeId, projectId, LocalDate.of(2026, 8, 1), null, "不存在", List.of(new ContractCommandService.ItemInput("tea", "茶")), Map.of()));
    }

    @Test void candidateReadKeepsDisabledStoreAndReturnsProjectPhases() {
        JdbcTemplate jdbc = jdbc();
        UUID disabledStore = UUID.randomUUID();
        jdbc.update("INSERT INTO organization.store (id, workspace_uuid, group_workspace_key, project_id, tenant_id, brand_id, code, name, status, version, created_at_epoch_millis, updated_at_epoch_millis) SELECT ?, workspace_uuid, group_workspace_key, project_id, tenant_id, brand_id, 'store-disabled', 'Disabled store', 'DISABLED', 1, ?, ? FROM organization.store WHERE id=?", disabledStore, now, now, storeId);
        UUID projectId = jdbc.queryForObject("SELECT project_id FROM organization.store WHERE id=?", UUID.class, storeId);
        var page = reads.candidates(workspaceId, "contract-test", projectId, "store", 1, 20);
        assertEquals(2, page.stores().size());
        assertEquals("DISABLED", page.stores().stream().filter(value -> value.id().equals(disabledStore)).findFirst().orElseThrow().storeStatus());
        assertEquals(List.of("筹备", "营运"), page.phases());
    }

    @Test void taskPageKeepsTheSelectedProjectAndFiltersByBusinessFields() {
        UUID projectId = jdbc().queryForObject("SELECT project_id FROM organization.store WHERE id=?", UUID.class, storeId);
        contracts.create(workspaceId, "contract-test", "CT-page", storeId, projectId, LocalDate.of(2026, 8, 1), null, "筹备", List.of(new ContractCommandService.ItemInput("tea-001", "茉莉茶")), Map.of());
        var page = reads.page(workspaceId, "contract-test", projectId, storeId, "CT-page", "筹备", "Tenant", "tea-001", LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31), "VALID", "CONTRACT_NO", "ASC", 1, 20);
        assertEquals(projectId, page.metadata().projectRef());
        assertEquals(1, page.items().size());
        assertEquals("CT-page", page.items().getFirst().contractNo());
        assertEquals("VALID", page.items().getFirst().status());
        assertEquals("tea-001", page.items().getFirst().items().getFirst().code());
    }

    @Test void ownerActorIdempotentCreateReplaysAndPlatformOverviewKeepsValidStatus() {
        UUID projectId = jdbc().queryForObject("SELECT project_id FROM organization.store WHERE id=?", UUID.class, storeId);
        AuditActor actor = new AuditActor("WORKSPACE_ACCOUNT", UUID.randomUUID(), "Operations tester");
        String idempotencyKey = "contract-owner-receipt-001";
        var first = contracts.create(workspaceId, "contract-test", "CT-owner-receipt", storeId, projectId, LocalDate.of(2026, 8, 1), null, "筹备", "owner actor", List.of(new ContractCommandService.ItemInput("tea-owner", "茉莉茶")), Map.of(), idempotencyKey, actor);
        var replay = contracts.create(workspaceId, "contract-test", "CT-owner-receipt", storeId, projectId, LocalDate.of(2026, 8, 1), null, "筹备", "owner actor", List.of(new ContractCommandService.ItemInput("tea-owner", "茉莉茶")), Map.of(), idempotencyKey, actor);
        assertEquals(first, replay);
        assertEquals(first.id(), reads.view(workspaceId, "contract-test", first.id()).id());
        assertEquals("VALID", reads.platformOverview(workspaceId, "contract-test", 1, 20).items().stream().filter(item -> item.contractRef().id().equals(first.id())).findFirst().orElseThrow().status());
    }

    private static JdbcTemplate jdbc() { return new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())); }

    @AfterAll static void cleanup() { if (flyway != null) flyway.clean(); }
}
