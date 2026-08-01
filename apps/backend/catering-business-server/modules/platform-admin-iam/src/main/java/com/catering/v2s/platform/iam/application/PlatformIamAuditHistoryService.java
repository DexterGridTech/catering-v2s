package com.catering.v2s.platform.iam.application;

import com.catering.v2s.audit.contract.*;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Global owner-local reader for platform-admin audit facts; it does not grant operations access. */
@Service public class PlatformIamAuditHistoryService {
  private final JdbcTemplate jdbc; public PlatformIamAuditHistoryService(JdbcTemplate jdbc) { this.jdbc = jdbc; }
  @Transactional(readOnly = true) public AuditHistoryPage read(AuditTarget target, long page, long pageSize) {
    if (!"PLATFORM_ADMIN".equals(target.entityType()) || page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("unsupported platform IAM audit target");
    Boolean exists = jdbc.query("SELECT EXISTS(SELECT 1 FROM platform_iam.platform_admin WHERE id::text=?)", statement -> statement.setString(1, target.entityRef()), result -> result.next() && result.getBoolean(1));
    if (!Boolean.TRUE.equals(exists)) throw new PlatformAuthenticationService.PlatformAdminNotFoundException();
    long total = jdbc.queryForObject("SELECT count(*) FROM platform_iam.audit_event WHERE entity_type='PLATFORM_ADMIN' AND entity_ref_text=?", Long.class, target.entityRef());
    List<AuditHistoryItem> items = jdbc.query("SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text, changes_json::text FROM platform_iam.audit_event WHERE entity_type='PLATFORM_ADMIN' AND entity_ref_text=? ORDER BY occurred_at_epoch_millis DESC, id DESC LIMIT ? OFFSET ?", (r, n) -> new AuditHistoryItem(r.getObject("id", UUID.class), r.getLong("occurred_at_epoch_millis"), r.getString("actor_display_snapshot"), r.getString("action"), new AuditTarget(r.getString("entity_type"), r.getString("entity_ref_text")), AuditChangeJson.read(r.getString("changes_json"))), target.entityRef(), pageSize, (page - 1) * pageSize);
    return new AuditHistoryPage(items, page, pageSize, total);
  }
}
