package com.catering.v2s.organization.application.persistence;

/** SQL text fragments owned by HeadCompanyService; B3 relocates text only and does not change execution. */
public final class HeadCompanyServiceSql {
    public static final String HEAD_COMPANY_SERVICE_INSERT_INTO_HEAD_COMPANY_BRAND_AUTHORIZATION_HEAD_COMPANY_ID =
            "INSERT INTO organization.head_company_brand_authorization (head_company_id, ";
    public static final String HEAD_COMPANY_SERVICE_BRAND_ID_AUTHORIZED_AT_EPOCH_MILLIS =
            "brand_id, authorized_at_epoch_millis) VALUES (?, ?, ?) ON CONFLICT DO ";
    public static final String HEAD_COMPANY_SERVICE_ON_CONFLICT_NOTHING = "NOTHING";
    public static final String
            HEAD_COMPANY_SERVICE_DELETE_HEAD_COMPANY_BRAND_AUTHORIZATION_DELETE_FROM_ORGANIZATION_HEA =
                    "DELETE FROM organization.head_company_brand_authorization WHERE ";
    public static final String HEAD_COMPANY_SERVICE_HEAD_COMPANY_ID_BRAND_ID = "head_company_id=? AND brand_id=?";
    public static final String
            HEAD_COMPANY_SERVICE_INSERT_INTO_HEAD_COMPANY_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE_NAME =
                    "INSERT INTO organization.head_company (id, workspace_uuid, group_workspace_key, code, name, ";
    public static final String HEAD_COMPANY_SERVICE_LEGAL_NAME_CREDIT_CODE_REMARK_STATUS =
            "legal_name, credit_code, remark, status, version, created_at_epoch_millis, ";
    public static final String HEAD_COMPANY_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_ENABLED =
            "updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ENABLED', 1, ?, ?)";
    public static final String HEAD_COMPANY_SERVICE_UPDATE_HEAD_COMPANY_CODE_NAME_LEGAL_NAME_CREDIT_CODE =
            "UPDATE organization.head_company SET code=?, name=?, legal_name=?, credit_code=?, remark=?, ";
    public static final String HEAD_COMPANY_SERVICE_EXTENSION_VALUES_EXTENSION_RULE_REVISION_VERSION =
            "extension_values=CAST(? AS JSONB), extension_rule_revision=?, version=version+1, ";
    public static final String HEAD_COMPANY_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "updated_at_epoch_millis=? WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND ";
    public static final String HEAD_COMPANY_SERVICE_VERSION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE =
            "version=? RETURNING id, workspace_uuid, group_workspace_key, code, name, legal_name, ";
    public static final String HEAD_COMPANY_SERVICE_CREDIT_CODE_VARCHAR_ALIAS_REMARK =
            "credit_code, NULL::varchar AS alias, remark, NULL::varchar AS notes, status, version, ";
    public static final String HEAD_COMPANY_SERVICE_EXTENSION_RULE_REVISION =
            "extension_rule_revision, created_at_epoch_millis, updated_at_epoch_millis, ";
    public static final String HEAD_COMPANY_SERVICE_EXTENSION_VALUES_TEXT = "extension_values::text";
    public static final String HEAD_COMPANY_SERVICE_UPDATE_HEAD_COMPANY_STATUS_VERSION =
            "UPDATE organization.head_company SET status=?, version=version+1, ";
    public static final String HEAD_COMPANY_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_WORKSPACE_UUID =
            "updated_at_epoch_millis=? WHERE id=? AND workspace_uuid=? AND ";
    public static final String HEAD_COMPANY_SERVICE_GROUP_WORKSPACE_KEY_VERSION = "group_workspace_key=? AND version=?";
    public static final String HEAD_COMPANY_SERVICE_CONDITION_AND_ID = " AND id<>?";
    public static final String HEAD_COMPANY_SERVICE_SELECT_HEAD_COMPANY_WORKSPACE_UUID =
            "SELECT EXISTS(SELECT 1 FROM organization.head_company WHERE workspace_uuid=? AND ";
    public static final String HEAD_COMPANY_SERVICE_GROUP_WORKSPACE_KEY_STATUS_VOIDED_CODE =
            "group_workspace_key=? AND status <> 'VOIDED' AND code=?";
    public static final String HEAD_COMPANY_SERVICE_UPDATE_HEAD_COMPANY_EXTENSION_VALUES =
            "UPDATE organization.head_company SET extension_values=CAST(? AS JSONB), ";
    public static final String HEAD_COMPANY_SERVICE_EXTENSION_RULE_REVISION_ALTERNATE_A =
            "extension_rule_revision=? WHERE id=?";
    public static final String HEAD_COMPANY_SERVICE_SELECT_ORGANIZATION_STATUS_ENABLED =
            "SELECT status='ENABLED' FROM organization.";
    public static final String HEAD_COMPANY_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            " WHERE id=? AND workspace_uuid=? AND group_workspace_key=?";
    public static final String HEAD_COMPANY_SERVICE_SELECT_HEAD_COMPANY_BRAND_AUTHORIZATION_HEAD_COMPANY_ID =
            "SELECT 1 FROM organization.head_company_brand_authorization WHERE head_company_id=? AND ";
    public static final String HEAD_COMPANY_SERVICE_BRAND_ID = "brand_id=?";
    public static final String HEAD_COMPANY_SERVICE_SELECT_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "SELECT 1 FROM organization.store WHERE workspace_uuid=? AND group_workspace_key=? AND ";
    public static final String HEAD_COMPANY_SERVICE_HEAD_COMPANY_ID_BRAND_ID_ALTERNATE_A =
            "head_company_id=? AND brand_id=? LIMIT 1";
    public static final String CODE_CONFLICT_EXISTS_SUFFIX =
            ") AS code_conflict, EXISTS(SELECT 1 FROM organization.head_company WHERE workspace_uuid=? AND ";
    public static final String NAME_CONFLICT_PREDICATE =
            "group_workspace_key=? AND status <> 'VOIDED' AND lower(btrim(name))=?";
}
