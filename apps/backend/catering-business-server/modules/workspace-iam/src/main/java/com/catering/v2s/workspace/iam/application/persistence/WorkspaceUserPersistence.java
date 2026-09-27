package com.catering.v2s.workspace.iam.application.persistence;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed persistence boundary for workspace user task reads and their fixed projections. */
@Repository
public class WorkspaceUserPersistence {
    private final JdbcTemplate jdbc;

    public WorkspaceUserPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public AccountPageRows page(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetType,
            UUID organizationRef,
            String userName,
            String mobile,
            String loginName,
            UUID roleId,
            String status,
            String sort,
            String direction,
            int page,
            int pageSize) {
        String joins = WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_FROM_CLAUSE_WORKSPACE_ACCOUNT_ACCOUNT_ID
                + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_AUTHENTICATED_AT_EPOCH_MILLIS_LAST_LOGIN_AT
                + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_WORKSPACE_AUTHENTICATION_HISTORY
                + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_GROUP_BY_ACCOUNT_ID_LOGIN;
        String where =
                WorkspaceUserServiceSql
                                .WORKSPACE_USER_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_TEXT_DISPLAY_NAME
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_ILIKE_TEXT_MOBILE_NORMALIZED
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_SQL_PUNCTUATION
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_TEXT_LOGIN_NAME_NORMALIZED_ILIKE
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_OPEN_PAREN
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_TEXT_STATUS
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_CONDITION
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_ROLE_ASSIGNMENT_ASSIGNMENT
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_WHERE_ASSIGNMENT_ACCOUNT_ID_WORKSPACE_UUID
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_ASSIGNMENT_GROUP_WORKSPACE_KEY_TEXT
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_ASSIGNMENT_SERVICE_NODE_TYPE
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_ASSIGNMENT_SERVICE_NODE_ID
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_CONDITION_ASSIGNMENT_ROLE_ID;
        Object[] predicateArguments = predicateArguments(
                workspaceUuid,
                groupWorkspaceKey,
                userName,
                mobile,
                loginName,
                status,
                targetType,
                organizationRef,
                roleId);
        long total = jdbc.queryForObject(
                WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_SELECT_SELECT_COUNT + joins + where,
                Long.class,
                predicateArguments);
        List<Object> pageArguments = new ArrayList<>(java.util.Arrays.asList(predicateArguments));
        pageArguments.add(pageSize);
        pageArguments.add((page - 1) * pageSize);
        List<UUID> ids = jdbc.query(
                WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_SELECT_SELECT_A_ID
                        + joins
                        + where
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_ORDER_BY
                        + orderColumn(sort)
                        + WorkspaceUserServiceSql.SQL_SPACE
                        + direction
                        + WorkspaceUserServiceSql.ACCOUNT_PAGE_ORDER_SUFFIX,
                (row, index) -> row.getObject(1, UUID.class),
                pageArguments.toArray());
        return new AccountPageRows(List.copyOf(ids), total);
    }

    public List<AccountRow> accounts(UUID workspaceUuid, String groupWorkspaceKey, Set<UUID> accountIds) {
        if (accountIds.isEmpty()) return List.of();
        return jdbc.query(
                WorkspaceUserServiceSql.SELECT_DISP_NAME_MOBILE_NORMALIZED_001
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_WORKSPACE_ACCOUNT
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + placeholders(accountIds.size())
                        + WorkspaceUserServiceSql.SQL_CLOSE_PAREN,
                (row, index) -> new AccountRow(
                        row.getObject(1, UUID.class),
                        row.getString(2),
                        row.getString(3),
                        row.getString(4),
                        row.getString(5),
                        row.getLong(6),
                        row.getLong(7),
                        row.getLong(8)),
                arguments(workspaceUuid, groupWorkspaceKey, accountIds));
    }

    public List<AssignmentRow> assignments(UUID workspaceUuid, String groupWorkspaceKey, Set<UUID> accountIds) {
        if (accountIds.isEmpty()) return List.of();
        return jdbc.query(
                WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_SELECT_ACCOUNT_ID_ROLE_ID_ROLE_NAME
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_SOURCE_INVITATION_ID
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_FROM_CLAUSE
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_WORKSPACE_ROLE_ROLE_ASSIGNMENT_ROLE_ROLE_ID
                        + WorkspaceUserServiceSql
                                .WORKSPACE_USER_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ACCOUNT_ID
                        + placeholders(accountIds.size())
                        + WorkspaceUserServiceSql.ASSIGNMENT_ORDER_SUFFIX,
                (row, index) -> new AssignmentRow(
                        row.getObject(1, UUID.class),
                        row.getObject(2, UUID.class),
                        row.getObject(3, UUID.class),
                        row.getString(4),
                        row.getString(5),
                        row.getObject(6, UUID.class),
                        row.getString(7),
                        row.getObject(8, UUID.class),
                        row.getLong(9),
                        row.getLong(10),
                        row.getLong(11)),
                arguments(workspaceUuid, groupWorkspaceKey, accountIds));
    }

    public List<AuthenticationLatestRow> latestAuthentication(
            UUID workspaceUuid, String groupWorkspaceKey, Set<UUID> accountIds) {
        if (accountIds.isEmpty()) return List.of();
        return jdbc.query(
                WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_SELECT_ACCOUNT_ID_AUTHENTICATED_AT_EPOCH_MILLIS
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_WORKSPACE_AUTHENTICATION_HISTORY_WORKSPACE_UUID
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_GROUP_WORKSPACE_KEY
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_CONDITION_ACCOUNT_ID
                        + placeholders(accountIds.size())
                        + WorkspaceUserServiceSql.LATEST_AUTHENTICATION_ORDER_SUFFIX,
                (row, index) -> new AuthenticationLatestRow(row.getObject(1, UUID.class), row.getLong(2)),
                arguments(workspaceUuid, groupWorkspaceKey, accountIds));
    }

    public List<AuthenticationHistoryRow> authenticationHistory(
            UUID workspaceUuid, String groupWorkspaceKey, Set<UUID> accountIds) {
        if (accountIds.isEmpty()) return List.of();
        return jdbc.query(
                WorkspaceUserServiceSql
                                .WORKSPACE_USER_SERVICE_SELECT_ACCOUNT_ID_AUTHENTICATED_AT_EPOCH_MILLIS_ALTERNATE_A
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_AUTHENTICATED_AT_EPOCH_MILLIS_ACCOUNT_ID
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_AUTHENTICATED_AT_EPOCH_MILLIS
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_WORKSPACE_AUTHENTICATION_HISTORY_ALTERNATE_A
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_CONDITION_ACCOUNT_ID_ALTERNATE_A
                        + placeholders(accountIds.size())
                        + WorkspaceUserServiceSql.AUTHENTICATION_HISTORY_ORDER_SUFFIX,
                (row, index) -> new AuthenticationHistoryRow(
                        row.getObject(1, UUID.class), row.getObject(2, UUID.class), row.getLong(3)),
                arguments(workspaceUuid, groupWorkspaceKey, accountIds));
    }

    public List<MobileInvitationRow> invitations(UUID workspaceUuid, String groupWorkspaceKey, Set<String> mobiles) {
        if (mobiles.isEmpty()) return List.of();
        return jdbc.query(
                WorkspaceUserServiceSql.SELECT_INVITE_MOBILE_NORMALIZED_STATUS_002
                        + WorkspaceUserServiceSql
                                .WORKSPACE_USER_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_MOBILE_NORMALIZED
                        + placeholders(mobiles.size())
                        + WorkspaceUserServiceSql.INVITATION_ORDER_SUFFIX,
                (row, index) -> new MobileInvitationRow(
                        row.getString(1),
                        row.getObject(2, UUID.class),
                        row.getString(3),
                        Math.toIntExact(row.getLong(4)),
                        row.getLong(5)),
                arguments(workspaceUuid, groupWorkspaceKey, mobiles));
    }

    public Set<UUID> pendingCredentialAccounts(Set<UUID> accountIds) {
        if (accountIds.isEmpty()) return Set.of();
        return Set.copyOf(jdbc.query(
                WorkspaceUserServiceSql
                                .WORKSPACE_USER_SERVICE_SELECT_WORKSPACE_CREDENTIAL_ACCOUNT_ID_PASSWORD_CHANGE_REQUIRED
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_ACCOUNT_ID
                        + placeholders(accountIds.size())
                        + WorkspaceUserServiceSql.SQL_CLOSE_PAREN,
                (row, index) -> row.getObject(1, UUID.class),
                accountIds.toArray()));
    }

    public List<InvitationTargetRow> invitationTargets(List<UUID> invitationIds) {
        LinkedHashSet<UUID> ids = new LinkedHashSet<>(invitationIds);
        if (ids.isEmpty()) return List.of();
        return jdbc.query(
                WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_SELECT_INVITATION_ID_SERVICE_NODE_TYPE_SERVICE_NODE_ID
                        + WorkspaceUserServiceSql.WORKSPACE_USER_SERVICE_INVITATION_ASSIGNMENT_INTENT_INVITATION_ID
                        + placeholders(ids.size())
                        + WorkspaceUserServiceSql.SQL_CLOSE_PAREN,
                (row, index) -> new InvitationTargetRow(
                        row.getObject(1, UUID.class), row.getString(2), row.getObject(3, UUID.class)),
                ids.toArray());
    }

    private static Object[] predicateArguments(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String userName,
            String mobile,
            String loginName,
            String status,
            String targetType,
            UUID organizationRef,
            UUID roleId) {
        return new Object[] {
            workspaceUuid,
            groupWorkspaceKey,
            workspaceUuid,
            groupWorkspaceKey,
            userName,
            userName,
            mobile,
            mobile,
            loginName,
            loginName,
            status,
            status,
            targetType,
            organizationRef,
            roleId,
            targetType,
            targetType,
            organizationRef,
            organizationRef,
            roleId,
            roleId
        };
    }

    private static String orderColumn(String sort) {
        return switch (sort) {
            case "DISPLAY_NAME" -> WorkspaceUserServiceSql.DISPLAY_NAME_ORDER;
            case "LOGIN_NAME" -> WorkspaceUserServiceSql.LOGIN_NAME_ORDER;
            case "LAST_LOGIN_AT" -> WorkspaceUserServiceSql.LAST_LOGIN_ORDER;
            case "UPDATED_AT" -> WorkspaceUserServiceSql.UPDATED_AT_ORDER;
            default -> throw new IllegalArgumentException("unsupported account page sort");
        };
    }

    private static String placeholders(int count) {
        return String.join(
                WorkspaceUserServiceSql.PLACEHOLDER_SEPARATOR,
                java.util.Collections.nCopies(count, WorkspaceUserServiceSql.PARAMETER_PLACEHOLDER));
    }

    private static Object[] arguments(UUID workspaceUuid, String key, Collection<?> ids) {
        List<Object> values = new ArrayList<>();
        values.add(workspaceUuid);
        values.add(key);
        values.addAll(ids);
        return values.toArray();
    }

    public record AccountPageRows(List<UUID> accountIds, long total) {}

    public record AccountRow(
            UUID id,
            String displayName,
            String mobile,
            String loginName,
            String status,
            long version,
            long createdAt,
            long updatedAt) {}

    public record AssignmentRow(
            UUID id,
            UUID accountId,
            UUID roleId,
            String roleName,
            String serviceNodeType,
            UUID serviceNodeId,
            String status,
            UUID sourceInvitationId,
            long revision,
            long createdAt,
            long updatedAt) {}

    public record AuthenticationLatestRow(UUID accountId, long authenticatedAt) {}

    public record AuthenticationHistoryRow(UUID accountId, UUID id, long authenticatedAt) {}

    public record MobileInvitationRow(
            String mobile, UUID invitationId, String status, int generation, long expiresAt) {}

    public record InvitationTargetRow(UUID invitationId, String serviceNodeType, UUID serviceNodeId) {}
}
