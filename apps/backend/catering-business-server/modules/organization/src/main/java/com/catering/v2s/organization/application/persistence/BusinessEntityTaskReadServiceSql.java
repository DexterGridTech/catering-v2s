package com.catering.v2s.organization.application.persistence;

/** SQL text fragments owned by BusinessEntityTaskReadService; B3 relocates text only and does not change execution. */
public final class BusinessEntityTaskReadServiceSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String BUSINESS_ENTITY_PROJECTION =
            "entities.id, entities.workspace_uuid, entities.group_workspace_key, entities.code, entities.name, "
                    + "entities.legal_name, entities.credit_code, entities.alias, entities.remark, entities.notes, "
                    + "entities.status, entities.version, entities.extension_rule_revision, "
                    + "entities.created_at_epoch_millis, entities.updated_at_epoch_millis, entities.extension_values, "
                    + "entities.entity_type";
    public static final String ENTITY_ORDER_NAME = "name";
    public static final String ENTITY_ORDER_CODE = "code";
    public static final String ENTITY_ORDER_UPDATED_AT = "updated_at_epoch_millis";
    public static final String SORT_DIRECTION_ASC = "ASC";
    public static final String SORT_DIRECTION_DESC = "DESC";
    public static final String ENTITY_FIELDS_BRAND =
            "NULL::varchar AS legal_name, NULL::varchar AS credit_code, alias, remark, NULL::varchar AS notes";
    public static final String ENTITY_FIELDS_STORE =
            "NULL::varchar AS legal_name, NULL::varchar AS credit_code, NULL::varchar AS alias, NULL::varchar AS remark, notes";
    public static final String ENTITY_FIELDS_DEFAULT =
            "legal_name, credit_code, NULL::varchar AS alias, remark, NULL::varchar AS notes";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE_NAME = "SELECT b.id, b.workspace_uuid, b.group_workspace_key, b.code, b.name, NULL::varchar AS legal_name, ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_VARCHAR_CREDIT_CODE_ALIAS_REMARK = "NULL::varchar AS credit_code, b.alias, b.remark, NULL::varchar AS notes, b.status, ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_VERSION = "b.version, ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_EXTENSION_RULE_REVISION = "b.extension_rule_revision, b.created_at_epoch_millis, b.updated_at_epoch_millis, ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_HEAD_COMPANY_BRAND_AUTHORIZATION = "b.extension_values::text FROM organization.head_company_brand_authorization a JOIN ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_ALTERNATIVE_BRAND_BRAND_ID_HEAD_COMPANY_ID_WORKSPACE_UUID = "organization.brand b ON b.id=a.brand_id WHERE a.head_company_id=? AND b.workspace_uuid=? ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONDITION = "AND ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY = "b.group_workspace_key=? ORDER BY b.id";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE_NAME_ALTERNATE_A = "SELECT b.id, b.workspace_uuid, b.group_workspace_key, b.code, b.name, NULL::varchar AS legal_name, ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_VARCHAR_CREDIT_CODE_ALIAS_REMARK_ALTERNATE_A = "NULL::varchar AS credit_code, b.alias, b.remark, NULL::varchar AS notes, b.status, ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_VERSION_ALTERNATE_A = "b.version, ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_EXTENSION_RULE_REVISION_ALTERNATE_A = "b.extension_rule_revision, b.created_at_epoch_millis, b.updated_at_epoch_millis, ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_HEAD_COMPANY_EXTENSION_VALUES_TEXT_HEAD_COMPANY_ID = "b.extension_values::text, h.id AS head_company_id FROM organization.head_company h LEFT ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_JOIN = "JOIN ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_ALTERNATIVE_HEAD_COMPANY_BRAND_AUTHORIZATION_HEAD_COMPANY_ID = "organization.head_company_brand_authorization a ON a.head_company_id=h.id LEFT JOIN ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_ALTERNATIVE_BRAND_BRAND_ID_WORKSPACE_UUID = "organization.brand b ON b.id=a.brand_id AND b.workspace_uuid=h.workspace_uuid AND ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_WORKSPACE_UUID = "b.group_workspace_key=h.group_workspace_key WHERE h.workspace_uuid=? AND ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_ALTERNATE_A = "h.group_workspace_key=? AND h.id IN (";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_HEAD_COMPANY_BRAND_AUTHORIZATION = "SELECT brand_id, authorized_at_epoch_millis FROM organization.head_company_brand_authorization WHERE ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_HEAD_COMPANY_ID_BRAND_ID = "head_company_id=? ORDER BY brand_id";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_STORE_STATUS_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "SELECT status FROM organization.store WHERE id=? AND workspace_uuid=? AND group_workspace_key=?";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_STORE_STORE_REF_STATUS_BRAND_ID = "SELECT store.id AS store_ref, store.status, store.brand_id ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_FROM_CLAUSE_STORE_FROM_ORGANIZATION_STORE_STOR = "FROM organization.store store ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_WHERE_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "WHERE store.id=? AND store.workspace_uuid=? AND store.group_workspace_key=?";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_STORE_BRAND_ID_VERSION_WORKSPACE_UUID = "SELECT brand_id, version FROM organization.store WHERE id=? AND workspace_uuid=? AND ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_STATUS_ENABLED = "group_workspace_key=? AND status='ENABLED'";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_VERSION_AUTHORIZED_AT_EPOCH_MILLIS = "SELECT h.version, b.version, a.authorized_at_epoch_millis FROM ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_ALTERNATIVE_HEAD_COMPANY_HEAD_COMPANY_BRAND_AUTHORIZATION = "organization.head_company_brand_authorization a JOIN organization.head_company h ON ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_BRAND_HEAD_COMPANY_ID_BRAND_ID = "h.id=a.head_company_id JOIN organization.brand b ON b.id=a.brand_id WHERE h.id=? AND ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_ENABLED = "h.workspace_uuid=? AND h.group_workspace_key=? AND h.status='ENABLED' AND a.brand_id=? ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONDITION_ALTERNATE_A = "AND ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_STATUS_ENABLED = "b.status='ENABLED'";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_STORE_BRAND_ID_HEAD_COMPANY_ID_WORKSPACE_UUID = "SELECT brand_id, head_company_id FROM organization.store WHERE id=? AND workspace_uuid=? AND ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_STATUS_ENABLED_ALTERNATE_A = "group_workspace_key=? AND status='ENABLED'";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_STORE_HEAD_COMPANY_ID_WORKSPACE_UUID = "SELECT head_company_id FROM organization.store WHERE id=? AND workspace_uuid=? AND ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_STATUS_ENABLED_ALTERNATE_B = "group_workspace_key=? AND status='ENABLED'";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_HEAD_COMPANY_SELECT_EXISTS_SELECT_1_FROM_ = "SELECT EXISTS (SELECT 1 FROM organization.head_company h JOIN ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_ALTERNATIVE_HEAD_COMPANY_BRAND_AUTHORIZATION_HEAD_COMPANY_ID_ALTERNATE_A = "organization.head_company_brand_authorization a ON a.head_company_id=h.id JOIN ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_ALTERNATIVE_BRAND_BRAND_ID_WORKSPACE_UUID_ALTERNATE_A = "organization.brand b ON b.id=a.brand_id WHERE h.id=? AND h.workspace_uuid=? AND ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_STATUS_ENABLED_ALTERNATE_C = "h.group_workspace_key=? AND h.status='ENABLED' AND b.id=? AND b.status='ENABLED')";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_STORE_PROJECT_ID_CODE_NAME_WORKSPACE_UUID = "SELECT project_id, code, name FROM organization.store WHERE id=? AND workspace_uuid=? AND ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_ALTERNATE_B = "group_workspace_key=?";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_TENANT_ID_PROJECT_ID_STATUS_TENANT_STATUS = "SELECT s.tenant_id, s.project_id, s.status, t.status AS tenant_status, phase.phase_name ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_FROM_CLAUSE_TENANT_TENANT_ID = "FROM organization.store s JOIN organization.tenant t ON t.id=s.tenant_id AND ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "t.workspace_uuid=s.workspace_uuid AND t.group_workspace_key=s.group_workspace_key LEFT JOIN ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_ALTERNATIVE_PROJECT_PHASE_NAME_PHASE_PROJECT_ID = "organization.project_phase_name phase ON phase.project_id=s.project_id WHERE s.id=? AND ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_WORKSPACE_UUID = "s.workspace_uuid=? AND s.group_workspace_key=? ORDER BY phase.display_order";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE_NAME_ALTERNATE_B = "SELECT id, workspace_uuid, group_workspace_key, code, name, ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = " WHERE id=? AND workspace_uuid=? AND group_workspace_key=?";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_COMMERCIAL_GROUP_COMMERCIAL_GROUP_UUID_GROUP_WORKSPACE_KEY = "SELECT commercial_group_uuid FROM organization.commercial_group WHERE group_workspace_key=?";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_STORE_PROJECT_ID_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "SELECT project_id FROM organization.store WHERE id=? AND workspace_uuid=? AND group_workspace_key=?";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_STORE_PROJECT_ID_TENANT_ID_BRAND_ID_CODE = "SELECT project_id, tenant_id, brand_id, code FROM organization.store ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_A = "WHERE id=? AND workspace_uuid=? AND group_workspace_key=?";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE_NAME_ALTERNATE_C = "SELECT id, workspace_uuid, group_workspace_key, code, name, ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE = " WHERE workspace_uuid=? AND group_workspace_key=? ORDER BY code";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_OPEN_PAREN_TEXT_LOWER_NAME_LIKE = "(CAST(? AS text) IS NULL OR lower(name) LIKE ?) AND (CAST(? AS text) IS NULL OR lower(code) LIKE ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_PARAMETER_PLACEHOLDER_TEXT_LOWER_LEGAL_NAME_LIKE = "?) AND (CAST(? AS text) IS NULL OR lower(legal_name) LIKE ?) AND (CAST(? AS text) IS ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION = "NULL ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_ALTERNATIVE_LOWER_CREDIT_CODE_LIKE_TEXT = "OR lower(credit_code) LIKE ?) AND (CAST(? AS text) IS NULL OR status=?) AND (CAST(? AS ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_TEXT_ENTITY_TYPE = "text) IS NULL OR entity_type=?)";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_SELECT_COUNT_FROM = "SELECT count(*) FROM (";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_FROM_CLAUSE = " FROM (";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_ORDER_BY = " ORDER BY ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_FROM_CLAUSE_ALTERNATE_A = " FROM (";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE_NAME_ALTERNATE_D = "SELECT id, workspace_uuid, group_workspace_key, code, name, NULL::varchar AS legal_name, NULL::varchar ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_CREDIT_CODE_ALIAS_REMARK_VARCHAR = "AS credit_code, alias, remark, NULL::varchar AS notes, status, version, extension_rule_revision, ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_CREATED_AT_EPOCH_MILLIS_EXTENSION_VALUES = "created_at_epoch_millis, updated_at_epoch_millis, extension_values, 'BRAND' AS entity_type ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_FROM_CLAUSE_ALTERNATE_B = "FROM ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_ALTERNATIVE_BRAND_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "organization.brand WHERE workspace_uuid=? AND group_workspace_key=? UNION ALL SELECT id, ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE_NAME = "workspace_uuid, group_workspace_key, code, name, legal_name, credit_code, NULL::varchar AS alias, ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_REMARK_VARCHAR_NOTES_STATUS = "remark, NULL::varchar AS notes, status, version, extension_rule_revision, created_at_epoch_millis, ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_UPDATE_TENANT_EXTENSION_VALUES = "updated_at_epoch_millis, extension_values, 'TENANT' AS entity_type FROM organization.tenant ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_WHERE = "WHERE ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_A = "workspace_uuid=? AND group_workspace_key=? UNION ALL SELECT id, workspace_uuid, ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_ALTERNATE_C = "group_workspace_key, ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_CODE_NAME_LEGAL_NAME_CREDIT_CODE = "code, name, legal_name, credit_code, NULL::varchar AS alias, remark, NULL::varchar AS notes, ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_STATUS = "status, ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_VERSION_ALTERNATE_B = "version, extension_rule_revision, created_at_epoch_millis, updated_at_epoch_millis, ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_HEAD_COMPANY_EXTENSION_VALUES_ENTITY_TYPE = "extension_values, 'HEAD_COMPANY' AS entity_type FROM organization.head_company WHERE ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_CONTINUATION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_B = "workspace_uuid=? AND group_workspace_key=?";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE_NAME_ALTERNATE_E = "SELECT id, workspace_uuid, group_workspace_key, code, name, ";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_B = " WHERE workspace_uuid=? AND group_workspace_key=? AND id IN (";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_ORGANIZATION_STATUS_ENABLED = "SELECT status='ENABLED' FROM organization.";
    public static final String BUSINESS_ENTITY_TASK_READ_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_C = " WHERE id=? AND workspace_uuid=? AND group_workspace_key=?";
    public static final String AUTHORIZED_BRANDS_ORDER_SUFFIX = ") ORDER BY h.id, b.id";
    public static final String STORE_TENANT_LOCK_SUFFIX = " FOR UPDATE OF s, t";
    public static final String ENTITY_TABLE_COMMON_SUFFIX = "updated_at_epoch_millis, extension_values::text FROM organization.";
    public static final String SELECT_PREFIX = "SELECT ";
    public static final String ENTITY_WHERE_SUFFIX = ") entities WHERE ";
    public static final String ENTITY_ID_WHERE_SUFFIX = ") entities WHERE id=?";
    public static final String ENTITY_PAGE_ORDER_SUFFIX = ", id ASC LIMIT ? OFFSET ?";
    public static final String ENTITY_MULTI_ID_CLOSE_SUFFIX = ")";
    public static final String ENTITY_PAGE_PROJECTION_SUFFIX = ", status, version, extension_rule_revision, created_at_epoch_millis, ";
    public static final String SQL_SPACE = " ";
    public static final String BRAND_PAGE_PREDICATE =
            "(CAST(? AS text) IS NULL OR lower(name) LIKE ? OR lower(code) LIKE ?) AND "
                    + "(CAST(? AS text) IS NULL OR status=?) AND (CAST(? AS text) IS NULL OR entity_type=?)";
}
