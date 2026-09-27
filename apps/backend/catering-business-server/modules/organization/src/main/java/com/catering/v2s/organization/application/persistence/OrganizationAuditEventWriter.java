package com.catering.v2s.organization.application.persistence;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditEvent;
import com.catering.v2s.audit.contract.AuditEventWriter;
import com.catering.v2s.audit.contract.AuditTarget;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

/** Organization-owned audit adapter; the audit table and DML remain outside the value-only audit-model SPI. */
public final class OrganizationAuditEventWriter implements AuditEventWriter {
    private static final String INSERT = ("INSERT INTO organization.audit_event(id, workspace_uuid, group_workspace"
            + "_key, entity_type, entity_ref_text, actor_type, actor_id, actor_display_"
            + "snapshot, action, occurred_at_epoch_millis, changes_json) VALUES (?,?,?,"
            + "?,?,?,?,?,?,?,?::jsonb)");

    private final JdbcTemplate jdbc;

    public OrganizationAuditEventWriter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public int write(AuditEvent event) {
        return jdbc.update(
                INSERT,
                event.id(),
                event.workspaceUuid(),
                event.groupWorkspaceKey(),
                event.target().entityType(),
                event.target().entityRef(),
                event.actor().actorType(),
                event.actor().actorId(),
                event.actor().displaySnapshot(),
                event.action(),
                event.occurredAtEpochMillis(),
                AuditChangeJson.write(event.changes()));
    }

    public int write(
            UUID id,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String entityType,
            String entityRefText,
            String actorType,
            UUID actorId,
            String actorDisplaySnapshot,
            String action,
            long occurredAtEpochMillis,
            String changesJson) {
        return write(new AuditEvent(
                id,
                workspaceUuid,
                groupWorkspaceKey,
                new AuditTarget(entityType, entityRefText),
                new AuditActor(actorType, actorId, actorDisplaySnapshot),
                action,
                occurredAtEpochMillis,
                AuditChangeJson.read(changesJson)));
    }

    public int write(
            UUID id,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String entityType,
            String entityRefText,
            AuditActor actor,
            String action,
            long occurredAtEpochMillis,
            String changesJson) {
        return write(new AuditEvent(
                id,
                workspaceUuid,
                groupWorkspaceKey,
                new AuditTarget(entityType, entityRefText),
                actor,
                action,
                occurredAtEpochMillis,
                AuditChangeJson.read(changesJson)));
    }
}
