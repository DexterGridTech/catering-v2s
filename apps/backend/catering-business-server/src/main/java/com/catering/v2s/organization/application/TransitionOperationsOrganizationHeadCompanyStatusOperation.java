package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for an operations HeadCompany status transition. */
@Component
public class TransitionOperationsOrganizationHeadCompanyStatusOperation {
    public static final String OPERATION_ID = "transitionOperationsOrganizationHeadCompanyStatus";
    private final OperationsBusinessEntityCommandApi entities;

    public TransitionOperationsOrganizationHeadCompanyStatusOperation(OperationsBusinessEntityCommandApi entities) { this.entities = entities; }

    @Transactional(propagation = Propagation.REQUIRED)
    public OperationsBusinessEntityCommandApi.HeadCompanyCommandReadback execute(OperationsBusinessEntityCommandApi.HeadCompanyStatusCommand command) {
        return entities.transitionHeadCompanyStatus(command);
    }
}
