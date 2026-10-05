package com.catering.v2s.contract.application.persistence;

import com.catering.v2s.contract.api.StoreContractReadback;
import com.catering.v2s.contract.application.ContractCommandService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC execution boundary for store-contract command and authoritative readback facts. */
@Repository
public class ContractCommandPersistence {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final JdbcTemplate jdbc;
    private final ContractTerminalTopicSnapshotPersistence terminalTopics;

    public ContractCommandPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        this.terminalTopics = new ContractTerminalTopicSnapshotPersistence(jdbc);
    }

    public void lockActiveCollection(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef) {
        terminalTopics.lockActiveCollection(workspaceUuid, groupWorkspaceKey, storeRef);
    }

    public void notifyContract(UUID workspaceUuid, String groupWorkspaceKey, UUID contractRef) {
        terminalTopics.notifyContract(workspaceUuid, groupWorkspaceKey, contractRef);
    }

    public void refreshActiveCollection(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, long triggerTime) {
        terminalTopics.refreshActiveCollection(workspaceUuid, groupWorkspaceKey, storeRef, triggerTime);
    }

    public record ContractState(StoreContractReadback readback, String extensionValuesJson) {}

    public int insertWithExtensions(
            UUID id,
            UUID workspaceUuid,
            String key,
            String contractNo,
            UUID storeId,
            UUID tenantId,
            LocalDate effectiveFrom,
            LocalDate effectiveTo,
            String phaseName,
            String notes,
            String itemsJson,
            String extensionValuesJson,
            long extensionRuleRevision,
            long createdAtEpochMillis,
            long updatedAtEpochMillis) {
        return jdbc.update(
                ContractCommandServiceSql.INSERT_INTO_STORE_CONTRACT_WS_001
                        + ContractCommandServiceSql
                                .CONTRACT_COMMAND_SERVICE_STORE_ID_TENANT_ID_EFFECTIVE_FROM_EFFECTIVE_TO
                        + ContractCommandServiceSql
                                .CONTRACT_COMMAND_SERVICE_ITEMS_JSON_EXTENSION_VALUES_EXTENSION_RULE_REVISION
                        + ContractCommandServiceSql
                                .CONTRACT_COMMAND_SERVICE_STATUS_VERSION_CREATED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS
                        + ContractCommandServiceSql.CONTRACT_COMMAND_SERVICE_PARAMETER_PLACEHOLDER
                        + ContractCommandServiceSql.CONTRACT_COMMAND_SERVICE_PARAMETER_PLACEHOLDER_ACTIVE,
                id,
                workspaceUuid,
                key,
                contractNo,
                storeId,
                tenantId,
                effectiveFrom,
                effectiveTo,
                phaseName,
                notes,
                itemsJson,
                extensionValuesJson,
                extensionRuleRevision,
                createdAtEpochMillis,
                updatedAtEpochMillis);
    }

    public int updateFromCommand(
            LocalDate effectiveFrom,
            LocalDate effectiveTo,
            String phaseName,
            String notes,
            String itemsJson,
            long updatedAtEpochMillis,
            UUID contractId,
            UUID workspaceUuid,
            String key,
            long expectedVersion) {
        return jdbc.update(
                ContractCommandServiceSql.UPDATE_STORE_CONTRACT_EFFECTIVE_FROM_002
                        + ContractCommandServiceSql
                                .CONTRACT_COMMAND_SERVICE_NOTES_ITEMS_JSON_VERSION_UPDATED_AT_EPOCH_MILLIS
                        + ContractCommandServiceSql
                                .CONTRACT_COMMAND_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_ACTIVE
                        + ContractCommandServiceSql.CONTRACT_COMMAND_SERVICE_VERSION,
                effectiveFrom,
                effectiveTo,
                phaseName,
                notes,
                itemsJson,
                updatedAtEpochMillis,
                contractId,
                workspaceUuid,
                key,
                expectedVersion);
    }

    public int insertWithoutExtensions(
            UUID id,
            UUID workspaceUuid,
            String key,
            String contractNo,
            UUID storeId,
            UUID tenantId,
            LocalDate effectiveFrom,
            LocalDate effectiveTo,
            String phaseName,
            String notes,
            String itemsJson,
            long createdAtEpochMillis,
            long updatedAtEpochMillis) {
        return jdbc.update(
                ContractCommandServiceSql.INSERT_INTO_STORE_CONTRACT_WS_ALT_A_003
                        + ContractCommandServiceSql
                                .CONTRACT_COMMAND_SERVICE_STORE_ID_TENANT_ID_EFFECTIVE_FROM_EFFECTIVE_TO_ALTERNATE_A
                        + ContractCommandServiceSql.CONTRACT_COMMAND_SERVICE_ITEMS_JSON
                        + ContractCommandServiceSql.STATUS_VER_CREATED_AT_EPOCH_ALT_A_004
                        + ContractCommandServiceSql.CONTRACT_COMMAND_SERVICE_PARAMETER_PLACEHOLDER_ALTERNATE_A
                        + ContractCommandServiceSql.CONTRACT_COMMAND_SERVICE_PARAMETER_PLACEHOLDER_ACTIVE_ALTERNATE_A,
                id,
                workspaceUuid,
                key,
                contractNo,
                storeId,
                tenantId,
                effectiveFrom,
                effectiveTo,
                phaseName,
                notes,
                itemsJson,
                createdAtEpochMillis,
                updatedAtEpochMillis);
    }

    public int updateFromLegacyCommand(
            LocalDate effectiveFrom,
            LocalDate effectiveTo,
            String phaseName,
            String notes,
            String itemsJson,
            long updatedAtEpochMillis,
            UUID contractId,
            UUID workspaceUuid,
            String key,
            long expectedVersion) {
        return jdbc.update(
                ContractCommandServiceSql.UPDATE_STORE_CONTRACT_EFFECTIVE_FROM_ALT_A_005
                        + ContractCommandServiceSql
                                .CONTRACT_COMMAND_SERVICE_NOTES_ITEMS_JSON_VERSION_UPDATED_AT_EPOCH_MILLIS_ALTERNATE_A
                        + ContractCommandServiceSql.WHERE_WS_UUID_GRP_WS_ALT_A_006
                        + ContractCommandServiceSql.CONTRACT_COMMAND_SERVICE_VERSION_ALTERNATE_A,
                effectiveFrom,
                effectiveTo,
                phaseName,
                notes,
                itemsJson,
                updatedAtEpochMillis,
                contractId,
                workspaceUuid,
                key,
                expectedVersion);
    }

    public int invalidate(
            long invalidatedAtEpochMillis,
            long updatedAtEpochMillis,
            UUID contractId,
            UUID workspaceUuid,
            String key,
            long expectedVersion) {
        return jdbc.update(
                ContractCommandServiceSql.UPDATE_STORE_CONTRACT_STATUS_INVALID_007
                        + ContractCommandServiceSql
                                .CONTRACT_COMMAND_SERVICE_VERSION_UPDATED_AT_EPOCH_MILLIS_WORKSPACE_UUID
                        + ContractCommandServiceSql.CONTRACT_COMMAND_SERVICE_GROUP_WORKSPACE_KEY_STATUS_ACTIVE_VERSION,
                invalidatedAtEpochMillis,
                updatedAtEpochMillis,
                contractId,
                workspaceUuid,
                key,
                expectedVersion);
    }

    public StoreContractReadback require(UUID workspaceUuid, String key, UUID contractId) {
        return jdbc.query(
                ContractCommandServiceSql
                                .CONTRACT_COMMAND_SERVICE_SELECT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CONTRACT_NO_STORE_ID
                        + ContractCommandServiceSql
                                .CONTRACT_COMMAND_SERVICE_EFFECTIVE_TO_PHASE_NAME_SNAPSHOT_NOTES_STATUS
                        + ContractCommandServiceSql
                                .CONTRACT_COMMAND_SERVICE_STORE_CONTRACT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setObject(1, contractId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                },
                result -> {
                    if (!result.next()) throw new ContractCommandService.ContractNotFoundException();
                    return readback(result);
                });
    }

    public ContractState requireState(UUID workspaceUuid, String key, UUID contractId) {
        return jdbc.query(
                ContractCommandServiceSql.SELECT_WS_UUID_GRP_WS_ALT_A_008
                        + ContractCommandServiceSql
                                .CONTRACT_COMMAND_SERVICE_EFFECTIVE_TO_PHASE_NAME_SNAPSHOT_NOTES_STATUS_ALTERNATE_A
                        + ContractCommandServiceSql
                                .CONTRACT_COMMAND_SERVICE_STORE_CONTRACT_EXTENSION_VALUES_TEXT_WORKSPACE_UUID
                        + ContractCommandServiceSql.CONTRACT_COMMAND_SERVICE_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setObject(1, contractId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                },
                result -> {
                    if (!result.next()) throw new ContractCommandService.ContractNotFoundException();
                    return new ContractState(readback(result), result.getString(14));
                });
    }

    public List<StoreContractReadback> list(UUID workspaceUuid, String key) {
        return jdbc.query(
                ContractCommandServiceSql.SELECT_WS_UUID_GRP_WS_ALT_B_009
                        + ContractCommandServiceSql
                                .CONTRACT_COMMAND_SERVICE_EFFECTIVE_TO_PHASE_NAME_SNAPSHOT_NOTES_STATUS_ALTERNATE_B
                        + ContractCommandServiceSql
                                .CONTRACT_COMMAND_SERVICE_STORE_CONTRACT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_A
                        + ContractCommandServiceSql.CONTRACT_COMMAND_SERVICE_CONTRACT_NO,
                (row, index) -> readback(row),
                workspaceUuid,
                key);
    }

    public String readExtensionValues(UUID contractId) {
        return jdbc.query(
                ContractCommandServiceSql.CONTRACT_COMMAND_SERVICE_SELECT_STORE_CONTRACT_EXTENSION_VALUES_TEXT,
                statement -> statement.setObject(1, contractId),
                result -> {
                    if (!result.next()) throw new ContractCommandService.ContractNotFoundException();
                    return result.getString(1);
                });
    }

    public int clearExtensionValues(UUID contractId, String currentJson, long extensionRuleRevision) {
        return jdbc.update(
                ContractCommandServiceSql
                                .CONTRACT_COMMAND_SERVICE_UPDATE_STORE_CONTRACT_EXTENSION_VALUES_EXTENSION_RULE_REVISION
                        + ContractCommandServiceSql.CONTRACT_COMMAND_SERVICE_WHERE_WHERE_ID,
                currentJson,
                extensionRuleRevision,
                contractId);
    }

    public int updateExtensionValues(UUID contractId, String valuesJson, long extensionRuleRevision) {
        return jdbc.update(
                ContractCommandServiceSql.UPDATE_STORE_CONTRACT_EXTENSION_VALUES_ALT_A_010
                        + ContractCommandServiceSql.CONTRACT_COMMAND_SERVICE_ID,
                valuesJson,
                extensionRuleRevision,
                contractId);
    }

    public String readExtensionValuesForSubmission(UUID contractId) {
        return jdbc.query(
                ContractCommandServiceSql
                        .CONTRACT_COMMAND_SERVICE_SELECT_STORE_CONTRACT_EXTENSION_VALUES_TEXT_ALTERNATE_A,
                statement -> statement.setObject(1, contractId),
                result -> {
                    if (!result.next()) throw new ContractCommandService.ContractNotFoundException();
                    return result.getString(1);
                });
    }

    public int clearSubmittedExtensionValues(UUID contractId, String currentJson) {
        return jdbc.update(
                ContractCommandServiceSql.UPDATE_STORE_CONTRACT_EXTENSION_VALUES_ALT_B_011
                        + ContractCommandServiceSql.CONTRACT_COMMAND_SERVICE_WHERE_WHERE_ID_ALTERNATE_A,
                currentJson,
                0L,
                contractId);
    }

    public int updateSubmittedExtensionValues(UUID contractId, String valuesJson, long extensionRuleRevision) {
        return jdbc.update(
                ContractCommandServiceSql.UPDATE_STORE_CONTRACT_EXTENSION_VALUES_ALT_C_012
                        + ContractCommandServiceSql.CONTRACT_COMMAND_SERVICE_ID_ALTERNATE_A,
                valuesJson,
                extensionRuleRevision,
                contractId);
    }

    public int insertAuditEvent(
            UUID eventId,
            UUID workspaceUuid,
            String key,
            String contractRef,
            String actorType,
            UUID actorId,
            String actorDisplaySnapshot,
            String action,
            long occurredAtEpochMillis,
            String changesJson) {
        return jdbc.update(
                ContractCommandServiceSql.INSERT_INTO_AUDIT_EVENT_WS_013
                        + ContractCommandServiceSql
                                .CONTRACT_COMMAND_SERVICE_ENTITY_REF_TEXT_ACTOR_TYPE_ACTOR_ID_ACTOR_DISPLAY_SNAPSHOT
                        + ContractCommandServiceSql
                                .CONTRACT_COMMAND_SERVICE_OCCURRED_AT_EPOCH_MILLIS_CHANGES_JSON_STORE_CONTRACT
                        + ContractCommandServiceSql.CONTRACT_COMMAND_SERVICE_PARAMETER_PLACEHOLDER_ALTERNATE_B
                        + ContractCommandServiceSql.CONTRACT_COMMAND_SERVICE_CAST_AS_JSONB,
                eventId,
                workspaceUuid,
                key,
                contractRef,
                actorType,
                actorId,
                actorDisplaySnapshot,
                action,
                occurredAtEpochMillis,
                changesJson);
    }

    private static StoreContractReadback readback(ResultSet result) throws SQLException {
        return new StoreContractReadback(
                result.getObject(1, UUID.class),
                result.getObject(2, UUID.class),
                result.getString(3),
                result.getString(4),
                result.getObject(5, UUID.class),
                result.getObject(6, UUID.class),
                result.getObject(7, LocalDate.class),
                result.getObject(8, LocalDate.class),
                result.getString(9),
                result.getString(10),
                result.getString(11),
                result.getLong(12),
                readItems(result.getString(13)));
    }

    private static List<StoreContractReadback.Item> readItems(String source) {
        try {
            JsonNode array = JSON.readTree(source);
            if (!array.isArray()) throw new ContractCommandService.ContractValidationException();
            List<StoreContractReadback.Item> values = new ArrayList<>();
            int line = 1;
            for (JsonNode item : array)
                values.add(new StoreContractReadback.Item(
                        line++, item.path("code").asText(), item.path("name").asText()));
            return List.copyOf(values);
        } catch (java.io.IOException failure) {
            throw new ContractCommandService.ContractValidationException(failure);
        }
    }
}
