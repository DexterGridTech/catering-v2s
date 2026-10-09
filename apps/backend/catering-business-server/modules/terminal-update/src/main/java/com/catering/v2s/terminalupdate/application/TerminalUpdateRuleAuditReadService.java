package com.catering.v2s.terminalupdate.application;

import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleAuditReadApi;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleAuditReadException;
import com.catering.v2s.terminalupdate.application.persistence.TerminalUpdateRuleAuditReadPersistence;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Rule-owner read for the existing bounded operations audit surface. */
@Service
public class TerminalUpdateRuleAuditReadService implements TerminalUpdateRuleAuditReadApi {
    private final TerminalUpdateRuleAuditReadPersistence persistence;

    public TerminalUpdateRuleAuditReadService(TerminalUpdateRuleAuditReadPersistence persistence) {
        this.persistence = Objects.requireNonNull(persistence, "persistence");
    }

    @Override
    @Transactional(readOnly = true)
    public AuditHistoryPage read(
            AuditReadScope scope, Set<UUID> visibleProjectRefs, UUID projectRef, UUID ruleRef, long page, long pageSize) {
        if (scope == null || visibleProjectRefs == null || projectRef == null || ruleRef == null
                || page < 1 || pageSize < 1 || pageSize > 100)
            throw new IllegalArgumentException("terminal-update rule audit query is invalid");
        var projection = persistence.read(scope, visibleProjectRefs, projectRef, ruleRef, page, pageSize);
        if (!projection.found()) throw new TerminalUpdateRuleAuditReadException(TerminalUpdateRuleAuditReadException.Kind.NOT_FOUND);
        if (!projection.authorized()) throw new TerminalUpdateRuleAuditReadException(TerminalUpdateRuleAuditReadException.Kind.NOT_AUTHORIZED);
        return new AuditHistoryPage(projection.items(), page, pageSize, projection.total());
    }
}
