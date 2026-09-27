package com.catering.v2s.terminalbinding.persistence;

import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditEntityTypes;
import com.catering.v2s.audit.contract.AuditEvent;
import com.catering.v2s.audit.contract.AuditEventWriter;
import com.catering.v2s.terminalbinding.domain.TerminalBindingAuditReason;
import java.util.Objects;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Terminal-binding-owned adapter for the shared audit SPI. */
@Repository
public class TerminalBindingAuditEventWriter implements AuditEventWriter {
    private static final String INSERT =
            """
            INSERT INTO terminal_binding.audit_event(
              id, workspace_uuid, group_workspace_key, entity_type, entity_ref_text,
              actor_type, actor_id, actor_display_snapshot, action, occurred_at_epoch_millis,
              reason, changes_json
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?::jsonb)
            """;

    private final JdbcTemplate jdbc;

    public TerminalBindingAuditEventWriter(JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Override
    public int write(AuditEvent event) {
        Objects.requireNonNull(event, "event");
        if (!AuditEntityTypes.TERMINAL_BINDING.equals(event.target().entityType())) {
            throw new IllegalArgumentException("terminal-binding audit writer accepts only binding events");
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
                reason(event),
                AuditChangeJson.write(event.changes()));
    }

    private static String reason(AuditEvent event) {
        var values = event.changes().stream()
                .filter(change -> "reason".equals(change.fieldKey()))
                .map(AuditChange::afterValue)
                .toList();
        if (values.size() != 1 || values.getFirst() == null) {
            throw new IllegalArgumentException("terminal-binding audit event requires exactly one reason");
        }
        try {
            return TerminalBindingAuditReason.valueOf(values.getFirst()).name();
        } catch (IllegalArgumentException invalid) {
            throw new IllegalArgumentException("terminal-binding audit reason is invalid", invalid);
        }
    }
}
