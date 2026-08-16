package com.catering.v2s.organization.application.operations;

import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class TransitionOperationsOrganizationBrandStatusOperation {
    public static final String OPERATION_ID = "transitionOperationsOrganizationBrandStatus";
    private final OperationsBusinessEntityCommandApi entities;

    public TransitionOperationsOrganizationBrandStatusOperation(OperationsBusinessEntityCommandApi entities) {
        this.entities = entities;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public OrganizationEntityReadback execute(OperationsBusinessEntityCommandApi.BrandStatusCommand command) {
        return entities.transitionBrandStatus(command);
    }
}
