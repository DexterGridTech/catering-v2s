package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.OrganizationVisibilityLookup;
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
        UUID workspaceUuid,
        String key,
        String assignmentType,
        UUID assignmentNode,
        UUID visibleNode
    ) {
        if (visibleNode == null) return false;
        if ("GROUP".equals(assignmentType)) {
            Boolean visible = jdbc.query(
                "SELECT EXISTS(SELECT 1 FROM organization.organization_node WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND status='ENABLED') OR EXISTS(SELECT 1 FROM organization.store WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND status='ENABLED')",
                statement -> {
                    statement.setObject(1, visibleNode); statement.setObject(2, workspaceUuid); statement.setString(3, key);
                    statement.setObject(4, visibleNode); statement.setObject(5, workspaceUuid); statement.setString(6, key);
                },
                result -> result.next() && result.getBoolean(1)
            );
            return Boolean.TRUE.equals(visible);
        }
        if ("PROJECT".equals(assignmentType) || "HEAD_COMPANY".equals(assignmentType) || "STORE".equals(assignmentType)) {
            return assignmentNode.equals(visibleNode);
        }
        UUID candidateHierarchyNode = jdbc.query(
            "SELECT COALESCE((SELECT project_id FROM organization.store WHERE id=? AND workspace_uuid=? AND group_workspace_key=?), ?) AS node_id",
            statement -> {
                statement.setObject(1, visibleNode);
                statement.setObject(2, workspaceUuid);
                statement.setString(3, key);
                statement.setObject(4, visibleNode);
            },
            result -> {
                result.next();
                return result.getObject(1, UUID.class);
            }
        );
        Boolean allowed = jdbc.query(
            "WITH RECURSIVE ancestry AS (SELECT id, parent_id FROM organization.organization_node WHERE id=? AND workspace_uuid=? AND group_workspace_key=? UNION ALL SELECT parent.id, parent.parent_id FROM organization.organization_node parent JOIN ancestry child ON child.parent_id=parent.id) SELECT EXISTS(SELECT 1 FROM ancestry WHERE id=?)",
            statement -> {
                statement.setObject(1, candidateHierarchyNode);
                statement.setObject(2, workspaceUuid);
                statement.setString(3, key);
                statement.setObject(4, assignmentNode);
            },
            result -> result.next() && result.getBoolean(1)
        );
        return Boolean.TRUE.equals(allowed);
    }

    @Override
    @Transactional(readOnly = true)
    public List<VisibleDataNodeCandidate> listVisibleDataNodeCandidates(
        UUID workspaceUuid,
        String key,
        String assignmentNodeType,
        UUID assignmentNodeId
    ) {
        List<HierarchyNode> hierarchy = jdbc.query(
            "SELECT id, node_type, code, name, parent_id, status FROM organization.organization_node WHERE workspace_uuid=? AND group_workspace_key=? ORDER BY node_type, code",
            (row, index) -> new HierarchyNode(row.getObject(1, UUID.class), row.getString(2), row.getString(3), row.getString(4), row.getObject(5, UUID.class), row.getString(6)),
            workspaceUuid,
            key
        );
        Map<UUID, HierarchyNode> nodes = new LinkedHashMap<>();
        hierarchy.forEach(node -> nodes.put(node.id(), node));
        List<VisibleDataNodeCandidate> result = new ArrayList<>();
        hierarchy.stream()
            .filter(node -> "ENABLED".equals(node.status()))
            .filter(node -> visible(assignmentNodeType, assignmentNodeId, node.id(), nodes))
            .forEach(node -> result.add(new VisibleDataNodeCandidate(
                node.type(), node.id(), node.name(), node.code(), ancestorNames(node.id(), nodes),
                "REGION".equals(node.type()) ? node.id() : "PROJECT".equals(node.type()) ? node.parentId() : null,
                "PROJECT".equals(node.type()) ? node.id() : null,
                null,
                null
            )));
        List<Store> stores = jdbc.query(
            "SELECT id, code, name, project_id, status FROM organization.store WHERE workspace_uuid=? AND group_workspace_key=? ORDER BY code",
            (row, index) -> new Store(row.getObject(1, UUID.class), row.getString(2), row.getString(3), row.getObject(4, UUID.class), row.getString(5)),
            workspaceUuid,
            key
        );
        stores.stream()
            .filter(store -> "ENABLED".equals(store.status()))
            .filter(store -> visible(assignmentNodeType, assignmentNodeId, store.id(), nodes, store.projectId()))
            .forEach(store -> {
                HierarchyNode project = nodes.get(store.projectId());
                if (project == null) return;
                List<String> path = new ArrayList<>(ancestorNames(project.id(), nodes));
                path.add(store.name());
                result.add(new VisibleDataNodeCandidate("STORE", store.id(), store.name(), store.code(), List.copyOf(path), project.parentId(), project.id(), store.id(), null));
            });
        if ("GROUP".equals(assignmentNodeType) || "HEAD_COMPANY".equals(assignmentNodeType)) {
            String headCompanyQuery = "SELECT id, code, name FROM organization.head_company WHERE workspace_uuid=? AND group_workspace_key=? AND status='ENABLED'" + ("HEAD_COMPANY".equals(assignmentNodeType) ? " AND id=?" : "") + " ORDER BY code";
            Object[] arguments = "HEAD_COMPANY".equals(assignmentNodeType)
                ? new Object[] {workspaceUuid, key, assignmentNodeId}
                : new Object[] {workspaceUuid, key};
            jdbc.query(
                headCompanyQuery,
                row -> {
                    UUID id = row.getObject(1, UUID.class);
                    if (visible(assignmentNodeType, assignmentNodeId, id, nodes)) {
                        result.add(new VisibleDataNodeCandidate("HEAD_COMPANY", id, row.getString(3), row.getString(2), List.of(row.getString(3)), null, null, null, id));
                    }
                },
                arguments
            );
        }
        return List.copyOf(result);
    }

    @Override
    @Transactional(readOnly = true)
    public ScopeContext describeScopeContext(UUID workspaceUuid, String key, UUID regionId, UUID projectId, UUID storeId, UUID headCompanyId) {
        Map<UUID, HierarchyNode> nodes = hierarchy(workspaceUuid, key);
        VisibleDataNodeCandidate region = hierarchyContext(nodes, "REGION", regionId);
        VisibleDataNodeCandidate project = hierarchyContext(nodes, "PROJECT", projectId);
        VisibleDataNodeCandidate store = storeContext(workspaceUuid, key, nodes, storeId);
        VisibleDataNodeCandidate headCompany = headCompanyContext(workspaceUuid, key, headCompanyId);
        return new ScopeContext(region, project, store, headCompany);
    }

    private Map<UUID, HierarchyNode> hierarchy(UUID workspaceUuid, String key) {
        Map<UUID, HierarchyNode> nodes = new LinkedHashMap<>();
        jdbc.query(
            "SELECT id, node_type, code, name, parent_id, status FROM organization.organization_node WHERE workspace_uuid=? AND group_workspace_key=?",
            (row, index) -> new HierarchyNode(row.getObject(1, UUID.class), row.getString(2), row.getString(3), row.getString(4), row.getObject(5, UUID.class), row.getString(6)),
            workspaceUuid,
            key
        ).forEach(node -> nodes.put(node.id(), node));
        return nodes;
    }

    private static VisibleDataNodeCandidate hierarchyContext(Map<UUID, HierarchyNode> nodes, String type, UUID id) {
        HierarchyNode node = id == null ? null : nodes.get(id);
        if (node == null || !type.equals(node.type()) || !"ENABLED".equals(node.status())) return null;
        UUID regionId = "REGION".equals(type) ? node.id() : node.parentId();
        return new VisibleDataNodeCandidate(type, node.id(), node.name(), node.code(), ancestorNames(node.id(), nodes), regionId, "PROJECT".equals(type) ? node.id() : null, null, null);
    }

    private VisibleDataNodeCandidate storeContext(UUID workspaceUuid, String key, Map<UUID, HierarchyNode> nodes, UUID storeId) {
        if (storeId == null) return null;
        return jdbc.query(
            "SELECT id, code, name, project_id, status FROM organization.store WHERE id=? AND workspace_uuid=? AND group_workspace_key=?",
            statement -> { statement.setObject(1, storeId); statement.setObject(2, workspaceUuid); statement.setString(3, key); },
            result -> {
                if (!result.next() || !"ENABLED".equals(result.getString(5))) return null;
                HierarchyNode project = nodes.get(result.getObject(4, UUID.class));
                if (project == null || !"PROJECT".equals(project.type()) || !"ENABLED".equals(project.status())) return null;
                List<String> path = new ArrayList<>(ancestorNames(project.id(), nodes));
                path.add(result.getString(3));
                return new VisibleDataNodeCandidate("STORE", result.getObject(1, UUID.class), result.getString(3), result.getString(2), List.copyOf(path), project.parentId(), project.id(), result.getObject(1, UUID.class), null);
            }
        );
    }

    private VisibleDataNodeCandidate headCompanyContext(UUID workspaceUuid, String key, UUID headCompanyId) {
        if (headCompanyId == null) return null;
        return jdbc.query(
            "SELECT id, code, name FROM organization.head_company WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND status='ENABLED'",
            statement -> { statement.setObject(1, headCompanyId); statement.setObject(2, workspaceUuid); statement.setString(3, key); },
            result -> result.next() ? new VisibleDataNodeCandidate("HEAD_COMPANY", result.getObject(1, UUID.class), result.getString(3), result.getString(2), List.of(result.getString(3)), null, null, null, result.getObject(1, UUID.class)) : null
        );
    }

    private static boolean visible(String assignmentType, UUID assignmentNodeId, UUID visibleNodeId, Map<UUID, HierarchyNode> nodes) {
        return visible(assignmentType, assignmentNodeId, visibleNodeId, nodes, visibleNodeId);
    }

    private static boolean visible(String assignmentType, UUID assignmentNodeId, UUID visibleNodeId, Map<UUID, HierarchyNode> nodes, UUID hierarchyNodeId) {
        if (visibleNodeId == null || assignmentNodeId == null) return false;
        if ("GROUP".equals(assignmentType)) return true;
        if ("PROJECT".equals(assignmentType) || "HEAD_COMPANY".equals(assignmentType) || "STORE".equals(assignmentType)) {
            return assignmentNodeId.equals(visibleNodeId);
        }
        if (!"REGION".equals(assignmentType)) return false;
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

    private record HierarchyNode(UUID id, String type, String code, String name, UUID parentId, String status) { }
    private record Store(UUID id, String code, String name, UUID projectId, String status) { }
}
