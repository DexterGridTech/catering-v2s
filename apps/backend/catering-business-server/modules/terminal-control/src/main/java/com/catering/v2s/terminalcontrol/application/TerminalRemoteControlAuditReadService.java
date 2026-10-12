package com.catering.v2s.terminalcontrol.application;

import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlAuditReadApi;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlAuditReadException;
import com.catering.v2s.terminalcontrol.application.persistence.TerminalRemoteControlAuditReadPersistence;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Session-owner audit reader restricted to visible projects and the session's owning scope. */
@Service
public class TerminalRemoteControlAuditReadService implements TerminalRemoteControlAuditReadApi {
    private final TerminalRemoteControlAuditReadPersistence persistence;

    public TerminalRemoteControlAuditReadService(TerminalRemoteControlAuditReadPersistence persistence) {
        this.persistence = Objects.requireNonNull(persistence, "persistence");
    }

    @Override
    @Transactional(readOnly = true)
    public AuditHistoryPage read(
            AuditReadScope scope, Set<UUID> visibleProjectRefs, UUID projectRef, UUID sessionId,
            long page, long pageSize) {
        if (scope == null || visibleProjectRefs == null || projectRef == null || sessionId == null
                || page < 1 || pageSize < 1 || pageSize > 100)
            throw new IllegalArgumentException("terminal remote-control audit query is invalid");
        var projection = persistence.read(scope, visibleProjectRefs, projectRef, sessionId, page, pageSize);
        if (!projection.found())
            throw new TerminalRemoteControlAuditReadException(TerminalRemoteControlAuditReadException.Kind.NOT_FOUND);
        if (!projection.authorized())
            throw new TerminalRemoteControlAuditReadException(TerminalRemoteControlAuditReadException.Kind.NOT_AUTHORIZED);
        return new AuditHistoryPage(projection.items(), page, pageSize, projection.total());
    }
}
