package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.CommercialGroupReadback;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.platform.access.PlatformExecutionContext;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
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
    private static ExtensionDefinitionService definitions;
    private static BusinessEntityService entities;
    private static OrganizationOverviewTaskReadService overview;
    private static OrganizationCommandService commercialGroups;
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
        definitions = new ExtensionDefinitionService(jdbc, time);
        hierarchy = new OrganizationHierarchyService(jdbc, time, definitions);
        entities = new BusinessEntityService(jdbc, time, definitions, hierarchy);
        commercialGroups = new OrganizationCommandService(jdbc, (candidateWorkspaceId, groupWorkspaceKey) -> workspaceId.equals(candidateWorkspaceId) && "organization-test".equals(groupWorkspaceKey), time, definitions);
        overview = new OrganizationOverviewTaskReadService(jdbc, definitions, entities, hierarchy, commercialGroups);
        definitions.replace(workspaceId, "organization-test", "STORE", 0, List.of(new ExtensionDefinitionService.Field("floorArea", "Floor area", "NUMBER", true, List.of(), "ENABLED", 0, null)));
        definitions.replace(workspaceId, "organization-test", "COMMERCIAL_GROUP", 0, List.of(new ExtensionDefinitionService.Field("groupLabel", "Group label", "TEXT", false, List.of(), "ENABLED", 0, null)));
        definitions.replace(workspaceId, "organization-test", "REGION", 0, List.of(new ExtensionDefinitionService.Field("regionLabel", "Region label", "TEXT", false, List.of(), "ENABLED", 0, null)));
        definitions.replace(workspaceId, "organization-test", "PROJECT", 0, List.of(new ExtensionDefinitionService.Field("projectBudget", "Project budget", "NUMBER", false, List.of(), "ENABLED", 0, null)));
    }

    @Test void hierarchyIsStrictAndStoresRequireSameWorkspaceActiveReferences() {
        var region = hierarchy.create(workspaceId, "organization-test", "REGION", null, "R1", "Region");
        var project = hierarchy.create(workspaceId, "organization-test", "PROJECT", region.id(), "P1", "Project");
        var phases = hierarchy.replaceProjectPhaseNames(workspaceId, "organization-test", project.id(), project.version(), List.of("Preparation", "Operating"));
        assertEquals(List.of("Preparation", "Operating"), phases.phaseNames());
        assertThrows(OrganizationHierarchyService.OrganizationConflictException.class, () -> hierarchy.replaceProjectPhaseNames(workspaceId, "organization-test", project.id(), phases.version(), List.of("Preparation", "Preparation")));
        assertEquals(List.of("Preparation", "Operating"), hierarchy.requireNode(workspaceId, "organization-test", project.id(), "PROJECT").phaseNames());
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

    @Test void catalogBrandJudgmentUsesOrganizationFactsRatherThanTheRawSelection() {
        var region = hierarchy.create(workspaceId, "organization-test", "REGION", null, "brand-judgment-region", "Brand judgment region");
        var project = hierarchy.create(workspaceId, "organization-test", "PROJECT", region.id(), "brand-judgment-project", "Brand judgment project");
        var brand = entities.createEntity("BRAND", workspaceId, "organization-test", "brand-judgment-brand", "Brand judgment brand", null, null, Map.of());
        var anotherBrand = entities.createEntity("BRAND", workspaceId, "organization-test", "brand-judgment-other", "Other brand", null, null, Map.of());
        var tenant = entities.createEntity("TENANT", workspaceId, "organization-test", "brand-judgment-tenant", "Brand judgment tenant", "Brand judgment tenant", "91310000JUDGMENTTENANT", Map.of());
        var head = entities.createEntity("HEAD_COMPANY", workspaceId, "organization-test", "brand-judgment-head", "Brand judgment head", "Brand judgment head", "91310000JUDGMENT", Map.of());
        entities.addHeadCompanyBrandAuthorization(workspaceId, "organization-test", head.id(), brand.id(), "organization-brand-judgment-add-0001", AuditActor.system());
        var store = entities.createStore(workspaceId, "organization-test", project.id(), tenant.id(), brand.id(), head.id(), "brand-judgment-store", "Brand judgment store", Map.of("floorArea", "120"));

        var storeJudgment = entities.resolveCatalogBrand(
            workspaceId, "organization-test", "STORE", store.id(), CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(null)
        );
        assertEquals(brand.id().toString(), storeJudgment.brandRef());
        assertEquals("STORE_PERSISTED_BRAND", storeJudgment.judgmentSource());
        assertTrue(storeJudgment.judgmentRevision().startsWith("STORE_VERSION:"));
        assertThrows(BusinessEntityService.OrganizationValidationException.class, () -> entities.resolveCatalogBrand(
            workspaceId, "organization-test", "STORE", store.id(), CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(anotherBrand.id().toString())
        ));

        var headJudgment = entities.resolveCatalogBrand(
            workspaceId, "organization-test", "HEAD_COMPANY", head.id(), CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(brand.id().toString())
        );
        assertEquals(brand.id().toString(), headJudgment.brandRef());
        assertEquals("HEAD_COMPANY_BRAND_AUTHORIZATION", headJudgment.judgmentSource());
        assertTrue(headJudgment.judgmentRevision().contains("AUTHORIZED_AT:"));
        assertThrows(BusinessEntityService.OrganizationValidationException.class, () -> entities.resolveCatalogBrand(
            workspaceId, "organization-test", "HEAD_COMPANY", head.id(), CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(anotherBrand.id().toString())
        ));
    }

    @Test void idempotentTenantCreationCommitsInsideOneRequiredTransaction() {
        var transaction = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        var created = transaction.execute(status -> entities.createEntity("TENANT", workspaceId, "organization-test", "receipt-tenant", "Receipt tenant", "Receipt tenant legal", "91310000RECEIPT", null, null, Map.of(), "organization-test-tenant-receipt-0001", AuditActor.system()));
        var replayed = transaction.execute(status -> entities.createEntity("TENANT", workspaceId, "organization-test", "receipt-tenant", "Receipt tenant", "Receipt tenant legal", "91310000RECEIPT", null, null, Map.of(), "organization-test-tenant-receipt-0001", AuditActor.system()));
        assertEquals("receipt-tenant", created.code());
        assertEquals(created.id(), replayed.id());
    }

    @Test void commercialGroupInitializationUsesCanonicalUuidAndEpochColumnsOnFreshSchema() {
        UUID extensionWorkspaceId = UUID.randomUUID();
        String extensionWorkspaceKey = "organization-extension-group";
        jdbc().update("INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, name_normalized, operations_title, status, revision, version, created_at_epoch_millis, updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, ?, 'Extension group', 'extension group', 'Extension group', 'ENABLED', 1, 1, ?, ?, ?)", extensionWorkspaceId, extensionWorkspaceKey, NOW, NOW, NOW);
        definitions.replace(extensionWorkspaceId, extensionWorkspaceKey, "COMMERCIAL_GROUP", 0, List.of(new ExtensionDefinitionService.Field("groupLabel", "Group label", "TEXT", false, List.of(), "ENABLED", 0, null)));
        long legacyWorkspaceId = jdbc().queryForObject("SELECT id FROM platform_workspace.group_workspace WHERE group_workspace_key=?", Long.class, extensionWorkspaceKey);
        OrganizationCommandService commands = new OrganizationCommandService(jdbc(),
            (candidateWorkspaceId, groupWorkspaceKey) -> extensionWorkspaceId.equals(candidateWorkspaceId) && extensionWorkspaceKey.equals(groupWorkspaceKey),
            () -> NOW, definitions);
        PlatformExecutionContext context = new PlatformExecutionContext("organization-owner-test", "platform-admin", Instant.ofEpochMilli(NOW + 60_000L), "organization-owner-test");
        String idempotencyKey = "organization-extension-group-0001";

        CommercialGroupReadback initialized;
        CommercialGroupReadback replay;
        try (DatabaseOperationTracker.Scope ignored = DatabaseOperationTracker.open()) {
            initialized = commands.execute(context, extensionWorkspaceId, extensionWorkspaceKey, legacyWorkspaceId, idempotencyKey, "ORG-ROOT", "Organization root", Map.of("groupLabel", "\"Primary group\""), AuditActor.system());
            var phasesAfterFreshCommand = DatabaseOperationTracker.snapshot().phaseCheckpoints().stream().map(DatabaseOperationTracker.PhaseCheckpoint::phase).toList();
            assertTrue(phasesAfterFreshCommand.contains(DatabaseOperationTracker.Phase.OWNER_COMMAND_BEGIN));
            assertTrue(phasesAfterFreshCommand.contains(DatabaseOperationTracker.Phase.OWNER_COMMAND_END));
            int phaseCountAfterFreshCommand = phasesAfterFreshCommand.size();

            replay = commands.execute(context, extensionWorkspaceId, extensionWorkspaceKey, legacyWorkspaceId, idempotencyKey, "ORG-ROOT", "Organization root", Map.of("groupLabel", "\"Primary group\""), AuditActor.system());
            assertEquals(phaseCountAfterFreshCommand, DatabaseOperationTracker.snapshot().phaseCheckpoints().size());
        }

        assertEquals(initialized.id(), replay.id());
        assertEquals(NOW, initialized.createdAtEpochMillis());
        assertEquals(initialized.id(), jdbc().queryForObject("SELECT commercial_group_uuid FROM organization.commercial_group WHERE group_workspace_key=?", UUID.class, extensionWorkspaceKey));
        assertEquals(NOW, jdbc().queryForObject("SELECT created_at_epoch_millis FROM organization.commercial_group WHERE group_workspace_key=?", Long.class, extensionWorkspaceKey));
        assertEquals(Map.of("groupLabel", "\"Primary group\""), replay.extensionValues());
        assertEquals(1L, replay.extensionRuleRevision());
    }

    @Test void commercialGroupAuditJoinsTheWorkspaceOwnerForScopeAndNeverAssumesALocalWorkspaceColumn() {
        UUID auditWorkspaceId = UUID.randomUUID();
        String auditWorkspaceKey = "organization-audit-group";
        jdbc().update("INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, name_normalized, operations_title, status, revision, version, created_at_epoch_millis, updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, ?, 'Audit group', 'audit group', 'Audit group', 'ENABLED', 1, 1, ?, ?, ?)", auditWorkspaceId, auditWorkspaceKey, NOW, NOW, NOW);
        long legacyWorkspaceId = jdbc().queryForObject("SELECT id FROM platform_workspace.group_workspace WHERE group_workspace_key=?", Long.class, auditWorkspaceKey);
        OrganizationCommandService commands = new OrganizationCommandService(jdbc(),
            (candidateWorkspaceId, groupWorkspaceKey) -> auditWorkspaceId.equals(candidateWorkspaceId) && auditWorkspaceKey.equals(groupWorkspaceKey),
            () -> NOW, definitions);
        var initialized = commands.execute(new PlatformExecutionContext("organization-audit-test", "platform-admin", Instant.ofEpochMilli(NOW + 60_000L), "organization-audit-test"), auditWorkspaceId, auditWorkspaceKey, legacyWorkspaceId, "organization-audit-group-0001", "AUDIT-ROOT", "Audit root", Map.of(), AuditActor.system());
        jdbc().update("INSERT INTO organization.audit_event (id, workspace_uuid, group_workspace_key, entity_type, entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, 'GROUP_WORKSPACE', ?, 'SYSTEM', NULL, 'system', 'GROUP_WORKSPACE_RENAMED', ?, '[]'::jsonb)", UUID.randomUUID(), auditWorkspaceId, auditWorkspaceKey, String.valueOf(legacyWorkspaceId), NOW + 1L);
        OrganizationAuditHistoryService audit = new OrganizationAuditHistoryService(jdbc());

        var history = audit.readCommercialGroup(new AuditReadScope(auditWorkspaceId, auditWorkspaceKey), new AuditTarget("COMMERCIAL_GROUP", initialized.id().toString()), 1, 20);

        assertEquals(1L, history.total());
        assertEquals("COMMERCIAL_GROUP_INITIALIZED", history.items().getFirst().action());
        assertThrows(BusinessEntityService.OrganizationNotFoundException.class, () -> audit.readCommercialGroup(new AuditReadScope(UUID.randomUUID(), auditWorkspaceKey), new AuditTarget("COMMERCIAL_GROUP", initialized.id().toString()), 1, 20));
    }

    @Test void commercialGroupUpdateUsesCasExactReceiptAndTheSelectedGroupAuditStream() {
        UUID updateWorkspaceId = UUID.randomUUID();
        String updateWorkspaceKey = "organization-update-group";
        jdbc().update("INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, name_normalized, operations_title, status, revision, version, created_at_epoch_millis, updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, ?, 'Update group', 'update group', 'Update group', 'ENABLED', 1, 1, ?, ?, ?)", updateWorkspaceId, updateWorkspaceKey, NOW, NOW, NOW);
        definitions.replace(updateWorkspaceId, updateWorkspaceKey, "COMMERCIAL_GROUP", 0, List.of(new ExtensionDefinitionService.Field("groupLabel", "Group label", "TEXT", false, List.of(), "ENABLED", 0, null)));
        long legacyWorkspaceId = jdbc().queryForObject("SELECT id FROM platform_workspace.group_workspace WHERE group_workspace_key=?", Long.class, updateWorkspaceKey);
        OrganizationCommandService commands = new OrganizationCommandService(jdbc(), (candidateWorkspaceId, groupWorkspaceKey) -> updateWorkspaceId.equals(candidateWorkspaceId) && updateWorkspaceKey.equals(groupWorkspaceKey), () -> NOW + 10L, definitions);
        var initialized = commands.execute(new PlatformExecutionContext("organization-update-test", "platform-admin", Instant.ofEpochMilli(NOW + 60_000L), "organization-update-test"), updateWorkspaceId, updateWorkspaceKey, legacyWorkspaceId, "organization-update-init-0001", "UPDATE-ROOT", "Update root", Map.of("groupLabel", "\"Before\""), AuditActor.system());

        var updated = commands.execute(updateWorkspaceId, updateWorkspaceKey, "organization-update-command-0001", "UPDATE-ROOT-2", "Updated root", initialized.revision(), Map.of("groupLabel", "\"After\""), AuditActor.system());
        var replay = commands.execute(updateWorkspaceId, updateWorkspaceKey, "organization-update-command-0001", "UPDATE-ROOT-2", "Updated root", initialized.revision(), Map.of("groupLabel", "\"After\""), AuditActor.system());
        OrganizationAuditHistoryService audit = new OrganizationAuditHistoryService(jdbc());

        assertEquals("UPDATE-ROOT-2", updated.commercialGroupCode());
        assertEquals("Updated root", updated.commercialGroupName());
        assertEquals(Map.of("groupLabel", "\"After\""), updated.extensionValues());
        assertEquals(initialized.revision() + 1L, updated.revision());
        assertEquals(updated, replay);
        assertThrows(OrganizationHierarchyService.OrganizationConflictException.class, () -> commands.execute(updateWorkspaceId, updateWorkspaceKey, "organization-update-command-0002", "UPDATE-ROOT-3", "Conflict root", initialized.revision(), Map.of(), AuditActor.system()));
        var history = audit.readCommercialGroup(new AuditReadScope(updateWorkspaceId, updateWorkspaceKey), new AuditTarget("COMMERCIAL_GROUP", initialized.id().toString()), 1, 20);
        assertEquals(2L, history.total());
        assertTrue(history.items().stream().anyMatch(item -> "COMMERCIAL_GROUP_INITIALIZED".equals(item.action())));
        assertTrue(history.items().stream().anyMatch(item -> "COMMERCIAL_GROUP_UPDATED".equals(item.action())));
    }

    @Test void commercialGroupUpdateBindsTheOwnerGrantToItsFirstTargetRead() {
        UUID grantWorkspaceId = UUID.randomUUID();
        String grantWorkspaceKey = "organization-grant-group";
        jdbc().update("INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, name_normalized, operations_title, status, revision, version, created_at_epoch_millis, updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, ?, 'Grant group', 'grant group', 'Grant group', 'ENABLED', 1, 1, ?, ?, ?)", grantWorkspaceId, grantWorkspaceKey, NOW, NOW, NOW);
        long legacyWorkspaceId = jdbc().queryForObject("SELECT id FROM platform_workspace.group_workspace WHERE group_workspace_key=?", Long.class, grantWorkspaceKey);
        OrganizationCommandService commands = new OrganizationCommandService(jdbc(), (candidateWorkspaceId, groupWorkspaceKey) -> grantWorkspaceId.equals(candidateWorkspaceId) && grantWorkspaceKey.equals(groupWorkspaceKey), () -> NOW + 10L, definitions);
        var initialized = commands.execute(new PlatformExecutionContext("organization-grant-test", "platform-admin", Instant.ofEpochMilli(NOW + 60_000L), "organization-grant-test"), grantWorkspaceId, grantWorkspaceKey, legacyWorkspaceId, "organization-grant-init-0001", "GRANT-ROOT", "Grant root", Map.of(), AuditActor.system());
        var matchingGrant = new OperationsOwnerScopeGrant(grantWorkspaceId, grantWorkspaceKey, "REQ_UPDATE_OPERATIONS_COMMERCIAL_GROUP", "BC-ORG-GROUP-EDIT", "GROUP", initialized.id(), "GROUP", initialized.id(), List.of(initialized.id()));
        var updated = commands.execute(grantWorkspaceId, grantWorkspaceKey, "organization-grant-update-0001", "GRANT-ROOT-2", "Updated grant root", initialized.revision(), Map.of(), AuditActor.system(), matchingGrant);
        var wrongTargetGrant = new OperationsOwnerScopeGrant(grantWorkspaceId, grantWorkspaceKey, "REQ_UPDATE_OPERATIONS_COMMERCIAL_GROUP", "BC-ORG-GROUP-EDIT", "GROUP", UUID.randomUUID(), "GROUP", initialized.id(), List.of(initialized.id()));

        assertEquals("GRANT-ROOT-2", updated.commercialGroupCode());
        assertThrows(OrganizationCommandService.OrganizationCommandException.class, () -> commands.execute(grantWorkspaceId, grantWorkspaceKey, "organization-grant-update-0002", "GRANT-ROOT-3", "Rejected grant root", updated.revision(), Map.of(), AuditActor.system(), wrongTargetGrant));
        assertEquals("GRANT-ROOT-2", commands.requireCommercialGroup(grantWorkspaceKey).commercialGroupCode());
    }

    @Test void regionAndProjectExtensionValuesAreOwnedValidatedAndReceiptBacked() {
        var region = hierarchy.createRegion(workspaceId, "organization-test", "EXT-R", "Extension region", null, Map.of("regionLabel", "\"North\""), "organization-test-extension-region-0001", AuditActor.system());
        var regionReplay = hierarchy.createRegion(workspaceId, "organization-test", "EXT-R", "Extension region", null, Map.of("regionLabel", "\"North\""), "organization-test-extension-region-0001", AuditActor.system());
        assertEquals(region.id(), regionReplay.id());
        assertEquals(Map.of("regionLabel", "\"North\""), regionReplay.extensionValues());
        assertEquals(1L, regionReplay.extensionRuleRevision());

        var project = hierarchy.createProject(workspaceId, "organization-test", region.id(), "EXT-P", "Extension project", null, List.of("Plan"), Map.of("projectBudget", "100"), "organization-test-extension-project-0001", AuditActor.system());
        assertEquals(Map.of("projectBudget", "100"), project.extensionValues());
        var updated = hierarchy.update(workspaceId, "organization-test", region.id(), "EXT-R", "Extension region", null, null, List.of(), region.version(), Map.of("regionLabel", "\"South\""), "organization-test-extension-region-0002", AuditActor.system());
        assertEquals(Map.of("regionLabel", "\"South\""), updated.extensionValues());
        assertEquals("South", overview.detail(workspaceId, "organization-test", "HIERARCHY", region.id()).extensionFields().getFirst().value());
        assertEquals("100", overview.detail(workspaceId, "organization-test", "HIERARCHY", project.id()).extensionFields().getFirst().value());
        assertThrows(OrganizationHierarchyService.OrganizationValidationException.class, () -> hierarchy.createRegion(workspaceId, "organization-test", "EXT-BAD", "Bad extension", null, Map.of("regionLabel", "100"), "organization-test-extension-region-0003", AuditActor.system()));
    }

    @Test void hierarchyWritesBindTheirOwnerGrantBeforeReceiptReplay() {
        UUID groupId = UUID.randomUUID();
        OrganizationHierarchyService ownerHierarchy = new OrganizationHierarchyService(
            jdbc(), () -> NOW, new OrganizationHierarchyCommandReceiptService(jdbc(), () -> NOW),
            (candidateWorkspaceId, groupWorkspaceKey) -> workspaceId.equals(candidateWorkspaceId) && "organization-test".equals(groupWorkspaceKey),
            new CommercialGroupLookup() {
                @Override public UUID requireCommercialGroupRef(UUID candidateWorkspaceId, String groupWorkspaceKey) { return groupId; }
                @Override public boolean isEnterableCommercialGroup(UUID candidateWorkspaceId, String groupWorkspaceKey, UUID commercialGroupRef) { return groupId.equals(commercialGroupRef); }
                @Override public String describeCommercialGroup(UUID candidateWorkspaceId, String groupWorkspaceKey, UUID commercialGroupRef) { return "Group"; }
            }, definitions
        );
        AuditActor actor = AuditActor.system();
        var groupGrant = new OperationsOwnerScopeGrant(workspaceId, "organization-test", "REQ_CREATE_OPERATIONS_ORGANIZATION_REGION", "BC-ORG-REGION-CREATE", "GROUP", groupId, "GROUP", groupId, List.of(groupId));
        var region = ownerHierarchy.createRegion(workspaceId, "organization-test", "GRANT-R", "Grant region", null, Map.of(), "organization-hierarchy-grant-0001", actor, groupGrant);
        var wrongGroupGrant = new OperationsOwnerScopeGrant(workspaceId, "organization-test", "REQ_CREATE_OPERATIONS_ORGANIZATION_REGION", "BC-ORG-REGION-CREATE", "GROUP", UUID.randomUUID(), "GROUP", groupId, List.of(groupId));
        assertThrows(OrganizationHierarchyService.OrganizationAuthorizationException.class, () -> ownerHierarchy.createRegion(workspaceId, "organization-test", "GRANT-R", "Grant region", null, Map.of(), "organization-hierarchy-grant-0001", actor, wrongGroupGrant));
        assertThrows(OrganizationHierarchyService.OrganizationAuthorizationException.class, () -> ownerHierarchy.createRegion(workspaceId, "organization-test", "GRANT-R", "Grant region", null, Map.of(), "organization-hierarchy-grant-0001", actor, null));

        var regionGrant = new OperationsOwnerScopeGrant(workspaceId, "organization-test", "REQ_CREATE_OPERATIONS_ORGANIZATION_PROJECT", "BC-ORG-PROJECT-CREATE", "REGION", region.id(), "REGION", region.id(), List.of(groupId, region.id()));
        var project = ownerHierarchy.createProject(workspaceId, "organization-test", region.id(), "GRANT-P", "Grant project", null, List.of("Phase"), Map.of(), "organization-hierarchy-grant-0002", actor, regionGrant);
        var updateGrant = new OperationsOwnerScopeGrant(workspaceId, "organization-test", "ORG_NODE_EDIT", "BC-ORG-REGION-EDIT", "REGION", region.id(), "REGION", region.id(), List.of(groupId, region.id()));
        var updated = ownerHierarchy.update(workspaceId, "organization-test", region.id(), "GRANT-R", "Updated grant region", null, null, List.of(), region.version(), Map.of(), "organization-hierarchy-grant-0003", actor, updateGrant);
        var transitionGrant = new OperationsOwnerScopeGrant(workspaceId, "organization-test", "REQ_TRANSITION_OPERATIONS_ORGANIZATION_NODE_STATUS", "BC-ORG-REGION-STATUS", "REGION", updated.id(), "REGION", updated.id(), List.of(groupId, updated.id()));
        var transitioned = ownerHierarchy.transitionStatus(workspaceId, "organization-test", updated.id(), updated.version(), "DISABLED", "organization-hierarchy-grant-0004", actor, transitionGrant);

        assertEquals(project.id(), ownerHierarchy.requireNode(workspaceId, "organization-test", project.id(), "PROJECT").id());
        assertEquals("Updated grant region", updated.name());
        assertEquals("DISABLED", transitioned.status());
        var wrongNodeGrant = new OperationsOwnerScopeGrant(workspaceId, "organization-test", "ORG_NODE_EDIT", "BC-ORG-REGION-EDIT", "REGION", UUID.randomUUID(), "REGION", updated.id(), List.of(groupId, updated.id()));
        assertThrows(OrganizationHierarchyService.OrganizationAuthorizationException.class, () -> ownerHierarchy.update(workspaceId, "organization-test", updated.id(), "GRANT-R", "Rejected grant region", null, null, List.of(), transitioned.version(), Map.of(), "organization-hierarchy-grant-0005", actor, wrongNodeGrant));
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

    @Test void headCompanyAuthorizationGrantIsBoundBeforeReceiptReplay() {
        var brand = entities.createEntity("BRAND", workspaceId, "organization-test", "grant-brand", "Grant brand", null, null, Map.of());
        var head = entities.createEntity("HEAD_COMPANY", workspaceId, "organization-test", "grant-head", "Grant head", "Grant head", "91310000GRANT", Map.of());
        var matchingGrant = new OperationsOwnerScopeGrant(workspaceId, "organization-test", "REQ_ADD_OPERATIONS_ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION", "BC-ORG-HEAD-COMPANY-BRAND", "HEAD_COMPANY", head.id(), "HEAD_COMPANY", head.id(), List.of(head.id()));

        entities.addHeadCompanyBrandAuthorization(workspaceId, "organization-test", head.id(), brand.id(), "organization-grant-replay-0001", AuditActor.system(), matchingGrant);

        var mismatchedGrant = new OperationsOwnerScopeGrant(workspaceId, "organization-test", "REQ_ADD_OPERATIONS_ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION", "BC-ORG-HEAD-COMPANY-BRAND", "HEAD_COMPANY", UUID.randomUUID(), "HEAD_COMPANY", head.id(), List.of(head.id()));
        assertThrows(BusinessEntityService.OrganizationAuthorizationException.class, () -> entities.addHeadCompanyBrandAuthorization(workspaceId, "organization-test", head.id(), brand.id(), "organization-grant-replay-0001", AuditActor.system(), mismatchedGrant));
        assertThrows(BusinessEntityService.OrganizationAuthorizationException.class, () -> entities.addHeadCompanyBrandAuthorization(workspaceId, "organization-test", head.id(), brand.id(), "organization-grant-replay-0001", AuditActor.system(), null));
    }

    @Test void brandPageKeepsCandidatePredicateTotalAndSliceInsideTheOrganizationOwner() {
        entities.createEntity("BRAND", workspaceId, "organization-test", "owner-page-a", "Owner page alpha", null, null, Map.of());
        entities.createEntity("BRAND", workspaceId, "organization-test", "owner-page-b", "Owner page bravo", null, null, Map.of());
        entities.createEntity("BRAND", workspaceId, "organization-test", "owner-page-c", "Owner page charlie", null, null, Map.of());

        var result = entities.pageBrands(workspaceId, "organization-test", "Owner page", "ENABLED", "NAME", "ASC", 2, 1);

        assertEquals(3, result.total());
        assertEquals(2, result.page());
        assertEquals(1, result.pageSize());
        assertEquals(List.of("Owner page bravo"), result.items().stream().map(value -> value.name()).toList());
        var codeMatch = entities.pageBrands(workspaceId, "organization-test", "owner-page-b", "ENABLED", "NAME", "ASC", 1, 20);
        var normalizedCodeMatch = entities.pageBrands(workspaceId, "organization-test", "  OWNER-PAGE-B  ", "ENABLED", "NAME", "ASC", 1, 20);
        var noMatch = entities.pageBrands(workspaceId, "organization-test", "does-not-exist", "ENABLED", "NAME", "ASC", 1, 20);
        assertEquals(List.of("Owner page bravo"), codeMatch.items().stream().map(value -> value.name()).toList());
        assertEquals(List.of("Owner page bravo"), normalizedCodeMatch.items().stream().map(value -> value.name()).toList());
        assertEquals(0, noMatch.total());
        assertThrows(BusinessEntityService.OrganizationValidationException.class, () -> entities.pageBrands(workspaceId, "organization-test", null, null, "UNKNOWN", "ASC", 1, 20));
    }

    @Test void tenantAndHeadCompanyPagesKeepPredicateTotalAndSliceInsideTheOrganizationOwner() {
        entities.createEntity("TENANT", workspaceId, "organization-test", "owner-tenant-a", "Owner tenant alpha", "Owner tenant alpha", "91310000OWNER01", Map.of());
        entities.createEntity("TENANT", workspaceId, "organization-test", "owner-tenant-b", "Owner tenant bravo", "Owner tenant bravo", "91310000OWNER02", Map.of());
        entities.createEntity("HEAD_COMPANY", workspaceId, "organization-test", "owner-head-a", "Owner head alpha", "Owner head alpha", "91310000OWNER03", Map.of());
        entities.createEntity("HEAD_COMPANY", workspaceId, "organization-test", "owner-head-b", "Owner head bravo", "Owner head bravo", "91310000OWNER04", Map.of());

        var tenants = entities.pageEntities("TENANT", workspaceId, "organization-test", "Owner tenant", "owner-tenant", null, null, "ENABLED", "NAME", "ASC", 2, 1);
        var headCompanies = entities.pageEntities("HEAD_COMPANY", workspaceId, "organization-test", "Owner head", "owner-head", null, null, "ENABLED", "NAME", "ASC", 2, 1);
        var tenantLegalMatch = entities.pageEntities("TENANT", workspaceId, "organization-test", null, null, "Owner tenant bravo", "91310000OWNER02", "ENABLED", "NAME", "ASC", 1, 20);
        var headLegalMatch = entities.pageEntities("HEAD_COMPANY", workspaceId, "organization-test", null, null, "Owner head bravo", "91310000OWNER04", "ENABLED", "NAME", "ASC", 1, 20);

        assertEquals(2, tenants.total());
        assertEquals(List.of("Owner tenant bravo"), tenants.items().stream().map(value -> value.name()).toList());
        assertEquals(2, headCompanies.total());
        assertEquals(List.of("Owner head bravo"), headCompanies.items().stream().map(value -> value.name()).toList());
        assertEquals(List.of("Owner tenant bravo"), tenantLegalMatch.items().stream().map(value -> value.name()).toList());
        assertEquals(List.of("Owner head bravo"), headLegalMatch.items().stream().map(value -> value.name()).toList());
        assertThrows(BusinessEntityService.OrganizationValidationException.class, () -> entities.pageEntities("TENANT", workspaceId, "organization-test", null, null, null, null, null, "UNKNOWN", "ASC", 1, 20));
    }

    @Test void overviewPreservesHierarchyPathAndStoreReferences() {
        var region = hierarchy.create(workspaceId, "organization-test", "REGION", null, "OV-R", "Overview region");
        var project = hierarchy.create(workspaceId, "organization-test", "PROJECT", region.id(), "OV-P", "Overview project");
        hierarchy.replaceProjectPhaseNames(workspaceId, "organization-test", project.id(), project.version(), List.of("筹备", "营业"));
        var brand = entities.createEntity("BRAND", workspaceId, "organization-test", "overview-brand", "Overview brand", null, null, Map.of());
        var tenant = entities.createEntity("TENANT", workspaceId, "organization-test", "overview-tenant", "Overview tenant", "Overview tenant", "91310000OVERVIEW", Map.of());
        var store = entities.createStore(workspaceId, "organization-test", project.id(), tenant.id(), brand.id(), null, "overview-store", "Overview store", Map.of("floorArea", "100"));
        assertEquals(List.of("筹备", "营业"), hierarchy.requireNode(workspaceId, "organization-test", project.id(), "PROJECT").phaseNames());
        var hierarchyPage = overview.page(workspaceId, "organization-test", "HIERARCHY", 1, 50);
        assertTrue(hierarchyPage.items().stream().anyMatch(item -> item.id().equals(project.id()) && item.path().size() == 2));
        // The tree is rooted at the persisted commercial group. Keep this test independent of
        // JUnit method order instead of relying on the separate initialization test to run first.
        ensureCommercialGroupInitialized();
        var hierarchyTree = overview.hierarchyTree(workspaceId, "organization-test");
        var treeProject = hierarchyTree.regions().stream().flatMap(regionNode -> regionNode.children().stream()).filter(node -> node.id().equals(project.id())).findFirst().orElseThrow();
        assertEquals(List.of("筹备", "营业"), treeProject.phases());
        var storePage = overview.page(workspaceId, "organization-test", "STORE", 1, 50);
        var item = storePage.items().stream().filter(value -> value.id().equals(store.id())).findFirst().orElseThrow();
        assertEquals(project.id(), item.project().id());
        assertEquals(brand.id(), item.brand().id());
        assertEquals(tenant.id(), item.tenant().id());
    }

    @Test void hierarchyPageKeepsItsPredicateCountAndAncestryInsideTheHierarchyOwner() {
        var region = hierarchy.create(workspaceId, "organization-test", "REGION", null, "CANONICAL-R", "Canonical region");
        var project = hierarchy.create(workspaceId, "organization-test", "PROJECT", region.id(), "CANONICAL-P", "Canonical project");
        hierarchy.replaceProjectPhaseNames(workspaceId, "organization-test", project.id(), project.version(), List.of("一期"));

        var page = hierarchy.page(workspaceId, "organization-test", new OrganizationHierarchyService.HierarchyQuery("PROJECT", "Canonical", "CANONICAL", "ENABLED", project.id(), "NAME", "ASC", 1, 1));

        assertEquals(1, page.total());
        assertEquals(1, page.items().size());
        assertEquals(project.id(), page.items().getFirst().node().id());
        assertEquals(List.of(region.id(), project.id()), page.items().getFirst().path().stream().map(OrganizationHierarchyService.HierarchyPathNode::id).toList());
        assertEquals(List.of("一期"), page.items().getFirst().node().phaseNames());
        assertThrows(OrganizationHierarchyService.OrganizationValidationException.class, () -> hierarchy.page(workspaceId, "organization-test", new OrganizationHierarchyService.HierarchyQuery("GROUP", null, null, null, null, "NAME", "ASC", 1, 20)));
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

    @Test void roleCandidateLabelsAreOwnerFormattedLeafNamesWithoutHierarchyPaths() {
        UUID group = UUID.randomUUID();
        CommercialGroupLookup groups = new CommercialGroupLookup() {
            @Override public UUID requireCommercialGroupRef(UUID workspaceUuid, String key) { return group; }
            @Override public boolean isEnterableCommercialGroup(UUID workspaceUuid, String key, UUID commercialGroupRef) { return group.equals(commercialGroupRef); }
            @Override public String describeCommercialGroup(UUID workspaceUuid, String key, UUID commercialGroupRef) { return "Candidate group（CAND-G）"; }
        };
        OrganizationTaskPathService paths = new OrganizationTaskPathService(jdbc(), groups);
        var region = hierarchy.create(workspaceId, "organization-test", "REGION", null, "LABEL-R", "Label region");
        var project = hierarchy.create(workspaceId, "organization-test", "PROJECT", region.id(), "LABEL-P", "Label project");
        var tenant = entities.createEntity("TENANT", workspaceId, "organization-test", "label-tenant", "Label tenant", "Label tenant", "91310000LABELTENANT", Map.of());
        var brand = entities.createEntity("BRAND", workspaceId, "organization-test", "label-brand", "Label brand", null, null, Map.of());
        var head = entities.createEntity("HEAD_COMPANY", workspaceId, "organization-test", "label-head", "Label head", "Label head", "91310000LABELHEAD", Map.of());
        entities.addHeadCompanyBrandAuthorization(workspaceId, "organization-test", head.id(), brand.id(), "label-head-brand-authorization", AuditActor.system());
        var store = entities.createStore(workspaceId, "organization-test", project.id(), tenant.id(), brand.id(), head.id(), "label-store", "Label store", Map.of("floorArea", "100"));

        var labels = paths.describeTaskTargetLabels(workspaceId, "organization-test", List.of(
            new OrganizationTaskPathLookup.TaskPathRef("GROUP", group),
            new OrganizationTaskPathLookup.TaskPathRef("REGION", region.id()),
            new OrganizationTaskPathLookup.TaskPathRef("PROJECT", project.id()),
            new OrganizationTaskPathLookup.TaskPathRef("HEAD_COMPANY", head.id()),
            new OrganizationTaskPathLookup.TaskPathRef("STORE", store.id())
        ));

        assertEquals("Candidate group（CAND-G）", labels.get(new OrganizationTaskPathLookup.TaskPathRef("GROUP", group)));
        assertEquals("Label region（LABEL-R）", labels.get(new OrganizationTaskPathLookup.TaskPathRef("REGION", region.id())));
        assertEquals("Label project（LABEL-P）", labels.get(new OrganizationTaskPathLookup.TaskPathRef("PROJECT", project.id())));
        assertEquals("Label head（label-head）", labels.get(new OrganizationTaskPathLookup.TaskPathRef("HEAD_COMPANY", head.id())));
        assertEquals("Label store（label-store）", labels.get(new OrganizationTaskPathLookup.TaskPathRef("STORE", store.id())));
        assertFalse(labels.get(new OrganizationTaskPathLookup.TaskPathRef("STORE", store.id())).contains(" / "));
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

    @Test void persistedPresentationPathsRenderDisabledAssignmentsWithoutMakingThemEnabledAuthority() {
        UUID group = UUID.randomUUID();
        CommercialGroupLookup groups = new CommercialGroupLookup() {
            @Override public UUID requireCommercialGroupRef(UUID workspaceUuid, String key) { return group; }
            @Override public boolean isEnterableCommercialGroup(UUID workspaceUuid, String key, UUID commercialGroupRef) { return group.equals(commercialGroupRef); }
            @Override public String describeCommercialGroup(UUID workspaceUuid, String key, UUID commercialGroupRef) { return "Group"; }
        };
        OrganizationTaskPathService paths = new OrganizationTaskPathService(jdbc(), groups);
        var region = hierarchy.create(workspaceId, "organization-test", "REGION", null, "PERSISTED-R", "Persisted region");
        var project = hierarchy.create(workspaceId, "organization-test", "PROJECT", region.id(), "PERSISTED-P", "Persisted project");
        var headCompany = entities.createEntity("HEAD_COMPANY", workspaceId, "organization-test", "persisted-head", "Persisted head", "Persisted head", "91310000PERSISTEDHEAD", Map.of());
        var tenant = entities.createEntity("TENANT", workspaceId, "organization-test", "persisted-tenant", "Persisted tenant", "Persisted tenant", "91310000PERSISTED", Map.of());
        var brand = entities.createEntity("BRAND", workspaceId, "organization-test", "persisted-brand", "Persisted brand", null, null, Map.of());
        var store = entities.createStore(workspaceId, "organization-test", project.id(), tenant.id(), brand.id(), null, "persisted-store", "Persisted store", Map.of("floorArea", "100"));
        var disabled = entities.transitionEntityStatus("STORE", workspaceId, "organization-test", store.id(), "DISABLED", store.version());
        assertEquals("DISABLED", disabled.status());

        var ref = new OrganizationTaskPathLookup.TaskPathRef("STORE", store.id());
        assertThrows(OrganizationTaskPathService.TaskPathNotFoundException.class, () -> paths.requireTaskPaths(workspaceId, "organization-test", List.of(ref)));
        assertFalse(paths.availableTaskTargets(workspaceId, "organization-test", List.of(ref)).contains(ref));

        var displayed = paths.describePersistedTaskPaths(workspaceId, "organization-test", List.of(
            new OrganizationTaskPathLookup.TaskPathRef("GROUP", group),
            new OrganizationTaskPathLookup.TaskPathRef("REGION", region.id()),
            new OrganizationTaskPathLookup.TaskPathRef("PROJECT", project.id()),
            new OrganizationTaskPathLookup.TaskPathRef("HEAD_COMPANY", headCompany.id()),
            ref
        ));
        assertEquals("PERSISTED-R Persisted region / PERSISTED-P Persisted project / persisted-store Persisted store", displayed.get(ref).displayPath());
        assertEquals(List.of(group, region.id(), project.id(), store.id()), displayed.get(ref).ancestorIds());
        assertEquals("Organization root（ORG-ROOT）", displayed.get(new OrganizationTaskPathLookup.TaskPathRef("GROUP", group)).displayPath());
        assertEquals("PERSISTED-R Persisted region", displayed.get(new OrganizationTaskPathLookup.TaskPathRef("REGION", region.id())).displayPath());
        assertEquals("PERSISTED-R Persisted region / PERSISTED-P Persisted project", displayed.get(new OrganizationTaskPathLookup.TaskPathRef("PROJECT", project.id())).displayPath());
        assertEquals("persisted-head Persisted head", displayed.get(new OrganizationTaskPathLookup.TaskPathRef("HEAD_COMPANY", headCompany.id())).displayPath());
    }

    private static JdbcTemplate jdbc() { return new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())); }

    private static void ensureCommercialGroupInitialized() {
        long groupWorkspaceId = jdbc().queryForObject("SELECT id FROM platform_workspace.group_workspace WHERE group_workspace_key='organization-test'", Long.class);
        OrganizationCommandService commands = new OrganizationCommandService(jdbc(),
            (candidateWorkspaceId, groupWorkspaceKey) -> workspaceId.equals(candidateWorkspaceId) && "organization-test".equals(groupWorkspaceKey),
            () -> NOW);
        PlatformExecutionContext context = new PlatformExecutionContext("organization-owner-test", "platform-admin", Instant.ofEpochMilli(NOW + 60_000L), "organization-owner-test");
        commands.execute(context, workspaceId, "organization-test", groupWorkspaceId, "organization-test-commercial-group-0001", "ORG-ROOT", "Organization root", AuditActor.system());
    }

    @AfterAll static void cleanup() { if (flyway != null) flyway.clean(); }
}
