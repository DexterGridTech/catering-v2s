package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class TransitionOperationsOrganizationTenantStatusOperation {
    public static final String OPERATION_ID = "transitionOperationsOrganizationTenantStatus";
    private final OperationsBusinessEntityCommandApi entities;
    public TransitionOperationsOrganizationTenantStatusOperation(OperationsBusinessEntityCommandApi entities) { this.entities = entities; }
    @Transactional(propagation = Propagation.REQUIRED)
    public OrganizationEntityReadback execute(OperationsBusinessEntityCommandApi.TenantStatusCommand command) { return entities.transitionTenantStatus(command); }
}
