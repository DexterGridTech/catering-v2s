package com.catering.v2s.organization.application.persistence;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.organization.api.OrganizationNodeReadback;
import com.catering.v2s.organization.application.OrganizationHierarchyService.HierarchyPathNode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed persistence boundary for organization hierarchy facts and mutations. */
@Repository
public class OrganizationHierarchyPersistence {
    private final JdbcTemplate jdbc;
    private final OrganizationAuditEventWriter auditEvents;

    public OrganizationHierarchyPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        this.auditEvents = new OrganizationAuditEventWriter(jdbc);
    }

    public int insertNode(
            UUID id,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID parentId,
            String nodeType,
            String code,
            String name,
            String notes,
            long createdAt,
            long updatedAt,
            String extensionValues,
            long extensionRuleRevision) {
        return jdbc.update(
                OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_INSERT_INTO_ORGANIZATION_NODE
                        + OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_NODE_TYPE_CODE_NAME_NOTES
                        + OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS
                        + OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_PARAMETER_PLACEHOLDER
                        + OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_PARAMETER_PLACEHOLDER_ENABLED,
                id,
                workspaceUuid,
                groupWorkspaceKey,
                parentId,
                nodeType,
                code,
                name,
                notes,
                createdAt,
                updatedAt,
                extensionValues,
                extensionRuleRevision);
    }

    public List<OrganizationNodeReadback> listNodes(UUID workspaceUuid, String groupWorkspaceKey) {
        List<OrganizationNodeReadback> nodes = jdbc.query(
                OrganizationHierarchyServiceSql.SELECT_WS_UUID_GRP_WS_001
                        + OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_VERSION
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_ORGANIZATION_NODE_EXTENSION_RULE_REVISION_WORKSPACE_UUID
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_GROUP_WORKSPACE_KEY_NODE_TYPE_REGION_PROJECT,
                (result, row) -> node(result, List.of()),
                workspaceUuid,
                groupWorkspaceKey);
        List<UUID> projectIds = nodes.stream()
                .filter(node -> "PROJECT".equals(node.nodeType()))
                .map(OrganizationNodeReadback::id)
                .toList();
        Map<UUID, List<String>> phases = readPhaseNames(projectIds);
        return nodes.stream()
                .map(node -> withPhases(node, phases.getOrDefault(node.id(), List.of())))
                .toList();
    }

    public long countNodes(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String namePattern,
            String codePattern,
            String status,
            String nodeType,
            UUID projectId) {
        Filter filter = filter(workspaceUuid, groupWorkspaceKey, namePattern, codePattern, status, nodeType, projectId);
        return jdbc.queryForObject(
                OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_SELECT_ORGANIZATION_NODE_SELECT_COUNT_FROM_ORGANIZATI
                        + filter.where(),
                Long.class,
                filter.values().toArray());
    }

    public List<OrganizationNodeReadback> pageNodes(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String namePattern,
            String codePattern,
            String status,
            String nodeType,
            UUID projectId,
            String sort,
            String direction,
            int pageSize,
            int offset) {
        Filter filter = filter(workspaceUuid, groupWorkspaceKey, namePattern, codePattern, status, nodeType, projectId);
        String order =
                switch (sort) {
                    case "NAME" -> OrganizationHierarchyServiceSql.HIERARCHY_ORDER_NAME;
                    case "CODE" -> OrganizationHierarchyServiceSql.HIERARCHY_ORDER_CODE;
                    default -> OrganizationHierarchyServiceSql.HIERARCHY_ORDER_UPDATED_AT;
                };
        List<Object> values = new ArrayList<>(filter.values());
        values.add(pageSize);
        values.add(offset);
        return jdbc.query(
                OrganizationHierarchyServiceSql.SELECT_WS_UUID_GRP_WS_ALT_A_002
                        + OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_VERSION_ALTERNATE_A
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_ORGANIZATION_NODE_EXTENSION_RULE_REVISION
                        + filter.where()
                        + OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_ORDER_BY
                        + order
                        + OrganizationHierarchyServiceSql.SQL_SPACE
                        + direction
                        + OrganizationHierarchyServiceSql.PAGE_ORDER_SUFFIX,
                (result, row) -> node(result, List.of()),
                values.toArray());
    }

    public int updateProjectPhaseVersion(UUID projectId, long now, long expectedVersion) {
        return jdbc.update(
                OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_UPDATE_ORGANIZATION_NODE_VERSION_UPDATED_AT_EPOCH_MILLIS
                        + OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_VERSION_ALTERNATE_B,
                now,
                projectId,
                expectedVersion);
    }

    public int updateStatus(
            UUID nodeId, UUID workspaceUuid, String groupWorkspaceKey, String status, long now, long expectedVersion) {
        return jdbc.update(
                OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_UPDATE_ORGANIZATION_NODE_STATUS_VERSION
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_WORKSPACE_UUID
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_CONDITION_GROUP_WORKSPACE_KEY_VERSION,
                status,
                now,
                nodeId,
                workspaceUuid,
                groupWorkspaceKey,
                expectedVersion);
    }

    public int updateNode(
            UUID nodeId,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String notes,
            String extensionValues,
            long extensionRuleRevision,
            long now,
            long expectedVersion) {
        return jdbc.update(
                OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_UPDATE_ORGANIZATION_NODE_CODE_NAME_NOTES
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_EXTENSION_VALUES_EXTENSION_RULE_REVISION
                        + OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_VERSION_UPDATED_AT_EPOCH_MILLIS
                        + OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_WORKSPACE_UUID
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_CONDITION_GROUP_WORKSPACE_KEY_VERSION_ALTERNATE_A,
                code,
                name,
                notes,
                extensionValues,
                extensionRuleRevision,
                now,
                nodeId,
                workspaceUuid,
                groupWorkspaceKey,
                expectedVersion);
    }

    public OrganizationNodeReadback findNode(
            UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId, String requiredType) {
        return jdbc.query(
                OrganizationHierarchyServiceSql.SELECT_WS_UUID_GRP_WS_ALT_B_003
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_NOTES_STATUS_VERSION_CREATED_AT_EPOCH_MILLIS
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_EXTENSION_VALUES_TEXT_EXTENSION_RULE_REVISION_ARRAY_AGG
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_ORDER_BY_DISPLAY_ORDER_FILTER_PHASE_NAME_TEXT
                        + OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_PHASE_NAMES
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_ALTERNATIVE_PROJECT_PHASE_NAME_ORGANIZATION_NODE
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_PROJECT_ID_NODE_TYPE_PROJECT_WORKSPACE_UUID
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_GROUP_WORKSPACE_KEY_WORKSPACE_UUID
                        + OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_PARENT_ID
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_NODE_TYPE_CODE_NAME_NOTES_ALTERNATE_B
                        + OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_UPDATED_AT_EPOCH_MILLIS,
                statement -> {
                    statement.setObject(1, nodeId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> {
                    if (!result.next())
                        throw new com.catering.v2s.organization.application.OrganizationHierarchyService
                                .OrganizationNotFoundException();
                    String actualType = result.getString("node_type");
                    if (requiredType != null && !requiredType.equals(actualType))
                        throw new com.catering.v2s.organization.application.OrganizationHierarchyService
                                .OrganizationValidationException();
                    java.sql.Array phaseArray = result.getArray("phase_names");
                    Object[] phaseValues = phaseArray == null ? new Object[0] : (Object[]) phaseArray.getArray();
                    List<String> phases = new ArrayList<>(phaseValues.length);
                    for (Object phase : phaseValues) phases.add((String) phase);
                    return new OrganizationNodeReadback(
                            result.getObject("id", UUID.class),
                            result.getObject("workspace_uuid", UUID.class),
                            result.getString("group_workspace_key"),
                            result.getObject("parent_id", UUID.class),
                            actualType,
                            result.getString("code"),
                            result.getString("name"),
                            result.getString("notes"),
                            result.getString("status"),
                            result.getLong("version"),
                            result.getLong("created_at_epoch_millis"),
                            result.getLong("updated_at_epoch_millis"),
                            phases,
                            ExtensionDefinitionService.readValues(result.getString("extension_values")),
                            result.getLong("extension_rule_revision"));
                });
    }

    public boolean isEnterable(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId) {
        return jdbc.query(
                OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_SELECT_ORGANIZATION_NODE_STATUS_WORKSPACE_UUID
                        + OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setObject(1, nodeId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> result.next() && "ENABLED".equals(result.getString(1)));
    }

    public String describePath(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId) {
        return jdbc.query(
                OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_CTE_ANCESTRY
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_SELECT_ORGANIZATION_NODE_PARENT_ID_CODE_NAME_DEPTH
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_CONDITION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_UNION_UNION_ALL
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_SELECT_PARENT_PARENT_ID_CODE_NAME
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_FROM_CLAUSE_ANCESTRY_PARENT_PARENT_ID
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_WHERE_PARENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_CLOSE_PAREN_ANCESTRY_STRING_AGG_CODE_NAME_DEPTH,
                statement -> {
                    statement.setObject(1, nodeId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                    statement.setObject(4, workspaceUuid);
                    statement.setString(5, groupWorkspaceKey);
                },
                result -> {
                    if (!result.next() || result.getString(1) == null)
                        throw new com.catering.v2s.organization.application.OrganizationHierarchyService
                                .OrganizationNotFoundException();
                    return result.getString(1);
                });
    }

    public Map<UUID, List<String>> readPhaseNames(List<UUID> projectIds) {
        if (projectIds.isEmpty()) return Map.of();
        return jdbc.query(
                OrganizationHierarchyServiceSql.SELECT_PROJECT_PHASE_NAME_PROJECT_ALT_A_004
                        + String.join(
                                OrganizationHierarchyServiceSql.PLACEHOLDER_SEPARATOR,
                                Collections.nCopies(
                                        projectIds.size(), OrganizationHierarchyServiceSql.PARAMETER_PLACEHOLDER))
                        + OrganizationHierarchyServiceSql.PROJECT_PHASE_ORDER_SUFFIX,
                statement -> {
                    for (int index = 0; index < projectIds.size(); index++)
                        statement.setObject(index + 1, projectIds.get(index));
                },
                result -> {
                    Map<UUID, List<String>> values = new LinkedHashMap<>();
                    while (result.next())
                        values.computeIfAbsent(result.getObject(1, UUID.class), ignored -> new ArrayList<>())
                                .add(result.getString(2));
                    return Map.copyOf(values);
                });
    }

    public Map<UUID, List<HierarchyPathNode>> readPaths(
            UUID workspaceUuid, String groupWorkspaceKey, List<UUID> nodeIds) {
        if (nodeIds.isEmpty()) return Map.of();
        String sql = OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_CTE_ANCESTRY_ALTERNATE_A
                + OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_SELECT_NODE_TARGET_ID_PARENT_ID_CODE
                + OrganizationHierarchyServiceSql.ALT_ORG_NODE_WS_UUID_005
                + OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_CONDITION_NODE
                + String.join(
                        OrganizationHierarchyServiceSql.PLACEHOLDER_SEPARATOR,
                        Collections.nCopies(nodeIds.size(), OrganizationHierarchyServiceSql.PARAMETER_PLACEHOLDER))
                + OrganizationHierarchyServiceSql.PATH_CTE_CLOSE_SUFFIX
                + OrganizationHierarchyServiceSql.PATH_PARENT_SELECT
                + OrganizationHierarchyServiceSql.PATH_PARENT_FROM
                + OrganizationHierarchyServiceSql.PATH_PARENT_WHERE
                + OrganizationHierarchyServiceSql.PATH_SELECT_PROJECTION
                + OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_PATH_SELECT_PROJECTION_GROUP_BY
                + OrganizationHierarchyServiceSql.PATH_TARGET_ID_COLUMN;
        return jdbc.query(
                sql,
                statement -> {
                    int index = 1;
                    statement.setObject(index++, workspaceUuid);
                    statement.setString(index++, groupWorkspaceKey);
                    for (UUID nodeId : nodeIds) statement.setObject(index++, nodeId);
                    statement.setObject(index++, workspaceUuid);
                    statement.setString(index, groupWorkspaceKey);
                },
                result -> {
                    Map<UUID, List<HierarchyPathNode>> values = new LinkedHashMap<>();
                    while (result.next()) {
                        Object[] ids = (Object[]) result.getArray("path_ids").getArray();
                        Object[] codes =
                                (Object[]) result.getArray("path_codes").getArray();
                        Object[] names =
                                (Object[]) result.getArray("path_names").getArray();
                        List<HierarchyPathNode> path = new ArrayList<>();
                        for (int index = 0; index < ids.length; index++)
                            path.add(new HierarchyPathNode(
                                    (UUID) ids[index], (String) codes[index], (String) names[index]));
                        values.put(result.getObject("target_id", UUID.class), List.copyOf(path));
                    }
                    return Map.copyOf(values);
                });
    }

    public int insertAudit(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID nodeId,
            String action,
            long occurredAt,
            AuditActor actor,
            String changesJson) {
        return auditEvents.write(
                UUID.randomUUID(),
                workspaceUuid,
                groupWorkspaceKey,
                "ORGANIZATION_NODE",
                nodeId.toString(),
                actor,
                action,
                occurredAt,
                changesJson);
    }

    public int deletePhases(UUID projectId) {
        return jdbc.update(
                OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_DELETE_PROJECT_PHASE_NAME_PROJECT_ID,
                projectId);
    }

    public int[] insertPhases(UUID projectId, List<String> phases) {
        if (phases.isEmpty()) return new int[0];
        return jdbc.batchUpdate(
                OrganizationHierarchyServiceSql.INSERT_INTO_PROJECT_PHASE_NAME_006, new BatchPreparedStatementSetter() {
                    @Override
                    public void setValues(java.sql.PreparedStatement statement, int index) throws SQLException {
                        statement.setObject(1, projectId);
                        statement.setString(2, phases.get(index));
                        statement.setInt(3, index);
                    }

                    @Override
                    public int getBatchSize() {
                        return phases.size();
                    }
                });
    }

    private static OrganizationNodeReadback node(ResultSet result, List<String> phases) throws SQLException {
        return new OrganizationNodeReadback(
                result.getObject(1, UUID.class),
                result.getObject(2, UUID.class),
                result.getString(3),
                result.getObject(4, UUID.class),
                result.getString(5),
                result.getString(6),
                result.getString(7),
                result.getString(8),
                result.getString(9),
                result.getLong(10),
                result.getLong(11),
                result.getLong(12),
                phases,
                ExtensionDefinitionService.readValues(result.getString(13)),
                result.getLong(14));
    }

    private static OrganizationNodeReadback withPhases(OrganizationNodeReadback node, List<String> phases) {
        return new OrganizationNodeReadback(
                node.id(),
                node.workspaceUuid(),
                node.groupWorkspaceKey(),
                node.parentId(),
                node.nodeType(),
                node.code(),
                node.name(),
                node.notes(),
                node.status(),
                node.version(),
                node.createdAtEpochMillis(),
                node.updatedAtEpochMillis(),
                phases,
                node.extensionValues(),
                node.extensionRuleRevision());
    }

    private static Filter filter(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String namePattern,
            String codePattern,
            String status,
            String nodeType,
            UUID projectId) {
        String where =
                OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_CONDITION_TEXT_NAME_ILIKE_ESCAPE
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_CONDITION_TEXT_CODE_ILIKE_ESCAPE
                        + OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_CONDITION_TEXT_STATUS
                        + OrganizationHierarchyServiceSql.ORGANIZATION_HIERARCHY_SERVICE_CONDITION_TEXT_NODE_TYPE
                        + OrganizationHierarchyServiceSql
                                .ORGANIZATION_HIERARCHY_SERVICE_CONDITION_AND_UUID_IS_NULL_OR_ID;
        List<Object> values = new ArrayList<>();
        Collections.addAll(
                values,
                workspaceUuid,
                groupWorkspaceKey,
                namePattern,
                namePattern,
                codePattern,
                codePattern,
                status,
                status,
                nodeType,
                nodeType,
                projectId,
                projectId);
        return new Filter(where, values);
    }

    private record Filter(String where, List<Object> values) {}
}
