package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup;
import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup.InvitationTargetRef;
import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup.InvitationTargetType;
import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup.PlatformInvitationCandidateQuery;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import com.catering.v2s.workspace.iam.api.WorkspaceRoleReadback;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Typed platform invitation-candidate boundary; candidate intent never accepts an operation id. */
@Service
public final class PlatformInvitationCandidatesTaskReadService {
    private final OrganizationAssignmentCandidateLookup organizations;
    private final WorkspaceRoleService roles;

    public PlatformInvitationCandidatesTaskReadService(OrganizationAssignmentCandidateLookup organizations, WorkspaceRoleService roles) {
        this.organizations = organizations;
        this.roles = roles;
    }

    @Transactional(readOnly = true)
    public WorkspaceUserService.CandidatePage candidates(WorkspaceUserService.CandidateQuery query) {
        WorkspaceUserService.CandidateQuery safe = platform(query);
        int page = safe.page() == null ? 1 : safe.page();
        int pageSize = safe.pageSize() == null ? 20 : safe.pageSize();
        if (page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("invalid candidate query");
        String text = blankToNull(safe.queryText());
        InvitationTargetType targetType = targetType(safe.targetType());
        return switch (safe.subjectType()) {
            case "ORGANIZATION" -> organizations(safe, targetType, text, page, pageSize);
            case "ROLE" -> roles(safe, targetType, text, page, pageSize);
            default -> throw new IllegalArgumentException("unsupported invitation candidate subject type");
        };
    }

    private WorkspaceUserService.CandidatePage organizations(WorkspaceUserService.CandidateQuery query, InvitationTargetType targetType, String text, int page, int pageSize) {
        var result = primary(() -> organizations.platformInvitationCandidates(query.workspaceUuid(), query.groupWorkspaceKey(), new PlatformInvitationCandidateQuery(targetType, text, page, pageSize)));
        List<WorkspaceUserService.CandidateOrganization> items = result.items().stream().map(value -> new WorkspaceUserService.CandidateOrganization(value.serviceNodeType(), value.organizationRef(), value.path())).toList();
        return new WorkspaceUserService.CandidatePage(new WorkspaceUserService.CandidateQueryMetadata("ORGANIZATION", text, page, pageSize, result.total(), null), items, List.of());
    }

    private WorkspaceUserService.CandidatePage roles(WorkspaceUserService.CandidateQuery query, InvitationTargetType targetType, String text, int page, int pageSize) {
        if ("INVITATION_TARGET".equals(query.candidateUsage())) {
            primary(() -> organizations.requireEnabledInvitationTarget(query.workspaceUuid(), query.groupWorkspaceKey(), new InvitationTargetRef(targetType, query.selectedOrganizationRef())));
        }
        WorkspaceRoleService.Page result = roles.platformTaskPage(query.workspaceUuid(), query.groupWorkspaceKey(), text, query.targetType(), "ENABLED", page, pageSize, "NAME", "ASC");
        List<WorkspaceRoleReadback> items = result.items();
        return new WorkspaceUserService.CandidatePage(new WorkspaceUserService.CandidateQueryMetadata("ROLE", text, page, pageSize, result.total(), query.selectedOrganizationRef()), List.of(), items);
    }

    private static WorkspaceUserService.CandidateQuery platform(WorkspaceUserService.CandidateQuery query) {
        if (query == null || query.operationsSession() != null || query.workspaceUuid() == null || query.groupWorkspaceKey() == null || query.groupWorkspaceKey().isBlank() || query.targetType() == null || query.subjectType() == null || !Set.of("ORGANIZATION", "ROLE").contains(query.subjectType()) || !Set.of("INVITATION_TARGET", "LIST_FILTER").contains(query.candidateUsage()) || ("LIST_FILTER".equals(query.candidateUsage()) && query.selectedOrganizationRef() != null) || ("INVITATION_TARGET".equals(query.candidateUsage()) && "ROLE".equals(query.subjectType()) && query.selectedOrganizationRef() == null)) throw new IllegalArgumentException("invalid candidate query");
        return query;
    }

    private static InvitationTargetType targetType(String value) {
        try { return InvitationTargetType.valueOf(value); }
        catch (RuntimeException error) { throw new IllegalArgumentException("invalid candidate query"); }
    }

    private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private static <T> T primary(java.util.function.Supplier<T> action) { return ReadBudgetComponent.measure(ReadBudgetComponent.Component.PRIMARY_QUERY, action); }
}
