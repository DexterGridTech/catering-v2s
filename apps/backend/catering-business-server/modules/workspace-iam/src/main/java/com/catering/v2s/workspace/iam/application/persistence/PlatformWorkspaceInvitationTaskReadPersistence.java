package com.catering.v2s.workspace.iam.application.persistence;

import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed execution boundary for the platform workspace-invitation task projection. */
@Repository
public class PlatformWorkspaceInvitationTaskReadPersistence {
    private final JdbcTemplate jdbc;

    @Autowired
    public PlatformWorkspaceInvitationTaskReadPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public PageResult page(
            UUID workspaceUuid,
            String key,
            WorkspaceInvitationService.ManagementInvitationPageRequest request) {
        Page safe = page(request);
        Predicate predicate = predicate(workspaceUuid, key, safe.criteria());
        List<Row> rows = jdbc.query(
                pageSql(safe.order(), safe.direction(), predicate.where()),
                this::row,
                arguments(
                        predicate.arguments(),
                        safe.criteria().pageSize(),
                        (safe.criteria().page() - 1) * safe.criteria().pageSize()));
        return new PageResult(rows, safe.criteria());
    }

    public List<Row> detail(UUID workspaceUuid, String key, UUID invitationId) {
        return jdbc.query(
                detailSql(),
                this::row,
                workspaceUuid,
                key,
                invitationId);
    }

    private static Page page(WorkspaceInvitationService.ManagementInvitationPageRequest request) {
        if (request == null
                || request.page() < 1
                || request.pageSize() < 1
                || request.pageSize() > 100)
            throw new WorkspaceInvitationService.InvitationValidationException();
        String sort = request.sort() == null ? "CREATED_AT" : request.sort();
        String direction = request.direction() == null
                ? PlatformWorkspaceInvitationTaskReadServiceSql.SORT_DIRECTION_DESC
                : request.direction();
        String order = switch (sort) {
            case "CREATED_AT" -> PlatformWorkspaceInvitationTaskReadServiceSql.CREATED_AT_ORDER;
            case "EXPIRES_AT" -> PlatformWorkspaceInvitationTaskReadServiceSql.EXPIRES_AT_ORDER;
            default -> throw new WorkspaceInvitationService.InvitationValidationException();
        };
        if (!List.of(
                        PlatformWorkspaceInvitationTaskReadServiceSql.SORT_DIRECTION_ASC,
                        PlatformWorkspaceInvitationTaskReadServiceSql.SORT_DIRECTION_DESC)
                .contains(direction)) throw new WorkspaceInvitationService.InvitationValidationException();
        return new Page(
                order,
                direction,
                new WorkspaceInvitationService.ManagementInvitationPageRequest(
                        request.mobile(),
                        request.targetOrganizationType(),
                        request.targetOrganizationRef(),
                        request.roleId(),
                        request.status(),
                        request.expiresFrom(),
                        request.expiresTo(),
                        sort,
                        direction,
                        request.page(),
                        request.pageSize()));
    }

    private static Predicate predicate(
            UUID workspaceUuid, String key, WorkspaceInvitationService.ManagementInvitationPageRequest request) {
        if (workspaceUuid == null || key == null || key.isBlank())
            throw new WorkspaceInvitationService.InvitationValidationException();
        List<String> clauses = new ArrayList<>(List.of(
                PlatformWorkspaceInvitationTaskReadServiceSql.INVITATION_SCOPE_WORKSPACE,
                PlatformWorkspaceInvitationTaskReadServiceSql.INVITATION_SCOPE_GROUP));
        List<Object> values = new ArrayList<>(List.of(workspaceUuid, key));
        String mobile = normalizedMobileQuery(request.mobile());
        if (mobile != null) {
            clauses.add(PlatformWorkspaceInvitationTaskReadServiceSql.INVITATION_MOBILE_LIKE);
            values.add("%" + mobile + "%");
        }
        if (request.status() != null) {
            clauses.add(PlatformWorkspaceInvitationTaskReadServiceSql.INVITATION_STATUS_FILTER);
            values.add(request.status());
        }
        if (request.expiresFrom() != null) {
            clauses.add(PlatformWorkspaceInvitationTaskReadServiceSql.INVITATION_EXPIRES_FROM_FILTER);
            values.add(request.expiresFrom());
        }
        if (request.expiresTo() != null) {
            clauses.add(PlatformWorkspaceInvitationTaskReadServiceSql.INVITATION_EXPIRES_TO_FILTER);
            values.add(request.expiresTo());
        }
        if (request.targetOrganizationType() != null
                || request.targetOrganizationRef() != null
                || request.roleId() != null) {
            clauses.add(PlatformWorkspaceInvitationTaskReadServiceSql.TARGET_ASSIGNMENT_FILTER);
            values.add(request.targetOrganizationType());
            values.add(request.targetOrganizationType());
            values.add(request.targetOrganizationRef());
            values.add(request.targetOrganizationRef());
            values.add(request.roleId());
            values.add(request.roleId());
        }
        return new Predicate(String.join(PlatformWorkspaceInvitationTaskReadServiceSql.CLAUSE_JOINER, clauses), values);
    }

    private static Object[] arguments(List<Object> predicateArguments, int pageSize, int offset) {
        Object[] values = new Object[predicateArguments.size() + 2];
        for (int index = 0; index < predicateArguments.size(); index++) values[index] = predicateArguments.get(index);
        values[predicateArguments.size()] = pageSize;
        values[predicateArguments.size() + 1] = offset;
        return values;
    }

    private static String normalizedMobileQuery(String value) {
        if (value == null || value.isBlank()) return null;
        String normalized = value.replace(" ", "").replace("-", "");
        return normalized.startsWith("+") ? normalized.substring(1) : normalized;
    }

    private static String pageSql(String order, String direction, String where) {
        return (PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_CTE_FILTERED
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_STATUS
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_CONSENTED_AT_EPOCH_MILLIS
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_COMPLETED_AT_EPOCH_MILLIS
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_TOTAL
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_FROM_CLAUSE_INVITATION_FROM_WORKSPACE_IAM_INVITATIO
                + where + PlatformWorkspaceInvitationTaskReadServiceSql.PAGE_ORDER_PREFIX + order
                + PlatformWorkspaceInvitationTaskReadServiceSql.SQL_SPACE + direction
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_VALUE_SEPARATOR_PAGE_TOTAL_TOTAL
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_PAGED_FILTERED_TOTAL
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_PAGED_ID_PAGED_MOBILE_NORMALIZED_PAGED_ISSUER_DISPLAY_NAME_SNAPSHOT_PAGED_STATUS_PAGED_EXPIRES_AT_EPOCH_MILLIS_CREATED_AT_EPOCH_MILLIS_PAGED_CONSENTED_AT_EPOCH_MILLIS_PAGED
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_COMPLETED_AT_EPOCH_MILLIS_PAGED_CANCELLED_AT_EPOCH_MILLIS_PAGED_INVITATION_TOKEN_PAGE_TOTAL_TOTAL_COALESCE_INTENTS_VALUE_LEFT_JOIN_PAGED_ON
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_LATERAL
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_ROLE_NAME_ROLE_NAME_TYPE
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_ORDER_BY_INTENT
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_WORKSPACE_ROLE
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_ROLE_INTENT_ROLE_ID_INVITATION_ID
                + order + PlatformWorkspaceInvitationTaskReadServiceSql.SQL_SPACE + direction
                + PlatformWorkspaceInvitationTaskReadServiceSql.PAGE_ORDER_SUFFIX);
    }

    private static String detailSql() {
        return PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_SELECT
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_MOBILE_NORMALIZED
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_I_CREATED_AT_EPOCH_MILLIS_I_CONSENTED_AT_EPOCH_MILLIS_I_COMPLETED_AT_EPOCH_MILLIS_I_CANCELLED_AT_EPOCH_MILLIS_I_INVITATION_TOKEN_TEXT_AS_INTENTS_FROM
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_LATERAL_ALTERNATE_A
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_INTENT_ROLE_ID_ROLE_NAME_ROLE
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_INTENT
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_VALUE
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_FROM_CLAUSE_WORKSPACE_ROLE_INTENT_ROLE
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_ROLE_INTENT_ROLE_ID_INVITATION_ID_ALTERNATE_A
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_CONDITION
                + PlatformWorkspaceInvitationTaskReadServiceSql.PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY;
    }

    private Row row(ResultSet result, int ignored) throws SQLException {
        return new Row(
                result.getObject(1, UUID.class),
                result.getString(2),
                result.getString(3),
                result.getString(4),
                result.getLong(5),
                result.getLong(6),
                result.getLong(7),
                result.getObject(8, Long.class),
                result.getObject(9, Long.class),
                result.getObject(10, Long.class),
                result.getString(11),
                result.getLong(12),
                result.getString(13));
    }

    public record Row(
            UUID id,
            String mobile,
            String issuer,
            String status,
            long expires,
            long version,
            long created,
            Long consented,
            Long completed,
            Long cancelled,
            String token,
            long total,
            String intents) {}

    private record Predicate(String where, List<Object> arguments) {}

    private record Page(
            String order, String direction, WorkspaceInvitationService.ManagementInvitationPageRequest criteria) {}

    public record PageResult(
            List<Row> rows, WorkspaceInvitationService.ManagementInvitationPageRequest criteria) {}
}
