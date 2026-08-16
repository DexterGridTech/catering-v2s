package com.catering.v2s.organization.application.operations;

import com.catering.v2s.organization.api.OperationsOrganizationHierarchyCommandApi;
import com.catering.v2s.organization.api.OrganizationNodeReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class TransitionOperationsOrganizationNodeStatusOperation {
    public static final String OPERATION_ID = "transitionOperationsOrganizationNodeStatus";
    private final OperationsOrganizationHierarchyCommandApi hierarchy;

    public TransitionOperationsOrganizationNodeStatusOperation(OperationsOrganizationHierarchyCommandApi hierarchy) {
        this.hierarchy = hierarchy;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public OrganizationNodeReadback execute(
            OperationsOrganizationHierarchyCommandApi.TransitionNodeStatusCommand command) {
        return hierarchy.transitionNodeStatus(command);
    }
}
