package com.catering.v2s.organization.application;

import com.catering.v2s.organization.application.persistence.OrganizationAuditHistoryPersistence;
import com.catering.v2s.audit.contract.*;
import com.catering.v2s.audit.contract.AuditEntityTypes;
import com.catering.v2s.organization.api.CommercialGroupInitializationAuditLookup;
import com.catering.v2s.organization.api.OrganizationVisibilityLookup.VisibleOrganizationFacts;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner-local reader for organization-node and business-entity audit facts. */
@Service
public class OrganizationAuditHistoryService implements CommercialGroupInitializationAuditLookup {
    private final OrganizationAuditHistoryPersistence persistence;

    @Autowired
    public OrganizationAuditHistoryService(OrganizationAuditHistoryPersistence persistence) {
        this.persistence = persistence;
    }

    /** Compatibility constructor for existing lightweight owner tests. */
    public OrganizationAuditHistoryService(JdbcTemplate jdbc) {
        this(new OrganizationAuditHistoryPersistence(jdbc));
    }

    @Transactional(readOnly = true)
    public AuditHistoryPage read(AuditReadScope scope, AuditTarget target, long page, long pageSize) {
        return persistence.read(scope, target, page, pageSize);
    }

    @Override
    @Transactional(readOnly = true)
    public AuditHistoryPage readInitializationForGroupWorkspace(
            AuditReadScope scope, String entityRef, long page, long pageSize) {
        return persistence.readInitializationForGroupWorkspace(scope, entityRef, page, pageSize);
    }

    /** Reads only the initialization fact owned by the selected commercial group, never the wider workspace history. */
    @Transactional(readOnly = true)
    public AuditHistoryPage readCommercialGroup(AuditReadScope scope, AuditTarget target, long page, long pageSize) {
        return persistence.readCommercialGroup(scope, target, page, pageSize);
    }

    /**
     * The closed operations-audit projection. Visible facts are invocation-scoped read facts, not a permission cache;
     * all target, host and page decisions remain in this organization statement.
     */
    @Transactional(readOnly = true)
    public AuditHistoryPage readOperationsAuditProjection(
            AuditReadScope scope,
            String assignmentNodeType,
            VisibleOrganizationFacts visibleFacts,
            AuditTarget target,
            long page,
            long pageSize) {
        if (scope == null
                || visibleFacts == null
                || target == null
                || !Set.of(
                                "COMMERCIAL_GROUP",
                                "ORGANIZATION_NODE",
                                "BRAND",
                                "TENANT",
                                AuditEntityTypes.HEAD_COMPANY,
                                AuditEntityTypes.STORE)
                        .contains(target.entityType())
                || page < 1
                || pageSize < 1
                || pageSize > 100)
            throw new IllegalArgumentException("unsupported operations organization audit target");
        AuditHistoryResultSetReader.AuthorizedProjection value = persistence.readOperationsAuditProjection(
                scope, assignmentNodeType, visibleFacts, target, page, pageSize);
        if (!value.found()) throw new BusinessEntityService.OrganizationNotFoundException();
        if (!value.authorized()) throw new OrganizationHierarchyService.OrganizationAuthorizationException();
        return new AuditHistoryPage(value.items(), page, pageSize, value.total());
    }
}
