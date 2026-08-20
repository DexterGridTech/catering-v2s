package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.BusinessEntityTypes;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.WorkspaceAssignmentScopeLookup;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read model for the store editor. It returns owner-owned candidate facts in one fresh response. */
@Service
public class StoreCandidateTaskReadService {
    private final JdbcTemplate jdbc;
    private final WorkspaceAssignmentScopeLookup assignmentScopes;
    private final OrganizationTaskPathLookup taskPaths;

    public StoreCandidateTaskReadService(
            JdbcTemplate jdbc, WorkspaceAssignmentScopeLookup assignmentScopes, OrganizationTaskPathLookup taskPaths) {
        this.jdbc = jdbc;
        this.assignmentScopes = assignmentScopes;
        this.taskPaths = taskPaths;
    }

    /** Unified owner-backed candidate protocol for cross-entity selectors. */
    @Transactional(readOnly = true)
    public CandidatePage candidatePage(
            UUID workspaceUuid,
            String key,
            UUID assignmentId,
            UUID visibleNodeId,
            String subjectType,
            String queryText,
            Integer page,
            Integer pageSize,
            UUID selectedId,
            UUID projectId,
            UUID brandId,
            UUID tenantId) {
        return candidatePage(
                workspaceUuid,
                key,
                assignmentId,
                visibleNodeId,
                subjectType,
                "DEFAULT",
                queryText,
                page,
                pageSize,
                selectedId,
                projectId,
                brandId,
                tenantId);
    }

    /**
     * Contract-list relation lookups expose organization facts without applying a second role-node read range. The
     * primary contract page remains scoped by its project owner query; this lookup only resolves an explicit relation
     * ID.
     */
    @Transactional(readOnly = true)
    public CandidatePage candidatePage(
            UUID workspaceUuid,
            String key,
            UUID assignmentId,
            UUID visibleNodeId,
            String subjectType,
            String candidateUsage,
            String queryText,
            Integer page,
            Integer pageSize,
            UUID selectedId,
            UUID projectId,
            UUID brandId,
            UUID tenantId) {
        int safePage = Math.max(1, page == null ? 1 : page);
        int safeSize = Math.min(100, Math.max(1, pageSize == null ? 20 : pageSize));
        String normalizedQuery = queryText == null || queryText.isBlank() ? null : queryText.trim();
        CandidateSql source = "CONTRACT_LIST".equals(candidateUsage)
                ? contractListCandidateSql(workspaceUuid, key, subjectType, projectId)
                : defaultCandidateSql(
                        workspaceUuid, key, assignmentId, visibleNodeId, subjectType, projectId, brandId, tenantId);
        if (source == null) return emptyCandidatePage(subjectType, normalizedQuery, safePage, safeSize, selectedId);
        CandidateQueryResult result = queryCandidatePage(source, normalizedQuery, safePage, safeSize, selectedId);
        return new CandidatePage(
                new CandidateQueryMetadata(
                        subjectType, normalizedQuery, safePage, safeSize, result.total(), selectedId),
                result.items());
    }

    /** Platform contract selector: one bounded organization projection, never a generic edge query bus. */
    @Transactional(readOnly = true)
    public CandidatePage platformContractCandidatePage(
            UUID workspaceUuid, String key, PlatformContractCandidateQuery query) {
        validatePlatformCandidateRequest(workspaceUuid, key, query);
        return platformCandidatePage(workspaceUuid, key, query, platformContractCandidateSql(workspaceUuid, key, query));
    }

    /** Platform external-binding selector: the same organization owner read, bounded by bindable node type. */
    @Transactional(readOnly = true)
    public CandidatePage platformExternalBindingCandidatePage(
            UUID workspaceUuid, String key, PlatformContractCandidateQuery query) {
        validatePlatformCandidateRequest(workspaceUuid, key, query);
        return platformCandidatePage(
                workspaceUuid, key, query, platformExternalBindingCandidateSql(workspaceUuid, key, query));
    }

    private static void validatePlatformCandidateRequest(
            UUID workspaceUuid, String key, PlatformContractCandidateQuery query) {
        if (workspaceUuid == null || key == null || key.isBlank() || query == null)
            throw new BusinessEntityService.OrganizationNotFoundException();
    }

    private CandidatePage platformCandidatePage(
            UUID workspaceUuid, String key, PlatformContractCandidateQuery query, CandidateSql source) {
        if (workspaceUuid == null || key == null || key.isBlank() || query == null)
            throw new BusinessEntityService.OrganizationNotFoundException();
        CandidateQueryResult result = ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> queryCandidatePage(source, query.queryText(), query.page(), query.pageSize(), query.selectedId()));
        return new CandidatePage(
                new CandidateQueryMetadata(
                        query.subjectType().name(),
                        query.queryText(),
                        query.page(),
                        query.pageSize(),
                        result.total(),
                        query.selectedId()),
                result.items());
    }

    /** Explicit operations-admin relation-selector boundary; keeps the bounded selector protocol owner-local. */
    @Transactional(readOnly = true)
    public CandidatePage operationsCandidatePage(
            UUID workspaceUuid,
            String key,
            UUID assignmentId,
            UUID visibleNodeId,
            String subjectType,
            String candidateUsage,
            String queryText,
            Integer page,
            Integer pageSize,
            UUID selectedId,
            UUID projectId,
            UUID brandId,
            UUID tenantId) {
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> candidatePage(
                        workspaceUuid,
                        key,
                        assignmentId,
                        visibleNodeId,
                        subjectType,
                        candidateUsage,
                        queryText,
                        page,
                        pageSize,
                        selectedId,
                        projectId,
                        brandId,
                        tenantId));
    }

    private CandidateSql defaultCandidateSql(
            UUID workspaceUuid,
            String key,
            UUID assignmentId,
            UUID visibleNodeId,
            String subjectType,
            UUID projectId,
            UUID brandId,
            UUID tenantId) {
        return switch (subjectType) {
            case ServiceNodeTypes.PROJECT -> {
                OrganizationTaskPathLookup.TaskPath scope =
                        scopedVisibleScope(workspaceUuid, key, assignmentId, visibleNodeId);
                if (scope == null) throw new BusinessEntityService.OrganizationNotFoundException();
                SqlPart projects = visibleProjectIdsSql(workspaceUuid, key, scope);
                yield new CandidateSql(
                        "SELECT n.id, n.code, n.name FROM organization.organization_node n WHERE n.id IN ("
                                + projects.sql()
                                + ")",
                        projects.arguments());
            }
            case "BRAND" -> new CandidateSql(
                    "SELECT id, code, name FROM organization.brand WHERE workspace_uuid=? AND group_workspace_key=? "
                            + "AND status='ENABLED'",
                    List.of(workspaceUuid, key));
            case "TENANT" -> projectId == null || brandId == null
                    ? null
                    : new CandidateSql(
                            "SELECT DISTINCT t.id, t.code, t.name FROM organization.tenant t JOIN organization.store s "
                                    + "ON s.tenant_id=t.id AND s.workspace_uuid=t.workspace_uuid AND "
                                    + "s.group_workspace_key=t.group_workspace_key WHERE t.workspace_uuid=? AND "
                                    + "t.group_workspace_key=? AND t.status='ENABLED' AND s.status='ENABLED' AND "
                                    + "s.project_id=? AND s.brand_id=?",
                            List.of(workspaceUuid, key, projectId, brandId));
            case BusinessEntityTypes.HEAD_COMPANY -> brandId == null || tenantId == null
                    ? null
                    : new CandidateSql(
                            "SELECT DISTINCT h.id, h.code, h.name FROM organization.head_company h JOIN "
                                    + "organization.store s ON s.head_company_id=h.id AND "
                                    + "s.workspace_uuid=h.workspace_uuid AND "
                                    + "s.group_workspace_key=h.group_workspace_key "
                                    + "WHERE h.workspace_uuid=? AND h.group_workspace_key=? AND h.status='ENABLED' AND "
                                    + "s.status='ENABLED' AND s.brand_id=? AND s.tenant_id=? AND EXISTS (SELECT 1 FROM "
                                    + "organization.head_company_brand_authorization a WHERE a.head_company_id=h.id "
                                    + "AND a.brand_id=?)",
                            List.of(workspaceUuid, key, brandId, tenantId, brandId));
            case ServiceNodeTypes.STORE -> {
                OrganizationTaskPathLookup.TaskPath scope =
                        scopedVisibleScope(workspaceUuid, key, assignmentId, visibleNodeId);
                if (scope == null) throw new BusinessEntityService.OrganizationNotFoundException();
                SqlPart projects = visibleProjectIdsSql(workspaceUuid, key, scope);
                yield new CandidateSql(
                        "SELECT s.id, s.code, s.name FROM organization.store s WHERE s.workspace_uuid=? AND "
                                + "s.group_workspace_key=? AND s.status='ENABLED' AND s.project_id IN ("
                                + projects.sql()
                                + ")",
                        concat(List.of(workspaceUuid, key), projects.arguments()));
            }
            default -> throw new BusinessEntityService.OrganizationNotFoundException();
        };
    }

    private CandidateSql contractListCandidateSql(UUID workspaceUuid, String key, String subjectType, UUID projectId) {
        return switch (subjectType) {
            case ServiceNodeTypes.STORE -> new CandidateSql(
                    "SELECT id, code, name FROM organization.store WHERE workspace_uuid=? AND group_workspace_key=? "
                            + "AND (CAST(? AS uuid) IS NULL OR project_id=?)",
                    List.of(workspaceUuid, key, projectId, projectId));
            case "TENANT" -> new CandidateSql(
                    "SELECT DISTINCT t.id, t.code, t.name FROM organization.tenant t JOIN organization.store s ON "
                            + "s.tenant_id=t.id AND s.workspace_uuid=t.workspace_uuid AND "
                            + "s.group_workspace_key=t.group_workspace_key WHERE t.workspace_uuid=? AND "
                            + "t.group_workspace_key=? AND (CAST(? AS uuid) IS NULL OR s.project_id=?)",
                    List.of(workspaceUuid, key, projectId, projectId));
            default -> throw new BusinessEntityService.OrganizationNotFoundException();
        };
    }

    private CandidateQueryResult queryCandidatePage(
            CandidateSql source, String queryText, int page, int pageSize, UUID selectedId) {
        long offset = (long) (page - 1) * pageSize;
        List<Object> arguments = new java.util.ArrayList<>(source.arguments());
        String pattern = queryPattern(queryText);
        arguments.add(pattern);
        arguments.add(pattern);
        arguments.add(pattern);
        arguments.add(selectedId);
        arguments.add(offset);
        arguments.add(offset + pageSize);
        List<CandidateQueryRow> rows = jdbc.query(
                "WITH candidates AS ("
                        + source.sql()
                        + "), filtered AS (SELECT id, code, name FROM candidates WHERE CAST(? AS text) IS NULL OR "
                        + "code ILIKE ? ESCAPE '!' OR name ILIKE ? ESCAPE '!'), summary AS (SELECT count(*) AS total, "
                        + "COALESCE(bool_or(id=CAST(? AS uuid)), false) AS selected_exists FROM filtered), ranked AS ("
                        + "SELECT id, code, name, row_number() OVER(ORDER BY code, id) AS page_rank FROM filtered), "
                        + "paged AS (SELECT * FROM ranked WHERE page_rank>? AND page_rank<=?) SELECT paged.id, "
                        + "paged.code, paged.name, summary.total, paged.page_rank, "
                        + "summary.selected_exists FROM summary "
                        + "LEFT JOIN paged ON TRUE ORDER BY paged.page_rank",
                (row, index) -> new CandidateQueryRow(
                        row.getObject("id", UUID.class),
                        row.getString("code"),
                        row.getString("name"),
                        row.getLong("total"),
                        row.getLong("page_rank"),
                        row.getBoolean("selected_exists")),
                arguments.toArray());
        CandidateQueryRow summary = rows.isEmpty() ? null : rows.getFirst();
        if (selectedId != null && (summary == null || !summary.selectedExists()))
            throw new BusinessEntityService.OrganizationNotFoundException();
        long total = summary == null ? 0L : summary.total();
        List<Candidate> items = rows.stream()
                .filter(row -> row.id() != null)
                .map(row -> new Candidate(row.id(), row.code(), row.name(), null))
                .toList();
        return new CandidateQueryResult(total, List.copyOf(items));
    }

    private static CandidatePage emptyCandidatePage(
            String subjectType, String queryText, int page, int pageSize, UUID selectedId) {
        return new CandidatePage(
                new CandidateQueryMetadata(subjectType, queryText, page, pageSize, 0L, selectedId), List.of());
    }

    private static String queryPattern(String queryText) {
        if (queryText == null || queryText.isBlank()) return null;
        return "%" + queryText.trim().replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
    }

    private static SqlPart visibleProjectIdsSql(
            UUID workspaceUuid, String key, OrganizationTaskPathLookup.TaskPath scope) {
        return switch (scope.targetType()) {
            case ServiceNodeTypes.GROUP -> new SqlPart(
                    "SELECT n.id FROM organization.organization_node n WHERE n.workspace_uuid=? AND "
                            + "n.group_workspace_key=? AND n.node_type='PROJECT' AND n.status='ENABLED'",
                    List.of(workspaceUuid, key));
            case ServiceNodeTypes.REGION -> new SqlPart(
                    "SELECT n.id FROM organization.organization_node n WHERE n.workspace_uuid=? AND "
                            + "n.group_workspace_key=? AND n.node_type='PROJECT' AND n.status='ENABLED' AND n.id IN ("
                            + "WITH RECURSIVE descendants(id) AS (SELECT id FROM organization.organization_node WHERE "
                            + "id=? AND workspace_uuid=? AND group_workspace_key=? AND status='ENABLED' "
                            + "UNION ALL SELECT "
                            + "child.id FROM organization.organization_node child JOIN descendants parent ON "
                            + "child.parent_id=parent.id WHERE child.workspace_uuid=? "
                            + "AND child.group_workspace_key=? AND "
                            + "child.status='ENABLED') SELECT id FROM descendants)",
                    List.of(workspaceUuid, key, scope.targetId(), workspaceUuid, key, workspaceUuid, key));
            case ServiceNodeTypes.PROJECT -> new SqlPart(
                    "SELECT n.id FROM organization.organization_node n WHERE n.workspace_uuid=? AND "
                            + "n.group_workspace_key=? AND n.node_type='PROJECT' AND n.status='ENABLED' AND n.id=?",
                    List.of(workspaceUuid, key, scope.targetId()));
            case ServiceNodeTypes.STORE -> new SqlPart(
                    "SELECT n.id FROM organization.organization_node n WHERE n.workspace_uuid=? AND "
                            + "n.group_workspace_key=? AND n.node_type='PROJECT' AND n.status='ENABLED' AND n.id=("
                            + "SELECT project_id FROM organization.store WHERE id=? AND workspace_uuid=? AND "
                            + "group_workspace_key=? AND status='ENABLED')",
                    List.of(workspaceUuid, key, scope.targetId(), workspaceUuid, key));
            case BusinessEntityTypes.HEAD_COMPANY -> new SqlPart(
                    "SELECT n.id FROM organization.organization_node n WHERE n.workspace_uuid=? AND "
                            + "n.group_workspace_key=? AND n.node_type='PROJECT' AND n.status='ENABLED' AND n.id IN ("
                            + "SELECT DISTINCT project_id FROM organization.store WHERE workspace_uuid=? AND "
                            + "group_workspace_key=? AND head_company_id=? AND status='ENABLED')",
                    List.of(workspaceUuid, key, workspaceUuid, key, scope.targetId()));
            default -> throw new BusinessEntityService.OrganizationNotFoundException();
        };
    }

    private static List<Object> concat(List<Object> first, List<Object> second) {
        List<Object> result = new java.util.ArrayList<>(first.size() + second.size());
        result.addAll(first);
        result.addAll(second);
        return List.copyOf(result);
    }

    private static CandidateSql platformContractCandidateSql(
            UUID workspaceUuid, String key, PlatformContractCandidateQuery query) {
        String subjectType = query.subjectType().name();
        return new CandidateSql(
                "SELECT store.id, store.code, store.name FROM organization.store store WHERE ?='STORE' AND "
                        + "store.workspace_uuid=? AND store.group_workspace_key=? AND (?::uuid IS NULL OR "
                        + "store.project_id=?) UNION ALL SELECT DISTINCT tenant.id, tenant.code, tenant.name FROM "
                        + "organization.tenant tenant JOIN organization.store store ON store.tenant_id=tenant.id AND "
                        + "store.workspace_uuid=tenant.workspace_uuid AND store.group_workspace_key=tenant.group_workspace_key "
                        + "WHERE ?='TENANT' AND tenant.workspace_uuid=? AND tenant.group_workspace_key=? AND "
                        + "(?::uuid IS NULL OR store.project_id=?)",
                nullableArguments(
                        subjectType,
                        workspaceUuid,
                        key,
                        query.projectId(),
                        query.projectId(),
                        subjectType,
                        workspaceUuid,
                        key,
                        query.projectId(),
                        query.projectId()));
    }

    private static CandidateSql platformExternalBindingCandidateSql(
            UUID workspaceUuid, String key, PlatformContractCandidateQuery query) {
        return switch (query.subjectType()) {
            case COMMERCIAL_GROUP -> new CandidateSql(
                    "SELECT commercial_group.commercial_group_uuid AS id, "
                            + "commercial_group.commercial_group_code AS code, "
                            + "commercial_group.commercial_group_name AS name "
                            + "FROM organization.commercial_group commercial_group "
                            + "JOIN platform_workspace.group_workspace group_workspace "
                            + "ON group_workspace.id=commercial_group.group_workspace_id "
                            + "WHERE group_workspace.workspace_uuid=? AND group_workspace.group_workspace_key=? "
                            + "AND commercial_group.group_workspace_key=?",
                    List.of(workspaceUuid, key, key));
            case REGION, PROJECT -> new CandidateSql(
                    "SELECT node.id, node.code, node.name FROM organization.organization_node node "
                            + "WHERE node.workspace_uuid=? AND node.group_workspace_key=? AND node.node_type=? "
                            + "AND node.status='ENABLED'",
                    List.of(workspaceUuid, key, query.subjectType().name()));
            case HEAD_COMPANY -> new CandidateSql(
                    "SELECT head_company.id, head_company.code, head_company.name "
                            + "FROM organization.head_company head_company "
                            + "WHERE head_company.workspace_uuid=? AND head_company.group_workspace_key=? "
                            + "AND head_company.status='ENABLED'",
                    List.of(workspaceUuid, key));
            case STORE -> new CandidateSql(
                    "SELECT store.id, store.code, store.name FROM organization.store store "
                            + "WHERE store.workspace_uuid=? AND store.group_workspace_key=? AND store.status='ENABLED' "
                            + "AND (CAST(? AS uuid) IS NULL OR store.project_id=?)",
                    nullableArguments(workspaceUuid, key, query.projectId(), query.projectId()));
            default -> throw new BusinessEntityService.OrganizationNotFoundException();
        };
    }

    private static List<Object> nullableArguments(Object... values) {
        return java.util.Arrays.asList(values);
    }

    public enum PlatformContractCandidateSubject {
        COMMERCIAL_GROUP,
        REGION,
        PROJECT,
        BRAND,
        HEAD_COMPANY,
        STORE,
        TENANT
    }

    public record PlatformContractCandidateQuery(
            PlatformContractCandidateSubject subjectType,
            String queryText,
            int page,
            int pageSize,
            UUID selectedId,
            UUID projectId) {
        public PlatformContractCandidateQuery {
            if (subjectType == null || page < 1 || pageSize < 1 || pageSize > 100)
                throw new IllegalArgumentException("invalid platform contract candidate query");
        }
    }

    private OrganizationTaskPathLookup.TaskPath visibleScope(
            UUID workspaceUuid,
            String key,
            WorkspaceAssignmentScopeLookup.AssignmentScope assignment,
            UUID visibleNodeId) {
        if (visibleNodeId == null) throw new BusinessEntityService.OrganizationNotFoundException();
        List<OrganizationTaskPathLookup.TaskPathRef> candidates = List.of(
                new OrganizationTaskPathLookup.TaskPathRef(ServiceNodeTypes.GROUP, visibleNodeId),
                new OrganizationTaskPathLookup.TaskPathRef(ServiceNodeTypes.REGION, visibleNodeId),
                new OrganizationTaskPathLookup.TaskPathRef(ServiceNodeTypes.PROJECT, visibleNodeId),
                new OrganizationTaskPathLookup.TaskPathRef(ServiceNodeTypes.HEAD_COMPANY, visibleNodeId),
                new OrganizationTaskPathLookup.TaskPathRef(ServiceNodeTypes.STORE, visibleNodeId));
        // Do not probe the throwing single-target API for each possible type inside this
        // transaction. A normal "not this target family" miss marks a REQUIRED
        // transaction rollback-only even when the caller catches the exception, which
        // later surfaces as an unrelated UnexpectedRollbackException. The owner
        // availability read is deliberately non-throwing and gives us one valid family
        // before the bounded path read.
        Set<OrganizationTaskPathLookup.TaskPathRef> available =
                taskPaths.availableTaskTargets(workspaceUuid, key, candidates);
        if (available.size() != 1) throw new BusinessEntityService.OrganizationNotFoundException();
        OrganizationTaskPathLookup.TaskPathRef ref = available.iterator().next();
        OrganizationTaskPathLookup.TaskPath resolved =
                taskPaths.requireTaskPaths(workspaceUuid, key, List.of(ref)).get(ref);
        if (resolved == null
                || !taskPaths.isScopeAllowed(
                        workspaceUuid, key, assignment.serviceNodeType(), assignment.serviceNodeId(), resolved)) {
            throw new BusinessEntityService.OrganizationNotFoundException();
        }
        return resolved;
    }

    private OrganizationTaskPathLookup.TaskPath scopedVisibleScope(
            UUID workspaceUuid, String key, UUID assignmentId, UUID visibleNodeId) {
        try {
            WorkspaceAssignmentScopeLookup.AssignmentScope scope =
                    assignmentScopes.requireActiveScope(workspaceUuid, key, assignmentId);
            return visibleScope(workspaceUuid, key, scope, visibleNodeId);
        } catch (RuntimeException absent) {
            return null;
        }
    }

    private record SqlPart(String sql, List<Object> arguments) {
        private SqlPart {
            arguments = List.copyOf(arguments);
        }
    }

    private record CandidateSql(String sql, List<Object> arguments) {
        private CandidateSql {
            arguments = java.util.Collections.unmodifiableList(new java.util.ArrayList<>(arguments));
        }
    }

    private record CandidateQueryRow(
            UUID id, String code, String name, long total, long pageRank, boolean selectedExists) {}

    private record CandidateQueryResult(long total, List<Candidate> items) {
        private CandidateQueryResult {
            items = List.copyOf(items);
        }
    }

    public record CandidatePage(CandidateQueryMetadata metadata, List<Candidate> items) {}

    public record CandidateQueryMetadata(
            String subjectType, String queryText, int page, int pageSize, long total, UUID selectedId) {}

    public record Candidate(UUID id, String code, String name, String path) {}
}
