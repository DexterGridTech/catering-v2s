package com.catering.v2s.organization.application.persistence;

import com.catering.v2s.organization.api.BusinessEntityTypes;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.WorkspaceAssignmentScopeLookup;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.StoreCandidateTaskReadService.Candidate;
import com.catering.v2s.organization.application.StoreCandidateTaskReadService.CandidatePage;
import com.catering.v2s.organization.application.StoreCandidateTaskReadService.CandidateQueryMetadata;
import com.catering.v2s.organization.application.StoreCandidateTaskReadService.PlatformContractCandidateQuery;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Read model for the store editor. It returns owner-owned candidate facts in one fresh response. */
@Repository
public class StoreCandidateTaskReadPersistence {
    private final JdbcTemplate jdbc;
    private final WorkspaceAssignmentScopeLookup assignmentScopes;
    private final OrganizationTaskPathLookup taskPaths;

    public StoreCandidateTaskReadPersistence(
            JdbcTemplate jdbc, WorkspaceAssignmentScopeLookup assignmentScopes, OrganizationTaskPathLookup taskPaths) {
        this.jdbc = jdbc;
        this.assignmentScopes = assignmentScopes;
        this.taskPaths = taskPaths;
    }

    /** Unified owner-backed candidate protocol for cross-entity selectors. */
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
    public CandidatePage platformContractCandidatePage(
            UUID workspaceUuid, String key, PlatformContractCandidateQuery query) {
        validatePlatformCandidateRequest(workspaceUuid, key, query);
        return platformCandidatePage(
                workspaceUuid, key, query, platformContractCandidateSql(workspaceUuid, key, query));
    }

    /** Platform external-binding selector: the same organization owner read, bounded by bindable node type. */
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
                () -> queryCandidatePage(
                        source, query.queryText(), query.page(), query.pageSize(), query.selectedId()));
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
                        StoreCandidateTaskReadServiceSql
                                        .STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_ORGANIZATION_NODE_CODE_NAME
                                + projects.sql()
                                + StoreCandidateTaskReadServiceSql.SQL_CLOSE_PAREN,
                        projects.arguments());
            }
            case "BRAND" -> new CandidateSql(
                    StoreCandidateTaskReadServiceSql.SELECT_BRAND_CODE_NAME_WS_001
                            + StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_CONDITION_STATUS_ENABLED,
                    List.of(workspaceUuid, key));
            case "TENANT" -> projectId == null || brandId == null
                    ? null
                    : new CandidateSql(
                            StoreCandidateTaskReadServiceSql.STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_STORE_CODE_NAME
                                    + StoreCandidateTaskReadServiceSql
                                            .STORE_CANDIDATE_TASK_READ_SERVICE_JOIN_CONDITION_TENANT_ID_WORKSPACE_UUID
                                    + StoreCandidateTaskReadServiceSql
                                            .STORE_CANDIDATE_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_WORKSPACE_UUID
                                    + StoreCandidateTaskReadServiceSql
                                            .STORE_CANDIDATE_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_STATUS_ENABLED
                                    + StoreCandidateTaskReadServiceSql
                                            .STORE_CANDIDATE_TASK_READ_SERVICE_PROJECT_ID_BRAND_ID,
                            List.of(workspaceUuid, key, projectId, brandId));
            case BusinessEntityTypes.HEAD_COMPANY -> brandId == null || tenantId == null
                    ? null
                    : new CandidateSql(
                            StoreCandidateTaskReadServiceSql
                                            .STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_HEAD_COMPANY_CODE_NAME
                                    + StoreCandidateTaskReadServiceSql
                                            .STORE_CANDIDATE_TASK_READ_SERVICE_ALTERNATIVE_STORE_HEAD_COMPANY_ID
                                    + StoreCandidateTaskReadServiceSql.STORE_CANDIDATE_TASK_READ_SERVICE_WORKSPACE_UUID
                                    + StoreCandidateTaskReadServiceSql
                                            .STORE_CANDIDATE_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY
                                    + StoreCandidateTaskReadServiceSql.WHERE_WS_UUID_GRP_WS_002
                                    + StoreCandidateTaskReadServiceSql
                                            .STORE_CANDIDATE_TASK_READ_SERVICE_STATUS_ENABLED_BRAND_ID_TENANT_ID
                                    + StoreCandidateTaskReadServiceSql.ALT_HEAD_COMPANY_BRAND_AUTH_003
                                    + StoreCandidateTaskReadServiceSql
                                            .STORE_CANDIDATE_TASK_READ_SERVICE_CONDITION_BRAND_ID,
                            List.of(workspaceUuid, key, brandId, tenantId, brandId));
            case ServiceNodeTypes.STORE -> {
                OrganizationTaskPathLookup.TaskPath scope =
                        scopedVisibleScope(workspaceUuid, key, assignmentId, visibleNodeId);
                if (scope == null) throw new BusinessEntityService.OrganizationNotFoundException();
                SqlPart projects = visibleProjectIdsSql(workspaceUuid, key, scope);
                yield new CandidateSql(
                        StoreCandidateTaskReadServiceSql
                                        .STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_STORE_CODE_NAME_WORKSPACE_UUID
                                + StoreCandidateTaskReadServiceSql
                                        .STORE_CANDIDATE_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_STATUS_ENABLED_PROJECT_ID
                                + projects.sql()
                                + StoreCandidateTaskReadServiceSql.SQL_CLOSE_PAREN,
                        concat(List.of(workspaceUuid, key), projects.arguments()));
            }
            default -> throw new BusinessEntityService.OrganizationNotFoundException();
        };
    }

    private CandidateSql contractListCandidateSql(UUID workspaceUuid, String key, String subjectType, UUID projectId) {
        return switch (subjectType) {
            case ServiceNodeTypes.STORE -> new CandidateSql(
                    StoreCandidateTaskReadServiceSql.SELECT_STORE_CODE_NAME_WS_004
                            + StoreCandidateTaskReadServiceSql.STORE_CANDIDATE_TASK_READ_SERVICE_CONDITION_PROJECT_ID,
                    List.of(workspaceUuid, key, projectId, projectId));
            case "TENANT" -> new CandidateSql(
                    StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_STORE_CODE_NAME_ALTERNATE_A
                            + StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_TENANT_ID_WORKSPACE_UUID
                            + StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_WORKSPACE_UUID_ALTERNATE_A
                            + StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_PROJECT_ID,
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
                StoreCandidateTaskReadServiceSql.STORE_CANDIDATE_TASK_READ_SERVICE_CTE_CANDIDATES
                        + source.sql()
                        + StoreCandidateTaskReadServiceSql
                                .STORE_CANDIDATE_TASK_READ_SERVICE_CLOSE_PAREN_CANDIDATES_FILTERED_CODE_NAME_TEXT
                        + StoreCandidateTaskReadServiceSql.STORE_CANDIDATE_TASK_READ_SERVICE_CODE_ILIKE_ESCAPE_NAME
                        + StoreCandidateTaskReadServiceSql
                                .STORE_CANDIDATE_TASK_READ_SERVICE_FILTERED_BOOL_OR_SELECTED_EXISTS_RANKED
                        + StoreCandidateTaskReadServiceSql
                                .STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_FILTERED_CODE_NAME_PAGE_RANK
                        + StoreCandidateTaskReadServiceSql.STORE_CANDIDATE_TASK_READ_SERVICE_RANKED_PAGED_PAGE_RANK
                        + StoreCandidateTaskReadServiceSql.STORE_CANDIDATE_TASK_READ_SERVICE_PAGED_CODE_NAME_SUMMARY
                        + StoreCandidateTaskReadServiceSql.STORE_CANDIDATE_TASK_READ_SERVICE_SUMMARY_SELECTED_EXISTS
                        + StoreCandidateTaskReadServiceSql.STORE_CANDIDATE_TASK_READ_SERVICE_PAGED_PAGE_RANK,
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
                    StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_ORGANIZATION_NODE_WORKSPACE_UUID
                            + StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_NODE_TYPE_PROJECT_STATUS,
                    List.of(workspaceUuid, key));
            case ServiceNodeTypes.REGION -> new SqlPart(
                    StoreCandidateTaskReadServiceSql.SELECT_ORG_NODE_WS_UUID_ALT_A_005
                            + StoreCandidateTaskReadServiceSql.GRP_WS_KEY_NODE_TYPE_ALT_A_006
                            + StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_CTE_ORGANIZATION_NODE_DESCENDANTS
                            + StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_ENABLED
                            + StoreCandidateTaskReadServiceSql.STORE_CANDIDATE_TASK_READ_SERVICE_UNION_UNION_ALL_SELECT
                            + StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_DESCENDANTS_CHILD_PARENT
                            + StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_CHILD_PARENT_ID_PARENT_WORKSPACE_UUID
                            + StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_CONDITION_CHILD_GROUP_WORKSPACE_KEY
                            + StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_DESCENDANTS_CHILD_STATUS_ENABLED,
                    List.of(workspaceUuid, key, scope.targetId(), workspaceUuid, key, workspaceUuid, key));
            case ServiceNodeTypes.PROJECT -> new SqlPart(
                    StoreCandidateTaskReadServiceSql.SELECT_ORG_NODE_WS_UUID_ALT_B_007
                            + StoreCandidateTaskReadServiceSql.GRP_WS_KEY_NODE_TYPE_ALT_B_008,
                    List.of(workspaceUuid, key, scope.targetId()));
            case ServiceNodeTypes.STORE -> new SqlPart(
                    StoreCandidateTaskReadServiceSql.SELECT_ORG_NODE_WS_UUID_ALT_C_009
                            + StoreCandidateTaskReadServiceSql.GRP_WS_KEY_NODE_TYPE_ALT_C_010
                            + StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_STORE_PROJECT_ID_WORKSPACE_UUID
                            + StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_STATUS_ENABLED_ALTERNATE_A,
                    List.of(workspaceUuid, key, scope.targetId(), workspaceUuid, key));
            case BusinessEntityTypes.HEAD_COMPANY -> new SqlPart(
                    StoreCandidateTaskReadServiceSql.SELECT_ORG_NODE_WS_UUID_ALT_D_011
                            + StoreCandidateTaskReadServiceSql.GRP_WS_KEY_NODE_TYPE_ALT_D_012
                            + StoreCandidateTaskReadServiceSql.SELECT_STORE_PROJECT_ID_WS_ALT_A_013
                            + StoreCandidateTaskReadServiceSql.GRP_WS_KEY_HEAD_COMPANY_014,
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
                StoreCandidateTaskReadServiceSql.STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_STORE_CODE_NAME_ALTERNATE_B
                        + StoreCandidateTaskReadServiceSql
                                .STORE_CANDIDATE_TASK_READ_SERVICE_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + StoreCandidateTaskReadServiceSql
                                .STORE_CANDIDATE_TASK_READ_SERVICE_STORE_PROJECT_ID_TENANT_CODE
                        + StoreCandidateTaskReadServiceSql
                                .STORE_CANDIDATE_TASK_READ_SERVICE_ALTERNATIVE_STORE_TENANT_TENANT_ID
                        + StoreCandidateTaskReadServiceSql.STORE_WS_UUID_TENANT_WS_022
                        + StoreCandidateTaskReadServiceSql
                                .STORE_CANDIDATE_TASK_READ_SERVICE_WHERE_TENANT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + StoreCandidateTaskReadServiceSql
                                .STORE_CANDIDATE_TASK_READ_SERVICE_OPEN_PAREN_STORE_PROJECT_ID,
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
                    StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_COMMERCIAL_GROUP_COMMERCIAL_GROUP_UUID
                            + StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_COMMERCIAL_GROUP_COMMERCIAL_GROUP_CODE_CODE
                            + StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_COMMERCIAL_GROUP_COMMERCIAL_GROUP_NAME_NAME
                            + StoreCandidateTaskReadServiceSql.FROM_CLAUSE_COMMERCIAL_GRP_FROM_015
                            + StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_JOIN_GROUP_WORKSPACE_JOIN_PLATFORM_WORKSPACE_GROU
                            + StoreCandidateTaskReadServiceSql.JOIN_CONDITION_GRP_WS_COMMERCIAL_016
                            + StoreCandidateTaskReadServiceSql.WHERE_GRP_WS_UUID_GRP_017
                            + StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_CONDITION_COMMERCIAL_GROUP_GROUP_WORKSPACE_KEY,
                    List.of(workspaceUuid, key, key));
            case REGION, PROJECT -> new CandidateSql(
                    StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_ORGANIZATION_NODE_NODE_CODE_NAME
                            + StoreCandidateTaskReadServiceSql.WHERE_NODE_WS_UUID_GRP_018
                            + StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_CONDITION_NODE_STATUS_ENABLED,
                    List.of(workspaceUuid, key, query.subjectType().name()));
            case HEAD_COMPANY -> new CandidateSql(
                    StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_HEAD_COMPANY_CODE_NAME_ALTERNATE_A
                            + StoreCandidateTaskReadServiceSql.FROM_CLAUSE_HEAD_COMPANY_FROM_019
                            + StoreCandidateTaskReadServiceSql.WHERE_HEAD_COMPANY_WS_UUID_020
                            + StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_CONDITION_HEAD_COMPANY_STATUS_ENABLED,
                    List.of(workspaceUuid, key));
            case STORE -> new CandidateSql(
                    StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_STORE_CODE_NAME_ALTERNATE_C
                            + StoreCandidateTaskReadServiceSql.WHERE_STORE_WS_UUID_GRP_021
                            + StoreCandidateTaskReadServiceSql
                                    .STORE_CANDIDATE_TASK_READ_SERVICE_CONDITION_STORE_PROJECT_ID,
                    nullableArguments(workspaceUuid, key, query.projectId(), query.projectId()));
            default -> throw new BusinessEntityService.OrganizationNotFoundException();
        };
    }

    private static List<Object> nullableArguments(Object... values) {
        return java.util.Arrays.asList(values);
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
}
