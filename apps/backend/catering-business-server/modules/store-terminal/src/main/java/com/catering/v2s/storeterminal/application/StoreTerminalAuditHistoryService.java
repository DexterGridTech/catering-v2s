package com.catering.v2s.storeterminal.application;

import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.organization.api.OrganizationVisibilityLookup.VisibleOrganizationFacts;
import com.catering.v2s.storeterminal.persistence.StoreTerminalAuditHistoryPersistence;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Store-terminal owner projection for the existing operations audit-history surface. */
@Service
public class StoreTerminalAuditHistoryService {
    private final StoreTerminalAuditHistoryPersistence persistence;

    public StoreTerminalAuditHistoryService(StoreTerminalAuditHistoryPersistence persistence) {
        this.persistence = Objects.requireNonNull(persistence, "persistence");
    }

    @Transactional(readOnly = true)
    public AuditHistoryPage readOperationsAuditProjection(
            AuditReadScope scope, VisibleOrganizationFacts visibleFacts, AuditTarget target, long page, long pageSize) {
        if (scope == null
                || visibleFacts == null
                || target == null
                || !"STORE_TERMINAL".equals(target.entityType())
                || page < 1
                || pageSize < 1
                || pageSize > 100) {
            throw new IllegalArgumentException("unsupported operations store-terminal audit target");
        }
        return persistence.readOperationsAuditProjection(
                scope, visibleFacts, target, parseRef(target.entityRef()), page, pageSize);
    }

    private static UUID parseRef(String value) {
        try {
            return UUID.fromString(value);
        } catch (RuntimeException invalid) {
            throw new IllegalArgumentException("operations audit target must be a UUID", invalid);
        }
    }

    public static final class TerminalNotFoundException extends RuntimeException {
        public TerminalNotFoundException() {}

        public TerminalNotFoundException(Throwable cause) {
            super("store-terminal audit target was not found", cause);
        }
    }

    public static final class TerminalAuthorizationException extends RuntimeException {
        public TerminalAuthorizationException() {}

        public TerminalAuthorizationException(Throwable cause) {
            super("store-terminal audit access was denied", cause);
        }
    }
}
