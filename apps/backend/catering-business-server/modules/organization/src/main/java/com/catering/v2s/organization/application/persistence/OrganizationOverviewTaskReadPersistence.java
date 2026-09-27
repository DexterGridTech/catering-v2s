package com.catering.v2s.organization.application.persistence;

import com.catering.v2s.extension.api.ExtensionDefinitionLookup;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.api.ExtensionFilterQuery;
import com.catering.v2s.extension.api.ExtensionHostTypes;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.organization.api.OperationsStoreCommandApi;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.OrganizationNodeTypes;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OrganizationCommandService;
import com.catering.v2s.organization.application.OrganizationHierarchyService;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService.ExtensionDisplayField;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService.FilterOption;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService.HierarchyTree;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService.Item;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService.Metadata;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService.Page;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService.PlatformManagementBaseDetail;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService.Query;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService.Reference;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService.TreeNode;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Platform organization overview read model. Cross-owner reads are absent: every fact is organization-owned. */
@Repository
public class OrganizationOverviewTaskReadPersistence {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final JdbcTemplate jdbc;
    private final ExtensionDefinitionLookup definitions;
    private final BusinessEntityService businessEntities;
    private final OrganizationHierarchyService hierarchy;
    private final OrganizationCommandService commercialGroups;

    public OrganizationOverviewTaskReadPersistence(JdbcTemplate jdbc) {
        this(jdbc, null, null, null, null);
    }

    public OrganizationOverviewTaskReadPersistence(
            JdbcTemplate jdbc, ExtensionDefinitionLookup definitions, BusinessEntityService businessEntities) {
        this(jdbc, definitions, businessEntities, null, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public OrganizationOverviewTaskReadPersistence(
            JdbcTemplate jdbc,
            ExtensionDefinitionLookup definitions,
            BusinessEntityService businessEntities,
            OrganizationHierarchyService hierarchy,
            OrganizationCommandService commercialGroups) {
        this.jdbc = jdbc;
        this.definitions = definitions;
        this.businessEntities = businessEntities;
        this.hierarchy = hierarchy;
        this.commercialGroups = commercialGroups;
    }

    public Page page(UUID workspaceUuid, String key, String category, int page, int pageSize) {
        return page(workspaceUuid, key, category, Query.empty(), page, pageSize);
    }

    /** The platform overview owns filtering, sort and count; edges only pass the closed query. */
    public Page page(UUID workspaceUuid, String key, String category, Query query, int page, int pageSize) {
        Query safeQuery = query == null ? Query.empty() : query.validated(category);
        int safePage = Math.max(1, page);
        int safeSize = Math.min(100, Math.max(1, pageSize));
        long offset = (long) (safePage - 1) * safeSize;
        BusinessEntityService.BusinessEntityPage businessEntityPage = "BUSINESS_ENTITY".equals(category)
                ? requiredBusinessEntities()
                        .pageBusinessEntities(
                                workspaceUuid,
                                key,
                                safeQuery.type(),
                                safeQuery.name(),
                                safeQuery.code(),
                                safeQuery.legalName(),
                                safeQuery.unifiedSocialCreditCode(),
                                safeQuery.status(),
                                safeQuery.sort(),
                                safeQuery.direction(),
                                safePage,
                                safeSize,
                                safeQuery.extensionFilters(),
                                safeQuery.definitionRevision())
                : null;
        OrganizationHierarchyService.HierarchyPage hierarchyPage = "HIERARCHY".equals(category)
                ? requiredHierarchy()
                        .page(
                                workspaceUuid,
                                key,
                                new OrganizationHierarchyService.HierarchyQuery(
                                        safeQuery.type(),
                                        safeQuery.name(),
                                        safeQuery.code(),
                                        safeQuery.status(),
                                        safeQuery.projectId(),
                                        safeQuery.sort(),
                                        safeQuery.direction(),
                                        safePage,
                                        safeSize))
                : null;
        // Current business-entity and hierarchy owner projections are MANUAL facts. Keep the platform
        // source filter truthful at this composition boundary until those owner APIs expose source-aware reads.
        if ("SYSTEM".equals(safeQuery.source())) {
            if (businessEntityPage != null) {
                businessEntityPage = new BusinessEntityService.BusinessEntityPage(
                        List.of(),
                        0L,
                        businessEntityPage.page(),
                        businessEntityPage.pageSize(),
                        businessEntityPage.definitionRevision());
            }
            if (hierarchyPage != null) {
                hierarchyPage = new OrganizationHierarchyService.HierarchyPage(
                        hierarchyPage.page(),
                        hierarchyPage.pageSize(),
                        0L,
                        hierarchyPage.sort(),
                        hierarchyPage.direction(),
                        List.of());
            }
        }
        ExtensionFilterQuery.Prepared storeFilters = ServiceNodeTypes.STORE.equals(category)
                ? prepareStoreFilters(workspaceUuid, key, safeQuery)
                : ExtensionFilterQuery.Prepared.empty();
        List<Item> items =
                switch (category) {
                    case "HIERARCHY" -> hierarchyPage.items().stream()
                            .map(value -> hierarchyItem(key, value))
                            .toList();
                    case "BUSINESS_ENTITY" -> businessEntityPage.items().stream()
                            .map(item -> entityItem(key, item.entityType(), item.entity()))
                            .toList();
                    case ServiceNodeTypes.STORE -> storePage(
                            workspaceUuid, key, safeQuery, safeSize, offset, storeFilters);
                    default -> throw new IllegalArgumentException("unsupported overview category");
                };
        long total = businessEntityPage != null
                ? businessEntityPage.total()
                : hierarchyPage != null
                        ? hierarchyPage.total()
                        : count(workspaceUuid, key, category, safeQuery, storeFilters);
        long asOf = items.stream().mapToLong(Item::updatedAt).max().orElse(0L);
        Long definitionRevision = businessEntityPage != null
                ? businessEntityPage.definitionRevision()
                : storeFilters.definitionRevision();
        return new Page(
                new Metadata(
                        key,
                        category,
                        safePage,
                        safeSize,
                        total,
                        safeQuery.sort(),
                        safeQuery.direction(),
                        definitionRevision),
                items,
                "AVAILABLE",
                asOf,
                List.of(),
                filterOptions(workspaceUuid, key),
                "AVAILABLE",
                asOf,
                List.of());
    }

    /** Platform edge adapter entry point; the organization owner remains the single page/query implementation. */
    public Page platformOverviewTaskPage(
            UUID workspaceUuid, String key, String category, Query query, int page, int pageSize) {
        return page(workspaceUuid, key, category, query, page, pageSize);
    }

    public Item detail(UUID workspaceUuid, String key, String category, UUID itemId) {
        return switch (category) {
            case "HIERARCHY" -> hierarchyDetail(workspaceUuid, key, itemId);
            case "BUSINESS_ENTITY" -> entityDetail(workspaceUuid, key, itemId);
            case ServiceNodeTypes.STORE -> storeDetail(workspaceUuid, key, itemId);
            default -> throw new IllegalArgumentException("unsupported overview category");
        };
    }

    /** Organization-owned typed command readback; it does not expose an application task-view type. */
    public OperationsStoreCommandApi.StoreOrganizationDetailReadback readStoreDetail(
            OperationsStoreCommandApi.StoreDetailQuery query) {
        return jdbc.query(
                OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_PROJECT_CODE_NAME_BRAND
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TENANT_CODE_NAME_HEAD
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_FROM_CLAUSE_STORE_FROM_ORGANIZATION_STORE_STOR
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_JOIN_ORGANIZATION_NODE_PROJECT_STORE_PROJECT_ID
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_PROJECT_WORKSPACE_UUID_STORE
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_PROJECT_GROUP_WORKSPACE_KEY_STORE
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_JOIN_BRAND_STORE_BRAND_ID
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_BRAND_WORKSPACE_UUID_STORE
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_BRAND_GROUP_WORKSPACE_KEY_STORE
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_JOIN_TENANT_STORE_TENANT_ID
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_TENANT_WORKSPACE_UUID_STORE
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_TENANT_GROUP_WORKSPACE_KEY_STORE
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_HEAD_COMPANY_HEAD_STORE_HEAD_COMPANY_ID
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_HEAD_WORKSPACE_UUID_STORE
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_HEAD_GROUP_WORKSPACE_KEY_STORE
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_WHERE_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
                result -> {
                    if (!result.next()) throw new BusinessEntityService.OrganizationNotFoundException();
                    return new OperationsStoreCommandApi.StoreOrganizationDetailReadback(
                            new OperationsStoreCommandApi.Reference(
                                    result.getObject(1, UUID.class), result.getString(2), result.getString(3)),
                            new OperationsStoreCommandApi.Reference(
                                    result.getObject(4, UUID.class), result.getString(5), result.getString(6)),
                            new OperationsStoreCommandApi.Reference(
                                    result.getObject(7, UUID.class), result.getString(8), result.getString(9)),
                            result.getObject(10, UUID.class) == null
                                    ? null
                                    : new OperationsStoreCommandApi.Reference(
                                            result.getObject(10, UUID.class),
                                            result.getString(11),
                                            result.getString(12)));
                },
                query.workspaceUuid(),
                query.groupWorkspaceKey(),
                query.storeId());
    }

    /**
     * Platform detail's organization-owner half. It intentionally does not load the extension definition: that fact
     * belongs to extension and is composed by the caller as the second, explicitly bounded owner projection.
     */
    public PlatformManagementBaseDetail platformManagementBaseDetail(
            UUID workspaceUuid, String key, String category, UUID itemId) {
        return ReadBudgetComponent.measure(ReadBudgetComponent.Component.PRIMARY_QUERY, () -> switch (category) {
            case "HIERARCHY" -> platformHierarchyBaseDetail(workspaceUuid, key, itemId);
            case "BUSINESS_ENTITY" -> platformBusinessEntityBaseDetail(workspaceUuid, key, itemId);
            case ServiceNodeTypes.STORE -> platformStoreBaseDetail(workspaceUuid, key, itemId);
            default -> throw new IllegalArgumentException("unsupported overview category");
        });
    }

    /** Pure in-memory composition; an unconfigured definition deliberately produces no fields. */
    public Item withPlatformManagementDefinition(
            PlatformManagementBaseDetail base, ExtensionDefinitionReadback definition) {
        List<ExtensionDisplayField> fields = definition.fields().stream()
                .filter(field -> "ENABLED".equals(field.status()))
                .sorted(java.util.Comparator.comparingInt(ExtensionDefinitionReadback.Field::displayOrder))
                .map(field -> new ExtensionDisplayField(
                        field.label(), displayValue(base.extensionValues().get(field.fieldKey()))))
                .toList();
        return withExtensionFields(base.item(), fields);
    }

    private PlatformManagementBaseDetail platformHierarchyBaseDetail(UUID workspaceUuid, String key, UUID itemId) {
        String sql =
                OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CTE_TARGET_PARENT_ID_NODE_TYPE_CODE
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CREATED_AT_EPOCH_MILLIS
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ORGANIZATION_NODE
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_NODE_TYPE_REGION_PROJECT
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_PARENT_ID_CODE_NAME_DEPTH
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ORGANIZATION_NODE_PARENT_CODE_NAME_ANCESTRY
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ANCESTRY_PARENT_ID_PARENT_WORKSPACE_UUID
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_PARENT_GROUP_WORKSPACE_KEY_TARGET_PARENT_ID
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_NAME_STATUS_VERSION
                        + OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ARRAY_AGG_ANCESTRY_DEPTH
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_DESC_DIRECTION_PATH_IDS_ARRAY_AGG_ANCESTRY_CODE
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ANCESTRY_ARRAY_AGG_NAME_DEPTH_PATH_NAMES
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_JOIN_CONDITION_TARGET_PARENT_ID_NODE_TYPE_CODE
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_STATUS_VERSION_CREATED_AT_EPOCH_MILLIS
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_NOTES_EXTENSION_VALUES;
        return jdbc.query(
                sql,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, key);
                    statement.setObject(3, itemId);
                    statement.setObject(4, workspaceUuid);
                    statement.setString(5, key);
                },
                result -> {
                    if (!result.next()) throw new BusinessEntityService.OrganizationNotFoundException();
                    Item item = new Item(
                            result.getObject("id", UUID.class),
                            key,
                            "HIERARCHY",
                            result.getString("node_type"),
                            result.getString("code"),
                            result.getString("name"),
                            references(
                                    result.getArray("path_ids"),
                                    result.getArray("path_codes"),
                                    result.getArray("path_names")),
                            result.getString("status"),
                            "MANUAL",
                            result.getLong("version"),
                            result.getLong("created_at_epoch_millis"),
                            result.getLong("updated_at_epoch_millis"),
                            result.getString("notes"),
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            List.of(),
                            List.of(),
                            null);
                    return new PlatformManagementBaseDetail(item, jsonObject(result.getString("extension_values")));
                });
    }

    private PlatformManagementBaseDetail platformBusinessEntityBaseDetail(UUID workspaceUuid, String key, UUID itemId) {
        String sql =
                OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CTE_TARGET_BRAND_TEXT_ENTITY_TYPE
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TEXT_CREDIT_CODE_ALIAS_REMARK
                        + OrganizationOverviewTaskReadServiceSql.UPDATE_BRAND_UPDATED_AT_EPOCH_001
                        + OrganizationOverviewTaskReadServiceSql.WHERE_WS_UUID_GRP_WS_002
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_NAME_LEGAL_NAME_CREDIT_CODE_REMARK
                        + OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_UPDATE_TENANT
                        + OrganizationOverviewTaskReadServiceSql.CONDITION_GRP_WS_KEY_HEAD_003
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CREDIT_CODE_REMARK_STATUS_VERSION
                        + OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_HEAD_COMPANY
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_TARGET_ENTITY_TYPE_CODE
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_LEGAL_NAME_CREDIT_CODE_ALIAS
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_ALTERNATE_A;
        return jdbc.query(
                sql,
                statement -> {
                    int index = 1;
                    for (int i = 0; i < 3; i++) {
                        statement.setObject(index++, workspaceUuid);
                        statement.setString(index++, key);
                        statement.setObject(index++, itemId);
                    }
                },
                result -> {
                    if (!result.next()) throw new BusinessEntityService.OrganizationNotFoundException();
                    UUID id = result.getObject("id", UUID.class);
                    Item item = new Item(
                            id,
                            key,
                            "BUSINESS_ENTITY",
                            result.getString("entity_type"),
                            result.getString("code"),
                            result.getString("name"),
                            List.of(new Reference(id, result.getString("code"), result.getString("name"), true)),
                            result.getString("status"),
                            "MANUAL",
                            result.getLong("version"),
                            result.getLong("created_at_epoch_millis"),
                            result.getLong("updated_at_epoch_millis"),
                            result.getString("notes"),
                            result.getString("legal_name"),
                            result.getString("credit_code"),
                            null,
                            null,
                            null,
                            null,
                            List.of(),
                            List.of(),
                            result.getString("alias"));
                    return new PlatformManagementBaseDetail(item, jsonObject(result.getString("extension_values")));
                });
    }

    private PlatformManagementBaseDetail platformStoreBaseDetail(UUID workspaceUuid, String key, UUID itemId) {
        String sql =
                OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CTE_TARGET_CODE_NAME_STATUS
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CREATED_AT_EPOCH_MILLIS_ALTERNATE_A
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_EXTENSION_VALUES_PROJECT_ID_CODE_PROJECT_CODE
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_BRAND_ID_CODE_BRAND_CODE_NAME
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_NAME_TENANT_NAME_HEAD_ID_CODE
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ALTERNATIVE_ORGANIZATION_NODE_STORE_PROJECT_ID
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ALTERNATIVE_TENANT_BRAND_BRAND_ID_TENANT_ID
                        + OrganizationOverviewTaskReadServiceSql.JOIN_HEAD_COMPANY_HEAD_COMPANY_004
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_ANCESTRY_TARGET_PROJECT_ID
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_NODE_PARENT_ID_CODE_NAME
                        + OrganizationOverviewTaskReadServiceSql.ALT_ORG_NODE_TARGET_PROJECT_005
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ANCESTRY_TARGET_ID_PARENT_PARENT_ID
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_FROM_CLAUSE_ANCESTRY_PARENT_PARENT_ID
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_PARENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_TARGET_CODE_NAME
                        + OrganizationOverviewTaskReadServiceSql.TARGET_STATUS_VER_CREATED_AT_ALT_A_006
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_NOTES_EXTENSION_VALUES_PROJECT_ID
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_BRAND_ID_BRAND_CODE_BRAND_NAME
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_TENANT_NAME_HEAD_ID_HEAD_CODE
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ARRAY_AGG_ANCESTRY_DEPTH_PATH_IDS
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ANCESTRY_DEPTH_PATH_CODES_ARRAY_AGG
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ANCESTRY_PATH_NAMES_TARGET_ID_PROJECT_ID
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_CODE_NAME_STATUS
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_ALTERNATE_B
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_EXTENSION_VALUES_PROJECT_ID_PROJECT_CODE
                        + OrganizationOverviewTaskReadServiceSql.TARGET_BRAND_ID_BRAND_CODE_ALT_A_007
                        + OrganizationOverviewTaskReadServiceSql.TARGET_TENANT_NAME_HEAD_ID_ALT_A_008;
        return jdbc.query(
                sql,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, key);
                    statement.setObject(3, itemId);
                    statement.setObject(4, workspaceUuid);
                    statement.setString(5, key);
                },
                result -> {
                    if (!result.next()) throw new BusinessEntityService.OrganizationNotFoundException();
                    UUID id = result.getObject("id", UUID.class);
                    Item item = new Item(
                            id,
                            key,
                            ServiceNodeTypes.STORE,
                            ServiceNodeTypes.STORE,
                            result.getString("code"),
                            result.getString("name"),
                            append(
                                    references(
                                            result.getArray("path_ids"),
                                            result.getArray("path_codes"),
                                            result.getArray("path_names")),
                                    new Reference(id, result.getString("code"), result.getString("name"), true)),
                            result.getString("status"),
                            "MANUAL",
                            result.getLong("version"),
                            result.getLong("created_at_epoch_millis"),
                            result.getLong("updated_at_epoch_millis"),
                            result.getString("notes"),
                            null,
                            null,
                            new Reference(
                                    result.getObject("project_id", UUID.class),
                                    result.getString("project_code"),
                                    result.getString("project_name"),
                                    true),
                            new Reference(
                                    result.getObject("brand_id", UUID.class),
                                    result.getString("brand_code"),
                                    result.getString("brand_name"),
                                    true),
                            new Reference(
                                    result.getObject("tenant_id", UUID.class),
                                    result.getString("tenant_code"),
                                    result.getString("tenant_name"),
                                    true),
                            result.getObject("head_id", UUID.class) == null
                                    ? null
                                    : new Reference(
                                            result.getObject("head_id", UUID.class),
                                            result.getString("head_code"),
                                            result.getString("head_name"),
                                            true),
                            List.of(),
                            List.of(),
                            null);
                    return new PlatformManagementBaseDetail(item, jsonObject(result.getString("extension_values")));
                });
    }

    /** A hierarchy is a complete owner read, never a page that a consumer is asked to turn into a tree. */
    public HierarchyTree hierarchyTree(UUID workspaceUuid, String key) {
        return platformHierarchyTree(workspaceUuid, key);
    }

    /** Platform hierarchy tree is one organization-owner projection, including project phases. */
    public HierarchyTree platformHierarchyTree(UUID workspaceUuid, String key) {
        List<PlatformHierarchyRow> source = jdbc.query(
                OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_COMMERCIAL_GROUP
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_NODE_PARENT_ID_NODE_TYPE_CODE
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_NODE_UPDATED_AT_EPOCH_MILLIS
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_PHASES_PHASE_NAMES_VARCHAR
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ALTERNATIVE_COMMERCIAL_GROUP
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ORGANIZATION_NODE_NODE_WORKSPACE_UUID
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_NODE_GROUP_WORKSPACE_KEY_NODE_TYPE_REGION
                        + OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_LATERAL
                        + OrganizationOverviewTaskReadServiceSql.ALT_PROJECT_PHASE_NAME_PROJECT_009
                        + OrganizationOverviewTaskReadServiceSql.WHERE_COMMERCIAL_GRP_WS_KEY_010,
                (row, index) -> new PlatformHierarchyRow(
                        row.getString(1),
                        row.getString(2),
                        row.getObject(3, UUID.class),
                        row.getObject(4, UUID.class),
                        row.getString(5),
                        row.getString(6),
                        row.getString(7),
                        row.getString(8),
                        row.getString(9),
                        row.getLong(10),
                        strings(row.getArray(11))),
                workspaceUuid,
                key,
                key);
        if (source.isEmpty()) throw new BusinessEntityService.OrganizationNotFoundException();
        PlatformHierarchyRow root = source.getFirst();
        List<TreeRow> rows = source.stream()
                .filter(row -> row.id() != null)
                .map(row -> new TreeRow(
                        row.id(),
                        row.parentId(),
                        row.type(),
                        row.code(),
                        row.name(),
                        row.status(),
                        row.notes(),
                        row.updatedAt(),
                        row.phases()))
                .toList();
        Map<UUID, List<TreeRow>> projectsByRegion = new LinkedHashMap<>();
        rows.stream()
                .filter(row -> OrganizationNodeTypes.PROJECT.equals(row.type()))
                .forEach(row -> projectsByRegion
                        .computeIfAbsent(row.parentId(), ignored -> new ArrayList<>())
                        .add(row));
        List<TreeNode> regions = rows.stream()
                .filter(row -> OrganizationNodeTypes.REGION.equals(row.type()))
                .map(row -> treeNode(row, projectsByRegion.getOrDefault(row.id(), List.of())))
                .toList();
        return new HierarchyTree(root.groupCode(), root.groupName(), regions);
    }

    private BusinessEntityService requiredBusinessEntities() {
        if (businessEntities == null) throw new IllegalStateException("business entity owner query unavailable");
        return businessEntities;
    }

    private OrganizationHierarchyService requiredHierarchy() {
        if (hierarchy == null) throw new IllegalStateException("organization hierarchy owner query unavailable");
        return hierarchy;
    }

    private OrganizationCommandService requiredCommercialGroups() {
        if (commercialGroups == null) throw new IllegalStateException("commercial group owner query unavailable");
        return commercialGroups;
    }

    private List<Item> storePage(
            UUID workspaceUuid, String key, Query query, int size, long offset, ExtensionFilterQuery.Prepared filters) {
        String scopePredicate = visibleStorePredicate(
                query.scopeNodeId(),
                OrganizationOverviewTaskReadServiceSql.STORE_ID_COLUMN,
                OrganizationOverviewTaskReadServiceSql.STORE_PROJECT_ID_COLUMN);
        String where = baseFilters(OrganizationOverviewTaskReadServiceSql.STORE_ALIAS_PREFIX, null, query)
                + scopePredicate
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_PROJECT_ID_BRAND_ID
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ALTERNATIVE_TENANT_ID_HEAD_COMPANY_ID
                + (filters.isEmpty() ? "" : " AND " + filters.predicate("s.extension_values"));
        List<Object> values = baseValues(workspaceUuid, key, query);
        addVisibleStoreValues(values, workspaceUuid, key, query.scopeNodeId());
        values.add(query.projectId());
        values.add(query.projectId());
        values.add(query.brandId());
        values.add(query.brandId());
        values.add(query.tenantId());
        values.add(query.tenantId());
        values.add(query.headCompanyId());
        values.add(query.headCompanyId());
        values.addAll(filters.parameters());
        values.add(size);
        values.add(offset);
        List<Item> rows = jdbc.query(
                storeRowsSql()
                        + where
                        + OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ORDER_BY
                        + storeOrder(query)
                        + OrganizationOverviewTaskReadServiceSql.SQL_SPACE
                        + query.direction()
                        + OrganizationOverviewTaskReadServiceSql.STORE_PAGE_ORDER_SUFFIX,
                (row, index) -> storeItem(key, row, List.of()),
                values.toArray());
        Map<UUID, List<Reference>> paths = nodePaths(
                workspaceUuid,
                key,
                rows.stream().map(item -> item.project().id()).toList());
        return rows.stream()
                .map(item -> withPath(
                        item,
                        append(
                                paths.get(item.project().id()),
                                new Reference(item.id(), item.code(), item.name(), true))))
                .toList();
    }

    private Item hierarchyDetail(UUID workspaceUuid, String key, UUID itemId) {
        Item required = hierarchyItem(key, requiredHierarchy().requireNodeWithPath(workspaceUuid, key, itemId));
        return withExtensionFields(required, extensionFields(workspaceUuid, key, required.type(), required.id()));
    }

    private Item entityDetail(UUID workspaceUuid, String key, UUID itemId) {
        BusinessEntityService.BusinessEntityPageItem readback =
                requiredBusinessEntities().requireBusinessEntity(workspaceUuid, key, itemId);
        Item item = entityItem(key, readback.entityType(), readback.entity());
        return withExtensionFields(item, extensionFields(workspaceUuid, key, item.type(), item.id()));
    }

    private static Item hierarchyItem(String key, OrganizationHierarchyService.HierarchyPageItem value) {
        var node = value.node();
        List<Reference> path = value.path().stream()
                .map(part -> new Reference(part.id(), part.code(), part.name(), true))
                .toList();
        return new Item(
                node.id(),
                key,
                "HIERARCHY",
                node.nodeType(),
                node.code(),
                node.name(),
                path,
                node.status(),
                "MANUAL",
                node.version(),
                node.createdAtEpochMillis(),
                node.updatedAtEpochMillis(),
                node.notes(),
                null,
                null,
                null,
                null,
                null,
                null,
                List.of(),
                List.of(),
                null);
    }

    private static Item entityItem(String key, String type, OrganizationEntityReadback entity) {
        Reference self = new Reference(entity.id(), entity.code(), entity.name(), true);
        return new Item(
                entity.id(),
                key,
                "BUSINESS_ENTITY",
                type,
                entity.code(),
                entity.name(),
                List.of(self),
                entity.status(),
                "MANUAL",
                entity.version(),
                entity.createdAt(),
                entity.updatedAt(),
                entity.remark(),
                entity.legalName(),
                entity.creditCode(),
                null,
                null,
                null,
                null,
                List.of(),
                List.of(),
                "BRAND".equals(type) ? entity.alias() : null,
                entity.extensionValues(),
                entity.extensionRuleRevision());
    }

    private Item storeDetail(UUID workspaceUuid, String key, UUID itemId) {
        String sql = OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CTE_TARGET
                + storeRowsSql()
                + OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_ANCESTRY
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_TARGET_PROJECT_ID_TARGET_ID_NODE
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_FROM_CLAUSE_ORGANIZATION_NODE_NODE_PROJECT_ID
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_UNION_ANCESTRY_TARGET_ID_PARENT_PARENT_ID
                + OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ANCESTRY_DEPTH_PARENT
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ANCESTRY_PARENT_ID_PARENT
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CLOSE_PAREN_PATHS_TARGET_ID_ARRAY_AGG_DEPTH
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ANCESTRY_DEPTH_PATH_CODES_ARRAY_AGG_NAME
                + OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_GROUP_BY_TARGET_ID
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_TARGET_CODE_NAME_STATUS
                + OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_ALTERNATE_C
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_PROJECT_ID_PROJECT_CODE_PROJECT_NAME
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_BRAND_CODE_BRAND_NAME_TENANT_ID
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_HEAD_ID_HEAD_CODE_HEAD_NAME
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_PATHS_PATH_NAMES_TARGET_ID_PROJECT_ID;
        Item item = jdbc.query(
                sql,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, key);
                    statement.setObject(3, itemId);
                },
                result -> {
                    if (!result.next()) return null;
                    return storeItem(
                            key,
                            result,
                            append(
                                    references(
                                            result.getArray("path_ids"),
                                            result.getArray("path_codes"),
                                            result.getArray("path_names")),
                                    new Reference(
                                            result.getObject("id", UUID.class),
                                            result.getString("code"),
                                            result.getString("name"),
                                            true)));
                });
        Item required = required(item);
        return withExtensionFields(
                required, extensionFields(workspaceUuid, key, ExtensionHostTypes.STORE, required.id()));
    }

    private static OperationsStoreCommandApi.Reference reference(Reference value) {
        return value == null ? null : new OperationsStoreCommandApi.Reference(value.id(), value.code(), value.name());
    }

    private long count(
            UUID workspaceUuid, String key, String category, Query query, ExtensionFilterQuery.Prepared filters) {
        return switch (category) {
            case "HIERARCHY" -> throw new IllegalStateException(
                    "hierarchy count is owned by OrganizationHierarchyService");
            case "BUSINESS_ENTITY" -> throw new IllegalStateException(
                    "business-entity count is owned by BusinessEntityService");
            case ServiceNodeTypes.STORE -> {
                List<Object> values = baseValues(workspaceUuid, key, query);
                addVisibleStoreValues(values, workspaceUuid, key, query.scopeNodeId());
                values.add(query.projectId());
                values.add(query.projectId());
                values.add(query.brandId());
                values.add(query.brandId());
                values.add(query.tenantId());
                values.add(query.tenantId());
                values.add(query.headCompanyId());
                values.add(query.headCompanyId());
                values.addAll(filters.parameters());
                yield jdbc.queryForObject(
                        OrganizationOverviewTaskReadServiceSql
                                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_SELECT_COUNT
                                + storeRowsSql()
                                        .substring(storeRowsSql()
                                                .indexOf(
                                                        OrganizationOverviewTaskReadServiceSql
                                                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_FROM_CLAUSE))
                                + baseFilters(OrganizationOverviewTaskReadServiceSql.STORE_ALIAS_PREFIX, null, query)
                                + visibleStorePredicate(
                                        query.scopeNodeId(),
                                        OrganizationOverviewTaskReadServiceSql.STORE_ID_COLUMN,
                                        OrganizationOverviewTaskReadServiceSql.STORE_PROJECT_ID_COLUMN)
                                + OrganizationOverviewTaskReadServiceSql.CONDITION_PROJECT_ID_BRAND_ID_ALT_A_011
                                + OrganizationOverviewTaskReadServiceSql
                                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_OPEN_PAREN_TENANT_ID_HEAD_COMPANY_ID
                                + (filters.isEmpty() ? "" : " AND " + filters.predicate("s.extension_values")),
                        Long.class,
                        values.toArray());
            }
            default -> throw new IllegalArgumentException("unsupported overview category");
        };
    }

    private ExtensionFilterQuery.Prepared prepareStoreFilters(UUID workspaceUuid, String key, Query query) {
        if (query.extensionFilters() == null) return ExtensionFilterQuery.Prepared.empty();
        if (definitions == null) {
            throw new ExtensionFilterQuery.InvalidFilterException(List.of(new ExtensionFilterQuery.InvalidReason(
                    ExtensionHostTypes.STORE, "DEFINITION_LOOKUP_UNAVAILABLE", null)));
        }
        return ExtensionFilterQuery.prepare(
                definitions,
                workspaceUuid,
                key,
                ExtensionHostTypes.STORE,
                query.extensionFilters(),
                query.definitionRevision());
    }

    private static String baseFilters(String prefix, String typeColumn, Query query) {
        return OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_TEXT
                + prefix
                + OrganizationOverviewTaskReadServiceSql.BASE_FILTER_NAME_SUFFIX
                + prefix
                + OrganizationOverviewTaskReadServiceSql.BASE_FILTER_CODE_SUFFIX
                + prefix
                + OrganizationOverviewTaskReadServiceSql.BASE_FILTER_STATUS_SUFFIX
                + (query.type() == null || typeColumn == null
                        ? ""
                        : OrganizationOverviewTaskReadServiceSql.OPTIONAL_TYPE_FILTER_PREFIX
                                + typeColumn
                                + OrganizationOverviewTaskReadServiceSql.OPTIONAL_TYPE_FILTER_SUFFIX)
                + ("SYSTEM".equals(query.source())
                        ? OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_AND_1_0
                        : "");
    }

    private static List<Object> baseValues(UUID workspaceUuid, String key, Query query) {
        List<Object> values = new ArrayList<>();
        values.add(workspaceUuid);
        values.add(key);
        values.add(like(query.name()));
        values.add(like(query.name()));
        values.add(like(query.code()));
        values.add(like(query.code()));
        values.add(query.status());
        values.add(query.status());
        if (query.type() != null && !ServiceNodeTypes.STORE.equals(query.type())) values.add(query.type());
        return values;
    }

    private static String visibleStorePredicate(UUID scopeNodeId, String storeColumn, String projectColumn) {
        return scopeNodeId == null
                ? ""
                : OrganizationOverviewTaskReadServiceSql.VISIBLE_STORE_PREDICATE_PREFIX
                        + storeColumn
                        + OrganizationOverviewTaskReadServiceSql.VISIBLE_STORE_ID_MATCH
                        + projectColumn
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_VISIBLE_SCOPE_PARENT_ID_NODE_TYPE
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ORGANIZATION_NODE_NODE_TYPE_WORKSPACE_UUID
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_CHILD_PARENT_ID
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_VISIBLE_SCOPE_CHILD_NODE_TYPE_PARENT
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CHILD_PARENT_ID_PARENT_WORKSPACE_UUID
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_VISIBLE_SCOPE_NODE_TYPE_PROJECT;
    }

    private static void addVisibleStoreValues(List<Object> values, UUID workspaceUuid, String key, UUID scopeNodeId) {
        if (scopeNodeId == null) return;
        values.add(scopeNodeId);
        values.add(workspaceUuid);
        values.add(key);
        values.add(scopeNodeId);
        values.add(workspaceUuid);
        values.add(key);
    }

    private static String storeOrder(Query query) {
        return switch (query.sort()) {
            case "NAME" -> OrganizationOverviewTaskReadServiceSql.STORE_NAME_ORDER;
            case "CODE" -> OrganizationOverviewTaskReadServiceSql.STORE_CODE_ORDER;
            default -> OrganizationOverviewTaskReadServiceSql.STORE_UPDATED_ORDER;
        };
    }

    private static String like(String value) {
        return value == null || value.isBlank()
                ? null
                : "%" + value.trim().replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
    }

    private Map<UUID, List<Reference>> nodePaths(UUID workspaceUuid, String key, List<UUID> ids) {
        if (ids.isEmpty()) return Map.of();
        String sql = OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CTE_ANCESTRY
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_NODE_TARGET_ID_PARENT_ID_CODE
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ALTERNATIVE_ORGANIZATION_NODE
                + OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_NODE
                + placeholders(ids.size())
                + OrganizationOverviewTaskReadServiceSql.NODE_PATH_CLOSE_SUFFIX
                + OrganizationOverviewTaskReadServiceSql.NODE_PATH_PARENT_SELECT
                + OrganizationOverviewTaskReadServiceSql.NODE_PATH_PARENT_FROM
                + OrganizationOverviewTaskReadServiceSql.NODE_PATH_PARENT_WHERE
                + OrganizationOverviewTaskReadServiceSql.NODE_PATH_SELECT_PROJECTION
                + OrganizationOverviewTaskReadServiceSql.NODE_PATH_SELECT_PROJECTION_SUFFIX
                + OrganizationOverviewTaskReadServiceSql.NODE_PATH_TARGET_ID_COLUMN;
        return jdbc.query(
                sql,
                statement -> {
                    int index = 1;
                    statement.setObject(index++, workspaceUuid);
                    statement.setString(index++, key);
                    for (UUID id : ids) statement.setObject(index++, id);
                    statement.setObject(index++, workspaceUuid);
                    statement.setString(index, key);
                },
                result -> {
                    Map<UUID, List<Reference>> paths = new LinkedHashMap<>();
                    while (result.next())
                        paths.put(
                                result.getObject("target_id", UUID.class),
                                references(
                                        result.getArray("path_ids"),
                                        result.getArray("path_codes"),
                                        result.getArray("path_names")));
                    return Map.copyOf(paths);
                });
    }

    private List<FilterOption> filterOptions(UUID workspaceUuid, String key) {
        return jdbc.query(
                OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_KIND_CODE_NAME_PROJECT
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ALTERNATIVE_ORGANIZATION_NODE_ALTERNATE_A
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_BRAND_NODE_TYPE_PROJECT_CODE_NAME
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_TENANT_CODE
                        + OrganizationOverviewTaskReadServiceSql.ALT_TENANT_WS_UUID_GRP_012
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_HEAD_COMPANY_CODE_NAME_WORKSPACE_UUID
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_OPTIONS_KIND_CODE,
                (row, index) -> new FilterOption(
                        row.getString(1), row.getObject(2, UUID.class), row.getString(3), row.getString(4)),
                workspaceUuid,
                key,
                workspaceUuid,
                key,
                workspaceUuid,
                key,
                workspaceUuid,
                key);
    }

    private static String storeRowsSql() {
        return OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_CODE_NAME_STATUS_VERSION
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_UPDATED_AT_EPOCH_MILLIS_NOTES_PROJECT_ID_CODE
                + OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_PROJECT_NAME
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_BRAND_ID_CODE_BRAND_CODE_NAME_ALTERNATE_A
                + OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TENANT_CODE
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_NAME_TENANT_NAME_HEAD_ID_CODE_ALTERNATE_A
                + OrganizationOverviewTaskReadServiceSql.ALT_ORG_NODE_STORE_PROJECT_ALT_A_013
                + OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ALTERNATIVE_BRAND
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TENANT_BRAND_ID_TENANT_ID
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ALTERNATIVE_HEAD_COMPANY
                + OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_HEAD_COMPANY_ID;
    }

    private static TreeNode treeNode(TreeRow row, List<TreeRow> children) {
        return new TreeNode(
                row.id(),
                row.type(),
                row.code(),
                row.name(),
                row.status(),
                row.notes(),
                row.updatedAt(),
                children.stream().map(child -> treeNode(child, List.of())).toList(),
                row.phases());
    }

    private static Item storeItem(String key, ResultSet row, List<Reference> path) throws SQLException {
        Reference project = new Reference(
                row.getObject("project_id", UUID.class),
                row.getString("project_code"),
                row.getString("project_name"),
                true);
        Reference brand = new Reference(
                row.getObject("brand_id", UUID.class), row.getString("brand_code"), row.getString("brand_name"), true);
        Reference tenant = new Reference(
                row.getObject("tenant_id", UUID.class),
                row.getString("tenant_code"),
                row.getString("tenant_name"),
                true);
        UUID headId = row.getObject("head_id", UUID.class);
        Reference head = headId == null
                ? null
                : new Reference(headId, row.getString("head_code"), row.getString("head_name"), true);
        return new Item(
                row.getObject("id", UUID.class),
                key,
                ServiceNodeTypes.STORE,
                ServiceNodeTypes.STORE,
                row.getString("code"),
                row.getString("name"),
                path,
                row.getString("status"),
                "MANUAL",
                row.getLong("version"),
                row.getLong("created_at_epoch_millis"),
                row.getLong("updated_at_epoch_millis"),
                row.getString("notes"),
                null,
                null,
                project,
                brand,
                tenant,
                head,
                List.of(),
                List.of(),
                null,
                jsonObject(row.getString("extension_values")),
                row.getLong("extension_rule_revision"));
    }

    private static Item withPath(Item item, List<Reference> path) {
        if (path == null) throw new BusinessEntityService.OrganizationNotFoundException();
        return new Item(
                item.id(),
                item.groupWorkspaceKey(),
                item.category(),
                item.type(),
                item.code(),
                item.name(),
                path,
                item.status(),
                item.source(),
                item.version(),
                item.createdAt(),
                item.updatedAt(),
                item.notes(),
                item.legalName(),
                item.unifiedSocialCreditCode(),
                item.project(),
                item.brand(),
                item.tenant(),
                item.headCompany(),
                item.unresolvedReferences(),
                item.extensionFields(),
                item.alias(),
                item.extensionValues(),
                item.extensionRuleRevision());
    }

    private Item withExtensionFields(Item item, List<ExtensionDisplayField> fields) {
        return new Item(
                item.id(),
                item.groupWorkspaceKey(),
                item.category(),
                item.type(),
                item.code(),
                item.name(),
                item.path(),
                item.status(),
                item.source(),
                item.version(),
                item.createdAt(),
                item.updatedAt(),
                item.notes(),
                item.legalName(),
                item.unifiedSocialCreditCode(),
                item.project(),
                item.brand(),
                item.tenant(),
                item.headCompany(),
                item.unresolvedReferences(),
                fields,
                item.alias(),
                item.extensionValues(),
                item.extensionRuleRevision());
    }

    private List<ExtensionDisplayField> extensionFields(UUID workspaceUuid, String key, String hostType, UUID id) {
        if (definitions == null) return List.of();
        ExtensionDefinitionReadback definition;
        try {
            definition = definitions.requireDefinition(workspaceUuid, key, hostType);
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            return List.of();
        }
        String table =
                switch (hostType) {
                    case ExtensionHostTypes.BRAND -> "brand";
                    case ExtensionHostTypes.TENANT -> "tenant";
                    case ExtensionHostTypes.HEAD_COMPANY -> "head_company";
                    case ExtensionHostTypes.STORE -> "store";
                    case ExtensionHostTypes.REGION, ExtensionHostTypes.PROJECT -> "organization_node";
                    default -> throw new BusinessEntityService.OrganizationNotFoundException();
                };
        String raw = jdbc.query(
                OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_ORGANIZATION_EXTENSION_VALUES_TEXT
                        + table
                        + OrganizationOverviewTaskReadServiceSql
                                .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setObject(1, id);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                },
                result -> result.next() ? result.getString(1) : null);
        Map<String, String> values = jsonObject(raw);
        return definition.fields().stream()
                .filter(field -> "ENABLED".equals(field.status()))
                .sorted(java.util.Comparator.comparingInt(ExtensionDefinitionReadback.Field::displayOrder))
                .map(field -> new ExtensionDisplayField(field.label(), displayValue(values.get(field.fieldKey()))))
                .toList();
    }

    private static String platformOrder(Query query) {
        return switch (query.sort()) {
            case "NAME" -> OrganizationOverviewTaskReadServiceSql.PLATFORM_NAME_ORDER_PREFIX
                    + query.direction()
                    + OrganizationOverviewTaskReadServiceSql.ORDER_ID_DESC_SUFFIX;
            case "CODE" -> OrganizationOverviewTaskReadServiceSql.PLATFORM_CODE_ORDER_PREFIX
                    + query.direction()
                    + OrganizationOverviewTaskReadServiceSql.ORDER_ID_DESC_SUFFIX;
            default -> OrganizationOverviewTaskReadServiceSql.PLATFORM_UPDATED_ORDER_PREFIX
                    + query.direction()
                    + OrganizationOverviewTaskReadServiceSql.ORDER_ID_DESC_SUFFIX;
        };
    }

    private static List<Item> jsonOverviewItems(String key, String source) {
        try {
            JsonNode values = JSON.readTree(source);
            if (!values.isArray()) throw new BusinessEntityService.OrganizationNotFoundException();
            List<Item> items = new ArrayList<>();
            for (JsonNode value : values) {
                items.add(new Item(
                        UUID.fromString(value.path("id").asText()),
                        key,
                        value.path("category").asText(),
                        value.path("type").asText(),
                        value.path("code").asText(),
                        value.path("name").asText(),
                        jsonReferences(value.path("path")),
                        value.path("status").asText(),
                        value.path("source").asText(),
                        value.path("version").asLong(),
                        value.path("createdAt").asLong(),
                        value.path("updatedAt").asLong(),
                        nullableText(value, "notes"),
                        nullableText(value, "legalName"),
                        nullableText(value, "unifiedSocialCreditCode"),
                        jsonReference(value.path("project")),
                        jsonReference(value.path("brand")),
                        jsonReference(value.path("tenant")),
                        jsonReference(value.path("headCompany")),
                        List.of(),
                        List.of(),
                        nullableText(value, "alias")));
            }
            return List.copyOf(items);
        } catch (RuntimeException | java.io.IOException failure) {
            throw new BusinessEntityService.OrganizationNotFoundException(failure);
        }
    }

    private static List<FilterOption> jsonFilterOptions(String source) {
        try {
            JsonNode values = JSON.readTree(source);
            if (!values.isArray()) throw new BusinessEntityService.OrganizationNotFoundException();
            List<FilterOption> options = new ArrayList<>();
            for (JsonNode value : values)
                options.add(new FilterOption(
                        value.path("kind").asText(),
                        UUID.fromString(value.path("id").asText()),
                        value.path("code").asText(),
                        value.path("name").asText()));
            return List.copyOf(options);
        } catch (RuntimeException | java.io.IOException failure) {
            throw new BusinessEntityService.OrganizationNotFoundException(failure);
        }
    }

    private static List<Reference> jsonReferences(JsonNode source) {
        if (!source.isArray()) throw new BusinessEntityService.OrganizationNotFoundException();
        List<Reference> values = new ArrayList<>();
        for (JsonNode value : source) values.add(jsonReference(value));
        return List.copyOf(values);
    }

    private static Reference jsonReference(JsonNode source) {
        if (source == null || source.isNull() || source.isMissingNode()) return null;
        return new Reference(
                UUID.fromString(source.path("id").asText()),
                source.path("code").asText(),
                source.path("name").asText(),
                source.path("resolved").asBoolean());
    }

    private static String nullableText(JsonNode source, String field) {
        JsonNode value = source.path(field);
        return value.isMissingNode() || value.isNull() ? null : value.asText();
    }

    private static Map<String, String> jsonObject(String source) {
        if (source == null) return Map.of();
        try {
            JsonNode node = JSON.readTree(source);
            if (!node.isObject()) throw new BusinessEntityService.OrganizationNotFoundException();
            Map<String, String> values = new LinkedHashMap<>();
            node.fields()
                    .forEachRemaining(
                            entry -> values.put(entry.getKey(), entry.getValue().toString()));
            return Map.copyOf(values);
        } catch (java.io.IOException failure) {
            throw new BusinessEntityService.OrganizationNotFoundException(failure);
        }
    }

    private static String displayValue(String encoded) {
        if (encoded == null) return null;
        try {
            JsonNode value = JSON.readTree(encoded);
            return value.isValueNode() ? value.asText() : value.toString();
        } catch (java.io.IOException failure) {
            throw new BusinessEntityService.OrganizationNotFoundException(failure);
        }
    }

    private static List<Reference> references(Array ids, Array codes, Array names) throws SQLException {
        Object[] idValues = (Object[]) ids.getArray();
        Object[] codeValues = (Object[]) codes.getArray();
        Object[] nameValues = (Object[]) names.getArray();
        List<Reference> values = new ArrayList<>(idValues.length);
        for (int index = 0; index < idValues.length; index++)
            values.add(new Reference(
                    (UUID) idValues[index], (String) codeValues[index], (String) nameValues[index], true));
        return List.copyOf(values);
    }

    private static List<String> strings(Array values) throws SQLException {
        if (values == null) return List.of();
        Object[] source = (Object[]) values.getArray();
        List<String> result = new ArrayList<>(source.length);
        for (Object value : source) result.add((String) value);
        return List.copyOf(result);
    }

    private static List<Reference> append(List<Reference> path, Reference leaf) {
        if (path == null) throw new BusinessEntityService.OrganizationNotFoundException();
        List<Reference> values = new ArrayList<>(path);
        values.add(leaf);
        return List.copyOf(values);
    }

    private static String placeholders(int count) {
        return String.join(
                OrganizationOverviewTaskReadServiceSql.PLACEHOLDER_SEPARATOR,
                java.util.Collections.nCopies(count, OrganizationOverviewTaskReadServiceSql.PARAMETER_PLACEHOLDER));
    }

    private static Item required(Item item) {
        if (item == null) throw new BusinessEntityService.OrganizationNotFoundException();
        return item;
    }

    private static Item missing() {
        throw new BusinessEntityService.OrganizationNotFoundException();
    }

    private record PlatformHierarchyRow(
            String groupCode,
            String groupName,
            UUID id,
            UUID parentId,
            String type,
            String code,
            String name,
            String status,
            String notes,
            long updatedAt,
            List<String> phases) {}

    private record TreeRow(
            UUID id,
            UUID parentId,
            String type,
            String code,
            String name,
            String status,
            String notes,
            long updatedAt,
            List<String> phases) {}
}
