package com.catering.v2s.extension.application;

import com.catering.v2s.audit.contract.AuditHistoryItem;
import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditHistoryResultSetReader;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.extension.application.persistence.ExtensionAuditHistoryPersistence;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner-local reader for extension-definition revision history. */
@Service
public class ExtensionAuditHistoryService {
    private final ExtensionAuditHistoryPersistence persistence;

    @Autowired
    public ExtensionAuditHistoryService(ExtensionAuditHistoryPersistence persistence) {
        this.persistence = persistence;
    }

    /** Compatibility seam for owner-local callers that still construct the service with JDBC. */
    public ExtensionAuditHistoryService(JdbcTemplate jdbc) {
        this(new ExtensionAuditHistoryPersistence(jdbc));
    }

    @Transactional(readOnly = true)
    public AuditHistoryPage read(AuditReadScope scope, AuditTarget target, long page, long pageSize) {
        if (!"EXTENSION_DEFINITION".equals(target.entityType()) || page < 1 || pageSize < 1 || pageSize > 100)
            throw new IllegalArgumentException("unsupported extension audit target");
        if (!persistence.targetExists(scope.groupWorkspaceKey(), target.entityRef()))
            throw new ExtensionDefinitionService.DefinitionNotFoundException();
        long total = persistence.countEvents(scope, target);
        List<AuditHistoryItem> items = persistence.readPage(scope, target, pageSize, (page - 1) * pageSize);
        return new AuditHistoryPage(items, page, pageSize, total);
    }

    @Transactional(readOnly = true)
    public AuditHistoryPage readExtensionDefinition(AuditReadScope scope, String entityType, long page, long pageSize) {
        if (page < 1 || pageSize < 1 || pageSize > 100)
            throw new IllegalArgumentException("unsupported extension audit target");
        long offset = Math.multiplyExact(page - 1, pageSize);
        AuditHistoryResultSetReader.TargetProjection value =
                persistence.readExtensionDefinition(scope, entityType, pageSize, offset);
        if (!value.targetExists()) throw new ExtensionDefinitionService.DefinitionNotFoundException();
        return new AuditHistoryPage(value.items(), page, pageSize, value.total());
    }
}
