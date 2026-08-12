package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for an operations HeadCompany update. */
@Component
public class UpdateOperationsOrganizationHeadCompanyOperation {
    public static final String OPERATION_ID = "updateOperationsOrganizationHeadCompany";
    private final OperationsBusinessEntityCommandApi entities;

    public UpdateOperationsOrganizationHeadCompanyOperation(OperationsBusinessEntityCommandApi entities) { this.entities = entities; }

    @Transactional(propagation = Propagation.REQUIRED)
    public OperationsBusinessEntityCommandApi.HeadCompanyCommandReadback execute(OperationsBusinessEntityCommandApi.HeadCompanyUpdateCommand command) {
        return entities.updateHeadCompany(command);
    }
}
