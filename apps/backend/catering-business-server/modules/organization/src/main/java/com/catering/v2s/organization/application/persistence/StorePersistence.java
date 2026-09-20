package com.catering.v2s.organization.application.persistence;

import com.catering.v2s.organization.api.BusinessEntityTypes;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed persistence boundary for store facts and store reference validation. */
@Repository
public class StorePersistence {
    private final JdbcTemplate jdbc;
    private final OrganizationAuditEventWriter auditEvents;

    public StorePersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        this.auditEvents = new OrganizationAuditEventWriter(jdbc);
    }

    public UpdateFacts readUpdateFacts(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return jdbc.query(
                StoreServiceSql.STORE_SERVICE_SELECT_STORE_PROJECT_ID_TENANT_ID_BRAND_ID_CODE + StoreServiceSql.STORE_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setObject(1, storeId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> {
                    if (!result.next()) throw new IllegalStateException("store update facts not found");
                    return new UpdateFacts(
                            result.getObject(1, UUID.class),
                            result.getObject(2, UUID.class),
                            result.getObject(3, UUID.class),
                            result.getString(4));
                });
    }

    public String readOperatingRuleSwitches(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return jdbc.query(
                StoreServiceSql.STORE_SERVICE_SELECT_OPERATING_RULE_SWITCHES_TEXT,
                statement -> {
                    statement.setObject(1, storeId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> {
                    if (!result.next()) throw new IllegalStateException("store operating rules not found");
                    return result.getString(1);
                });
    }

    public Map<UUID, String> readOperatingRuleSwitches(
            UUID workspaceUuid, String groupWorkspaceKey, List<UUID> storeIds) {
        if (storeIds == null || storeIds.isEmpty()) return Map.of();
        List<UUID> ids = storeIds.stream().distinct().toList();
        String placeholders = String.join(",", Collections.nCopies(ids.size(), "?"));
        Object[] parameters = new Object[ids.size() + 2];
        parameters[0] = workspaceUuid;
        parameters[1] = groupWorkspaceKey;
        for (int index = 0; index < ids.size(); index++) parameters[index + 2] = ids.get(index);
        Map<UUID, String> values = new LinkedHashMap<>();
        jdbc.query(
                StoreServiceSql.STORE_SERVICE_SELECT_OPERATING_RULE_SWITCHES_BATCH_PREFIX
                        + placeholders
                        + StoreServiceSql.STORE_SERVICE_SELECT_OPERATING_RULE_SWITCHES_BATCH_SUFFIX,
                (row, index) -> {
                    values.put(row.getObject(1, UUID.class), row.getString(2));
                    return null;
                },
                parameters);
        return Map.copyOf(values);
    }

    public int insert(
            UUID id,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            String operatingRuleSwitches,
            long now) {
        return jdbc.update(
                StoreServiceSql.STORE_SERVICE_INSERT_INTO_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_PROJECT_ID_TENANT_ID
                        + StoreServiceSql.STORE_SERVICE_BRAND_ID_HEAD_COMPANY_ID_CODE_NAME_NOTES_OPERATING_RULE
                        + StoreServiceSql.STORE_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_ENABLED,
                id,
                workspaceUuid,
                groupWorkspaceKey,
                projectId,
                tenantId,
                brandId,
                headCompanyId,
                code,
                name,
                notes,
                operatingRuleSwitches,
                now,
                now);
    }

    public int insertDefaultQrConfiguration(UUID storeRef, UUID workspaceUuid, String groupWorkspaceKey, long now) {
        return jdbc.update(
                "INSERT INTO organization.store_qr_configuration(store_ref, workspace_uuid, group_workspace_key, enabled, channel_ref, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?,?,?,FALSE,NULL,1,?,?) ON CONFLICT (store_ref) DO NOTHING",
                storeRef, workspaceUuid, groupWorkspaceKey, now, now);
    }

    public int update(
            UUID storeId,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            String operatingRuleSwitches,
            long now,
            long expectedVersion) {
        return jdbc.update(
                StoreServiceSql.STORE_SERVICE_UPDATE_STORE_PROJECT_ID_TENANT_ID_BRAND_ID_HEAD_COMPANY_ID
                        + StoreServiceSql.STORE_SERVICE_NAME_NOTES_OPERATING_RULE_VERSION_UPDATED_AT_EPOCH_MILLIS
                        + StoreServiceSql.STORE_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_VERSION,
                projectId,
                tenantId,
                brandId,
                headCompanyId,
                code,
                name,
                notes,
                operatingRuleSwitches,
                now,
                storeId,
                workspaceUuid,
                groupWorkspaceKey,
                expectedVersion);
    }

    public int transitionStatus(
            UUID storeId,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String status,
            long now,
            long expectedVersion) {
        return jdbc.update(
                StoreServiceSql.STORE_SERVICE_UPDATE_STORE_STATUS_VERSION_UPDATED_AT_EPOCH_MILLIS + StoreServiceSql.STORE_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_VERSION,
                status,
                now,
                storeId,
                workspaceUuid,
                groupWorkspaceKey,
                expectedVersion);
    }

    public CommandFacts readCommandFacts(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId) {
        return jdbc.query(
                StoreServiceSql.STORE_SERVICE_CTE_REQUESTED_WORKSPACE_UUID_TEXT_GROUP_WORKSPACE_KEY
                        + StoreServiceSql.STORE_SERVICE_TENANT_ID_BRAND_ID_HEAD_COMPANY_ID_STORE
                        + StoreServiceSql.STORE_SERVICE_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE
                        + StoreServiceSql.STORE_SERVICE_LEGAL_NAME_VARCHAR_CREDIT_CODE_ALIAS
                        + StoreServiceSql.STORE_SERVICE_STORE_NOTES_STATUS_VERSION
                        + StoreServiceSql.STORE_SERVICE_STORE_CREATED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS_EXTENSION_VALUES
                        + StoreServiceSql.STORE_SERVICE_STORE_PROJECT_ID_TENANT_ID_BRAND_ID
                        + StoreServiceSql.STORE_SERVICE_OPEN_PAREN_TENANT_PROJECT_STATUS_ENABLED_PROJECT_ENABLED
                        + StoreServiceSql.STORE_SERVICE_TENANT_REQUESTED_REQUEST_TENANT_ID
                        + StoreServiceSql.STORE_SERVICE_TENANT_WORKSPACE_UUID_REQUEST_GROUP_WORKSPACE_KEY
                        + StoreServiceSql.STORE_SERVICE_CONDITION_BRAND_TENANT_STATUS_ENABLED_TENANT_ENABLED
                        + StoreServiceSql.STORE_SERVICE_REQUESTED_REQUEST_BRAND_BRAND_ID
                        + StoreServiceSql.STORE_SERVICE_BRAND_GROUP_WORKSPACE_KEY_REQUEST_STATUS
                        + StoreServiceSql.STORE_SERVICE_OPEN_PAREN_HEAD_COMPANY_REQUEST_HEAD_COMPANY_ID
                        + StoreServiceSql.STORE_SERVICE_WHERE_HEAD_COMPANY_REQUEST_HEAD_COMPANY_ID_WORKSPACE_UUID
                        + StoreServiceSql.STORE_SERVICE_HEAD_COMPANY_GROUP_WORKSPACE_KEY_REQUEST_STATUS
                        + StoreServiceSql.STORE_SERVICE_HEAD_COMPANY_ENABLED_REQUEST_HEAD_COMPANY_ID
                        + StoreServiceSql.STORE_SERVICE_ALTERNATIVE_HEAD_COMPANY_BRAND_AUTHORIZATION_HBA_HEAD_COMPANY_ID_REQUEST
                        + StoreServiceSql.STORE_SERVICE_CONDITION_STORE_HBA_BRAND_ID_REQUEST_HEAD_COMPANY_AUTHORIZED
                        + StoreServiceSql.STORE_SERVICE_ALTERNATIVE_ORGANIZATION_NODE_PROJECT_STORE_PROJECT_ID
                        + StoreServiceSql.STORE_SERVICE_PROJECT_WORKSPACE_UUID_STORE_GROUP_WORKSPACE_KEY
                        + StoreServiceSql.STORE_SERVICE_CONDITION_REQUESTED_PROJECT_NODE_TYPE_REQUEST_STORE
                        + StoreServiceSql.STORE_SERVICE_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, tenantId);
                    statement.setObject(4, brandId);
                    statement.setObject(5, headCompanyId);
                    statement.setObject(6, storeId);
                    statement.setObject(7, workspaceUuid);
                    statement.setString(8, groupWorkspaceKey);
                },
                result -> {
                    if (!result.next()) throw new IllegalStateException("store command facts not found");
                    return new CommandFacts(
                            OrganizationEntityReadbackMapper.read(ServiceNodeTypes.STORE, result),
                            result.getObject(17, UUID.class),
                            result.getObject(18, UUID.class),
                            result.getObject(19, UUID.class),
                            result.getObject(20, UUID.class),
                            new ReferenceFacts(
                                    result.getBoolean("project_enabled"),
                                    result.getBoolean("tenant_enabled"),
                                    result.getBoolean("brand_enabled"),
                                    result.getBoolean("head_company_enabled"),
                                    result.getBoolean("head_company_authorized")));
                });
    }

    public StatusFacts readStatusFacts(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return jdbc.query(
                StoreServiceSql.STORE_SERVICE_SELECT_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE
                        + StoreServiceSql.STORE_SERVICE_VARCHAR_LEGAL_NAME_CREDIT_CODE_ALIAS
                        + StoreServiceSql.STORE_SERVICE_VARCHAR_REMARK_STORE_NOTES
                        + StoreServiceSql.STORE_SERVICE_STORE_CREATED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS_EXTENSION_VALUES_ALTERNATE_A
                        + StoreServiceSql.STORE_SERVICE_ORGANIZATION_NODE_PROJECT_ID_PROJECT
                        + StoreServiceSql.STORE_SERVICE_PROJECT_STORE_PROJECT_ID_WORKSPACE_UUID
                        + StoreServiceSql.STORE_SERVICE_PROJECT_GROUP_WORKSPACE_KEY_STORE_NODE_TYPE
                        + StoreServiceSql.STORE_SERVICE_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_A,
                statement -> {
                    statement.setObject(1, storeId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> {
                    if (!result.next()) throw new IllegalStateException("store status facts not found");
                    return new StatusFacts(
                            OrganizationEntityReadbackMapper.read(ServiceNodeTypes.STORE, result),
                            result.getObject(17, UUID.class));
                });
    }

    public ReferenceFacts validateReferences(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId) {
        return jdbc.query(
                StoreServiceSql.STORE_SERVICE_CTE_REQUESTED_WORKSPACE_UUID_TEXT_GROUP_WORKSPACE_KEY_ALTERNATE_A
                        + StoreServiceSql.STORE_SERVICE_PROJECT_ID_TENANT_ID_BRAND_ID_HEAD_COMPANY_ID
                        + StoreServiceSql.STORE_SERVICE_ORGANIZATION_NODE_NODE_REQUESTED_REQUEST_PROJECT_ID
                        + StoreServiceSql.STORE_SERVICE_CONDITION_NODE_WORKSPACE_UUID_REQUEST_GROUP_WORKSPACE_KEY
                        + StoreServiceSql.STORE_SERVICE_CONDITION_NODE_NODE_TYPE_PROJECT_STATUS
                        + StoreServiceSql.STORE_SERVICE_ALTERNATIVE_TENANT_REQUESTED_REQUEST_TENANT_ID
                        + StoreServiceSql.STORE_SERVICE_TENANT_WORKSPACE_UUID_REQUEST_GROUP_WORKSPACE_KEY_ALTERNATE_A
                        + StoreServiceSql.STORE_SERVICE_CONDITION_BRAND_TENANT_STATUS_ENABLED_TENANT_ENABLED_ALTERNATE_A
                        + StoreServiceSql.STORE_SERVICE_REQUESTED_REQUEST_BRAND_BRAND_ID_ALTERNATE_A
                        + StoreServiceSql.STORE_SERVICE_BRAND_GROUP_WORKSPACE_KEY_REQUEST_STATUS_ALTERNATE_A
                        + StoreServiceSql.STORE_SERVICE_OPEN_PAREN_HEAD_COMPANY_REQUEST_HEAD_COMPANY_ID_ALTERNATE_A
                        + StoreServiceSql.STORE_SERVICE_WHERE_HEAD_COMPANY_REQUEST_HEAD_COMPANY_ID_WORKSPACE_UUID_ALTERNATE_A
                        + StoreServiceSql.STORE_SERVICE_HEAD_COMPANY_GROUP_WORKSPACE_KEY_REQUEST_STATUS_ALTERNATE_A
                        + StoreServiceSql.STORE_SERVICE_HEAD_COMPANY_ENABLED_REQUEST_HEAD_COMPANY_ID_ALTERNATE_A
                        + StoreServiceSql.STORE_SERVICE_ALTERNATIVE_HEAD_COMPANY_BRAND_AUTHORIZATION_HBA_HEAD_COMPANY_ID_REQUEST_ALTERNATE_A
                        + StoreServiceSql.STORE_SERVICE_CONDITION_REQUESTED_HBA_BRAND_ID_REQUEST_HEAD_COMPANY_AUTHORIZED,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, projectId);
                    statement.setObject(4, tenantId);
                    statement.setObject(5, brandId);
                    statement.setObject(6, headCompanyId);
                },
                result -> {
                    if (!result.next()) throw new IllegalStateException("store reference facts not found");
                    return new ReferenceFacts(
                            result.getBoolean("project_enabled"),
                            result.getBoolean("tenant_enabled"),
                            result.getBoolean("brand_enabled"),
                            result.getBoolean("head_company_enabled"),
                            result.getBoolean("head_company_authorized"));
                });
    }

    public int replaceExtensionValues(UUID id, String extensionValues, long extensionRuleRevision) {
        return jdbc.update(StoreServiceSql.STORE_SERVICE_UPDATE_STORE_EXTENSION_VALUES_EXTENSION_RULE_REVISION, extensionValues, extensionRuleRevision, id);
    }

    public int replaceExtensionValuesWithoutDefinition(UUID id, String extensionValues) {
        return jdbc.update(StoreServiceSql.STORE_SERVICE_UPDATE_STORE_EXTENSION_VALUES_EXTENSION_RULE_REVISION_ALTERNATE_A, extensionValues, 0L, id);
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

    public record UpdateFacts(UUID projectId, UUID tenantId, UUID brandId, String code) {}

    public record CommandFacts(
            OrganizationEntityReadback before,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            ReferenceFacts references) {}

    public record StatusFacts(OrganizationEntityReadback before, UUID projectId) {}

    public record ReferenceFacts(
            boolean projectEnabled,
            boolean tenantEnabled,
            boolean brandEnabled,
            boolean headCompanyEnabled,
            boolean headCompanyAuthorized) {
        public boolean allEnabled() {
            return projectEnabled && tenantEnabled && brandEnabled && headCompanyEnabled && headCompanyAuthorized;
        }
    }
}
