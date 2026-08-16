package com.catering.v2s.app.edge.platform.workspaceiam;

import com.catering.v2s.app.edge.generated.wire.PlatformWorkspaceInvitationPage;
import com.catering.v2s.app.edge.generated.wire.PlatformWorkspaceInvitationPageCriteria;
import com.catering.v2s.app.edge.generated.wire.ServiceNodeType;
import com.catering.v2s.app.edge.generated.wire.SortDirection;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationSortKey;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationStatus;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;

public final class PlatformWorkspaceInvitationPageWireMapper {
    private PlatformWorkspaceInvitationPageWireMapper() {}

    public static PlatformWorkspaceInvitationPage page(WorkspaceInvitationService.ManagementInvitationPage source) {
        var criteria = source.criteria();
        return new PlatformWorkspaceInvitationPage(
                source.items().stream()
                        .map(PlatformWorkspaceInvitationWireMapper::wire)
                        .toList(),
                (long) source.page(),
                (long) source.pageSize(),
                source.total(),
                new PlatformWorkspaceInvitationPageCriteria(
                        criteria.mobile(),
                        criteria.targetOrganizationType() == null
                                ? null
                                : ServiceNodeType.valueOf(criteria.targetOrganizationType()),
                        criteria.targetOrganizationRef(),
                        criteria.roleId(),
                        criteria.status() == null ? null : WorkspaceInvitationStatus.valueOf(criteria.status()),
                        criteria.expiresFrom(),
                        criteria.expiresTo(),
                        WorkspaceInvitationSortKey.valueOf(criteria.sort()),
                        SortDirection.valueOf(criteria.direction())));
    }
}
