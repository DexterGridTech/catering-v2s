package com.catering.v2s.organization.application.persistence;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed persistence boundary for the tenant lifecycle owner. */
@Repository
public class BusinessTenantPersistence {
    private final JdbcTemplate jdbc;
    private final OrganizationAuditEventWriter auditEvents;

    public BusinessTenantPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        this.auditEvents = new OrganizationAuditEventWriter(jdbc);
    }

    public int insert(
            UUID id,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String legalName,
            String creditCode,
            String remark,
            long now) {
        return jdbc.update(
                BusinessTenantServiceSql
                                .BUSINESS_TENANT_SERVICE_INSERT_INTO_TENANT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE_NAME
                        + BusinessTenantServiceSql.BUSINESS_TENANT_SERVICE_CREDIT_CODE_REMARK_STATUS_VERSION
                        + BusinessTenantServiceSql.BUSINESS_TENANT_SERVICE_VALUES_ENABLED,
                id,
                workspaceUuid,
                groupWorkspaceKey,
                code,
                name,
                legalName,
                creditCode,
                remark,
                now,
                now);
    }

    public int update(
            UUID id,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String legalName,
            String creditCode,
            String remark,
            long now,
            long expectedVersion) {
        return jdbc.update(
                BusinessTenantServiceSql.BUSINESS_TENANT_SERVICE_UPDATE_TENANT_CODE_NAME_LEGAL_NAME_CREDIT_CODE
                        + BusinessTenantServiceSql
                                .BUSINESS_TENANT_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_VERSION,
                code,
                name,
                legalName,
                creditCode,
                remark,
                now,
                id,
                workspaceUuid,
                groupWorkspaceKey,
                expectedVersion);
    }

    public int transitionStatus(
            UUID id, UUID workspaceUuid, String groupWorkspaceKey, String status, long now, long expectedVersion) {
        return jdbc.update(
                BusinessTenantServiceSql.BUSINESS_TENANT_SERVICE_UPDATE_TENANT_STATUS_VERSION_UPDATED_AT_EPOCH_MILLIS
                        + BusinessTenantServiceSql
                                .BUSINESS_TENANT_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_VERSION,
                status,
                now,
                id,
                workspaceUuid,
                groupWorkspaceKey,
                expectedVersion);
    }

    public ConflictFlags findConflicts(
            UUID workspaceUuid, String groupWorkspaceKey, UUID currentId, String code, String name) {
        String exclusion = currentId == null ? "" : BusinessTenantServiceSql.BUSINESS_TENANT_SERVICE_CONDITION_AND_ID;
        String sql = BusinessTenantServiceSql.BUSINESS_TENANT_SERVICE_SELECT_TENANT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                + BusinessTenantServiceSql.BUSINESS_TENANT_SERVICE_CONDITION_STATUS_VOIDED_CODE
                + exclusion
                + BusinessTenantServiceSql.CODE_NAME_CONFLICT_SEPARATOR
                + BusinessTenantServiceSql.CODE_CONFLICT_EXISTS_SUFFIX
                + BusinessTenantServiceSql.NAME_CONFLICT_PREDICATE
                + exclusion
                + ") AS name_conflict";
        Object[] args = currentId == null
                ? new Object[] {workspaceUuid, groupWorkspaceKey, code, workspaceUuid, groupWorkspaceKey, name}
                : new Object[] {
                    workspaceUuid, groupWorkspaceKey, code, currentId, workspaceUuid, groupWorkspaceKey, name, currentId
                };
        return jdbc.query(
                sql,
                statement -> {
                    for (int index = 0; index < args.length; index++) statement.setObject(index + 1, args[index]);
                },
                result -> {
                    if (!result.next()) throw new IllegalStateException("tenant conflict query returned no row");
                    return new ConflictFlags(result.getBoolean("code_conflict"), result.getBoolean("name_conflict"));
                });
    }

    public int replaceExtensionValues(UUID id, String extensionValues, long extensionRuleRevision) {
        return jdbc.update(
                BusinessTenantServiceSql.BUSINESS_TENANT_SERVICE_UPDATE_TENANT_EXTENSION_VALUES_EXTENSION_RULE_REVISION,
                extensionValues,
                extensionRuleRevision,
                id);
    }

    public int replaceExtensionValuesWithoutDefinition(UUID id, String extensionValues) {
        return jdbc.update(
                BusinessTenantServiceSql
                        .BUSINESS_TENANT_SERVICE_UPDATE_TENANT_EXTENSION_VALUES_EXTENSION_RULE_REVISION_ALTERNATE_A,
                extensionValues,
                0L,
                id);
    }

    public int audit(
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
        return auditEvents.write(
                id,
                workspaceUuid,
                groupWorkspaceKey,
                entityType,
                entityRefText,
                actorType,
                actorId,
                actorDisplaySnapshot,
                action,
                occurredAtEpochMillis,
                changesJson);
    }

    public record ConflictFlags(boolean codeConflict, boolean nameConflict) {}
}
