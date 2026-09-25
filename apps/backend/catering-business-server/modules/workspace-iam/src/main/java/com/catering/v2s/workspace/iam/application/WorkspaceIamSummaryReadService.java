package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.platform.workspace.api.WorkspaceIamSummaryLookup;
import com.catering.v2s.workspace.iam.application.persistence.WorkspaceIamSummaryReadPersistence;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Workspace-IAM owner read service for the platform-workspace summary port. */
@Service
public class WorkspaceIamSummaryReadService implements WorkspaceIamSummaryLookup {
    private final WorkspaceIamSummaryReadPersistence persistence;

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceIamSummaryReadService(WorkspaceIamSummaryReadPersistence persistence) {
        this.persistence = persistence;
    }

    public WorkspaceIamSummaryReadService(org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this(new WorkspaceIamSummaryReadPersistence(jdbc));
    }

    @Override
    @Transactional(readOnly = true)
    public AccountAndRoleSummary accountAndRoleSummary(UUID workspaceUuid) {
        return persistence.accountAndRoleSummary(workspaceUuid);
    }

    @Override
    @Transactional(readOnly = true)
    public long accountCount(UUID workspaceUuid) {
        return persistence.accountCount(workspaceUuid);
    }

    @Override
    @Transactional(readOnly = true)
    public long roleCount(UUID workspaceUuid) {
        return persistence.roleCount(workspaceUuid);
    }
}
