package com.catering.v2s.extension.application.persistence;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed persistence execution boundary for the extension-definition owner. */
@Repository
public class ExtensionDefinitionPersistence {
    private final JdbcTemplate jdbc;
    private final TimeProvider time;

    public ExtensionDefinitionPersistence(JdbcTemplate jdbc, TimeProvider time) {
        this.jdbc = jdbc;
        this.time = time;
    }

    public DefinitionRow findDefinition(UUID workspaceUuid, String groupWorkspaceKey, String hostType) {
        return jdbc.query(
                ExtensionDefinitionServiceSql.EXTENSION_DEFINITION_SERVICE_SELECT_EXTENSION_DEFINITION + ExtensionDefinitionServiceSql.EXTENSION_DEFINITION_SERVICE_CONTINUATION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ENTITY_TYPE,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setString(3, hostType);
                },
                result -> result.next()
                        ? new DefinitionRow(
                                hostType,
                                result.getString(1),
                                result.getLong(2),
                                result.getLong(3))
                        : null);
    }

    public List<DefinitionRow> findDefinitions(UUID workspaceUuid, String groupWorkspaceKey) {
        return jdbc.query(
                ExtensionDefinitionServiceSql.EXTENSION_DEFINITION_SERVICE_SELECT_ENTITY_TYPE_DEFINITIONS_TEXT_REVISION
                        + ExtensionDefinitionServiceSql.EXTENSION_DEFINITION_SERVICE_CONTINUATION_EXTENSION_DEFINITION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + ExtensionDefinitionServiceSql.EXTENSION_DEFINITION_SERVICE_CONTINUATION_ENTITY_TYPE,
                (row, index) -> new DefinitionRow(
                        row.getString(1),
                        row.getString(2),
                        row.getLong(3),
                        row.getLong(4)),
                workspaceUuid,
                groupWorkspaceKey);
    }

    public void insertDefinition(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String hostType,
            String definitionsJson) {
        jdbc.update(
                ExtensionDefinitionServiceSql.EXTENSION_DEFINITION_SERVICE_INSERT_INTO_EXTENSION_DEFINITION
                        + ExtensionDefinitionServiceSql.EXTENSION_DEFINITION_SERVICE_CONTINUATION_DEFINITIONS_REVISION_UPDATED_AT_EPOCH_MILLIS
                        + ExtensionDefinitionServiceSql.EXTENSION_DEFINITION_SERVICE_PARAMETER_PLACEHOLDER,
                workspaceUuid,
                groupWorkspaceKey,
                hostType,
                definitionsJson,
                time.currentEpochMillis());
    }

    public int updateDefinition(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String hostType,
            String definitionsJson,
            long revision,
            long expectedRevision) {
        return jdbc.update(
                ExtensionDefinitionServiceSql.EXTENSION_DEFINITION_SERVICE_UPDATE_EXTENSION_DEFINITION_DEFINITIONS_REVISION
                        + ExtensionDefinitionServiceSql.EXTENSION_DEFINITION_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + ExtensionDefinitionServiceSql.EXTENSION_DEFINITION_SERVICE_CONTINUATION_ENTITY_TYPE_REVISION,
                definitionsJson,
                revision,
                time.currentEpochMillis(),
                workspaceUuid,
                groupWorkspaceKey,
                hostType,
                expectedRevision);
    }

    public PreStateRow findPreState(UUID workspaceUuid, String groupWorkspaceKey, String hostType) {
        return jdbc.query(
                ExtensionDefinitionServiceSql.EXTENSION_DEFINITION_SERVICE_SELECT_EXTENSION_DEFINITION_DEFINITIONS_TEXT_REVISION_WORKSPACE_UUID + ExtensionDefinitionServiceSql.EXTENSION_DEFINITION_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_ENTITY_TYPE,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setString(3, hostType);
                },
                result -> result.next()
                        ? new PreStateRow(result.getString(1), result.getLong(2))
                        : null);
    }

    /** Reads immutable owner audit facts needed to keep generated field identities monotonic after deletion. */
    public List<AuditChange> findDefinitionHistoryChanges(
            UUID workspaceUuid, String groupWorkspaceKey, String hostType) {
        return jdbc.query(
                        ExtensionDefinitionServiceSql.EXTENSION_DEFINITION_SERVICE_SELECT_DEFINITION_HISTORY_CHANGES,
                        (row, ignored) -> AuditChangeJson.read(row.getString(1)),
                        workspaceUuid,
                        groupWorkspaceKey,
                        hostType)
                .stream()
                .flatMap(List::stream)
                .toList();
    }

    public void writeAudit(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String hostType,
            String entityRefText,
            AuditActor actor,
            String changesJson) {
        jdbc.update(
                ExtensionDefinitionServiceSql.EXTENSION_DEFINITION_SERVICE_INSERT_INTO_AUDIT_EVENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ENTITY_TYPE
                        + ExtensionDefinitionServiceSql.EXTENSION_DEFINITION_SERVICE_CONTINUATION_ENTITY_REF_TEXT_ACTOR_TYPE_ACTOR_ID_ACTOR_DISPLAY_SNAPSHOT
                        + ExtensionDefinitionServiceSql.EXTENSION_DEFINITION_SERVICE_CONTINUATION_OCCURRED_AT_EPOCH_MILLIS_CHANGES_JSON_EXTENSION_DEFINITION
                        + ExtensionDefinitionServiceSql.EXTENSION_DEFINITION_SERVICE_PARAMETER_PLACEHOLDER_ALTERNATE_A
                        + ExtensionDefinitionServiceSql.EXTENSION_DEFINITION_SERVICE_CONTINUATION_EXTENSION_DEFINITION_REPLACED,
                UUID.randomUUID(),
                workspaceUuid,
                groupWorkspaceKey,
                entityRefText,
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                time.currentEpochMillis(),
                changesJson);
    }

    public record DefinitionRow(
            String hostType,
            String definitionsJson,
            long revision,
            long updatedAtEpochMillis) {}

    public record PreStateRow(String definitionsJson, long revision) {}
}
