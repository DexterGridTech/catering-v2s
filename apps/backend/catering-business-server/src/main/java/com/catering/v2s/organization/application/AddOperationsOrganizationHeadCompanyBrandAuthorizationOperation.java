package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class AddOperationsOrganizationHeadCompanyBrandAuthorizationOperation {
    public static final String OPERATION_ID = "addOperationsOrganizationHeadCompanyBrandAuthorization";
    private final OperationsBusinessEntityCommandApi entities;
    public AddOperationsOrganizationHeadCompanyBrandAuthorizationOperation(OperationsBusinessEntityCommandApi entities) { this.entities = entities; }
    @Transactional(propagation = Propagation.REQUIRED)
    public OperationsBusinessEntityCommandApi.HeadCompanyBrandAuthorizationReadback execute(OperationsBusinessEntityCommandApi.HeadCompanyBrandAuthorizationCommand command) { return entities.addHeadCompanyBrandAuthorization(command); }
}
