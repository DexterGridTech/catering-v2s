package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import java.sql.Array;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Resolves only organization-owned task facts; consumers receive no schema access. */
@Service
public class OrganizationTaskPathService implements OrganizationTaskPathLookup {
    private final JdbcTemplate jdbc;
    private final CommercialGroupLookup groups;

    public OrganizationTaskPathService(JdbcTemplate jdbc, CommercialGroupLookup groups) {
        this.jdbc = jdbc;
        this.groups = groups;
    }

    @Override
    @Transactional(readOnly = true)
    public TaskPath requireTaskPath(UUID workspaceUuid, String key, String targetType, UUID targetId) {
        if (workspaceUuid == null || key == null || targetId == null) throw new TaskPathNotFoundException();
        UUID groupId = groups.requireCommercialGroupRef(workspaceUuid, key);
        return switch (targetType) {
            case "GROUP" -> groupPath(workspaceUuid, key, groupId, targetId);
            case "REGION" -> nodePath(workspaceUuid, key, groupId, targetId, "REGION");
            case "PROJECT" -> nodePath(workspaceUuid, key, groupId, targetId, "PROJECT");
            case "HEAD_COMPANY" -> headCompanyPath(workspaceUuid, key, groupId, targetId);
            case "STORE" -> storePath(workspaceUuid, key, groupId, targetId);
            default -> throw new TaskPathNotFoundException();
        };
    }

    /**
     * Bounded display-path resolution for list/readback callers.  The owner performs
     * one read per physical target family, rather than making consumer loops infer
     * hierarchy through repeated scalar owner calls.
     */
    @Override
    @Transactional(readOnly = true)
    public Map<TaskPathRef, TaskPath> requireTaskPaths(UUID workspaceUuid, String key, List<TaskPathRef> targets) {
        if (workspaceUuid == null || key == null || targets == null) throw new TaskPathNotFoundException();
        LinkedHashSet<TaskPathRef> requested = new LinkedHashSet<>(targets);
        if (requested.isEmpty()) return Map.of();
        for (TaskPathRef target : requested) {
            if (target == null || target.targetId() == null || !Set.of("GROUP", "REGION", "PROJECT", "HEAD_COMPANY", "STORE").contains(target.targetType())) throw new TaskPathNotFoundException();
        }
        UUID groupId = groups.requireCommercialGroupRef(workspaceUuid, key);
        LinkedHashMap<TaskPathRef, TaskPath> result = new LinkedHashMap<>();

        Set<UUID> storeIds = idsFor(requested, "STORE");
        Map<UUID, Store> stores = stores(workspaceUuid, key, storeIds);
        if (stores.size() != storeIds.size()) throw new TaskPathNotFoundException();

        Set<UUID> headCompanyIds = idsFor(requested, "HEAD_COMPANY");
        Map<UUID, Entity> headCompanies = headCompanies(workspaceUuid, key, headCompanyIds);
        if (headCompanies.size() != headCompanyIds.size()) throw new TaskPathNotFoundException();

        Set<UUID> nodeIds = new LinkedHashSet<>();
        nodeIds.addAll(idsFor(requested, "REGION"));
        nodeIds.addAll(idsFor(requested, "PROJECT"));
        stores.values().forEach(store -> nodeIds.add(store.projectId()));
        Map<UUID, NodePath> nodes = nodePaths(workspaceUuid, key, groupId, nodeIds);

        for (TaskPathRef target : requested) {
            switch (target.targetType()) {
                case "GROUP" -> {
                    if (!groupId.equals(target.targetId())) throw new TaskPathNotFoundException();
                    result.put(target, new TaskPath("GROUP", groupId, List.of(groupId), groups.describeCommercialGroup(workspaceUuid, key, groupId)));
                }
                case "REGION", "PROJECT" -> {
                    NodePath node = nodes.get(target.targetId());
                    if (node == null || !target.targetType().equals(node.type())) throw new TaskPathNotFoundException();
                    result.put(target, node.taskPath());
                }
                case "HEAD_COMPANY" -> {
                    Entity headCompany = headCompanies.get(target.targetId());
                    result.put(target, new TaskPath("HEAD_COMPANY", headCompany.id(), List.of(groupId, headCompany.id()), headCompany.code() + " " + headCompany.name()));
                }
                case "STORE" -> {
                    Store store = stores.get(target.targetId());
                    NodePath project = nodes.get(store.projectId());
                    if (project == null || !"PROJECT".equals(project.type())) throw new TaskPathNotFoundException();
                    List<UUID> ancestors = new ArrayList<>(project.taskPath().ancestorIds());
                    ancestors.add(store.id());
                    result.put(target, new TaskPath("STORE", store.id(), ancestors, project.taskPath().displayPath() + " / " + store.code() + " " + store.name()));
                }
                default -> throw new TaskPathNotFoundException();
            }
        }
        return Map.copyOf(result);
    }

    @Override
    @Transactional(readOnly = true)
    public Set<TaskPathRef> availableTaskTargets(UUID workspaceUuid, String key, List<TaskPathRef> targets) {
        if (workspaceUuid == null || key == null || targets == null) return Set.of();
        LinkedHashSet<TaskPathRef> requested = new LinkedHashSet<>(targets);
        if (requested.isEmpty()) return Set.of();
        if (requested.stream().anyMatch(target -> target == null || target.targetId() == null || !Set.of("GROUP", "REGION", "PROJECT", "HEAD_COMPANY", "STORE").contains(target.targetType()))) return Set.of();
        LinkedHashSet<TaskPathRef> available = new LinkedHashSet<>();
        for (TaskPathRef group : requested.stream().filter(target -> "GROUP".equals(target.targetType())).toList()) {
            if (groups.isEnterableCommercialGroup(workspaceUuid, key, group.targetId())) available.add(group);
        }
        available.addAll(availableNodes(workspaceUuid, key, requested));
        available.addAll(availableEntities(workspaceUuid, key, requested, "HEAD_COMPANY", "head_company"));
        available.addAll(availableEntities(workspaceUuid, key, requested, "STORE", "store"));
        return Set.copyOf(available);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<TaskPathRef, String> describeTaskTargetLabels(UUID workspaceUuid, String key, List<TaskPathRef> targets) {
        if (workspaceUuid == null || key == null || targets == null) throw new TaskPathNotFoundException();
        LinkedHashSet<TaskPathRef> requested = new LinkedHashSet<>(targets);
        if (requested.isEmpty()) return Map.of();
        if (requested.stream().anyMatch(target -> target == null || target.targetId() == null
            || !Set.of("GROUP", "REGION", "PROJECT", "HEAD_COMPANY", "STORE").contains(target.targetType()))) {
            throw new TaskPathNotFoundException();
        }

        UUID groupId = groups.requireCommercialGroupRef(workspaceUuid, key);
        LinkedHashMap<TaskPathRef, String> labels = new LinkedHashMap<>();
        for (TaskPathRef group : requested.stream().filter(target -> "GROUP".equals(target.targetType())).toList()) {
            if (!groupId.equals(group.targetId())) throw new TaskPathNotFoundException();
            labels.put(group, groups.describeCommercialGroup(workspaceUuid, key, groupId));
        }

        Set<UUID> nodeIds = new LinkedHashSet<>();
        nodeIds.addAll(idsFor(requested, "REGION"));
        nodeIds.addAll(idsFor(requested, "PROJECT"));
        if (!nodeIds.isEmpty()) {
            List<Node> nodes = jdbc.query(
                "SELECT id, parent_id, node_type, code, name FROM organization.organization_node WHERE workspace_uuid=? AND group_workspace_key=? AND status='ENABLED' AND id IN (" + placeholders(nodeIds.size()) + ")",
                (row, index) -> new Node(row.getObject(1, UUID.class), row.getObject(2, UUID.class), row.getString(3), row.getString(4), row.getString(5)),
                arguments(workspaceUuid, key, nodeIds)
            );
            for (Node node : nodes) {
                TaskPathRef ref = new TaskPathRef(node.type(), node.id());
                if (requested.contains(ref)) labels.put(ref, node.name());
            }
        }

        Set<UUID> headCompanyIds = idsFor(requested, "HEAD_COMPANY");
        for (Entity entity : headCompanies(workspaceUuid, key, headCompanyIds).values()) {
            labels.put(new TaskPathRef("HEAD_COMPANY", entity.id()), entity.code() + " " + entity.name());
        }

        Set<UUID> storeIds = idsFor(requested, "STORE");
        Map<UUID, Store> stores = stores(workspaceUuid, key, storeIds);
        Map<UUID, NodePath> projects = nodePaths(
            workspaceUuid, key, groupId, stores.values().stream().map(Store::projectId).collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new))
        );
        for (Store store : stores.values()) {
            NodePath project = projects.get(store.projectId());
            if (project == null || !"PROJECT".equals(project.type())) throw new TaskPathNotFoundException();
            labels.put(new TaskPathRef("STORE", store.id()), project.taskPath().displayPath() + " / " + store.code() + " " + store.name());
        }
        if (labels.size() != requested.size()) throw new TaskPathNotFoundException();
        return Map.copyOf(labels);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isScopeAllowed(UUID workspaceUuid, String key, String assignmentType, UUID assignmentId, TaskPath target) {
        if (workspaceUuid == null || key == null || assignmentType == null || assignmentId == null || target == null
            || target.ancestorIds().isEmpty() || !target.ancestorIds().contains(target.targetId())) return false;
        return switch (assignmentType) {
            case "GROUP", "REGION", "PROJECT" -> target.ancestorIds().contains(assignmentId);
            case "HEAD_COMPANY", "STORE" -> assignmentType.equals(target.targetType()) && assignmentId.equals(target.targetId());
            default -> false;
        };
    }

    private TaskPath groupPath(UUID workspaceUuid, String key, UUID groupId, UUID targetId) {
        if (!groupId.equals(targetId)) throw new TaskPathNotFoundException();
        return new TaskPath("GROUP", groupId, List.of(groupId), groups.describeCommercialGroup(workspaceUuid, key, groupId));
    }

    private TaskPath nodePath(UUID workspaceUuid, String key, UUID groupId, UUID targetId, String expectedType) {
        Node target = node(workspaceUuid, key, targetId, expectedType);
        if ("REGION".equals(expectedType)) {
            return new TaskPath("REGION", target.id(), List.of(groupId, target.id()), target.code() + " " + target.name());
        }
        Node region = node(workspaceUuid, key, target.parentId(), "REGION");
        return new TaskPath("PROJECT", target.id(), List.of(groupId, region.id(), target.id()), region.code() + " " + region.name() + " / " + target.code() + " " + target.name());
    }

    private TaskPath headCompanyPath(UUID workspaceUuid, String key, UUID groupId, UUID targetId) {
        Entity target = entity(workspaceUuid, key, targetId, "head_company");
        return new TaskPath("HEAD_COMPANY", target.id(), List.of(groupId, target.id()), target.code() + " " + target.name());
    }

    private TaskPath storePath(UUID workspaceUuid, String key, UUID groupId, UUID targetId) {
        Store target = jdbc.query(
            "SELECT id, project_id, code, name FROM organization.store WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND status='ENABLED'",
            statement -> { statement.setObject(1, targetId); statement.setObject(2, workspaceUuid); statement.setString(3, key); },
            result -> result.next() ? new Store(result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3), result.getString(4)) : null
        );
        if (target == null) throw new TaskPathNotFoundException();
        Node project = node(workspaceUuid, key, target.projectId(), "PROJECT");
        Node region = node(workspaceUuid, key, project.parentId(), "REGION");
        return new TaskPath("STORE", target.id(), List.of(groupId, region.id(), project.id(), target.id()), region.code() + " " + region.name() + " / " + project.code() + " " + project.name() + " / " + target.code() + " " + target.name());
    }

    private Map<UUID, Store> stores(UUID workspaceUuid, String key, Set<UUID> ids) {
        if (ids.isEmpty()) return Map.of();
        List<Store> values = jdbc.query(
            "SELECT id, project_id, code, name FROM organization.store WHERE workspace_uuid=? AND group_workspace_key=? AND status='ENABLED' AND id IN (" + placeholders(ids.size()) + ")",
            (row, index) -> new Store(row.getObject(1, UUID.class), row.getObject(2, UUID.class), row.getString(3), row.getString(4)),
            arguments(workspaceUuid, key, ids)
        );
        LinkedHashMap<UUID, Store> result = new LinkedHashMap<>();
        values.forEach(value -> result.put(value.id(), value));
        return Map.copyOf(result);
    }

    private Map<UUID, Entity> headCompanies(UUID workspaceUuid, String key, Set<UUID> ids) {
        if (ids.isEmpty()) return Map.of();
        List<Entity> values = jdbc.query(
            "SELECT id, code, name FROM organization.head_company WHERE workspace_uuid=? AND group_workspace_key=? AND status='ENABLED' AND id IN (" + placeholders(ids.size()) + ")",
            (row, index) -> new Entity(row.getObject(1, UUID.class), row.getString(2), row.getString(3)),
            arguments(workspaceUuid, key, ids)
        );
        LinkedHashMap<UUID, Entity> result = new LinkedHashMap<>();
        values.forEach(value -> result.put(value.id(), value));
        return Map.copyOf(result);
    }

    private Map<UUID, NodePath> nodePaths(UUID workspaceUuid, String key, UUID groupId, Set<UUID> ids) {
        if (ids.isEmpty()) return Map.of();
        Map<UUID, NodePath> values = jdbc.query(
            "WITH RECURSIVE ancestry AS (" +
                "SELECT node.id AS target_id, node.id, node.parent_id, node.node_type, node.code, node.name, 0 AS depth " +
                "FROM organization.organization_node node WHERE node.workspace_uuid=? AND node.group_workspace_key=? AND node.status='ENABLED' AND node.id IN (" + placeholders(ids.size()) + ") " +
                "UNION ALL " +
                "SELECT ancestry.target_id, parent.id, parent.parent_id, parent.node_type, parent.code, parent.name, ancestry.depth + 1 " +
                "FROM organization.organization_node parent JOIN ancestry ON ancestry.parent_id=parent.id " +
                "WHERE parent.workspace_uuid=? AND parent.group_workspace_key=? AND parent.status='ENABLED'" +
            ") SELECT target_id, max(node_type) FILTER (WHERE depth=0) AS target_type, array_agg(id ORDER BY depth DESC) AS ancestor_ids, string_agg(code || ' ' || name, ' / ' ORDER BY depth DESC) AS display_path FROM ancestry GROUP BY target_id",
            statement -> bind(statement, workspaceUuid, key, ids, workspaceUuid, key),
            result -> {
                LinkedHashMap<UUID, NodePath> paths = new LinkedHashMap<>();
                while (result.next()) {
                    UUID targetId = result.getObject("target_id", UUID.class);
                    Array array = result.getArray("ancestor_ids");
                    Object[] pathIds = (Object[]) array.getArray();
                    List<UUID> ancestors = new ArrayList<>(pathIds.length + 1);
                    ancestors.add(groupId);
                    for (Object value : pathIds) ancestors.add((UUID) value);
                    paths.put(targetId, new NodePath(result.getString("target_type"), new TaskPath(result.getString("target_type"), targetId, ancestors, result.getString("display_path"))));
                }
                return paths;
            }
        );
        if (values == null) throw new TaskPathNotFoundException();
        return Map.copyOf(values);
    }

    private static Set<UUID> idsFor(Set<TaskPathRef> targets, String type) {
        LinkedHashSet<UUID> ids = new LinkedHashSet<>();
        targets.stream().filter(target -> type.equals(target.targetType())).forEach(target -> ids.add(target.targetId()));
        return ids;
    }

    private Set<TaskPathRef> availableNodes(UUID workspaceUuid, String key, Set<TaskPathRef> targets) {
        Set<UUID> ids = new LinkedHashSet<>();
        targets.stream().filter(target -> "REGION".equals(target.targetType()) || "PROJECT".equals(target.targetType())).forEach(target -> ids.add(target.targetId()));
        if (ids.isEmpty()) return Set.of();
        List<TaskPathRef> values = jdbc.query(
            "SELECT id, node_type FROM organization.organization_node WHERE workspace_uuid=? AND group_workspace_key=? AND status='ENABLED' AND id IN (" + placeholders(ids.size()) + ")",
            (row, index) -> new TaskPathRef(row.getString(2), row.getObject(1, UUID.class)),
            arguments(workspaceUuid, key, ids)
        );
        return Set.copyOf(values);
    }

    private Set<TaskPathRef> availableEntities(UUID workspaceUuid, String key, Set<TaskPathRef> targets, String targetType, String table) {
        Set<UUID> ids = idsFor(targets, targetType);
        if (ids.isEmpty()) return Set.of();
        List<TaskPathRef> values = jdbc.query(
            "SELECT id FROM organization." + table + " WHERE workspace_uuid=? AND group_workspace_key=? AND status='ENABLED' AND id IN (" + placeholders(ids.size()) + ")",
            (row, index) -> new TaskPathRef(targetType, row.getObject(1, UUID.class)),
            arguments(workspaceUuid, key, ids)
        );
        return Set.copyOf(values);
    }

    private static String placeholders(int count) { return String.join(",", java.util.Collections.nCopies(count, "?")); }

    private static Object[] arguments(UUID workspaceUuid, String key, Set<UUID> ids) {
        List<Object> values = new ArrayList<>(); values.add(workspaceUuid); values.add(key); values.addAll(ids); return values.toArray();
    }

    private static void bind(java.sql.PreparedStatement statement, UUID workspaceUuid, String key, Set<UUID> ids, UUID parentWorkspaceUuid, String parentKey) throws java.sql.SQLException {
        int index = 1; statement.setObject(index++, workspaceUuid); statement.setString(index++, key);
        for (UUID id : ids) statement.setObject(index++, id);
        statement.setObject(index++, parentWorkspaceUuid); statement.setString(index, parentKey);
    }

    private Node node(UUID workspaceUuid, String key, UUID id, String expectedType) {
        Node result = jdbc.query(
            "SELECT id, parent_id, node_type, code, name FROM organization.organization_node WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND status='ENABLED'",
            statement -> { statement.setObject(1, id); statement.setObject(2, workspaceUuid); statement.setString(3, key); },
            row -> row.next() ? new Node(row.getObject(1, UUID.class), row.getObject(2, UUID.class), row.getString(3), row.getString(4), row.getString(5)) : null
        );
        if (result == null || !expectedType.equals(result.type())) throw new TaskPathNotFoundException();
        return result;
    }

    private Entity entity(UUID workspaceUuid, String key, UUID id, String table) {
        Entity result = jdbc.query(
            "SELECT id, code, name FROM organization." + table + " WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND status='ENABLED'",
            statement -> { statement.setObject(1, id); statement.setObject(2, workspaceUuid); statement.setString(3, key); },
            row -> row.next() ? new Entity(row.getObject(1, UUID.class), row.getString(2), row.getString(3)) : null
        );
        if (result == null) throw new TaskPathNotFoundException();
        return result;
    }

    private record Node(UUID id, UUID parentId, String type, String code, String name) { }
    private record Store(UUID id, UUID projectId, String code, String name) { }
    private record Entity(UUID id, String code, String name) { }
    private record NodePath(String type, TaskPath taskPath) { }
    public static final class TaskPathNotFoundException extends RuntimeException { }
}
