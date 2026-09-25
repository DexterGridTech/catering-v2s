package com.catering.v2s.organization.application.persistence;

import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditEntityTypes;
import com.catering.v2s.audit.contract.AuditHistoryItem;
import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditHistoryResultSetReader;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.organization.api.OrganizationVisibilityLookup.VisibleOrganizationFacts;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import java.sql.Array;
import java.sql.SQLException;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed persistence boundary for organization audit history and authorized projections. */
@Repository
public class OrganizationAuditHistoryPersistence {
    private static final Set<String> TYPES = Set.of(
            "ORGANIZATION_NODE",
            "BRAND",
            "TENANT",
            AuditEntityTypes.HEAD_COMPANY,
            AuditEntityTypes.STORE,
            AuditEntityTypes.STORE_SERVICE_POINT_AREA,
            AuditEntityTypes.STORE_SERVICE_POINT,
            AuditEntityTypes.STORE_QR_CONFIGURATION);
    private final JdbcTemplate jdbc;

    public OrganizationAuditHistoryPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public AuditHistoryPage read(AuditReadScope scope, AuditTarget target, long page, long pageSize) {
        if (!TYPES.contains(target.entityType()) || page < 1 || pageSize < 1 || pageSize > 100)
            throw new IllegalArgumentException("unsupported organization audit target");
        String table = tableFor(target.entityType());
        Boolean exists = jdbc.query(
                OrganizationAuditHistoryServiceSql
                                .ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_ORGANIZATION_SELECT_EXISTS_SELECT_1_FROM_
                        + table
                        + OrganizationAuditHistoryServiceSql
                                .ORGANIZATION_AUDIT_HISTORY_SERVICE_WHERE_TEXT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setString(1, target.entityRef());
                    statement.setObject(2, scope.workspaceUuid());
                    statement.setString(3, scope.groupWorkspaceKey());
                },
                result -> result.next() && result.getBoolean(1));
        if (!Boolean.TRUE.equals(exists))
            throw new com.catering.v2s.organization.application.BusinessEntityService.OrganizationNotFoundException();
        long total = jdbc.queryForObject(
                OrganizationAuditHistoryServiceSql
                                .ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_AUDIT_EVENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + OrganizationAuditHistoryServiceSql
                                .ORGANIZATION_AUDIT_HISTORY_SERVICE_ENTITY_TYPE_ENTITY_REF_TEXT,
                Long.class,
                scope.workspaceUuid(),
                scope.groupWorkspaceKey(),
                target.entityType(),
                target.entityRef());
        List<AuditHistoryItem> items = jdbc.query(
                OrganizationAuditHistoryServiceSql.ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_OCCURRED_AT_EPOCH_MILLIS
                        + OrganizationAuditHistoryServiceSql
                                .ORGANIZATION_AUDIT_HISTORY_SERVICE_AUDIT_EVENT_CHANGES_JSON_TEXT_WORKSPACE_UUID
                        + OrganizationAuditHistoryServiceSql
                                .ORGANIZATION_AUDIT_HISTORY_SERVICE_GROUP_WORKSPACE_KEY_ENTITY_TYPE_ENTITY_REF_TEXT
                        + OrganizationAuditHistoryServiceSql.ORGANIZATION_AUDIT_HISTORY_SERVICE_OCCURRED_AT_EPOCH_MILLIS
                        + OrganizationAuditHistoryServiceSql
                                .ORGANIZATION_AUDIT_HISTORY_SERVICE_DESC_DIRECTION_DESC_ID_DESC_LIMIT_OFFSET,
                (result, ignored) -> item(result),
                scope.workspaceUuid(),
                scope.groupWorkspaceKey(),
                target.entityType(),
                target.entityRef(),
                pageSize,
                (page - 1) * pageSize);
        return new AuditHistoryPage(items, page, pageSize, total);
    }

    public AuditHistoryPage readInitializationForGroupWorkspace(
            AuditReadScope scope, String entityRef, long page, long pageSize) {
        if (page < 1 || pageSize < 1 || pageSize > 100)
            throw new IllegalArgumentException("unsupported organization audit page");
        long offset = Math.multiplyExact(page - 1, pageSize);
        AuditHistoryResultSetReader.ItemsProjection value = jdbc.query(
                OrganizationAuditHistoryServiceSql.ORGANIZATION_AUDIT_HISTORY_SERVICE_CTE_LATERAL,
                statement -> {
                    statement.setObject(1, scope.workspaceUuid());
                    statement.setString(2, scope.groupWorkspaceKey());
                    statement.setString(3, entityRef);
                    statement.setLong(4, pageSize);
                    statement.setLong(5, offset);
                },
                AuditHistoryResultSetReader::readItems);
        return new AuditHistoryPage(value.items(), page, pageSize, value.total());
    }

    public AuditHistoryPage readCommercialGroup(AuditReadScope scope, AuditTarget target, long page, long pageSize) {
        if (!"COMMERCIAL_GROUP".equals(target.entityType()) || page < 1 || pageSize < 1 || pageSize > 100)
            throw new IllegalArgumentException("unsupported commercial-group audit target");
        List<Long> groupWorkspaceIds = jdbc.query(
                OrganizationAuditHistoryServiceSql
                                .ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_COMMERCIAL_GROUP_GROUP_WORKSPACE_ID
                        + OrganizationAuditHistoryServiceSql
                                .ORGANIZATION_AUDIT_HISTORY_SERVICE_GROUP_WORKSPACE_WORKSPACE
                        + OrganizationAuditHistoryServiceSql
                                .ORGANIZATION_AUDIT_HISTORY_SERVICE_WORKSPACE_COMMERCIAL_GROUP_GROUP_WORKSPACE_ID
                        + OrganizationAuditHistoryServiceSql
                                .ORGANIZATION_AUDIT_HISTORY_SERVICE_WORKSPACE_GROUP_WORKSPACE_KEY_COMMERCIAL_GROUP
                        + OrganizationAuditHistoryServiceSql.ORGANIZATION_AUDIT_HISTORY_SERVICE_COMMERCIAL_GROUP
                        + OrganizationAuditHistoryServiceSql
                                .ORGANIZATION_AUDIT_HISTORY_SERVICE_COMMERCIAL_GROUP_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setString(1, target.entityRef());
                    statement.setObject(2, scope.workspaceUuid());
                    statement.setString(3, scope.groupWorkspaceKey());
                },
                (result, row) -> result.getLong(1));
        if (groupWorkspaceIds.isEmpty())
            throw new com.catering.v2s.organization.application.BusinessEntityService.OrganizationNotFoundException();
        String workspaceRef = String.valueOf(groupWorkspaceIds.getFirst());
        long total = jdbc.queryForObject(
                OrganizationAuditHistoryServiceSql
                                .ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_AUDIT_EVENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_A
                        + OrganizationAuditHistoryServiceSql
                                .ORGANIZATION_AUDIT_HISTORY_SERVICE_OPEN_PAREN_ENTITY_TYPE_GROUP_WORKSPACE_ENTITY_REF_TEXT
                        + OrganizationAuditHistoryServiceSql.ORGANIZATION_AUDIT_HISTORY_SERVICE_ACTION
                        + OrganizationAuditHistoryServiceSql.ORGANIZATION_AUDIT_HISTORY_SERVICE_ENTITY_REF_TEXT,
                Long.class,
                scope.workspaceUuid(),
                scope.groupWorkspaceKey(),
                workspaceRef,
                target.entityRef());
        List<AuditHistoryItem> items = jdbc.query(
                OrganizationAuditHistoryServiceSql
                                .ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_OCCURRED_AT_EPOCH_MILLIS_ALTERNATE_A
                        + OrganizationAuditHistoryServiceSql
                                .ORGANIZATION_AUDIT_HISTORY_SERVICE_AUDIT_EVENT_CHANGES_JSON_TEXT_WORKSPACE_UUID_ALTERNATE_A
                        + OrganizationAuditHistoryServiceSql.ORGANIZATION_AUDIT_HISTORY_SERVICE_GROUP_WORKSPACE_KEY
                        + OrganizationAuditHistoryServiceSql.ORGANIZATION_AUDIT_HISTORY_SERVICE_ACTION_ALTERNATE_A
                        + OrganizationAuditHistoryServiceSql
                                .ORGANIZATION_AUDIT_HISTORY_SERVICE_ENTITY_REF_TEXT_OCCURRED_AT_EPOCH_MILLIS,
                (result, ignored) -> item(result),
                scope.workspaceUuid(),
                scope.groupWorkspaceKey(),
                workspaceRef,
                target.entityRef(),
                pageSize,
                (page - 1) * pageSize);
        return new AuditHistoryPage(items, page, pageSize, total);
    }

    public AuditHistoryResultSetReader.AuthorizedProjection readOperationsAuditProjection(
            AuditReadScope scope,
            String assignmentNodeType,
            VisibleOrganizationFacts visibleFacts,
            AuditTarget target,
            long page,
            long pageSize) {
        if (isStoreOwnedTarget(target.entityType()))
            return readStoreOwnedOperationsAuditProjection(scope, visibleFacts, target, page, pageSize);
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> jdbc.query(
                        operationsSql(target.entityType()),
                        statement -> {
                            int index = 1;
                            statement.setObject(index++, uuid(target.entityRef()));
                            if ("COMMERCIAL_GROUP".equals(target.entityType()))
                                statement.setString(index++, scope.groupWorkspaceKey());
                            else {
                                statement.setObject(index++, scope.workspaceUuid());
                                statement.setString(index++, scope.groupWorkspaceKey());
                            }
                            statement.setString(index++, assignmentNodeType);
                            statement.setArray(index++, uuidArray(statement, ids(visibleFacts, "ORGANIZATION_NODE")));
                            statement.setArray(
                                    index++, uuidArray(statement, ids(visibleFacts, AuditEntityTypes.HEAD_COMPANY)));
                            statement.setArray(
                                    index++, uuidArray(statement, ids(visibleFacts, AuditEntityTypes.STORE)));
                            statement.setObject(index++, scope.workspaceUuid());
                            statement.setString(index++, scope.groupWorkspaceKey());
                            statement.setString(index++, target.entityType());
                            statement.setString(index++, target.entityRef());
                            statement.setString(index++, target.entityType());
                            statement.setString(index++, target.entityType());
                            statement.setString(index++, target.entityRef());
                            statement.setLong(index++, pageSize);
                            statement.setLong(index, (page - 1) * pageSize);
                        },
                        AuditHistoryResultSetReader::readAuthorized));
    }

    private AuditHistoryResultSetReader.AuthorizedProjection readStoreOwnedOperationsAuditProjection(
            AuditReadScope scope, VisibleOrganizationFacts visibleFacts, AuditTarget target, long page, long pageSize) {
        StoreOwnedAuditTarget targetShape = storeOwnedAuditTarget(target.entityType());
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> jdbc.query(
                        String.format(
                                OrganizationAuditHistoryServiceSql
                                        .ORGANIZATION_AUDIT_HISTORY_SERVICE_SERVICE_POINT_TARGET_AUDIT_PROJECTION,
                                targetShape.tableName(),
                                targetShape.identifierColumn()),
                        statement -> {
                            int index = 1;
                            statement.setObject(index++, uuid(target.entityRef()));
                            statement.setObject(index++, scope.workspaceUuid());
                            statement.setString(index++, scope.groupWorkspaceKey());
                            statement.setArray(
                                    index++, uuidArray(statement, ids(visibleFacts, AuditEntityTypes.STORE)));
                            statement.setObject(index++, scope.workspaceUuid());
                            statement.setString(index++, scope.groupWorkspaceKey());
                            statement.setString(index++, target.entityType());
                            statement.setString(index++, target.entityRef());
                            statement.setLong(index++, pageSize);
                            statement.setLong(index, Math.multiplyExact(page - 1, pageSize));
                        },
                        AuditHistoryResultSetReader::readAuthorized));
    }

    private static boolean isStoreOwnedTarget(String type) {
        return Set.of(
                        AuditEntityTypes.STORE_SERVICE_POINT_AREA,
                        AuditEntityTypes.STORE_SERVICE_POINT,
                        AuditEntityTypes.STORE_QR_CONFIGURATION)
                .contains(type);
    }

    private static StoreOwnedAuditTarget storeOwnedAuditTarget(String type) {
        return switch (type) {
            case AuditEntityTypes.STORE_SERVICE_POINT_AREA -> new StoreOwnedAuditTarget(
                    "store_service_point_area", "area_ref");
            case AuditEntityTypes.STORE_SERVICE_POINT -> new StoreOwnedAuditTarget("store_service_point", "point_ref");
            case AuditEntityTypes.STORE_QR_CONFIGURATION -> new StoreOwnedAuditTarget(
                    "store_qr_configuration", "store_ref");
            default -> throw new IllegalArgumentException("unsupported store-owned audit target");
        };
    }

    private static AuditHistoryItem item(java.sql.ResultSet result) throws SQLException {
        return new AuditHistoryItem(
                result.getObject("id", UUID.class),
                result.getLong("occurred_at_epoch_millis"),
                result.getString("actor_display_snapshot"),
                result.getString("action"),
                new AuditTarget(result.getString("entity_type"), result.getString("entity_ref_text")),
                AuditChangeJson.read(result.getString("changes_json")));
    }

    private static String tableFor(String type) {
        return switch (type) {
            case "ORGANIZATION_NODE" -> "organization_node";
            case "BRAND" -> "brand";
            case "TENANT" -> "tenant";
            case AuditEntityTypes.HEAD_COMPANY -> "head_company";
            case AuditEntityTypes.STORE -> "store";
            case AuditEntityTypes.STORE_SERVICE_POINT_AREA -> "store_service_point_area";
            case AuditEntityTypes.STORE_SERVICE_POINT -> "store_service_point";
            case AuditEntityTypes.STORE_QR_CONFIGURATION -> "store_qr_configuration";
            default -> throw new IllegalArgumentException("unsupported organization audit target");
        };
    }

    private static String operationsSql(String type) {
        String target =
                switch (type) {
                    case "COMMERCIAL_GROUP" -> OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_COMMERCIAL_GROUP_COMMERCIAL_GROUP_UUID
                            + OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_COMMERCIAL_GROUP_ALTERNATE_A
                            + OrganizationAuditHistoryServiceSql.ORGANIZATION_AUDIT_HISTORY_SERVICE_NODE_SCOPE
                            + OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_COMMERCIAL_GROUP_HEAD_COMPANY_SCOPE_STORE_SCOPE
                            + OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_COMMERCIAL_GROUP_ALTERNATE_B
                            + OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_COMMERCIAL_GROUP_ALTERNATE_C;
                    case "ORGANIZATION_NODE" -> OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_NODE_TEXT_INITIALIZATION_REF
                            + OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_GROUP_ONLY_NODE_SCOPE_HEAD_COMPANY_SCOPE_STORE_SCOPE
                            + OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_ALTERNATIVE_ORGANIZATION_NODE_NODE_WORKSPACE_UUID
                            + OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_NODE_GROUP_WORKSPACE_KEY;
                    case "BRAND" -> OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_BRAND_TEXT_INITIALIZATION_REF_GROUP_ONLY
                            + OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_BRAND_NODE_SCOPE_HEAD_COMPANY_SCOPE_STORE_SCOPE
                            + OrganizationAuditHistoryServiceSql.ORGANIZATION_AUDIT_HISTORY_SERVICE_BRAND
                            + OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_BRAND_WORKSPACE_UUID_GROUP_WORKSPACE_KEY;
                    case "TENANT" -> OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_TENANT_TEXT_INITIALIZATION_REF_GROUP_ONLY
                            + OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_TENANT_NODE_SCOPE_HEAD_COMPANY_SCOPE_STORE_SCOPE
                            + OrganizationAuditHistoryServiceSql.ORGANIZATION_AUDIT_HISTORY_SERVICE_TENANT
                            + OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_TENANT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY;
                    case AuditEntityTypes.HEAD_COMPANY -> OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_HEAD_COMPANY_TEXT_INITIALIZATION_REF
                            + OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_GROUP_ONLY_NODE_SCOPE_HEAD_COMPANY_SCOPE_STORE_SCOPE_ALTERNATE_A
                            + OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_FROM_CLAUSE_HEAD_COMPANY_FROM_ORGANIZATION_HEAD_COMPA
                            + OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_HEAD_COMPANY_WORKSPACE_UUID_GROUP_WORKSPACE_KEY;
                    case AuditEntityTypes.STORE -> OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_STORE_TEXT_INITIALIZATION_REF_GROUP_ONLY
                            + OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_NODE_SCOPE_HEAD_COMPANY_SCOPE_STORE_SCOPE
                            + OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_ALTERNATIVE_STORE_WORKSPACE_UUID
                            + OrganizationAuditHistoryServiceSql
                                    .ORGANIZATION_AUDIT_HISTORY_SERVICE_STORE_GROUP_WORKSPACE_KEY;
                    default -> throw new IllegalArgumentException("unsupported operations organization audit target");
                };
        return OrganizationAuditHistoryServiceSql.ORGANIZATION_AUDIT_HISTORY_SERVICE_CTE_TARGET
                + target
                + OrganizationAuditHistoryServiceSql
                        .ORGANIZATION_AUDIT_HISTORY_SERVICE_CLOSE_PAREN_AUTH_SCOPE_TARGET_FOUND
                + OrganizationAuditHistoryServiceSql
                        .ORGANIZATION_AUDIT_HISTORY_SERVICE_WHEN_TARGET_GROUP_ONLY_NODE_SCOPE
                + OrganizationAuditHistoryServiceSql
                        .ORGANIZATION_AUDIT_HISTORY_SERVICE_TARGET_HEAD_COMPANY_SCOPE_STORE_SCOPE
                + OrganizationAuditHistoryServiceSql
                        .ORGANIZATION_AUDIT_HISTORY_SERVICE_ELSE_AUTHORIZED_TARGET_INITIALIZATION_REF_INPUT
                + OrganizationAuditHistoryServiceSql
                        .ORGANIZATION_AUDIT_HISTORY_SERVICE_JOIN_TARGET_AUDIT_ROWS_EVENT_AUDIT_ID
                + OrganizationAuditHistoryServiceSql.ORGANIZATION_AUDIT_HISTORY_SERVICE_EVENT
                + OrganizationAuditHistoryServiceSql
                        .ORGANIZATION_AUDIT_HISTORY_SERVICE_EVENT_ENTITY_REF_TEXT_CHANGES_JSON_TEXT
                + OrganizationAuditHistoryServiceSql
                        .ORGANIZATION_AUDIT_HISTORY_SERVICE_ALTERNATIVE_AUTH_SCOPE_AUDIT_EVENT_EVENT_FOUND
                + OrganizationAuditHistoryServiceSql
                        .ORGANIZATION_AUDIT_HISTORY_SERVICE_AUTH_SCOPE_AUTHORIZED_EVENT_WORKSPACE_UUID
                + OrganizationAuditHistoryServiceSql
                        .ORGANIZATION_AUDIT_HISTORY_SERVICE_OPEN_PAREN_COMMERCIAL_GROUP_EVENT_ENTITY_TYPE_ENTITY_REF_TEXT
                + OrganizationAuditHistoryServiceSql
                        .ORGANIZATION_AUDIT_HISTORY_SERVICE_ALTERNATIVE_EVENT_ENTITY_TYPE_GROUP_WORKSPACE_ENTITY_REF_TEXT
                + OrganizationAuditHistoryServiceSql.ORGANIZATION_AUDIT_HISTORY_SERVICE_CONDITION_EVENT
                + OrganizationAuditHistoryServiceSql.ORGANIZATION_AUDIT_HISTORY_SERVICE_AUDIT_ROWS
                + OrganizationAuditHistoryServiceSql
                        .ORGANIZATION_AUDIT_HISTORY_SERVICE_ORDER_BY_OCCURRED_AT_EPOCH_MILLIS_AUDIT_ID_TOTAL_ROWS
                + OrganizationAuditHistoryServiceSql
                        .ORGANIZATION_AUDIT_HISTORY_SERVICE_AUDIT_ROWS_TOTAL_AUTH_SCOPE_FOUND
                + OrganizationAuditHistoryServiceSql
                        .ORGANIZATION_AUDIT_HISTORY_SERVICE_AUTH_SCOPE_AUTHORIZED_TOTAL_ROWS_TOTAL
                + OrganizationAuditHistoryServiceSql.ORGANIZATION_AUDIT_HISTORY_SERVICE_PAGE_ROWS
                + OrganizationAuditHistoryServiceSql.ORGANIZATION_AUDIT_HISTORY_SERVICE_AUTH_SCOPE
                + OrganizationAuditHistoryServiceSql
                        .ORGANIZATION_AUDIT_HISTORY_SERVICE_JOIN_PAGE_ROWS_JOIN_TOTAL_ROWS_LEFT_JOIN_PA;
    }

    private static List<UUID> ids(VisibleOrganizationFacts facts, String type) {
        return facts.candidates().stream()
                .filter(value -> type.equals(value.dataNodeType())
                        || ("ORGANIZATION_NODE".equals(type)
                                && ("REGION".equals(value.dataNodeType())
                                        || "PROJECT".equals(value.dataNodeType())
                                        || "GROUP".equals(value.dataNodeType()))))
                .map(value -> value.dataNodeId())
                .toList();
    }

    private static Array uuidArray(java.sql.PreparedStatement statement, List<UUID> values) throws SQLException {
        return statement.getConnection().createArrayOf("uuid", values.toArray(UUID[]::new));
    }

    private static UUID uuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (RuntimeException invalid) {
            throw new IllegalArgumentException("operations audit target must be a UUID", invalid);
        }
    }

    private record StoreOwnedAuditTarget(String tableName, String identifierColumn) {}
}
