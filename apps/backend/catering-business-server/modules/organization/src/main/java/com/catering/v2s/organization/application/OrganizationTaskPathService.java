package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup.PersistedStoreFact;
import com.catering.v2s.organization.application.persistence.OrganizationTaskPathPersistence;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Resolves organization-owned task facts through a typed persistence boundary. */
@Service
public class OrganizationTaskPathService implements OrganizationTaskPathLookup {
    private final OrganizationTaskPathPersistence persistence;

    @Autowired
    public OrganizationTaskPathService(OrganizationTaskPathPersistence persistence) {
        this.persistence = persistence;
    }

    /** Compatibility constructor for existing lightweight owner tests. */
    public OrganizationTaskPathService(JdbcTemplate jdbc, CommercialGroupLookup groups) {
        this(new OrganizationTaskPathPersistence(jdbc, groups));
    }

    @Override
    @Transactional(readOnly = true)
    public TaskPath requireGroupTaskPath(UUID workspaceUuid, String key) {
        return persistence.requireGroupTaskPath(workspaceUuid, key);
    }

    @Override
    @Transactional(readOnly = true)
    public TaskPath requireTaskPath(UUID workspaceUuid, String key, String targetType, UUID targetId) {
        return persistence.requireTaskPath(workspaceUuid, key, targetType, targetId);
    }

    @Override
    public StoreProjectCommandFacts requireStoreProjectCommandFacts(UUID workspaceUuid, String key, UUID storeId) {
        return persistence.requireStoreProjectCommandFacts(workspaceUuid, key, storeId);
    }

    @Override
    public Map<UUID, UUID> requireStoreProjectMemberships(UUID workspaceUuid, String key, List<UUID> storeIds) {
        return persistence.requireStoreProjectMemberships(workspaceUuid, key, storeIds);
    }

    @Override
    @Transactional(readOnly = true)
    public CatalogCommandScopeFacts resolveCatalogCommandScopeFacts(
            UUID workspaceUuid,
            String key,
            String targetType,
            UUID targetId,
            CatalogScopeLookup.CatalogBrandSelection selection) {
        return persistence.resolveCatalogCommandScopeFacts(workspaceUuid, key, targetType, targetId, selection);
    }

    @Override
    @Transactional(readOnly = true)
    public TaskPath requireStatusTransitionTaskPath(UUID workspaceUuid, String key, String targetType, UUID targetId) {
        return persistence.requireStatusTransitionTaskPath(workspaceUuid, key, targetType, targetId);
    }

    @Override
    @Transactional(readOnly = true)
    public TaskPath requireTaskPathAllowingDisabledTarget(
            UUID workspaceUuid, String key, String targetType, UUID targetId) {
        return persistence.requireTaskPathAllowingDisabledTarget(workspaceUuid, key, targetType, targetId);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<TaskPathRef, TaskPath> requireTaskPaths(UUID workspaceUuid, String key, List<TaskPathRef> targets) {
        return persistence.requireTaskPaths(workspaceUuid, key, targets);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<TaskPathRef, TaskPath> describePersistedTaskPaths(
            UUID workspaceUuid, String key, List<TaskPathRef> targets) {
        return persistence.describePersistedTaskPaths(workspaceUuid, key, targets);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, PersistedStoreFact> describePersistedStoresInProject(
            UUID workspaceUuid, String key, UUID projectRef, List<UUID> storeRefs) {
        return persistence.describePersistedStoresInProject(workspaceUuid, key, projectRef, storeRefs);
    }

    @Override
    @Transactional(readOnly = true)
    public Set<TaskPathRef> availableTaskTargets(UUID workspaceUuid, String key, List<TaskPathRef> targets) {
        return persistence.availableTaskTargets(workspaceUuid, key, targets);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<TaskPathRef, String> describeTaskTargetLabels(
            UUID workspaceUuid, String key, List<TaskPathRef> targets) {
        return persistence.describeTaskTargetLabels(workspaceUuid, key, targets);
    }

    @Override
    @Transactional(readOnly = true)
    public SessionTaskTargetFacts sessionTaskTargetFacts(UUID workspaceUuid, String key, List<TaskPathRef> targets) {
        return persistence.sessionTaskTargetFacts(workspaceUuid, key, targets);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isScopeAllowed(
            UUID workspaceUuid, String key, String assignmentType, UUID assignmentId, TaskPath target) {
        return persistence.isScopeAllowed(workspaceUuid, key, assignmentType, assignmentId, target);
    }

    @Override
    @Transactional(readOnly = true)
    public CommandTaskPathFacts commandTaskPathFacts(
            UUID workspaceUuid,
            String key,
            String assignmentType,
            UUID assignmentId,
            String targetType,
            UUID targetId,
            boolean statusTransition) {
        return persistence.commandTaskPathFacts(
                workspaceUuid, key, assignmentType, assignmentId, targetType, targetId, statusTransition);
    }

    public static final class TaskPathNotFoundException extends RuntimeException {}
}
