package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for an operations Brand create. */
@Component
public class CreateOperationsOrganizationBrandOperation {
    public static final String OPERATION_ID = "createOperationsOrganizationBrand";
    private final OperationsBusinessEntityCommandApi entities;

    public CreateOperationsOrganizationBrandOperation(OperationsBusinessEntityCommandApi entities) { this.entities = entities; }

    @Transactional(propagation = Propagation.REQUIRED)
    public OrganizationEntityReadback execute(OperationsBusinessEntityCommandApi.BrandCreateCommand command) {
        return entities.createBrand(command);
    }
}
