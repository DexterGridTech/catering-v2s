package com.catering.v2s.workspace.iam.application.persistence;

/**
 * SQL text fragments owned by PlatformWorkspaceInvitationTaskReadService; B3 relocates text only and does not change
 * execution.
 */
public final class PlatformWorkspaceInvitationTaskReadServiceSql {
    public static final String SORT_DIRECTION_ASC = "ASC";
    public static final String SORT_DIRECTION_DESC = "DESC";
    public static final String CREATED_AT_ORDER = "created_at_epoch_millis";
    public static final String EXPIRES_AT_ORDER = "expires_at_epoch_millis";
    public static final String SQL_SPACE = " ";
    public static final String PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_CTE_FILTERED =
            "WITH filtered AS MATERIALIZED (SELECT i.id, i.mobile_normalized, i.issuer_display_name_snapshot, ";
    public static final String PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_STATUS =
            "i.status, i.expires_at_epoch_millis, i.version, i.created_at_epoch_millis, ";
    public static final String PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_CONSENTED_AT_EPOCH_MILLIS =
            "i.consented_at_epoch_millis, ";
    public static final String PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_COMPLETED_AT_EPOCH_MILLIS =
            "i.completed_at_epoch_millis, i.cancelled_at_epoch_millis, i.invitation_token, COUNT(*) OVER () AS ";
    public static final String PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_TOTAL = "total ";
    public static final String FROM_CLAUSE_INVITE_FROM_WS_001 = "FROM workspace_iam.invitation i WHERE ";
    public static final String PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_VALUE_SEPARATOR_PAGE_TOTAL_TOTAL =
            ", id ASC LIMIT ? OFFSET ?), page_total AS (SELECT COALESCE(MAX(total), (SELECT COUNT(*) FROM ";
    public static final String PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_PAGED_FILTERED_TOTAL =
            "filtered)) AS total FROM paged) SELECT ";

    public static final String PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_LATERAL =
            "TRUE LEFT JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('roleId', intent.role_id, ";
    public static final String PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_ROLE_NAME_ROLE_NAME_TYPE =
            "'roleName', role.name, 'type', intent.service_node_type, 'targetId', intent.service_node_id) ";
    public static final String PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_ORDER_BY_INTENT =
            "ORDER BY intent.service_node_type, intent.service_node_id, role.name) AS value FROM ";
    public static final String PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_WORKSPACE_ROLE =
            "workspace_iam.invitation_assignment_intent intent JOIN workspace_iam.workspace_role role ON ";
    public static final String PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_ROLE_INTENT_ROLE_ID_INVITATION_ID =
            "role.id=intent.role_id WHERE intent.invitation_id=paged.id) intents ON TRUE ORDER BY paged.";
    public static final String PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_SELECT = "SELECT ";
    public static final String PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_MOBILE_NORMALIZED =
            "i.id,i.mobile_normalized,i.issuer_display_name_snapshot,i.status,i.expires_at_epoch_millis,i.version";
    public static final String PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_VALUE_SEPARATOR_I_C = ",i.c";

    public static final String PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_LATERAL_ALTERNATE_A =
            "workspace_iam.invitation i LEFT JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('roleId', ";
    public static final String PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_INTENT_ROLE_ID_ROLE_NAME_ROLE =
            "intent.role_id, 'roleName', role.name, 'type', intent.service_node_type, 'targetId', ";
    public static final String PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_INTENT =
            "intent.service_node_id) ORDER BY intent.service_node_type, intent.service_node_id, role.name) AS ";
    public static final String PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_VALUE = "value ";
    public static final String PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_FROM_CLAUSE_WORKSPACE_ROLE_INTENT_ROLE =
            "FROM workspace_iam.invitation_assignment_intent intent JOIN workspace_iam.workspace_role role ON ";
    public static final String
            PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_ROLE_INTENT_ROLE_ID_INVITATION_ID_ALTERNATE_A =
                    "role.id=intent.role_id WHERE intent.invitation_id=i.id) intents ON TRUE WHERE i.workspace_uuid=? ";
    public static final String PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_CONDITION = "AND ";
    public static final String PLATFORM_WORKSPACE_INVITATION_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY =
            "i.group_workspace_key=? AND i.id=?";
    public static final String INVITATION_SCOPE_WORKSPACE = "i.workspace_uuid=?";
    public static final String INVITATION_SCOPE_GROUP = "i.group_workspace_key=?";
    public static final String INVITATION_MOBILE_LIKE = "i.mobile_normalized LIKE ?";
    public static final String INVITATION_STATUS_FILTER = "i.status=?";
    public static final String INVITATION_EXPIRES_FROM_FILTER = "i.expires_at_epoch_millis>=?";
    public static final String INVITATION_EXPIRES_TO_FILTER = "i.expires_at_epoch_millis<=?";
    public static final String TARGET_ASSIGNMENT_FILTER =
            "EXISTS (SELECT 1 FROM workspace_iam.invitation_assignment_intent intent WHERE "
                    + "intent.invitation_id=i.id AND (CAST(? AS text) IS NULL OR intent.service_node_type=?) AND "
                    + "(CAST(? AS uuid) IS NULL OR intent.service_node_id=?) AND (CAST(? AS uuid) IS NULL OR "
                    + "intent.role_id=?))";
    public static final String PAGE_ORDER_PREFIX = "), paged AS (SELECT * FROM filtered ORDER BY ";
    public static final String PAGE_ORDER_SUFFIX = ", paged.id ASC";
    public static final String CLAUSE_JOINER = " AND ";
    public static final String PAGED_ID_PAGED_MOBILE_NORMALIZED_002 =
            """
    paged.id,paged.mobile_normalized,paged.issuer_display_name_snapsho\
    t,paged.status,paged.expires_at_epoch_millis,paged.version,paged.c\
    reated_at_epoch_millis,paged.consented_at_epoch_millis,paged""";
    public static final String COMPLETED_AT_EPOCH_MS_PAGED_003 =
            """
    .completed_at_epoch_millis,paged.cancelled_at_epoch_millis,paged.i\
    nvitation_token,page_total.total,COALESCE(intents.value, '[]'::jso\
    nb)::text AS intents FROM page_total LEFT JOIN paged ON\s""";
    public static final String I_CREATED_AT_EPOCH_MS_004 =
            """
    ,i.created_at_epoch_millis,i.consented_at_epoch_millis,i.completed\
    _at_epoch_millis,i.cancelled_at_epoch_millis,i.invitation_token,1 \
    AS total,COALESCE(intents.value, '[]'::jsonb)::text AS intents FRO\
    M\s""";
}
