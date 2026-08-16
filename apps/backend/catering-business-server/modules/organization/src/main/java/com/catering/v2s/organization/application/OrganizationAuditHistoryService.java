package com.catering.v2s.organization.application;

import com.catering.v2s.audit.contract.*;
import com.catering.v2s.audit.contract.AuditEntityTypes;
import com.catering.v2s.organization.api.CommercialGroupInitializationAuditLookup;
import com.catering.v2s.organization.api.OrganizationVisibilityLookup.VisibleOrganizationFacts;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import java.sql.Array;
import java.sql.SQLException;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner-local reader for organization-node and business-entity audit facts. */
@Service
public class OrganizationAuditHistoryService implements CommercialGroupInitializationAuditLookup {
    private static final Set<String> TYPES =
            Set.of("ORGANIZATION_NODE", "BRAND", "TENANT", AuditEntityTypes.HEAD_COMPANY, AuditEntityTypes.STORE);
    private final JdbcTemplate jdbc;

    public OrganizationAuditHistoryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public AuditHistoryPage read(AuditReadScope scope, AuditTarget target, long page, long pageSize) {
        if (!TYPES.contains(target.entityType()) || page < 1 || pageSize < 1 || pageSize > 100)
            throw new IllegalArgumentException("unsupported organization audit target");
        String table =
                switch (target.entityType()) {
                    case "ORGANIZATION_NODE" -> "organization_node";
                    case "BRAND" -> "brand";
                    case "TENANT" -> "tenant";
                    case AuditEntityTypes.HEAD_COMPANY -> "head_company";
                    case AuditEntityTypes.STORE -> "store";
                    default -> throw new IllegalArgumentException("unsupported organization audit target");
                };
        Boolean exists = jdbc.query(
                "SELECT EXISTS(SELECT 1 FROM organization." + table
                        + " WHERE id::text=? AND workspace_uuid=? AND group_workspace_key=?)",
                statement -> {
                    statement.setString(1, target.entityRef());
                    statement.setObject(2, scope.workspaceUuid());
                    statement.setString(3, scope.groupWorkspaceKey());
                },
                result -> result.next() && result.getBoolean(1));
        if (!Boolean.TRUE.equals(exists)) throw new BusinessEntityService.OrganizationNotFoundException();
        long total = jdbc.queryForObject(
                "SELECT count(*) FROM organization.audit_event WHERE workspace_uuid=? AND group_workspace_key=? AND "
                        + "entity_type=? AND entity_ref_text=?",
                Long.class,
                scope.workspaceUuid(),
                scope.groupWorkspaceKey(),
                target.entityType(),
                target.entityRef());
        List<AuditHistoryItem> items = jdbc.query(
                "SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text, "
                        + "changes_json::text FROM organization.audit_event WHERE workspace_uuid=? AND "
                        + "group_workspace_key=? AND entity_type=? AND entity_ref_text=? ORDER BY "
                        + "occurred_at_epoch_millis "
                        + "DESC, id DESC LIMIT ? OFFSET ?",
                (r, n) -> new AuditHistoryItem(
                        r.getObject("id", UUID.class),
                        r.getLong("occurred_at_epoch_millis"),
                        r.getString("actor_display_snapshot"),
                        r.getString("action"),
                        new AuditTarget(r.getString("entity_type"), r.getString("entity_ref_text")),
                        AuditChangeJson.read(r.getString("changes_json"))),
                scope.workspaceUuid(),
                scope.groupWorkspaceKey(),
                target.entityType(),
                target.entityRef(),
                pageSize,
                (page - 1) * pageSize);
        return new AuditHistoryPage(items, page, pageSize, total);
    }

    @Override
    @Transactional(readOnly = true)
    public AuditHistoryPage readInitializationForGroupWorkspace(
            AuditReadScope scope, String entityRef, long page, long pageSize) {
        if (page < 1 || pageSize < 1 || pageSize > 100)
            throw new IllegalArgumentException("unsupported organization audit page");
        long offset = Math.multiplyExact(page - 1, pageSize);
        AuditHistoryResultSetReader.ItemsProjection value = jdbc.query(
                """
        WITH events AS (
          SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text,
                 changes_json::text AS changes_json, count(*) OVER () AS total
          FROM organization.audit_event
          WHERE workspace_uuid=? AND group_workspace_key=? AND entity_type='GROUP_WORKSPACE'
            AND entity_ref_text=? AND action='COMMERCIAL_GROUP_INITIALIZED'
        ), summary AS (SELECT COALESCE(MAX(total), 0) AS total FROM events)
        SELECT summary.total, page.event_id, page.occurred_at_epoch_millis, page.actor_display_snapshot,
               page.action, page.entity_type, page.entity_ref_text, page.changes_json
        FROM summary LEFT JOIN LATERAL (
          SELECT id AS event_id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type,
                 entity_ref_text, changes_json FROM events
          ORDER BY occurred_at_epoch_millis DESC, id DESC LIMIT ? OFFSET ?
        ) page ON TRUE
        """,
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

    /** Reads only the initialization fact owned by the selected commercial group, never the wider workspace history. */
    @Transactional(readOnly = true)
    public AuditHistoryPage readCommercialGroup(AuditReadScope scope, AuditTarget target, long page, long pageSize) {
        if (!"COMMERCIAL_GROUP".equals(target.entityType()) || page < 1 || pageSize < 1 || pageSize > 100)
            throw new IllegalArgumentException("unsupported commercial-group audit target");
        List<Long> groupWorkspaceIds = jdbc.query(
                "SELECT commercial_group.group_workspace_id FROM organization.commercial_group commercial_group JOIN "
                        + "platform_workspace.group_workspace workspace ON "
                        + "workspace.id=commercial_group.group_workspace_id AND "
                        + "workspace.group_workspace_key=commercial_group.group_workspace_key WHERE "
                        + "commercial_group.commercial_group_uuid::text=? AND workspace.workspace_uuid=? AND "
                        + "commercial_group.group_workspace_key=?",
                statement -> {
                    statement.setString(1, target.entityRef());
                    statement.setObject(2, scope.workspaceUuid());
                    statement.setString(3, scope.groupWorkspaceKey());
                },
                (result, row) -> result.getLong(1));
        if (groupWorkspaceIds.isEmpty()) throw new BusinessEntityService.OrganizationNotFoundException();
        String workspaceRef = String.valueOf(groupWorkspaceIds.getFirst());
        long total = jdbc.queryForObject(
                "SELECT count(*) FROM organization.audit_event WHERE workspace_uuid=? AND group_workspace_key=? AND "
                        + "((entity_type='GROUP_WORKSPACE' AND entity_ref_text=? AND "
                        + "action='COMMERCIAL_GROUP_INITIALIZED') OR (entity_type='COMMERCIAL_GROUP' AND "
                        + "entity_ref_text=?))",
                Long.class,
                scope.workspaceUuid(),
                scope.groupWorkspaceKey(),
                workspaceRef,
                target.entityRef());
        List<AuditHistoryItem> items = jdbc.query(
                "SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text, "
                        + "changes_json::text FROM organization.audit_event WHERE workspace_uuid=? AND "
                        + "group_workspace_key=? AND ((entity_type='GROUP_WORKSPACE' AND entity_ref_text=? AND "
                        + "action='COMMERCIAL_GROUP_INITIALIZED') OR (entity_type='COMMERCIAL_GROUP' AND "
                        + "entity_ref_text=?)) ORDER BY occurred_at_epoch_millis DESC, id DESC LIMIT ? OFFSET ?",
                (r, n) -> new AuditHistoryItem(
                        r.getObject("id", UUID.class),
                        r.getLong("occurred_at_epoch_millis"),
                        r.getString("actor_display_snapshot"),
                        r.getString("action"),
                        new AuditTarget(r.getString("entity_type"), r.getString("entity_ref_text")),
                        AuditChangeJson.read(r.getString("changes_json"))),
                scope.workspaceUuid(),
                scope.groupWorkspaceKey(),
                workspaceRef,
                target.entityRef(),
                pageSize,
                (page - 1) * pageSize);
        return new AuditHistoryPage(items, page, pageSize, total);
    }

    /**
     * The closed operations-audit projection. Visible facts are invocation-scoped read facts, not a permission cache;
     * all target, host and page decisions remain in this organization statement.
     */
    @Transactional(readOnly = true)
    public AuditHistoryPage readOperationsAuditProjection(
            AuditReadScope scope,
            String assignmentNodeType,
            VisibleOrganizationFacts visibleFacts,
            AuditTarget target,
            long page,
            long pageSize) {
        if (scope == null
                || visibleFacts == null
                || target == null
                || !Set.of(
                                "COMMERCIAL_GROUP",
                                "ORGANIZATION_NODE",
                                "BRAND",
                                "TENANT",
                                AuditEntityTypes.HEAD_COMPANY,
                                AuditEntityTypes.STORE)
                        .contains(target.entityType())
                || page < 1
                || pageSize < 1
                || pageSize > 100)
            throw new IllegalArgumentException("unsupported operations organization audit target");
        AuditHistoryResultSetReader.AuthorizedProjection value = ReadBudgetComponent.measure(
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
        if (!value.found()) throw new BusinessEntityService.OrganizationNotFoundException();
        if (!value.authorized()) throw new OrganizationHierarchyService.OrganizationAuthorizationException();
        return new AuditHistoryPage(value.items(), page, pageSize, value.total());
    }

    private static String operationsSql(String type) {
        String target =
                switch (type) {
                    case "COMMERCIAL_GROUP" -> "SELECT commercial_group.commercial_group_uuid AS id, "
                            + "commercial_group.group_workspace_id::text AS initialization_ref, TRUE AS group_only, "
                            + "FALSE AS node_scope, "
                            + "FALSE AS head_company_scope, FALSE AS store_scope FROM organization.commercial_group "
                            + "commercial_group WHERE "
                            + "commercial_group.commercial_group_uuid=? AND commercial_group.group_workspace_key=?";
                    case "ORGANIZATION_NODE" -> "SELECT node.id, NULL::text AS initialization_ref, FALSE AS "
                            + "group_only, TRUE AS node_scope, FALSE AS head_company_scope, FALSE AS store_scope FROM "
                            + "organization.organization_node node WHERE node.id=? AND node.workspace_uuid=? AND "
                            + "node.group_workspace_key=?";
                    case "BRAND" -> "SELECT brand.id, NULL::text AS initialization_ref, TRUE AS group_only, FALSE AS "
                            + "node_scope, FALSE AS head_company_scope, FALSE AS store_scope FROM organization.brand "
                            + "brand WHERE "
                            + "brand.id=? AND brand.workspace_uuid=? AND brand.group_workspace_key=?";
                    case "TENANT" -> "SELECT tenant.id, NULL::text AS initialization_ref, TRUE AS group_only, FALSE AS "
                            + "node_scope, FALSE AS head_company_scope, FALSE AS store_scope FROM organization.tenant "
                            + "tenant WHERE "
                            + "tenant.id=? AND tenant.workspace_uuid=? AND tenant.group_workspace_key=?";
                    case AuditEntityTypes
                            .HEAD_COMPANY -> "SELECT head_company.id, NULL::text AS initialization_ref, FALSE AS "
                            + "group_only, FALSE AS node_scope, TRUE AS head_company_scope, FALSE AS store_scope "
                            + "FROM organization.head_company head_company WHERE head_company.id=? AND "
                            + "head_company.workspace_uuid=? AND head_company.group_workspace_key=?";
                    case AuditEntityTypes
                            .STORE -> "SELECT store.id, NULL::text AS initialization_ref, FALSE AS group_only, FALSE "
                            + "AS node_scope, FALSE AS head_company_scope, TRUE AS store_scope FROM "
                            + "organization.store store WHERE store.id=? AND store.workspace_uuid=? AND "
                            + "store.group_workspace_key=?";
                    default -> throw new IllegalArgumentException("unsupported operations organization audit target");
                };
        return "WITH target AS (" + target
                + "), auth_scope AS (SELECT target.id IS NOT NULL AS found, CASE WHEN target.id IS NULL THEN FALSE "
                + "WHEN target.group_only THEN ?='GROUP' WHEN target.node_scope THEN target.id=ANY(?) WHEN "
                + "target.head_company_scope THEN target.id=ANY(?) WHEN target.store_scope THEN target.id=ANY(?) "
                + "ELSE FALSE END AS authorized, target.initialization_ref FROM (VALUES (1)) input(value) LEFT "
                + "JOIN target ON TRUE), audit_rows AS (SELECT event.id AS audit_id, "
                + "event.occurred_at_epoch_millis, event.actor_display_snapshot, event.action, event.entity_type, "
                + "event.entity_ref_text, event.changes_json::text AS changes_json, count(*) OVER() AS total FROM "
                + "organization.audit_event event CROSS JOIN auth_scope WHERE auth_scope.found AND "
                + "auth_scope.authorized AND event.workspace_uuid=? AND event.group_workspace_key=? AND "
                + "((?='COMMERCIAL_GROUP' AND ((event.entity_type='COMMERCIAL_GROUP' AND event.entity_ref_text=?) "
                + "OR (event.entity_type='GROUP_WORKSPACE' AND event.entity_ref_text=auth_scope.initialization_ref "
                + "AND event.action='COMMERCIAL_GROUP_INITIALIZED'))) OR (?<>'COMMERCIAL_GROUP' AND "
                + "event.entity_type=? AND event.entity_ref_text=?))), page_rows AS (SELECT * FROM audit_rows "
                + "ORDER BY occurred_at_epoch_millis DESC, audit_id DESC LIMIT ? OFFSET ?), total_rows AS (SELECT "
                + "coalesce(max(total), 0) AS total FROM audit_rows) SELECT auth_scope.found, "
                + "auth_scope.authorized, total_rows.total, page_rows.audit_id, "
                + "page_rows.occurred_at_epoch_millis, page_rows.actor_display_snapshot, page_rows.action, "
                + "page_rows.entity_type, page_rows.entity_ref_text, page_rows.changes_json FROM auth_scope CROSS "
                + "JOIN total_rows LEFT JOIN page_rows ON TRUE";
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
}
