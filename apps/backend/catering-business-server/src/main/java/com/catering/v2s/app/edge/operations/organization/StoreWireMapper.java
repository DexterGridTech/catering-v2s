package com.catering.v2s.app.edge.operations.organization;

import com.catering.v2s.app.edge.generated.wire.OrganizationStore;
import com.catering.v2s.app.edge.generated.wire.OrganizationStoreBrand;
import com.catering.v2s.app.edge.generated.wire.OrganizationStoreHeadCompany;
import com.catering.v2s.app.edge.generated.wire.OrganizationStoreProject;
import com.catering.v2s.app.edge.generated.wire.OrganizationStoreStatus;
import com.catering.v2s.app.edge.generated.wire.OrganizationStoreTenant;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.OperationsStoreCommandApi;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService;

final class StoreWireMapper {
    private StoreWireMapper() { }
    static OrganizationStore store(OrganizationEntityReadback entity, OrganizationOverviewTaskReadService.Item item, String contractDerivedStatus) {
        return store(entity, project(item.project()), brand(item.brand()), tenant(item.tenant()), headCompany(item.headCompany()), contractDerivedStatus);
    }
    static OrganizationStore store(OrganizationEntityReadback entity, OperationsStoreCommandApi.StoreOrganizationDetailReadback detail, String contractDerivedStatus) {
        return store(entity, project(detail.project()), brand(detail.brand()), tenant(detail.tenant()), headCompany(detail.headCompany()), contractDerivedStatus);
    }
    private static OrganizationStore store(OrganizationEntityReadback entity, OrganizationStoreProject project, OrganizationStoreBrand brand, OrganizationStoreTenant tenant, OrganizationStoreHeadCompany headCompany, String contractDerivedStatus) {
        return new OrganizationStore(entity.id().toString(), entity.groupWorkspaceKey(), entity.code(), entity.name(), project, brand, tenant, headCompany, entity.notes(), OrganizationStoreStatus.valueOf(entity.status()), BusinessEntityWireMapper.extensionValues(entity), entity.extensionRuleRevision(), entity.version(), entity.createdAt(), entity.updatedAt(), contractDerivedStatus);
    }
    private static OrganizationStoreProject project(OrganizationOverviewTaskReadService.Reference value) { return value == null ? null : new OrganizationStoreProject(value.id().toString(), value.code(), value.name(), null); }
    private static OrganizationStoreBrand brand(OrganizationOverviewTaskReadService.Reference value) { return value == null ? null : new OrganizationStoreBrand(value.id().toString(), value.code(), value.name(), null); }
    private static OrganizationStoreTenant tenant(OrganizationOverviewTaskReadService.Reference value) { return value == null ? null : new OrganizationStoreTenant(value.id().toString(), value.code(), value.name(), null); }
    private static OrganizationStoreHeadCompany headCompany(OrganizationOverviewTaskReadService.Reference value) { return value == null ? null : new OrganizationStoreHeadCompany(value.id().toString(), value.code(), value.name(), null); }
    private static OrganizationStoreProject project(OperationsStoreCommandApi.Reference value) { return value == null ? null : new OrganizationStoreProject(value.id().toString(), value.code(), value.name(), null); }
    private static OrganizationStoreBrand brand(OperationsStoreCommandApi.Reference value) { return value == null ? null : new OrganizationStoreBrand(value.id().toString(), value.code(), value.name(), null); }
    private static OrganizationStoreTenant tenant(OperationsStoreCommandApi.Reference value) { return value == null ? null : new OrganizationStoreTenant(value.id().toString(), value.code(), value.name(), null); }
    private static OrganizationStoreHeadCompany headCompany(OperationsStoreCommandApi.Reference value) { return value == null ? null : new OrganizationStoreHeadCompany(value.id().toString(), value.code(), value.name(), null); }
}
