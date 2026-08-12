package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Platform account reads use exactly two explicit owner stages: one workspace-IAM projection and
 * one organization batch that decorates persisted assignment references with display paths.
 */
@Service
public class PlatformWorkspaceAccountTaskReadService {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> SORTS = Set.of("DISPLAY_NAME", "LOGIN_NAME", "LAST_LOGIN_AT", "UPDATED_AT");
    private final JdbcTemplate jdbc;
    private final OrganizationTaskPathLookup paths;

    public PlatformWorkspaceAccountTaskReadService(JdbcTemplate jdbc, OrganizationTaskPathLookup paths) {
        this.jdbc = jdbc;
        this.paths = paths;
    }

    @Transactional(readOnly = true)
    public WorkspaceUserService.AccountPage page(WorkspaceUserService.AccountPageQuery query) {
        WorkspaceUserService.AccountPageQuery safe = platform(query);
        String sort = sort(safe.sort());
        String direction = direction(safe.direction());
        List<Row> rows = primary(() -> jdbc.query(pageSql(orderColumn(sort), direction), this::row, pageArguments(safe)));
        long total = rows.isEmpty() ? 0 : rows.getFirst().total();
        return new WorkspaceUserService.AccountPage(users(safe.workspaceUuid(), safe.groupWorkspaceKey(), rows), safe.page(), safe.pageSize(), total, null, null, null, null, sort, direction);
    }

    @Transactional(readOnly = true)
    public WorkspaceUserService.User detail(WorkspaceUserService.AccountDetailQuery query) {
        WorkspaceUserService.AccountDetailQuery safe = platform(query);
        List<Row> rows = primary(() -> jdbc.query(detailSql(), this::row, safe.workspaceUuid(), safe.groupWorkspaceKey(), safe.workspaceUuid(), safe.groupWorkspaceKey(), safe.workspaceUuid(), safe.groupWorkspaceKey(), safe.workspaceUuid(), safe.groupWorkspaceKey(), safe.workspaceUuid(), safe.groupWorkspaceKey(), safe.accountId()));
        if (rows.isEmpty()) throw new WorkspaceAccountService.AccountNotFoundException();
        return users(safe.workspaceUuid(), safe.groupWorkspaceKey(), rows).getFirst();
    }

    private List<WorkspaceUserService.User> users(UUID workspaceUuid, String key, List<Row> rows) {
        List<Row> actual = rows.stream().filter(value -> value.id() != null).toList();
        LinkedHashSet<OrganizationTaskPathLookup.TaskPathRef> refs = new LinkedHashSet<>();
        for (Row row : actual) for (RawAssignment assignment : assignments(row)) refs.add(new OrganizationTaskPathLookup.TaskPathRef(assignment.serviceNodeType(), assignment.serviceNodeId()));
        Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> resolved = refs.isEmpty()
            ? Map.of()
            : primary(() -> paths.describePersistedTaskPaths(workspaceUuid, key, List.copyOf(refs)));
        List<WorkspaceUserService.User> result = new ArrayList<>();
        for (Row row : actual) {
            List<WorkspaceUserService.Assignment> assignments = assignments(row).stream().map(value -> assignment(row.id(), value, resolved)).toList();
            result.add(new WorkspaceUserService.User(
                row.id(), row.displayName(), row.mobile(), mask(row.mobile()), row.loginName(), row.status(),
                row.passwordChangeRequired() ? "CHANGE_REQUIRED" : "SET",
                (int) assignments.stream().filter(value -> "ACTIVE".equals(value.status())).count(),
                assignments, invitations(row), row.lastLoginAt(), history(row), row.createdAt(), row.updatedAt(), row.version()
            ));
        }
        return List.copyOf(result);
    }

    private static WorkspaceUserService.Assignment assignment(UUID accountId, RawAssignment value, Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> paths) {
        OrganizationTaskPathLookup.TaskPath path = paths.get(new OrganizationTaskPathLookup.TaskPathRef(value.serviceNodeType(), value.serviceNodeId()));
        if (path == null) throw new WorkspaceAccountService.AccountNotFoundException();
        return new WorkspaceUserService.Assignment(value.id(), accountId, value.roleId(), value.roleName(), value.serviceNodeType(), path.displayPath(), value.status(), value.sourceInvitationId() == null ? "ADMINISTRATION" : "INVITATION", value.version(), value.createdAt(), value.updatedAt(), value.serviceNodeId());
    }

    private static WorkspaceUserService.AccountPageQuery platform(WorkspaceUserService.AccountPageQuery query) {
        if (query == null || query.operationsSession() != null || query.workspaceUuid() == null || query.groupWorkspaceKey() == null || query.groupWorkspaceKey().isBlank() || query.page() < 1 || query.pageSize() < 1 || (query.status() != null && !Set.of("ENABLED", "DISABLED").contains(query.status()))) throw new WorkspaceAccountService.AccountNotFoundException();
        if (query.pageSize() > 100) throw new WorkspaceUserService.PageValidationException();
        return query;
    }

    private static WorkspaceUserService.AccountDetailQuery platform(WorkspaceUserService.AccountDetailQuery query) {
        if (query == null || query.operationsSession() != null || query.workspaceUuid() == null || query.groupWorkspaceKey() == null || query.groupWorkspaceKey().isBlank() || query.accountId() == null) throw new WorkspaceAccountService.AccountNotFoundException();
        return query;
    }

    private static String sort(String value) {
        String safe = value == null ? "LOGIN_NAME" : value;
        if (!SORTS.contains(safe)) throw new WorkspaceAccountService.AccountNotFoundException();
        return safe;
    }

    private static String direction(String value) {
        String safe = value == null ? "ASC" : value;
        if (!Set.of("ASC", "DESC").contains(safe)) throw new WorkspaceAccountService.AccountNotFoundException();
        return safe;
    }

    private static String orderColumn(String sort) {
        return switch (sort) {
            case "DISPLAY_NAME" -> "display_name";
            case "LOGIN_NAME" -> "login_name_normalized";
            case "LAST_LOGIN_AT" -> "COALESCE(last_login_at, -1)";
            case "UPDATED_AT" -> "updated_at_epoch_millis";
            default -> throw new WorkspaceAccountService.AccountNotFoundException();
        };
    }

    private static Object[] pageArguments(WorkspaceUserService.AccountPageQuery value) {
        return new Object[] {
            value.workspaceUuid(), value.groupWorkspaceKey(), value.workspaceUuid(), value.groupWorkspaceKey(),
            value.userName(), value.userName(), value.mobile(), value.mobile(), value.loginName(), value.loginName(), value.status(), value.status(),
            value.targetType(), value.organizationRef(), value.roleId(), value.targetType(), value.targetType(), value.organizationRef(), value.organizationRef(), value.roleId(), value.roleId(),
            value.pageSize(), (value.page() - 1) * value.pageSize(),
            value.workspaceUuid(), value.groupWorkspaceKey(), value.workspaceUuid(), value.groupWorkspaceKey()
        };
    }

    private static String pageSql(String order, String direction) {
        return """
            WITH filtered AS MATERIALIZED (
              SELECT a.id, a.display_name, a.mobile_normalized, a.login_name_normalized, a.status, a.version,
                     a.created_at_epoch_millis, a.updated_at_epoch_millis, login.last_login_at, COUNT(*) OVER () AS total
              FROM workspace_iam.workspace_account a
              LEFT JOIN (
                SELECT account_id, MAX(authenticated_at_epoch_millis) AS last_login_at
                FROM workspace_iam.workspace_authentication_history
                WHERE workspace_uuid=? AND group_workspace_key=? GROUP BY account_id
              ) login ON login.account_id=a.id
              WHERE a.workspace_uuid=? AND a.group_workspace_key=?
                AND (CAST(? AS text) IS NULL OR a.display_name ILIKE '%' || ? || '%')
                AND (CAST(? AS text) IS NULL OR a.mobile_normalized ILIKE '%' || ? || '%')
                AND (CAST(? AS text) IS NULL OR a.login_name_normalized ILIKE '%' || ? || '%')
                AND (CAST(? AS text) IS NULL OR a.status=?)
                AND ((CAST(? AS text) IS NULL AND CAST(? AS uuid) IS NULL AND CAST(? AS uuid) IS NULL)
                     OR EXISTS (SELECT 1 FROM workspace_iam.role_assignment assignment
                                WHERE assignment.account_id=a.id AND assignment.workspace_uuid=a.workspace_uuid AND assignment.group_workspace_key=a.group_workspace_key
                                  AND (CAST(? AS text) IS NULL OR assignment.service_node_type=?)
                                  AND (CAST(? AS uuid) IS NULL OR assignment.service_node_id=?)
                                  AND (CAST(? AS uuid) IS NULL OR assignment.role_id=?)))
            ), paged AS (
              SELECT * FROM filtered ORDER BY __ORDER__ __DIRECTION__, id ASC LIMIT ? OFFSET ?
            ), page_total AS (
              SELECT COALESCE(MAX(total), (SELECT COUNT(*) FROM filtered)) AS total FROM paged
            )
            SELECT paged.id, paged.display_name, paged.mobile_normalized, paged.login_name_normalized, paged.status, paged.version,
                   paged.created_at_epoch_millis, paged.updated_at_epoch_millis, page_total.total, paged.last_login_at,
                   COALESCE(assignments.value, '[]'::jsonb)::text AS assignments,
                   COALESCE(invitations.value, '[]'::jsonb)::text AS invitations,
                   '[]'::jsonb::text AS history,
                   COALESCE(credentials.password_change_required, FALSE) AS password_change_required
            FROM page_total LEFT JOIN paged ON TRUE
            LEFT JOIN LATERAL (
              SELECT jsonb_agg(jsonb_build_object('id', r.id, 'roleId', r.role_id, 'roleName', role.name, 'type', r.service_node_type,
                 'ref', r.service_node_id, 'status', r.status, 'source', r.source_invitation_id, 'version', r.version,
                 'created', r.created_at_epoch_millis, 'updated', r.updated_at_epoch_millis) ORDER BY r.created_at_epoch_millis) AS value
              FROM workspace_iam.role_assignment r JOIN workspace_iam.workspace_role role ON role.id=r.role_id
              WHERE r.workspace_uuid=? AND r.group_workspace_key=? AND r.account_id=paged.id
            ) assignments ON TRUE
            LEFT JOIN LATERAL (
              SELECT jsonb_agg(jsonb_build_object('id', invitation.id, 'status', invitation.status, 'version', invitation.version, 'expires', invitation.expires_at_epoch_millis) ORDER BY invitation.expires_at_epoch_millis DESC) AS value
              FROM workspace_iam.invitation invitation
              WHERE invitation.workspace_uuid=? AND invitation.group_workspace_key=? AND invitation.mobile_normalized=paged.mobile_normalized
            ) invitations ON TRUE
            LEFT JOIN LATERAL (
              SELECT TRUE AS password_change_required FROM workspace_iam.workspace_credential credential
              WHERE credential.account_id=paged.id AND credential.password_change_required=TRUE LIMIT 1
            ) credentials ON TRUE
            """.replace("__ORDER__", order).replace("__DIRECTION__", direction)
            + " ORDER BY " + ("COALESCE(last_login_at, -1)".equals(order) ? "COALESCE(paged.last_login_at, -1)" : "paged." + order) + " " + direction + ", paged.id ASC";
    }

    private static String detailSql() {
        return """
            SELECT a.id, a.display_name, a.mobile_normalized, a.login_name_normalized, a.status, a.version,
                   a.created_at_epoch_millis, a.updated_at_epoch_millis, 1 AS total, login.last_login_at,
                   COALESCE(assignments.value, '[]'::jsonb)::text AS assignments,
                   COALESCE(invitations.value, '[]'::jsonb)::text AS invitations,
                   COALESCE(history.value, '[]'::jsonb)::text AS history,
                   COALESCE(credentials.password_change_required, FALSE) AS password_change_required
            FROM workspace_iam.workspace_account a
            LEFT JOIN LATERAL (SELECT MAX(authenticated_at_epoch_millis) AS last_login_at FROM workspace_iam.workspace_authentication_history WHERE workspace_uuid=? AND group_workspace_key=? AND account_id=a.id) login ON TRUE
            LEFT JOIN LATERAL (
              SELECT jsonb_agg(jsonb_build_object('id', r.id, 'roleId', r.role_id, 'roleName', role.name, 'type', r.service_node_type,
                 'ref', r.service_node_id, 'status', r.status, 'source', r.source_invitation_id, 'version', r.version,
                 'created', r.created_at_epoch_millis, 'updated', r.updated_at_epoch_millis) ORDER BY r.created_at_epoch_millis) AS value
              FROM workspace_iam.role_assignment r JOIN workspace_iam.workspace_role role ON role.id=r.role_id
              WHERE r.workspace_uuid=? AND r.group_workspace_key=? AND r.account_id=a.id
            ) assignments ON TRUE
            LEFT JOIN LATERAL (
              SELECT jsonb_agg(jsonb_build_object('id', invitation.id, 'status', invitation.status, 'version', invitation.version, 'expires', invitation.expires_at_epoch_millis) ORDER BY invitation.expires_at_epoch_millis DESC) AS value
              FROM workspace_iam.invitation invitation WHERE invitation.workspace_uuid=? AND invitation.group_workspace_key=? AND invitation.mobile_normalized=a.mobile_normalized
            ) invitations ON TRUE
            LEFT JOIN LATERAL (
              SELECT jsonb_agg(jsonb_build_object('id', value.id, 'authenticatedAt', value.authenticated_at_epoch_millis) ORDER BY value.authenticated_at_epoch_millis DESC, value.id DESC) AS value
              FROM (SELECT id, authenticated_at_epoch_millis FROM workspace_iam.workspace_authentication_history WHERE workspace_uuid=? AND group_workspace_key=? AND account_id=a.id ORDER BY authenticated_at_epoch_millis DESC, id DESC LIMIT 10) value
            ) history ON TRUE
            LEFT JOIN LATERAL (SELECT TRUE AS password_change_required FROM workspace_iam.workspace_credential credential WHERE credential.account_id=a.id AND credential.password_change_required=TRUE LIMIT 1) credentials ON TRUE
            WHERE a.workspace_uuid=? AND a.group_workspace_key=? AND a.id=?
            """;
    }

    private Row row(ResultSet result, int ignored) throws SQLException {
        return new Row(result.getObject(1, UUID.class), result.getString(2), result.getString(3), result.getString(4), result.getString(5), result.getLong(6), result.getLong(7), result.getLong(8), result.getLong(9), result.getObject(10, Long.class), result.getString(11), result.getString(12), result.getString(13), result.getBoolean(14));
    }

    private static List<RawAssignment> assignments(Row row) {
        return array(row.assignments()).stream().map(value -> new RawAssignment(uuid(value, "id"), uuid(value, "roleId"), value.path("roleName").asText(), value.path("type").asText(), uuid(value, "ref"), value.path("status").asText(), value.path("source").isNull() ? null : uuid(value, "source"), value.path("version").asLong(), value.path("created").asLong(), value.path("updated").asLong())).toList();
    }

    private static List<WorkspaceUserService.Invitation> invitations(Row row) {
        return array(row.invitations()).stream().map(value -> new WorkspaceUserService.Invitation(uuid(value, "id"), invitationStatus(value.path("status").asText()), Math.toIntExact(value.path("version").asLong()), value.path("expires").asLong())).toList();
    }

    private static List<WorkspaceUserService.AuthenticationHistory> history(Row row) {
        return array(row.history()).stream().map(value -> new WorkspaceUserService.AuthenticationHistory(uuid(value, "id"), value.path("authenticatedAt").asLong())).toList();
    }

    private static UUID uuid(JsonNode value, String field) { return UUID.fromString(value.path(field).asText()); }
    private static List<JsonNode> array(String source) {
        try {
            JsonNode root = JSON.readTree(source);
            List<JsonNode> values = new ArrayList<>();
            root.forEach(values::add);
            return List.copyOf(values);
        } catch (Exception error) { throw new WorkspaceAccountService.AccountNotFoundException(); }
    }
    private static String invitationStatus(String status) { return switch (status) { case "CANCELLED" -> "CANCELLED"; case "COMPLETED" -> "COMPLETED"; case "EXPIRED" -> "EXPIRED"; default -> "ACTIVE"; }; }
    private static String mask(String value) { return value.length() <= 4 ? "****" : value.substring(0, Math.min(3, value.length())) + "****" + value.substring(Math.max(3, value.length() - 4)); }
    private static <T> T primary(java.util.function.Supplier<T> action) { return ReadBudgetComponent.measure(ReadBudgetComponent.Component.PRIMARY_QUERY, action); }

    private record Row(UUID id, String displayName, String mobile, String loginName, String status, long version, long createdAt, long updatedAt, long total, Long lastLoginAt, String assignments, String invitations, String history, boolean passwordChangeRequired) { }
    private record RawAssignment(UUID id, UUID roleId, String roleName, String serviceNodeType, UUID serviceNodeId, String status, UUID sourceInvitationId, long version, long createdAt, long updatedAt) { }
}
