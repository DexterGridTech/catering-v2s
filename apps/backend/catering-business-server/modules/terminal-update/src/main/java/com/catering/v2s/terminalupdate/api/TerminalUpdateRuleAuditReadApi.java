package com.catering.v2s.terminalupdate.api;

import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditReadScope;
import java.util.Set;
import java.util.UUID;

/** Bounded rule-owner audit projection consumed by the existing operations audit task reader. */
public interface TerminalUpdateRuleAuditReadApi {
    AuditHistoryPage read(
            AuditReadScope scope, Set<UUID> visibleProjectRefs, UUID projectRef, UUID ruleRef, long page, long pageSize);
}
