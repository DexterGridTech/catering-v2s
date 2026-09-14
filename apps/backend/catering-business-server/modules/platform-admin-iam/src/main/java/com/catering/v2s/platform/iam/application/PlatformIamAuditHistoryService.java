package com.catering.v2s.platform.iam.application;

import com.catering.v2s.audit.contract.*;
import com.catering.v2s.platform.iam.application.persistence.PlatformIamAuditHistoryPersistence;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Global owner-local reader for platform-admin audit facts; it does not grant operations access. */
@Service
public class PlatformIamAuditHistoryService {
    private final PlatformIamAuditHistoryPersistence persistence;

    @Autowired
    public PlatformIamAuditHistoryService(PlatformIamAuditHistoryPersistence persistence) {
        this.persistence = persistence;
    }

    /** Test-only compatibility constructor; production injects the typed persistence boundary. */
    public PlatformIamAuditHistoryService(JdbcTemplate jdbc) {
        this(new PlatformIamAuditHistoryPersistence(jdbc));
    }

    @Transactional(readOnly = true)
    public AuditHistoryPage read(AuditTarget target, long page, long pageSize) {
        if (!"PLATFORM_ADMIN".equals(target.entityType()) || page < 1 || pageSize < 1 || pageSize > 100)
            throw new IllegalArgumentException("unsupported platform IAM audit target");
        if (!persistence.administratorExists(target.entityRef()))
            throw new PlatformAuthenticationService.PlatformAdminNotFoundException();
        long total = persistence.countEvents(target.entityRef());
        List<AuditHistoryItem> items = persistence.readPage(target.entityRef(), pageSize, (page - 1) * pageSize);
        return new AuditHistoryPage(items, page, pageSize, total);
    }
    /** Typed global projection: intentionally has no workspace scope argument. */
    @Transactional(readOnly = true)
    public AuditHistoryPage readPlatformAdmin(String platformAdminId, long page, long pageSize) {
        if (page < 1 || pageSize < 1 || pageSize > 100)
            throw new IllegalArgumentException("unsupported platform IAM audit target");
        long offset = Math.multiplyExact(page - 1, pageSize);
        AuditHistoryResultSetReader.TargetProjection value = persistence.readTargetPage(platformAdminId, pageSize, offset);
        if (!value.targetExists()) throw new PlatformAuthenticationService.PlatformAdminNotFoundException();
        return new AuditHistoryPage(value.items(), page, pageSize, value.total());
    }
}
