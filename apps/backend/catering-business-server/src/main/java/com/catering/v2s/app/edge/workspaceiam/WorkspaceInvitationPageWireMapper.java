package com.catering.v2s.app.edge.workspaceiam;

import com.catering.v2s.app.edge.generated.wire.SortDirection;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationPage;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationPageCriteria;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationSortKey;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationStatus;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;

/** Maps an already filtered, sorted and bounded owner page; it never paginates an unbounded list. */
public final class WorkspaceInvitationPageWireMapper {
    private WorkspaceInvitationPageWireMapper() { }

    public static WorkspaceInvitationPage page(WorkspaceInvitationService.ManagementInvitationPage source) {
        var criteria = source.criteria();
        return new WorkspaceInvitationPage(
            source.items().stream().map(WorkspaceInvitationWireMapper::wire).toList(),
            (long) source.page(), (long) source.pageSize(), source.total(),
            new WorkspaceInvitationPageCriteria(
                criteria.mobile(), criteria.organizationQuery(), criteria.roleQuery(),
                criteria.status() == null ? null : WorkspaceInvitationStatus.valueOf(criteria.status()),
                criteria.expiresFrom(), criteria.expiresTo(),
                WorkspaceInvitationSortKey.valueOf(criteria.sort()), SortDirection.valueOf(criteria.direction())
            )
        );
    }
}
