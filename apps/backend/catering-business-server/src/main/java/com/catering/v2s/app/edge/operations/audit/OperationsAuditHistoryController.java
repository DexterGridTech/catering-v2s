package com.catering.v2s.app.edge.operations.audit;

import com.catering.v2s.audit.contract.AuditEntityTypes;
import com.catering.v2s.app.edge.audit.AuditHistoryWireMapper;
import com.catering.v2s.audit.read.OperationsAuditTaskReadService;
import com.catering.v2s.audit.read.OperationsAuditTaskReadService.OperationsAuditQuery;
import com.catering.v2s.app.edge.generated.wire.AuditHistoryPage;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditTarget;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Operations audit edge inherits the active workspace session and dispatches only to owner task readers. */
@RestController
@RequestMapping("/api/operations/audit-history")
public final class OperationsAuditHistoryController {
    private final OperationsSessionResolver sessions;
    private final OperationsAuditTaskReadService reads;

    public OperationsAuditHistoryController(
        OperationsSessionResolver sessions,
        OperationsAuditTaskReadService reads
    ) {
        this.sessions = sessions;
        this.reads = reads;
    }

    @GetMapping
    AuditHistoryPage history(EdgeRequestContext request, @RequestParam String groupWorkspaceKey, @RequestParam String entityType, @RequestParam String entityId, @RequestParam(defaultValue = "1") long page, @RequestParam(defaultValue = "20") long pageSize) {
        var facts = sessions.requireWorkspaceReadFacts(request, groupWorkspaceKey);
        validPage(page, pageSize);
        AuditTarget target = new AuditTarget(entityType, uuid(entityId).toString());
        var result = reads.read(facts, switch (entityType) {
            case "WORKSPACE_ACCOUNT" -> new OperationsAuditQuery.WorkspaceAccount(target, page, pageSize);
            case "WORKSPACE_INVITATION" -> new OperationsAuditQuery.WorkspaceInvitation(target, page, pageSize);
            case "COMMERCIAL_GROUP" -> new OperationsAuditQuery.CommercialGroup(target, page, pageSize);
            case "ORGANIZATION_NODE" -> new OperationsAuditQuery.OrganizationNode(target, page, pageSize);
            case "BRAND" -> new OperationsAuditQuery.Brand(target, page, pageSize);
            case "TENANT" -> new OperationsAuditQuery.Tenant(target, page, pageSize);
            case AuditEntityTypes.HEAD_COMPANY -> new OperationsAuditQuery.HeadCompany(target, page, pageSize);
            case AuditEntityTypes.STORE -> new OperationsAuditQuery.Store(target, page, pageSize);
            case "STORE_CONTRACT" -> new OperationsAuditQuery.StoreContract(target, page, pageSize);
            default -> throw new InvalidEdgeRequestException("unsupported operations audit target");
        });
        return AuditHistoryWireMapper.page(result);
    }

    private static UUID uuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (RuntimeException invalid) {
            throw new InvalidEdgeRequestException("audit target identifier is invalid");
        }
    }

    private static void validPage(long page, long pageSize) {
        if (page < 1 || pageSize < 1 || pageSize > 100) {
            throw new InvalidEdgeRequestException("audit page is invalid");
        }
        try {
            long offset = Math.multiplyExact(page - 1, pageSize);
            if (offset >= Long.MAX_VALUE - pageSize) {
                throw new ArithmeticException("audit page end is outside the supported range");
            }
        } catch (ArithmeticException overflow) {
            throw new InvalidEdgeRequestException("audit page is invalid");
        }
    }
}
