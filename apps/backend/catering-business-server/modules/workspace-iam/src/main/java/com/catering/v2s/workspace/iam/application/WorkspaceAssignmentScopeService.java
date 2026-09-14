package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.workspace.iam.application.persistence.WorkspaceAssignmentScopePersistence;
import com.catering.v2s.organization.api.WorkspaceAssignmentScopeLookup;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkspaceAssignmentScopeService implements WorkspaceAssignmentScopeLookup {
    private final WorkspaceAssignmentScopePersistence persistence;

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceAssignmentScopeService(WorkspaceAssignmentScopePersistence persistence) {
        this.persistence = persistence;
    }

    public WorkspaceAssignmentScopeService(org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this(new WorkspaceAssignmentScopePersistence(jdbc));
    }

    @Override
    @Transactional(readOnly = true)
    public AssignmentScope requireActiveScope(UUID workspaceUuid, String groupWorkspaceKey, UUID assignmentId) {
        AssignmentScope scope = persistence.findActiveScope(workspaceUuid, groupWorkspaceKey, assignmentId);
        if (scope == null) throw new AssignmentScopeNotFoundException();
        return scope;
    }

    public static final class AssignmentScopeNotFoundException extends RuntimeException {}
}
