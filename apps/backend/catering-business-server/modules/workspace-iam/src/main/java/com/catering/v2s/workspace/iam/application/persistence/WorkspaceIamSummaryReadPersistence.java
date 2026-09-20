package com.catering.v2s.workspace.iam.application.persistence;

import com.catering.v2s.platform.workspace.api.WorkspaceIamSummaryLookup;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed execution boundary for workspace-IAM summary reads. */
@Repository
public class WorkspaceIamSummaryReadPersistence {
    private final JdbcTemplate jdbc;

    @Autowired
    public WorkspaceIamSummaryReadPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public WorkspaceIamSummaryLookup.AccountAndRoleSummary accountAndRoleSummary(UUID workspaceUuid) {
        return jdbc.queryForObject(
                WorkspaceIamSummaryReadServiceSql.WORKSPACE_IAM_SUMMARY_READ_SERVICE_SELECT_WORKSPACE_ACCOUNT_WORKSPACE_UUID
                        + WorkspaceIamSummaryReadServiceSql.WORKSPACE_IAM_SUMMARY_READ_SERVICE_ACCOUNT_COUNT
                        + WorkspaceIamSummaryReadServiceSql.WORKSPACE_IAM_SUMMARY_READ_SERVICE_OPEN_PAREN_WORKSPACE_ROLE_WORKSPACE_UUID_ROLE_COUNT,
                (result, row) -> new WorkspaceIamSummaryLookup.AccountAndRoleSummary(
                        result.getLong("account_count"), result.getLong("role_count")),
                workspaceUuid,
                workspaceUuid);
    }

    public long accountCount(UUID workspaceUuid) {
        Long count = jdbc.queryForObject(
                WorkspaceIamSummaryReadServiceSql.WORKSPACE_IAM_SUMMARY_READ_SERVICE_SELECT_WORKSPACE_ACCOUNT_WORKSPACE_UUID_ALTERNATE_A, Long.class, workspaceUuid);
        return count == null ? 0L : count;
    }

    public long roleCount(UUID workspaceUuid) {
        Long count = jdbc.queryForObject(
                WorkspaceIamSummaryReadServiceSql.WORKSPACE_IAM_SUMMARY_READ_SERVICE_SELECT_WORKSPACE_ROLE_WORKSPACE_UUID, Long.class, workspaceUuid);
        return count == null ? 0L : count;
    }
}
