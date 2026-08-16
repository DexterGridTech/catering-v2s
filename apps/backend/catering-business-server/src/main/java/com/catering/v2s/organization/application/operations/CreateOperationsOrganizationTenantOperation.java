package com.catering.v2s.organization.application.operations;

import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for an operations Tenant create. */
@Component
public class CreateOperationsOrganizationTenantOperation {
    public static final String OPERATION_ID = "createOperationsOrganizationTenant";
    private final OperationsBusinessEntityCommandApi entities;

    public CreateOperationsOrganizationTenantOperation(OperationsBusinessEntityCommandApi entities) {
        this.entities = entities;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public OrganizationEntityReadback execute(OperationsBusinessEntityCommandApi.TenantCreateCommand command) {
        return entities.createTenant(command);
    }
}
