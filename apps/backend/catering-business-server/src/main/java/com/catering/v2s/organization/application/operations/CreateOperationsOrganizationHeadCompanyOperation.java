package com.catering.v2s.organization.application.operations;

import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for an operations HeadCompany create. */
@Component
public class CreateOperationsOrganizationHeadCompanyOperation {
    public static final String OPERATION_ID = "createOperationsOrganizationHeadCompany";
    private final OperationsBusinessEntityCommandApi entities;

    public CreateOperationsOrganizationHeadCompanyOperation(OperationsBusinessEntityCommandApi entities) {
        this.entities = entities;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public OperationsBusinessEntityCommandApi.HeadCompanyCommandReadback execute(
            OperationsBusinessEntityCommandApi.HeadCompanyCreateCommand command) {
        return entities.createHeadCompany(command);
    }
}
