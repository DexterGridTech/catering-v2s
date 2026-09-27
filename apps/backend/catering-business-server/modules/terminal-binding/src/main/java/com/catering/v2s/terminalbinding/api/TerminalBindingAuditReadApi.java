package com.catering.v2s.terminalbinding.api;

import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditReadScope;
import java.util.Set;
import java.util.UUID;

/** Bounded terminal-binding audit projection consumed by the shared operations audit reader. */
public interface TerminalBindingAuditReadApi {
    AuditHistoryPage read(AuditReadScope scope, Set<UUID> visibleStoreRefs, UUID terminalRef, long page, long pageSize);
}
