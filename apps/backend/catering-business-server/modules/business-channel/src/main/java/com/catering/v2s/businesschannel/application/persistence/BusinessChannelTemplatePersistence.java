package com.catering.v2s.businesschannel.application.persistence;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC execution boundary for business-channel template facts and template-owned writes. */
@Repository
public class BusinessChannelTemplatePersistence {
    public static final int BOUNDED_READ_LIMIT = BusinessChannelQuerySupport.BOUNDED_READ_LIMIT;
    private final JdbcTemplate jdbc;

    public BusinessChannelTemplatePersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record TemplateProjection(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID templateRef,
            UUID projectRef,
            String templateName,
            String templateCode,
            String accessKind,
            String operatorKind,
            String orderKind,
            String dineInForm,
            String providerCode,
            String urlRule,
            String storeVisibilityScope,
            String status,
            String projectStatus,
            long visibleStoreCount,
            long version) {}

    public record TemplateUpdateProjection(TemplateProjection projection, List<UUID> visibleStoreRefs) {}

    public record TemplateCommandProjection(
            UUID projectRef,
            String accessKind,
            String operatorKind,
            String orderKind,
            String dineInForm,
            String providerCode,
            String storeVisibilityScope,
            String status,
            boolean channelCodeInUse) {}

    public record VisibleStoreTemplate(UUID projectRef, String operatorKind) {}

    public record TemplatePageQuery(List<TemplateProjection> rows, long total) {}

    public record VisibleStorePageQuery(List<BusinessChannelReadback.VisibleStore> rows, long total) {}

    public TemplatePageQuery pageTemplates(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectRef,
            String status,
            String operatorKind,
            String sortKey,
            String sortDirection,
            int limit) {
        List<Object> arguments = new ArrayList<>(List.of(workspaceUuid, groupWorkspaceKey));
        StringBuilder predicate = new StringBuilder(
                BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY);
        if (projectRef != null) {
            predicate.append(BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_CONDITION_PROJECT_REF);
            arguments.add(projectRef);
        }
        if (status != null) {
            predicate.append(BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_CONDITION_STATUS);
            arguments.add(status);
        }
        if (operatorKind != null) {
            predicate.append(
                    BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_CONDITION_OPERATOR_KIND);
            arguments.add(operatorKind);
        }
        List<TemplateProjection> rows = query(
                templateSelect(predicate
                        + BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_ORDER_BY
                        + templateOrderBy(sortKey, sortDirection)
                        + BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_LIMIT),
                append(arguments, limit + 1));
        return new TemplatePageQuery(rows, rows.size());
    }

    public TemplatePageQuery pageStoreTemplateCandidates(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectRef,
            UUID storeRef,
            UUID cursorTieBreaker,
            String cursorSortValue,
            String sortKey,
            String sortDirection,
            int limit) {
        List<Object> arguments = new ArrayList<>(List.of(workspaceUuid, groupWorkspaceKey, projectRef, storeRef));
        StringBuilder predicate = new StringBuilder(
                BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_PROJECT_REF
                        + BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_CONDITION_OPERATOR_KIND_STORE_STATUS_ENABLED
                        + BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_STORE_VISIBILITY_SCOPE_ALL_PROJECT_STORES
                        + BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_STORE_VISIBILITY_SCOPE_SELECTED_PROJECT_STORES
                        + BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_SELECT_BUSINESS_CHANNEL_TEMPLATE_STORE_VI
                        + BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_WHERE_TEMPLATE_REF_STORE_REF);
        String countPredicate = predicate.toString();
        List<Object> countArguments = List.copyOf(arguments);
        if (cursorTieBreaker != null) {
            if (sortKey == null) {
                predicate.append(
                        BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_CONDITION_TEMPLATE_REF);
                arguments.add(cursorTieBreaker);
            } else {
                String expression = templateSortExpression(sortKey);
                String comparison = BusinessChannelTemplateServiceSql.SORT_DIRECTION_DESC.equals(sortDirection)
                        ? BusinessChannelTemplateServiceSql.CURSOR_LESS_OPERATOR
                        : BusinessChannelTemplateServiceSql.CURSOR_GREATER_OPERATOR;
                predicate
                        .append(BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_CONDITION)
                        .append(expression)
                        .append(' ')
                        .append(comparison)
                        .append(
                                BusinessChannelTemplateServiceSql
                                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_PARAMETER_PLACEHOLDER)
                        .append(expression)
                        .append(BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_TEMPLATE_REF);
                arguments.add(cursorSortValue);
                arguments.add(cursorSortValue);
                arguments.add(cursorTieBreaker);
            }
        }
        long total = count(
                BusinessChannelTemplateServiceSql.SELECT_BIZ_CHANNEL_TEMPLATE_SELECT_001 + countPredicate,
                countArguments);
        List<TemplateProjection> rows = query(
                templateSelect(predicate
                        + BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_ORDER_BY_ALTERNATE_A
                        + templateOrderBy(sortKey, sortDirection)
                        + BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_LIMIT_ALTERNATE_A),
                append(arguments, limit + 1));
        return new TemplatePageQuery(rows, total);
    }

    public VisibleStorePageQuery pageVisibleStores(
            UUID templateRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectRef,
            String storeStatusFilter,
            String cursorSortValue,
            UUID cursorTieBreaker,
            int limit) {
        List<Object> arguments = new ArrayList<>(List.of(templateRef, workspaceUuid, groupWorkspaceKey, projectRef));
        StringBuilder predicate = new StringBuilder(
                BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_WHERE_TEMPLATE_REF_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_CONDITION_PROJECT_REF_OPERATOR_KIND_STORE
                        + BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_CONDITION_STORE_REF_WORKSPACE_UUID
                        + BusinessChannelTemplateServiceSql.CONDITION_GRP_WS_KEY_PROJECT_002);
        if ("NON_VOIDED".equals(storeStatusFilter))
            predicate.append(
                    BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_CONDITION_STATUS_VOIDED);
        String countPredicate = predicate.toString();
        List<Object> countArguments = List.copyOf(arguments);
        if (cursorTieBreaker != null) {
            predicate.append(BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_CONDITION_CODE
                    + BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_CONDITION_STORE_REF);
            arguments.add(cursorSortValue);
            arguments.add(cursorSortValue);
            arguments.add(cursorTieBreaker);
        }
        String from =
                BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_FROM_CLAUSE_BUSINESS_CHANNEL_TEMPLATE_STORE_VI
                        + BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_JOIN_BUSINESS_CHANNEL_TEMPLATE_TEMPLATE_REF
                        + BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_JOIN_STORE_STORE_REF;
        long total = count(
                BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_SELECT_SELECT_COUNT
                        + from
                        + countPredicate,
                countArguments);
        List<BusinessChannelReadback.VisibleStore> rows = jdbc.query(
                BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_SELECT_STORE_REF_CODE_STORE_CODE_NAME
                        + from
                        + predicate
                        + BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_ORDER_BY_CODE_STORE_REF,
                statement -> bind(statement, append(arguments, limit + 1)),
                (result, rowNumber) -> new BusinessChannelReadback.VisibleStore(
                        result.getObject("store_ref", UUID.class),
                        result.getString("store_code"),
                        result.getString("store_name"),
                        result.getString("store_status")));
        return new VisibleStorePageQuery(rows, total);
    }

    public Optional<BusinessChannelReadback.TemplateCommandContext> readTemplateCommandContext(
            UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef) {
        return jdbc.query(
                BusinessChannelTemplateServiceSql.SELECT_BIZ_CHANNEL_TEMPLATE_REF_003
                        + BusinessChannelTemplateServiceSql.WHERE_WS_UUID_GRP_WS_004,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, templateRef);
                },
                result -> result.next()
                        ? Optional.of(new BusinessChannelReadback.TemplateCommandContext(
                                result.getObject("template_ref", UUID.class),
                                result.getObject("project_ref", UUID.class)))
                        : Optional.empty());
    }

    public Optional<TemplateCommandProjection> readTemplateCommandProjection(
            UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef, String channelCode) {
        return jdbc.query(
                BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_SELECT_TEMPLATE_PROJECT_REF_ACCESS_KIND_OPERATOR_KIND
                        + BusinessChannelServiceSql
                                .BUSINESS_CHANNEL_SERVICE_TEMPLATE_DINE_IN_FORM_PROVIDER_CODE_STORE_VISIBILITY_SCOPE
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_TEMPLATE_STATUS
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_FROM_CLAUSE_BUSINESS_CHANNEL_CHANNEL
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_WHERE_CHANNEL_WORKSPACE_UUID_TEMPLATE
                        + BusinessChannelServiceSql
                                .BUSINESS_CHANNEL_SERVICE_CONDITION_CHANNEL_GROUP_WORKSPACE_KEY_TEMPLATE
                        + BusinessChannelServiceSql
                                .BUSINESS_CHANNEL_SERVICE_CONDITION_CHANNEL_CHANNEL_CODE_STATUS_VOIDED
                        + BusinessChannelServiceSql
                                .BUSINESS_CHANNEL_SERVICE_FROM_CLAUSE_BUSINESS_CHANNEL_TEMPLATE_TEMPLATE
                        + BusinessChannelServiceSql
                                .BUSINESS_CHANNEL_SERVICE_WHERE_TEMPLATE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_CONDITION_TEMPLATE_TEMPLATE_REF,
                statement -> {
                    statement.setString(1, channelCode);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                    statement.setObject(4, templateRef);
                },
                result -> result.next()
                        ? Optional.of(new TemplateCommandProjection(
                                result.getObject("project_ref", UUID.class),
                                result.getString("access_kind"),
                                result.getString("operator_kind"),
                                result.getString("order_kind"),
                                result.getString("dine_in_form"),
                                result.getString("provider_code"),
                                result.getString("store_visibility_scope"),
                                result.getString("status"),
                                result.getBoolean("channel_code_in_use")))
                        : Optional.empty());
    }

    public void insertTemplate(
            UUID templateRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectRef,
            String templateName,
            String templateCode,
            String accessKind,
            String operatorKind,
            String orderKind,
            String dineInForm,
            String providerCode,
            String urlRule,
            String storeVisibilityScope,
            long now) {
        try {
            jdbc.update(
                    BusinessChannelTemplateServiceSql.INSERT_INTO_BIZ_CHANNEL_TEMPLATE_005
                            + BusinessChannelTemplateServiceSql.TEMPLATE_REF_WS_UUID_GRP_018
                            + BusinessChannelTemplateServiceSql
                                    .BUSINESS_CHANNEL_TEMPLATE_SERVICE_ACCESS_KIND_OPERATOR_KIND_ORDER_KIND_DINE_IN_FORM
                            + BusinessChannelTemplateServiceSql
                                    .BUSINESS_CHANNEL_TEMPLATE_SERVICE_STORE_VISIBILITY_SCOPE_STATUS
                            + BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_VERSION
                            + BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_VALUES_ENABLED,
                    templateRef,
                    workspaceUuid,
                    groupWorkspaceKey,
                    projectRef,
                    templateName,
                    templateCode,
                    accessKind,
                    operatorKind,
                    orderKind,
                    dineInForm,
                    providerCode,
                    urlRule,
                    storeVisibilityScope,
                    now,
                    now);
        } catch (DuplicateKeyException failure) {
            throw failure;
        }
    }

    public int transitionTemplate(
            UUID templateRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetStatus,
            long now,
            long expectedVersion) {
        return jdbc.update(
                BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_UPDATE_BUSINESS_CHANNEL_TEMPLATE_STATUS
                        + BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_VERSION_UPDATED_AT_EPOCH_MILLIS_TEMPLATE_REF
                        + BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_CONDITION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_VERSION,
                targetStatus,
                now,
                templateRef,
                workspaceUuid,
                groupWorkspaceKey,
                expectedVersion);
    }

    public Optional<TemplateProjection> readTemplate(
            UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef, boolean forUpdate) {
        if (forUpdate) {
            return jdbc.query(
                    templateSelect(BusinessChannelTemplateServiceSql.WHERE_WS_UUID_GRP_WS_ALT_B_007),
                    statement -> {
                        statement.setObject(1, workspaceUuid);
                        statement.setString(2, groupWorkspaceKey);
                        statement.setObject(3, templateRef);
                    },
                    result -> result.next() ? Optional.of(mapTemplateProjection(result)) : Optional.empty());
        }
        return query(
                        templateSelect(
                                forUpdate
                                        ? BusinessChannelTemplateServiceSql.WHERE_WS_UUID_GRP_WS_ALT_B_007
                                        : BusinessChannelTemplateServiceSql.WHERE_WS_UUID_GRP_WS_ALT_A_006),
                        List.of(workspaceUuid, groupWorkspaceKey, templateRef))
                .stream()
                .findFirst();
    }

    public Optional<TemplateUpdateProjection> readTemplateForUpdate(
            UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef) {
        return jdbc.query(
                templateSelectForUpdate(BusinessChannelTemplateServiceSql.WHERE_WS_UUID_GRP_WS_ALT_C_008),
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, templateRef);
                },
                result -> result.next()
                        ? Optional.of(new TemplateUpdateProjection(
                                mapTemplateProjection(result), uuidList(result, "visible_store_refs")))
                        : Optional.empty());
    }

    public Optional<VisibleStoreTemplate> verifyVisibleStoreTemplate(
            UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef) {
        return jdbc.query(
                BusinessChannelTemplateServiceSql.SELECT_BIZ_CHANNEL_TEMPLATE_PROJECT_013
                        + BusinessChannelTemplateServiceSql.WHERE_WS_UUID_GRP_WS_ALT_D_014,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, templateRef);
                },
                result -> result.next()
                        ? Optional.of(new VisibleStoreTemplate(
                                result.getObject("project_ref", UUID.class), result.getString("operator_kind")))
                        : Optional.empty());
    }

    public boolean visibleStoreRelationExists(UUID templateRef, UUID storeRef) {
        return count(
                        BusinessChannelTemplateServiceSql.SELECT_BIZ_CHANNEL_TEMPLATE_STORE_ALT_A_015
                                + BusinessChannelTemplateServiceSql
                                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_WHERE_TEMPLATE_REF_STORE_REF_ALTERNATE_A,
                        List.of(templateRef, storeRef))
                > 0;
    }

    public Optional<TemplateProjection> updateTemplateAndVisibleStoreRelations(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID templateRef,
            String templateName,
            String storeVisibilityScope,
            String urlRule,
            long expectedVersion,
            List<UUID> visibleStoreRefs,
            long now) {
        String relationRows = visibleStoreRefs.isEmpty()
                ? BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_SELECT_STORE_REF
                : BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_SELECT_REFS_STORE_REF
                        + visibleStoreRefs.stream()
                                .map(ignored -> BusinessChannelTemplateServiceSql.VISIBLE_STORE_REF_VALUE)
                                .collect(Collectors.joining(BusinessChannelTemplateServiceSql.VALUE_SEPARATOR))
                        + BusinessChannelTemplateServiceSql.VISIBLE_STORE_REF_ROWS_SUFFIX;
        String sql = BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_CTE_DELETED
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_DELETE_BUSINESS_CHANNEL_TEMPLATE_STORE_VI
                + BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_WHERE_TEMPLATE_REF
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_DELETED_TARGET_TEMPLATE_TEMPLATE_REF
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_INSERT_BUSINESS_CHANNEL_TEMPLATE_STORE_VI_INSERTED
                + BusinessChannelTemplateServiceSql.OPEN_PAREN_TEMPLATE_REF_STORE_016
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_FROM_CLAUSE_TARGET_TEMPLATE_FROM_TARGET_TEMPLATE_CROSS_J
                + relationRows
                + BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_CLOSE_PAREN_RELATION_ROWS
                + BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_RETURNING_TEMPLATE_REF_STORE_REF
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_UPDATE_BUSINESS_CHANNEL_TEMPLATE_UPDATED_TEMPLATE_NAME
                + BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_STORE_VISIBILITY_SCOPE
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_FROM_CLAUSE_INSERTED_INSERTED_COUNT_RELATION_WRITE
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_WHERE_TEMPLATE_REF_TARGET_TEMPLATE_WORKSPACE_UUID
                + BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_CONDITION_GROUP_WORKSPACE_KEY
                + BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_RETURNING_RETURNING_T
                + BusinessChannelTemplateServiceSql.SELECT_UPDATED_WS_UUID_GRP_017
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_UPDATE_UPDATED_PROJECT_REF_TEMPLATE_NAME_TEMPLATE_CODE
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_UPDATE_UPDATED_OPERATOR_KIND_ORDER_KIND_DINE_IN_FORM
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_UPDATE_INSERTED_UPDATED_STORE_VISIBILITY_SCOPE_STATUS_VERSION
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_JOIN_STORE_VISIBLE_STORE_INSERTED_STORE_REF
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_CONDITION_VISIBLE_STORE_WORKSPACE_UUID_UPDATED
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_CONDITION_VISIBLE_STORE_GROUP_WORKSPACE_KEY_UPDATED
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_CONDITION_VISIBLE_STORE_PROJECT_ID_UPDATED_PROJECT_REF
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_WHERE_INSERTED_TEMPLATE_REF_UPDATED_VISIBLE_STORE
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_ORGANIZATION_NODE_VISIBLE_STORE_COUNT_PROJECT_STATUS
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_WHERE_PROJECT_UPDATED_PROJECT_REF_WORKSPACE_UUID
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_CONDITION_PROJECT_GROUP_WORKSPACE_KEY_UPDATED_PROJECT_STATUS
                + BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_FROM_CLAUSE_UPDATED_FROM_UPDATED;
        List<Object> arguments = new ArrayList<>();
        arguments.add(templateRef);
        arguments.add(templateRef);
        arguments.addAll(visibleStoreRefs);
        arguments.add(templateName);
        arguments.add(urlRule);
        arguments.add(storeVisibilityScope);
        arguments.add(now);
        arguments.add(workspaceUuid);
        arguments.add(groupWorkspaceKey);
        arguments.add(expectedVersion);
        return jdbc.query(
                sql,
                statement -> bind(statement, arguments),
                result -> result.next() ? Optional.of(mapTemplateProjection(result)) : Optional.empty());
    }

    public void insertVisibleStoreRelations(UUID templateRef, List<UUID> visibleStoreRefs) {
        if (visibleStoreRefs.isEmpty()) return;
        jdbc.batchUpdate(
                BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_INSERT_INTO_BUSINESS_CHANNEL_TEMPLATE_STORE_VI
                        + BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_OPEN_PAREN_TEMPLATE_REF_STORE_REF,
                visibleStoreRefs.stream()
                        .map(storeRef -> new Object[] {templateRef, storeRef})
                        .toList());
    }

    public Map<UUID, List<BusinessChannelReadback.StatusDimension>> readOrganizationAncestors(
            UUID workspaceUuid, String groupWorkspaceKey, Set<UUID> nodeRefs) {
        if (workspaceUuid == null || groupWorkspaceKey == null || nodeRefs == null || nodeRefs.isEmpty()) {
            return Map.of();
        }
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(nodeRefs));
        String placeholders = refs.stream()
                .map(ignored -> BusinessChannelTemplateServiceSql.PARAMETER_PLACEHOLDER)
                .collect(Collectors.joining(BusinessChannelTemplateServiceSql.VALUE_SEPARATOR));
        List<Object> arguments = new ArrayList<>(refs);
        arguments.add(workspaceUuid);
        arguments.add(groupWorkspaceKey);
        arguments.add(workspaceUuid);
        arguments.add(groupWorkspaceKey);
        Map<UUID, List<BusinessChannelReadback.StatusDimension>> ancestors = new LinkedHashMap<>();
        jdbc.query(
                BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_CTE_ANCESTRY
                        + BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_SELECT_SOURCE_REF_PARENT_ID_NODE_TYPE_STATUS
                        + BusinessChannelTemplateServiceSql.FROM_CLAUSE_ORG_NODE_FROM_012
                        + BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_WHERE_WHERE_ID_IN
                        + placeholders
                        + BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_CLOSE_PAREN_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_UNION_CHILD_SOURCE_REF_PARENT_PARENT_ID
                        + BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_PARENT_NODE_TYPE_STATUS_CHILD
                        + BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_FROM_CLAUSE_ANCESTRY_PARENT_CHILD_PARENT_ID
                        + BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_WHERE_PARENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_SELECT_ANCESTRY_SOURCE_REF_NODE_TYPE_STATUS_DEPTH,
                statement -> bind(statement, arguments),
                result -> {
                    while (result.next()) {
                        UUID sourceRef = result.getObject("source_ref", UUID.class);
                        ancestors
                                .computeIfAbsent(sourceRef, ignored -> new ArrayList<>())
                                .add(new BusinessChannelReadback.StatusDimension(
                                        "ORGANIZATION_" + result.getString("node_type"),
                                        result.getObject("id", UUID.class).toString(),
                                        result.getString("status")));
                    }
                    return null;
                });
        return ancestors;
    }

    public void recordAudit(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String entityRef,
            String action,
            AuditActor actor,
            String entityType,
            String changesJson,
            long occurredAtEpochMillis) {
        jdbc.update(
                BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_INSERT_INTO_AUDIT_EVENT
                        + BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_ACTOR_TYPE
                        + BusinessChannelTemplateServiceSql
                                .BUSINESS_CHANNEL_TEMPLATE_SERVICE_CHANGES_JSON_OCCURRED_AT_EPOCH_MILLIS,
                UUID.randomUUID(),
                workspaceUuid,
                groupWorkspaceKey,
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                entityType,
                entityRef,
                action,
                changesJson,
                occurredAtEpochMillis);
    }

    private List<TemplateProjection> query(String sql, List<Object> arguments) {
        return jdbc.query(
                sql, statement -> bind(statement, arguments), (result, rowNumber) -> mapTemplateProjection(result));
    }

    private static TemplateProjection mapTemplateProjection(ResultSet result, int rowNumber) throws SQLException {
        return mapTemplateProjection(result);
    }

    private static TemplateProjection mapTemplateProjection(ResultSet result) throws SQLException {
        return new TemplateProjection(
                result.getObject("workspace_uuid", UUID.class),
                result.getString("group_workspace_key"),
                result.getObject("template_ref", UUID.class),
                result.getObject("project_ref", UUID.class),
                result.getString("template_name"),
                result.getString("template_code"),
                result.getString("access_kind"),
                result.getString("operator_kind"),
                result.getString("order_kind"),
                result.getString("dine_in_form"),
                result.getString("provider_code"),
                result.getString("url_rule"),
                result.getString("store_visibility_scope"),
                result.getString("status"),
                result.getString("project_status"),
                result.getLong("visible_store_count"),
                result.getLong("version"));
    }

    private static List<UUID> uuidList(ResultSet result, String column) throws SQLException {
        java.sql.Array array = result.getArray(column);
        if (array == null) return List.of();
        Object[] values = (Object[]) array.getArray();
        List<UUID> refs = new ArrayList<>(values.length);
        for (Object value : values) refs.add(value instanceof UUID ? (UUID) value : UUID.fromString(value.toString()));
        return List.copyOf(refs);
    }

    private static String templateSelect(String suffix) {
        return templateSelect(suffix, false);
    }

    private static String templateSelectForUpdate(String suffix) {
        return templateSelect(suffix, true);
    }

    private static String templateSelect(String suffix, boolean includeVisibleStoreRefs) {
        return BusinessChannelTemplateServiceSql.SELECT_WS_UUID_GRP_WS_009
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_TEMPLATE_CODE_ACCESS_KIND_OPERATOR_KIND_ORDER_KIND
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_STORE_VISIBILITY_SCOPE_STATUS_VERSION
                + BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_BUSINESS_CHANNEL_TEMPLATE_STORE_VI
                + BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_JOIN_STORE_VISIBLE_STORE_STORE_REF
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_CONDITION_VISIBLE_STORE_WORKSPACE_UUID
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_CONDITION_VISIBLE_STORE_GROUP_WORKSPACE_KEY
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_CONDITION_VISIBLE_STORE_PROJECT_ID_PROJECT_REF
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_WHERE_TEMPLATE_REF_VISIBLE_STORE_STATUS_VOIDED
                + (includeVisibleStoreRefs
                        ? BusinessChannelTemplateServiceSql.BUSINESS_CHANNEL_TEMPLATE_SERVICE_ARRAY_AGG_STORE_REF
                                + BusinessChannelTemplateServiceSql.BIZ_CHANNEL_TEMPLATE_STORE_VI_ALT_A_010
                                + BusinessChannelTemplateServiceSql
                                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_WHERE_TEMPLATE_REF_VISIBLE_STORE_REFS
                        : "")
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_OPEN_PAREN_ORGANIZATION_NODE_PROJECT_STATUS
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_WHERE_PROJECT_PROJECT_REF_WORKSPACE_UUID
                + BusinessChannelTemplateServiceSql
                        .BUSINESS_CHANNEL_TEMPLATE_SERVICE_CONDITION_PROJECT_GROUP_WORKSPACE_KEY_PROJECT_STATUS
                + BusinessChannelTemplateServiceSql.FROM_CLAUSE_BIZ_CHANNEL_TEMPLATE_011
                + suffix;
    }

    private long count(String sql, List<Object> arguments) {
        return jdbc.query(
                sql, statement -> bind(statement, arguments), result -> result.next() ? result.getLong(1) : 0L);
    }

    private static void bind(PreparedStatement statement, List<Object> arguments) throws SQLException {
        for (int index = 0; index < arguments.size(); index++) statement.setObject(index + 1, arguments.get(index));
    }

    private static List<Object> append(List<Object> values, Object value) {
        List<Object> result = new ArrayList<>(values);
        result.add(value);
        return result;
    }

    private static String templateOrderBy(String sortKey, String sortDirection) {
        if (sortKey == null) return BusinessChannelTemplateServiceSql.TEMPLATE_REF_SORT_EXPRESSION;
        return templateSortExpression(sortKey)
                + BusinessChannelTemplateServiceSql.SORT_SEPARATOR
                + direction(sortDirection)
                + BusinessChannelTemplateServiceSql.TEMPLATE_REF_ORDER_SUFFIX;
    }

    private static String templateSortExpression(String sortKey) {
        return switch (sortKey) {
            case "TEMPLATE_NAME" -> BusinessChannelTemplateServiceSql.TEMPLATE_NAME_SORT_EXPRESSION;
            case "TEMPLATE_CODE" -> BusinessChannelTemplateServiceSql.TEMPLATE_CODE_SORT_EXPRESSION;
            case "ACCESS_KIND" -> BusinessChannelTemplateServiceSql.ACCESS_KIND_SORT_EXPRESSION;
            case "OPERATOR_KIND" -> BusinessChannelTemplateServiceSql.OPERATOR_KIND_SORT_EXPRESSION;
            case "ORDER_KIND" -> BusinessChannelTemplateServiceSql.ORDER_KIND_SORT_EXPRESSION;
            case "STATUS" -> BusinessChannelTemplateServiceSql.STATUS_SORT_EXPRESSION;
            default -> throw new BusinessChannelCommandApi.Problem("VALIDATION_ERROR", 422, "sortKey is not supported");
        };
    }

    private static String direction(String sortDirection) {
        return BusinessChannelTemplateServiceSql.SORT_DIRECTION_DESC.equals(sortDirection)
                ? BusinessChannelTemplateServiceSql.SORT_DIRECTION_DESC
                : BusinessChannelTemplateServiceSql.SORT_DIRECTION_ASC;
    }
}
