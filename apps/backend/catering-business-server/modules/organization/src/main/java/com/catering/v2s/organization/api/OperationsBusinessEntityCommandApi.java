package com.catering.v2s.organization.api;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.extension.api.ExtensionSubmission;
import java.util.List;
import java.util.UUID;

/**
 * Operations command boundary for organization-owned brands, tenants and head companies.
 *
 * <p>Each named command carries only typed owner inputs. Dynamic fields cross this boundary as
 * {@link ExtensionSubmission}; callers neither interpret its JSON nor encode clear as null.
 */
public interface OperationsBusinessEntityCommandApi {
    OrganizationEntityReadback createBrand(BrandCreateCommand command);
    OrganizationEntityReadback updateBrand(BrandUpdateCommand command);
    OrganizationEntityReadback createTenant(TenantCreateCommand command);
    OrganizationEntityReadback updateTenant(TenantUpdateCommand command);
    HeadCompanyCommandReadback createHeadCompany(HeadCompanyCreateCommand command);
    HeadCompanyCommandReadback updateHeadCompany(HeadCompanyUpdateCommand command);
    HeadCompanyCommandReadback transitionHeadCompanyStatus(HeadCompanyStatusCommand command);
    OrganizationEntityReadback transitionBrandStatus(BrandStatusCommand command);
    OrganizationEntityReadback transitionTenantStatus(TenantStatusCommand command);
    HeadCompanyBrandAuthorizationReadback addHeadCompanyBrandAuthorization(HeadCompanyBrandAuthorizationCommand command);
    HeadCompanyBrandAuthorizationReadback removeHeadCompanyBrandAuthorization(HeadCompanyBrandAuthorizationCommand command);

    record BrandCreateCommand(UUID workspaceUuid, String groupWorkspaceKey, String code, String name,
                              String alias, String remark, ExtensionSubmission extensionSubmission,
                              String idempotencyKey, AuditActor actor, OperationsOwnerScopeGrant ownerScopeGrant) { }
    record BrandUpdateCommand(UUID workspaceUuid, String groupWorkspaceKey, UUID brandId, String code,
                              String name, String alias, String remark, long expectedVersion,
                              ExtensionSubmission extensionSubmission, String idempotencyKey,
                              AuditActor actor, OperationsOwnerScopeGrant ownerScopeGrant) { }
    record TenantCreateCommand(UUID workspaceUuid, String groupWorkspaceKey, String code, String name,
                               String legalName, String creditCode, String remark,
                               ExtensionSubmission extensionSubmission, String idempotencyKey,
                               AuditActor actor, OperationsOwnerScopeGrant ownerScopeGrant) { }
    record TenantUpdateCommand(UUID workspaceUuid, String groupWorkspaceKey, UUID tenantId, String code,
                               String name, String legalName, String creditCode, String remark,
                               long expectedVersion, ExtensionSubmission extensionSubmission,
                               String idempotencyKey, AuditActor actor, OperationsOwnerScopeGrant ownerScopeGrant) { }
    record HeadCompanyCreateCommand(UUID workspaceUuid, String groupWorkspaceKey, String code, String name,
                                    String legalName, String creditCode, String remark,
                                    ExtensionSubmission extensionSubmission, String idempotencyKey,
                                    AuditActor actor, OperationsOwnerScopeGrant ownerScopeGrant) { }
    record HeadCompanyUpdateCommand(UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId,
                                    String code, String name, String legalName, String creditCode,
                                    String remark, long expectedVersion,
                                    ExtensionSubmission extensionSubmission, String idempotencyKey,
                                    AuditActor actor, OperationsOwnerScopeGrant ownerScopeGrant) { }
    record HeadCompanyStatusCommand(UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId,
                                    String targetStatus, long expectedVersion, String idempotencyKey,
                                    AuditActor actor, OperationsOwnerScopeGrant ownerScopeGrant) { }
    record BrandStatusCommand(UUID workspaceUuid, String groupWorkspaceKey, UUID brandId,
                              String targetStatus, long expectedVersion, String idempotencyKey,
                              AuditActor actor, OperationsOwnerScopeGrant ownerScopeGrant) { }
    record TenantStatusCommand(UUID workspaceUuid, String groupWorkspaceKey, UUID tenantId,
                               String targetStatus, long expectedVersion, String idempotencyKey,
                               AuditActor actor, OperationsOwnerScopeGrant ownerScopeGrant) { }
    record HeadCompanyBrandAuthorizationCommand(UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId,
                                                UUID brandId, String idempotencyKey, AuditActor actor,
                                                OperationsOwnerScopeGrant ownerScopeGrant) { }
    record HeadCompanyBrandAuthorizationReadback(UUID headCompanyId, UUID brandId) { }

    /** Organization owns both the head-company entity and its authorized-brand relation. */
    record HeadCompanyCommandReadback(OrganizationEntityReadback entity,
                                      List<OrganizationEntityReadback> authorizedBrands) {
        public HeadCompanyCommandReadback {
            authorizedBrands = List.copyOf(authorizedBrands);
        }
    }
}
