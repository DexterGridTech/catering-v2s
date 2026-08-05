package com.catering.v2s.app.edge.operations.organization;

import com.catering.v2s.app.edge.generated.wire.CommercialGroupRoot;
import com.catering.v2s.app.edge.generated.wire.OrganizationHierarchySnapshot;
import com.catering.v2s.app.edge.generated.wire.OrganizationNode;
import com.catering.v2s.app.edge.generated.wire.OrganizationNodePhasesItem;
import com.catering.v2s.organization.api.CommercialGroupReadback;
import com.catering.v2s.organization.api.OrganizationNodeReadback;
import java.util.List;
import java.util.Map;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/** Boundary mapping only: the commercial group is the hierarchy root, not an organization node. */
final class OrganizationHierarchyWireMapper {
    private static final ObjectMapper JSON = new ObjectMapper();
    private OrganizationHierarchyWireMapper() { }

    static OrganizationHierarchySnapshot snapshot(String groupWorkspaceKey, CommercialGroupReadback root, List<OrganizationNodeReadback> nodes) {
        return new OrganizationHierarchySnapshot(groupWorkspaceKey, commercialGroup(root), nodes.stream().map(OrganizationHierarchyWireMapper::node).toList());
    }

    static OrganizationNode node(OrganizationNodeReadback value) {
        return new OrganizationNode(value.id().toString(), value.groupWorkspaceKey(), value.nodeType(), value.parentId() == null ? null : value.parentId().toString(), value.code(), value.name(), value.notes(), value.status(), value.phaseNames().stream().map(OrganizationNodePhasesItem::new).toList(), value.version(), value.createdAtEpochMillis(), value.updatedAtEpochMillis(), extensionValues(value.extensionValues()), value.extensionRuleRevision());
    }

    static CommercialGroupRoot commercialGroup(CommercialGroupReadback value) {
        return new CommercialGroupRoot(String.valueOf(value.id()), value.groupWorkspaceKey(), value.commercialGroupCode(), value.commercialGroupName(), value.revision(), value.createdAtEpochMillis(), value.updatedAtEpochMillis(), extensionValues(value.extensionValues()), value.extensionRuleRevision());
    }
    private static JsonNode extensionValues(Map<String, String> values) { ObjectNode result = JSON.createObjectNode(); values.forEach((key, raw) -> { try { result.set(key, JSON.readTree(raw)); } catch (Exception exception) { throw new IllegalStateException("organization owner emitted invalid extension JSON", exception); } }); return result; }
}
