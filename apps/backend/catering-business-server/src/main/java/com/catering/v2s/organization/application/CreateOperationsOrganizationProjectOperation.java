package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.OperationsOrganizationHierarchyCommandApi;
import com.catering.v2s.organization.api.OrganizationNodeReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for an operations Project create. */
@Component
public class CreateOperationsOrganizationProjectOperation {
    public static final String OPERATION_ID = "createOperationsOrganizationProject";
    private final OperationsOrganizationHierarchyCommandApi hierarchy;

    public CreateOperationsOrganizationProjectOperation(OperationsOrganizationHierarchyCommandApi hierarchy) { this.hierarchy = hierarchy; }

    @Transactional(propagation = Propagation.REQUIRED)
    public OrganizationNodeReadback execute(OperationsOrganizationHierarchyCommandApi.CreateProjectCommand command) {
        return hierarchy.createProject(command);
    }
}
