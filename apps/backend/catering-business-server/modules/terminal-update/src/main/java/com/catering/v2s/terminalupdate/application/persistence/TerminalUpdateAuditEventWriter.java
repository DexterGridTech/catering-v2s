package com.catering.v2s.terminalupdate.application.persistence;

import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditEntityTypes;
import com.catering.v2s.audit.contract.AuditEvent;
import com.catering.v2s.audit.contract.AuditEventWriter;
import java.util.Objects;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Owner-local writer for platform-admin terminal artifact events, in the caller transaction. */
@Repository("terminalUpdateAuditEventWriter")
public class TerminalUpdateAuditEventWriter implements AuditEventWriter {
    private final JdbcTemplate jdbc;

    public TerminalUpdateAuditEventWriter(JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Override
    public int write(AuditEvent event) {
        Objects.requireNonNull(event, "event");
        if (!java.util.Set.of(AuditEntityTypes.TERMINAL_UPDATE_ARTIFACT, AuditEntityTypes.TERMINAL_UPDATE_RULE)
                .contains(event.target().entityType()))
            throw new IllegalArgumentException("terminal update audit target is invalid");
        if (!java.util.Set.of("STAGE", "REGISTER", "RELEASE_STAGE", "CREATE", "ENABLE", "DISABLE")
                .contains(event.action()))
            throw new IllegalArgumentException("terminal update audit action is invalid");
        return jdbc.update(
                """
                INSERT INTO terminal_update.audit_event(
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
