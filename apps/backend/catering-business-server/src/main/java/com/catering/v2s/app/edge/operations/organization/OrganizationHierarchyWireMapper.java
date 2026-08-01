package com.catering.v2s.app.edge.operations.organization;

import com.catering.v2s.app.edge.generated.wire.CommercialGroupRoot;
import com.catering.v2s.app.edge.generated.wire.OrganizationHierarchySnapshot;
import com.catering.v2s.app.edge.generated.wire.OrganizationNode;
import com.catering.v2s.app.edge.generated.wire.OrganizationNodePhasesItem;
import com.catering.v2s.organization.api.CommercialGroupReadback;
import com.catering.v2s.organization.api.OrganizationNodeReadback;
import java.util.List;

/** Boundary mapping only: the commercial group is the hierarchy root, not an organization node. */
final class OrganizationHierarchyWireMapper {
    private OrganizationHierarchyWireMapper() { }

    static OrganizationHierarchySnapshot snapshot(String groupWorkspaceKey, CommercialGroupReadback root, List<OrganizationNodeReadback> nodes) {
        return new OrganizationHierarchySnapshot(groupWorkspaceKey, root(root), nodes.stream().map(OrganizationHierarchyWireMapper::node).toList());
    }

    static OrganizationNode node(OrganizationNodeReadback value) {
        return new OrganizationNode(value.id().toString(), value.groupWorkspaceKey(), value.nodeType(), value.parentId() == null ? null : value.parentId().toString(), value.code(), value.name(), value.notes(), value.status(), value.phaseNames().stream().map(OrganizationNodePhasesItem::new).toList(), value.version(), value.createdAtEpochMillis(), value.updatedAtEpochMillis());
    }

    private static CommercialGroupRoot root(CommercialGroupReadback value) {
        return new CommercialGroupRoot(String.valueOf(value.id()), value.groupWorkspaceKey(), value.commercialGroupCode(), value.commercialGroupName(), value.revision(), value.createdAtEpochMillis(), value.updatedAtEpochMillis());
    }
}
