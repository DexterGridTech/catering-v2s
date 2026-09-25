package com.catering.v2s.workspace.iam.application.persistence;

import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed execution boundary for the platform workspace-account task projection. */
@Repository
public class PlatformWorkspaceAccountTaskReadPersistence {
    private final JdbcTemplate jdbc;

    @Autowired
    public PlatformWorkspaceAccountTaskReadPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Row> page(WorkspaceUserService.AccountPageQuery query, String sort, String direction) {
        return jdbc.query(pageSql(orderColumn(sort), direction), this::row, pageArguments(query));
    }

    public List<Row> detail(WorkspaceUserService.AccountDetailQuery query) {
        return jdbc.query(
                PlatformWorkspaceAccountTaskReadServiceSql
                        .PLATFORM_WORKSPACE_ACCOUNT_TASK_READ_SERVICE_SELECT_WORKSPACE_CREDENTIAL,
                this::row,
                query.workspaceUuid(),
                query.groupWorkspaceKey(),
                query.workspaceUuid(),
                query.groupWorkspaceKey(),
                query.workspaceUuid(),
                query.groupWorkspaceKey(),
                query.workspaceUuid(),
                query.groupWorkspaceKey(),
                query.workspaceUuid(),
                query.groupWorkspaceKey(),
                query.accountId());
    }

    private static Object[] pageArguments(WorkspaceUserService.AccountPageQuery value) {
        return new Object[] {
            value.workspaceUuid(),
            value.groupWorkspaceKey(),
            value.workspaceUuid(),
            value.groupWorkspaceKey(),
            value.userName(),
            value.userName(),
            value.mobile(),
            value.mobile(),
            value.loginName(),
            value.loginName(),
            value.status(),
            value.status(),
            value.targetType(),
            value.organizationRef(),
            value.roleId(),
            value.targetType(),
            value.targetType(),
            value.organizationRef(),
            value.organizationRef(),
            value.roleId(),
            value.roleId(),
            value.pageSize(),
            (value.page() - 1) * value.pageSize(),
            value.workspaceUuid(),
            value.groupWorkspaceKey(),
            value.workspaceUuid(),
            value.groupWorkspaceKey()
        };
    }

    private static String pageSql(String order, String direction) {
        return PlatformWorkspaceAccountTaskReadServiceSql
                        .PLATFORM_WORKSPACE_ACCOUNT_TASK_READ_SERVICE_CTE_WORKSPACE_CREDENTIAL
                        .replace("__ORDER__", order)
                        .replace("__DIRECTION__", direction)
                + PlatformWorkspaceAccountTaskReadServiceSql.PLATFORM_WORKSPACE_ACCOUNT_TASK_READ_SERVICE_ORDER_BY
                + (PlatformWorkspaceAccountTaskReadServiceSql.LAST_LOGIN_ORDER.equals(order)
                        ? PlatformWorkspaceAccountTaskReadServiceSql.PAGED_LAST_LOGIN_ORDER
                        : PlatformWorkspaceAccountTaskReadServiceSql.PAGED_ORDER_PREFIX + order)
                + PlatformWorkspaceAccountTaskReadServiceSql.SQL_SPACE
                + direction
                + PlatformWorkspaceAccountTaskReadServiceSql.PAGE_TIE_BREAKER_SUFFIX;
    }

    private static String orderColumn(String sort) {
        return switch (sort) {
            case "DISPLAY_NAME" -> PlatformWorkspaceAccountTaskReadServiceSql.DISPLAY_NAME_ORDER;
            case "LOGIN_NAME" -> PlatformWorkspaceAccountTaskReadServiceSql.LOGIN_NAME_ORDER;
            case "LAST_LOGIN_AT" -> PlatformWorkspaceAccountTaskReadServiceSql.LAST_LOGIN_ORDER;
            case "UPDATED_AT" -> PlatformWorkspaceAccountTaskReadServiceSql.UPDATED_AT_ORDER;
            default -> throw new IllegalArgumentException("unsupported workspace account sort");
        };
    }

    private Row row(ResultSet result, int ignored) throws SQLException {
        return new Row(
                result.getObject(1, UUID.class),
                result.getString(2),
                result.getString(3),
                result.getString(4),
                result.getString(5),
                result.getLong(6),
                result.getLong(7),
                result.getLong(8),
                result.getLong(9),
                result.getObject(10, Long.class),
                result.getString(11),
                result.getString(12),
                result.getString(13),
                result.getBoolean(14));
    }

    public record Row(
            UUID id,
            String displayName,
            String mobile,
            String loginName,
            String status,
            long version,
            long createdAt,
            long updatedAt,
            long total,
            Long lastLoginAt,
            String assignments,
            String invitations,
            String history,
            boolean passwordChangeRequired) {}
}
