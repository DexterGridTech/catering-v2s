package com.catering.v2s.platform.workspace.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.api.CommercialGroupReadback;
import com.catering.v2s.organization.api.InitializeCommercialGroupCommand;
import com.catering.v2s.platform.access.PlatformExecutionContext;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.workspace.api.GroupWorkspaceDetail;
import com.catering.v2s.platform.workspace.api.GroupWorkspaceSummary;
import com.catering.v2s.platform.workspace.api.GroupWorkspaceTaskQuery;
import com.catering.v2s.platform.workspace.api.PlatformWorkspaceCoordinator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlatformWorkspaceService implements GroupWorkspaceTaskQuery, PlatformWorkspaceCoordinator {
    private final GroupWorkspaceRepository repository;
    private final InitializeCommercialGroupCommand initializeCommercialGroupCommand;
    private final TimeProvider time;

    public PlatformWorkspaceService(
            GroupWorkspaceRepository repository,
            InitializeCommercialGroupCommand initializeCommercialGroupCommand,
            TimeProvider time) {
        this.repository = repository;
        this.initializeCommercialGroupCommand = initializeCommercialGroupCommand;
        this.time = time;
    }

    @Override
    @Transactional(readOnly = true)
    public List<GroupWorkspaceSummary> list(PlatformExecutionContext context, String name, String groupWorkspaceKey) {
        return repository.list(context, name, groupWorkspaceKey);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<GroupWorkspaceDetail> detail(PlatformExecutionContext context, String groupWorkspaceKey) {
        return repository.detail(context, groupWorkspaceKey);
    }

    @Override
    @Transactional
    public CommercialGroupReadback initializeCommercialGroup(
            PlatformExecutionContext context,
            String groupWorkspaceKey,
            String idempotencyKey,
            String commercialGroupCode,
            String commercialGroupName,
            Map<String, String> extensionValues,
            AuditActor actor) {
        GroupWorkspaceDetail workspace = repository
                .detail(context, groupWorkspaceKey)
                .orElseThrow(() -> new GroupWorkspaceNotFoundException(groupWorkspaceKey));
        if (!"ENABLED".equals(workspace.workspaceStatus())) {
            throw new GroupWorkspaceNotEligibleException(groupWorkspaceKey);
        }
        return initializeCommercialGroupCommand.execute(
                context,
                workspace.workspaceUuid(),
                workspace.groupWorkspaceKey(),
                workspace.id(),
                idempotencyKey,
                commercialGroupCode,
                commercialGroupName,
                extensionValues,
                actor);
    }

    public static final class GroupWorkspaceNotFoundException extends RuntimeException {
        public GroupWorkspaceNotFoundException(String groupWorkspaceKey) {
            super(groupWorkspaceKey);
        }
    }

    public static final class GroupWorkspaceNotEligibleException extends RuntimeException {
        public GroupWorkspaceNotEligibleException(String groupWorkspaceKey) {
            super(groupWorkspaceKey);
        }
    }
}
