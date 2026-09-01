package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.OrganizationNodeTypes;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import java.sql.Array;
import java.sql.SQLException;
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
    public TaskPath requireGroupTaskPath(UUID workspaceUuid, String key) {
        if (workspaceUuid == null || key == null) throw new TaskPathNotFoundException();
        return jdbc.query(
                "SELECT commercial_group_uuid,commercial_group_code,commercial_group_name FROM "
                        + "organization.commercial_group WHERE group_workspace_key=?",
                statement -> statement.setString(1, key),
                result -> {
                    if (!result.next()) throw new TaskPathNotFoundException();
                    String code = result.getString(2);
                    String name = result.getString(3);
                    return new TaskPath(
                            ServiceNodeTypes.GROUP,
                            result.getObject(1, UUID.class),
                            List.of(result.getObject(1, UUID.class)),
                            code + " " + name,
                            List.of(new TaskPathNode(
                                    result.getObject(1, UUID.class), code, name, ServiceNodeTypes.GROUP)));
                });
    }

    @Override
    @Transactional(readOnly = true)
    public TaskPath requireTaskPath(UUID workspaceUuid, String key, String targetType, UUID targetId) {
        if (workspaceUuid == null || key == null || targetId == null) throw new TaskPathNotFoundException();
        if (ServiceNodeTypes.PROJECT.equals(targetType)) {
            return requireEnabledProjectTaskPath(workspaceUuid, key, targetId);
        }
        if (ServiceNodeTypes.STORE.equals(targetType)) {
            return requireStoreTaskPath(workspaceUuid, key, targetId, false);
        }
        UUID groupId = groups.requireCommercialGroupRef(workspaceUuid, key);
        return switch (targetType) {
            case ServiceNodeTypes.GROUP -> groupPath(workspaceUuid, key, groupId, targetId);
            case ServiceNodeTypes.REGION -> nodePath(workspaceUuid, key, groupId, targetId, ServiceNodeTypes.REGION);
            case ServiceNodeTypes.HEAD_COMPANY -> headCompanyPath(workspaceUuid, key, groupId, targetId);
            default -> throw new TaskPathNotFoundException();
        };
    }

    /** One non-transactional owner statement for the Store edge's project scope and immutable update facts. */
    @Override
    public StoreProjectCommandFacts requireStoreProjectCommandFacts(UUID workspaceUuid, String key, UUID storeId) {
        if (workspaceUuid == null || key == null || storeId == null) throw new TaskPathNotFoundException();
        return jdbc.query(
                "WITH RECURSIVE group_fact AS (SELECT commercial_group_uuid AS group_id FROM"
                        + " organization.commercial_group WHERE group_workspace_key=?), store_fact AS (SELECT"
                        + " store.project_id, store.tenant_id, store.brand_id, store.code, group_fact.group_id FROM"
                        + " organization.store store JOIN organization.organization_node project ON"
                        + " project.id=store.project_id AND project.workspace_uuid=store.workspace_uuid AND"
                        + " project.group_workspace_key=store.group_workspace_key AND project.node_type='PROJECT' AND"
                        + " project.status='ENABLED' CROSS JOIN group_fact WHERE store.id=? AND"
                        + " store.workspace_uuid=? AND"
                        + " store.group_workspace_key=?), ancestry AS (SELECT store_fact.project_id AS target_id,"
                        + " node.id,"
                        + " node.parent_id, node.node_type, node.code, node.name, 0 AS depth FROM store_fact JOIN"
                        + " organization.organization_node node ON node.id=store_fact.project_id AND"
                        + " node.workspace_uuid=?"
                        + " AND node.group_workspace_key=? AND node.status='ENABLED' UNION ALL SELECT"
                        + " ancestry.target_id,"
                        + " parent.id, parent.parent_id, parent.node_type, parent.code, parent.name, ancestry.depth+1"
                        + " FROM"
                        + " organization.organization_node parent JOIN ancestry ON ancestry.parent_id=parent.id WHERE"
                        + " parent.workspace_uuid=? AND parent.group_workspace_key=? AND parent.status='ENABLED')"
                        + " SELECT"
                        + " store_fact.project_id, store_fact.tenant_id, store_fact.brand_id, store_fact.code,"
                        + " ancestry.target_id, max(ancestry.node_type) FILTER (WHERE ancestry.depth=0) AS target_type,"
                        + " array_agg(ancestry.id ORDER BY ancestry.depth DESC) AS ancestor_ids,"
                        + " array_agg(ancestry.id ORDER BY ancestry.depth DESC) AS path_node_refs,"
                        + " array_agg(ancestry.code ORDER BY ancestry.depth DESC) AS path_node_codes,"
                        + " array_agg(ancestry.name ORDER BY ancestry.depth DESC) AS path_node_names,"
                        + " array_agg(ancestry.node_type ORDER BY ancestry.depth DESC) AS path_node_types,"
                        + " string_agg(ancestry.code"
                        + " || ' ' || ancestry.name, ' / ' ORDER BY ancestry.depth DESC) AS display_path,"
                        + " store_fact.group_id FROM store_fact JOIN ancestry ON"
                        + " ancestry.target_id=store_fact.project_id"
                        + " GROUP BY store_fact.project_id, store_fact.tenant_id, store_fact.brand_id, store_fact.code,"
                        + " ancestry.target_id, store_fact.group_id",
                statement -> {
                    statement.setString(1, key);
                    statement.setObject(2, storeId);
                    statement.setObject(3, workspaceUuid);
                    statement.setString(4, key);
                    statement.setObject(5, workspaceUuid);
                    statement.setString(6, key);
                    statement.setObject(7, workspaceUuid);
                    statement.setString(8, key);
                },
                result -> {
                    if (!result.next() || !ServiceNodeTypes.PROJECT.equals(result.getString("target_type")))
                        throw new TaskPathNotFoundException();
                    Array array = result.getArray("ancestor_ids");
                    Object[] pathIds = (Object[]) array.getArray();
                    List<UUID> ancestors = new ArrayList<>(pathIds.length + 1);
                    ancestors.add(result.getObject("group_id", UUID.class));
                    for (Object value : pathIds) ancestors.add((UUID) value);
                    return new StoreProjectCommandFacts(
                            result.getObject("project_id", UUID.class),
                            result.getObject("tenant_id", UUID.class),
                            result.getObject("brand_id", UUID.class),
                            result.getString("code"),
                            new TaskPath(
                                    ServiceNodeTypes.PROJECT,
                                    result.getObject("target_id", UUID.class),
                                    ancestors,
                                    result.getString("display_path"),
                                    pathNodes(result)));
                });
    }

    @Override
    @Transactional(readOnly = true)
    public CatalogCommandScopeFacts resolveCatalogCommandScopeFacts(
            UUID workspaceUuid,
            String key,
            String targetType,
            UUID targetId,
            CatalogScopeLookup.CatalogBrandSelection selection) {
        if (workspaceUuid == null || key == null || targetId == null) throw new TaskPathNotFoundException();
        return switch (targetType) {
            case ServiceNodeTypes.STORE -> storeCatalogCommandScopeFacts(workspaceUuid, key, targetId, selection);
            case ServiceNodeTypes.HEAD_COMPANY -> headCompanyCatalogCommandScopeFacts(
                    workspaceUuid, key, targetId, selection);
            default -> throw new TaskPathNotFoundException();
        };
    }

    /**
     * Project scope is the hot command-path projection. The generic resolver first borrowed the commercial-group fact
     * and then queried the recursive node path even though both facts are immutable inputs to one TaskPath. Keep the
     * same enabled target/ancestor and type checks, but obtain the closed projection in one owner statement.
     */
    private TaskPath requireEnabledProjectTaskPath(UUID workspaceUuid, String key, UUID targetId) {
        return jdbc.query(
                "WITH RECURSIVE group_fact AS (SELECT commercial_group_uuid AS group_id FROM"
                        + " organization.commercial_group WHERE group_workspace_key=?), params AS (SELECT ?::uuid AS"
                        + " workspace_uuid, ?::text AS group_workspace_key, ?::uuid AS target_id, group_fact.group_id"
                        + " FROM"
                        + " group_fact), ancestry AS (SELECT node.id AS target_id, node.id, node.parent_id,"
                        + " node.node_type, node.code, node.name, 0 AS depth FROM organization.organization_node node"
                        + " CROSS JOIN params WHERE node.workspace_uuid=params.workspace_uuid AND"
                        + " node.group_workspace_key=params.group_workspace_key AND node.status='ENABLED' AND"
                        + " node.id=params.target_id UNION ALL SELECT ancestry.target_id, parent.id, parent.parent_id,"
                        + " parent.node_type, parent.code, parent.name, ancestry.depth+1 FROM"
                        + " organization.organization_node parent JOIN ancestry ON ancestry.parent_id=parent.id"
                        + " CROSS JOIN"
                        + " params WHERE parent.workspace_uuid=params.workspace_uuid AND"
                        + " parent.group_workspace_key=params.group_workspace_key AND parent.status='ENABLED') SELECT"
                        + " ancestry.target_id, max(ancestry.node_type) FILTER (WHERE ancestry.depth=0) AS target_type,"
                        + " array_agg(ancestry.id ORDER BY ancestry.depth DESC) AS ancestor_ids,"
                        + " array_agg(ancestry.id ORDER BY ancestry.depth DESC) AS path_node_refs,"
                        + " array_agg(ancestry.code ORDER BY ancestry.depth DESC) AS path_node_codes,"
                        + " array_agg(ancestry.name ORDER BY ancestry.depth DESC) AS path_node_names,"
                        + " array_agg(ancestry.node_type ORDER BY ancestry.depth DESC) AS path_node_types,"
                        + " string_agg(ancestry.code"
                        + " || ' ' || ancestry.name, ' / ' ORDER BY ancestry.depth DESC) AS display_path,"
                        + " params.group_id"
                        + " AS group_id FROM ancestry CROSS JOIN params GROUP BY ancestry.target_id, params.group_id",
                statement -> {
                    statement.setString(1, key);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                    statement.setObject(4, targetId);
                },
                result -> {
                    if (!result.next() || !ServiceNodeTypes.PROJECT.equals(result.getString("target_type")))
                        throw new TaskPathNotFoundException();
                    Array array = result.getArray("ancestor_ids");
                    Object[] pathIds = (Object[]) array.getArray();
                    List<UUID> ancestors = new ArrayList<>(pathIds.length + 1);
                    ancestors.add(result.getObject("group_id", UUID.class));
                    for (Object value : pathIds) ancestors.add((UUID) value);
                    return new TaskPath(
                            ServiceNodeTypes.PROJECT,
                            result.getObject("target_id", UUID.class),
                            ancestors,
                            result.getString("display_path"),
                            pathNodes(result));
                });
    }

    /**
     * Store command scope has the same closed facts as the project path, with one explicitly allowed variation: the
     * business-channel create path may target a disabled Store. Resolve the group, Store, project, and region in one
     * owner statement so the authorization read does not fan out into separate group/store/node reads.
     */
    private TaskPath requireStoreTaskPath(UUID workspaceUuid, String key, UUID targetId, boolean allowDisabledStore) {
        String storeStatusPredicate = allowDisabledStore ? "" : " AND store.status='ENABLED'";
        return jdbc.query(
                "WITH group_fact AS (SELECT commercial_group_uuid AS group_id FROM"
                        + " organization.commercial_group WHERE group_workspace_key=?), store_fact AS (SELECT"
                        + " store.id AS store_id, store.project_id, store.code AS store_code, store.name AS store_name,"
                        + " project.parent_id AS region_id, project.code AS project_code, project.name AS project_name,"
                        + " region.code AS region_code, region.name AS region_name, group_fact.group_id FROM"
                        + " organization.store store JOIN organization.organization_node project ON"
                        + " project.id=store.project_id AND project.workspace_uuid=store.workspace_uuid AND"
                        + " project.group_workspace_key=store.group_workspace_key AND project.node_type='PROJECT' AND"
                        + " project.status='ENABLED' JOIN organization.organization_node region ON"
                        + " region.id=project.parent_id AND region.workspace_uuid=project.workspace_uuid AND"
                        + " region.group_workspace_key=project.group_workspace_key AND region.node_type='REGION' AND"
                        + " region.status='ENABLED' CROSS JOIN group_fact WHERE store.id=? AND"
                        + " store.workspace_uuid=? AND store.group_workspace_key=?"
                        + storeStatusPredicate
                        + ") SELECT store_id, project_id, store_code, store_name, region_id, project_code,"
                        + " project_name, region_code, region_name, group_id FROM store_fact",
                statement -> {
                    statement.setString(1, key);
                    statement.setObject(2, targetId);
                    statement.setObject(3, workspaceUuid);
                    statement.setString(4, key);
                },
                result -> {
                    if (!result.next()) throw new TaskPathNotFoundException();
                    UUID groupId = result.getObject("group_id", UUID.class);
                    UUID regionId = result.getObject("region_id", UUID.class);
                    UUID projectId = result.getObject("project_id", UUID.class);
                    UUID storeId = result.getObject("store_id", UUID.class);
                    String regionCode = result.getString("region_code");
                    String regionName = result.getString("region_name");
                    String projectCode = result.getString("project_code");
                    String projectName = result.getString("project_name");
                    String storeCode = result.getString("store_code");
                    String storeName = result.getString("store_name");
                    return new TaskPath(
                            ServiceNodeTypes.STORE,
                            storeId,
                            List.of(groupId, regionId, projectId, storeId),
                            regionCode + " " + regionName + " / " + projectCode + " " + projectName + " / " + storeCode
                                    + " " + storeName,
                            List.of(
                                    new TaskPathNode(regionId, regionCode, regionName, ServiceNodeTypes.REGION),
                                    new TaskPathNode(projectId, projectCode, projectName, ServiceNodeTypes.PROJECT),
                                    new TaskPathNode(storeId, storeCode, storeName, ServiceNodeTypes.STORE)));
                });
    }

    /**
     * Status-transition authority is the only command branch that may resolve a disabled persisted task target. Read,
     * session, and candidate callers remain enabled-only.
     */
    @Override
    @Transactional(readOnly = true)
    public TaskPath requireStatusTransitionTaskPath(UUID workspaceUuid, String key, String targetType, UUID targetId) {
        TaskPathRef target = new TaskPathRef(targetType, targetId);
        TaskPath taskPath = resolveTaskPaths(workspaceUuid, key, List.of(target), true, true)
                .get(target);
        if (taskPath == null) throw new TaskPathNotFoundException();
        return taskPath;
    }

    /** A disabled Store may remain a business-channel target, but its organization ancestors remain enabled-only. */
    @Override
    @Transactional(readOnly = true)
    public TaskPath requireTaskPathAllowingDisabledTarget(
            UUID workspaceUuid, String key, String targetType, UUID targetId) {
        if (!ServiceNodeTypes.STORE.equals(targetType)) throw new TaskPathNotFoundException();
        return requireStoreTaskPath(workspaceUuid, key, targetId, true);
    }

    /** Bounded enabled task-path resolution for authority, candidate, and session callers. */
    @Override
    @Transactional(readOnly = true)
    public Map<TaskPathRef, TaskPath> requireTaskPaths(UUID workspaceUuid, String key, List<TaskPathRef> targets) {
        return resolveTaskPaths(workspaceUuid, key, targets, false, false);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<TaskPathRef, TaskPath> describePersistedTaskPaths(
            UUID workspaceUuid, String key, List<TaskPathRef> targets) {
        if (workspaceUuid == null || key == null || targets == null) throw new TaskPathNotFoundException();
        LinkedHashSet<TaskPathRef> requested = validatedTargets(targets);
        if (requested.isEmpty()) return Map.of();
        Map<TaskPathRef, TaskPath> result = jdbc.query(
                persistedTaskPathsSql(),
                statement -> bindPersistedTaskPaths(statement, workspaceUuid, key, requested),
                rows -> {
                    LinkedHashMap<TaskPathRef, TaskPath> paths = new LinkedHashMap<>();
                    while (rows.next()) {
                        TaskPathRef target =
                                new TaskPathRef(rows.getString("target_type"), rows.getObject("target_id", UUID.class));
                        Array array = rows.getArray("ancestor_ids");
                        Object[] values = (Object[]) array.getArray();
                        List<UUID> ancestors = new ArrayList<>(values.length);
                        for (Object value : values) ancestors.add((UUID) value);
                        List<TaskPathNode> nodes = pathNodes(rows);
                        if (paths.put(
                                        target,
                                        new TaskPath(
                                                target.targetType(),
                                                target.targetId(),
                                                ancestors,
                                                rows.getString("display_path"),
                                                nodes))
                                != null) {
                            throw new TaskPathNotFoundException();
                        }
                    }
                    return Map.copyOf(paths);
                });
        if (result == null
                || result.size() != requested.size()
                || !result.keySet().equals(requested)) throw new TaskPathNotFoundException();
        return result;
    }

    private static List<TaskPathNode> pathNodes(java.sql.ResultSet rows) throws SQLException {
        Object[] refs = (Object[]) rows.getArray("path_node_refs").getArray();
        Object[] codes = (Object[]) rows.getArray("path_node_codes").getArray();
        Object[] names = (Object[]) rows.getArray("path_node_names").getArray();
        Object[] types = (Object[]) rows.getArray("path_node_types").getArray();
        if (refs.length != codes.length || refs.length != names.length || refs.length != types.length) {
            throw new TaskPathNotFoundException();
        }
        List<TaskPathNode> nodes = new ArrayList<>(refs.length);
        for (int index = 0; index < refs.length; index++) {
            nodes.add(new TaskPathNode(
                    (UUID) refs[index], (String) codes[index], (String) names[index], (String) types[index]));
        }
        return List.copyOf(nodes);
    }

    private static List<TaskPathNode> appendNode(List<TaskPathNode> nodes, TaskPathNode node) {
        List<TaskPathNode> result = new ArrayList<>(nodes);
        result.add(node);
        return List.copyOf(result);
    }

    /**
     * The persisted presentation branch is intentionally confined here. Callers must use requireTaskPaths for enabled
     * authority, candidate, and session decisions.
     */
    private Map<TaskPathRef, TaskPath> resolveTaskPaths(
            UUID workspaceUuid,
            String key,
            List<TaskPathRef> targets,
            boolean includeDisabledEntityFacts,
            boolean includeDisabledNodeFacts) {
        if (workspaceUuid == null || key == null || targets == null) throw new TaskPathNotFoundException();
        LinkedHashSet<TaskPathRef> requested = validatedTargets(targets);
        if (requested.isEmpty()) return Map.of();
        UUID groupId = groups.requireCommercialGroupRef(workspaceUuid, key);
        LinkedHashMap<TaskPathRef, TaskPath> result = new LinkedHashMap<>();

        Set<UUID> storeIds = idsFor(requested, ServiceNodeTypes.STORE);
        Map<UUID, Store> stores = stores(workspaceUuid, key, storeIds, includeDisabledEntityFacts);
        if (stores.size() != storeIds.size()) throw new TaskPathNotFoundException();

        Set<UUID> headCompanyIds = idsFor(requested, ServiceNodeTypes.HEAD_COMPANY);
        Map<UUID, Entity> headCompanies = headCompanies(workspaceUuid, key, headCompanyIds, includeDisabledEntityFacts);
        if (headCompanies.size() != headCompanyIds.size()) throw new TaskPathNotFoundException();

        Set<UUID> nodeIds = new LinkedHashSet<>();
        nodeIds.addAll(idsFor(requested, ServiceNodeTypes.REGION));
        nodeIds.addAll(idsFor(requested, ServiceNodeTypes.PROJECT));
        stores.values().forEach(store -> nodeIds.add(store.projectId()));
        Map<UUID, NodePath> nodes = nodePaths(workspaceUuid, key, groupId, nodeIds, includeDisabledNodeFacts);

        for (TaskPathRef target : requested) {
            switch (target.targetType()) {
                case ServiceNodeTypes.GROUP -> {
                    if (!groupId.equals(target.targetId())) throw new TaskPathNotFoundException();
                    result.put(
                            target,
                            new TaskPath(
                                    ServiceNodeTypes.GROUP,
                                    groupId,
                                    List.of(groupId),
                                    groups.describeCommercialGroup(workspaceUuid, key, groupId),
                                    requireGroupTaskPath(workspaceUuid, key).nodes()));
                }
                case ServiceNodeTypes.REGION, ServiceNodeTypes.PROJECT -> {
                    NodePath node = nodes.get(target.targetId());
                    if (node == null || !target.targetType().equals(node.type())) throw new TaskPathNotFoundException();
                    result.put(target, node.taskPath());
                }
                case ServiceNodeTypes.HEAD_COMPANY -> {
                    Entity headCompany = headCompanies.get(target.targetId());
                    result.put(
                            target,
                            new TaskPath(
                                    ServiceNodeTypes.HEAD_COMPANY,
                                    headCompany.id(),
                                    List.of(groupId, headCompany.id()),
                                    headCompany.code() + " " + headCompany.name(),
                                    List.of(new TaskPathNode(
                                            headCompany.id(),
                                            headCompany.code(),
                                            headCompany.name(),
                                            ServiceNodeTypes.HEAD_COMPANY))));
                }
                case ServiceNodeTypes.STORE -> {
                    Store store = stores.get(target.targetId());
                    NodePath project = nodes.get(store.projectId());
                    if (project == null || !OrganizationNodeTypes.PROJECT.equals(project.type()))
                        throw new TaskPathNotFoundException();
                    List<UUID> ancestors = new ArrayList<>(project.taskPath().ancestorIds());
                    ancestors.add(store.id());
                    result.put(
                            target,
                            new TaskPath(
                                    ServiceNodeTypes.STORE,
                                    store.id(),
                                    ancestors,
                                    project.taskPath().displayPath() + " / " + store.code() + " " + store.name(),
                                    appendNode(
                                            project.taskPath().nodes(),
                                            new TaskPathNode(
                                                    store.id(), store.code(), store.name(), ServiceNodeTypes.STORE))));
                }
                default -> throw new TaskPathNotFoundException();
            }
        }
        return Map.copyOf(result);
    }

    /**
     * Presentation-only persisted display needs one organization logical statement even when a page mixes every target
     * family. Authority callers intentionally retain resolveTaskPaths.
     */
    private static String persistedTaskPathsSql() {
        return "WITH RECURSIVE requested(target_type, target_id) AS ("
                + "SELECT target_type, target_id FROM jsonb_to_recordset(?::jsonb) AS request(target_type text, "
                + "target_id uuid)"
                + "), commercial_group AS ("
                + "SELECT commercial_group_uuid AS id, commercial_group_code, commercial_group_name FROM "
                + "organization.commercial_group WHERE group_workspace_key=?"
                + "), target_rows AS ("
                + "SELECT requested.target_type, requested.target_id, commercial_group.id AS group_id, node.id AS "
                + "node_id, head_company.id AS head_company_id, store.id AS store_id, store.project_id "
                + "FROM requested CROSS JOIN commercial_group "
                + "LEFT JOIN organization.organization_node node ON requested.target_type IN ('REGION','PROJECT') AND "
                + "node.id=requested.target_id AND node.workspace_uuid=? AND node.group_workspace_key=? "
                + "LEFT JOIN organization.head_company head_company ON requested.target_type='HEAD_COMPANY' AND "
                + "head_company.id=requested.target_id AND head_company.workspace_uuid=? AND "
                + "head_company.group_workspace_key=? "
                + "LEFT JOIN organization.store store ON requested.target_type='STORE' AND "
                + "store.id=requested.target_id AND store.workspace_uuid=? AND store.group_workspace_key=?"
                + "), node_seeds(target_type, target_id, id, parent_id, code, name, node_type) AS ("
                + "SELECT target_type, target_id, node.id, node.parent_id, node.code, node.name, node.node_type "
                + "FROM target_rows JOIN "
                + "organization.organization_node node ON node.id=target_rows.node_id "
                + "UNION ALL SELECT target_rows.target_type, target_rows.target_id, project.id, project.parent_id, "
                + "project.code, project.name, project.node_type FROM target_rows "
                + "JOIN organization.organization_node project ON "
                + "project.id=target_rows.project_id AND project.workspace_uuid=? AND project.group_workspace_key=?"
                + "), ancestry(target_type, target_id, id, parent_id, code, name, node_type, depth) AS ("
                + "SELECT target_type, target_id, id, parent_id, code, name, node_type, 0 AS depth FROM node_seeds "
                + "UNION ALL SELECT ancestry.target_type, ancestry.target_id, parent.id, parent.parent_id, "
                + "parent.code, parent.name, parent.node_type, ancestry.depth + 1 "
                + "FROM organization.organization_node parent JOIN "
                + "ancestry ON ancestry.parent_id=parent.id WHERE parent.workspace_uuid=? AND "
                + "parent.group_workspace_key=?"
                + "), node_paths AS ("
                + "SELECT target_type, target_id, array_agg(id ORDER BY depth DESC) AS ancestor_ids, "
                + "array_agg(id ORDER BY depth DESC) AS path_node_refs, array_agg(code ORDER BY depth DESC) AS "
                + "path_node_codes, array_agg(name ORDER BY depth DESC) AS path_node_names, array_agg(node_type "
                + "ORDER BY depth DESC) AS path_node_types, string_agg(code || ' ' || name, ' / ' ORDER BY depth "
                + "DESC) AS display_path FROM ancestry GROUP BY target_type, target_id"
                + ") SELECT target_rows.target_type, target_rows.target_id, "
                + "CASE WHEN target_rows.target_type='GROUP' AND target_rows.target_id=target_rows.group_id THEN "
                + "ARRAY[target_rows.group_id] "
                + "WHEN target_rows.target_type IN ('REGION','PROJECT') AND node_paths.target_id IS NOT NULL THEN "
                + "array_prepend(target_rows.group_id, node_paths.ancestor_ids) "
                + "WHEN target_rows.target_type='HEAD_COMPANY' AND target_rows.head_company_id IS NOT NULL THEN "
                + "ARRAY[target_rows.group_id, target_rows.head_company_id] "
                + "WHEN target_rows.target_type='STORE' AND target_rows.store_id IS NOT NULL AND node_paths.target_id "
                + "IS NOT NULL THEN array_append(array_prepend(target_rows.group_id, node_paths.ancestor_ids), "
                + "target_rows.store_id) END AS ancestor_ids, "
                + "CASE WHEN target_rows.target_type='GROUP' AND target_rows.target_id=target_rows.group_id THEN "
                + "ARRAY[target_rows.group_id] "
                + "WHEN target_rows.target_type IN ('REGION','PROJECT') AND node_paths.target_id IS NOT NULL THEN "
                + "node_paths.path_node_refs "
                + "WHEN target_rows.target_type='HEAD_COMPANY' AND target_rows.head_company_id IS NOT NULL THEN "
                + "ARRAY[target_rows.head_company_id] "
                + "WHEN target_rows.target_type='STORE' AND target_rows.store_id IS NOT NULL AND node_paths.target_id "
                + "IS NOT NULL THEN array_append(node_paths.path_node_refs, target_rows.store_id) END AS "
                + "path_node_refs, "
                + "CASE WHEN target_rows.target_type='GROUP' AND target_rows.target_id=target_rows.group_id THEN "
                + "ARRAY[commercial_group.commercial_group_code] "
                + "WHEN target_rows.target_type IN ('REGION','PROJECT') AND node_paths.target_id IS NOT NULL THEN "
                + "node_paths.path_node_codes "
                + "WHEN target_rows.target_type='HEAD_COMPANY' AND target_rows.head_company_id IS NOT NULL THEN "
                + "ARRAY[head_company.code] "
                + "WHEN target_rows.target_type='STORE' AND target_rows.store_id IS NOT NULL AND node_paths.target_id "
                + "IS NOT NULL THEN array_append(node_paths.path_node_codes, store.code) END AS path_node_codes, "
                + "CASE WHEN target_rows.target_type='GROUP' AND target_rows.target_id=target_rows.group_id THEN "
                + "ARRAY[commercial_group.commercial_group_name] "
                + "WHEN target_rows.target_type IN ('REGION','PROJECT') AND node_paths.target_id IS NOT NULL THEN "
                + "node_paths.path_node_names "
                + "WHEN target_rows.target_type='HEAD_COMPANY' AND target_rows.head_company_id IS NOT NULL THEN "
                + "ARRAY[head_company.name] "
                + "WHEN target_rows.target_type='STORE' AND target_rows.store_id IS NOT NULL AND node_paths.target_id "
                + "IS NOT NULL THEN array_append(node_paths.path_node_names, store.name) END AS path_node_names, "
                + "CASE WHEN target_rows.target_type='GROUP' AND target_rows.target_id=target_rows.group_id THEN "
                + "ARRAY['GROUP'] "
                + "WHEN target_rows.target_type IN ('REGION','PROJECT') AND node_paths.target_id IS NOT NULL THEN "
                + "node_paths.path_node_types "
                + "WHEN target_rows.target_type='HEAD_COMPANY' AND target_rows.head_company_id IS NOT NULL THEN "
                + "ARRAY['HEAD_COMPANY'] "
                + "WHEN target_rows.target_type='STORE' AND target_rows.store_id IS NOT NULL AND node_paths.target_id "
                + "IS NOT NULL THEN array_append(node_paths.path_node_types, 'STORE') END AS path_node_types, "
                + "CASE WHEN target_rows.target_type='GROUP' AND target_rows.target_id=target_rows.group_id THEN "
                + "commercial_group.commercial_group_name || '（' || commercial_group.commercial_group_code || '）' "
                + "WHEN target_rows.target_type IN ('REGION','PROJECT') AND node_paths.target_id IS NOT NULL THEN "
                + "node_paths.display_path "
                + "WHEN target_rows.target_type='HEAD_COMPANY' AND target_rows.head_company_id IS NOT NULL THEN "
                + "head_company.code || ' ' || head_company.name "
                + "WHEN target_rows.target_type='STORE' AND target_rows.store_id IS NOT NULL AND node_paths.target_id "
                + "IS NOT NULL THEN node_paths.display_path || ' / ' || store.code || ' ' || store.name END AS "
                + "display_path "
                + "FROM target_rows CROSS JOIN commercial_group "
                + "LEFT JOIN node_paths ON node_paths.target_type=target_rows.target_type AND "
                + "node_paths.target_id=target_rows.target_id "
                + "LEFT JOIN organization.head_company head_company ON head_company.id=target_rows.head_company_id "
                + "LEFT JOIN organization.store store ON store.id=target_rows.store_id "
                + "WHERE (target_rows.target_type='GROUP' AND target_rows.target_id=target_rows.group_id) "
                + "OR (target_rows.target_type IN ('REGION','PROJECT') AND node_paths.target_id IS NOT NULL) "
                + "OR (target_rows.target_type='HEAD_COMPANY' AND target_rows.head_company_id IS NOT NULL) "
                + "OR (target_rows.target_type='STORE' AND target_rows.store_id IS NOT NULL AND node_paths.target_id "
                + "IS NOT NULL)";
    }

    private static LinkedHashSet<TaskPathRef> validatedTargets(List<TaskPathRef> targets) {
        LinkedHashSet<TaskPathRef> requested = new LinkedHashSet<>(targets);
        for (TaskPathRef target : requested) {
            if (target == null
                    || target.targetId() == null
                    || !Set.of(
                                    ServiceNodeTypes.GROUP,
                                    ServiceNodeTypes.REGION,
                                    ServiceNodeTypes.PROJECT,
                                    ServiceNodeTypes.HEAD_COMPANY,
                                    ServiceNodeTypes.STORE)
                            .contains(target.targetType())) {
                throw new TaskPathNotFoundException();
            }
        }
        return requested;
    }

    private static void bindPersistedTaskPaths(
            java.sql.PreparedStatement statement, UUID workspaceUuid, String key, Set<TaskPathRef> targets)
            throws java.sql.SQLException {
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
                .map(target ->
                        "{\"target_type\":\"" + target.targetType() + "\",\"target_id\":\"" + target.targetId() + "\"}")
                .collect(java.util.stream.Collectors.joining(",", "[", "]"));
    }

    @Override
    @Transactional(readOnly = true)
    public Set<TaskPathRef> availableTaskTargets(UUID workspaceUuid, String key, List<TaskPathRef> targets) {
        if (workspaceUuid == null || key == null || targets == null) return Set.of();
        LinkedHashSet<TaskPathRef> requested = new LinkedHashSet<>(targets);
        if (requested.isEmpty()) return Set.of();
        if (requested.stream()
                .anyMatch(target -> target == null
                        || target.targetId() == null
                        || !Set.of(
                                        ServiceNodeTypes.GROUP,
                                        ServiceNodeTypes.REGION,
                                        ServiceNodeTypes.PROJECT,
                                        ServiceNodeTypes.HEAD_COMPANY,
                                        ServiceNodeTypes.STORE)
                                .contains(target.targetType()))) return Set.of();
        LinkedHashSet<TaskPathRef> available = new LinkedHashSet<>();
        for (TaskPathRef group : requested.stream()
                .filter(target -> ServiceNodeTypes.GROUP.equals(target.targetType()))
                .toList()) {
            if (groups.isEnterableCommercialGroup(workspaceUuid, key, group.targetId())) available.add(group);
        }
        available.addAll(availableNodes(workspaceUuid, key, requested));
        available.addAll(
                availableEntities(workspaceUuid, key, requested, ServiceNodeTypes.HEAD_COMPANY, "head_company"));
        available.addAll(availableEntities(workspaceUuid, key, requested, ServiceNodeTypes.STORE, "store"));
        return Set.copyOf(available);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<TaskPathRef, String> describeTaskTargetLabels(
            UUID workspaceUuid, String key, List<TaskPathRef> targets) {
        if (workspaceUuid == null || key == null || targets == null) throw new TaskPathNotFoundException();
        LinkedHashSet<TaskPathRef> requested = new LinkedHashSet<>(targets);
        if (requested.isEmpty()) return Map.of();
        if (requested.stream()
                .anyMatch(target -> target == null
                        || target.targetId() == null
                        || !Set.of(
                                        ServiceNodeTypes.GROUP,
                                        ServiceNodeTypes.REGION,
                                        ServiceNodeTypes.PROJECT,
                                        ServiceNodeTypes.HEAD_COMPANY,
                                        ServiceNodeTypes.STORE)
                                .contains(target.targetType()))) {
            throw new TaskPathNotFoundException();
        }

        UUID groupId = groups.requireCommercialGroupRef(workspaceUuid, key);
        LinkedHashMap<TaskPathRef, String> labels = new LinkedHashMap<>();
        for (TaskPathRef group : requested.stream()
                .filter(target -> ServiceNodeTypes.GROUP.equals(target.targetType()))
                .toList()) {
            if (!groupId.equals(group.targetId())) throw new TaskPathNotFoundException();
            labels.put(group, groups.describeCommercialGroup(workspaceUuid, key, groupId));
        }

        Set<UUID> nodeIds = new LinkedHashSet<>();
        nodeIds.addAll(idsFor(requested, ServiceNodeTypes.REGION));
        nodeIds.addAll(idsFor(requested, ServiceNodeTypes.PROJECT));
        if (!nodeIds.isEmpty()) {
            List<Node> nodes = jdbc.query(
                    "SELECT id, parent_id, node_type, code, name FROM organization.organization_node WHERE "
                            + "workspace_uuid=? AND group_workspace_key=? AND status='ENABLED' AND id IN ("
                            + placeholders(nodeIds.size()) + ")",
                    (row, index) -> new Node(
                            row.getObject(1, UUID.class),
                            row.getObject(2, UUID.class),
                            row.getString(3),
                            row.getString(4),
                            row.getString(5)),
                    arguments(workspaceUuid, key, nodeIds));
            for (Node node : nodes) {
                TaskPathRef ref = new TaskPathRef(node.type(), node.id());
                if (requested.contains(ref)) labels.put(ref, nameCode(node.name(), node.code()));
            }
        }

        Set<UUID> headCompanyIds = idsFor(requested, ServiceNodeTypes.HEAD_COMPANY);
        for (Entity entity :
                headCompanies(workspaceUuid, key, headCompanyIds, false).values()) {
            labels.put(
                    new TaskPathRef(ServiceNodeTypes.HEAD_COMPANY, entity.id()),
                    nameCode(entity.name(), entity.code()));
        }

        Set<UUID> storeIds = idsFor(requested, ServiceNodeTypes.STORE);
        Map<UUID, Store> stores = stores(workspaceUuid, key, storeIds, false);
        Map<UUID, NodePath> projects = nodePaths(
                workspaceUuid,
                key,
                groupId,
                stores.values().stream()
                        .map(Store::projectId)
                        .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new)),
                false);
        for (Store store : stores.values()) {
            NodePath project = projects.get(store.projectId());
            if (project == null || !OrganizationNodeTypes.PROJECT.equals(project.type()))
                throw new TaskPathNotFoundException();
            labels.put(new TaskPathRef(ServiceNodeTypes.STORE, store.id()), nameCode(store.name(), store.code()));
        }
        if (labels.size() != requested.size()) throw new TaskPathNotFoundException();
        return Map.copyOf(labels);
    }

    /**
     * One owner-local read pass for session-entry composition. Availability and labels are derived from the same
     * enabled organization facts; this is deliberately invocation-local and is not an authorization cache.
     */
    @Override
    @Transactional(readOnly = true)
    public SessionTaskTargetFacts sessionTaskTargetFacts(UUID workspaceUuid, String key, List<TaskPathRef> targets) {
        if (workspaceUuid == null || key == null || targets == null) {
            return new SessionTaskTargetFacts(Set.of(), Map.of());
        }
        LinkedHashSet<TaskPathRef> requested = new LinkedHashSet<>(targets);
        if (requested.isEmpty()) return new SessionTaskTargetFacts(Set.of(), Map.of());
        if (requested.stream()
                .anyMatch(target ->
                        target == null || target.targetId() == null || !supportedTargetType(target.targetType()))) {
            return new SessionTaskTargetFacts(Set.of(), Map.of());
        }

        LinkedHashSet<TaskPathRef> available = new LinkedHashSet<>();
        for (TaskPathRef group : requested.stream()
                .filter(target -> ServiceNodeTypes.GROUP.equals(target.targetType()))
                .toList()) {
            if (groups.isEnterableCommercialGroup(workspaceUuid, key, group.targetId())) available.add(group);
        }

        Set<UUID> nodeIds = new LinkedHashSet<>();
        nodeIds.addAll(idsFor(requested, ServiceNodeTypes.REGION));
        nodeIds.addAll(idsFor(requested, ServiceNodeTypes.PROJECT));
        List<Node> nodeFacts = nodeIds.isEmpty()
                ? List.of()
                : jdbc.query(
                        "SELECT id, parent_id, node_type, code, name FROM organization.organization_node WHERE "
                                + "workspace_uuid=? AND group_workspace_key=? AND status='ENABLED' AND id IN ("
                                + placeholders(nodeIds.size()) + ")",
                        (row, index) -> new Node(
                                row.getObject(1, UUID.class),
                                row.getObject(2, UUID.class),
                                row.getString(3),
                                row.getString(4),
                                row.getString(5)),
                        arguments(workspaceUuid, key, nodeIds));
        nodeFacts.stream().map(node -> new TaskPathRef(node.type(), node.id())).forEach(available::add);

        Set<UUID> headCompanyIds = idsFor(requested, ServiceNodeTypes.HEAD_COMPANY);
        Map<UUID, Entity> headCompanyFacts = headCompanies(workspaceUuid, key, headCompanyIds, false);
        headCompanyFacts.keySet().stream()
                .map(id -> new TaskPathRef(ServiceNodeTypes.HEAD_COMPANY, id))
                .forEach(available::add);

        Set<UUID> storeIds = idsFor(requested, ServiceNodeTypes.STORE);
        Map<UUID, Store> storeFacts = stores(workspaceUuid, key, storeIds, false);
        storeFacts.keySet().stream()
                .map(id -> new TaskPathRef(ServiceNodeTypes.STORE, id))
                .forEach(available::add);

        Set<TaskPathRef> labelTargets = available.stream()
                .filter(requested::contains)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        if (labelTargets.isEmpty()) return new SessionTaskTargetFacts(available, Map.of());

        // Preserve the existing label path's group initialization check even when no GROUP assignment is present.
        UUID groupId = groups.requireCommercialGroupRef(workspaceUuid, key);
        LinkedHashMap<TaskPathRef, String> labels = new LinkedHashMap<>();
        for (TaskPathRef group : labelTargets.stream()
                .filter(target -> ServiceNodeTypes.GROUP.equals(target.targetType()))
                .toList()) {
            if (!groupId.equals(group.targetId())) throw new TaskPathNotFoundException();
            labels.put(group, groups.describeCommercialGroup(workspaceUuid, key, groupId));
        }
        for (Node node : nodeFacts) {
            TaskPathRef ref = new TaskPathRef(node.type(), node.id());
            if (labelTargets.contains(ref)) labels.put(ref, nameCode(node.name(), node.code()));
        }
        for (Entity entity : headCompanyFacts.values()) {
            TaskPathRef ref = new TaskPathRef(ServiceNodeTypes.HEAD_COMPANY, entity.id());
            if (labelTargets.contains(ref)) labels.put(ref, nameCode(entity.name(), entity.code()));
        }
        Map<UUID, NodePath> projects = nodePaths(
                workspaceUuid,
                key,
                groupId,
                storeFacts.values().stream()
                        .filter(store -> labelTargets.contains(new TaskPathRef(ServiceNodeTypes.STORE, store.id())))
                        .map(Store::projectId)
                        .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new)),
                false);
        for (Store store : storeFacts.values()) {
            TaskPathRef ref = new TaskPathRef(ServiceNodeTypes.STORE, store.id());
            if (!labelTargets.contains(ref)) continue;
            NodePath project = projects.get(store.projectId());
            if (project == null || !OrganizationNodeTypes.PROJECT.equals(project.type()))
                throw new TaskPathNotFoundException();
            labels.put(ref, nameCode(store.name(), store.code()));
        }
        if (labels.size() != labelTargets.size()) throw new TaskPathNotFoundException();
        return new SessionTaskTargetFacts(available, labels);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isScopeAllowed(
            UUID workspaceUuid, String key, String assignmentType, UUID assignmentId, TaskPath target) {
        return scopeAllowed(assignmentType, assignmentId, target);
    }

    /** One owner transaction for command target/path resolution and range judgment. */
    @Override
    @Transactional(readOnly = true)
    public CommandTaskPathFacts commandTaskPathFacts(
            UUID workspaceUuid,
            String key,
            String assignmentType,
            UUID assignmentId,
            String targetType,
            UUID targetId,
            boolean statusTransition) {
        TaskPath taskPath = statusTransition
                ? requireStatusTransitionTaskPath(workspaceUuid, key, targetType, targetId)
                : requireTaskPath(workspaceUuid, key, targetType, targetId);
        return new CommandTaskPathFacts(taskPath, scopeAllowed(assignmentType, assignmentId, taskPath));
    }

    private static boolean scopeAllowed(String assignmentType, UUID assignmentId, TaskPath target) {
        return OrganizationTaskPathLookup.scopeAllows(assignmentType, assignmentId, target);
    }

    private TaskPath groupPath(UUID workspaceUuid, String key, UUID groupId, UUID targetId) {
        TaskPath group = requireGroupTaskPath(workspaceUuid, key);
        if (!groupId.equals(targetId) || !groupId.equals(group.targetId())) throw new TaskPathNotFoundException();
        return group;
    }

    private TaskPath nodePath(UUID workspaceUuid, String key, UUID groupId, UUID targetId, String expectedType) {
        Node target = node(workspaceUuid, key, targetId, expectedType);
        if (ServiceNodeTypes.REGION.equals(expectedType)) {
            return new TaskPath(
                    ServiceNodeTypes.REGION,
                    target.id(),
                    List.of(groupId, target.id()),
                    target.code() + " " + target.name(),
                    List.of(new TaskPathNode(target.id(), target.code(), target.name(), target.type())));
        }
        Node region = node(workspaceUuid, key, target.parentId(), ServiceNodeTypes.REGION);
        return new TaskPath(
                ServiceNodeTypes.PROJECT,
                target.id(),
                List.of(groupId, region.id(), target.id()),
                region.code() + " " + region.name() + " / " + target.code() + " " + target.name(),
                List.of(
                        new TaskPathNode(region.id(), region.code(), region.name(), region.type()),
                        new TaskPathNode(target.id(), target.code(), target.name(), target.type())));
    }

    private TaskPath headCompanyPath(UUID workspaceUuid, String key, UUID groupId, UUID targetId) {
        Entity target = entity(workspaceUuid, key, targetId, "head_company");
        return new TaskPath(
                ServiceNodeTypes.HEAD_COMPANY,
                target.id(),
                List.of(groupId, target.id()),
                target.code() + " " + target.name(),
                List.of(new TaskPathNode(target.id(), target.code(), target.name(), ServiceNodeTypes.HEAD_COMPANY)));
    }

    private CatalogCommandScopeFacts headCompanyCatalogCommandScopeFacts(
            UUID workspaceUuid, String key, UUID targetId, CatalogScopeLookup.CatalogBrandSelection selection) {
        String requestedBrandRef = selection == null ? null : selection.value();
        if (requestedBrandRef == null || requestedBrandRef.isBlank()) {
            throw new BusinessEntityService.OrganizationValidationException();
        }
        UUID brandRef;
        try {
            brandRef = UUID.fromString(requestedBrandRef);
        } catch (IllegalArgumentException invalid) {
            throw new BusinessEntityService.OrganizationValidationException(invalid);
        }
        return jdbc.query(
                "WITH group_root AS (SELECT commercial_group_uuid FROM organization.commercial_group WHERE "
                        + "group_workspace_key=?) SELECT group_root.commercial_group_uuid, company.id, company.code, "
                        + "company.name, company.version, brand.version, "
                        + "authorization_fact.authorized_at_epoch_millis FROM "
                        + "group_root CROSS JOIN organization.head_company company JOIN "
                        + "organization.head_company_brand_authorization authorization_fact ON "
                        + "authorization_fact.head_company_id=company.id JOIN organization.brand brand ON "
                        + "brand.id=authorization_fact.brand_id WHERE company.id=? AND company.workspace_uuid=? AND "
                        + "company.group_workspace_key=? AND company.status='ENABLED' AND "
                        + "authorization_fact.brand_id=? "
                        + "AND brand.status='ENABLED'",
                statement -> {
                    statement.setString(1, key);
                    statement.setObject(2, targetId);
                    statement.setObject(3, workspaceUuid);
                    statement.setString(4, key);
                    statement.setObject(5, brandRef);
                },
                rows -> {
                    if (!rows.next()) throw new BusinessEntityService.OrganizationValidationException();
                    UUID groupRef = rows.getObject(1, UUID.class);
                    UUID companyRef = rows.getObject(2, UUID.class);
                    return new CatalogCommandScopeFacts(
                            new TaskPath(
                                    ServiceNodeTypes.HEAD_COMPANY,
                                    companyRef,
                                    List.of(groupRef, companyRef),
                                    rows.getString(3) + " " + rows.getString(4),
                                    List.of(new TaskPathNode(
                                            companyRef,
                                            rows.getString(3),
                                            rows.getString(4),
                                            ServiceNodeTypes.HEAD_COMPANY))),
                            new CatalogScopeLookup.CatalogBrandJudgment(
                                    brandRef.toString(),
                                    "HEAD_COMPANY_BRAND_AUTHORIZATION",
                                    "HEAD_COMPANY_VERSION:" + rows.getLong(5) + ":BRAND_VERSION:" + rows.getLong(6)
                                            + ":AUTHORIZED_AT:" + rows.getLong(7)));
                });
    }

    private TaskPath storePath(UUID workspaceUuid, String key, UUID groupId, UUID targetId) {
        StorePathRow target = jdbc.query(
                "SELECT s.id, s.project_id, s.code, s.name, p.id, p.parent_id, p.code, p.name, r.id, r.code, r.name "
                        + "FROM organization.store s JOIN organization.organization_node p ON p.id=s.project_id "
                        + "AND p.workspace_uuid=s.workspace_uuid AND p.group_workspace_key=s.group_workspace_key "
                        + "AND p.node_type='PROJECT' AND p.status='ENABLED' JOIN organization.organization_node r "
                        + "ON r.id=p.parent_id AND r.workspace_uuid=p.workspace_uuid AND r.group_workspace_key="
                        + "p.group_workspace_key AND r.node_type='REGION' AND r.status='ENABLED' WHERE s.id=? AND "
                        + "s.workspace_uuid=? AND s.group_workspace_key=? AND s.status='ENABLED'",
                statement -> {
                    statement.setObject(1, targetId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                },
                result -> result.next()
                        ? new StorePathRow(
                                result.getObject(1, UUID.class),
                                result.getObject(2, UUID.class),
                                result.getString(3),
                                result.getString(4),
                                result.getObject(9, UUID.class),
                                result.getString(7),
                                result.getString(8),
                                result.getString(10),
                                result.getString(11))
                        : null);
        if (target == null) throw new TaskPathNotFoundException();
        return new TaskPath(
                ServiceNodeTypes.STORE,
                target.id(),
                List.of(groupId, target.regionId(), target.projectId(), target.id()),
                target.regionCode() + " " + target.regionName() + " / " + target.projectCode() + " "
                        + target.projectName() + " / "
                        + target.code() + " " + target.name(),
                List.of(
                        new TaskPathNode(
                                target.regionId(), target.regionCode(), target.regionName(), ServiceNodeTypes.REGION),
                        new TaskPathNode(
                                target.projectId(),
                                target.projectCode(),
                                target.projectName(),
                                ServiceNodeTypes.PROJECT),
                        new TaskPathNode(target.id(), target.code(), target.name(), ServiceNodeTypes.STORE)));
    }

    private CatalogCommandScopeFacts storeCatalogCommandScopeFacts(
            UUID workspaceUuid, String key, UUID targetId, CatalogScopeLookup.CatalogBrandSelection selection) {
        String requestedBrandRef = selection == null ? null : selection.value();
        return jdbc.query(
                "SELECT group_root.commercial_group_uuid, store.id, store.project_id, store.code, store.name, "
                        + "region.id, project.code, project.name, region.code, region.name, store.brand_id, "
                        + "store.version "
                        + "FROM organization.commercial_group group_root JOIN organization.store store ON "
                        + "store.group_workspace_key=group_root.group_workspace_key JOIN "
                        + "organization.organization_node "
                        + "project ON project.id=store.project_id AND project.workspace_uuid=store.workspace_uuid AND "
                        + "project.group_workspace_key=store.group_workspace_key AND project.node_type='PROJECT' AND "
                        + "project.status='ENABLED' JOIN organization.organization_node region ON "
                        + "region.id=project.parent_id "
                        + "AND region.workspace_uuid=project.workspace_uuid AND region.group_workspace_key="
                        + "project.group_workspace_key AND region.node_type='REGION' AND region.status='ENABLED' WHERE "
                        + "group_root.group_workspace_key=? AND store.id=? AND store.workspace_uuid=? AND "
                        + "store.group_workspace_key=? AND store.status='ENABLED'",
                statement -> {
                    statement.setString(1, key);
                    statement.setObject(2, targetId);
                    statement.setObject(3, workspaceUuid);
                    statement.setString(4, key);
                },
                rows -> {
                    if (!rows.next()) throw new TaskPathNotFoundException();
                    UUID brandRef = rows.getObject(11, UUID.class);
                    if (requestedBrandRef != null && !requestedBrandRef.equals(brandRef.toString())) {
                        throw new BusinessEntityService.OrganizationValidationException();
                    }
                    UUID groupRef = rows.getObject(1, UUID.class);
                    UUID storeRef = rows.getObject(2, UUID.class);
                    return new CatalogCommandScopeFacts(
                            new TaskPath(
                                    ServiceNodeTypes.STORE,
                                    storeRef,
                                    List.of(
                                            groupRef,
                                            rows.getObject(6, UUID.class),
                                            rows.getObject(3, UUID.class),
                                            storeRef),
                                    rows.getString(9)
                                            + " "
                                            + rows.getString(10)
                                            + " / "
                                            + rows.getString(7)
                                            + " "
                                            + rows.getString(8)
                                            + " / "
                                            + rows.getString(4)
                                            + " "
                                            + rows.getString(5),
                                    List.of(
                                            new TaskPathNode(
                                                    rows.getObject(6, UUID.class),
                                                    rows.getString(9),
                                                    rows.getString(10),
                                                    ServiceNodeTypes.REGION),
                                            new TaskPathNode(
                                                    rows.getObject(3, UUID.class),
                                                    rows.getString(7),
                                                    rows.getString(8),
                                                    ServiceNodeTypes.PROJECT),
                                            new TaskPathNode(
                                                    storeRef,
                                                    rows.getString(4),
                                                    rows.getString(5),
                                                    ServiceNodeTypes.STORE))),
                            new CatalogScopeLookup.CatalogBrandJudgment(
                                    brandRef.toString(), "STORE_PERSISTED_BRAND", "STORE_VERSION:" + rows.getLong(12)));
                });
    }

    private Map<UUID, Store> stores(UUID workspaceUuid, String key, Set<UUID> ids, boolean includeDisabledFacts) {
        if (ids.isEmpty()) return Map.of();
        List<Store> values = jdbc.query(
                "SELECT id, project_id, code, name FROM organization.store WHERE workspace_uuid=? AND "
                        + "group_workspace_key=?"
                        + enabledOnly(includeDisabledFacts) + " AND id IN (" + placeholders(ids.size()) + ")",
                (row, index) -> new Store(
                        row.getObject(1, UUID.class), row.getObject(2, UUID.class), row.getString(3), row.getString(4)),
                arguments(workspaceUuid, key, ids));
        LinkedHashMap<UUID, Store> result = new LinkedHashMap<>();
        values.forEach(value -> result.put(value.id(), value));
        return Map.copyOf(result);
    }

    private Map<UUID, Entity> headCompanies(
            UUID workspaceUuid, String key, Set<UUID> ids, boolean includeDisabledFacts) {
        if (ids.isEmpty()) return Map.of();
        List<Entity> values = jdbc.query(
                "SELECT id, code, name FROM organization.head_company WHERE workspace_uuid=? AND group_workspace_key=?"
                        + enabledOnly(includeDisabledFacts) + " AND id IN (" + placeholders(ids.size()) + ")",
                (row, index) -> new Entity(row.getObject(1, UUID.class), row.getString(2), row.getString(3)),
                arguments(workspaceUuid, key, ids));
        LinkedHashMap<UUID, Entity> result = new LinkedHashMap<>();
        values.forEach(value -> result.put(value.id(), value));
        return Map.copyOf(result);
    }

    private Map<UUID, NodePath> nodePaths(
            UUID workspaceUuid, String key, UUID groupId, Set<UUID> ids, boolean includeDisabledFacts) {
        if (ids.isEmpty()) return Map.of();
        Map<UUID, NodePath> values = jdbc.query(
                "WITH RECURSIVE ancestry AS ("
                        + "SELECT node.id AS target_id, node.id, node.parent_id, node.node_type, node.code, node.name, "
                        + "0 AS depth "
                        + "FROM organization.organization_node node WHERE node.workspace_uuid=? AND "
                        + "node.group_workspace_key=?"
                        + enabledOnly("node", includeDisabledFacts) + " AND node.id IN (" + placeholders(ids.size())
                        + ") UNION ALL "
                        + "SELECT ancestry.target_id, parent.id, parent.parent_id, parent.node_type, parent.code, "
                        + "parent.name, ancestry.depth + 1 "
                        + "FROM organization.organization_node parent JOIN ancestry ON ancestry.parent_id=parent.id "
                        + "WHERE parent.workspace_uuid=? AND parent.group_workspace_key=?"
                        + enabledOnly("parent", includeDisabledFacts)
                        + ") SELECT target_id, max(node_type) FILTER (WHERE depth=0) AS target_type, array_agg(id "
                        + "ORDER BY depth DESC) AS ancestor_ids, array_agg(id ORDER BY depth DESC) AS path_node_refs, "
                        + "array_agg(code ORDER BY depth DESC) AS path_node_codes, "
                        + "array_agg(name ORDER BY depth DESC) AS path_node_names, "
                        + "array_agg(node_type ORDER BY depth DESC) AS path_node_types, string_agg(code "
                        + "|| ' ' || name, ' / ' ORDER BY depth DESC) AS display_path FROM ancestry GROUP BY target_id",
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
                        paths.put(
                                targetId,
                                new NodePath(
                                        result.getString("target_type"),
                                        new TaskPath(
                                                result.getString("target_type"),
                                                targetId,
                                                ancestors,
                                                result.getString("display_path"),
                                                pathNodes(result))));
                    }
                    return paths;
                });
        if (values == null) throw new TaskPathNotFoundException();
        return Map.copyOf(values);
    }

    private static Set<UUID> idsFor(Set<TaskPathRef> targets, String type) {
        LinkedHashSet<UUID> ids = new LinkedHashSet<>();
        targets.stream()
                .filter(target -> type.equals(target.targetType()))
                .forEach(target -> ids.add(target.targetId()));
        return ids;
    }

    private Set<TaskPathRef> availableNodes(UUID workspaceUuid, String key, Set<TaskPathRef> targets) {
        Set<UUID> ids = new LinkedHashSet<>();
        targets.stream()
                .filter(target -> ServiceNodeTypes.REGION.equals(target.targetType())
                        || ServiceNodeTypes.PROJECT.equals(target.targetType()))
                .forEach(target -> ids.add(target.targetId()));
        if (ids.isEmpty()) return Set.of();
        List<TaskPathRef> values = jdbc.query(
                "SELECT id, node_type FROM organization.organization_node WHERE workspace_uuid=? AND "
                        + "group_workspace_key=? AND status='ENABLED' AND id IN ("
                        + placeholders(ids.size()) + ")",
                (row, index) -> new TaskPathRef(row.getString(2), row.getObject(1, UUID.class)),
                arguments(workspaceUuid, key, ids));
        return Set.copyOf(values);
    }

    private Set<TaskPathRef> availableEntities(
            UUID workspaceUuid, String key, Set<TaskPathRef> targets, String targetType, String table) {
        Set<UUID> ids = idsFor(targets, targetType);
        if (ids.isEmpty()) return Set.of();
        List<TaskPathRef> values = jdbc.query(
                "SELECT id FROM organization." + table
                        + " WHERE workspace_uuid=? AND group_workspace_key=? AND status='ENABLED' AND id IN ("
                        + placeholders(ids.size()) + ")",
                (row, index) -> new TaskPathRef(targetType, row.getObject(1, UUID.class)),
                arguments(workspaceUuid, key, ids));
        return Set.copyOf(values);
    }

    private static String placeholders(int count) {
        return String.join(",", java.util.Collections.nCopies(count, "?"));
    }

    private static String nameCode(String name, String code) {
        return name + "（" + code + "）";
    }

    private static boolean supportedTargetType(String targetType) {
        return Set.of(
                        ServiceNodeTypes.GROUP,
                        ServiceNodeTypes.REGION,
                        ServiceNodeTypes.PROJECT,
                        ServiceNodeTypes.HEAD_COMPANY,
                        ServiceNodeTypes.STORE)
                .contains(targetType);
    }

    private static String enabledOnly(boolean includeDisabledFacts) {
        return includeDisabledFacts ? "" : " AND status='ENABLED'";
    }

    private static String enabledOnly(String table, boolean includeDisabledFacts) {
        return includeDisabledFacts ? "" : " AND " + table + ".status='ENABLED'";
    }

    private static Object[] arguments(UUID workspaceUuid, String key, Set<UUID> ids) {
        List<Object> values = new ArrayList<>();
        values.add(workspaceUuid);
        values.add(key);
        values.addAll(ids);
        return values.toArray();
    }

    private static void bind(
            java.sql.PreparedStatement statement,
            UUID workspaceUuid,
            String key,
            Set<UUID> ids,
            UUID parentWorkspaceUuid,
            String parentKey)
            throws java.sql.SQLException {
        int index = 1;
        statement.setObject(index++, workspaceUuid);
        statement.setString(index++, key);
        for (UUID id : ids) statement.setObject(index++, id);
        statement.setObject(index++, parentWorkspaceUuid);
        statement.setString(index, parentKey);
    }

    private Node node(UUID workspaceUuid, String key, UUID id, String expectedType) {
        Node result = jdbc.query(
                "SELECT id, parent_id, node_type, code, name FROM organization.organization_node WHERE id=? AND "
                        + "workspace_uuid=? AND group_workspace_key=? AND status='ENABLED'",
                statement -> {
                    statement.setObject(1, id);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                },
                row -> row.next()
                        ? new Node(
                                row.getObject(1, UUID.class),
                                row.getObject(2, UUID.class),
                                row.getString(3),
                                row.getString(4),
                                row.getString(5))
                        : null);
        if (result == null || !expectedType.equals(result.type())) throw new TaskPathNotFoundException();
        return result;
    }

    private Entity entity(UUID workspaceUuid, String key, UUID id, String table) {
        Entity result = jdbc.query(
                "SELECT id, code, name FROM organization." + table
                        + " WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND status='ENABLED'",
                statement -> {
                    statement.setObject(1, id);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                },
                row -> row.next()
                        ? new Entity(row.getObject(1, UUID.class), row.getString(2), row.getString(3))
                        : null);
        if (result == null) throw new TaskPathNotFoundException();
        return result;
    }

    private record Node(UUID id, UUID parentId, String type, String code, String name) {}

    private record Store(UUID id, UUID projectId, String code, String name) {}

    private record StorePathRow(
            UUID id,
            UUID projectId,
            String code,
            String name,
            UUID regionId,
            String projectCode,
            String projectName,
            String regionCode,
            String regionName) {}

    private record Entity(UUID id, String code, String name) {}

    private record NodePath(String type, TaskPath taskPath) {}

    public static final class TaskPathNotFoundException extends RuntimeException {}
}
