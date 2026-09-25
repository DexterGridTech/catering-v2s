package com.catering.v2s.organization.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.extension.api.ExtensionDefinitionLookup;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.BrandCreateCommand;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.BrandStatusCommand;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.BrandUpdateCommand;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.HeadCompanyBrandAuthorizationCommand;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.HeadCompanyBrandAuthorizationReadback;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.HeadCompanyCommandReadback;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.HeadCompanyCreateCommand;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.HeadCompanyStatusCommand;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.HeadCompanyUpdateCommand;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.TenantCreateCommand;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.TenantStatusCommand;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.TenantUpdateCommand;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OperationsStoreCommandApi;
import com.catering.v2s.organization.api.OperationsStoreCommandApi.CreateStoreCommand;
import com.catering.v2s.organization.api.OperationsStoreCommandApi.StoreStatusCommand;
import com.catering.v2s.organization.api.OperationsStoreCommandApi.UpdateStoreCommand;
import com.catering.v2s.organization.api.OrganizationEntityLookup;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.OrganizationNodeLookup;
import com.catering.v2s.organization.api.OrganizationOwnerApi;
import com.catering.v2s.organization.api.StoreAssignmentLookup;
import com.catering.v2s.organization.api.StoreContractLookup;
import com.catering.v2s.organization.api.StoreOperatingRuleGate;
import com.catering.v2s.organization.api.StoreOperatingRuleReadback;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Compatibility facade for the organization owner.
 *
 * <p>The public type remains the established owner boundary used by other modules, edge adapters and legacy tests.
 * Mutation facts and transactions live in the concrete owner services; task reads live in the read service. This facade
 * deliberately contains no JDBC, transaction policy or business-entity mutation logic.
 */
@Service
public class BusinessEntityService
        implements StoreAssignmentLookup,
                OrganizationEntityLookup,
                StoreContractLookup,
                CatalogScopeLookup,
                OperationsBusinessEntityCommandApi,
                OperationsStoreCommandApi,
                OrganizationOwnerApi,
                StoreOperatingRuleGate {
    private final BusinessBrandService brand;
    private final BusinessTenantService tenant;
    private final HeadCompanyService headCompany;
    private final StoreService store;
    private final BusinessEntityCommandRouter commandRouter;
    private final BusinessEntityTaskReadService reads;

    @Autowired
    public BusinessEntityService(
            BusinessBrandService brand,
            BusinessTenantService tenant,
            HeadCompanyService headCompany,
            StoreService store,
            BusinessEntityCommandRouter commandRouter,
            BusinessEntityTaskReadService reads) {
        this.brand = brand;
        this.tenant = tenant;
        this.headCompany = headCompany;
        this.store = store;
        this.commandRouter = commandRouter;
        this.reads = reads;
    }

    /** Legacy constructor retained for unit tests and lightweight owner clients. */
    public BusinessEntityService(
            JdbcTemplate jdbc,
            com.catering.v2s.platform.foundation.time.TimeProvider time,
            ExtensionDefinitionLookup definitions,
            OrganizationNodeLookup nodes) {
        this(dependencies(jdbc, time, definitions, nodes, null));
    }

    /** Legacy constructor retained for unit tests that provide a shared receipt service. */
    public BusinessEntityService(
            JdbcTemplate jdbc,
            com.catering.v2s.platform.foundation.time.TimeProvider time,
            ExtensionDefinitionLookup definitions,
            OrganizationNodeLookup nodes,
            BusinessEntityCommandReceiptService receipts) {
        this(dependencies(jdbc, time, definitions, nodes, receipts));
    }

    private BusinessEntityService(DependencyBundle dependencies) {
        this(
                dependencies.brand(),
                dependencies.tenant(),
                dependencies.headCompany(),
                dependencies.store(),
                dependencies.commandRouter(),
                dependencies.reads());
    }

    private static DependencyBundle dependencies(
            JdbcTemplate jdbc,
            com.catering.v2s.platform.foundation.time.TimeProvider time,
            ExtensionDefinitionLookup definitions,
            OrganizationNodeLookup nodes,
            BusinessEntityCommandReceiptService suppliedReceipts) {
        BusinessEntityCommandReceiptService receipts =
                suppliedReceipts == null ? new BusinessEntityCommandReceiptService(jdbc, time) : suppliedReceipts;
        BusinessEntityTaskReadService reads = new BusinessEntityTaskReadService(jdbc, definitions, nodes);
        BusinessBrandService brand = new BusinessBrandService(jdbc, time, definitions, receipts, reads);
        BusinessTenantService tenant = new BusinessTenantService(jdbc, time, definitions, receipts, reads);
        HeadCompanyService headCompany = new HeadCompanyService(jdbc, time, definitions, receipts, reads);
        StoreService store = new StoreService(jdbc, time, definitions, receipts, reads);
        return new DependencyBundle(
                brand,
                tenant,
                headCompany,
                store,
                new BusinessEntityCommandRouter(brand, tenant, headCompany, store),
                reads);
    }

    @Override
    public OrganizationEntityReadback createBrand(BrandCreateCommand command) {
        return brand.createBrand(command);
    }

    @Override
    public OrganizationEntityReadback updateBrand(BrandUpdateCommand command) {
        return brand.updateBrand(command);
    }

    @Override
    public OrganizationEntityReadback createTenant(TenantCreateCommand command) {
        return tenant.createTenant(command);
    }

    @Override
    public OrganizationEntityReadback updateTenant(TenantUpdateCommand command) {
        return tenant.updateTenant(command);
    }

    @Override
    public HeadCompanyCommandReadback createHeadCompany(HeadCompanyCreateCommand command) {
        return headCompany.createHeadCompany(command);
    }

    @Override
    public HeadCompanyCommandReadback updateHeadCompany(HeadCompanyUpdateCommand command) {
        return headCompany.updateHeadCompany(command);
    }

    @Override
    public HeadCompanyCommandReadback transitionHeadCompanyStatus(HeadCompanyStatusCommand command) {
        return headCompany.transitionHeadCompanyStatus(command);
    }

    @Override
    public OrganizationEntityReadback transitionBrandStatus(BrandStatusCommand command) {
        return brand.transitionBrandStatus(command);
    }

    @Override
    public OrganizationEntityReadback transitionTenantStatus(TenantStatusCommand command) {
        return tenant.transitionTenantStatus(command);
    }

    @Override
    public HeadCompanyBrandAuthorizationReadback addHeadCompanyBrandAuthorization(
            HeadCompanyBrandAuthorizationCommand command) {
        return headCompany.addHeadCompanyBrandAuthorization(command);
    }

    @Override
    public HeadCompanyBrandAuthorizationReadback removeHeadCompanyBrandAuthorization(
            HeadCompanyBrandAuthorizationCommand command) {
        return headCompany.removeHeadCompanyBrandAuthorization(command);
    }

    @Override
    public OrganizationEntityReadback createStore(CreateStoreCommand command) {
        return store.createStore(command);
    }

    @Override
    public OrganizationEntityReadback updateStore(UpdateStoreCommand command) {
        return store.updateStore(command);
    }

    @Override
    public OrganizationEntityReadback transitionStoreStatus(StoreStatusCommand command) {
        return store.transitionStoreStatus(command);
    }

    public OrganizationEntityReadback createEntity(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String legalName,
            String creditCode,
            Map<String, String> extensionValues) {
        return createEntity(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                code,
                name,
                legalName,
                creditCode,
                null,
                null,
                extensionValues);
    }

    public OrganizationEntityReadback createEntity(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            Map<String, String> extensionValues) {
        return createEntity(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                code,
                name,
                legalName,
                creditCode,
                alias,
                remark,
                extensionValues,
                AuditActor.system());
    }

    public OrganizationEntityReadback createEntity(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            Map<String, String> extensionValues,
            AuditActor actor) {
        return commandRouter.createEntity(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                code,
                name,
                legalName,
                creditCode,
                alias,
                remark,
                extensionValues,
                null,
                actor,
                null);
    }

    public OrganizationEntityReadback createEntity(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            Map<String, String> extensionValues,
            String idempotencyKey) {
        return createEntity(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                code,
                name,
                legalName,
                creditCode,
                alias,
                remark,
                extensionValues,
                idempotencyKey,
                AuditActor.system());
    }

    public OrganizationEntityReadback createEntity(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor) {
        return commandRouter.createEntity(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                code,
                name,
                legalName,
                creditCode,
                alias,
                remark,
                extensionValues,
                idempotencyKey,
                actor,
                null);
    }

    public OrganizationEntityReadback createEntity(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        return commandRouter.createEntity(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                code,
                name,
                legalName,
                creditCode,
                alias,
                remark,
                extensionValues,
                idempotencyKey,
                actor,
                ownerScopeGrant);
    }

    public OrganizationEntityReadback updateEntity(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            long expectedVersion,
            Map<String, String> extensionValues) {
        return updateEntity(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                id,
                code,
                name,
                legalName,
                creditCode,
                alias,
                remark,
                expectedVersion,
                extensionValues,
                AuditActor.system());
    }

    public OrganizationEntityReadback updateEntity(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            long expectedVersion,
            Map<String, String> extensionValues,
            AuditActor actor) {
        return commandRouter.updateEntity(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                id,
                code,
                name,
                legalName,
                creditCode,
                alias,
                remark,
                expectedVersion,
                extensionValues,
                null,
                actor,
                null);
    }

    public OrganizationEntityReadback updateEntity(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            long expectedVersion,
            Map<String, String> extensionValues,
            String idempotencyKey) {
        return updateEntity(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                id,
                code,
                name,
                legalName,
                creditCode,
                alias,
                remark,
                expectedVersion,
                extensionValues,
                idempotencyKey,
                AuditActor.system());
    }

    public OrganizationEntityReadback updateEntity(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            long expectedVersion,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor) {
        return commandRouter.updateEntity(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                id,
                code,
                name,
                legalName,
                creditCode,
                alias,
                remark,
                expectedVersion,
                extensionValues,
                idempotencyKey,
                actor,
                null);
    }

    public OrganizationEntityReadback updateEntity(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            long expectedVersion,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        return commandRouter.updateEntity(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                id,
                code,
                name,
                legalName,
                creditCode,
                alias,
                remark,
                expectedVersion,
                extensionValues,
                idempotencyKey,
                actor,
                ownerScopeGrant);
    }

    public OrganizationEntityReadback transitionEntityStatus(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String status,
            long expectedVersion) {
        return transitionEntityStatus(
                entityType, workspaceUuid, groupWorkspaceKey, id, status, expectedVersion, AuditActor.system());
    }

    public OrganizationEntityReadback transitionEntityStatus(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String status,
            long expectedVersion,
            AuditActor actor) {
        return commandRouter.transitionEntityStatus(
                entityType, workspaceUuid, groupWorkspaceKey, id, status, expectedVersion, null, actor, null);
    }

    public OrganizationEntityReadback transitionEntityStatus(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String status,
            long expectedVersion,
            String idempotencyKey) {
        return transitionEntityStatus(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                id,
                status,
                expectedVersion,
                idempotencyKey,
                AuditActor.system());
    }

    public OrganizationEntityReadback transitionEntityStatus(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String status,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor) {
        return commandRouter.transitionEntityStatus(
                entityType, workspaceUuid, groupWorkspaceKey, id, status, expectedVersion, idempotencyKey, actor, null);
    }

    public OrganizationEntityReadback transitionEntityStatus(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String status,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        return commandRouter.transitionEntityStatus(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                id,
                status,
                expectedVersion,
                idempotencyKey,
                actor,
                ownerScopeGrant);
    }

    public OrganizationEntityReadback createStore(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            Map<String, String> extensionValues) {
        return createStore(
                workspaceUuid,
                groupWorkspaceKey,
                projectId,
                tenantId,
                brandId,
                headCompanyId,
                code,
                name,
                null,
                extensionValues);
    }

    public OrganizationEntityReadback createStore(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            Map<String, String> extensionValues) {
        return createStore(
                workspaceUuid,
                groupWorkspaceKey,
                projectId,
                tenantId,
                brandId,
                headCompanyId,
                code,
                name,
                notes,
                extensionValues,
                AuditActor.system());
    }

    public OrganizationEntityReadback createStore(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            Map<String, String> extensionValues,
            AuditActor actor) {
        return store.createStore(
                workspaceUuid,
                groupWorkspaceKey,
                projectId,
                tenantId,
                brandId,
                headCompanyId,
                code,
                name,
                notes,
                extensionValues,
                null,
                actor,
                null);
    }

    public OrganizationEntityReadback createStoreWithOperatingRuleSwitches(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            Map<String, String> extensionValues,
            Map<String, ?> operatingRuleSwitches) {
        return store.createStoreWithOperatingRuleSwitches(
                workspaceUuid,
                groupWorkspaceKey,
                projectId,
                tenantId,
                brandId,
                headCompanyId,
                code,
                name,
                notes,
                extensionValues,
                null,
                AuditActor.system(),
                null,
                operatingRuleSwitches);
    }

    public OrganizationEntityReadback createStore(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            Map<String, String> extensionValues,
            String idempotencyKey) {
        return createStore(
                workspaceUuid,
                groupWorkspaceKey,
                projectId,
                tenantId,
                brandId,
                headCompanyId,
                code,
                name,
                notes,
                extensionValues,
                idempotencyKey,
                AuditActor.system());
    }

    public OrganizationEntityReadback createStore(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor) {
        return store.createStore(
                workspaceUuid,
                groupWorkspaceKey,
                projectId,
                tenantId,
                brandId,
                headCompanyId,
                code,
                name,
                notes,
                extensionValues,
                idempotencyKey,
                actor,
                null);
    }

    public OrganizationEntityReadback createStore(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        return store.createStore(
                workspaceUuid,
                groupWorkspaceKey,
                projectId,
                tenantId,
                brandId,
                headCompanyId,
                code,
                name,
                notes,
                extensionValues,
                idempotencyKey,
                actor,
                ownerScopeGrant);
    }

    public OrganizationEntityReadback updateStore(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            long expectedVersion,
            Map<String, String> extensionValues) {
        return updateStore(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                projectId,
                tenantId,
                brandId,
                headCompanyId,
                code,
                name,
                notes,
                expectedVersion,
                extensionValues,
                AuditActor.system());
    }

    public OrganizationEntityReadback updateStore(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            long expectedVersion,
            Map<String, String> extensionValues,
            AuditActor actor) {
        return store.updateStore(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                projectId,
                tenantId,
                brandId,
                headCompanyId,
                code,
                name,
                notes,
                expectedVersion,
                extensionValues,
                null,
                actor,
                null);
    }

    public OrganizationEntityReadback updateStore(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            long expectedVersion,
            Map<String, String> extensionValues,
            String idempotencyKey) {
        return updateStore(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                projectId,
                tenantId,
                brandId,
                headCompanyId,
                code,
                name,
                notes,
                expectedVersion,
                extensionValues,
                idempotencyKey,
                AuditActor.system());
    }

    public OrganizationEntityReadback updateStore(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            long expectedVersion,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor) {
        return store.updateStore(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                projectId,
                tenantId,
                brandId,
                headCompanyId,
                code,
                name,
                notes,
                expectedVersion,
                extensionValues,
                idempotencyKey,
                actor,
                null);
    }

    public OrganizationEntityReadback updateStore(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            long expectedVersion,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        return store.updateStore(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                projectId,
                tenantId,
                brandId,
                headCompanyId,
                code,
                name,
                notes,
                expectedVersion,
                extensionValues,
                idempotencyKey,
                actor,
                ownerScopeGrant);
    }

    public BusinessEntityCommandReceiptService.BrandAuthorizationAcknowledgement addHeadCompanyBrandAuthorization(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID headCompanyId,
            UUID brandId,
            String idempotencyKey,
            AuditActor actor) {
        return headCompany.addHeadCompanyBrandAuthorization(
                workspaceUuid, groupWorkspaceKey, headCompanyId, brandId, idempotencyKey, actor);
    }

    public BusinessEntityCommandReceiptService.BrandAuthorizationAcknowledgement addHeadCompanyBrandAuthorization(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID headCompanyId,
            UUID brandId,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        return headCompany.addHeadCompanyBrandAuthorization(
                workspaceUuid, groupWorkspaceKey, headCompanyId, brandId, idempotencyKey, actor, ownerScopeGrant);
    }

    public BusinessEntityCommandReceiptService.BrandAuthorizationAcknowledgement removeHeadCompanyBrandAuthorization(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID headCompanyId,
            UUID brandId,
            String idempotencyKey,
            AuditActor actor) {
        return headCompany.removeHeadCompanyBrandAuthorization(
                workspaceUuid, groupWorkspaceKey, headCompanyId, brandId, idempotencyKey, actor);
    }

    public BusinessEntityCommandReceiptService.BrandAuthorizationAcknowledgement removeHeadCompanyBrandAuthorization(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID headCompanyId,
            UUID brandId,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        return headCompany.removeHeadCompanyBrandAuthorization(
                workspaceUuid, groupWorkspaceKey, headCompanyId, brandId, idempotencyKey, actor, ownerScopeGrant);
    }

    @Override
    public boolean isEnterableStore(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return reads.isEnterableStore(workspaceUuid, groupWorkspaceKey, storeId);
    }

    @Override
    public OrganizationOwnerApi.SalesMenuStoreJudgment requireSalesMenuStore(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef) {
        return reads.requireSalesMenuStore(workspaceUuid, groupWorkspaceKey, storeRef);
    }

    @Override
    public StoreOperatingRuleReadback requireStoreOperatingRuleSwitches(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return store.requireStoreOperatingRuleSwitches(workspaceUuid, groupWorkspaceKey, storeId);
    }

    @Override
    public Map<UUID, StoreOperatingRuleReadback> requireStoreOperatingRuleSwitches(
            UUID workspaceUuid, String groupWorkspaceKey, List<UUID> storeIds) {
        return store.requireStoreOperatingRuleSwitches(workspaceUuid, groupWorkspaceKey, storeIds);
    }

    @Override
    public void requireCatalogManagementForStoreTarget(
            UUID workspaceUuid, String groupWorkspaceKey, String targetType, UUID storeId) {
        requireStoreOperatingRuleForStoreTarget(
                workspaceUuid, groupWorkspaceKey, targetType, storeId, "catalogManagementEnabled");
    }

    @Override
    public void requireStoreOperatingRuleForStoreTarget(
            UUID workspaceUuid, String groupWorkspaceKey, String targetType, UUID storeId, String ruleKey) {
        if (!com.catering.v2s.platform.foundation.contract.ServiceNodeTypes.STORE.equals(targetType)
                || workspaceUuid == null
                || groupWorkspaceKey == null
                || groupWorkspaceKey.isBlank()
                || storeId == null
                || ruleKey == null
                || ruleKey.isBlank()) {
            throw new StoreOperatingRuleGate.CatalogManagementDisabledException(
                    StoreOperatingRuleGate.CatalogManagementDisabledException.Reason.TARGET_NOT_STORE);
        }
        StoreOperatingRuleReadback readback;
        try {
            readback = store.requireStoreOperatingRuleSwitches(workspaceUuid, groupWorkspaceKey, storeId);
        } catch (RuntimeException failure) {
            // A missing or malformed owner fact must never turn into an allow. Preserve the cause for the structured
            // edge diagnostic while exposing the same closed capability problem to the caller.
            throw new StoreOperatingRuleGate.CatalogManagementDisabledException(
                    StoreOperatingRuleGate.CatalogManagementDisabledException.Reason.STORE_READ_FAILED,
                    Sha256Hex.digest(storeId.toString()),
                    failure);
        }
        if (!Boolean.TRUE.equals(readback.values().get(ruleKey))) {
            throw new StoreOperatingRuleGate.CatalogManagementDisabledException(
                    StoreOperatingRuleGate.CatalogManagementDisabledException.Reason.DISABLED,
                    Sha256Hex.digest(storeId.toString()),
                    null);
        }
    }

    @Override
    public CatalogScopeLookup.CatalogBrandJudgment resolveCatalogBrand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeType,
            UUID dataNodeId,
            CatalogScopeLookup.CatalogBrandSelection selection) {
        return reads.resolveCatalogBrand(workspaceUuid, groupWorkspaceKey, dataNodeType, dataNodeId, selection);
    }

    @Override
    public void requireCatalogCopySource(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetDataNodeType,
            UUID targetDataNodeId,
            UUID sourceDataNodeId,
            String brandRef) {
        reads.requireCatalogCopySource(
                workspaceUuid, groupWorkspaceKey, targetDataNodeType, targetDataNodeId, sourceDataNodeId, brandRef);
    }

    @Override
    public UUID resolveCatalogCopySource(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetDataNodeType,
            UUID targetDataNodeId,
            String brandRef) {
        return reads.resolveCatalogCopySource(
                workspaceUuid, groupWorkspaceKey, targetDataNodeType, targetDataNodeId, brandRef);
    }

    @Override
    public boolean isEnterableEntity(UUID workspaceUuid, String groupWorkspaceKey, String entityType, UUID entityId) {
        return reads.isEnterableEntity(workspaceUuid, groupWorkspaceKey, entityType, entityId);
    }

    @Override
    public String describeEntityPath(UUID workspaceUuid, String groupWorkspaceKey, String entityType, UUID entityId) {
        return reads.describeEntityPath(workspaceUuid, groupWorkspaceKey, entityType, entityId);
    }

    @Override
    public StoreContractContext requireStoreContractContext(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return reads.requireStoreContractContext(workspaceUuid, groupWorkspaceKey, storeId);
    }

    @Override
    public StoreContractContext requireStoreContractContextForCreate(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return reads.requireStoreContractContextForCreate(workspaceUuid, groupWorkspaceKey, storeId);
    }

    public OrganizationEntityReadback requireEntity(
            String entityType, UUID workspaceUuid, String groupWorkspaceKey, UUID id) {
        return reads.requireEntity(entityType, workspaceUuid, groupWorkspaceKey, id);
    }

    public UUID requireCommercialGroupId(UUID workspaceUuid, String groupWorkspaceKey) {
        return reads.requireCommercialGroupId(workspaceUuid, groupWorkspaceKey);
    }

    public UUID requireProjectId(UUID workspaceUuid, String groupWorkspaceKey, UUID projectId) {
        return reads.requireProjectId(workspaceUuid, groupWorkspaceKey, projectId);
    }

    public UUID requireStoreProjectId(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return reads.requireStoreProjectId(workspaceUuid, groupWorkspaceKey, storeId);
    }

    public StoreUpdateFacts readStoreUpdateFacts(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        BusinessEntityTaskReadService.StoreUpdateFacts facts =
                reads.readStoreUpdateFacts(workspaceUuid, groupWorkspaceKey, storeId);
        return new StoreUpdateFacts(facts.projectId(), facts.tenantId(), facts.brandId(), facts.code());
    }

    public List<OrganizationEntityReadback> authorizedBrands(
            UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId) {
        return reads.authorizedBrands(workspaceUuid, groupWorkspaceKey, headCompanyId);
    }

    public Map<UUID, List<OrganizationEntityReadback>> authorizedBrandsByHeadCompanyIds(
            UUID workspaceUuid, String groupWorkspaceKey, List<UUID> requestedHeadCompanyIds) {
        return reads.authorizedBrandsByHeadCompanyIds(workspaceUuid, groupWorkspaceKey, requestedHeadCompanyIds);
    }

    public List<HeadCompanyBrandAuthorization> authorizedBrandAuthorizations(
            UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId) {
        return reads.authorizedBrandAuthorizations(workspaceUuid, groupWorkspaceKey, headCompanyId);
    }

    public List<OrganizationEntityReadback> listEntities(
            String entityType, UUID workspaceUuid, String groupWorkspaceKey) {
        return reads.listEntities(entityType, workspaceUuid, groupWorkspaceKey);
    }

    public BrandPage pageBrands(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String queryText,
            String status,
            String sort,
            String direction,
            int page,
            int pageSize) {
        return reads.pageBrands(workspaceUuid, groupWorkspaceKey, queryText, status, sort, direction, page, pageSize);
    }

    public BrandPage pageBrands(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String queryText,
            String status,
            String sort,
            String direction,
            int page,
            int pageSize,
            String extensionFilters,
            String definitionRevision) {
        return reads.pageBrands(
                workspaceUuid,
                groupWorkspaceKey,
                queryText,
                status,
                sort,
                direction,
                page,
                pageSize,
                extensionFilters,
                definitionRevision);
    }

    public EntityPage pageEntities(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String name,
            String code,
            String legalName,
            String unifiedSocialCreditCode,
            String status,
            String sort,
            String direction,
            int page,
            int pageSize) {
        return reads.pageEntities(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                name,
                code,
                legalName,
                unifiedSocialCreditCode,
                status,
                sort,
                direction,
                page,
                pageSize);
    }

    public EntityPage pageEntities(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String name,
            String code,
            String legalName,
            String unifiedSocialCreditCode,
            String status,
            String sort,
            String direction,
            int page,
            int pageSize,
            String extensionFilters,
            String definitionRevision) {
        return reads.pageEntities(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                name,
                code,
                legalName,
                unifiedSocialCreditCode,
                status,
                sort,
                direction,
                page,
                pageSize,
                extensionFilters,
                definitionRevision);
    }

    public BusinessEntityPage pageBusinessEntities(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String entityType,
            String name,
            String code,
            String legalName,
            String unifiedSocialCreditCode,
            String status,
            String sort,
            String direction,
            int page,
            int pageSize) {
        return reads.pageBusinessEntities(
                workspaceUuid,
                groupWorkspaceKey,
                entityType,
                name,
                code,
                legalName,
                unifiedSocialCreditCode,
                status,
                sort,
                direction,
                page,
                pageSize);
    }

    public BusinessEntityPage pageBusinessEntities(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String entityType,
            String name,
            String code,
            String legalName,
            String unifiedSocialCreditCode,
            String status,
            String sort,
            String direction,
            int page,
            int pageSize,
            String extensionFilters,
            String definitionRevision) {
        return reads.pageBusinessEntities(
                workspaceUuid,
                groupWorkspaceKey,
                entityType,
                name,
                code,
                legalName,
                unifiedSocialCreditCode,
                status,
                sort,
                direction,
                page,
                pageSize,
                extensionFilters,
                definitionRevision);
    }

    public BusinessEntityPageItem requireBusinessEntity(UUID workspaceUuid, String groupWorkspaceKey, UUID entityId) {
        return reads.requireBusinessEntity(workspaceUuid, groupWorkspaceKey, entityId);
    }

    public Map<UUID, OrganizationEntityReadback> requireEntities(
            String entityType, UUID workspaceUuid, String groupWorkspaceKey, List<UUID> requestedIds) {
        return reads.requireEntities(entityType, workspaceUuid, groupWorkspaceKey, requestedIds);
    }

    public record StoreUpdateFacts(UUID projectId, UUID tenantId, UUID brandId, String code) {}

    public record HeadCompanyBrandAuthorization(UUID brandId, long authorizedAtEpochMillis) {}

    public record BrandPage(
            List<OrganizationEntityReadback> items, long total, int page, int pageSize, Long definitionRevision) {
        public BrandPage(List<OrganizationEntityReadback> items, long total, int page, int pageSize) {
            this(items, total, page, pageSize, null);
        }
    }

    public record EntityPage(
            List<OrganizationEntityReadback> items, long total, int page, int pageSize, Long definitionRevision) {
        public EntityPage(List<OrganizationEntityReadback> items, long total, int page, int pageSize) {
            this(items, total, page, pageSize, null);
        }
    }

    public record BusinessEntityPageItem(String entityType, OrganizationEntityReadback entity) {}

    public record BusinessEntityPage(
            List<BusinessEntityPageItem> items, long total, int page, int pageSize, Long definitionRevision) {
        public BusinessEntityPage(List<BusinessEntityPageItem> items, long total, int page, int pageSize) {
            this(items, total, page, pageSize, null);
        }
    }

    public static class OrganizationNotFoundException extends RuntimeException {
        public OrganizationNotFoundException() {}

        public OrganizationNotFoundException(Throwable cause) {
            super(cause);
        }
    }

    public static final class OrganizationDuplicateException extends RuntimeException {
        public OrganizationDuplicateException() {}

        public OrganizationDuplicateException(Throwable cause) {
            super(cause);
        }
    }

    public static final class OrganizationCodeConflictException extends RuntimeException {}

    public static final class OrganizationNameConflictException extends RuntimeException {}

    public static class OrganizationConflictException extends RuntimeException {
        public OrganizationConflictException() {}

        public OrganizationConflictException(Throwable cause) {
            super(cause);
        }
    }

    public static final class HeadCompanyBrandAuthorizationInUseException extends OrganizationConflictException {
        public HeadCompanyBrandAuthorizationInUseException() {}

        public HeadCompanyBrandAuthorizationInUseException(Throwable cause) {
            super(cause);
        }
    }

    public static final class HeadCompanyBrandAuthorizationNotFoundException extends OrganizationNotFoundException {}

    public static class OrganizationValidationException extends RuntimeException {
        public OrganizationValidationException() {}

        public OrganizationValidationException(Throwable cause) {
            super(cause);
        }
    }

    public static final class OrganizationOperatingRuleValidationException extends OrganizationValidationException {
        public OrganizationOperatingRuleValidationException(Throwable cause) {
            super(cause);
        }
    }

    public static final class OrganizationAuthorizationException extends RuntimeException {}

    private record DependencyBundle(
            BusinessBrandService brand,
            BusinessTenantService tenant,
            HeadCompanyService headCompany,
            StoreService store,
            BusinessEntityCommandRouter commandRouter,
            BusinessEntityTaskReadService reads) {}
}
