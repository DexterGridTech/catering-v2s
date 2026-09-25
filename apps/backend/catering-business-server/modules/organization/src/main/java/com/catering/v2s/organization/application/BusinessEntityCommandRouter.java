package com.catering.v2s.organization.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.api.BusinessEntityTypes;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;

/** Closed-set generic organization command adapter; owner facts remain in the target beans. */
@Service
public class BusinessEntityCommandRouter {
    private final BusinessBrandService brand;
    private final BusinessTenantService tenant;
    private final HeadCompanyService headCompany;
    private final StoreService store;

    public BusinessEntityCommandRouter(
            BusinessBrandService brand,
            BusinessTenantService tenant,
            HeadCompanyService headCompany,
            StoreService store) {
        this.brand = brand;
        this.tenant = tenant;
        this.headCompany = headCompany;
        this.store = store;
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
        return switch (normalize(entityType)) {
            case BusinessEntityTypes.BRAND -> brand.createEntity(
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
            case BusinessEntityTypes.TENANT -> tenant.createEntity(
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
            case BusinessEntityTypes.HEAD_COMPANY -> headCompany.createEntity(
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
            default -> throw new BusinessEntityService.OrganizationValidationException();
        };
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
        return switch (normalize(entityType)) {
            case BusinessEntityTypes.BRAND -> brand.updateEntity(
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
            case BusinessEntityTypes.TENANT -> tenant.updateEntity(
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
            case BusinessEntityTypes.HEAD_COMPANY -> headCompany.updateEntity(
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
            default -> throw new BusinessEntityService.OrganizationValidationException();
        };
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
        return switch (normalizeIncludingStore(entityType)) {
            case BusinessEntityTypes.BRAND -> brand.transitionEntityStatus(
                    entityType,
                    workspaceUuid,
                    groupWorkspaceKey,
                    id,
                    status,
                    expectedVersion,
                    idempotencyKey,
                    actor,
                    ownerScopeGrant);
            case BusinessEntityTypes.TENANT -> tenant.transitionEntityStatus(
                    entityType,
                    workspaceUuid,
                    groupWorkspaceKey,
                    id,
                    status,
                    expectedVersion,
                    idempotencyKey,
                    actor,
                    ownerScopeGrant);
            case BusinessEntityTypes.HEAD_COMPANY -> headCompany.transitionEntityStatus(
                    entityType,
                    workspaceUuid,
                    groupWorkspaceKey,
                    id,
                    status,
                    expectedVersion,
                    idempotencyKey,
                    actor,
                    ownerScopeGrant);
            case BusinessEntityTypes.STORE -> store.transitionEntityStatus(
                    entityType,
                    workspaceUuid,
                    groupWorkspaceKey,
                    id,
                    status,
                    expectedVersion,
                    idempotencyKey,
                    actor,
                    ownerScopeGrant);
            default -> throw new BusinessEntityService.OrganizationValidationException();
        };
    }

    private static String normalize(String entityType) {
        String value = Objects.requireNonNullElse(entityType, "").toUpperCase(java.util.Locale.ROOT);
        if (!SetHolder.NON_STORE.contains(value)) throw new BusinessEntityService.OrganizationValidationException();
        return value;
    }

    private static String normalizeIncludingStore(String entityType) {
        String value = Objects.requireNonNullElse(entityType, "").toUpperCase(java.util.Locale.ROOT);
        if (!BusinessEntityTypes.VALUES.contains(value))
            throw new BusinessEntityService.OrganizationValidationException();
        return value;
    }

    private static final class SetHolder {
        private static final java.util.Set<String> NON_STORE = java.util.Set.of(
                BusinessEntityTypes.BRAND, BusinessEntityTypes.TENANT, BusinessEntityTypes.HEAD_COMPANY);
    }
}
