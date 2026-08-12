package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class RemoveOperationsOrganizationHeadCompanyBrandAuthorizationOperation {
    public static final String OPERATION_ID = "removeOperationsOrganizationHeadCompanyBrandAuthorization";
    private final OperationsBusinessEntityCommandApi entities;
    public RemoveOperationsOrganizationHeadCompanyBrandAuthorizationOperation(OperationsBusinessEntityCommandApi entities) { this.entities = entities; }
    @Transactional(propagation = Propagation.REQUIRED)
    public OperationsBusinessEntityCommandApi.HeadCompanyBrandAuthorizationReadback execute(OperationsBusinessEntityCommandApi.HeadCompanyBrandAuthorizationCommand command) { return entities.removeHeadCompanyBrandAuthorization(command); }
}
