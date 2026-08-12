package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for an operations Brand update. */
@Component
public class UpdateOperationsOrganizationBrandOperation {
    public static final String OPERATION_ID = "updateOperationsOrganizationBrand";
    private final OperationsBusinessEntityCommandApi entities;

    public UpdateOperationsOrganizationBrandOperation(OperationsBusinessEntityCommandApi entities) { this.entities = entities; }

    @Transactional(propagation = Propagation.REQUIRED)
    public OrganizationEntityReadback execute(OperationsBusinessEntityCommandApi.BrandUpdateCommand command) {
        return entities.updateBrand(command);
    }
}
