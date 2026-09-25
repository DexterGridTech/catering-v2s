package com.catering.v2s.organization.application.persistence;

import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.OrganizationNodeTypes;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup.CatalogCommandScopeFacts;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup.CommandTaskPathFacts;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup.SessionTaskTargetFacts;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup.StoreProjectCommandFacts;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup.TaskPath;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup.TaskPathNode;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup.TaskPathRef;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OrganizationTaskPathService;
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
import org.springframework.stereotype.Repository;

/** Resolves only organization-owned task facts; consumers receive no schema access. */
@Repository
public class OrganizationTaskPathPersistence {
    private final JdbcTemplate jdbc;
    private final CommercialGroupLookup groups;

    public OrganizationTaskPathPersistence(JdbcTemplate jdbc, CommercialGroupLookup groups) {
        this.jdbc = jdbc;
        this.groups = groups;
    }

    public TaskPath requireGroupTaskPath(UUID workspaceUuid, String key) {
        if (workspaceUuid == null || key == null) throw new OrganizationTaskPathService.TaskPathNotFoundException();
        return jdbc.query(
                OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_SELECT_COMMERCIAL_GROUP_UUID
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_COMMERCIAL_GROUP_GROUP_WORKSPACE_KEY,
                statement -> statement.setString(1, key),
                result -> {
                    if (!result.next()) throw new OrganizationTaskPathService.TaskPathNotFoundException();
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

    public TaskPath requireTaskPath(UUID workspaceUuid, String key, String targetType, UUID targetId) {
        if (workspaceUuid == null || key == null || targetId == null)
            throw new OrganizationTaskPathService.TaskPathNotFoundException();
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
            default -> throw new OrganizationTaskPathService.TaskPathNotFoundException();
        };
    }

    /** One non-transactional owner statement for the Store edge's project scope and immutable update facts. */
    public StoreProjectCommandFacts requireStoreProjectCommandFacts(UUID workspaceUuid, String key, UUID storeId) {
        if (workspaceUuid == null || key == null || storeId == null)
            throw new OrganizationTaskPathService.TaskPathNotFoundException();
        return jdbc.query(
                OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_CTE_GROUP_FACT_COMMERCIAL_GROUP_UUID_GROUP_ID
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_COMMERCIAL_GROUP_GROUP_WORKSPACE_KEY_STORE_FACT
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_STORE_PROJECT_ID_TENANT_ID_BRAND_ID
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_ORGANIZATION_NODE_STORE_PROJECT
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_PROJECT_STORE_PROJECT_ID_WORKSPACE_UUID
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_PROJECT_GROUP_WORKSPACE_KEY_STORE_NODE_TYPE
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_GROUP_FACT_PROJECT_STATUS_ENABLED_STORE
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ANCESTRY
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_STORE_FACT_PROJECT_ID_TARGET_ID_NODE
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ORGANIZATION_NODE_NODE_NAME_DEPTH
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_NODE_STORE_FACT_PROJECT_ID_WORKSPACE_UUID
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_NODE_STATUS_ENABLED_ANCESTRY
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_PARENT_NODE_TYPE_CODE_NAME
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_ANCESTRY_ORGANIZATION_NODE_PARENT_PARENT_ID
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_PARENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_SELECT
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_STORE_FACT_PROJECT_ID_TENANT_ID_BRAND_ID
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ANCESTRY_TARGET_ID_NODE_TYPE_FILTER
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_ANCESTRY_DEPTH_ANCESTOR_IDS
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_ANCESTRY_DEPTH_PATH_NODE_REFS
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_ANCESTRY_CODE_DEPTH
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_ANCESTRY_NAME_DEPTH
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_ANCESTRY_NODE_TYPE_DEPTH
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_STRING_AGG_ANCESTRY_CODE_NAME
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_ANCESTRY_DISPLAY_PATH_GROUP_ID
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ANCESTRY_TARGET_ID_STORE_FACT_PROJECT_ID
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_STORE_FACT_TENANT_ID_BRAND_ID_CODE
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_STORE_FACT_GROUP_ID,
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
                        throw new OrganizationTaskPathService.TaskPathNotFoundException();
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

    /** One set-based membership owner read; Store status is intentionally not filtered for template saves. */
    public Map<UUID, UUID> requireStoreProjectMemberships(UUID workspaceUuid, String key, List<UUID> storeIds) {
        if (workspaceUuid == null || key == null || storeIds == null)
            throw new OrganizationTaskPathService.TaskPathNotFoundException();
        LinkedHashSet<UUID> requested = new LinkedHashSet<>();
        for (UUID storeId : storeIds) {
            if (storeId == null || !requested.add(storeId))
                throw new OrganizationTaskPathService.TaskPathNotFoundException();
        }
        if (requested.isEmpty()) return Map.of();
        return jdbc.query(
                OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_CTE_COMMERCIAL_GROUP_GROUP_FACT_COMMERCIAL_GROUP_UUID
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_WHERE_GROUP_WORKSPACE_KEY_STORE_STORE_ID_PROJECT_ID
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_ORGANIZATION_NODE_STORE_PROJECT_ALTERNATE_A
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_PROJECT_STORE_PROJECT_ID_WORKSPACE_UUID_ALTERNATE_A
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_PROJECT_GROUP_WORKSPACE_KEY_STORE_NODE_TYPE_ALTERNATE_A
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_GROUP_FACT_PROJECT_STATUS_ENABLED_STORE_ALTERNATE_A
                        + placeholders(requested.size())
                        + OrganizationTaskPathServiceSql.STORE_MEMBERSHIP_SCOPE_SUFFIX,
                statement -> {
                    int index = 1;
                    statement.setString(index++, key);
                    for (UUID storeId : requested) statement.setObject(index++, storeId);
                    statement.setObject(index++, workspaceUuid);
                    statement.setString(index, key);
                },
                result -> {
                    LinkedHashMap<UUID, UUID> projectRefsByStore = new LinkedHashMap<>();
                    while (result.next()) {
                        UUID storeId = result.getObject("store_id", UUID.class);
                        if (!requested.contains(storeId)
                                || projectRefsByStore.put(storeId, result.getObject("project_id", UUID.class))
                                        != null) {
                            throw new OrganizationTaskPathService.TaskPathNotFoundException();
                        }
                    }
                    if (!projectRefsByStore.keySet().equals(requested))
                        throw new OrganizationTaskPathService.TaskPathNotFoundException();
                    return Map.copyOf(projectRefsByStore);
                });
    }

    public CatalogCommandScopeFacts resolveCatalogCommandScopeFacts(
            UUID workspaceUuid,
            String key,
            String targetType,
            UUID targetId,
            CatalogScopeLookup.CatalogBrandSelection selection) {
        if (workspaceUuid == null || key == null || targetId == null)
            throw new OrganizationTaskPathService.TaskPathNotFoundException();
        return switch (targetType) {
            case ServiceNodeTypes.STORE -> storeCatalogCommandScopeFacts(workspaceUuid, key, targetId, selection);
            case ServiceNodeTypes.HEAD_COMPANY -> headCompanyCatalogCommandScopeFacts(
                    workspaceUuid, key, targetId, selection);
            default -> throw new OrganizationTaskPathService.TaskPathNotFoundException();
        };
    }

    /**
     * Project scope is the hot command-path projection. The generic resolver first borrowed the commercial-group fact
     * and then queried the recursive node path even though both facts are immutable inputs to one TaskPath. Keep the
     * same enabled target/ancestor and type checks, but obtain the closed projection in one owner statement.
     */
    private TaskPath requireEnabledProjectTaskPath(UUID workspaceUuid, String key, UUID targetId) {
        return jdbc.query(
                OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_CTE_GROUP_FACT_COMMERCIAL_GROUP_UUID_GROUP_ID_ALTERNATE_A
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_COMMERCIAL_GROUP_GROUP_WORKSPACE_KEY_PARAMS
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_WORKSPACE_UUID_TEXT_GROUP_WORKSPACE_KEY_TARGET_ID
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_FROM_CLAUSE
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_GROUP_FACT_ANCESTRY_NODE_TARGET_ID
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ORGANIZATION_NODE_NODE_NODE_TYPE_CODE_NAME
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_PARAMS_NODE_WORKSPACE_UUID
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_NODE_GROUP_WORKSPACE_KEY_PARAMS_STATUS
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_NODE_PARAMS_TARGET_ID_ANCESTRY
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_PARENT_NODE_TYPE_CODE_NAME_ALTERNATE_A
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_ANCESTRY_ORGANIZATION_NODE_PARENT_PARENT_ID_ALTERNATE_A
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_CROSS_JOIN
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_PARAMS_PARENT_WORKSPACE_UUID
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_PARENT_GROUP_WORKSPACE_KEY_PARAMS_STATUS
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ANCESTRY_TARGET_ID_NODE_TYPE_FILTER_ALTERNATE_A
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_ANCESTRY_DEPTH_ANCESTOR_IDS_ALTERNATE_A
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_ANCESTRY_DEPTH_PATH_NODE_REFS_ALTERNATE_A
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_ANCESTRY_CODE_DEPTH_ALTERNATE_A
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_ANCESTRY_NAME_DEPTH_ALTERNATE_A
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_ANCESTRY_NODE_TYPE_DEPTH_ALTERNATE_A
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_STRING_AGG_ANCESTRY_CODE
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_ANCESTRY_NAME_DEPTH_DISPLAY_PATH
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_PARAMS_GROUP_ID
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_PARAMS_GROUP_ID_TARGET_ID,
                statement -> {
                    statement.setString(1, key);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                    statement.setObject(4, targetId);
                },
                result -> {
                    if (!result.next() || !ServiceNodeTypes.PROJECT.equals(result.getString("target_type")))
                        throw new OrganizationTaskPathService.TaskPathNotFoundException();
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
        String storeStatusPredicate = allowDisabledStore
                ? ""
                : OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_CONDITION_STORE_STATUS_ENABLED;
        return jdbc.query(
                OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_CTE_GROUP_FACT_COMMERCIAL_GROUP_UUID_GROUP_ID_ALTERNATE_B
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_COMMERCIAL_GROUP_GROUP_WORKSPACE_KEY_STORE_FACT_ALTERNATE_A
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_STORE_STORE_ID_PROJECT_ID_CODE
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_PROJECT_PARENT_ID_REGION_ID_CODE
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_REGION_CODE_REGION_CODE_NAME
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_ORGANIZATION_NODE_STORE_PROJECT_ALTERNATE_B
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_PROJECT_STORE_PROJECT_ID_WORKSPACE_UUID_ALTERNATE_B
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_PROJECT_GROUP_WORKSPACE_KEY_STORE_NODE_TYPE_ALTERNATE_B
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ORGANIZATION_NODE_PROJECT_STATUS_ENABLED_REGION
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_REGION_PROJECT_PARENT_ID_WORKSPACE_UUID
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_REGION_GROUP_WORKSPACE_KEY_PROJECT_NODE_TYPE
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_GROUP_FACT_REGION_STATUS_ENABLED_STORE
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + storeStatusPredicate
                        + OrganizationTaskPathServiceSql.STORE_FACT_SELECT_SUFFIX,
                statement -> {
                    statement.setString(1, key);
                    statement.setObject(2, targetId);
                    statement.setObject(3, workspaceUuid);
                    statement.setString(4, key);
                },
                result -> {
                    if (!result.next()) throw new OrganizationTaskPathService.TaskPathNotFoundException();
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
    public TaskPath requireStatusTransitionTaskPath(UUID workspaceUuid, String key, String targetType, UUID targetId) {
        TaskPathRef target = new TaskPathRef(targetType, targetId);
        TaskPath taskPath = resolveTaskPaths(workspaceUuid, key, List.of(target), true, true)
                .get(target);
        if (taskPath == null) throw new OrganizationTaskPathService.TaskPathNotFoundException();
        return taskPath;
    }

    /** A disabled Store may remain a business-channel target, but its organization ancestors remain enabled-only. */
    public TaskPath requireTaskPathAllowingDisabledTarget(
            UUID workspaceUuid, String key, String targetType, UUID targetId) {
        if (!ServiceNodeTypes.STORE.equals(targetType))
            throw new OrganizationTaskPathService.TaskPathNotFoundException();
        return requireStoreTaskPath(workspaceUuid, key, targetId, true);
    }

    /** Bounded enabled task-path resolution for authority, candidate, and session callers. */
    public Map<TaskPathRef, TaskPath> requireTaskPaths(UUID workspaceUuid, String key, List<TaskPathRef> targets) {
        return resolveTaskPaths(workspaceUuid, key, targets, false, false);
    }

    public Map<TaskPathRef, TaskPath> describePersistedTaskPaths(
            UUID workspaceUuid, String key, List<TaskPathRef> targets) {
        if (workspaceUuid == null || key == null || targets == null)
            throw new OrganizationTaskPathService.TaskPathNotFoundException();
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
                            throw new OrganizationTaskPathService.TaskPathNotFoundException();
                        }
                    }
                    return Map.copyOf(paths);
                });
        if (result == null
                || result.size() != requested.size()
                || !result.keySet().equals(requested))
            throw new OrganizationTaskPathService.TaskPathNotFoundException();
        return result;
    }

    private static List<TaskPathNode> pathNodes(java.sql.ResultSet rows) throws SQLException {
        Object[] refs = (Object[]) rows.getArray("path_node_refs").getArray();
        Object[] codes = (Object[]) rows.getArray("path_node_codes").getArray();
        Object[] names = (Object[]) rows.getArray("path_node_names").getArray();
        Object[] types = (Object[]) rows.getArray("path_node_types").getArray();
        if (refs.length != codes.length || refs.length != names.length || refs.length != types.length) {
            throw new OrganizationTaskPathService.TaskPathNotFoundException();
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
        if (workspaceUuid == null || key == null || targets == null)
            throw new OrganizationTaskPathService.TaskPathNotFoundException();
        LinkedHashSet<TaskPathRef> requested = validatedTargets(targets);
        if (requested.isEmpty()) return Map.of();
        UUID groupId = groups.requireCommercialGroupRef(workspaceUuid, key);
        LinkedHashMap<TaskPathRef, TaskPath> result = new LinkedHashMap<>();

        Set<UUID> storeIds = idsFor(requested, ServiceNodeTypes.STORE);
        Map<UUID, Store> stores = stores(workspaceUuid, key, storeIds, includeDisabledEntityFacts);
        if (stores.size() != storeIds.size()) throw new OrganizationTaskPathService.TaskPathNotFoundException();

        Set<UUID> headCompanyIds = idsFor(requested, ServiceNodeTypes.HEAD_COMPANY);
        Map<UUID, Entity> headCompanies = headCompanies(workspaceUuid, key, headCompanyIds, includeDisabledEntityFacts);
        if (headCompanies.size() != headCompanyIds.size())
            throw new OrganizationTaskPathService.TaskPathNotFoundException();

        Set<UUID> nodeIds = new LinkedHashSet<>();
        nodeIds.addAll(idsFor(requested, ServiceNodeTypes.REGION));
        nodeIds.addAll(idsFor(requested, ServiceNodeTypes.PROJECT));
        stores.values().forEach(store -> nodeIds.add(store.projectId()));
        Map<UUID, NodePath> nodes = nodePaths(workspaceUuid, key, groupId, nodeIds, includeDisabledNodeFacts);

        for (TaskPathRef target : requested) {
            switch (target.targetType()) {
                case ServiceNodeTypes.GROUP -> {
                    if (!groupId.equals(target.targetId()))
                        throw new OrganizationTaskPathService.TaskPathNotFoundException();
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
                    if (node == null || !target.targetType().equals(node.type()))
                        throw new OrganizationTaskPathService.TaskPathNotFoundException();
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
                        throw new OrganizationTaskPathService.TaskPathNotFoundException();
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
                default -> throw new OrganizationTaskPathService.TaskPathNotFoundException();
            }
        }
        return Map.copyOf(result);
    }

    /**
     * Presentation-only persisted display needs one organization logical statement even when a page mixes every target
     * family. Authority callers intentionally retain resolveTaskPaths.
     */
    private static String persistedTaskPathsSql() {
        return OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_CTE_REQUESTED_TARGET_TYPE_TARGET_ID
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_SELECT_JSONB_TO_RECORDSET_TARGET_TYPE_TARGET_ID_REQUEST_TEXT
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_TARGET_ID
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_CLOSE_PAREN_COMMERCIAL_GROUP
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_SELECT_COMMERCIAL_GROUP_UUID_ALTERNATE_A
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_COMMERCIAL_GROUP_GROUP_WORKSPACE_KEY_ALTERNATE_A
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_CLOSE_PAREN_TARGET_ROWS
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_SELECT_REQUESTED_TARGET_TYPE_TARGET_ID_COMMERCIAL_GROUP
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_NODE_ID_HEAD_COMPANY_HEAD_COMPANY_ID_STORE
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_FROM_CLAUSE_COMMERCIAL_GROUP_FROM_REQUESTED_CROSS_JOIN_CO
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_ORGANIZATION_NODE_NODE_REQUESTED_TARGET_TYPE_REGION
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_NODE_REQUESTED_TARGET_ID_WORKSPACE_UUID
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_HEAD_COMPANY_REQUESTED_TARGET_TYPE
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_HEAD_COMPANY_REQUESTED_TARGET_ID_WORKSPACE_UUID
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_HEAD_COMPANY_GROUP_WORKSPACE_KEY
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_STORE_REQUESTED_TARGET_TYPE
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_STORE_REQUESTED_TARGET_ID_WORKSPACE_UUID
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_CLOSE_PAREN_NODE_SEEDS_TARGET_TYPE_TARGET_ID_PARENT_ID
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_SELECT_TARGET_TYPE_TARGET_ID_NODE_PARENT_ID
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_FROM_CLAUSE_TARGET_ROWS_FROM_TARGET_ROWS_JOIN
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_ORGANIZATION_NODE_NODE_TARGET_ROWS_NODE_ID
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_UNION_TARGET_ROWS_TARGET_TYPE_TARGET_ID_PROJECT
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_TARGET_ROWS_PROJECT_CODE_NAME_NODE_TYPE
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_JOIN_ORGANIZATION_NODE_PROJECT
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_PROJECT_TARGET_ROWS_PROJECT_ID_WORKSPACE_UUID
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_CLOSE_PAREN_ANCESTRY_TARGET_TYPE_TARGET_ID_PARENT_ID
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_SELECT_NODE_SEEDS_TARGET_TYPE_TARGET_ID_PARENT_ID_CODE
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_UNION_ANCESTRY_TARGET_TYPE_TARGET_ID_PARENT
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_PARENT_CODE_NAME_NODE_TYPE
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_FROM_CLAUSE_ORGANIZATION_NODE_PARENT
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_ANCESTRY_PARENT_ID_PARENT_WORKSPACE_UUID
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_PARENT_GROUP_WORKSPACE_KEY
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_CLOSE_PAREN_NODE_PATHS
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_SELECT_TARGET_TYPE_TARGET_ID_ARRAY_AGG_DEPTH
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_DEPTH_PATH_NODE_REFS_CODE
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_PATH_NODE_CODES_ARRAY_AGG_NAME_DEPTH
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_ORDER_BY_DEPTH_PATH_NODE_TYPES_STRING_AGG_CODE
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_DESC_DIRECTION_ANCESTRY_DISPLAY_PATH_TARGET_TYPE_TARGET_ID
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_CLOSE_PAREN_TARGET_ROWS_TARGET_TYPE_TARGET_ID
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_CASE_TARGET_ROWS_TARGET_TYPE_TARGET_ID_GROUP_ID
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_TARGET_ROWS_GROUP_ID
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_REGION_PROJECT
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_ARRAY_PREPEND_TARGET_ROWS_GROUP_ID_NODE_PATHS
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_HEAD_COMPANY_HEAD_COMPANY_ID
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_TARGET_ROWS_GROUP_ID_HEAD_COMPANY_ID
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_STORE_STORE_ID
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_ARRAY_APPEND_ARRAY_PREPEND_TARGET_ROWS_GROUP_ID
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_TARGET_ROWS_STORE_ID_ANCESTOR_IDS
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_CASE_TARGET_ROWS_TARGET_TYPE_TARGET_ID_GROUP_ID_ALTERNATE_A
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_TARGET_ROWS_GROUP_ID_ALTERNATE_A
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_REGION_PROJECT_ALTERNATE_A
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_NODE_PATHS_PATH_NODE_REFS
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_HEAD_COMPANY_HEAD_COMPANY_ID_ALTERNATE_A
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_TARGET_ROWS_HEAD_COMPANY_ID
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_STORE_STORE_ID_ALTERNATE_A
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_ARRAY_APPEND_NODE_PATHS_PATH_NODE_REFS_TARGET_ROWS
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_PATH_NODE_REFS
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_CASE_TARGET_ROWS_TARGET_TYPE_TARGET_ID_GROUP_ID_ALTERNATE_B
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_COMMERCIAL_GROUP_COMMERCIAL_GROUP_CODE
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_REGION_PROJECT_ALTERNATE_B
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_NODE_PATHS_PATH_NODE_CODES
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_HEAD_COMPANY_HEAD_COMPANY_ID_ALTERNATE_B
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_HEAD_COMPANY_CODE
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_STORE_STORE_ID_ALTERNATE_B
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_ARRAY_APPEND_NODE_PATHS_PATH_NODE_CODES_STORE
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_CASE_TARGET_ROWS_TARGET_TYPE_TARGET_ID_GROUP_ID_ALTERNATE_C
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_COMMERCIAL_GROUP_COMMERCIAL_GROUP_NAME
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_REGION_PROJECT_ALTERNATE_C
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_NODE_PATHS_PATH_NODE_NAMES
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_HEAD_COMPANY_HEAD_COMPANY_ID_ALTERNATE_C
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_HEAD_COMPANY_NAME
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_STORE_STORE_ID_ALTERNATE_C
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_ARRAY_APPEND_NODE_PATHS_PATH_NODE_NAMES_STORE
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_CASE_TARGET_ROWS_TARGET_TYPE_TARGET_ID_GROUP_ID_ALTERNATE_D
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_ARRAY_GROUP
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_REGION_PROJECT_ALTERNATE_D
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_NODE_PATHS_PATH_NODE_TYPES
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_HEAD_COMPANY_HEAD_COMPANY_ID_ALTERNATE_D
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_HEAD_COMPANY
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_STORE_STORE_ID_ALTERNATE_D
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_ARRAY_APPEND_NODE_PATHS_PATH_NODE_TYPES_STORE
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_CASE_TARGET_ROWS_TARGET_TYPE_TARGET_ID_GROUP_ID_ALTERNATE_E
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_COMMERCIAL_GROUP
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_REGION_PROJECT_ALTERNATE_E
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_NODE_PATHS_DISPLAY_PATH
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_HEAD_COMPANY_HEAD_COMPANY_ID_ALTERNATE_E
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_HEAD_COMPANY_CODE_NAME
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_STORE_STORE_ID_ALTERNATE_E
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_NODE_PATHS_DISPLAY_PATH_STORE_CODE
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_DISPLAY_PATH
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_FROM_CLAUSE_COMMERCIAL_GROUP_FROM_TARGET_ROWS_CROSS_JOIN_
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_NODE_PATHS_TARGET_TYPE_TARGET_ROWS
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_NODE_PATHS_TARGET_ID_TARGET_ROWS
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_HEAD_COMPANY_TARGET_ROWS_HEAD_COMPANY_ID
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_STORE_TARGET_ROWS_STORE_ID
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_WHERE_TARGET_ROWS_TARGET_TYPE_TARGET_ID_GROUP_ID
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_TARGET_ROWS_TARGET_TYPE_REGION_PROJECT
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_TARGET_ROWS_TARGET_TYPE_HEAD_COMPANY_HEAD_COMPANY_ID
                + OrganizationTaskPathServiceSql
                        .ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_TARGET_ROWS_TARGET_TYPE_STORE_STORE_ID
                + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_IS_NOT_NULL;
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
                throw new OrganizationTaskPathService.TaskPathNotFoundException();
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

    public Map<TaskPathRef, String> describeTaskTargetLabels(
            UUID workspaceUuid, String key, List<TaskPathRef> targets) {
        if (workspaceUuid == null || key == null || targets == null)
            throw new OrganizationTaskPathService.TaskPathNotFoundException();
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
            throw new OrganizationTaskPathService.TaskPathNotFoundException();
        }

        UUID groupId = groups.requireCommercialGroupRef(workspaceUuid, key);
        LinkedHashMap<TaskPathRef, String> labels = new LinkedHashMap<>();
        for (TaskPathRef group : requested.stream()
                .filter(target -> ServiceNodeTypes.GROUP.equals(target.targetType()))
                .toList()) {
            if (!groupId.equals(group.targetId())) throw new OrganizationTaskPathService.TaskPathNotFoundException();
            labels.put(group, groups.describeCommercialGroup(workspaceUuid, key, groupId));
        }

        Set<UUID> nodeIds = new LinkedHashSet<>();
        nodeIds.addAll(idsFor(requested, ServiceNodeTypes.REGION));
        nodeIds.addAll(idsFor(requested, ServiceNodeTypes.PROJECT));
        if (!nodeIds.isEmpty()) {
            List<Node> nodes = jdbc.query(
                    OrganizationTaskPathServiceSql
                                    .ORGANIZATION_TASK_PATH_SERVICE_SELECT_ORGANIZATION_NODE_PARENT_ID_NODE_TYPE_CODE_NAME
                            + OrganizationTaskPathServiceSql
                                    .ORGANIZATION_TASK_PATH_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_ENABLED
                            + placeholders(nodeIds.size())
                            + OrganizationTaskPathServiceSql.SQL_CLOSE_PAREN,
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
                throw new OrganizationTaskPathService.TaskPathNotFoundException();
            labels.put(new TaskPathRef(ServiceNodeTypes.STORE, store.id()), nameCode(store.name(), store.code()));
        }
        if (labels.size() != requested.size()) throw new OrganizationTaskPathService.TaskPathNotFoundException();
        return Map.copyOf(labels);
    }

    /**
     * One owner-local read pass for session-entry composition. Availability and labels are derived from the same
     * enabled organization facts; this is deliberately invocation-local and is not an authorization cache.
     */
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
                        OrganizationTaskPathServiceSql
                                        .ORGANIZATION_TASK_PATH_SERVICE_SELECT_ORGANIZATION_NODE_PARENT_ID_NODE_TYPE_CODE_NAME_ALTERNATE_A
                                + OrganizationTaskPathServiceSql
                                        .ORGANIZATION_TASK_PATH_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_ENABLED_ALTERNATE_A
                                + placeholders(nodeIds.size())
                                + OrganizationTaskPathServiceSql.SQL_CLOSE_PAREN,
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
            if (!groupId.equals(group.targetId())) throw new OrganizationTaskPathService.TaskPathNotFoundException();
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
                throw new OrganizationTaskPathService.TaskPathNotFoundException();
            labels.put(ref, nameCode(store.name(), store.code()));
        }
        if (labels.size() != labelTargets.size()) throw new OrganizationTaskPathService.TaskPathNotFoundException();
        return new SessionTaskTargetFacts(available, labels);
    }

    public boolean isScopeAllowed(
            UUID workspaceUuid, String key, String assignmentType, UUID assignmentId, TaskPath target) {
        return scopeAllowed(assignmentType, assignmentId, target);
    }

    /** One owner transaction for command target/path resolution and range judgment. */
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
        if (!groupId.equals(targetId) || !groupId.equals(group.targetId()))
            throw new OrganizationTaskPathService.TaskPathNotFoundException();
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
                OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_CTE_COMMERCIAL_GROUP_GROUP_ROOT_COMMERCIAL_GROUP_UUID
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_GROUP_WORKSPACE_KEY
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_COMPANY_NAME_VERSION_BRAND
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_AUTHORIZATION_FACT_AUTHORIZED_AT_EPOCH_MILLIS
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_HEAD_COMPANY_GROUP_ROOT_COMPANY
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_HEAD_COMPANY_BRAND_AUTHORIZATION_AUTHORIZATION_FACT
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_BRAND_AUTHORIZATION_FACT_HEAD_COMPANY_ID_COMPANY
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_BRAND_AUTHORIZATION_FACT_BRAND_ID_COMPANY
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_COMPANY_GROUP_WORKSPACE_KEY_STATUS_ENABLED
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_AUTHORIZATION_FACT_BRAND_ID
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_CONDITION_BRAND_STATUS_ENABLED,
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
                OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_SELECT_PROJECT_ID_CODE_NAME_PARENT_ID
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_FROM_CLAUSE_ORGANIZATION_NODE_PROJECT_ID
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_CONDITION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_CONDITION_ORGANIZATION_NODE_NODE_TYPE_PROJECT_STATUS_ENABLED
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_JOIN_CONDITION_PARENT_ID_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_GROUP_WORKSPACE_KEY_NODE_TYPE_REGION_STATUS
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_ENABLED_ALTERNATE_B,
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
        if (target == null) throw new OrganizationTaskPathService.TaskPathNotFoundException();
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
                OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_SELECT_GROUP_ROOT_COMMERCIAL_GROUP_UUID_STORE_PROJECT_ID
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_REGION_PROJECT_CODE_NAME
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_STORE_VERSION
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_FROM_CLAUSE_STORE_GROUP_ROOT
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_STORE_GROUP_WORKSPACE_KEY_GROUP_ROOT
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_ORGANIZATION_NODE
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_PROJECT_STORE_PROJECT_ID_WORKSPACE_UUID_ALTERNATE_C
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_PROJECT_GROUP_WORKSPACE_KEY_STORE_NODE_TYPE_ALTERNATE_C
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ORGANIZATION_NODE_PROJECT_STATUS_ENABLED_REGION_ALTERNATE_A
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_REGION_PROJECT_PARENT_ID
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_CONDITION_REGION_WORKSPACE_UUID_PROJECT_GROUP_WORKSPACE_KEY
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_PROJECT_GROUP_WORKSPACE_KEY_REGION_NODE_TYPE
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_GROUP_ROOT_GROUP_WORKSPACE_KEY_STORE_WORKSPACE_UUID
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_STORE_GROUP_WORKSPACE_KEY_STATUS_ENABLED,
                statement -> {
                    statement.setString(1, key);
                    statement.setObject(2, targetId);
                    statement.setObject(3, workspaceUuid);
                    statement.setString(4, key);
                },
                rows -> {
                    if (!rows.next()) throw new OrganizationTaskPathService.TaskPathNotFoundException();
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
                OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_SELECT_STORE_PROJECT_ID_CODE_NAME_WORKSPACE_UUID
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_GROUP_WORKSPACE_KEY_ALTERNATE_A
                        + enabledOnly(includeDisabledFacts)
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_CONDITION_AND_ID_IN
                        + placeholders(ids.size())
                        + OrganizationTaskPathServiceSql.SQL_CLOSE_PAREN,
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
                OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_SELECT_HEAD_COMPANY_CODE_NAME_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + enabledOnly(includeDisabledFacts)
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_CONDITION_AND_ID_IN_ALTERNATE_A
                        + placeholders(ids.size())
                        + OrganizationTaskPathServiceSql.SQL_CLOSE_PAREN,
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
                OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_CTE_ANCESTRY
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_SELECT_NODE_TARGET_ID_PARENT_ID_NODE_TYPE
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_DEPTH
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_FROM_CLAUSE_ORGANIZATION_NODE_NODE_WORKSPACE_UUID
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_NODE_GROUP_WORKSPACE_KEY
                        + enabledOnly("node", includeDisabledFacts)
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_CONDITION_NODE
                        + placeholders(ids.size())
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_CLOSE_PAREN_UNION_ALL
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_SELECT_ANCESTRY_TARGET_ID_PARENT_PARENT_ID
                        + OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_PARENT_NAME_ANCESTRY_DEPTH
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_FROM_CLAUSE_ANCESTRY_PARENT_PARENT_ID
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_WHERE_PARENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + enabledOnly("parent", includeDisabledFacts)
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_CLOSE_PAREN_TARGET_ID_NODE_TYPE_FILTER_DEPTH
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ORDER_BY_DEPTH_ANCESTOR_IDS_ARRAY_AGG_PATH_NODE_REFS
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_CODE_DEPTH_PATH_NODE_CODES
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_NAME_DEPTH_PATH_NODE_NAMES
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_NODE_TYPE_DEPTH_PATH_NODE_TYPES
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_ANCESTRY_NAME_DEPTH_DISPLAY_PATH_TARGET_ID,
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
        if (values == null) throw new OrganizationTaskPathService.TaskPathNotFoundException();
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
                OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_SELECT_ORGANIZATION_NODE_NODE_TYPE_WORKSPACE_UUID
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_GROUP_WORKSPACE_KEY_STATUS_ENABLED
                        + placeholders(ids.size())
                        + OrganizationTaskPathServiceSql.SQL_CLOSE_PAREN,
                (row, index) -> new TaskPathRef(row.getString(2), row.getObject(1, UUID.class)),
                arguments(workspaceUuid, key, ids));
        return Set.copyOf(values);
    }

    private Set<TaskPathRef> availableEntities(
            UUID workspaceUuid, String key, Set<TaskPathRef> targets, String targetType, String table) {
        Set<UUID> ids = idsFor(targets, targetType);
        if (ids.isEmpty()) return Set.of();
        List<TaskPathRef> values = jdbc.query(
                OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_SELECT_ORGANIZATION_SELECT_ID_FROM_ORGANIZATION
                        + table
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_ENABLED
                        + placeholders(ids.size())
                        + OrganizationTaskPathServiceSql.SQL_CLOSE_PAREN,
                (row, index) -> new TaskPathRef(targetType, row.getObject(1, UUID.class)),
                arguments(workspaceUuid, key, ids));
        return Set.copyOf(values);
    }

    private static String placeholders(int count) {
        return String.join(
                OrganizationTaskPathServiceSql.PLACEHOLDER_SEPARATOR,
                java.util.Collections.nCopies(count, OrganizationTaskPathServiceSql.PARAMETER_PLACEHOLDER));
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
        return includeDisabledFacts
                ? ""
                : OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_CONDITION_STATUS_ENABLED;
    }

    private static String enabledOnly(String table, boolean includeDisabledFacts) {
        return includeDisabledFacts
                ? ""
                : OrganizationTaskPathServiceSql.ENABLED_STATUS_FILTER_PREFIX
                        + table
                        + OrganizationTaskPathServiceSql.ENABLED_STATUS_FILTER_SUFFIX;
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
                OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_SELECT_ORGANIZATION_NODE_PARENT_ID_NODE_TYPE_CODE_NAME_ALTERNATE_B
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_ENABLED_ALTERNATE_C,
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
        if (result == null || !expectedType.equals(result.type()))
            throw new OrganizationTaskPathService.TaskPathNotFoundException();
        return result;
    }

    private Entity entity(UUID workspaceUuid, String key, UUID id, String table) {
        Entity result = jdbc.query(
                OrganizationTaskPathServiceSql.ORGANIZATION_TASK_PATH_SERVICE_SELECT_ORGANIZATION_CODE_NAME
                        + table
                        + OrganizationTaskPathServiceSql
                                .ORGANIZATION_TASK_PATH_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_ENABLED_ALTERNATE_A,
                statement -> {
                    statement.setObject(1, id);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                },
                row -> row.next()
                        ? new Entity(row.getObject(1, UUID.class), row.getString(2), row.getString(3))
                        : null);
        if (result == null) throw new OrganizationTaskPathService.TaskPathNotFoundException();
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
}
