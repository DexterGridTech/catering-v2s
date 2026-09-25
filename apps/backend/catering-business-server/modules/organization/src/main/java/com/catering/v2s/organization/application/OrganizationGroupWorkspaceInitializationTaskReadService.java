package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.CommercialGroupReadback;
import com.catering.v2s.organization.api.OrganizationGroupWorkspaceInitializationLookup;
import com.catering.v2s.organization.application.persistence.OrganizationGroupWorkspaceInitializationPersistence;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Bounded organization-only initialization facts; never reads platform_workspace. */
@Service
public class OrganizationGroupWorkspaceInitializationTaskReadService
        implements OrganizationGroupWorkspaceInitializationLookup {
    private final OrganizationGroupWorkspaceInitializationPersistence persistence;

    @Autowired
    public OrganizationGroupWorkspaceInitializationTaskReadService(
            OrganizationGroupWorkspaceInitializationPersistence persistence) {
        this.persistence = persistence;
    }

    /** Compatibility constructor for existing lightweight owner tests. */
    public OrganizationGroupWorkspaceInitializationTaskReadService(JdbcTemplate jdbc) {
        this(new OrganizationGroupWorkspaceInitializationPersistence(jdbc));
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, InitializationState> listInitializationFacts(List<String> groupWorkspaceKeys) {
        if (groupWorkspaceKeys == null || groupWorkspaceKeys.isEmpty()) return Map.of();
        return persistence.listInitializationFacts(groupWorkspaceKeys);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CommercialGroupReadback> initializationFact(String groupWorkspaceKey) {
        return persistence.initializationFact(groupWorkspaceKey);
    }
}
