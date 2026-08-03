package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import com.catering.v2s.organization.api.WorkspaceAssignmentScopeLookup;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read model for the store editor.  It returns owner-owned candidate facts in one fresh response. */
@Service
public class StoreCandidateTaskReadService {
    private final JdbcTemplate jdbc;
    private final WorkspaceAssignmentScopeLookup assignmentScopes;
    private final OrganizationTaskPathLookup taskPaths;
    public StoreCandidateTaskReadService(JdbcTemplate jdbc, WorkspaceAssignmentScopeLookup assignmentScopes, OrganizationTaskPathLookup taskPaths) { this.jdbc = jdbc; this.assignmentScopes = assignmentScopes; this.taskPaths = taskPaths; }

    @Transactional(readOnly = true)
    public Page candidates(UUID workspaceUuid, String key, UUID assignmentId, UUID visibleNodeId, UUID projectId, UUID brandId, UUID tenantId) {
        WorkspaceAssignmentScopeLookup.AssignmentScope scope;
        try {
            scope = assignmentScopes.requireActiveScope(workspaceUuid, key, assignmentId);
        } catch (RuntimeException absent) {
            throw new BusinessEntityService.OrganizationNotFoundException();
        }
        OrganizationTaskPathLookup.TaskPath visibleScope = visibleScope(workspaceUuid, key, scope, visibleNodeId);
        List<Candidate> projects = visibleProjects(workspaceUuid, key, visibleScope);
        if (projectId != null && projects.stream().noneMatch(candidate -> projectId.equals(candidate.id()))) throw new BusinessEntityService.OrganizationNotFoundException();
        List<Candidate> brands = jdbc.query("SELECT id, code, name FROM organization.brand WHERE workspace_uuid=? AND group_workspace_key=? AND status='ENABLED' AND (CAST(? AS uuid) IS NULL OR id=?) ORDER BY code", (row, index) -> new Candidate(row.getObject(1, UUID.class), row.getString(2), row.getString(3), null), workspaceUuid, key, brandId, brandId);
        List<Candidate> tenants = projectId != null && brandId != null
            ? jdbc.query("SELECT id, code, name FROM organization.tenant WHERE workspace_uuid=? AND group_workspace_key=? AND status='ENABLED' ORDER BY code", (row, index) -> new Candidate(row.getObject(1, UUID.class), row.getString(2), row.getString(3), null), workspaceUuid, key)
            : List.of();
        List<Candidate> heads = brandId != null && tenantId != null
            ? jdbc.query("SELECT h.id, h.code, h.name FROM organization.head_company h WHERE h.workspace_uuid=? AND h.group_workspace_key=? AND h.status='ENABLED' AND EXISTS (SELECT 1 FROM organization.head_company_brand_authorization a WHERE a.head_company_id=h.id AND a.brand_id=?) ORDER BY h.code", (row, index) -> new Candidate(row.getObject(1, UUID.class), row.getString(2), row.getString(3), null), workspaceUuid, key, brandId)
            : List.of();
        return new Page(key, new DataScope(visibleScope.targetType(), visibleScope.targetId(), visibleScope.displayPath()), projects, brands, tenants, heads);
    }

    /** Unified owner-backed candidate protocol for cross-entity selectors. */
    @Transactional(readOnly = true)
    public CandidatePage candidatePage(UUID workspaceUuid, String key, UUID assignmentId, UUID visibleNodeId, String subjectType, String queryText, Integer page, Integer pageSize, UUID selectedId, UUID projectId, UUID brandId, UUID tenantId) {
        WorkspaceAssignmentScopeLookup.AssignmentScope scope;
        try {
            scope = assignmentScopes.requireActiveScope(workspaceUuid, key, assignmentId);
        } catch (RuntimeException absent) {
            throw new BusinessEntityService.OrganizationNotFoundException();
        }
        OrganizationTaskPathLookup.TaskPath visibleScope = visibleScope(workspaceUuid, key, scope, visibleNodeId);
        int safePage = Math.max(1, page == null ? 1 : page);
        int safeSize = Math.min(100, Math.max(1, pageSize == null ? 20 : pageSize));
        String normalizedQuery = queryText == null || queryText.isBlank() ? null : queryText.trim();
        List<Candidate> all = switch (subjectType) {
            case "PROJECT" -> visibleProjects(workspaceUuid, key, visibleScope);
            case "BRAND" -> queryCandidates("SELECT id, code, name FROM organization.brand WHERE workspace_uuid=? AND group_workspace_key=? AND status='ENABLED'", workspaceUuid, key);
            case "TENANT" -> projectId == null || brandId == null ? List.of() : queryCandidates("SELECT DISTINCT t.id, t.code, t.name FROM organization.tenant t JOIN organization.store s ON s.tenant_id=t.id AND s.workspace_uuid=t.workspace_uuid AND s.group_workspace_key=t.group_workspace_key WHERE t.workspace_uuid=? AND t.group_workspace_key=? AND t.status='ENABLED' AND s.status='ENABLED' AND s.project_id=? AND s.brand_id=?", workspaceUuid, key, projectId, brandId);
            case "HEAD_COMPANY" -> brandId == null || tenantId == null ? List.of() : queryCandidates("SELECT DISTINCT h.id, h.code, h.name FROM organization.head_company h JOIN organization.store s ON s.head_company_id=h.id AND s.workspace_uuid=h.workspace_uuid AND s.group_workspace_key=h.group_workspace_key WHERE h.workspace_uuid=? AND h.group_workspace_key=? AND h.status='ENABLED' AND s.status='ENABLED' AND s.brand_id=? AND s.tenant_id=? AND EXISTS (SELECT 1 FROM organization.head_company_brand_authorization a WHERE a.head_company_id=h.id AND a.brand_id=?)", workspaceUuid, key, brandId, tenantId, brandId);
            case "STORE" -> projectId == null ? List.of() : queryCandidates("SELECT id, code, name FROM organization.store WHERE workspace_uuid=? AND group_workspace_key=? AND status='ENABLED' AND project_id=?", workspaceUuid, key, projectId);
            default -> throw new BusinessEntityService.OrganizationNotFoundException();
        };
        all = all.stream()
            .filter(candidate -> normalizedQuery == null || candidate.code().toLowerCase().contains(normalizedQuery.toLowerCase()) || candidate.name().toLowerCase().contains(normalizedQuery.toLowerCase()))
            .sorted(java.util.Comparator.comparing(Candidate::code).thenComparing(Candidate::id))
            .toList();
        if (selectedId != null && all.stream().noneMatch(candidate -> selectedId.equals(candidate.id()))) throw new BusinessEntityService.OrganizationNotFoundException();
        List<Candidate> slice = new java.util.ArrayList<>(pageSlice(all, safePage, safeSize));
        if (selectedId != null && slice.stream().noneMatch(candidate -> selectedId.equals(candidate.id()))) {
            Candidate selected = all.stream().filter(candidate -> selectedId.equals(candidate.id())).findFirst().orElseThrow(BusinessEntityService.OrganizationNotFoundException::new);
            if (slice.size() == safeSize) slice.set(safeSize - 1, selected); else slice.add(selected);
        }
        return new CandidatePage(new CandidateQueryMetadata(subjectType, normalizedQuery, safePage, safeSize, all.size(), selectedId), List.copyOf(slice));
    }

    private List<Candidate> queryCandidates(String sql, Object... arguments) {
        return jdbc.query(sql + " ORDER BY code", (row, index) -> new Candidate(row.getObject(1, UUID.class), row.getString(2), row.getString(3), null), arguments);
    }

    private static <T> List<T> pageSlice(List<T> values, int page, int pageSize) {
        int from = Math.min(values.size(), (page - 1) * pageSize);
        int to = Math.min(values.size(), from + pageSize);
        return values.subList(from, to);
    }

    private OrganizationTaskPathLookup.TaskPath visibleScope(UUID workspaceUuid, String key, WorkspaceAssignmentScopeLookup.AssignmentScope assignment, UUID visibleNodeId) {
        if (visibleNodeId == null) throw new BusinessEntityService.OrganizationNotFoundException();
        List<OrganizationTaskPathLookup.TaskPathRef> candidates = List.of(
            new OrganizationTaskPathLookup.TaskPathRef("GROUP", visibleNodeId),
            new OrganizationTaskPathLookup.TaskPathRef("REGION", visibleNodeId),
            new OrganizationTaskPathLookup.TaskPathRef("PROJECT", visibleNodeId),
            new OrganizationTaskPathLookup.TaskPathRef("HEAD_COMPANY", visibleNodeId),
            new OrganizationTaskPathLookup.TaskPathRef("STORE", visibleNodeId)
        );
        // Do not probe the throwing single-target API for each possible type inside this
        // transaction. A normal "not this target family" miss marks a REQUIRED
        // transaction rollback-only even when the caller catches the exception, which
        // later surfaces as an unrelated UnexpectedRollbackException. The owner
        // availability read is deliberately non-throwing and gives us one valid family
        // before the bounded path read.
        Set<OrganizationTaskPathLookup.TaskPathRef> available = taskPaths.availableTaskTargets(workspaceUuid, key, candidates);
        if (available.size() != 1) throw new BusinessEntityService.OrganizationNotFoundException();
        OrganizationTaskPathLookup.TaskPathRef ref = available.iterator().next();
        OrganizationTaskPathLookup.TaskPath resolved = taskPaths.requireTaskPaths(workspaceUuid, key, List.of(ref)).get(ref);
        if (resolved == null || !taskPaths.isScopeAllowed(workspaceUuid, key, assignment.serviceNodeType(), assignment.serviceNodeId(), resolved)) {
            throw new BusinessEntityService.OrganizationNotFoundException();
        }
        return resolved;
    }

    private List<Candidate> visibleProjects(UUID workspaceUuid, String key, OrganizationTaskPathLookup.TaskPath visibleScope) {
        if ("STORE".equals(visibleScope.targetType())) {
            return jdbc.query("SELECT n.id, n.code, n.name FROM organization.store s JOIN organization.organization_node n ON n.id=s.project_id WHERE s.workspace_uuid=? AND s.group_workspace_key=? AND s.id=? AND n.node_type='PROJECT' AND n.status='ENABLED'", (row, index) -> new Candidate(row.getObject(1, UUID.class), row.getString(2), row.getString(3), null), workspaceUuid, key, visibleScope.targetId());
        }
        List<Candidate> allProjects = jdbc.query("SELECT id, code, name FROM organization.organization_node WHERE workspace_uuid=? AND group_workspace_key=? AND node_type='PROJECT' AND status='ENABLED' ORDER BY code", (row, index) -> new Candidate(row.getObject(1, UUID.class), row.getString(2), row.getString(3), null), workspaceUuid, key);
        Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> paths = taskPaths.requireTaskPaths(workspaceUuid, key, allProjects.stream().map(project -> new OrganizationTaskPathLookup.TaskPathRef("PROJECT", project.id())).toList());
        return allProjects.stream().filter(project -> {
            OrganizationTaskPathLookup.TaskPath path = paths.get(new OrganizationTaskPathLookup.TaskPathRef("PROJECT", project.id()));
            return path != null && taskPaths.isScopeAllowed(workspaceUuid, key, visibleScope.targetType(), visibleScope.targetId(), path);
        }).toList();
    }
    public record Page(String groupWorkspaceKey, DataScope dataScope, List<Candidate> projects, List<Candidate> brands, List<Candidate> tenants, List<Candidate> headCompanies) { }
    public record CandidatePage(CandidateQueryMetadata metadata, List<Candidate> items) { }
    public record CandidateQueryMetadata(String subjectType, String queryText, int page, int pageSize, long total, UUID selectedId) { }
    public record DataScope(String nodeType, UUID nodeRef, String nodeName) { }
    public record Candidate(UUID id, String code, String name, String path) { }
}
