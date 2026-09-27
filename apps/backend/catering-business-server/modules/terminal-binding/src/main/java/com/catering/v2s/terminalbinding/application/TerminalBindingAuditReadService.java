package com.catering.v2s.terminalbinding.application;

import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.terminalbinding.api.TerminalBindingAuditReadApi;
import com.catering.v2s.terminalbinding.api.TerminalBindingAuditReadException;
import com.catering.v2s.terminalbinding.persistence.TerminalBindingAuditReadPersistence;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Binding-owner task read for the existing bounded operations audit surface. */
@Service
public class TerminalBindingAuditReadService implements TerminalBindingAuditReadApi {
    private final TerminalBindingAuditReadPersistence persistence;

    public TerminalBindingAuditReadService(TerminalBindingAuditReadPersistence persistence) {
        this.persistence = Objects.requireNonNull(persistence, "persistence");
    }

    @Override
    @Transactional(readOnly = true)
    public AuditHistoryPage read(
            AuditReadScope scope, Set<UUID> visibleStoreRefs, UUID terminalRef, long page, long pageSize) {
        if (scope == null
                || visibleStoreRefs == null
                || terminalRef == null
                || page < 1
                || pageSize < 1
                || pageSize > 100) {
            throw new IllegalArgumentException("terminal-binding audit query is invalid");
        }
        var projection = persistence.read(scope, visibleStoreRefs, terminalRef, page, pageSize);
        if (!projection.found()) {
            throw new TerminalBindingAuditReadException(TerminalBindingAuditReadException.Kind.NOT_FOUND);
        }
        if (!projection.authorized()) {
            throw new TerminalBindingAuditReadException(TerminalBindingAuditReadException.Kind.NOT_AUTHORIZED);
        }
        return new AuditHistoryPage(projection.items(), page, pageSize, projection.total());
    }
}
