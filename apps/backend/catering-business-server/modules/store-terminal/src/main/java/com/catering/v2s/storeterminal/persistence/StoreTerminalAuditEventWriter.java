package com.catering.v2s.storeterminal.persistence;

import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditEntityTypes;
import com.catering.v2s.audit.contract.AuditEvent;
import com.catering.v2s.audit.contract.AuditEventWriter;
import java.util.Objects;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Store-terminal-owned adapter for the shared value-only audit SPI. */
@Repository
public class StoreTerminalAuditEventWriter implements AuditEventWriter {
    private static final String INSERT =
            "INSERT INTO store_terminal.audit_event(id, workspace_uuid, group_workspace_key, entity_type, "
                    + "entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, "
                    + "occurred_at_epoch_millis, changes_json) VALUES (?,?,?,?,?,?,?,?,?,?,?::jsonb)";

    private final JdbcTemplate jdbc;

    public StoreTerminalAuditEventWriter(JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Override
    public int write(AuditEvent event) {
        Objects.requireNonNull(event, "event");
        if (!AuditEntityTypes.STORE_TERMINAL.equals(event.target().entityType())) {
            throw new IllegalArgumentException("store-terminal audit writer accepts only store-terminal events");
        }
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
}
