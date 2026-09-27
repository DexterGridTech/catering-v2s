package com.catering.v2s.organization.application.persistence;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.organization.api.CommercialGroupReadback;
import java.sql.ResultSet;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Organization-owned commercial-group SQL execution.
 *
 * <p>Validation, transaction ownership, idempotency decisions and response policy remain in the application service.
 * This class only exposes typed organization facts and writes.
 */
@Repository
public class OrganizationCommandPersistence {
    private final JdbcTemplate jdbc;
    private final OrganizationAuditEventWriter auditEvents;

    public OrganizationCommandPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        this.auditEvents = new OrganizationAuditEventWriter(jdbc);
    }

    public IdempotencyRow findInitializationIdempotency(UUID workspaceUuid, String idempotencyKey) {
        return jdbc
                .query(
                        OrganizationCommandServiceSql.ORGANIZATION_COMMAND_SERVICE_SELECT_GROUP_WORKSPACE_KEY
                                + OrganizationCommandServiceSql
                                        .ORGANIZATION_COMMAND_SERVICE_COMMERCIAL_GROUP_IDEMPOTENCY_COMMERCIAL_GROUP_NAME
                                + OrganizationCommandServiceSql
                                        .ORGANIZATION_COMMAND_SERVICE_WORKSPACE_UUID_IDEMPOTENCY_KEY,
                        (resultSet, rowNum) -> new IdempotencyRow(
                                resultSet.getString("group_workspace_key"),
                                resultSet.getString("request_fingerprint"),
                                resultSet.getObject("commercial_group_id", Long.class),
                                resultSet.getString("commercial_group_code"),
                                resultSet.getString("commercial_group_name")),
                        workspaceUuid,
                        idempotencyKey)
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void insertInitializationIdempotency(
            UUID workspaceUuid, String idempotencyKey, String groupWorkspaceKey, String requestFingerprint) {
        jdbc.update(
                OrganizationCommandServiceSql.INSERT_INTO_COMMERCIAL_GRP_IDEMPOTENCY_001
                        + OrganizationCommandServiceSql
                                .ORGANIZATION_COMMAND_SERVICE_GROUP_WORKSPACE_KEY_REQUEST_FINGERPRINT,
                workspaceUuid,
                idempotencyKey,
                groupWorkspaceKey,
                requestFingerprint);
    }

    public long insertCommercialGroup(
            String groupWorkspaceKey,
            long groupWorkspaceId,
            String code,
            String name,
            String actorDisplaySnapshot,
            UUID commercialGroupUuid,
            long createdAtEpochMillis,
            String extensionValuesJson,
            long extensionRuleRevision) {
        return jdbc.queryForObject(
                OrganizationCommandServiceSql.ORGANIZATION_COMMAND_SERVICE_INSERT_INTO_COMMERCIAL_GROUP,
                Long.class,
                groupWorkspaceKey,
                groupWorkspaceId,
                code,
                name,
                actorDisplaySnapshot,
                commercialGroupUuid,
                createdAtEpochMillis,
                createdAtEpochMillis,
                extensionValuesJson,
                extensionRuleRevision);
    }

    public void completeInitializationIdempotency(
            long commercialGroupId, String code, String name, UUID workspaceUuid, String idempotencyKey) {
        jdbc.update(
                OrganizationCommandServiceSql
                                .ORGANIZATION_COMMAND_SERVICE_UPDATE_COMMERCIAL_GROUP_IDEMPOTENCY_COMMERCIAL_GROUP_ID
                        + OrganizationCommandServiceSql
                                .ORGANIZATION_COMMAND_SERVICE_COMMERCIAL_GROUP_CODE_COMMERCIAL_GROUP_NAME_WORKSPACE_UUID
                        + OrganizationCommandServiceSql.ORGANIZATION_COMMAND_SERVICE_IDEMPOTENCY_KEY,
                commercialGroupId,
                code,
                name,
                workspaceUuid,
                idempotencyKey);
    }

    public void insertInitializationAudit(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            long groupWorkspaceId,
            AuditActor actor,
            long occurredAtEpochMillis,
            String changesJson) {
        auditEvents.write(
                UUID.randomUUID(),
                workspaceUuid,
                groupWorkspaceKey,
                "GROUP_WORKSPACE",
                String.valueOf(groupWorkspaceId),
                actor,
                "COMMERCIAL_GROUP_INITIALIZED",
                occurredAtEpochMillis,
                changesJson);
    }

    public CommercialGroupReadback updateCommercialGroup(
            String groupWorkspaceKey,
            String code,
            String name,
            String extensionValuesJson,
            long extensionRuleRevision,
            long now,
            UUID commercialGroupUuid,
            long expectedVersion) {
        return jdbc.query(
                OrganizationCommandServiceSql.ORGANIZATION_COMMAND_SERVICE_UPDATE_COMMERCIAL_GROUP_COMMERCIAL_GROUP_CODE
                        + OrganizationCommandServiceSql
                                .ORGANIZATION_COMMAND_SERVICE_COMMERCIAL_GROUP_NAME_EXTENSION_VALUES
                        + OrganizationCommandServiceSql
                                .ORGANIZATION_COMMAND_SERVICE_EXTENSION_RULE_REVISION_VERSION_UPDATED_AT_EPOCH_MILLIS
                        + OrganizationCommandServiceSql
                                .ORGANIZATION_COMMAND_SERVICE_COMMERCIAL_GROUP_UUID_GROUP_WORKSPACE_KEY_VERSION
                        + OrganizationCommandServiceSql.ORGANIZATION_COMMAND_SERVICE_COMMERCIAL_GROUP_UUID
                        + OrganizationCommandServiceSql.ORGANIZATION_COMMAND_SERVICE_VERSION
                        + OrganizationCommandServiceSql.ORGANIZATION_COMMAND_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS,
                statement -> {
                    statement.setString(1, code);
                    statement.setString(2, name);
                    statement.setString(3, extensionValuesJson);
                    statement.setLong(4, extensionRuleRevision);
                    statement.setLong(5, now);
                    statement.setObject(6, commercialGroupUuid);
                    statement.setString(7, groupWorkspaceKey);
                    statement.setLong(8, expectedVersion);
                },
                result -> result.next() ? commercialGroupReadback(result) : null);
    }

    public void insertUpdateAudit(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            CommercialGroupReadback updated,
            AuditActor actor,
            long occurredAtEpochMillis,
            String changesJson) {
        auditEvents.write(
                UUID.randomUUID(),
                workspaceUuid,
                groupWorkspaceKey,
                "COMMERCIAL_GROUP",
                updated.id().toString(),
                actor,
                "COMMERCIAL_GROUP_UPDATED",
                occurredAtEpochMillis,
                changesJson);
    }

    public CommercialGroupReadback findCommercialGroup(String groupWorkspaceKey) {
        return jdbc.query(
                OrganizationCommandServiceSql.ORGANIZATION_COMMAND_SERVICE_SELECT_COMMERCIAL_GROUP_UUID
                        + OrganizationCommandServiceSql.ORGANIZATION_COMMAND_SERVICE_CREATED_BY_PLATFORM_SUBJECT
                        + OrganizationCommandServiceSql.ORGANIZATION_COMMAND_SERVICE_COMMERCIAL_GROUP
                        + OrganizationCommandServiceSql.ORGANIZATION_COMMAND_SERVICE_GROUP_WORKSPACE_KEY,
                statement -> statement.setString(1, groupWorkspaceKey),
                result -> result.next() ? commercialGroupReadback(result, groupWorkspaceKey) : null);
    }

    public UUID findCommercialGroupRef(String groupWorkspaceKey) {
        return jdbc.query(
                OrganizationCommandServiceSql
                        .ORGANIZATION_COMMAND_SERVICE_SELECT_COMMERCIAL_GROUP_COMMERCIAL_GROUP_UUID_GROUP_WORKSPACE_KEY,
                statement -> statement.setString(1, groupWorkspaceKey),
                result -> result.next() ? result.getObject(1, UUID.class) : null);
    }

    public boolean isEnterableCommercialGroup(String groupWorkspaceKey, UUID commercialGroupRef) {
        Boolean found = jdbc.query(
                OrganizationCommandServiceSql.ORGANIZATION_COMMAND_SERVICE_SELECT_COMMERCIAL_GROUP_COMMERCIAL_GROUP_UUID
                        + OrganizationCommandServiceSql.ORGANIZATION_COMMAND_SERVICE_GROUP_WORKSPACE_KEY_ALTERNATE_A,
                statement -> {
                    statement.setObject(1, commercialGroupRef);
                    statement.setString(2, groupWorkspaceKey);
                },
                result -> result.next() && result.getBoolean(1));
        return Boolean.TRUE.equals(found);
    }

    public NameCode findCommercialGroupNameCode(String groupWorkspaceKey, UUID commercialGroupRef) {
        return jdbc.query(
                OrganizationCommandServiceSql.SELECT_COMMERCIAL_GRP_COMMERCIAL_GRP_002
                        + OrganizationCommandServiceSql
                                .ORGANIZATION_COMMAND_SERVICE_COMMERCIAL_GROUP_UUID_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setObject(1, commercialGroupRef);
                    statement.setString(2, groupWorkspaceKey);
                },
                result -> result.next() ? new NameCode(result.getString(2), result.getString(1)) : null);
    }

    public CommercialGroupReadback findCommercialGroupById(
            long id, String groupWorkspaceKey, String code, String name, String subject) {
        return jdbc.query(
                OrganizationCommandServiceSql.ORGANIZATION_COMMAND_SERVICE_SELECT_COMMERCIAL_GROUP_UUID_ALTERNATE_A
                        + OrganizationCommandServiceSql.ORGANIZATION_COMMAND_SERVICE_COMMERCIAL_GROUP_ALTERNATE_A
                        + OrganizationCommandServiceSql.ORGANIZATION_COMMAND_SERVICE_ID,
                statement -> statement.setLong(1, id),
                result ->
                        result.next() ? commercialGroupReadback(result, groupWorkspaceKey, code, name, subject) : null);
    }

    private static CommercialGroupReadback commercialGroupReadback(ResultSet result) throws java.sql.SQLException {
        return commercialGroupReadback(result, result.getString("group_workspace_key"));
    }

    private static CommercialGroupReadback commercialGroupReadback(ResultSet result, String groupWorkspaceKey)
            throws java.sql.SQLException {
        return new CommercialGroupReadback(
                result.getObject("commercial_group_uuid", UUID.class),
                groupWorkspaceKey,
                result.getString("commercial_group_code"),
                result.getString("commercial_group_name"),
                result.getLong("version"),
                result.getString("created_by_platform_subject"),
                result.getLong("created_at_epoch_millis"),
                result.getLong("updated_at_epoch_millis"),
                ExtensionDefinitionService.readValues(result.getString("extension_values")),
                result.getLong("extension_rule_revision"));
    }

    private static CommercialGroupReadback commercialGroupReadback(
            ResultSet result, String groupWorkspaceKey, String code, String name, String subject)
            throws java.sql.SQLException {
        return new CommercialGroupReadback(
                result.getObject("commercial_group_uuid", UUID.class),
                groupWorkspaceKey,
                code,
                name,
                result.getLong("version"),
                subject,
                result.getLong("created_at_epoch_millis"),
                result.getLong("updated_at_epoch_millis"),
                ExtensionDefinitionService.readValues(result.getString("extension_values")),
                result.getLong("extension_rule_revision"));
    }

    public record IdempotencyRow(
            String groupWorkspaceKey,
            String requestFingerprint,
            Long commercialGroupId,
            String commercialGroupCode,
            String commercialGroupName) {}

    public record NameCode(String name, String code) {}
}
