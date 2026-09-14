package com.catering.v2s.organization.application.persistence;

import com.catering.v2s.organization.api.BusinessEntityTypes;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed persistence boundary for head-company facts and brand authorizations. */
@Repository
public class HeadCompanyPersistence {
    private final JdbcTemplate jdbc;

    public HeadCompanyPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public int addBrandAuthorization(UUID headCompanyId, UUID brandId, long authorizedAtEpochMillis) {
        return jdbc.update(
                HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_INSERT_INTO_HEAD_COMPANY_BRAND_AUTHORIZATION_HEAD_COMPANY_ID
                        + HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_CONTINUATION_BRAND_ID_AUTHORIZED_AT_EPOCH_MILLIS
                        + HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_CONTINUATION,
                headCompanyId,
                brandId,
                authorizedAtEpochMillis);
    }

    public int removeBrandAuthorization(UUID headCompanyId, UUID brandId) {
        return jdbc.update(
                HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_DELETE_HEAD_COMPANY_BRAND_AUTHORIZATION_DELETE_FROM_ORGANIZATION_HEA
                        + HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_CONTINUATION_HEAD_COMPANY_ID_BRAND_ID,
                headCompanyId,
                brandId);
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
                HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_INSERT_INTO_HEAD_COMPANY_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE_NAME
                        + HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_CONTINUATION_LEGAL_NAME_CREDIT_CODE_REMARK_STATUS
                        + HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_ENABLED,
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

    public Optional<OrganizationEntityReadback> update(
            UUID id,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String legalName,
            String creditCode,
            String remark,
            String extensionValues,
            long extensionRuleRevision,
            long now,
            long expectedVersion) {
        List<OrganizationEntityReadback> values = jdbc.query(
                HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_UPDATE_HEAD_COMPANY_CODE_NAME_LEGAL_NAME_CREDIT_CODE
                        + HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_CONTINUATION_EXTENSION_VALUES_EXTENSION_RULE_REVISION_VERSION
                        + HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_CONTINUATION_VERSION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE
                        + HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_CONTINUATION_CREDIT_CODE_VARCHAR_ALIAS_REMARK
                        + HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_CONTINUATION_EXTENSION_RULE_REVISION
                        + HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_CONTINUATION_EXTENSION_VALUES_TEXT,
                statement -> {
                    statement.setString(1, code);
                    statement.setString(2, name);
                    statement.setString(3, legalName);
                    statement.setString(4, creditCode);
                    statement.setString(5, remark);
                    statement.setString(6, extensionValues);
                    statement.setLong(7, extensionRuleRevision);
                    statement.setLong(8, now);
                    statement.setObject(9, id);
                    statement.setObject(10, workspaceUuid);
                    statement.setString(11, groupWorkspaceKey);
                    statement.setLong(12, expectedVersion);
                },
                (result, index) -> OrganizationEntityReadbackMapper.read(BusinessEntityTypes.HEAD_COMPANY, result));
        return values.stream().findFirst();
    }

    public int transitionStatus(
            UUID id,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String status,
            long now,
            long expectedVersion) {
        return jdbc.update(
                HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_UPDATE_HEAD_COMPANY_STATUS_VERSION
                        + HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_WORKSPACE_UUID
                        + HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_VERSION,
                status,
                now,
                id,
                workspaceUuid,
                groupWorkspaceKey,
                expectedVersion);
    }

    public ConflictFlags findConflicts(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID currentId,
            String code,
            String name) {
        String exclusion = currentId == null ? "" : HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_CONDITION_AND_ID;
        String sql = HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_SELECT_HEAD_COMPANY_WORKSPACE_UUID
                + HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_STATUS_VOIDED_CODE
                + exclusion
                + HeadCompanyServiceSql.CODE_CONFLICT_EXISTS_SUFFIX
                + HeadCompanyServiceSql.NAME_CONFLICT_PREDICATE
                + exclusion
                + ") AS name_conflict";
        Object[] args = currentId == null
                ? new Object[] {workspaceUuid, groupWorkspaceKey, code, workspaceUuid, groupWorkspaceKey, name}
                : new Object[] {
                    workspaceUuid,
                    groupWorkspaceKey,
                    code,
                    currentId,
                    workspaceUuid,
                    groupWorkspaceKey,
                    name,
                    currentId
                };
        return jdbc.query(
                sql,
                statement -> {
                    for (int index = 0; index < args.length; index++) statement.setObject(index + 1, args[index]);
                },
                result -> {
                    if (!result.next()) throw new IllegalStateException("head company conflict query returned no row");
                    return new ConflictFlags(result.getBoolean("code_conflict"), result.getBoolean("name_conflict"));
                });
    }

    public int replaceExtensionValues(UUID id, String extensionValues, long extensionRuleRevision) {
        return jdbc.update(
                HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_UPDATE_HEAD_COMPANY_EXTENSION_VALUES
                        + HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_CONTINUATION_EXTENSION_RULE_REVISION_ALTERNATE_A,
                extensionValues,
                extensionRuleRevision,
                id);
    }

    public boolean isBrandEnabled(UUID workspaceUuid, String groupWorkspaceKey, UUID brandId) {
        return jdbc.query(
                HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_SELECT_ORGANIZATION_STATUS_ENABLED + "brand" + HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setObject(1, brandId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> result.next() && result.getBoolean(1));
    }

    public boolean isBrandAuthorized(UUID headCompanyId, UUID brandId) {
        return !jdbc.query(
                        HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_SELECT_HEAD_COMPANY_BRAND_AUTHORIZATION_HEAD_COMPANY_ID
                                + HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_CONTINUATION_BRAND_ID,
                        (row, index) -> row.getInt(1),
                        headCompanyId,
                        brandId)
                .isEmpty();
    }

    public boolean hasStoreReference(UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId, UUID brandId) {
        return !jdbc.query(
                        HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_SELECT_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                                + HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_CONTINUATION_HEAD_COMPANY_ID_BRAND_ID_ALTERNATE_A,
                        (row, index) -> row.getInt(1),
                        workspaceUuid,
                        groupWorkspaceKey,
                        headCompanyId,
                        brandId)
                .isEmpty();
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
        return jdbc.update(
                HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_INSERT_INTO_AUDIT_EVENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ENTITY_TYPE
                        + HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_CONTINUATION_ENTITY_REF_TEXT_ACTOR_TYPE_ACTOR_ID_ACTOR_DISPLAY_SNAPSHOT
                        + HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_CONTINUATION_OCCURRED_AT_EPOCH_MILLIS_CHANGES_JSON
                        + HeadCompanyServiceSql.HEAD_COMPANY_SERVICE_CONTINUATION_ALTERNATE_A,
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
