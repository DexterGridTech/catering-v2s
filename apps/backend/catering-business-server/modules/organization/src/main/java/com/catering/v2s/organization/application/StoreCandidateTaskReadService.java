package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.WorkspaceAssignmentScopeLookup;
import com.catering.v2s.organization.application.persistence.StoreCandidateTaskReadPersistence;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read model for the store editor backed by a typed owner persistence boundary. */
@Service
public class StoreCandidateTaskReadService {
    private final StoreCandidateTaskReadPersistence persistence;

    @Autowired
    public StoreCandidateTaskReadService(StoreCandidateTaskReadPersistence persistence) {
        this.persistence = persistence;
    }

    /** Compatibility constructor for existing lightweight owner tests. */
    public StoreCandidateTaskReadService(
            JdbcTemplate jdbc, WorkspaceAssignmentScopeLookup assignmentScopes, OrganizationTaskPathLookup taskPaths) {
        this(new StoreCandidateTaskReadPersistence(jdbc, assignmentScopes, taskPaths));
    }

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
        return persistence.candidatePage(
                workspaceUuid,
                key,
                assignmentId,
                visibleNodeId,
                subjectType,
                queryText,
                page,
                pageSize,
                selectedId,
                projectId,
                brandId,
                tenantId);
    }

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
        return persistence.candidatePage(
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
                tenantId);
    }

    @Transactional(readOnly = true)
    public CandidatePage platformContractCandidatePage(
            UUID workspaceUuid, String key, PlatformContractCandidateQuery query) {
        return persistence.platformContractCandidatePage(workspaceUuid, key, query);
    }

    @Transactional(readOnly = true)
    public CandidatePage platformExternalBindingCandidatePage(
            UUID workspaceUuid, String key, PlatformContractCandidateQuery query) {
        return persistence.platformExternalBindingCandidatePage(workspaceUuid, key, query);
    }

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
        return persistence.operationsCandidatePage(
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
                tenantId);
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

    public record CandidatePage(CandidateQueryMetadata metadata, List<Candidate> items) {}

    public record CandidateQueryMetadata(
            String subjectType, String queryText, int page, int pageSize, long total, UUID selectedId) {}

    public record Candidate(UUID id, String code, String name, String path) {}
}
