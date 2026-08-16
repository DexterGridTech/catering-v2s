package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.platform.workspace.api.WorkspaceIamSummaryLookup;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Workspace-IAM owner read service for the platform-workspace summary port. */
@Service
public class WorkspaceIamSummaryReadService implements WorkspaceIamSummaryLookup {
    private final JdbcTemplate jdbc;

    public WorkspaceIamSummaryReadService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(readOnly = true)
    public AccountAndRoleSummary accountAndRoleSummary(UUID workspaceUuid) {
        return jdbc.queryForObject(
                "SELECT (SELECT count(*) FROM workspace_iam.workspace_account WHERE workspace_uuid=?) AS "
                        + "account_count, "
                        + "(SELECT count(*) FROM workspace_iam.workspace_role WHERE workspace_uuid=?) AS role_count",
                (result, row) ->
                        new AccountAndRoleSummary(result.getLong("account_count"), result.getLong("role_count")),
                workspaceUuid,
                workspaceUuid);
    }

    @Override
    @Transactional(readOnly = true)
    public long accountCount(UUID workspaceUuid) {
        return jdbc.queryForObject(
                "SELECT count(*) FROM workspace_iam.workspace_account WHERE workspace_uuid=?",
                Long.class,
                workspaceUuid);
    }

    @Override
    @Transactional(readOnly = true)
    public long roleCount(UUID workspaceUuid) {
        return jdbc.queryForObject(
                "SELECT count(*) FROM workspace_iam.workspace_role WHERE workspace_uuid=?", Long.class, workspaceUuid);
    }
}
