package com.catering.v2s.organization.application.persistence;

import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup.InvitationTargetType;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed persistence boundary for organization assignment and invitation candidates. */
@Repository
public class OrganizationAssignmentCandidatePersistence {
    private final JdbcTemplate jdbc;

    public OrganizationAssignmentCandidatePersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<UUID> enabledOrganizationNodeIds(UUID workspaceUuid, String groupWorkspaceKey, String serviceNodeType) {
        return jdbc.query(
                OrganizationAssignmentCandidateServiceSql
                                .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_SELECT_ORGANIZATION_NODE_WORKSPACE_UUID
                        + OrganizationAssignmentCandidateServiceSql
                                .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_GROUP_WORKSPACE_KEY_NODE_TYPE_STATUS_ENABLED,
                (row, index) -> row.getObject(1, UUID.class),
                workspaceUuid,
                groupWorkspaceKey,
                serviceNodeType);
    }

    public List<UUID> enabledEntityIds(UUID workspaceUuid, String groupWorkspaceKey, String serviceNodeType) {
        String table =
                switch (serviceNodeType) {
                    case "HEAD_COMPANY" -> "head_company";
                    case "STORE" -> "store";
                    default -> throw new IllegalArgumentException("unsupported assignment candidate type");
                };
        return jdbc.query(
                OrganizationAssignmentCandidateServiceSql.SELECT_ORG_SELECT_ID_FROM_001
                        + table
                        + OrganizationAssignmentCandidateServiceSql.WHERE_WS_UUID_GRP_WS_002
                        + OrganizationAssignmentCandidateServiceSql
                                .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_ORDER_BY_CODE,
                (row, index) -> row.getObject(1, UUID.class),
                workspaceUuid,
                groupWorkspaceKey);
    }

    public List<CandidateRow> invitationCandidateRows(
            UUID workspaceUuid,
            String groupWorkspaceKey,
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
                    OrganizationAssignmentCandidateServiceSql
                                    .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_SELECT_COMMERCIAL_GROUP_UUID
                            + OrganizationAssignmentCandidateServiceSql.COMMERCIAL_GRP_OVER_FROM_ORG_003
                            + OrganizationAssignmentCandidateServiceSql.WHERE_GRP_WS_KEY_COMMERCIAL_004
                            + OrganizationAssignmentCandidateServiceSql
                                    .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_CONDITION_COMMERCIAL_GROUP_UUID
                            + OrganizationAssignmentCandidateServiceSql.CONDITION_TEXT_COMMERCIAL_GRP_CODE_005
                            + OrganizationAssignmentCandidateServiceSql
                                    .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_COMMERCIAL_GROUP_NAME_ILIKE_ESCAPE
                            + OrganizationAssignmentCandidateServiceSql
                                    .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_ORDER_BY_COMMERCIAL_GROUP_CODE,
                    (row, index) -> new CandidateRow(
                            InvitationTargetType.GROUP, row.getObject(1, UUID.class), row.getString(2), row.getLong(3)),
                    groupWorkspaceKey,
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
                    groupWorkspaceKey,
                    targetType.name(),
                    requiredTargetId,
                    requiredTargetId,
                    candidateScopeId,
                    candidateScopeId,
                    pattern,
                    pattern,
                    pattern,
                    workspaceUuid,
                    groupWorkspaceKey,
                    pageSize,
                    offset);
            case HEAD_COMPANY -> jdbc.query(
                    OrganizationAssignmentCandidateServiceSql
                                    .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_SELECT_HEAD_COMPANY_CODE_NAME
                            + OrganizationAssignmentCandidateServiceSql.WHERE_WS_UUID_GRP_WS_ALT_A_006
                            + OrganizationAssignmentCandidateServiceSql
                                    .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_NULL_OR_ID
                            + OrganizationAssignmentCandidateServiceSql
                                    .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_CONDITION_AND_UUID_IS_NULL_OR_ID
                            + OrganizationAssignmentCandidateServiceSql
                                    .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_CONDITION_TEXT_CODE_ILIKE_ESCAPE
                            + OrganizationAssignmentCandidateServiceSql
                                    .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_ORDER_BY_CODE_ALTERNATE_A,
                    (row, index) -> new CandidateRow(
                            InvitationTargetType.HEAD_COMPANY,
                            row.getObject(1, UUID.class),
                            row.getString(2),
                            row.getLong(3)),
                    workspaceUuid,
                    groupWorkspaceKey,
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
                    groupWorkspaceKey,
                    requiredTargetId,
                    requiredTargetId,
                    pattern,
                    pattern,
                    pattern,
                    candidateScopeId,
                    candidateScopeId,
                    workspaceUuid,
                    groupWorkspaceKey,
                    workspaceUuid,
                    groupWorkspaceKey,
                    pageSize,
                    offset);
        };
    }

    private static String hierarchyCandidateSql() {
        return OrganizationAssignmentCandidateServiceSql.ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_CTE_CANDIDATES
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_SELECT_ORGANIZATION_NODE_PARENT_ID_CODE_NAME
                + OrganizationAssignmentCandidateServiceSql.WHERE_WS_UUID_GRP_WS_007
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_CONDITION_TEXT_CODE_ILIKE
                + OrganizationAssignmentCandidateServiceSql.ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_ESCAPE_NAME_ILIKE
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_CLOSE_PAREN_ANCESTRY
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_SELECT_CANDIDATES_TARGET_ID_PARENT_ID_CODE
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_CANDIDATES_NAME_DEPTH
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_UNION_ANCESTRY_TARGET_ID_PARENT_PARENT_ID
                + OrganizationAssignmentCandidateServiceSql.ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_ANCESTRY_DEPTH
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_FROM_CLAUSE_ANCESTRY_PARENT_PARENT_ID
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_WHERE_PARENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                + OrganizationAssignmentCandidateServiceSql.ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_CLOSE_PAREN_PATHS
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_SELECT_TARGET_ID_STRING_AGG_NAME_CODE
                + OrganizationAssignmentCandidateServiceSql.ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_ANCESTRY_TARGET_ID
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_CLOSE_PAREN_PATHS_DISPLAY_PATH
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_PATHS_TARGET_ID_CANDIDATES
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_ORDER_BY_CANDIDATES_CODE;
    }

    private static String storeCandidateSql() {
        return OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_CTE_CANDIDATES_ALTERNATE_A
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_SELECT_STORE_PROJECT_ID_CODE_NAME
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_WHERE_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_CONDITION_STORE_TEXT_CODE_ILIKE
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_STORE_NAME_ILIKE_ESCAPE
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_CLOSE_PAREN_ANCESTRY_ALTERNATE_A
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_SELECT_CANDIDATES_TARGET_ID_PROJECT_PARENT_ID
                + OrganizationAssignmentCandidateServiceSql.ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_CANDIDATES_DEPTH
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_JOIN_ORGANIZATION_NODE_PROJECT_CANDIDATES_PROJECT_ID
                + OrganizationAssignmentCandidateServiceSql.ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_PROJECT
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_PROJECT_STATUS_ENABLED
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_UNION_ANCESTRY_TARGET_ID_PARENT_PARENT_ID_ALTERNATE_A
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_ANCESTRY_DEPTH_ALTERNATE_A
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_FROM_CLAUSE_ANCESTRY_PARENT_PARENT_ID_ALTERNATE_A
                + OrganizationAssignmentCandidateServiceSql.WHERE_PARENT_WS_UUID_GRP_ALT_A_008
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_CLOSE_PAREN_PATHS_ALTERNATE_A
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_SELECT_TARGET_ID_STRING_AGG_NAME_CODE_ALTERNATE_A
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_ANCESTRY_TARGET_ID_ALTERNATE_A
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_CLOSE_PAREN_CANDIDATES_PATHS_PROJECT_PATH_NAME
                + OrganizationAssignmentCandidateServiceSql.ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_COUNT_OVER
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_FROM_CLAUSE_PATHS_TARGET_ID_CODE
                + OrganizationAssignmentCandidateServiceSql
                        .ORGANIZATION_ASSIGNMENT_CANDIDATE_SERVICE_PARAMETER_PLACEHOLDER;
    }

    public record CandidateRow(InvitationTargetType type, UUID id, String path, long total) {}
}
