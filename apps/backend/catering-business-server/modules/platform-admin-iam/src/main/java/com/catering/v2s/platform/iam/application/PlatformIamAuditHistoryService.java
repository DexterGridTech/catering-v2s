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
  /** Typed global projection: intentionally has no workspace scope argument. */
  @Transactional(readOnly = true) public AuditHistoryPage readPlatformAdmin(String platformAdminId, long page, long pageSize) {
    if (page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("unsupported platform IAM audit target");
    long offset = Math.multiplyExact(page - 1, pageSize);
    AuditHistoryResultSetReader.TargetProjection value = jdbc.query("""
        WITH target AS (SELECT 1 FROM platform_iam.platform_admin WHERE id::text=?),
        events AS (
          SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text,
                 changes_json::text AS changes_json, count(*) OVER () AS total
          FROM platform_iam.audit_event
          WHERE EXISTS (SELECT 1 FROM target) AND entity_type='PLATFORM_ADMIN' AND entity_ref_text=?
        ), summary AS (SELECT COALESCE(MAX(total), 0) AS total FROM events)
        SELECT EXISTS (SELECT 1 FROM target) AS target_exists, summary.total,
               page.event_id, page.occurred_at_epoch_millis, page.actor_display_snapshot, page.action,
               page.entity_type, page.entity_ref_text, page.changes_json
        FROM summary LEFT JOIN LATERAL (
          SELECT id AS event_id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type,
                 entity_ref_text, changes_json FROM events
          ORDER BY occurred_at_epoch_millis DESC, id DESC LIMIT ? OFFSET ?
        ) page ON TRUE
        """, statement -> {
          statement.setString(1, platformAdminId); statement.setString(2, platformAdminId);
          statement.setLong(3, pageSize); statement.setLong(4, offset);
        }, AuditHistoryResultSetReader::readTarget);
    if (!value.targetExists()) throw new PlatformAuthenticationService.PlatformAdminNotFoundException();
    return new AuditHistoryPage(value.items(), page, pageSize, value.total());
  }

}
