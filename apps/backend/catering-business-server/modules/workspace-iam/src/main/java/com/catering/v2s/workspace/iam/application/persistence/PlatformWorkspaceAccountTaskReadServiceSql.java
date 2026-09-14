package com.catering.v2s.workspace.iam.application.persistence;

/** SQL text fragments owned by PlatformWorkspaceAccountTaskReadService; B3 relocates text only and does not change execution. */
public final class PlatformWorkspaceAccountTaskReadServiceSql {
    public static final String SORT_DIRECTION_ASC = "ASC";
    public static final String SORT_DIRECTION_DESC = "DESC";
    public static final String DISPLAY_NAME_ORDER = "display_name";
    public static final String LOGIN_NAME_ORDER = "login_name_normalized";
    public static final String LAST_LOGIN_ORDER = "COALESCE(last_login_at, -1)";
    public static final String UPDATED_AT_ORDER = "updated_at_epoch_millis";
    public static final String PAGED_LAST_LOGIN_ORDER = "COALESCE(paged.last_login_at, -1)";
    public static final String PAGED_ORDER_PREFIX = "paged.";
    public static final String SQL_SPACE = " ";
    public static final String PAGE_TIE_BREAKER_SUFFIX = ", paged.id ASC";
    public static final String PLATFORM_WORKSPACE_ACCOUNT_TASK_READ_SERVICE_SET = "SET";
    public static final String PLATFORM_WORKSPACE_ACCOUNT_TASK_READ_SERVICE_CTE_WORKSPACE_CREDENTIAL = """
            WITH filtered AS MATERIALIZED (
              SELECT a.id, a.display_name, a.mobile_normalized, a.login_name_normalized, a.status, a.version,
                     a.created_at_epoch_millis, a.updated_at_epoch_millis, login.last_login_at, COUNT(*) OVER () AS \
                     total
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
                                WHERE assignment.account_id=a.id AND assignment.workspace_uuid=a.workspace_uuid AND \
                                assignment.group_workspace_key=a.group_workspace_key
                                  AND (CAST(? AS text) IS NULL OR assignment.service_node_type=?)
                                  AND (CAST(? AS uuid) IS NULL OR assignment.service_node_id=?)
                                  AND (CAST(? AS uuid) IS NULL OR assignment.role_id=?)))
            ), paged AS (
              SELECT * FROM filtered ORDER BY __ORDER__ __DIRECTION__, id ASC LIMIT ? OFFSET ?
            ), page_total AS (
              SELECT COALESCE(MAX(total), (SELECT COUNT(*) FROM filtered)) AS total FROM paged
            )
            SELECT paged.id, paged.display_name, paged.mobile_normalized, paged.login_name_normalized, paged.status, \
            paged.version,
                   paged.created_at_epoch_millis, paged.updated_at_epoch_millis, page_total.total, paged.last_login_at,
                   COALESCE(assignments.value, '[]'::jsonb)::text AS assignments,
                   COALESCE(invitations.value, '[]'::jsonb)::text AS invitations,
                   '[]'::jsonb::text AS history,
                   COALESCE(credentials.password_change_required, FALSE) AS password_change_required
            FROM page_total LEFT JOIN paged ON TRUE
            LEFT JOIN LATERAL (
              SELECT jsonb_agg(jsonb_build_object('id', r.id, 'roleId', r.role_id, 'roleName', role.name, 'type', \
              r.service_node_type,
                 'ref', r.service_node_id, 'status', r.status, 'source', r.source_invitation_id, 'version', r.version,
                 'created', r.created_at_epoch_millis, 'updated', r.updated_at_epoch_millis) ORDER BY \
                 r.created_at_epoch_millis) AS value
              FROM workspace_iam.role_assignment r JOIN workspace_iam.workspace_role role ON role.id=r.role_id
              WHERE r.workspace_uuid=? AND r.group_workspace_key=? AND r.account_id=paged.id
            ) assignments ON TRUE
            LEFT JOIN LATERAL (
              SELECT jsonb_agg(jsonb_build_object('id', invitation.id, 'status', invitation.status, 'version', \
              invitation.version, 'expires', invitation.expires_at_epoch_millis) ORDER BY \
              invitation.expires_at_epoch_millis DESC) AS value
              FROM workspace_iam.invitation invitation
              WHERE invitation.workspace_uuid=? AND invitation.group_workspace_key=? AND \
              invitation.mobile_normalized=paged.mobile_normalized
            ) invitations ON TRUE
            LEFT JOIN LATERAL (
              SELECT TRUE AS password_change_required FROM workspace_iam.workspace_credential credential
              WHERE credential.account_id=paged.id AND credential.password_change_required=TRUE LIMIT 1
            ) credentials ON TRUE
            """;
    public static final String PLATFORM_WORKSPACE_ACCOUNT_TASK_READ_SERVICE_ORDER_BY = " ORDER BY ";
    public static final String PLATFORM_WORKSPACE_ACCOUNT_TASK_READ_SERVICE_SELECT_WORKSPACE_CREDENTIAL = """
            SELECT a.id, a.display_name, a.mobile_normalized, a.login_name_normalized, a.status, a.version,
                   a.created_at_epoch_millis, a.updated_at_epoch_millis, 1 AS total, login.last_login_at,
                   COALESCE(assignments.value, '[]'::jsonb)::text AS assignments,
                   COALESCE(invitations.value, '[]'::jsonb)::text AS invitations,
                   COALESCE(history.value, '[]'::jsonb)::text AS history,
                   COALESCE(credentials.password_change_required, FALSE) AS password_change_required
            FROM workspace_iam.workspace_account a
            LEFT JOIN LATERAL (SELECT MAX(authenticated_at_epoch_millis) AS last_login_at FROM \
            workspace_iam.workspace_authentication_history WHERE workspace_uuid=? AND group_workspace_key=? AND \
            account_id=a.id) login ON TRUE
            LEFT JOIN LATERAL (
              SELECT jsonb_agg(jsonb_build_object('id', r.id, 'roleId', r.role_id, 'roleName', role.name, 'type', \
              r.service_node_type,
                 'ref', r.service_node_id, 'status', r.status, 'source', r.source_invitation_id, 'version', r.version,
                 'created', r.created_at_epoch_millis, 'updated', r.updated_at_epoch_millis) ORDER BY \
                 r.created_at_epoch_millis) AS value
              FROM workspace_iam.role_assignment r JOIN workspace_iam.workspace_role role ON role.id=r.role_id
              WHERE r.workspace_uuid=? AND r.group_workspace_key=? AND r.account_id=a.id
            ) assignments ON TRUE
            LEFT JOIN LATERAL (
              SELECT jsonb_agg(jsonb_build_object('id', invitation.id, 'status', invitation.status, 'version', \
              invitation.version, 'expires', invitation.expires_at_epoch_millis) ORDER BY \
              invitation.expires_at_epoch_millis DESC) AS value
              FROM workspace_iam.invitation invitation WHERE invitation.workspace_uuid=? AND \
              invitation.group_workspace_key=? AND invitation.mobile_normalized=a.mobile_normalized
            ) invitations ON TRUE
            LEFT JOIN LATERAL (
              SELECT jsonb_agg(jsonb_build_object('id', value.id, 'authenticatedAt', \
              value.authenticated_at_epoch_millis) ORDER BY value.authenticated_at_epoch_millis DESC, value.id DESC) \
              AS value
              FROM (SELECT id, authenticated_at_epoch_millis FROM workspace_iam.workspace_authentication_history WHERE \
              workspace_uuid=? AND group_workspace_key=? AND account_id=a.id ORDER BY authenticated_at_epoch_millis \
              DESC, id DESC LIMIT 10) value
            ) history ON TRUE
            LEFT JOIN LATERAL (SELECT TRUE AS password_change_required FROM workspace_iam.workspace_credential \
            credential WHERE credential.account_id=a.id AND credential.password_change_required=TRUE LIMIT 1) \
            credentials ON TRUE
            WHERE a.workspace_uuid=? AND a.group_workspace_key=? AND a.id=?
            """;
}
