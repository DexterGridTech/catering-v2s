package com.catering.v2s.terminalcontrol.api;

import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditReadScope;
import java.util.Set;
import java.util.UUID;

/** Bounded session-owner audit projection consumed by the existing operations audit reader. */
public interface TerminalRemoteControlAuditReadApi {
    AuditHistoryPage read(
            AuditReadScope scope, Set<UUID> visibleProjectRefs, UUID projectRef, UUID sessionId,
            long page, long pageSize);
}
