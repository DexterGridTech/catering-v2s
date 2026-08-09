package com.catering.v2s.organization.application;

import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.organization.api.OrganizationNodeTypes;

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
            case ServiceNodeTypes.GROUP -> groupPath(workspaceUuid, key, groupId, targetId);
            case ServiceNodeTypes.REGION -> nodePath(workspaceUuid, key, groupId, targetId, ServiceNodeTypes.REGION);
            case ServiceNodeTypes.PROJECT -> nodePath(workspaceUuid, key, groupId, targetId, ServiceNodeTypes.PROJECT);
            case ServiceNodeTypes.HEAD_COMPANY -> headCompanyPath(workspaceUuid, key, groupId, targetId);
            case ServiceNodeTypes.STORE -> storePath(workspaceUuid, key, groupId, targetId);
            default -> throw new TaskPathNotFoundException();
        };
    }

    /**
     * Status-transition authority is the only command branch that may resolve a disabled
     * persisted task target. Read, session, and candidate callers remain enabled-only.
     */
    @Override
    @Transactional(readOnly = true)
    public TaskPath requireStatusTransitionTaskPath(UUID workspaceUuid, String key, String targetType, UUID targetId) {
        TaskPathRef target = new TaskPathRef(targetType, targetId);
        TaskPath taskPath = resolveTaskPaths(workspaceUuid, key, List.of(target), true).get(target);
        if (taskPath == null) throw new TaskPathNotFoundException();
        return taskPath;
    }

    /** Bounded enabled task-path resolution for authority, candidate, and session callers. */
    @Override
    @Transactional(readOnly = true)
    public Map<TaskPathRef, TaskPath> requireTaskPaths(UUID workspaceUuid, String key, List<TaskPathRef> targets) {
        return resolveTaskPaths(workspaceUuid, key, targets, false);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<TaskPathRef, TaskPath> describePersistedTaskPaths(UUID workspaceUuid, String key, List<TaskPathRef> targets) {
        if (workspaceUuid == null || key == null || targets == null) throw new TaskPathNotFoundException();
        LinkedHashSet<TaskPathRef> requested = validatedTargets(targets);
        if (requested.isEmpty()) return Map.of();
        Map<TaskPathRef, TaskPath> result = jdbc.query(
            persistedTaskPathsSql(),
            statement -> bindPersistedTaskPaths(statement, workspaceUuid, key, requested),
            rows -> {
                LinkedHashMap<TaskPathRef, TaskPath> paths = new LinkedHashMap<>();
                while (rows.next()) {
                    TaskPathRef target = new TaskPathRef(rows.getString("target_type"), rows.getObject("target_id", UUID.class));
                    Array array = rows.getArray("ancestor_ids");
                    Object[] values = (Object[]) array.getArray();
                    List<UUID> ancestors = new ArrayList<>(values.length);
                    for (Object value : values) ancestors.add((UUID) value);
                    if (paths.put(target, new TaskPath(target.targetType(), target.targetId(), ancestors, rows.getString("display_path"))) != null) {
                        throw new TaskPathNotFoundException();
                    }
                }
                return Map.copyOf(paths);
            }
        );
        if (result == null || result.size() != requested.size() || !result.keySet().equals(requested)) throw new TaskPathNotFoundException();
        return result;
    }

    /**
     * The persisted presentation branch is intentionally confined here. Callers must use
     * requireTaskPaths for enabled authority, candidate, and session decisions.
     */
    private Map<TaskPathRef, TaskPath> resolveTaskPaths(UUID workspaceUuid, String key, List<TaskPathRef> targets, boolean includeDisabledFacts) {
        if (workspaceUuid == null || key == null || targets == null) throw new TaskPathNotFoundException();
        LinkedHashSet<TaskPathRef> requested = validatedTargets(targets);
        if (requested.isEmpty()) return Map.of();
        UUID groupId = groups.requireCommercialGroupRef(workspaceUuid, key);
        LinkedHashMap<TaskPathRef, TaskPath> result = new LinkedHashMap<>();

        Set<UUID> storeIds = idsFor(requested, ServiceNodeTypes.STORE);
        Map<UUID, Store> stores = stores(workspaceUuid, key, storeIds, includeDisabledFacts);
        if (stores.size() != storeIds.size()) throw new TaskPathNotFoundException();

        Set<UUID> headCompanyIds = idsFor(requested, ServiceNodeTypes.HEAD_COMPANY);
        Map<UUID, Entity> headCompanies = headCompanies(workspaceUuid, key, headCompanyIds, includeDisabledFacts);
        if (headCompanies.size() != headCompanyIds.size()) throw new TaskPathNotFoundException();

        Set<UUID> nodeIds = new LinkedHashSet<>();
        nodeIds.addAll(idsFor(requested, ServiceNodeTypes.REGION));
        nodeIds.addAll(idsFor(requested, ServiceNodeTypes.PROJECT));
        stores.values().forEach(store -> nodeIds.add(store.projectId()));
        Map<UUID, NodePath> nodes = nodePaths(workspaceUuid, key, groupId, nodeIds, includeDisabledFacts);

        for (TaskPathRef target : requested) {
            switch (target.targetType()) {
                case ServiceNodeTypes.GROUP -> {
                    if (!groupId.equals(target.targetId())) throw new TaskPathNotFoundException();
                    result.put(target, new TaskPath(ServiceNodeTypes.GROUP, groupId, List.of(groupId), groups.describeCommercialGroup(workspaceUuid, key, groupId)));
                }
                case ServiceNodeTypes.REGION, ServiceNodeTypes.PROJECT -> {
                    NodePath node = nodes.get(target.targetId());
                    if (node == null || !target.targetType().equals(node.type())) throw new TaskPathNotFoundException();
                    result.put(target, node.taskPath());
                }
                case ServiceNodeTypes.HEAD_COMPANY -> {
                    Entity headCompany = headCompanies.get(target.targetId());
                    result.put(target, new TaskPath(ServiceNodeTypes.HEAD_COMPANY, headCompany.id(), List.of(groupId, headCompany.id()), headCompany.code() + " " + headCompany.name()));
                }
                case ServiceNodeTypes.STORE -> {
                    Store store = stores.get(target.targetId());
                    NodePath project = nodes.get(store.projectId());
                    if (project == null || !OrganizationNodeTypes.PROJECT.equals(project.type())) throw new TaskPathNotFoundException();
                    List<UUID> ancestors = new ArrayList<>(project.taskPath().ancestorIds());
                    ancestors.add(store.id());
                    result.put(target, new TaskPath(ServiceNodeTypes.STORE, store.id(), ancestors, project.taskPath().displayPath() + " / " + store.code() + " " + store.name()));
                }
                default -> throw new TaskPathNotFoundException();
            }
        }
        return Map.copyOf(result);
    }

    /**
     * Presentation-only persisted display needs one organization logical statement even when
     * a page mixes every target family. Authority callers intentionally retain resolveTaskPaths.
     */
    private static String persistedTaskPathsSql() {
        return "WITH RECURSIVE requested(target_type, target_id) AS ("
            + "SELECT target_type, target_id FROM jsonb_to_recordset(?::jsonb) AS request(target_type text, target_id uuid)"
            + "), commercial_group AS ("
            + "SELECT commercial_group_uuid AS id, commercial_group_code, commercial_group_name FROM organization.commercial_group WHERE group_workspace_key=?"
            + "), target_rows AS ("
            + "SELECT requested.target_type, requested.target_id, commercial_group.id AS group_id, node.id AS node_id, head_company.id AS head_company_id, store.id AS store_id, store.project_id "
            + "FROM requested CROSS JOIN commercial_group "
            + "LEFT JOIN organization.organization_node node ON requested.target_type IN ('REGION','PROJECT') AND node.id=requested.target_id AND node.workspace_uuid=? AND node.group_workspace_key=? "
            + "LEFT JOIN organization.head_company head_company ON requested.target_type='HEAD_COMPANY' AND head_company.id=requested.target_id AND head_company.workspace_uuid=? AND head_company.group_workspace_key=? "
            + "LEFT JOIN organization.store store ON requested.target_type='STORE' AND store.id=requested.target_id AND store.workspace_uuid=? AND store.group_workspace_key=?"
            + "), node_seeds AS ("
            + "SELECT target_type, target_id, node.id, node.parent_id, node.code, node.name FROM target_rows JOIN organization.organization_node node ON node.id=target_rows.node_id "
            + "UNION ALL SELECT target_rows.target_type, target_rows.target_id, project.id, project.parent_id, project.code, project.name FROM target_rows JOIN organization.organization_node project ON project.id=target_rows.project_id AND project.workspace_uuid=? AND project.group_workspace_key=?"
            + "), ancestry AS ("
            + "SELECT target_type, target_id, id, parent_id, code, name, 0 AS depth FROM node_seeds "
            + "UNION ALL SELECT ancestry.target_type, ancestry.target_id, parent.id, parent.parent_id, parent.code, parent.name, ancestry.depth + 1 FROM organization.organization_node parent JOIN ancestry ON ancestry.parent_id=parent.id WHERE parent.workspace_uuid=? AND parent.group_workspace_key=?"
            + "), node_paths AS ("
            + "SELECT target_type, target_id, array_agg(id ORDER BY depth DESC) AS ancestor_ids, string_agg(code || ' ' || name, ' / ' ORDER BY depth DESC) AS display_path FROM ancestry GROUP BY target_type, target_id"
            + ") SELECT target_rows.target_type, target_rows.target_id, "
            + "CASE WHEN target_rows.target_type='GROUP' AND target_rows.target_id=target_rows.group_id THEN ARRAY[target_rows.group_id] "
            + "WHEN target_rows.target_type IN ('REGION','PROJECT') AND node_paths.target_id IS NOT NULL THEN array_prepend(target_rows.group_id, node_paths.ancestor_ids) "
            + "WHEN target_rows.target_type='HEAD_COMPANY' AND target_rows.head_company_id IS NOT NULL THEN ARRAY[target_rows.group_id, target_rows.head_company_id] "
            + "WHEN target_rows.target_type='STORE' AND target_rows.store_id IS NOT NULL AND node_paths.target_id IS NOT NULL THEN array_append(array_prepend(target_rows.group_id, node_paths.ancestor_ids), target_rows.store_id) END AS ancestor_ids, "
            + "CASE WHEN target_rows.target_type='GROUP' AND target_rows.target_id=target_rows.group_id THEN commercial_group.commercial_group_name || '（' || commercial_group.commercial_group_code || '）' "
            + "WHEN target_rows.target_type IN ('REGION','PROJECT') AND node_paths.target_id IS NOT NULL THEN node_paths.display_path "
            + "WHEN target_rows.target_type='HEAD_COMPANY' AND target_rows.head_company_id IS NOT NULL THEN head_company.code || ' ' || head_company.name "
            + "WHEN target_rows.target_type='STORE' AND target_rows.store_id IS NOT NULL AND node_paths.target_id IS NOT NULL THEN node_paths.display_path || ' / ' || store.code || ' ' || store.name END AS display_path "
            + "FROM target_rows CROSS JOIN commercial_group "
            + "LEFT JOIN node_paths ON node_paths.target_type=target_rows.target_type AND node_paths.target_id=target_rows.target_id "
            + "LEFT JOIN organization.head_company head_company ON head_company.id=target_rows.head_company_id "
            + "LEFT JOIN organization.store store ON store.id=target_rows.store_id "
            + "WHERE (target_rows.target_type='GROUP' AND target_rows.target_id=target_rows.group_id) "
            + "OR (target_rows.target_type IN ('REGION','PROJECT') AND node_paths.target_id IS NOT NULL) "
            + "OR (target_rows.target_type='HEAD_COMPANY' AND target_rows.head_company_id IS NOT NULL) "
            + "OR (target_rows.target_type='STORE' AND target_rows.store_id IS NOT NULL AND node_paths.target_id IS NOT NULL)";
    }

    private static LinkedHashSet<TaskPathRef> validatedTargets(List<TaskPathRef> targets) {
        LinkedHashSet<TaskPathRef> requested = new LinkedHashSet<>(targets);
        for (TaskPathRef target : requested) {
            if (target == null || target.targetId() == null || !Set.of(ServiceNodeTypes.GROUP, ServiceNodeTypes.REGION, ServiceNodeTypes.PROJECT, ServiceNodeTypes.HEAD_COMPANY, ServiceNodeTypes.STORE).contains(target.targetType())) {
                throw new TaskPathNotFoundException();
            }
        }
        return requested;
    }

    private static void bindPersistedTaskPaths(java.sql.PreparedStatement statement, UUID workspaceUuid, String key, Set<TaskPathRef> targets) throws java.sql.SQLException {
        statement.setString(1, persistedTargetJson(targets));
        statement.setString(2, key);
        int index = 3;
        for (int ownerPredicate = 0; ownerPredicate < 5; ownerPredicate++) {
            statement.setObject(index++, workspaceUuid);
            statement.setString(index++, key);
        }
    }

    private static String persistedTargetJson(Set<TaskPathRef> targets) {
        return targets.stream()
            .map(target -> "{\"target_type\":\"" + target.targetType() + "\",\"target_id\":\"" + target.targetId() + "\"}")
            .collect(java.util.stream.Collectors.joining(",", "[", "]"));
    }

    @Override
    @Transactional(readOnly = true)
    public Set<TaskPathRef> availableTaskTargets(UUID workspaceUuid, String key, List<TaskPathRef> targets) {
        if (workspaceUuid == null || key == null || targets == null) return Set.of();
        LinkedHashSet<TaskPathRef> requested = new LinkedHashSet<>(targets);
        if (requested.isEmpty()) return Set.of();
        if (requested.stream().anyMatch(target -> target == null || target.targetId() == null || !Set.of(ServiceNodeTypes.GROUP, ServiceNodeTypes.REGION, ServiceNodeTypes.PROJECT, ServiceNodeTypes.HEAD_COMPANY, ServiceNodeTypes.STORE).contains(target.targetType()))) return Set.of();
        LinkedHashSet<TaskPathRef> available = new LinkedHashSet<>();
        for (TaskPathRef group : requested.stream().filter(target -> ServiceNodeTypes.GROUP.equals(target.targetType())).toList()) {
            if (groups.isEnterableCommercialGroup(workspaceUuid, key, group.targetId())) available.add(group);
        }
        available.addAll(availableNodes(workspaceUuid, key, requested));
        available.addAll(availableEntities(workspaceUuid, key, requested, ServiceNodeTypes.HEAD_COMPANY, "head_company"));
        available.addAll(availableEntities(workspaceUuid, key, requested, ServiceNodeTypes.STORE, "store"));
        return Set.copyOf(available);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<TaskPathRef, String> describeTaskTargetLabels(UUID workspaceUuid, String key, List<TaskPathRef> targets) {
        if (workspaceUuid == null || key == null || targets == null) throw new TaskPathNotFoundException();
        LinkedHashSet<TaskPathRef> requested = new LinkedHashSet<>(targets);
        if (requested.isEmpty()) return Map.of();
        if (requested.stream().anyMatch(target -> target == null || target.targetId() == null
            || !Set.of(ServiceNodeTypes.GROUP, ServiceNodeTypes.REGION, ServiceNodeTypes.PROJECT, ServiceNodeTypes.HEAD_COMPANY, ServiceNodeTypes.STORE).contains(target.targetType()))) {
            throw new TaskPathNotFoundException();
        }

        UUID groupId = groups.requireCommercialGroupRef(workspaceUuid, key);
        LinkedHashMap<TaskPathRef, String> labels = new LinkedHashMap<>();
        for (TaskPathRef group : requested.stream().filter(target -> ServiceNodeTypes.GROUP.equals(target.targetType())).toList()) {
            if (!groupId.equals(group.targetId())) throw new TaskPathNotFoundException();
            labels.put(group, groups.describeCommercialGroup(workspaceUuid, key, groupId));
        }

        Set<UUID> nodeIds = new LinkedHashSet<>();
        nodeIds.addAll(idsFor(requested, ServiceNodeTypes.REGION));
        nodeIds.addAll(idsFor(requested, ServiceNodeTypes.PROJECT));
        if (!nodeIds.isEmpty()) {
            List<Node> nodes = jdbc.query(
                "SELECT id, parent_id, node_type, code, name FROM organization.organization_node WHERE workspace_uuid=? AND group_workspace_key=? AND status='ENABLED' AND id IN (" + placeholders(nodeIds.size()) + ")",
                (row, index) -> new Node(row.getObject(1, UUID.class), row.getObject(2, UUID.class), row.getString(3), row.getString(4), row.getString(5)),
                arguments(workspaceUuid, key, nodeIds)
            );
            for (Node node : nodes) {
                TaskPathRef ref = new TaskPathRef(node.type(), node.id());
                if (requested.contains(ref)) labels.put(ref, nameCode(node.name(), node.code()));
            }
        }

        Set<UUID> headCompanyIds = idsFor(requested, ServiceNodeTypes.HEAD_COMPANY);
        for (Entity entity : headCompanies(workspaceUuid, key, headCompanyIds, false).values()) {
            labels.put(new TaskPathRef(ServiceNodeTypes.HEAD_COMPANY, entity.id()), nameCode(entity.name(), entity.code()));
        }

        Set<UUID> storeIds = idsFor(requested, ServiceNodeTypes.STORE);
        Map<UUID, Store> stores = stores(workspaceUuid, key, storeIds, false);
        Map<UUID, NodePath> projects = nodePaths(
            workspaceUuid, key, groupId, stores.values().stream().map(Store::projectId).collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new)), false
        );
        for (Store store : stores.values()) {
            NodePath project = projects.get(store.projectId());
            if (project == null || !OrganizationNodeTypes.PROJECT.equals(project.type())) throw new TaskPathNotFoundException();
            labels.put(new TaskPathRef(ServiceNodeTypes.STORE, store.id()), nameCode(store.name(), store.code()));
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
            case ServiceNodeTypes.GROUP, ServiceNodeTypes.REGION, ServiceNodeTypes.PROJECT -> target.ancestorIds().contains(assignmentId);
            case ServiceNodeTypes.HEAD_COMPANY, ServiceNodeTypes.STORE -> assignmentType.equals(target.targetType()) && assignmentId.equals(target.targetId());
            default -> false;
        };
    }

    private TaskPath groupPath(UUID workspaceUuid, String key, UUID groupId, UUID targetId) {
        if (!groupId.equals(targetId)) throw new TaskPathNotFoundException();
        return new TaskPath(ServiceNodeTypes.GROUP, groupId, List.of(groupId), groups.describeCommercialGroup(workspaceUuid, key, groupId));
    }

    private TaskPath nodePath(UUID workspaceUuid, String key, UUID groupId, UUID targetId, String expectedType) {
        Node target = node(workspaceUuid, key, targetId, expectedType);
        if (ServiceNodeTypes.REGION.equals(expectedType)) {
            return new TaskPath(ServiceNodeTypes.REGION, target.id(), List.of(groupId, target.id()), target.code() + " " + target.name());
        }
        Node region = node(workspaceUuid, key, target.parentId(), ServiceNodeTypes.REGION);
        return new TaskPath(ServiceNodeTypes.PROJECT, target.id(), List.of(groupId, region.id(), target.id()), region.code() + " " + region.name() + " / " + target.code() + " " + target.name());
    }

    private TaskPath headCompanyPath(UUID workspaceUuid, String key, UUID groupId, UUID targetId) {
        Entity target = entity(workspaceUuid, key, targetId, "head_company");
        return new TaskPath(ServiceNodeTypes.HEAD_COMPANY, target.id(), List.of(groupId, target.id()), target.code() + " " + target.name());
    }

    private TaskPath storePath(UUID workspaceUuid, String key, UUID groupId, UUID targetId) {
        Store target = jdbc.query(
            "SELECT id, project_id, code, name FROM organization.store WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND status='ENABLED'",
            statement -> { statement.setObject(1, targetId); statement.setObject(2, workspaceUuid); statement.setString(3, key); },
            result -> result.next() ? new Store(result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3), result.getString(4)) : null
        );
        if (target == null) throw new TaskPathNotFoundException();
        Node project = node(workspaceUuid, key, target.projectId(), ServiceNodeTypes.PROJECT);
        Node region = node(workspaceUuid, key, project.parentId(), ServiceNodeTypes.REGION);
        return new TaskPath(ServiceNodeTypes.STORE, target.id(), List.of(groupId, region.id(), project.id(), target.id()), region.code() + " " + region.name() + " / " + project.code() + " " + project.name() + " / " + target.code() + " " + target.name());
    }

    private Map<UUID, Store> stores(UUID workspaceUuid, String key, Set<UUID> ids, boolean includeDisabledFacts) {
        if (ids.isEmpty()) return Map.of();
        List<Store> values = jdbc.query(
            "SELECT id, project_id, code, name FROM organization.store WHERE workspace_uuid=? AND group_workspace_key=?" + enabledOnly(includeDisabledFacts) + " AND id IN (" + placeholders(ids.size()) + ")",
            (row, index) -> new Store(row.getObject(1, UUID.class), row.getObject(2, UUID.class), row.getString(3), row.getString(4)),
            arguments(workspaceUuid, key, ids)
        );
        LinkedHashMap<UUID, Store> result = new LinkedHashMap<>();
        values.forEach(value -> result.put(value.id(), value));
        return Map.copyOf(result);
    }

    private Map<UUID, Entity> headCompanies(UUID workspaceUuid, String key, Set<UUID> ids, boolean includeDisabledFacts) {
        if (ids.isEmpty()) return Map.of();
        List<Entity> values = jdbc.query(
            "SELECT id, code, name FROM organization.head_company WHERE workspace_uuid=? AND group_workspace_key=?" + enabledOnly(includeDisabledFacts) + " AND id IN (" + placeholders(ids.size()) + ")",
            (row, index) -> new Entity(row.getObject(1, UUID.class), row.getString(2), row.getString(3)),
            arguments(workspaceUuid, key, ids)
        );
        LinkedHashMap<UUID, Entity> result = new LinkedHashMap<>();
        values.forEach(value -> result.put(value.id(), value));
        return Map.copyOf(result);
    }

    private Map<UUID, NodePath> nodePaths(UUID workspaceUuid, String key, UUID groupId, Set<UUID> ids, boolean includeDisabledFacts) {
        if (ids.isEmpty()) return Map.of();
        Map<UUID, NodePath> values = jdbc.query(
            "WITH RECURSIVE ancestry AS (" +
                "SELECT node.id AS target_id, node.id, node.parent_id, node.node_type, node.code, node.name, 0 AS depth " +
                "FROM organization.organization_node node WHERE node.workspace_uuid=? AND node.group_workspace_key=?" + enabledOnly("node", includeDisabledFacts) + " AND node.id IN (" + placeholders(ids.size()) + ") " +
                "UNION ALL " +
                "SELECT ancestry.target_id, parent.id, parent.parent_id, parent.node_type, parent.code, parent.name, ancestry.depth + 1 " +
                "FROM organization.organization_node parent JOIN ancestry ON ancestry.parent_id=parent.id " +
                "WHERE parent.workspace_uuid=? AND parent.group_workspace_key=?" + enabledOnly("parent", includeDisabledFacts) +
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
        targets.stream().filter(target -> ServiceNodeTypes.REGION.equals(target.targetType()) || ServiceNodeTypes.PROJECT.equals(target.targetType())).forEach(target -> ids.add(target.targetId()));
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

    private static String nameCode(String name, String code) { return name + "（" + code + "）"; }

    private static String enabledOnly(boolean includeDisabledFacts) { return includeDisabledFacts ? "" : " AND status='ENABLED'"; }
    private static String enabledOnly(String table, boolean includeDisabledFacts) { return includeDisabledFacts ? "" : " AND " + table + ".status='ENABLED'"; }

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
