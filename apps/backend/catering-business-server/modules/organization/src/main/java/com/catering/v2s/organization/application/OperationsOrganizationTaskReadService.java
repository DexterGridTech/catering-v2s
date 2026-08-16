package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.CommercialGroupReadback;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.OrganizationNodeReadback;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Typed, GET-only organization read boundaries for the operations-admin surface.
 *
 * <p>This is intentionally not an operation-id dispatcher. Each public method names one bounded user task and closes
 * over the owner-local type selector needed by that task. Command handlers continue to use their existing owner APIs
 * and must not call this service.
 */
@Service
public class OperationsOrganizationTaskReadService {
    private final BusinessEntityService entities;
    private final OrganizationOverviewTaskReadService overview;
    private final OrganizationHierarchyService hierarchy;
    private final OrganizationCommandService commercialGroups;

    public OperationsOrganizationTaskReadService(
            BusinessEntityService entities, OrganizationOverviewTaskReadService overview) {
        this(entities, overview, null, null);
    }

    @Autowired
    public OperationsOrganizationTaskReadService(
            BusinessEntityService entities,
            OrganizationOverviewTaskReadService overview,
            OrganizationHierarchyService hierarchy,
            OrganizationCommandService commercialGroups) {
        this.entities = entities;
        this.overview = overview;
        this.hierarchy = hierarchy;
        this.commercialGroups = commercialGroups;
    }

    @Transactional(readOnly = true)
    public BusinessEntityService.BrandPage brands(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String queryText,
            String status,
            String sort,
            String direction,
            int page,
            int pageSize) {
        return primary(() -> entities.pageBrands(
                workspaceUuid, groupWorkspaceKey, queryText, status, sort, direction, page, pageSize));
    }

    @Transactional(readOnly = true)
    public BusinessEntityService.EntityPage tenants(
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
        return entityPage(
                "TENANT",
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

    @Transactional(readOnly = true)
    public BusinessEntityService.EntityPage headCompanies(
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
        return entityPage(
                ServiceNodeTypes.HEAD_COMPANY,
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

    @Transactional(readOnly = true)
    public OrganizationEntityReadback brand(UUID workspaceUuid, String groupWorkspaceKey, UUID brandId) {
        return entity("BRAND", workspaceUuid, groupWorkspaceKey, brandId);
    }

    @Transactional(readOnly = true)
    public OrganizationEntityReadback tenant(UUID workspaceUuid, String groupWorkspaceKey, UUID tenantId) {
        return entity("TENANT", workspaceUuid, groupWorkspaceKey, tenantId);
    }

    @Transactional(readOnly = true)
    public HeadCompany headCompany(UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId) {
        return primary(() -> {
            OrganizationEntityReadback entity = entities.requireEntity(
                    ServiceNodeTypes.HEAD_COMPANY, workspaceUuid, groupWorkspaceKey, headCompanyId);
            return new HeadCompany(entity, entities.authorizedBrands(workspaceUuid, groupWorkspaceKey, headCompanyId));
        });
    }

    /** Static store task boundary; the generic overview category never crosses this public API. */
    @Transactional(readOnly = true)
    public OrganizationOverviewTaskReadService.Page stores(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            OrganizationOverviewTaskReadService.Query query,
            int page,
            int pageSize) {
        return primary(
                () -> overview.page(workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.STORE, query, page, pageSize));
    }

    /** Static store-detail task boundary used by operations store list/detail/profile reads only. */
    @Transactional(readOnly = true)
    public OrganizationOverviewTaskReadService.Item store(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return primary(() -> overview.detail(workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.STORE, storeId));
    }

    /** One typed hierarchy snapshot boundary; consumers cannot assemble it from arbitrary owner reads. */
    @Transactional(readOnly = true)
    public HierarchySnapshot hierarchy(UUID workspaceUuid, String groupWorkspaceKey) {
        if (hierarchy == null || commercialGroups == null)
            throw new IllegalStateException("hierarchy task reader is unavailable");
        return primary(() -> new HierarchySnapshot(
                commercialGroups.requireCommercialGroup(groupWorkspaceKey),
                hierarchy.list(workspaceUuid, groupWorkspaceKey)));
    }

    private BusinessEntityService.EntityPage entityPage(
            String type,
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
        return primary(() -> entities.pageEntities(
                type,
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
                pageSize));
    }

    private OrganizationEntityReadback entity(
            String type, UUID workspaceUuid, String groupWorkspaceKey, UUID entityId) {
        return primary(() -> entities.requireEntity(type, workspaceUuid, groupWorkspaceKey, entityId));
    }

    private static <T> T primary(java.util.function.Supplier<T> query) {
        return ReadBudgetComponent.measure(ReadBudgetComponent.Component.PRIMARY_QUERY, query);
    }

    public record HeadCompany(OrganizationEntityReadback entity, List<OrganizationEntityReadback> authorizedBrands) {
        public HeadCompany {
            authorizedBrands = List.copyOf(authorizedBrands);
        }
    }

    public record HierarchySnapshot(CommercialGroupReadback commercialGroup, List<OrganizationNodeReadback> nodes) {
        public HierarchySnapshot {
            nodes = List.copyOf(nodes);
        }
    }
}
