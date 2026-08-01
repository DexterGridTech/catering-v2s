package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.platform.access.PlatformExecutionContext;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class OrganizationOwnerServiceTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    private static Flyway flyway;
    private static UUID workspaceId;
    private static OrganizationHierarchyService hierarchy;
    private static BusinessEntityService entities;
    private static OrganizationOverviewTaskReadService overview;
    private static DriverManagerDataSource dataSource;
    private static final long NOW = 1_785_000_000_000L;

    @BeforeAll static void setup() {
        flyway = Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()).locations("filesystem:../../src/main/resources/db/migration").schemas("public").defaultSchema("public").cleanDisabled(false).load();
        flyway.migrate();
        dataSource = new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        TimeProvider time = () -> NOW;
        workspaceId = UUID.randomUUID();
        jdbc.update("INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, name_normalized, operations_title, status, revision, version, created_at_epoch_millis, updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, 'organization-test', 'Organization test', 'organization test', 'Organization test', 'ENABLED', 1, 1, ?, ?, ?)", workspaceId, NOW, NOW, NOW);
        ExtensionDefinitionService definitions = new ExtensionDefinitionService(jdbc, time);
        hierarchy = new OrganizationHierarchyService(jdbc, time);
        entities = new BusinessEntityService(jdbc, time, definitions, hierarchy);
        overview = new OrganizationOverviewTaskReadService(jdbc);
        definitions.replace(workspaceId, "organization-test", "STORE", 0, List.of(new ExtensionDefinitionService.Field("floorArea", "Floor area", "NUMBER", true, List.of(), "ENABLED", 0, null)));
    }

    @Test void hierarchyIsStrictAndStoresRequireSameWorkspaceActiveReferences() {
        var region = hierarchy.create(workspaceId, "organization-test", "REGION", null, "R1", "Region");
        var project = hierarchy.create(workspaceId, "organization-test", "PROJECT", region.id(), "P1", "Project");
        var phases = hierarchy.replaceProjectPhaseNames(workspaceId, "organization-test", project.id(), project.version(), List.of("Preparation", "Operating"));
        assertEquals(List.of("Preparation", "Operating"), phases.phaseNames());
        assertThrows(OrganizationHierarchyService.OrganizationValidationException.class, () -> hierarchy.create(workspaceId, "organization-test", "REGION", region.id(), "bad", "Bad parent"));

        var brand = entities.createEntity("BRAND", workspaceId, "organization-test", "brand-1", "Brand", null, null, Map.of());
        var tenant = entities.createEntity("TENANT", workspaceId, "organization-test", "tenant-1", "Tenant", "Tenant legal", "91310000TENANT", Map.of());
        var head = entities.createEntity("HEAD_COMPANY", workspaceId, "organization-test", "head-1", "Head", "Head legal", "91310000HEAD", Map.of());
        entities.addHeadCompanyBrandAuthorization(workspaceId, "organization-test", head.id(), brand.id(), "organization-test-add-0001", AuditActor.system());
        var store = entities.createStore(workspaceId, "organization-test", project.id(), tenant.id(), brand.id(), head.id(), "store-1", "Store", Map.of("floorArea", "120"));
        assertTrue(entities.isEnterableStore(workspaceId, "organization-test", store.id()));
        var disabled = entities.transitionEntityStatus("BRAND", workspaceId, "organization-test", brand.id(), "DISABLED", brand.version());
        assertEquals("DISABLED", disabled.status());
        var disabledStore = entities.transitionEntityStatus("STORE", workspaceId, "organization-test", store.id(), "DISABLED", store.version());
        assertEquals("DISABLED", disabledStore.status());
        assertFalse(entities.isEnterableStore(workspaceId, "organization-test", UUID.randomUUID()));
    }

    @Test void rejectsUnknownExtensionValueAndCrossWorkspaceReference() {
        assertThrows(BusinessEntityService.OrganizationValidationException.class, () -> entities.createEntity("BRAND", workspaceId, "organization-test", "bad-brand", "Bad", null, null, Map.of("unknown", "\"value\"")));
        assertThrows(OrganizationHierarchyService.OrganizationNotFoundException.class, () -> hierarchy.requireNode(UUID.randomUUID(), "other", UUID.randomUUID(), "PROJECT"));
    }

    @Test void idempotentTenantCreationCommitsInsideOneRequiredTransaction() {
        var transaction = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        var created = transaction.execute(status -> entities.createEntity("TENANT", workspaceId, "organization-test", "receipt-tenant", "Receipt tenant", "Receipt tenant legal", "91310000RECEIPT", null, null, Map.of(), "organization-test-tenant-receipt-0001", AuditActor.system()));
        var replayed = transaction.execute(status -> entities.createEntity("TENANT", workspaceId, "organization-test", "receipt-tenant", "Receipt tenant", "Receipt tenant legal", "91310000RECEIPT", null, null, Map.of(), "organization-test-tenant-receipt-0001", AuditActor.system()));
        assertEquals("receipt-tenant", created.code());
        assertEquals(created.id(), replayed.id());
    }

    @Test void commercialGroupInitializationUsesCanonicalUuidAndEpochColumnsOnFreshSchema() {
        long legacyWorkspaceId = jdbc().queryForObject("SELECT id FROM platform_workspace.group_workspace WHERE group_workspace_key='organization-test'", Long.class);
        OrganizationCommandService commands = new OrganizationCommandService(jdbc(),
            (candidateWorkspaceId, groupWorkspaceKey) -> workspaceId.equals(candidateWorkspaceId) && "organization-test".equals(groupWorkspaceKey),
            () -> NOW);
        PlatformExecutionContext context = new PlatformExecutionContext("organization-owner-test", "platform-admin", Instant.ofEpochMilli(NOW + 60_000L), "organization-owner-test");
        String idempotencyKey = "organization-test-commercial-group-0001";

        var initialized = commands.execute(context, workspaceId, "organization-test", legacyWorkspaceId, idempotencyKey, "ORG-ROOT", "Organization root", AuditActor.system());
        var replay = commands.execute(context, workspaceId, "organization-test", legacyWorkspaceId, idempotencyKey, "ORG-ROOT", "Organization root", AuditActor.system());

        assertEquals(initialized.id(), replay.id());
        assertEquals(NOW, initialized.createdAtEpochMillis());
        assertEquals(initialized.id(), jdbc().queryForObject("SELECT commercial_group_uuid FROM organization.commercial_group WHERE group_workspace_key='organization-test'", UUID.class));
        assertEquals(NOW, jdbc().queryForObject("SELECT created_at_epoch_millis FROM organization.commercial_group WHERE group_workspace_key='organization-test'", Long.class));
    }

    @Test void authorizationIsSingleActionIdempotentAndReferencedBrandCannotBeRemoved() {
        var region = hierarchy.create(workspaceId, "organization-test", "REGION", null, "AUTH-R", "Authorization region");
        var project = hierarchy.create(workspaceId, "organization-test", "PROJECT", region.id(), "AUTH-P", "Authorization project");
        var brand = entities.createEntity("BRAND", workspaceId, "organization-test", "auth-brand", "Authorization brand", null, null, Map.of());
        var tenant = entities.createEntity("TENANT", workspaceId, "organization-test", "auth-tenant", "Authorization tenant", "Authorization tenant", "91310000AUTH", Map.of());
        var head = entities.createEntity("HEAD_COMPANY", workspaceId, "organization-test", "auth-head", "Authorization head", "Authorization head", "91310000AUTHHEAD", Map.of());

        var first = entities.addHeadCompanyBrandAuthorization(workspaceId, "organization-test", head.id(), brand.id(), "organization-test-add-0002", AuditActor.system());
        long authorizedAt = entities.authorizedBrandAuthorizations(workspaceId, "organization-test", head.id()).getFirst().authorizedAtEpochMillis();
        var replay = entities.addHeadCompanyBrandAuthorization(workspaceId, "organization-test", head.id(), brand.id(), "organization-test-add-0002", AuditActor.system());
        assertEquals(first, replay);
        assertEquals(authorizedAt, entities.authorizedBrandAuthorizations(workspaceId, "organization-test", head.id()).getFirst().authorizedAtEpochMillis());

        entities.createStore(workspaceId, "organization-test", project.id(), tenant.id(), brand.id(), head.id(), "auth-store", "Authorization store", Map.of("floorArea", "80"));
        assertThrows(BusinessEntityService.HeadCompanyBrandAuthorizationInUseException.class, () -> entities.removeHeadCompanyBrandAuthorization(workspaceId, "organization-test", head.id(), brand.id(), "organization-test-remove-0001", AuditActor.system()));
        assertThrows(BusinessEntityService.HeadCompanyBrandAuthorizationNotFoundException.class, () -> entities.removeHeadCompanyBrandAuthorization(workspaceId, "organization-test", head.id(), UUID.randomUUID(), "organization-test-remove-0002", AuditActor.system()));
    }

    @Test void brandPageKeepsCandidatePredicateTotalAndSliceInsideTheOrganizationOwner() {
        entities.createEntity("BRAND", workspaceId, "organization-test", "owner-page-a", "Owner page alpha", null, null, Map.of());
        entities.createEntity("BRAND", workspaceId, "organization-test", "owner-page-b", "Owner page bravo", null, null, Map.of());
        entities.createEntity("BRAND", workspaceId, "organization-test", "owner-page-c", "Owner page charlie", null, null, Map.of());

        var result = entities.pageBrands(workspaceId, "organization-test", "Owner page", "owner-page", "ENABLED", "NAME", "ASC", 2, 1);

        assertEquals(3, result.total());
        assertEquals(2, result.page());
        assertEquals(1, result.pageSize());
        assertEquals(List.of("Owner page bravo"), result.items().stream().map(value -> value.name()).toList());
        assertThrows(BusinessEntityService.OrganizationValidationException.class, () -> entities.pageBrands(workspaceId, "organization-test", null, null, null, "UNKNOWN", "ASC", 1, 20));
    }

    @Test void tenantAndHeadCompanyPagesKeepPredicateTotalAndSliceInsideTheOrganizationOwner() {
        entities.createEntity("TENANT", workspaceId, "organization-test", "owner-tenant-a", "Owner tenant alpha", "Owner tenant alpha", "91310000OWNER01", Map.of());
        entities.createEntity("TENANT", workspaceId, "organization-test", "owner-tenant-b", "Owner tenant bravo", "Owner tenant bravo", "91310000OWNER02", Map.of());
        entities.createEntity("HEAD_COMPANY", workspaceId, "organization-test", "owner-head-a", "Owner head alpha", "Owner head alpha", "91310000OWNER03", Map.of());
        entities.createEntity("HEAD_COMPANY", workspaceId, "organization-test", "owner-head-b", "Owner head bravo", "Owner head bravo", "91310000OWNER04", Map.of());

        var tenants = entities.pageEntities("TENANT", workspaceId, "organization-test", "Owner tenant", "owner-tenant", "ENABLED", "NAME", "ASC", 2, 1);
        var headCompanies = entities.pageEntities("HEAD_COMPANY", workspaceId, "organization-test", "Owner head", "owner-head", "ENABLED", "NAME", "ASC", 2, 1);

        assertEquals(2, tenants.total());
        assertEquals(List.of("Owner tenant bravo"), tenants.items().stream().map(value -> value.name()).toList());
        assertEquals(2, headCompanies.total());
        assertEquals(List.of("Owner head bravo"), headCompanies.items().stream().map(value -> value.name()).toList());
        assertThrows(BusinessEntityService.OrganizationValidationException.class, () -> entities.pageEntities("TENANT", workspaceId, "organization-test", null, null, null, "UNKNOWN", "ASC", 1, 20));
    }

    @Test void overviewPreservesHierarchyPathAndStoreReferences() {
        var region = hierarchy.create(workspaceId, "organization-test", "REGION", null, "OV-R", "Overview region");
        var project = hierarchy.create(workspaceId, "organization-test", "PROJECT", region.id(), "OV-P", "Overview project");
        var brand = entities.createEntity("BRAND", workspaceId, "organization-test", "overview-brand", "Overview brand", null, null, Map.of());
        var tenant = entities.createEntity("TENANT", workspaceId, "organization-test", "overview-tenant", "Overview tenant", "Overview tenant", "91310000OVERVIEW", Map.of());
        var store = entities.createStore(workspaceId, "organization-test", project.id(), tenant.id(), brand.id(), null, "overview-store", "Overview store", Map.of("floorArea", "100"));
        var hierarchyPage = overview.page(workspaceId, "organization-test", "HIERARCHY", 1, 50);
        assertTrue(hierarchyPage.items().stream().anyMatch(item -> item.id().equals(project.id()) && item.path().size() == 2));
        var storePage = overview.page(workspaceId, "organization-test", "STORE", 1, 50);
        var item = storePage.items().stream().filter(value -> value.id().equals(store.id())).findFirst().orElseThrow();
        assertEquals(project.id(), item.project().id());
        assertEquals(brand.id(), item.brand().id());
        assertEquals(tenant.id(), item.tenant().id());
    }

    @Test void overviewUsesServerPageAndReadsOneItemWithoutMaterializingTheCategory() {
        var region = hierarchy.create(workspaceId, "organization-test", "REGION", null, "PAGE-R", "Page region");
        var project = hierarchy.create(workspaceId, "organization-test", "PROJECT", region.id(), "PAGE-P", "Page project");
        var brand = entities.createEntity("BRAND", workspaceId, "organization-test", "page-brand", "Page brand", null, null, Map.of());
        var tenant = entities.createEntity("TENANT", workspaceId, "organization-test", "page-tenant", "Page tenant", "Page tenant", "91310000PAGE", Map.of());
        var store = entities.createStore(workspaceId, "organization-test", project.id(), tenant.id(), brand.id(), null, "page-store", "Page store", Map.of("floorArea", "100"));

        var page = overview.page(workspaceId, "organization-test", "STORE", 1, 1);
        assertEquals(1, page.items().size());
        assertTrue(page.metadata().total() >= 1);
        var detail = overview.detail(workspaceId, "organization-test", "STORE", store.id());
        assertEquals(store.id(), detail.id());
        assertEquals(List.of(region.id(), project.id(), store.id()), detail.path().stream().map(OrganizationOverviewTaskReadService.Reference::id).toList());
        assertThrows(BusinessEntityService.OrganizationNotFoundException.class, () -> overview.detail(workspaceId, "organization-test", "STORE", UUID.randomUUID()));
    }

    @Test void assignmentCandidatesResolveTheirDisplayPathsInOneOwnerBatch() {
        UUID group = UUID.randomUUID();
        CommercialGroupLookup groups = new CommercialGroupLookup() {
            @Override public UUID requireCommercialGroupRef(UUID workspaceUuid, String key) { return group; }
            @Override public boolean isEnterableCommercialGroup(UUID workspaceUuid, String key, UUID commercialGroupRef) { return group.equals(commercialGroupRef); }
            @Override public String describeCommercialGroup(UUID workspaceUuid, String key, UUID commercialGroupRef) { return "Group"; }
        };
        OrganizationTaskPathService paths = new OrganizationTaskPathService(jdbc(), groups);
        OrganizationAssignmentCandidateService candidates = new OrganizationAssignmentCandidateService(jdbc(), groups, paths);
        var region = hierarchy.create(workspaceId, "organization-test", "REGION", null, "CAND-R", "Candidate region");
        var project = hierarchy.create(workspaceId, "organization-test", "PROJECT", region.id(), "CAND-P", "Candidate project");
        var brand = entities.createEntity("BRAND", workspaceId, "organization-test", "candidate-brand", "Candidate brand", null, null, Map.of());
        var tenant = entities.createEntity("TENANT", workspaceId, "organization-test", "candidate-tenant", "Candidate tenant", "Candidate tenant", "91310000CAND", Map.of());
        var store = entities.createStore(workspaceId, "organization-test", project.id(), tenant.id(), brand.id(), null, "candidate-store", "Candidate store", Map.of("floorArea", "100"));

        assertTrue(candidates.listEnabled(workspaceId, "organization-test", "PROJECT").stream().anyMatch(value -> value.organizationRef().equals(project.id()) && value.path().contains("CAND-R Candidate region / CAND-P Candidate project")));
        assertTrue(candidates.listEnabled(workspaceId, "organization-test", "STORE").stream().anyMatch(value -> value.organizationRef().equals(store.id()) && value.path().contains("CAND-R Candidate region / CAND-P Candidate project / candidate-store Candidate store")));
    }

    @Test void batchTaskPathsKeepOwnerFactsAndDoNotLetConsumersReadOwnerTables() {
        UUID group = UUID.randomUUID();
        CommercialGroupLookup groups = new CommercialGroupLookup() {
            @Override public UUID requireCommercialGroupRef(UUID workspaceUuid, String key) { return group; }
            @Override public boolean isEnterableCommercialGroup(UUID workspaceUuid, String key, UUID commercialGroupRef) { return group.equals(commercialGroupRef); }
            @Override public String describeCommercialGroup(UUID workspaceUuid, String key, UUID commercialGroupRef) { return "Group"; }
        };
        OrganizationTaskPathService paths = new OrganizationTaskPathService(jdbc(), groups);
        var region = hierarchy.create(workspaceId, "organization-test", "REGION", null, "BATCH-R", "Batch region");
        var project = hierarchy.create(workspaceId, "organization-test", "PROJECT", region.id(), "BATCH-P", "Batch project");
        var tenant = entities.createEntity("TENANT", workspaceId, "organization-test", "batch-tenant", "Batch tenant", "Batch tenant", "91310000BATCHTENANT", Map.of());
        var brand = entities.createEntity("BRAND", workspaceId, "organization-test", "batch-brand", "Batch brand", null, null, Map.of());
        var head = entities.createEntity("HEAD_COMPANY", workspaceId, "organization-test", "batch-head", "Batch head", "Batch head", "91310000BATCHHEAD", Map.of());
        entities.addHeadCompanyBrandAuthorization(workspaceId, "organization-test", head.id(), brand.id(), "batch-path-brand-authorization", AuditActor.system());
        var store = entities.createStore(workspaceId, "organization-test", project.id(), tenant.id(), brand.id(), head.id(), "batch-store", "Batch store", Map.of("floorArea", "100"));

        var result = paths.requireTaskPaths(workspaceId, "organization-test", List.of(
            new OrganizationTaskPathLookup.TaskPathRef("GROUP", group),
            new OrganizationTaskPathLookup.TaskPathRef("REGION", region.id()),
            new OrganizationTaskPathLookup.TaskPathRef("PROJECT", project.id()),
            new OrganizationTaskPathLookup.TaskPathRef("HEAD_COMPANY", head.id()),
            new OrganizationTaskPathLookup.TaskPathRef("STORE", store.id())
        ));

        assertEquals("Group", result.get(new OrganizationTaskPathLookup.TaskPathRef("GROUP", group)).displayPath());
        assertEquals("BATCH-R Batch region / BATCH-P Batch project", result.get(new OrganizationTaskPathLookup.TaskPathRef("PROJECT", project.id())).displayPath());
        assertEquals(List.of(group, region.id(), project.id(), store.id()), result.get(new OrganizationTaskPathLookup.TaskPathRef("STORE", store.id())).ancestorIds());
        assertThrows(OrganizationTaskPathService.TaskPathNotFoundException.class, () -> paths.requireTaskPaths(workspaceId, "organization-test", List.of(new OrganizationTaskPathLookup.TaskPathRef("STORE", UUID.randomUUID()))));
    }

    @Test void batchAvailabilityKeepsOnlyEnabledPersistedTargetsAndNeverFailsForStaleAssignments() {
        UUID group = UUID.randomUUID();
        CommercialGroupLookup groups = new CommercialGroupLookup() {
            @Override public UUID requireCommercialGroupRef(UUID workspaceUuid, String key) { return group; }
            @Override public boolean isEnterableCommercialGroup(UUID workspaceUuid, String key, UUID commercialGroupRef) { return group.equals(commercialGroupRef); }
            @Override public String describeCommercialGroup(UUID workspaceUuid, String key, UUID commercialGroupRef) { return "Group"; }
        };
        OrganizationTaskPathService paths = new OrganizationTaskPathService(jdbc(), groups);
        var region = hierarchy.create(workspaceId, "organization-test", "REGION", null, "AVAILABLE-R", "Available region");
        var project = hierarchy.create(workspaceId, "organization-test", "PROJECT", region.id(), "AVAILABLE-P", "Available project");
        jdbc().update("UPDATE organization.organization_node SET status='DISABLED' WHERE id=?", project.id());

        UUID staleStore = UUID.randomUUID();
        Set<OrganizationTaskPathLookup.TaskPathRef> available = paths.availableTaskTargets(workspaceId, "organization-test", List.of(
            new OrganizationTaskPathLookup.TaskPathRef("GROUP", group),
            new OrganizationTaskPathLookup.TaskPathRef("REGION", region.id()),
            new OrganizationTaskPathLookup.TaskPathRef("PROJECT", project.id()),
            new OrganizationTaskPathLookup.TaskPathRef("STORE", staleStore)
        ));

        assertTrue(available.contains(new OrganizationTaskPathLookup.TaskPathRef("GROUP", group)));
        assertTrue(available.contains(new OrganizationTaskPathLookup.TaskPathRef("REGION", region.id())));
        assertFalse(available.contains(new OrganizationTaskPathLookup.TaskPathRef("PROJECT", project.id())));
        assertFalse(available.contains(new OrganizationTaskPathLookup.TaskPathRef("STORE", staleStore)));
    }

    private static JdbcTemplate jdbc() { return new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())); }

    @AfterAll static void cleanup() { if (flyway != null) flyway.clean(); }
}
