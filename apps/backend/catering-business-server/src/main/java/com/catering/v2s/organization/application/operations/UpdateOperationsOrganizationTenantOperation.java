package com.catering.v2s.organization.application.operations;

import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for an operations Tenant update. */
@Component
public class UpdateOperationsOrganizationTenantOperation {
    public static final String OPERATION_ID = "updateOperationsOrganizationTenant";
    private final OperationsBusinessEntityCommandApi entities;

    public UpdateOperationsOrganizationTenantOperation(OperationsBusinessEntityCommandApi entities) {
        this.entities = entities;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public OrganizationEntityReadback execute(OperationsBusinessEntityCommandApi.TenantUpdateCommand command) {
        return entities.updateTenant(command);
    }
}
