package com.catering.v2s.organization.application;

import com.catering.v2s.organization.application.persistence.OrganizationAssignmentCandidatePersistence;
import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrganizationAssignmentCandidateService implements OrganizationAssignmentCandidateLookup {
    private final OrganizationAssignmentCandidatePersistence persistence;
    private final CommercialGroupLookup groups;
    private final OrganizationTaskPathLookup taskPaths;

    @Autowired
    public OrganizationAssignmentCandidateService(
            OrganizationAssignmentCandidatePersistence persistence,
            CommercialGroupLookup groups,
            OrganizationTaskPathLookup taskPaths) {
        this.persistence = persistence;
        this.groups = groups;
        this.taskPaths = taskPaths;
    }

    /** Compatibility constructor for existing lightweight owner tests. */
    public OrganizationAssignmentCandidateService(
            JdbcTemplate jdbc, CommercialGroupLookup groups, OrganizationTaskPathLookup taskPaths) {
        this(new OrganizationAssignmentCandidatePersistence(jdbc), groups, taskPaths);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AssignmentCandidate> listEnabled(UUID workspaceUuid, String key, String type) {
        return switch (type) {
            case ServiceNodeTypes.GROUP -> {
                UUID id = groups.requireCommercialGroupRef(workspaceUuid, key);
                OrganizationTaskPathLookup.TaskPath path = taskPaths.requireTaskPath(workspaceUuid, key, type, id);
                yield List.of(new AssignmentCandidate(type, id, path.displayPath(), path.nodes()));
            }
            case ServiceNodeTypes.REGION, ServiceNodeTypes.PROJECT -> candidates(
                    workspaceUuid,
                    key,
                    type,
                    persistence.enabledOrganizationNodeIds(workspaceUuid, key, type));
            case ServiceNodeTypes.HEAD_COMPANY, ServiceNodeTypes.STORE -> candidates(
                    workspaceUuid,
                    key,
                    type,
                    persistence.enabledEntityIds(workspaceUuid, key, type));
            default -> throw new IllegalArgumentException("unsupported assignment candidate type");
        };
    }

    /**
     * One typed, bounded organization projection for the platform invitation-target selector. The target family is an
     * enum, never an edge-selected table or order expression.
     */
    @Override
    @Transactional(readOnly = true)
    public PlatformInvitationCandidatePage platformInvitationCandidates(
            UUID workspaceUuid, String key, PlatformInvitationCandidateQuery query) {
        if (workspaceUuid == null || key == null || key.isBlank() || query == null) {
            throw new IllegalArgumentException("invitation candidate query is required");
        }
        List<OrganizationAssignmentCandidatePersistence.CandidateRow> rows = persistence.invitationCandidateRows(
                workspaceUuid, key, query.targetType(), query.queryText(), query.page(), query.pageSize(), null, null);
        long total = rows.isEmpty() ? 0L : rows.getFirst().total();
        return new PlatformInvitationCandidatePage(
                assignmentCandidates(workspaceUuid, key, rows), total, query.page(), query.pageSize());
    }

    @Override
    @Transactional(readOnly = true)
    public OperationsInvitationCandidatePage operationsInvitationCandidates(
            UUID workspaceUuid, String key, OperationsInvitationCandidateQuery query) {
        if (workspaceUuid == null || key == null || key.isBlank() || query == null) {
            throw new IllegalArgumentException("operations invitation candidate query is required");
        }
        List<OrganizationAssignmentCandidatePersistence.CandidateRow> rows = persistence.invitationCandidateRows(
                workspaceUuid,
                key,
                query.targetType(),
                query.queryText(),
                query.page(),
                query.pageSize(),
                null,
                query.effectiveCandidateScopeId());
        long total = rows.isEmpty() ? 0L : rows.getFirst().total();
        return new OperationsInvitationCandidatePage(
                assignmentCandidates(workspaceUuid, key, rows), total, query.page(), query.pageSize());
    }

    /**
     * Exact enabled-target projection for the ROLE candidate branch. It deliberately differs from persisted-path
     * display: disabled target facts are absent instead of being rendered.
     */
    @Override
    @Transactional(readOnly = true)
    public EnabledInvitationTarget requireEnabledInvitationTarget(
            UUID workspaceUuid, String key, InvitationTargetRef target) {
        if (workspaceUuid == null || key == null || key.isBlank() || target == null) {
            throw new IllegalArgumentException("enabled invitation target is required");
        }
        List<OrganizationAssignmentCandidatePersistence.CandidateRow> rows = persistence.invitationCandidateRows(
                workspaceUuid, key, target.targetType(), null, 1, 1, target.targetId(), null);
        if (rows.size() != 1) throw new OrganizationTaskPathService.TaskPathNotFoundException();
        OrganizationAssignmentCandidatePersistence.CandidateRow row = rows.getFirst();
        return new EnabledInvitationTarget(new InvitationTargetRef(row.type(), row.id()), row.path());
    }

    private List<AssignmentCandidate> candidates(UUID workspaceUuid, String key, String type, List<UUID> ids) {
        if (ids.isEmpty()) return List.of();
        List<OrganizationTaskPathLookup.TaskPathRef> targets = ids.stream()
                .map(id -> new OrganizationTaskPathLookup.TaskPathRef(type, id))
                .toList();
        Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> paths =
                taskPaths.requireTaskPaths(workspaceUuid, key, targets);
        List<AssignmentCandidate> result = new ArrayList<>(ids.size());
        for (UUID id : ids) {
            OrganizationTaskPathLookup.TaskPath path = paths.get(new OrganizationTaskPathLookup.TaskPathRef(type, id));
            if (path == null) throw new OrganizationTaskPathService.TaskPathNotFoundException();
            result.add(new AssignmentCandidate(type, id, path.displayPath(), path.nodes()));
        }
        return List.copyOf(result);
    }

    private List<AssignmentCandidate> assignmentCandidates(
            UUID workspaceUuid,
            String key,
            List<OrganizationAssignmentCandidatePersistence.CandidateRow> rows) {
        if (rows.isEmpty()) return List.of();
        List<OrganizationTaskPathLookup.TaskPathRef> refs = rows.stream()
                .map(row ->
                        new OrganizationTaskPathLookup.TaskPathRef(row.type().name(), row.id()))
                .toList();
        Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> paths =
                taskPaths.requireTaskPaths(workspaceUuid, key, refs);
        return rows.stream()
                .map(row -> {
                    OrganizationTaskPathLookup.TaskPath path = paths.get(new OrganizationTaskPathLookup.TaskPathRef(
                            row.type().name(), row.id()));
                    if (path == null) throw new OrganizationTaskPathService.TaskPathNotFoundException();
                    return new AssignmentCandidate(row.type().name(), row.id(), row.path(), path.nodes());
                })
                .toList();
    }

}
