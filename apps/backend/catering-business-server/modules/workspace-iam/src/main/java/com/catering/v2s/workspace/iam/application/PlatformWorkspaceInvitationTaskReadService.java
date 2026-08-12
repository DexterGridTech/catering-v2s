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

/** Platform invitation reads: a workspace-IAM CTE projection plus one persisted-path batch. */
@Service
public class PlatformWorkspaceInvitationTaskReadService {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final JdbcTemplate jdbc;
    private final OrganizationTaskPathLookup paths;

    public PlatformWorkspaceInvitationTaskReadService(JdbcTemplate jdbc, OrganizationTaskPathLookup paths) { this.jdbc = jdbc; this.paths = paths; }

    @Transactional(readOnly = true)
    public WorkspaceInvitationService.ManagementInvitationPage page(UUID workspaceUuid, String key, WorkspaceInvitationService.ManagementInvitationPageRequest request) {
        Page safe = page(request);
        Predicate predicate = predicate(workspaceUuid, key, safe.criteria());
        List<Row> rows = primary(() -> jdbc.query(pageSql(safe.order(), safe.direction(), predicate.where()), this::row, arguments(predicate.arguments(), safe.criteria().pageSize(), (safe.criteria().page() - 1) * safe.criteria().pageSize())));
        long total = rows.isEmpty() ? 0 : rows.getFirst().total();
        return new WorkspaceInvitationService.ManagementInvitationPage(views(workspaceUuid, key, rows), safe.criteria().page(), safe.criteria().pageSize(), total, safe.criteria());
    }

    @Transactional(readOnly = true)
    public WorkspaceInvitationService.ManagementInvitationView detail(UUID workspaceUuid, String key, UUID invitationId) {
        if (workspaceUuid == null || key == null || key.isBlank() || invitationId == null) throw new WorkspaceInvitationService.InvitationNotFoundException();
        List<Row> rows = primary(() -> jdbc.query(detailSql(), this::row, workspaceUuid, key, invitationId));
        if (rows.isEmpty()) throw new WorkspaceInvitationService.InvitationNotFoundException();
        return views(workspaceUuid, key, rows).getFirst();
    }

    private List<WorkspaceInvitationService.ManagementInvitationView> views(UUID workspaceUuid, String key, List<Row> rows) {
        List<Row> actual = rows.stream().filter(row -> row.id() != null).toList();
        LinkedHashSet<OrganizationTaskPathLookup.TaskPathRef> refs = new LinkedHashSet<>();
        for (Row row : actual) for (Intent intent : intents(row)) refs.add(new OrganizationTaskPathLookup.TaskPathRef(intent.type(), intent.targetId()));
        Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> resolved = refs.isEmpty() ? Map.of() : primary(() -> paths.describePersistedTaskPaths(workspaceUuid, key, List.copyOf(refs)));
        return actual.stream().map(row -> view(key, row, resolved)).toList();
    }

    private static WorkspaceInvitationService.ManagementInvitationView view(String key, Row row, Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> paths) {
        List<Intent> intents = intents(row);
        if (intents.isEmpty()) throw new WorkspaceInvitationService.InvitationStateException();
        String type = intents.getFirst().type();
        if (intents.stream().anyMatch(value -> !type.equals(value.type()))) throw new WorkspaceInvitationService.InvitationStateException();
        List<String> roleNames = intents.stream().map(Intent::roleName).toList();
        if (roleNames.isEmpty()) throw new WorkspaceInvitationService.InvitationStateException();
        String path = intents.stream().map(value -> {
            OrganizationTaskPathLookup.TaskPath task = paths.get(new OrganizationTaskPathLookup.TaskPathRef(value.type(), value.targetId()));
            if (task == null) throw new WorkspaceInvitationService.InvitationStateException();
            return task.displayPath();
        }).distinct().reduce((first, second) -> first + " ; " + second).orElseThrow(WorkspaceInvitationService.InvitationStateException::new);
        String invitationPageUrl = row.token() == null ? null : "/operations/invitations/" + key + "/" + row.token();
        return new WorkspaceInvitationService.ManagementInvitationView(row.id(), key, mask(row.mobile()), row.mobile(), row.issuer(), type, path, roleNames, row.status(), 1L, row.expires(), row.version(), row.created(), row.consented(), row.completed(), row.cancelled(), invitationPageUrl);
    }

    private static Page page(WorkspaceInvitationService.ManagementInvitationPageRequest request) {
        if (request == null || request.page() < 1 || request.pageSize() < 1 || request.pageSize() > 100) throw new WorkspaceInvitationService.InvitationValidationException();
        String sort = request.sort() == null ? "CREATED_AT" : request.sort();
        String direction = request.direction() == null ? "DESC" : request.direction();
        String order = switch (sort) { case "CREATED_AT" -> "created_at_epoch_millis"; case "EXPIRES_AT" -> "expires_at_epoch_millis"; default -> throw new WorkspaceInvitationService.InvitationValidationException(); };
        if (!Set.of("ASC", "DESC").contains(direction)) throw new WorkspaceInvitationService.InvitationValidationException();
        return new Page(order, direction, new WorkspaceInvitationService.ManagementInvitationPageRequest(request.mobile(), request.targetOrganizationType(), request.targetOrganizationRef(), request.roleId(), request.status(), request.expiresFrom(), request.expiresTo(), sort, direction, request.page(), request.pageSize()));
    }

    private static Predicate predicate(UUID workspaceUuid, String key, WorkspaceInvitationService.ManagementInvitationPageRequest request) {
        if (workspaceUuid == null || key == null || key.isBlank()) throw new WorkspaceInvitationService.InvitationValidationException();
        List<String> clauses = new ArrayList<>(List.of("i.workspace_uuid=?", "i.group_workspace_key=?"));
        List<Object> values = new ArrayList<>(List.of(workspaceUuid, key));
        String mobile = normalizedMobileQuery(request.mobile());
        if (mobile != null) { clauses.add("i.mobile_normalized LIKE ?"); values.add("%" + mobile + "%"); }
        if (request.status() != null) { clauses.add("i.status=?"); values.add(request.status()); }
        if (request.expiresFrom() != null) { clauses.add("i.expires_at_epoch_millis>=?"); values.add(request.expiresFrom()); }
        if (request.expiresTo() != null) { clauses.add("i.expires_at_epoch_millis<=?"); values.add(request.expiresTo()); }
        if (request.targetOrganizationType() != null || request.targetOrganizationRef() != null || request.roleId() != null) {
            clauses.add("EXISTS (SELECT 1 FROM workspace_iam.invitation_assignment_intent intent WHERE intent.invitation_id=i.id AND (CAST(? AS text) IS NULL OR intent.service_node_type=?) AND (CAST(? AS uuid) IS NULL OR intent.service_node_id=?) AND (CAST(? AS uuid) IS NULL OR intent.role_id=?))");
            values.add(request.targetOrganizationType()); values.add(request.targetOrganizationType()); values.add(request.targetOrganizationRef()); values.add(request.targetOrganizationRef()); values.add(request.roleId()); values.add(request.roleId());
        }
        return new Predicate(String.join(" AND ", clauses), values);
    }

    private static String pageSql(String order, String direction, String where) {
        return ("WITH filtered AS MATERIALIZED (SELECT i.id, i.mobile_normalized, i.issuer_display_name_snapshot, i.status, i.expires_at_epoch_millis, i.version, i.created_at_epoch_millis, i.consented_at_epoch_millis, i.completed_at_epoch_millis, i.cancelled_at_epoch_millis, i.invitation_token, COUNT(*) OVER () AS total FROM workspace_iam.invitation i WHERE " + where + "), paged AS (SELECT * FROM filtered ORDER BY " + order + " " + direction + ", id ASC LIMIT ? OFFSET ?), page_total AS (SELECT COALESCE(MAX(total), (SELECT COUNT(*) FROM filtered)) AS total FROM paged) SELECT paged.id,paged.mobile_normalized,paged.issuer_display_name_snapshot,paged.status,paged.expires_at_epoch_millis,paged.version,paged.created_at_epoch_millis,paged.consented_at_epoch_millis,paged.completed_at_epoch_millis,paged.cancelled_at_epoch_millis,paged.invitation_token,page_total.total,COALESCE(intents.value, '[]'::jsonb)::text AS intents FROM page_total LEFT JOIN paged ON TRUE LEFT JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('roleId', intent.role_id, 'roleName', role.name, 'type', intent.service_node_type, 'targetId', intent.service_node_id) ORDER BY intent.service_node_type, intent.service_node_id, role.name) AS value FROM workspace_iam.invitation_assignment_intent intent JOIN workspace_iam.workspace_role role ON role.id=intent.role_id WHERE intent.invitation_id=paged.id) intents ON TRUE ORDER BY paged." + order + " " + direction + ", paged.id ASC");
    }

    private static String detailSql() {
        return "SELECT i.id,i.mobile_normalized,i.issuer_display_name_snapshot,i.status,i.expires_at_epoch_millis,i.version,i.created_at_epoch_millis,i.consented_at_epoch_millis,i.completed_at_epoch_millis,i.cancelled_at_epoch_millis,i.invitation_token,1 AS total,COALESCE(intents.value, '[]'::jsonb)::text AS intents FROM workspace_iam.invitation i LEFT JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('roleId', intent.role_id, 'roleName', role.name, 'type', intent.service_node_type, 'targetId', intent.service_node_id) ORDER BY intent.service_node_type, intent.service_node_id, role.name) AS value FROM workspace_iam.invitation_assignment_intent intent JOIN workspace_iam.workspace_role role ON role.id=intent.role_id WHERE intent.invitation_id=i.id) intents ON TRUE WHERE i.workspace_uuid=? AND i.group_workspace_key=? AND i.id=?";
    }

    private Row row(ResultSet value, int ignored) throws SQLException { return new Row(value.getObject(1, UUID.class), value.getString(2), value.getString(3), value.getString(4), value.getLong(5), value.getLong(6), value.getLong(7), value.getObject(8, Long.class), value.getObject(9, Long.class), value.getObject(10, Long.class), value.getString(11), value.getLong(12), value.getString(13)); }
    private static List<Intent> intents(Row row) { try { List<Intent> values = new ArrayList<>(); JSON.readTree(row.intents()).forEach(value -> values.add(new Intent(value.path("type").asText(), UUID.fromString(value.path("targetId").asText()), value.path("roleName").asText()))); return List.copyOf(values); } catch (Exception error) { throw new WorkspaceInvitationService.InvitationStateException(); } }
    private static Object[] arguments(List<Object> values, Object... tail) { List<Object> result = new ArrayList<>(values); for (Object value : tail) result.add(value); return result.toArray(); }
    private static String normalizedMobileQuery(String value) { if (value == null || value.isBlank()) return null; String normalized = value.replace(" ", "").replace("-", ""); return normalized.startsWith("+") ? normalized.substring(1) : normalized; }
    private static String mask(String value) { return value.length() <= 4 ? "****" : value.substring(0, Math.min(3, value.length())) + "****" + value.substring(Math.max(3, value.length() - 4)); }
    private static <T> T primary(java.util.function.Supplier<T> action) { return ReadBudgetComponent.measure(ReadBudgetComponent.Component.PRIMARY_QUERY, action); }
    private record Page(String order, String direction, WorkspaceInvitationService.ManagementInvitationPageRequest criteria) { }
    private record Predicate(String where, List<Object> arguments) { }
    private record Intent(String type, UUID targetId, String roleName) { }
    private record Row(UUID id, String mobile, String issuer, String status, long expires, long version, long created, Long consented, Long completed, Long cancelled, String token, long total, String intents) { }
}
