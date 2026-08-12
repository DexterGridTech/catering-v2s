package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.OperationsOrganizationHierarchyCommandApi;
import com.catering.v2s.organization.api.OrganizationNodeReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for an operations Region create. */
@Component
public class CreateOperationsOrganizationRegionOperation {
    public static final String OPERATION_ID = "createOperationsOrganizationRegion";
    private final OperationsOrganizationHierarchyCommandApi hierarchy;

    public CreateOperationsOrganizationRegionOperation(OperationsOrganizationHierarchyCommandApi hierarchy) { this.hierarchy = hierarchy; }

    @Transactional(propagation = Propagation.REQUIRED)
    public OrganizationNodeReadback execute(OperationsOrganizationHierarchyCommandApi.CreateRegionCommand command) {
        return hierarchy.createRegion(command);
    }
}
