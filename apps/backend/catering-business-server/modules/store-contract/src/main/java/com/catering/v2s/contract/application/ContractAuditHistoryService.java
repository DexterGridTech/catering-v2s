package com.catering.v2s.contract.application;

import com.catering.v2s.audit.contract.*;
import com.catering.v2s.contract.application.persistence.ContractAuditHistoryPersistence;
import com.catering.v2s.organization.api.OrganizationVisibilityLookup.VisibleOrganizationFacts;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner-local reader for store-contract audit facts. */
@Service
public class ContractAuditHistoryService {
    private final ContractAuditHistoryPersistence persistence;

    public ContractAuditHistoryService(org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this(new ContractAuditHistoryPersistence(jdbc));
    }

    @org.springframework.beans.factory.annotation.Autowired
    public ContractAuditHistoryService(ContractAuditHistoryPersistence persistence) {
        this.persistence = persistence;
    }

    @Transactional(readOnly = true)
    public AuditHistoryPage read(AuditReadScope scope, AuditTarget target, long page, long pageSize) {
        if (!"STORE_CONTRACT".equals(target.entityType()) || page < 1 || pageSize < 1 || pageSize > 100)
            throw new IllegalArgumentException("unsupported contract audit target");
        return persistence.read(scope, target, page, pageSize);
    }

    @Transactional(readOnly = true)
    public AuditHistoryPage readStoreContract(AuditReadScope scope, String contractId, long page, long pageSize) {
        if (page < 1 || pageSize < 1 || pageSize > 100)
            throw new IllegalArgumentException("unsupported contract audit target");
        return persistence.readStoreContract(scope, contractId, page, pageSize);
    }

    /** Contract owner projection: only preloaded visible-store facts may establish host scope. */
    @Transactional(readOnly = true)
    public AuditHistoryPage readOperationsAuditProjection(
            AuditReadScope scope, VisibleOrganizationFacts visibleFacts, AuditTarget target, long page, long pageSize) {
        if (scope == null
                || visibleFacts == null
                || target == null
                || !"STORE_CONTRACT".equals(target.entityType())
                || page < 1
                || pageSize < 1
                || pageSize > 100) throw new IllegalArgumentException("unsupported operations contract audit target");
        return persistence.readOperationsAuditProjection(
                scope, visibleFacts, target, uuid(target.entityRef()), page, pageSize);
    }

    private static UUID uuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (RuntimeException invalid) {
            throw new IllegalArgumentException("operations audit target must be a UUID", invalid);
        }
    }
}
