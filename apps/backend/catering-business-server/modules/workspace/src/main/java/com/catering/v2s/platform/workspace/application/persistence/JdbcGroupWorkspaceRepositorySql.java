package com.catering.v2s.platform.workspace.application.persistence;

/** SQL text owned by JdbcGroupWorkspaceRepository; B3 relocates text without changing execution. */
public final class JdbcGroupWorkspaceRepositorySql {
    public static final String LIST =
            """
            SELECT gw.group_workspace_key, gw.name,
                   CASE WHEN cg.id IS NULL THEN 'NOT_INITIALIZED' ELSE 'INITIALIZED' END AS commercial_group_status
              FROM platform_workspace.group_workspace gw
              LEFT JOIN organization.commercial_group cg
                ON cg.group_workspace_key = gw.group_workspace_key AND cg.group_workspace_id = gw.id
             WHERE (CAST(? AS VARCHAR) IS NULL OR gw.name ILIKE '%' || CAST(? AS VARCHAR) || '%')
               AND (CAST(? AS VARCHAR) IS NULL OR gw.group_workspace_key = CAST(? AS VARCHAR))
             ORDER BY gw.name, gw.group_workspace_key
            """;
    public static final String DETAIL =
            """
            SELECT gw.id, gw.workspace_uuid, gw.group_workspace_key, gw.name, gw.status AS workspace_status,
                   CASE WHEN cg.id IS NULL THEN 'NOT_INITIALIZED' ELSE 'INITIALIZED' END AS commercial_group_status,
                   cg.id AS commercial_group_id, cg.commercial_group_code, cg.commercial_group_name,
                   cg.extension_values::text AS commercial_group_extension_values, cg.extension_rule_revision,
                   cg.version, cg.created_at_epoch_millis
              FROM platform_workspace.group_workspace gw
              LEFT JOIN organization.commercial_group cg
                ON cg.group_workspace_key = gw.group_workspace_key AND cg.group_workspace_id = gw.id
             WHERE gw.group_workspace_key = ?
            """;
}
