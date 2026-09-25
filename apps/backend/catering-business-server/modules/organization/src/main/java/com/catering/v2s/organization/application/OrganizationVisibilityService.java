package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.OrganizationVisibilityLookup;
import com.catering.v2s.organization.application.persistence.OrganizationVisibilityPersistence;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Organization visibility judgments backed by one typed owner persistence boundary. */
@Service
public class OrganizationVisibilityService implements OrganizationVisibilityLookup {
    private final OrganizationVisibilityPersistence persistence;

    @Autowired
    public OrganizationVisibilityService(OrganizationVisibilityPersistence persistence) {
        this.persistence = persistence;
    }

    /** Compatibility constructor for existing lightweight owner tests. */
    public OrganizationVisibilityService(JdbcTemplate jdbc) {
        this(new OrganizationVisibilityPersistence(jdbc));
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isVisibleDataNodeAllowed(
            UUID workspaceUuid, String key, String assignmentType, UUID assignmentNode, UUID visibleNode) {
        return persistence.isVisibleDataNodeAllowed(workspaceUuid, key, assignmentType, assignmentNode, visibleNode);
    }

    @Override
    @Transactional(readOnly = true)
    public List<VisibleDataNodeCandidate> listVisibleDataNodeCandidates(
            UUID workspaceUuid, String key, String assignmentNodeType, UUID assignmentNodeId) {
        return persistence.listVisibleDataNodeCandidates(workspaceUuid, key, assignmentNodeType, assignmentNodeId);
    }

    @Override
    @Transactional(readOnly = true)
    public VisibleOrganizationFacts resolveSessionEntryFacts(
            UUID workspaceUuid,
            String key,
            String assignmentNodeType,
            UUID assignmentNodeId,
            UUID regionId,
            UUID projectId,
            UUID storeId,
            UUID headCompanyId) {
        return persistence.resolveSessionEntryFacts(
                workspaceUuid, key, assignmentNodeType, assignmentNodeId, regionId, projectId, storeId, headCompanyId);
    }

    @Override
    @Transactional(readOnly = true)
    public ScopeContext describeScopeContext(
            UUID workspaceUuid, String key, UUID regionId, UUID projectId, UUID storeId, UUID headCompanyId) {
        return persistence.describeScopeContext(workspaceUuid, key, regionId, projectId, storeId, headCompanyId);
    }
}
