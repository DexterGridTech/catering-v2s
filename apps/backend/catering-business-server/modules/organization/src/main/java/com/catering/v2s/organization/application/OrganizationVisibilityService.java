package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.OrganizationVisibilityLookup;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrganizationVisibilityService implements OrganizationVisibilityLookup {
    private final JdbcTemplate jdbc;

    public OrganizationVisibilityService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isVisibleDataNodeAllowed(
            UUID workspaceUuid, String key, String assignmentType, UUID assignmentNode, UUID visibleNode) {
        if (visibleNode == null) return false;
        if (ServiceNodeTypes.GROUP.equals(assignmentType)) {
            Boolean visible = jdbc.query(
                    "SELECT EXISTS(SELECT 1 FROM organization.organization_node WHERE id=? AND workspace_uuid=? AND "
                            + "group_workspace_key=? AND status='ENABLED') OR EXISTS(SELECT 1 FROM organization.store "
                            + "WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND status='ENABLED')",
                    statement -> {
                        statement.setObject(1, visibleNode);
                        statement.setObject(2, workspaceUuid);
                        statement.setString(3, key);
                        statement.setObject(4, visibleNode);
                        statement.setObject(5, workspaceUuid);
                        statement.setString(6, key);
                    },
                    result -> result.next() && result.getBoolean(1));
            return Boolean.TRUE.equals(visible);
        }
        if (ServiceNodeTypes.PROJECT.equals(assignmentType)) {
            if (assignmentNode.equals(visibleNode)) return true;
            return Boolean.TRUE.equals(jdbc.query(
                    "SELECT EXISTS(SELECT 1 FROM organization.store WHERE id=? AND project_id=? AND workspace_uuid=? "
                            + "AND group_workspace_key=? AND status='ENABLED')",
                    statement -> {
                        statement.setObject(1, visibleNode);
                        statement.setObject(2, assignmentNode);
                        statement.setObject(3, workspaceUuid);
                        statement.setString(4, key);
                    },
                    result -> result.next() && result.getBoolean(1)));
        }
        if (ServiceNodeTypes.HEAD_COMPANY.equals(assignmentType) || ServiceNodeTypes.STORE.equals(assignmentType)) {
            return assignmentNode.equals(visibleNode);
        }
        UUID candidateHierarchyNode = jdbc.query(
                "SELECT COALESCE((SELECT project_id FROM organization.store WHERE id=? AND workspace_uuid=? AND "
                        + "group_workspace_key=?), ?) AS node_id",
                statement -> {
                    statement.setObject(1, visibleNode);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                    statement.setObject(4, visibleNode);
                },
                result -> {
                    result.next();
                    return result.getObject(1, UUID.class);
                });
        Boolean allowed = jdbc.query(
                "WITH RECURSIVE ancestry AS (SELECT id, parent_id FROM organization.organization_node WHERE id=? AND "
                        + "workspace_uuid=? AND group_workspace_key=? UNION ALL SELECT parent.id, parent.parent_id "
                        + "FROM "
                        + "organization.organization_node parent JOIN ancestry child ON child.parent_id=parent.id) "
                        + "SELECT "
                        + "EXISTS(SELECT 1 FROM ancestry WHERE id=?)",
                statement -> {
                    statement.setObject(1, candidateHierarchyNode);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                    statement.setObject(4, assignmentNode);
                },
                result -> result.next() && result.getBoolean(1));
        return Boolean.TRUE.equals(allowed);
    }

    @Override
    @Transactional(readOnly = true)
    public List<VisibleDataNodeCandidate> listVisibleDataNodeCandidates(
            UUID workspaceUuid, String key, String assignmentNodeType, UUID assignmentNodeId) {
        return resolveSessionEntryFacts(
                        workspaceUuid, key, assignmentNodeType, assignmentNodeId, null, null, null, null)
                .candidates();
    }

    /**
     * Builds candidate and selector projections from one organization-owner read pass. The facts are invocation-local:
     * task reads use them only for the current request and command callers may reuse them only for the matching command
     * readback.
     */
    @Override
    @Transactional(readOnly = true)
    public VisibleOrganizationFacts resolveSessionEntryFacts(
            UUID workspaceUuid,
            String key,
            String assignmentNodeType,
            UUID assignmentNodeId,
            UUID regionId,
            UUID projectId,
            UUID storeId,
            UUID headCompanyId) {
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.CONTEXT_ORGANIZATION,
                () -> resolveSessionEntryFactsUnmeasured(
                        workspaceUuid,
                        key,
                        assignmentNodeType,
                        assignmentNodeId,
                        regionId,
                        projectId,
                        storeId,
                        headCompanyId));
    }

    private VisibleOrganizationFacts resolveSessionEntryFactsUnmeasured(
            UUID workspaceUuid,
            String key,
            String assignmentNodeType,
            UUID assignmentNodeId,
            UUID regionId,
            UUID projectId,
            UUID storeId,
            UUID headCompanyId) {
        List<HierarchyNode> hierarchy = jdbc.query(
                "SELECT id, node_type, code, name, parent_id, status FROM organization.organization_node WHERE "
                        + "workspace_uuid=? AND group_workspace_key=? ORDER BY node_type, code",
                (row, index) -> new HierarchyNode(
                        row.getObject(1, UUID.class),
                        row.getString(2),
                        row.getString(3),
                        row.getString(4),
                        row.getObject(5, UUID.class),
                        row.getString(6)),
                workspaceUuid,
                key);
        Map<UUID, HierarchyNode> nodes = new LinkedHashMap<>();
        hierarchy.forEach(node -> nodes.put(node.id(), node));
        List<Store> stores = jdbc.query(
                "SELECT id, code, name, project_id, head_company_id, status FROM organization.store WHERE "
                        + "workspace_uuid=? AND group_workspace_key=? ORDER BY code",
                (row, index) -> new Store(
                        row.getObject(1, UUID.class),
                        row.getString(2),
                        row.getString(3),
                        row.getObject(4, UUID.class),
                        row.getObject(5, UUID.class),
                        row.getString(6)),
                workspaceUuid,
                key);
        // A newly created session has no persisted selector IDs yet.  In that one case the
        // assignment itself is the locked selector, so derive its fixed context from the same
        // owner-local rows already loaded above.  This keeps login from reading candidates once
        // and then rebuilding the same scope context through a second owner pass.
        UUID effectiveRegionId = regionId;
        UUID effectiveProjectId = projectId;
        UUID effectiveStoreId = storeId;
        UUID effectiveHeadCompanyId = headCompanyId;
        boolean deriveAssignmentScope = regionId == null
                && projectId == null
                && storeId == null
                && headCompanyId == null
                && assignmentNodeId != null
                && !ServiceNodeTypes.GROUP.equals(assignmentNodeType);
        if (deriveAssignmentScope) {
            switch (assignmentNodeType) {
                case ServiceNodeTypes.REGION -> effectiveRegionId = assignmentNodeId;
                case ServiceNodeTypes.PROJECT -> effectiveProjectId = assignmentNodeId;
                case ServiceNodeTypes.STORE -> effectiveStoreId = assignmentNodeId;
                case ServiceNodeTypes.HEAD_COMPANY -> effectiveHeadCompanyId = assignmentNodeId;
                default -> {}
            }
            UUID selectedStoreId = effectiveStoreId;
            Store selectedStore = selectedStoreId == null
                    ? null
                    : stores.stream()
                            .filter(store -> selectedStoreId.equals(store.id()))
                            .findFirst()
                            .orElse(null);
            if (effectiveProjectId == null && selectedStore != null) effectiveProjectId = selectedStore.projectId();
            if (effectiveRegionId == null && effectiveProjectId != null && nodes.containsKey(effectiveProjectId)) {
                effectiveRegionId = nodes.get(effectiveProjectId).parentId();
            }
            if (effectiveHeadCompanyId == null && selectedStore != null)
                effectiveHeadCompanyId = selectedStore.headCompanyId();
        }
        Map<UUID, HeadCompany> headCompanies = new LinkedHashMap<>();
        if (ServiceNodeTypes.GROUP.equals(assignmentNodeType)
                || ServiceNodeTypes.HEAD_COMPANY.equals(assignmentNodeType)
                || effectiveHeadCompanyId != null) {
            jdbc.query(
                            "SELECT id, code, name FROM organization.head_company WHERE workspace_uuid=? AND "
                                    + "group_workspace_key=? AND status='ENABLED' ORDER BY code",
                            (row, index) ->
                                    new HeadCompany(row.getObject(1, UUID.class), row.getString(2), row.getString(3)),
                            workspaceUuid,
                            key)
                    .forEach(headCompany -> headCompanies.put(headCompany.id(), headCompany));
        }
        return new VisibleOrganizationFacts(
                visibleCandidates(assignmentNodeType, assignmentNodeId, hierarchy, nodes, stores, headCompanies),
                new ScopeContext(
                        hierarchyContext(nodes, ServiceNodeTypes.REGION, effectiveRegionId),
                        hierarchyContext(nodes, ServiceNodeTypes.PROJECT, effectiveProjectId),
                        storeContext(nodes, stores, effectiveStoreId),
                        headCompanyContext(headCompanies, effectiveHeadCompanyId)));
    }

    private static List<VisibleDataNodeCandidate> visibleCandidates(
            String assignmentNodeType,
            UUID assignmentNodeId,
            List<HierarchyNode> hierarchy,
            Map<UUID, HierarchyNode> nodes,
            List<Store> stores,
            Map<UUID, HeadCompany> headCompanies) {
        List<VisibleDataNodeCandidate> result = new ArrayList<>();
        hierarchy.stream()
                .filter(node -> "ENABLED".equals(node.status()))
                .filter(node -> visible(assignmentNodeType, assignmentNodeId, node.id(), nodes))
                .forEach(node -> result.add(new VisibleDataNodeCandidate(
                        node.type(),
                        node.id(),
                        node.name(),
                        node.code(),
                        ancestorNames(node.id(), nodes),
                        ServiceNodeTypes.REGION.equals(node.type())
                                ? node.id()
                                : ServiceNodeTypes.PROJECT.equals(node.type()) ? node.parentId() : null,
                        ServiceNodeTypes.PROJECT.equals(node.type()) ? node.id() : null,
                        null,
                        null)));
        stores.stream()
                .filter(store -> "ENABLED".equals(store.status()))
                .filter(store -> visible(assignmentNodeType, assignmentNodeId, store.id(), nodes, store.projectId()))
                .forEach(store -> {
                    HierarchyNode project = nodes.get(store.projectId());
                    // A store scope is only selectable while its owning project is
                    // enabled.  Keep this candidate gate consistent with
                    // storeContext(), which rejects disabled projects on the
                    // persisted scope readback; otherwise the selector would offer
                    // a store that the next owner read immediately invalidates.
                    if (project == null
                            || !ServiceNodeTypes.PROJECT.equals(project.type())
                            || !"ENABLED".equals(project.status())) return;
                    List<String> path = new ArrayList<>(ancestorNames(project.id(), nodes));
                    path.add(store.name());
                    result.add(new VisibleDataNodeCandidate(
                            ServiceNodeTypes.STORE,
                            store.id(),
                            store.name(),
                            store.code(),
                            List.copyOf(path),
                            project.parentId(),
                            project.id(),
                            store.id(),
                            store.headCompanyId()));
                });
        if (ServiceNodeTypes.GROUP.equals(assignmentNodeType)
                || ServiceNodeTypes.HEAD_COMPANY.equals(assignmentNodeType)) {
            headCompanies.values().stream()
                    .filter(headCompany -> !ServiceNodeTypes.HEAD_COMPANY.equals(assignmentNodeType)
                            || headCompany.id().equals(assignmentNodeId))
                    .filter(headCompany -> visible(assignmentNodeType, assignmentNodeId, headCompany.id(), nodes))
                    .forEach(headCompany -> result.add(new VisibleDataNodeCandidate(
                            ServiceNodeTypes.HEAD_COMPANY,
                            headCompany.id(),
                            headCompany.name(),
                            headCompany.code(),
                            List.of(headCompany.name()),
                            null,
                            null,
                            null,
                            headCompany.id())));
        }
        return List.copyOf(result);
    }

    @Override
    @Transactional(readOnly = true)
    public ScopeContext describeScopeContext(
            UUID workspaceUuid, String key, UUID regionId, UUID projectId, UUID storeId, UUID headCompanyId) {
        return resolveSessionEntryFacts(
                        workspaceUuid, key, ServiceNodeTypes.GROUP, null, regionId, projectId, storeId, headCompanyId)
                .scopeContext();
    }

    private Map<UUID, HierarchyNode> hierarchy(UUID workspaceUuid, String key) {
        Map<UUID, HierarchyNode> nodes = new LinkedHashMap<>();
        jdbc.query(
                        "SELECT id, node_type, code, name, parent_id, status FROM organization.organization_node WHERE "
                                + "workspace_uuid=? AND group_workspace_key=?",
                        (row, index) -> new HierarchyNode(
                                row.getObject(1, UUID.class),
                                row.getString(2),
                                row.getString(3),
                                row.getString(4),
                                row.getObject(5, UUID.class),
                                row.getString(6)),
                        workspaceUuid,
                        key)
                .forEach(node -> nodes.put(node.id(), node));
        return nodes;
    }

    private static VisibleDataNodeCandidate hierarchyContext(Map<UUID, HierarchyNode> nodes, String type, UUID id) {
        HierarchyNode node = id == null ? null : nodes.get(id);
        if (node == null || !type.equals(node.type()) || !"ENABLED".equals(node.status())) return null;
        UUID regionId = ServiceNodeTypes.REGION.equals(type) ? node.id() : node.parentId();
        return new VisibleDataNodeCandidate(
                type,
                node.id(),
                node.name(),
                node.code(),
                ancestorNames(node.id(), nodes),
                regionId,
                ServiceNodeTypes.PROJECT.equals(type) ? node.id() : null,
                null,
                null);
    }

    private static VisibleDataNodeCandidate storeContext(
            Map<UUID, HierarchyNode> nodes, List<Store> stores, UUID storeId) {
        if (storeId == null) return null;
        Store store = stores.stream()
                .filter(value -> storeId.equals(value.id()))
                .findFirst()
                .orElse(null);
        if (store == null || !"ENABLED".equals(store.status())) return null;
        HierarchyNode project = nodes.get(store.projectId());
        if (project == null || !ServiceNodeTypes.PROJECT.equals(project.type()) || !"ENABLED".equals(project.status()))
            return null;
        List<String> path = new ArrayList<>(ancestorNames(project.id(), nodes));
        path.add(store.name());
        return new VisibleDataNodeCandidate(
                ServiceNodeTypes.STORE,
                store.id(),
                store.name(),
                store.code(),
                List.copyOf(path),
                project.parentId(),
                project.id(),
                store.id(),
                store.headCompanyId());
    }

    private static VisibleDataNodeCandidate headCompanyContext(
            Map<UUID, HeadCompany> headCompanies, UUID headCompanyId) {
        if (headCompanyId == null) return null;
        HeadCompany headCompany = headCompanies.get(headCompanyId);
        return headCompany == null
                ? null
                : new VisibleDataNodeCandidate(
                        ServiceNodeTypes.HEAD_COMPANY,
                        headCompany.id(),
                        headCompany.name(),
                        headCompany.code(),
                        List.of(headCompany.name()),
                        null,
                        null,
                        null,
                        headCompany.id());
    }

    private static boolean visible(
            String assignmentType, UUID assignmentNodeId, UUID visibleNodeId, Map<UUID, HierarchyNode> nodes) {
        return visible(assignmentType, assignmentNodeId, visibleNodeId, nodes, visibleNodeId);
    }

    private static boolean visible(
            String assignmentType,
            UUID assignmentNodeId,
            UUID visibleNodeId,
            Map<UUID, HierarchyNode> nodes,
            UUID hierarchyNodeId) {
        if (visibleNodeId == null || assignmentNodeId == null) return false;
        if (ServiceNodeTypes.GROUP.equals(assignmentType)) return true;
        if (ServiceNodeTypes.PROJECT.equals(assignmentType)) {
            return assignmentNodeId.equals(visibleNodeId)
                    || (!assignmentNodeId.equals(visibleNodeId) && assignmentNodeId.equals(hierarchyNodeId));
        }
        if (ServiceNodeTypes.HEAD_COMPANY.equals(assignmentType) || ServiceNodeTypes.STORE.equals(assignmentType)) {
            return assignmentNodeId.equals(visibleNodeId);
        }
        if (!ServiceNodeTypes.REGION.equals(assignmentType)) return false;
        UUID current = hierarchyNodeId;
        Set<UUID> visited = new HashSet<>();
        while (current != null && visited.add(current)) {
            if (assignmentNodeId.equals(current)) return true;
            HierarchyNode node = nodes.get(current);
            current = node == null ? null : node.parentId();
        }
        return false;
    }

    private static List<String> ancestorNames(UUID nodeId, Map<UUID, HierarchyNode> nodes) {
        List<String> path = new ArrayList<>();
        Set<UUID> visited = new HashSet<>();
        UUID current = nodeId;
        while (current != null && visited.add(current)) {
            HierarchyNode node = nodes.get(current);
            if (node == null) break;
            path.add(node.name());
            current = node.parentId();
        }
        Collections.reverse(path);
        return List.copyOf(path);
    }

    private record HierarchyNode(UUID id, String type, String code, String name, UUID parentId, String status) {}

    private record Store(UUID id, String code, String name, UUID projectId, UUID headCompanyId, String status) {}

    private record HeadCompany(UUID id, String code, String name) {}
}
