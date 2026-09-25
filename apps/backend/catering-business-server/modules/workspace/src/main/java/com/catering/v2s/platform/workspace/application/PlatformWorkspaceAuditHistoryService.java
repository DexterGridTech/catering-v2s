package com.catering.v2s.platform.workspace.application;

import com.catering.v2s.audit.contract.AuditHistoryItem;
import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.organization.api.CommercialGroupInitializationAuditLookup;
import com.catering.v2s.platform.workspace.application.persistence.PlatformWorkspaceAuditHistoryPersistence;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner-local task reader for group-workspace audit facts after the host scope is authorized. */
@Service
public class PlatformWorkspaceAuditHistoryService {
    private final PlatformWorkspaceAuditHistoryPersistence persistence;
    private final CommercialGroupInitializationAuditLookup commercialGroupAudit;

    public PlatformWorkspaceAuditHistoryService(
            PlatformWorkspaceAuditHistoryPersistence persistence,
            CommercialGroupInitializationAuditLookup commercialGroupAudit) {
        this.persistence = persistence;
        this.commercialGroupAudit = commercialGroupAudit;
    }

    /** Typed platform-audit projection keyed by the stable group-workspace business key. */
    @Transactional(readOnly = true)
    public AuditHistoryPage readGroupWorkspace(
            AuditReadScope scope, String groupWorkspaceKey, long page, long pageSize) {
        if (page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("unsupported audit target");
        long offset = Math.multiplyExact(page - 1, pageSize);
        long fetchSize = Math.addExact(offset, pageSize);
        PlatformWorkspaceAuditHistoryPersistence.GroupWorkspaceProjection own =
                persistence.readGroupWorkspace(scope, groupWorkspaceKey, fetchSize);
        if (!own.targetExists()) throw new WorkspaceAdministrationService.WorkspaceNotFoundException();
        AuditHistoryPage organization =
                commercialGroupAudit.readInitializationForGroupWorkspace(scope, own.auditRef(), 1, 1);
        List<AuditHistoryItem> items = java.util.stream.Stream.concat(
                        own.items().stream(), organization.items().stream())
                .sorted(Comparator.comparingLong(AuditHistoryItem::occurredAtEpochMillis)
                        .reversed()
                        .thenComparing(AuditHistoryItem::id, Comparator.reverseOrder()))
                .skip(offset)
                .limit(pageSize)
                .toList();
        return new AuditHistoryPage(items, page, pageSize, own.total() + organization.total());
    }
}
