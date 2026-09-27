package com.catering.v2s.organization.application.persistence;

import com.catering.v2s.extension.api.ExtensionFilterQuery;
import com.catering.v2s.organization.api.BusinessEntityTypes;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.OrganizationOwnerApi;
import com.catering.v2s.organization.api.StoreContractLookup.StoreContractContext;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed persistence boundary for organization task reads and eligibility projections. */
@Repository
public class BusinessEntityTaskReadPersistence {
    private static final Set<String> ENTITY_TYPES = Set.of("BRAND", "TENANT", BusinessEntityTypes.HEAD_COMPANY);
    private final JdbcTemplate jdbc;

    public BusinessEntityTaskReadPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<OrganizationEntityReadback> authorizedBrands(
            UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId) {
        return jdbc.query(
                BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE_NAME
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_VARCHAR_CREDIT_CODE_ALIAS_REMARK
                        + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_VERSION
                        + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_EXTENSION_RULE_REVISION
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_HEAD_COMPANY_BRAND_AUTHORIZATION
                        + BusinessEntityTaskReadServiceSql.ALT_BRAND_ID_HEAD_COMPANY_001
                        + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_CONDITION
                        + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY,
                (row, index) -> OrganizationEntityReadbackMapper.read("BRAND", row),
                headCompanyId,
                workspaceUuid,
                groupWorkspaceKey);
    }

    public List<BrandByHeadCompany> authorizedBrandsByHeadCompanyIds(
            UUID workspaceUuid, String groupWorkspaceKey, List<UUID> headCompanyIds) {
        String placeholders = String.join(
                BusinessEntityTaskReadServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(headCompanyIds.size(), BusinessEntityTaskReadServiceSql.PARAMETER_PLACEHOLDER));
        return jdbc.query(
                BusinessEntityTaskReadServiceSql.SELECT_WS_UUID_GRP_WS_ALT_A_002
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_VARCHAR_CREDIT_CODE_ALIAS_REMARK_ALTERNATE_A
                        + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_VERSION_ALTERNATE_A
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_EXTENSION_RULE_REVISION_ALTERNATE_A
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_HEAD_COMPANY_EXTENSION_VALUES_TEXT_HEAD_COMPANY_ID
                        + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_JOIN
                        + BusinessEntityTaskReadServiceSql.ALT_HEAD_COMPANY_BRAND_AUTH_003
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_ALTERNATIVE_BRAND_BRAND_ID_WORKSPACE_UUID
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_WORKSPACE_UUID
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_ALTERNATE_A
                        + placeholders
                        + BusinessEntityTaskReadServiceSql.AUTHORIZED_BRANDS_ORDER_SUFFIX,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    for (int index = 0; index < headCompanyIds.size(); index++)
                        statement.setObject(index + 3, headCompanyIds.get(index));
                },
                (row, index) -> {
                    UUID headCompanyId = row.getObject("head_company_id", UUID.class);
                    OrganizationEntityReadback brand = row.getObject(1, UUID.class) == null
                            ? null
                            : OrganizationEntityReadbackMapper.read("BRAND", row);
                    return new BrandByHeadCompany(headCompanyId, brand);
                });
    }

    public List<HeadCompanyBrandAuthorizationFact> authorizedBrandAuthorizations(UUID headCompanyId) {
        return jdbc.query(
                BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_HEAD_COMPANY_BRAND_AUTHORIZATION
                        + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_HEAD_COMPANY_ID_BRAND_ID,
                (row, index) -> new HeadCompanyBrandAuthorizationFact(row.getObject(1, UUID.class), row.getLong(2)),
                headCompanyId);
    }

    public boolean isEnterableStore(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return jdbc.query(
                BusinessEntityTaskReadServiceSql
                        .BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_STORE_STATUS_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setObject(1, storeId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> result.next() && "ENABLED".equals(result.getString(1)));
    }

    public Optional<OrganizationOwnerApi.SalesMenuStoreJudgment> salesMenuStore(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef) {
        OrganizationOwnerApi.SalesMenuStoreJudgment value = jdbc.query(
                BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_STORE_STORE_REF_STATUS_BRAND_ID
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_FROM_CLAUSE_STORE_FROM_ORGANIZATION_STORE_STOR
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_WHERE_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setObject(1, storeRef);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> {
                    if (!result.next()) return null;
                    UUID actualStoreRef = result.getObject("store_ref", UUID.class);
                    UUID actualBrandRef = result.getObject("brand_id", UUID.class);
                    return new OrganizationOwnerApi.SalesMenuStoreJudgment(
                            actualStoreRef,
                            result.getString("status"),
                            null,
                            actualStoreRef.toString(),
                            actualBrandRef.toString());
                });
        return Optional.ofNullable(value);
    }

    public Optional<CatalogScopeLookup.CatalogBrandJudgment> storeCatalogBrand(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        List<CatalogScopeLookup.CatalogBrandJudgment> values = jdbc.query(
                BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_STORE_BRAND_ID_VERSION_WORKSPACE_UUID
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_STATUS_ENABLED,
                statement -> {
                    statement.setObject(1, storeId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                (result, index) -> new CatalogScopeLookup.CatalogBrandJudgment(
                        result.getObject(1, UUID.class).toString(),
                        "STORE_PERSISTED_BRAND",
                        "STORE_VERSION:" + result.getLong(2)));
        return values.stream().findFirst();
    }

    public Optional<CatalogScopeLookup.CatalogBrandJudgment> headCompanyCatalogBrand(
            UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId, UUID brandId) {
        List<CatalogScopeLookup.CatalogBrandJudgment> values = jdbc.query(
                BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_VERSION_AUTHORIZED_AT_EPOCH_MILLIS
                        + BusinessEntityTaskReadServiceSql.ALT_HEAD_COMPANY_HEAD_COMPANY_004
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_BRAND_HEAD_COMPANY_ID_BRAND_ID
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_ENABLED
                        + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_CONDITION_ALTERNATE_A
                        + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_STATUS_ENABLED,
                statement -> {
                    statement.setObject(1, headCompanyId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                    statement.setObject(4, brandId);
                },
                (result, index) -> new CatalogScopeLookup.CatalogBrandJudgment(
                        brandId.toString(),
                        "HEAD_COMPANY_BRAND_AUTHORIZATION",
                        "HEAD_COMPANY_VERSION:" + result.getLong(1)
                                + ":BRAND_VERSION:" + result.getLong(2)
                                + ":AUTHORIZED_AT:" + result.getLong(3)));
        return values.stream().findFirst();
    }

    public Optional<UUID> storeBrand(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return jdbc
                .query(
                        BusinessEntityTaskReadServiceSql.SELECT_STORE_BRAND_ID_HEAD_005
                                + BusinessEntityTaskReadServiceSql.GRP_WS_KEY_STATUS_ENABLED_ALT_A_006,
                        statement -> {
                            statement.setObject(1, storeId);
                            statement.setObject(2, workspaceUuid);
                            statement.setString(3, groupWorkspaceKey);
                        },
                        (row, index) -> row.getObject(1, UUID.class))
                .stream()
                .findFirst();
    }

    public Optional<UUID> storeSource(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return jdbc
                .query(
                        BusinessEntityTaskReadServiceSql
                                        .BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_STORE_HEAD_COMPANY_ID_WORKSPACE_UUID
                                + BusinessEntityTaskReadServiceSql.GRP_WS_KEY_STATUS_ENABLED_ALT_B_007,
                        statement -> {
                            statement.setObject(1, storeId);
                            statement.setObject(2, workspaceUuid);
                            statement.setString(3, groupWorkspaceKey);
                        },
                        (row, index) -> row.getObject(1, UUID.class))
                .stream()
                .filter(Objects::nonNull)
                .findFirst();
    }

    public boolean sourceBrandAllowed(UUID workspaceUuid, String groupWorkspaceKey, UUID sourceStoreId, UUID brandId) {
        return jdbc.query(
                BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_HEAD_COMPANY_SELECT_EXISTS_SELECT_1_FROM_
                        + BusinessEntityTaskReadServiceSql.ALT_HEAD_COMPANY_BRAND_AUTH_ALT_A_008
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_ALTERNATIVE_BRAND_BRAND_ID_WORKSPACE_UUID_ALTERNATE_A
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_STATUS_ENABLED_ALTERNATE_C,
                statement -> {
                    statement.setObject(1, sourceStoreId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                    statement.setObject(4, brandId);
                },
                result -> result.next() && result.getBoolean(1));
    }

    public Optional<StorePathFact> storePath(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        List<StorePathFact> values = jdbc.query(
                BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_STORE_PROJECT_ID_CODE_NAME_WORKSPACE_UUID
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_ALTERNATE_B,
                statement -> {
                    statement.setObject(1, storeId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                (result, index) ->
                        new StorePathFact(result.getObject(1, UUID.class), result.getString(2), result.getString(3)));
        return values.stream().findFirst();
    }

    public Optional<StoreContractContext> storeContractContext(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeId, boolean lockStoreAndTenant) {
        String lockSuffix = lockStoreAndTenant ? BusinessEntityTaskReadServiceSql.STORE_TENANT_LOCK_SUFFIX : "";
        StoreContractContext value = jdbc.query(
                BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_TENANT_ID_PROJECT_ID_STATUS_TENANT_STATUS
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_FROM_CLAUSE_TENANT_TENANT_ID
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_ALTERNATIVE_PROJECT_PHASE_NAME_PHASE_PROJECT_ID
                        + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_WORKSPACE_UUID
                        + lockSuffix,
                statement -> {
                    statement.setObject(1, storeId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> {
                    if (!result.next()) return null;
                    UUID tenantId = result.getObject("tenant_id", UUID.class);
                    UUID projectId = result.getObject("project_id", UUID.class);
                    String status = result.getString("status");
                    String tenantStatus = result.getString("tenant_status");
                    List<String> phases = new ArrayList<>();
                    do {
                        String phase = result.getString("phase_name");
                        if (phase != null) phases.add(phase);
                    } while (result.next());
                    return new StoreContractContext(storeId, tenantId, projectId, status, tenantStatus, phases);
                });
        return Optional.ofNullable(value);
    }

    public Optional<OrganizationEntityReadback> findEntity(
            String entityType, UUID workspaceUuid, String groupWorkspaceKey, UUID id) {
        String type = normalizeEntityType(entityType);
        String table = table(type);
        String fields = fields(type);
        List<OrganizationEntityReadback> values = jdbc.query(
                BusinessEntityTaskReadServiceSql.SELECT_WS_UUID_GRP_WS_ALT_B_009
                        + fields
                        + ", status, version, extension_rule_revision, created_at_epoch_millis, "
                        + BusinessEntityTaskReadServiceSql.ENTITY_TABLE_COMMON_SUFFIX
                        + table
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
                (row, index) -> OrganizationEntityReadbackMapper.read(type, row),
                id,
                workspaceUuid,
                groupWorkspaceKey);
        return values.stream().findFirst();
    }

    public Optional<UUID> commercialGroupId(String groupWorkspaceKey) {
        return jdbc
                .query(
                        BusinessEntityTaskReadServiceSql.SELECT_COMMERCIAL_GRP_COMMERCIAL_GRP_010,
                        (row, index) -> row.getObject(1, UUID.class),
                        groupWorkspaceKey)
                .stream()
                .findFirst();
    }

    public Optional<UUID> storeProjectId(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return jdbc
                .query(
                        BusinessEntityTaskReadServiceSql.SELECT_STORE_PROJECT_ID_WS_011,
                        statement -> {
                            statement.setObject(1, storeId);
                            statement.setObject(2, workspaceUuid);
                            statement.setString(3, groupWorkspaceKey);
                        },
                        (row, index) -> row.getObject(1, UUID.class))
                .stream()
                .findFirst();
    }

    public Optional<StoreUpdateFacts> storeUpdateFacts(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return jdbc
                .query(
                        BusinessEntityTaskReadServiceSql.SELECT_STORE_PROJECT_ID_TENANT_012
                                + BusinessEntityTaskReadServiceSql.WHERE_WS_UUID_GRP_WS_ALT_A_013,
                        statement -> {
                            statement.setObject(1, storeId);
                            statement.setObject(2, workspaceUuid);
                            statement.setString(3, groupWorkspaceKey);
                        },
                        (row, index) -> new StoreUpdateFacts(
                                row.getObject(1, UUID.class),
                                row.getObject(2, UUID.class),
                                row.getObject(3, UUID.class),
                                row.getString(4)))
                .stream()
                .findFirst();
    }

    public List<OrganizationEntityReadback> listEntities(
            String entityType, UUID workspaceUuid, String groupWorkspaceKey) {
        String type = normalizeEntityType(entityType);
        String table = table(type);
        return jdbc.query(
                BusinessEntityTaskReadServiceSql.SELECT_WS_UUID_GRP_WS_ALT_C_014
                        + fields(type)
                        + ", status, version, extension_rule_revision, created_at_epoch_millis, "
                        + BusinessEntityTaskReadServiceSql.ENTITY_TABLE_COMMON_SUFFIX
                        + table
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE,
                (row, index) -> OrganizationEntityReadbackMapper.read(type, row),
                workspaceUuid,
                groupWorkspaceKey);
    }

    public PageData pageBusinessEntities(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String entityType,
            String name,
            String code,
            String legalName,
            String unifiedSocialCreditCode,
            String status,
            String sort,
            String direction,
            int page,
            int pageSize,
            boolean brandQueryText) {
        return pageBusinessEntities(
                workspaceUuid,
                groupWorkspaceKey,
                entityType,
                name,
                code,
                legalName,
                unifiedSocialCreditCode,
                status,
                sort,
                direction,
                page,
                pageSize,
                brandQueryText,
                ExtensionFilterQuery.Prepared.empty());
    }

    public PageData pageBusinessEntities(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String entityType,
            String name,
            String code,
            String legalName,
            String unifiedSocialCreditCode,
            String status,
            String sort,
            String direction,
            int page,
            int pageSize,
            boolean brandQueryText,
            ExtensionFilterQuery.Prepared extensionFilter) {
        String type = entityType == null ? null : normalizeEntityType(entityType);
        if (page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("invalid page");
        String order =
                switch (Objects.requireNonNullElse(sort, "NAME")) {
                    case "NAME" -> BusinessEntityTaskReadServiceSql.ENTITY_ORDER_NAME;
                    case "CODE" -> BusinessEntityTaskReadServiceSql.ENTITY_ORDER_CODE;
                    case "UPDATED_AT" -> BusinessEntityTaskReadServiceSql.ENTITY_ORDER_UPDATED_AT;
                    default -> throw new IllegalArgumentException("invalid sort");
                };
        String safeDirection =
                switch (Objects.requireNonNullElse(direction, BusinessEntityTaskReadServiceSql.SORT_DIRECTION_ASC)) {
                    case "ASC", "DESC" -> Objects.requireNonNullElse(
                            direction, BusinessEntityTaskReadServiceSql.SORT_DIRECTION_ASC);
                    default -> throw new IllegalArgumentException("invalid direction");
                };
        String safeStatus = status == null
                ? null
                : switch (status) {
                    case "ENABLED", "DISABLED", "VOIDED" -> status;
                    default -> throw new IllegalArgumentException("invalid status");
                };
        String nameFilter = filter(name);
        String codeFilter = filter(code);
        String legalNameFilter = filter(legalName);
        String unifiedSocialCreditCodeFilter = filter(unifiedSocialCreditCode);
        List<Object> parameters = new ArrayList<>();
        for (int index = 0; index < 3; index++) {
            parameters.add(workspaceUuid);
            parameters.add(groupWorkspaceKey);
        }
        String predicate;
        if (brandQueryText) {
            parameters.add(nameFilter);
            parameters.add(nameFilter);
            parameters.add(nameFilter);
            parameters.add(safeStatus);
            parameters.add(safeStatus);
            parameters.add(type);
            parameters.add(type);
            predicate = BusinessEntityTaskReadServiceSql.BRAND_PAGE_PREDICATE;
        } else {
            parameters.add(nameFilter);
            parameters.add(nameFilter);
            parameters.add(codeFilter);
            parameters.add(codeFilter);
            parameters.add(legalNameFilter);
            parameters.add(legalNameFilter);
            parameters.add(unifiedSocialCreditCodeFilter);
            parameters.add(unifiedSocialCreditCodeFilter);
            parameters.add(safeStatus);
            parameters.add(safeStatus);
            parameters.add(type);
            parameters.add(type);
            predicate =
                    BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_OPEN_PAREN_TEXT_LOWER_NAME_LIKE
                            + BusinessEntityTaskReadServiceSql
                                    .BUSINESS_ENTITY_TASK_READ_SERVICE_PARAMETER_PLACEHOLDER_TEXT_LOWER_LEGAL_NAME_LIKE
                            + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_NULL_VALUE_PREFIX
                            + BusinessEntityTaskReadServiceSql
                                    .BUSINESS_ENTITY_TASK_READ_SERVICE_ALTERNATIVE_LOWER_CREDIT_CODE_LIKE_TEXT
                            + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_TEXT_ENTITY_TYPE;
        }
        ExtensionFilterQuery.Prepared filters =
                extensionFilter == null ? ExtensionFilterQuery.Prepared.empty() : extensionFilter;
        String extensionPredicate = filters.isEmpty() ? "" : " AND " + filters.predicate("entities.extension_values");
        parameters.addAll(filters.parameters());
        String rows = businessEntityRowsSql();
        Long total = jdbc.queryForObject(
                BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_SELECT_COUNT_FROM
                        + rows
                        + BusinessEntityTaskReadServiceSql.ENTITY_WHERE_SUFFIX
                        + predicate
                        + extensionPredicate,
                Long.class,
                parameters.toArray());
        List<Object> pageParameters = new ArrayList<>(parameters);
        pageParameters.add(pageSize);
        pageParameters.add((page - 1) * pageSize);
        List<PageItem> items = jdbc.query(
                BusinessEntityTaskReadServiceSql.SELECT_PREFIX
                        + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_PROJECTION
                        + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_FROM_CLAUSE
                        + rows
                        + BusinessEntityTaskReadServiceSql.ENTITY_WHERE_SUFFIX
                        + predicate
                        + extensionPredicate
                        + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_ORDER_BY
                        + order
                        + BusinessEntityTaskReadServiceSql.SQL_SPACE
                        + safeDirection
                        + BusinessEntityTaskReadServiceSql.ENTITY_PAGE_ORDER_SUFFIX,
                (row, index) ->
                        new PageItem(row.getString(17), OrganizationEntityReadbackMapper.read(row.getString(17), row)),
                pageParameters.toArray());
        return new PageData(items, total == null ? 0L : total, page, pageSize);
    }

    public List<PageItem> findBusinessEntity(UUID workspaceUuid, String groupWorkspaceKey, UUID entityId) {
        return jdbc.query(
                BusinessEntityTaskReadServiceSql.SELECT_PREFIX
                        + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_PROJECTION
                        + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_FROM_CLAUSE_ALTERNATE_A
                        + businessEntityRowsSql()
                        + BusinessEntityTaskReadServiceSql.ENTITY_ID_WHERE_SUFFIX,
                (row, index) ->
                        new PageItem(row.getString(17), OrganizationEntityReadbackMapper.read(row.getString(17), row)),
                workspaceUuid,
                groupWorkspaceKey,
                workspaceUuid,
                groupWorkspaceKey,
                workspaceUuid,
                groupWorkspaceKey,
                entityId);
    }

    public Map<UUID, OrganizationEntityReadback> findEntities(
            String entityType, UUID workspaceUuid, String groupWorkspaceKey, List<UUID> ids) {
        String type = normalizeEntityType(entityType);
        String table = table(type);
        Object[] parameters = new Object[ids.size() + 2];
        parameters[0] = workspaceUuid;
        parameters[1] = groupWorkspaceKey;
        for (int index = 0; index < ids.size(); index++) parameters[index + 2] = ids.get(index);
        Map<UUID, OrganizationEntityReadback> values = new LinkedHashMap<>();
        jdbc.query(
                BusinessEntityTaskReadServiceSql.SELECT_WS_UUID_GRP_WS_ALT_E_016
                        + fields(type)
                        + BusinessEntityTaskReadServiceSql.ENTITY_PAGE_PROJECTION_SUFFIX
                        + BusinessEntityTaskReadServiceSql.ENTITY_TABLE_COMMON_SUFFIX
                        + table
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_B
                        + String.join(
                                BusinessEntityTaskReadServiceSql.PLACEHOLDER_SEPARATOR,
                                Collections.nCopies(ids.size(), BusinessEntityTaskReadServiceSql.PARAMETER_PLACEHOLDER))
                        + BusinessEntityTaskReadServiceSql.ENTITY_MULTI_ID_CLOSE_SUFFIX,
                (row, index) -> {
                    OrganizationEntityReadback value = OrganizationEntityReadbackMapper.read(type, row);
                    values.put(value.id(), value);
                    return value;
                },
                parameters);
        return Map.copyOf(values);
    }

    public boolean isEnabled(String entityType, UUID workspaceUuid, String groupWorkspaceKey, UUID id) {
        String table = table(normalizeEntityType(entityType));
        return jdbc.query(
                BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_ORGANIZATION_STATUS_ENABLED
                        + table
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_C,
                statement -> {
                    statement.setObject(1, id);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> result.next() && result.getBoolean(1));
    }

    private static String filter(String value) {
        return value == null || value.isBlank() ? null : "%" + value.trim().toLowerCase(Locale.ROOT) + "%";
    }

    private static String businessEntityRowsSql() {
        return BusinessEntityTaskReadServiceSql.SELECT_WS_UUID_GRP_WS_ALT_D_015
                + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_CREDIT_CODE_ALIAS_REMARK_VARCHAR
                + BusinessEntityTaskReadServiceSql
                        .BUSINESS_ENTITY_TASK_READ_SERVICE_CREATED_AT_EPOCH_MILLIS_EXTENSION_VALUES
                + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_FROM_CLAUSE_ALTERNATE_B
                + BusinessEntityTaskReadServiceSql
                        .BUSINESS_ENTITY_TASK_READ_SERVICE_ALTERNATIVE_BRAND_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                + BusinessEntityTaskReadServiceSql
                        .BUSINESS_ENTITY_TASK_READ_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE_NAME
                + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_REMARK_VARCHAR_NOTES_STATUS
                + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_UPDATE_TENANT_EXTENSION_VALUES
                + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_WHERE
                + BusinessEntityTaskReadServiceSql
                        .BUSINESS_ENTITY_TASK_READ_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_A
                + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_ALTERNATE_C
                + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_CODE_NAME_LEGAL_NAME_CREDIT_CODE
                + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_STATUS
                + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_VERSION_ALTERNATE_B
                + BusinessEntityTaskReadServiceSql
                        .BUSINESS_ENTITY_TASK_READ_SERVICE_HEAD_COMPANY_EXTENSION_VALUES_ENTITY_TYPE
                + BusinessEntityTaskReadServiceSql
                        .BUSINESS_ENTITY_TASK_READ_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_B;
    }

    private static String normalizeEntityType(String value) {
        String type = Objects.requireNonNullElse(value, "").toUpperCase(Locale.ROOT);
        if (!ENTITY_TYPES.contains(type) && !ServiceNodeTypes.STORE.equals(type))
            throw new IllegalArgumentException("unsupported organization entity type");
        return type;
    }

    private static String table(String type) {
        return switch (type) {
            case "BRAND" -> "brand";
            case "TENANT" -> "tenant";
            case BusinessEntityTypes.HEAD_COMPANY -> "head_company";
            case ServiceNodeTypes.STORE -> "store";
            default -> throw new IllegalArgumentException("unsupported organization entity table");
        };
    }

    private static String fields(String type) {
        return switch (type) {
            case "BRAND" -> BusinessEntityTaskReadServiceSql.ENTITY_FIELDS_BRAND;
            case ServiceNodeTypes.STORE -> BusinessEntityTaskReadServiceSql.ENTITY_FIELDS_STORE;
            default -> BusinessEntityTaskReadServiceSql.ENTITY_FIELDS_DEFAULT;
        };
    }

    public record BrandByHeadCompany(UUID headCompanyId, OrganizationEntityReadback brand) {}

    public record HeadCompanyBrandAuthorizationFact(UUID brandId, long authorizedAtEpochMillis) {}

    public record StorePathFact(UUID projectId, String code, String name) {}

    public record StoreUpdateFacts(UUID projectId, UUID tenantId, UUID brandId, String code) {}

    public record PageItem(String entityType, OrganizationEntityReadback entity) {}

    public record PageData(List<PageItem> items, long total, int page, int pageSize) {}
}
