package com.catering.v2s.terminalcontrol.application.persistence;

import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditEntityTypes;
import com.catering.v2s.audit.contract.AuditEvent;
import com.catering.v2s.audit.contract.AuditEventWriter;
import java.util.Objects;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Terminal-control-owned audit persistence, participating in the caller transaction. */
@Repository("terminalRemoteControlAuditEventWriter")
public class TerminalRemoteControlAuditEventWriter implements AuditEventWriter {
    private final JdbcTemplate jdbc;

    public TerminalRemoteControlAuditEventWriter(JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Override
    public int write(AuditEvent event) {
        Objects.requireNonNull(event, "event");
        if (!AuditEntityTypes.TERMINAL_REMOTE_CONTROL_SESSION.equals(event.target().entityType())
                || !java.util.Set.of("START", "END").contains(event.action())) {
            throw new IllegalArgumentException("terminal remote-control audit event is invalid");
        }
        return jdbc.update(
                """
                INSERT INTO terminal_control.audit_event(
                  id,workspace_uuid,group_workspace_key,entity_type,entity_ref_text,actor_type,actor_id,
                  actor_display_snapshot,action,occurred_at_epoch_millis,changes_json)
                VALUES (?,?,?,?,?,?,?,?,?,?,?::jsonb)
                """,
                event.id(), event.workspaceUuid(), event.groupWorkspaceKey(), event.target().entityType(),
                event.target().entityRef(), event.actor().actorType(), event.actor().actorId(),
                event.actor().displaySnapshot(), event.action(), event.occurredAtEpochMillis(),
                AuditChangeJson.write(event.changes()));
    }
}
