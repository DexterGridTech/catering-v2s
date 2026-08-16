package com.catering.v2s.organization.application.operations;

import com.catering.v2s.organization.api.OperationsOrganizationHierarchyCommandApi;
import com.catering.v2s.organization.api.OrganizationNodeReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for an operations organization-node update. */
@Component
public class UpdateOperationsOrganizationNodeOperation {
    public static final String OPERATION_ID = "updateOperationsOrganizationNode";
    private final OperationsOrganizationHierarchyCommandApi hierarchy;

    public UpdateOperationsOrganizationNodeOperation(OperationsOrganizationHierarchyCommandApi hierarchy) {
        this.hierarchy = hierarchy;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public OrganizationNodeReadback execute(OperationsOrganizationHierarchyCommandApi.UpdateNodeCommand command) {
        return hierarchy.updateNode(command);
    }
}
