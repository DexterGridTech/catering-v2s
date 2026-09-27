package com.catering.v2s.organization.application.persistence;

/** SQL text fragments owned by BusinessBrandService; B3 relocates text only and does not change execution. */
public final class BusinessBrandServiceSql {
    public static final String BUSINESS_BRAND_SERVICE_INSERT_INTO_BRAND_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE_NAME =
            "INSERT INTO organization.brand (id, workspace_uuid, group_workspace_key, code, name, alias, ";
    public static final String BUSINESS_BRAND_SERVICE_REMARK_STATUS_VERSION_CREATED_AT_EPOCH_MILLIS =
            "remark, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES ";
    public static final String BUSINESS_BRAND_SERVICE_OPEN_PAREN_ENABLED = "(?, ?, ?, ?, ?, ?, ?, 'ENABLED', 1, ?, ?)";
    public static final String BUSINESS_BRAND_SERVICE_UPDATE_BRAND_CODE_NAME_ALIAS_REMARK =
            "UPDATE organization.brand SET code=?, name=?, alias=?, remark=?, version=version+1, ";
    public static final String UPDATE_UPDATED_AT_EPOCH_MS_001 =
            "updated_at_epoch_millis=? WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND version=?";
    public static final String BUSINESS_BRAND_SERVICE_UPDATE_BRAND_STATUS_VERSION_UPDATED_AT_EPOCH_MILLIS =
            "UPDATE organization.brand SET status=?, version=version+1, updated_at_epoch_millis=? ";
    public static final String BUSINESS_BRAND_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_VERSION =
            "WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND version=?";
    public static final String BUSINESS_BRAND_SERVICE_CONDITION_AND_ID = " AND id<>?";
    public static final String BUSINESS_BRAND_SERVICE_SELECT_BRAND_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "SELECT EXISTS(SELECT 1 FROM organization.brand WHERE workspace_uuid=? AND group_workspace_key=? ";
    public static final String BUSINESS_BRAND_SERVICE_CONDITION_STATUS_VOIDED_CODE =
            "AND status <> 'VOIDED' AND code=?";
    public static final String BUSINESS_BRAND_SERVICE_UPDATE_BRAND_EXTENSION_VALUES_EXTENSION_RULE_REVISION =
            "UPDATE organization.brand SET extension_values=CAST(? AS JSONB), extension_rule_revision=? WHERE id=?";
    public static final String
            BUSINESS_BRAND_SERVICE_UPDATE_BRAND_EXTENSION_VALUES_EXTENSION_RULE_REVISION_ALTERNATE_A =
                    ("UPDATE organization.brand SET extension_values=CAST(? AS JSONB), extensi"
                            + "on_rule_revision=? WHERE id=?");
    public static final String
            BUSINESS_BRAND_SERVICE_UPDATE_BRAND_EXTENSION_VALUES_EXTENSION_RULE_REVISION_ALTERNATE_B =
                    ("UPDATE organization.brand SET extension_values=CAST(? AS JSONB), extensi"
                            + "on_rule_revision=? WHERE id=?");
    public static final String CODE_CONFLICT_EXISTS_SUFFIX =
            "organization.brand WHERE workspace_uuid=? AND group_workspace_key=? AND status <> 'VOIDED' AND ";
    public static final String CODE_NAME_CONFLICT_SEPARATOR = ") AS code_conflict, EXISTS(SELECT 1 FROM ";
    public static final String NAME_CONFLICT_PREDICATE = "lower(btrim(name))=?";
}
