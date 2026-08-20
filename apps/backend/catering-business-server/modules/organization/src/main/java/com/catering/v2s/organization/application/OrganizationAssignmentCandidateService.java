package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrganizationAssignmentCandidateService implements OrganizationAssignmentCandidateLookup {
    private final JdbcTemplate jdbc;
    private final CommercialGroupLookup groups;
    private final OrganizationTaskPathLookup taskPaths;

    public OrganizationAssignmentCandidateService(
            JdbcTemplate jdbc, CommercialGroupLookup groups, OrganizationTaskPathLookup taskPaths) {
        this.jdbc = jdbc;
        this.groups = groups;
        this.taskPaths = taskPaths;
    }

    @Override
    @Transactional(readOnly = true)
    public List<AssignmentCandidate> listEnabled(UUID workspaceUuid, String key, String type) {
        return switch (type) {
            case ServiceNodeTypes.GROUP -> {
                UUID id = groups.requireCommercialGroupRef(workspaceUuid, key);
                yield List.of(
                        new AssignmentCandidate(type, id, groups.describeCommercialGroup(workspaceUuid, key, id)));
            }
            case ServiceNodeTypes.REGION, ServiceNodeTypes.PROJECT -> candidates(
                    workspaceUuid,
                    key,
                    type,
                    jdbc.query(
                            "SELECT id FROM organization.organization_node WHERE workspace_uuid=? AND "
                                    + "group_workspace_key=? AND node_type=? AND status='ENABLED' ORDER BY code",
                            (row, index) -> row.getObject(1, UUID.class),
                            workspaceUuid,
                            key,
                            type));
            case ServiceNodeTypes.HEAD_COMPANY, ServiceNodeTypes.STORE -> {
                String table = ServiceNodeTypes.HEAD_COMPANY.equals(type) ? "head_company" : "store";
                yield candidates(
                        workspaceUuid,
                        key,
                        type,
                        jdbc.query(
                                "SELECT id FROM organization." + table
                                        + " WHERE workspace_uuid=? AND group_workspace_key=? AND status='ENABLED' "
                                        + "ORDER BY code",
                                (row, index) -> row.getObject(1, UUID.class),
                                workspaceUuid,
                                key));
            }
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
        List<CandidateRow> rows = invitationCandidateRows(
                workspaceUuid, key, query.targetType(), query.queryText(), query.page(), query.pageSize(), null, null);
        long total = rows.isEmpty() ? 0L : rows.getFirst().total();
        return new PlatformInvitationCandidatePage(
                rows.stream()
                        .map(row -> new AssignmentCandidate(row.type().name(), row.id(), row.path()))
                        .toList(),
                total,
                query.page(),
                query.pageSize());
    }

    @Override
    @Transactional(readOnly = true)
    public OperationsInvitationCandidatePage operationsInvitationCandidates(
            UUID workspaceUuid, String key, OperationsInvitationCandidateQuery query) {
        if (workspaceUuid == null || key == null || key.isBlank() || query == null) {
            throw new IllegalArgumentException("operations invitation candidate query is required");
        }
        List<CandidateRow> rows = invitationCandidateRows(
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
                rows.stream()
                        .map(row -> new AssignmentCandidate(row.type().name(), row.id(), row.path()))
                        .toList(),
                total,
                query.page(),
                query.pageSize());
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
        List<CandidateRow> rows =
                invitationCandidateRows(workspaceUuid, key, target.targetType(), null, 1, 1, target.targetId(), null);
        if (rows.size() != 1) throw new OrganizationTaskPathService.TaskPathNotFoundException();
        CandidateRow row = rows.getFirst();
        return new EnabledInvitationTarget(new InvitationTargetRef(row.type(), row.id()), row.path());
    }

    private List<CandidateRow> invitationCandidateRows(
            UUID workspaceUuid,
            String key,
            InvitationTargetType targetType,
            String queryText,
            int page,
            int pageSize,
            UUID requiredTargetId,
            UUID candidateScopeId) {
        String pattern = queryText == null || queryText.isBlank()
                ? null
                : "%" + queryText.trim().replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
        long offset = (long) (page - 1) * pageSize;
        return switch (targetType) {
            case GROUP -> jdbc.query(
                    "SELECT commercial_group_uuid, commercial_group_code || ' ' || commercial_group_name, count(*) "
                            + "OVER() FROM organization.commercial_group "
                            + "WHERE group_workspace_key=? AND (?::uuid IS NULL OR commercial_group_uuid=?) "
                            + "AND (?::uuid IS NULL OR commercial_group_uuid=?) "
                            + "AND (?::text IS NULL OR commercial_group_code ILIKE ? ESCAPE '!' OR "
                            + "commercial_group_name ILIKE ? ESCAPE '!') "
                            + "ORDER BY commercial_group_code LIMIT ? OFFSET ?",
                    (row, index) -> new CandidateRow(
                            InvitationTargetType.GROUP, row.getObject(1, UUID.class), row.getString(2), row.getLong(3)),
                    key,
                    requiredTargetId,
                    requiredTargetId,
                    candidateScopeId,
                    candidateScopeId,
                    pattern,
                    pattern,
                    pattern,
                    pageSize,
                    offset);
            case REGION, PROJECT -> jdbc.query(
                    hierarchyCandidateSql(),
                    (row, index) -> new CandidateRow(
                            targetType, row.getObject(1, UUID.class), row.getString(2), row.getLong(3)),
                    workspaceUuid,
                    key,
                    targetType.name(),
                    requiredTargetId,
                    requiredTargetId,
                    candidateScopeId,
                    candidateScopeId,
                    pattern,
                    pattern,
                    pattern,
                    workspaceUuid,
                    key,
                    pageSize,
                    offset);
            case HEAD_COMPANY -> jdbc.query(
                    "SELECT id, code || ' ' || name, count(*) OVER() FROM organization.head_company "
                            + "WHERE workspace_uuid=? AND group_workspace_key=? AND status='ENABLED' AND (?::uuid IS "
                            + "NULL OR id=?) "
                            + "AND (?::uuid IS NULL OR id=?) "
                            + "AND (?::text IS NULL OR code ILIKE ? ESCAPE '!' OR name ILIKE ? ESCAPE '!') "
                            + "ORDER BY code LIMIT ? OFFSET ?",
                    (row, index) -> new CandidateRow(
                            InvitationTargetType.HEAD_COMPANY,
                            row.getObject(1, UUID.class),
                            row.getString(2),
                            row.getLong(3)),
                    workspaceUuid,
                    key,
                    requiredTargetId,
                    requiredTargetId,
                    candidateScopeId,
                    candidateScopeId,
                    pattern,
                    pattern,
                    pattern,
                    pageSize,
                    offset);
            case STORE -> jdbc.query(
                    storeCandidateSql(),
                    (row, index) -> new CandidateRow(
                            InvitationTargetType.STORE, row.getObject(1, UUID.class), row.getString(2), row.getLong(3)),
                    workspaceUuid,
                    key,
                    requiredTargetId,
                    requiredTargetId,
                    pattern,
                    pattern,
                    pattern,
                    candidateScopeId,
                    candidateScopeId,
                    workspaceUuid,
                    key,
                    workspaceUuid,
                    key,
                    pageSize,
                    offset);
        };
    }

    private static String hierarchyCandidateSql() {
        return "WITH RECURSIVE candidates AS ("
                + "SELECT id, parent_id, code, name FROM organization.organization_node "
                + "WHERE workspace_uuid=? AND group_workspace_key=? AND node_type=? AND status='ENABLED' "
                + "AND (?::uuid IS NULL OR id=?) AND (?::uuid IS NULL OR id=?) AND (?::text IS NULL OR code ILIKE ? "
                + "ESCAPE '!' OR name ILIKE ? ESCAPE '!')"
                + "), ancestry AS ("
                + "SELECT candidates.id AS target_id, candidates.id, candidates.parent_id, candidates.code, "
                + "candidates.name, 0 AS depth FROM candidates "
                + "UNION ALL SELECT ancestry.target_id, parent.id, parent.parent_id, parent.code, parent.name, "
                + "ancestry.depth + 1 "
                + "FROM organization.organization_node parent JOIN ancestry ON ancestry.parent_id=parent.id "
                + "WHERE parent.workspace_uuid=? AND parent.group_workspace_key=?"
                + "), paths AS ("
                + "SELECT target_id, string_agg(name || ' ' || code, ' / ' ORDER BY depth DESC) AS display_path FROM "
                + "ancestry GROUP BY target_id"
                + ") SELECT candidates.id, paths.display_path, count(*) OVER() FROM candidates JOIN paths ON "
                + "paths.target_id=candidates.id "
                + "ORDER BY candidates.code LIMIT ? OFFSET ?";
    }

    private static String storeCandidateSql() {
        return "WITH RECURSIVE candidates AS ("
                + "SELECT store.id, store.project_id, store.code, store.name FROM organization.store store "
                + "WHERE store.workspace_uuid=? AND store.group_workspace_key=? AND store.status='ENABLED' "
                + "AND (?::uuid IS NULL OR store.id=?) AND (?::text IS NULL OR store.code ILIKE ? ESCAPE '!' OR "
                + "store.name ILIKE ? ESCAPE '!') AND (?::uuid IS NULL OR store.id=?)"
                + "), ancestry AS ("
                + "SELECT candidates.id AS target_id, project.id, project.parent_id, project.code, project.name, 0 AS "
                + "depth FROM candidates "
                + "JOIN organization.organization_node project ON project.id=candidates.project_id AND "
                + "project.workspace_uuid=? AND project.group_workspace_key=? AND project.node_type='PROJECT' AND "
                + "project.status='ENABLED' "
                + "UNION ALL SELECT ancestry.target_id, parent.id, parent.parent_id, parent.code, parent.name, "
                + "ancestry.depth + 1 "
                + "FROM organization.organization_node parent JOIN ancestry ON ancestry.parent_id=parent.id "
                + "WHERE parent.workspace_uuid=? AND parent.group_workspace_key=?"
                + "), paths AS ("
                + "SELECT target_id, string_agg(name || ' ' || code, ' / ' ORDER BY depth DESC) AS project_path FROM "
                + "ancestry GROUP BY target_id"
                + ") SELECT candidates.id, paths.project_path || ' / ' || candidates.name || ' ' || candidates.code, "
                + "count(*) OVER() "
                + "FROM candidates JOIN paths ON paths.target_id=candidates.id ORDER BY candidates.code LIMIT ? OFFSET "
                + "?";
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
            result.add(new AssignmentCandidate(type, id, path.displayPath()));
        }
        return List.copyOf(result);
    }

    private record CandidateRow(InvitationTargetType type, UUID id, String path, long total) {}
}
