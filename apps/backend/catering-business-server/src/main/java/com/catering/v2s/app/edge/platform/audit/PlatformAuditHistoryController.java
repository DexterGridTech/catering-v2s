package com.catering.v2s.app.edge.platform.audit;

import com.catering.v2s.app.edge.audit.AuditHistoryWireMapper;
import com.catering.v2s.app.edge.generated.wire.AuditHistoryPage;
import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.audit.read.PlatformAuditHistoryTaskReadService;
import com.catering.v2s.audit.read.PlatformAuditHistoryTaskReadService.PlatformAuditHistoryQuery;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Platform audit edge: authorization is resolved before dispatching the owner task read. */
@RestController
@RequestMapping("/api/platform/audit-history")
public final class PlatformAuditHistoryController {
    private final PlatformSessionResolver sessions;
    private final PlatformAuditHistoryTaskReadService reads;

    public PlatformAuditHistoryController(PlatformSessionResolver sessions, PlatformAuditHistoryTaskReadService reads) {
        this.sessions = sessions;
        this.reads = reads;
    }

    @GetMapping
    AuditHistoryPage history(
            EdgeRequestContext request,
            @RequestParam(required = false) String groupWorkspaceKey,
            @RequestParam String entityType,
            @RequestParam String entityId,
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "20") long pageSize) {
        var readFacts = sessions.requireRead(request);
        validPage(page, pageSize);
        AuditTarget target = new AuditTarget(entityType, targetRef(entityType, entityId));
        var result = reads.read(
                readFacts.session(),
                switch (entityType) {
                    case "GROUP_WORKSPACE" -> new PlatformAuditHistoryQuery.GroupWorkspace(target, page, pageSize);
                    case "PLATFORM_ADMIN" -> new PlatformAuditHistoryQuery.PlatformAdmin(target, page, pageSize);
                    case "WORKSPACE_ROLE" -> new PlatformAuditHistoryQuery.WorkspaceRole(
                            target, requiredWorkspaceKey(groupWorkspaceKey), page, pageSize);
                    case "WORKSPACE_ACCOUNT" -> new PlatformAuditHistoryQuery.WorkspaceAccount(
                            target, requiredWorkspaceKey(groupWorkspaceKey), page, pageSize);
                    case "WORKSPACE_INVITATION" -> new PlatformAuditHistoryQuery.WorkspaceInvitation(
                            target, requiredWorkspaceKey(groupWorkspaceKey), page, pageSize);
                    case "EXTENSION_DEFINITION" -> new PlatformAuditHistoryQuery.ExtensionDefinition(
                            target, requiredWorkspaceKey(groupWorkspaceKey), page, pageSize);
                    case "STORE_CONTRACT" -> new PlatformAuditHistoryQuery.StoreContract(
                            target, requiredWorkspaceKey(groupWorkspaceKey), page, pageSize);
                    default -> throw new InvalidEdgeRequestException("unsupported platform audit target");
                });
        return AuditHistoryWireMapper.page(result);
    }

    private static String requiredWorkspaceKey(String groupWorkspaceKey) {
        if (groupWorkspaceKey == null || groupWorkspaceKey.isBlank()) {
            throw new InvalidEdgeRequestException("audit host target requires group workspace key");
        }
        return groupWorkspaceKey;
    }

    private static String targetRef(String entityType, String entityId) {
        if ("GROUP_WORKSPACE".equals(entityType) || "EXTENSION_DEFINITION".equals(entityType)) {
            if (entityId == null || entityId.isBlank())
                throw new InvalidEdgeRequestException("audit target identifier is invalid");
            return entityId;
        }
        try {
            return UUID.fromString(entityId).toString();
        } catch (RuntimeException invalid) {
            throw new InvalidEdgeRequestException("audit target identifier is invalid", invalid);
        }
    }

    private static void validPage(long page, long pageSize) {
        if (page < 1 || pageSize < 1 || pageSize > 100) throw new InvalidEdgeRequestException("audit page is invalid");
        try {
            long offset = Math.multiplyExact(page - 1, pageSize);
            if (offset >= Long.MAX_VALUE - pageSize) {
                throw new ArithmeticException("audit page end is outside the supported range");
            }
        } catch (ArithmeticException overflow) {
            throw new InvalidEdgeRequestException("audit page is invalid", overflow);
        }
    }
}
