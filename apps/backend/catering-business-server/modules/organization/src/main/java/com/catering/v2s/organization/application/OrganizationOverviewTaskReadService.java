package com.catering.v2s.organization.application;

import com.catering.v2s.extension.api.ExtensionDefinitionLookup;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.api.ExtensionHostTypes;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.organization.api.BusinessEntityTypes;
import com.catering.v2s.organization.api.OperationsStoreCommandApi;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.OrganizationNodeTypes;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Platform organization overview read model. Cross-owner reads are absent: every fact is organization-owned. */
@Service
public class OrganizationOverviewTaskReadService implements OperationsStoreCommandApi.StoreDetailReadbackApi {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final JdbcTemplate jdbc;
    private final ExtensionDefinitionLookup definitions;
    private final BusinessEntityService businessEntities;
    private final OrganizationHierarchyService hierarchy;
    private final OrganizationCommandService commercialGroups;

    public OrganizationOverviewTaskReadService(JdbcTemplate jdbc) {
        this(jdbc, null, null, null, null);
    }

    public OrganizationOverviewTaskReadService(
            JdbcTemplate jdbc, ExtensionDefinitionLookup definitions, BusinessEntityService businessEntities) {
        this(jdbc, definitions, businessEntities, null, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public OrganizationOverviewTaskReadService(
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

    @Transactional(readOnly = true)
    public Page page(UUID workspaceUuid, String key, String category, int page, int pageSize) {
        return page(workspaceUuid, key, category, Query.empty(), page, pageSize);
    }

    /** The platform overview owns filtering, sort and count; edges only pass the closed query. */
    @Transactional(readOnly = true)
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
                                safeSize)
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
        List<Item> items =
                switch (category) {
                    case "HIERARCHY" -> hierarchyPage.items().stream()
                            .map(value -> hierarchyItem(key, value))
                            .toList();
                    case "BUSINESS_ENTITY" -> businessEntityPage.items().stream()
                            .map(item -> entityItem(key, item.entityType(), item.entity()))
                            .toList();
                    case ServiceNodeTypes.STORE -> storePage(workspaceUuid, key, safeQuery, safeSize, offset);
                    default -> throw new IllegalArgumentException("unsupported overview category");
                };
        long total = businessEntityPage != null
                ? businessEntityPage.total()
                : hierarchyPage != null ? hierarchyPage.total() : count(workspaceUuid, key, category, safeQuery);
        long asOf = items.stream().mapToLong(Item::updatedAt).max().orElse(0L);
        return new Page(
                new Metadata(key, category, safePage, safeSize, total, safeQuery.sort(), safeQuery.direction()),
                items,
                "AVAILABLE",
                asOf,
                List.of(),
                filterOptions(workspaceUuid, key),
                "AVAILABLE",
                asOf,
                List.of());
    }

    /**
     * The platform overview page is one fixed organization-owner statement. It keeps the three category projections,
     * their common predicate, total, resolved ancestry, filter options and project-phase source in the same snapshot;
     * the edge receives only this typed page model.
     */
    @Transactional(readOnly = true)
    public Page platformOverviewTaskPage(
            UUID workspaceUuid, String key, String category, Query query, int page, int pageSize) {
        Query safe = (query == null ? Query.empty() : query).validated(category);
        int safePage = Math.max(1, page);
        int safeSize = Math.min(100, Math.max(1, pageSize));
        long offset = (long) (safePage - 1) * safeSize;
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> jdbc.query(
                        ("""
            WITH RECURSIVE params AS (
                SELECT ?::uuid AS workspace_uuid, ?::text AS workspace_key, ?::text AS category,
                       ?::text AS type, ?::text AS name_pattern, ?::text AS code_pattern,
                       ?::text AS legal_name_pattern, ?::text AS credit_code_pattern, ?::text AS status,
                       ?::text AS source, ?::uuid AS project_id, ?::uuid AS brand_id,
                       ?::uuid AS tenant_id, ?::uuid AS head_company_id, ?::uuid AS scope_node_id
            ), nodes AS (
                SELECT n.id, n.parent_id, n.node_type, n.code, n.name, n.status, n.version,
                       n.created_at_epoch_millis, n.updated_at_epoch_millis, n.notes
                  FROM organization.organization_node n, params p
                 WHERE n.workspace_uuid=p.workspace_uuid AND n.group_workspace_key=p.workspace_key
            ), visible_scope AS (
                SELECT n.id, n.parent_id, n.node_type FROM nodes n, params p WHERE n.id=p.scope_node_id
                UNION ALL
                SELECT child.id, child.parent_id, child.node_type FROM nodes child JOIN visible_scope parent ON \
                child.parent_id=parent.id
            ), ancestry AS (
                SELECT n.id AS target_id, n.id, n.parent_id, n.code, n.name, 0 AS depth FROM nodes n
                UNION ALL
                SELECT ancestry.target_id, parent.id, parent.parent_id, parent.code, parent.name, ancestry.depth + 1
                  FROM nodes parent JOIN ancestry ON ancestry.parent_id=parent.id
            ), node_paths AS (
                SELECT target_id, jsonb_agg(jsonb_build_object('id', id, 'code', code, 'name', name, 'resolved', true) \
                ORDER BY depth DESC) AS value
                  FROM ancestry GROUP BY target_id
            ), project_phases AS (
                SELECT phase.project_id, jsonb_agg(phase.phase_name ORDER BY phase.display_order) AS value
                  FROM organization.project_phase_name phase JOIN nodes node ON node.id=phase.project_id
                 GROUP BY phase.project_id
            ), business_rows AS (
                SELECT b.id, b.code, b.name, NULL::text AS legal_name, NULL::text AS credit_code, b.alias, b.remark AS \
                notes, b.status, b.version, b.created_at_epoch_millis, b.updated_at_epoch_millis, 'BRAND'::text AS type
                  FROM organization.brand b, params p WHERE b.workspace_uuid=p.workspace_uuid AND \
                  b.group_workspace_key=p.workspace_key
                UNION ALL
                SELECT t.id, t.code, t.name, t.legal_name, t.credit_code, NULL::text, t.remark, t.status, t.version, \
                t.created_at_epoch_millis, t.updated_at_epoch_millis, 'TENANT'::text
                  FROM organization.tenant t, params p WHERE t.workspace_uuid=p.workspace_uuid AND \
                  t.group_workspace_key=p.workspace_key
                UNION ALL
                SELECT h.id, h.code, h.name, h.legal_name, h.credit_code, NULL::text, h.remark, h.status, h.version, \
                h.created_at_epoch_millis, h.updated_at_epoch_millis, 'HEAD_COMPANY'::text
                  FROM organization.head_company h, params p WHERE h.workspace_uuid=p.workspace_uuid AND \
                  h.group_workspace_key=p.workspace_key
            ), all_items AS (
                SELECT n.id, 'HIERARCHY'::text AS category, n.node_type AS type, n.code, n.name, n.status, \
                'MANUAL'::text AS source,
                       n.version, n.created_at_epoch_millis AS created_at, n.updated_at_epoch_millis AS updated_at, \
                       n.notes,
                       NULL::text AS legal_name, NULL::text AS credit_code, NULL::text AS alias, paths.value AS path,
                       NULL::jsonb AS project, NULL::jsonb AS brand, NULL::jsonb AS tenant, NULL::jsonb AS head_company,
                       n.id AS project_filter_id, NULL::uuid AS brand_filter_id, NULL::uuid AS tenant_filter_id, \
                       NULL::uuid AS head_filter_id,
                       COALESCE(phases.value, '[]'::jsonb) AS project_phases
                  FROM nodes n JOIN node_paths paths ON paths.target_id=n.id LEFT JOIN project_phases phases ON \
                  phases.project_id=n.id
                 WHERE n.node_type IN ('REGION', 'PROJECT')
                UNION ALL
                SELECT b.id, 'BUSINESS_ENTITY', b.type, b.code, b.name, b.status, 'MANUAL', b.version, \
                b.created_at_epoch_millis, b.updated_at_epoch_millis, b.notes,
                       b.legal_name, b.credit_code, b.alias,
                       jsonb_build_array(jsonb_build_object('id', b.id, 'code', b.code, 'name', b.name, 'resolved', \
                       true)),
                       NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb
                  FROM business_rows b
                UNION ALL
                SELECT s.id, 'STORE', 'STORE', s.code, s.name, s.status, 'MANUAL', s.version, \
                s.created_at_epoch_millis, s.updated_at_epoch_millis, s.notes,
                       NULL, NULL, NULL,
                       paths.value || jsonb_build_array(jsonb_build_object('id', s.id, 'code', s.code, 'name', s.name, \
                       'resolved', true)),
                       jsonb_build_object('id', project.id, 'code', project.code, 'name', project.name, 'resolved', \
                       true),
                       jsonb_build_object('id', brand.id, 'code', brand.code, 'name', brand.name, 'resolved', true),
                       jsonb_build_object('id', tenant.id, 'code', tenant.code, 'name', tenant.name, 'resolved', true),
                       CASE WHEN head.id IS NULL THEN NULL ELSE jsonb_build_object('id', head.id, 'code', head.code, \
                       'name', head.name, 'resolved', true) END,
                       s.project_id, s.brand_id, s.tenant_id, s.head_company_id, '[]'::jsonb
                  FROM organization.store s
                  JOIN nodes project ON project.id=s.project_id
                  JOIN node_paths paths ON paths.target_id=s.project_id
                  JOIN organization.brand brand ON brand.id=s.brand_id
                  JOIN organization.tenant tenant ON tenant.id=s.tenant_id
                  LEFT JOIN organization.head_company head ON head.id=s.head_company_id
                  CROSS JOIN params p
                 WHERE s.workspace_uuid=p.workspace_uuid AND s.group_workspace_key=p.workspace_key
                   AND (p.scope_node_id IS NULL OR s.id=p.scope_node_id OR s.project_id IN (SELECT id FROM \
                   visible_scope WHERE node_type='PROJECT'))
            ), filtered AS MATERIALIZED (
                SELECT item.id, item.category, item.type, item.code, item.name, item.status, item.source,
                       item.version, item.created_at, item.updated_at, item.notes,
                       item.legal_name, item.credit_code, item.alias, item.path,
                       item.project, item.brand, item.tenant, item.head_company,
                       item.project_filter_id, item.brand_filter_id, item.tenant_filter_id,
                       item.head_filter_id, item.project_phases, COUNT(*) OVER () AS total
                  FROM all_items item CROSS JOIN params p
                 WHERE item.category=p.category
                   AND (p.type IS NULL OR item.type=p.type)
                   AND (p.name_pattern IS NULL OR item.name ILIKE p.name_pattern ESCAPE '!')
                   AND (p.code_pattern IS NULL OR item.code ILIKE p.code_pattern ESCAPE '!')
                   AND (p.legal_name_pattern IS NULL OR item.legal_name ILIKE p.legal_name_pattern ESCAPE '!')
                   AND (p.credit_code_pattern IS NULL OR item.credit_code ILIKE p.credit_code_pattern ESCAPE '!')
                   AND (p.status IS NULL OR item.status=p.status)
                   AND (p.source IS NULL OR (p.source='MANUAL' AND item.source='MANUAL'))
                   AND (p.project_id IS NULL OR item.project_filter_id=p.project_id)
                   AND (p.brand_id IS NULL OR item.brand_filter_id=p.brand_id)
                   AND (p.tenant_id IS NULL OR item.tenant_filter_id=p.tenant_id)
                   AND (p.head_company_id IS NULL OR item.head_filter_id=p.head_company_id)
            ), paged AS (
                SELECT filtered.id, filtered.category, filtered.type, filtered.code, filtered.name, filtered.status,
                       filtered.source, filtered.version, filtered.created_at, filtered.updated_at, filtered.notes,
                       filtered.legal_name, filtered.credit_code, filtered.alias, filtered.path,
                       filtered.project, filtered.brand, filtered.tenant, filtered.head_company,
                       filtered.project_filter_id, filtered.brand_filter_id, filtered.tenant_filter_id,
                       filtered.head_filter_id, filtered.project_phases, filtered.total
                  FROM filtered
                 ORDER BY"""
                                + " " + platformOrder(safe)
                                + """
                 LIMIT ? OFFSET ?
            ), filter_options AS (
                SELECT COALESCE(jsonb_agg(jsonb_build_object('kind', kind, 'id', id, 'code', code, 'name', name) ORDER \
                BY kind, code), '[]'::jsonb) AS value
                  FROM (
                    SELECT 'PROJECT'::text AS kind, n.id, n.code, n.name FROM nodes n WHERE n.node_type='PROJECT'
                    UNION ALL SELECT 'BRAND', b.id, b.code, b.name FROM organization.brand b, params p WHERE \
                    b.workspace_uuid=p.workspace_uuid AND b.group_workspace_key=p.workspace_key
                    UNION ALL SELECT 'TENANT', t.id, t.code, t.name FROM organization.tenant t, params p WHERE \
                    t.workspace_uuid=p.workspace_uuid AND t.group_workspace_key=p.workspace_key
                    UNION ALL SELECT 'HEAD_COMPANY', h.id, h.code, h.name FROM organization.head_company h, params p \
                    WHERE h.workspace_uuid=p.workspace_uuid AND h.group_workspace_key=p.workspace_key
                  ) options
            )
            SELECT COALESCE((SELECT MAX(total) FROM paged), (SELECT COUNT(*) FROM filtered)),
                   COALESCE((SELECT MAX(updated_at) FROM paged), 0),
                   COALESCE((SELECT jsonb_agg(jsonb_build_object(
                       'id', id, 'category', category, 'type', type, 'code', code, 'name', name,
                       'path', path, 'status', status, 'source', source, 'version', version,
                       'createdAt', created_at, 'updatedAt', updated_at, 'notes', notes,
                       'legalName', legal_name, 'unifiedSocialCreditCode', credit_code, 'alias', alias,
                       'project', project, 'brand', brand, 'tenant', tenant, 'headCompany', head_company,
                       'projectPhases', project_phases
                   ) ORDER BY"""
                                + " " + platformOrder(safe) + ") FROM paged), '[]'::jsonb)::text,\n"
                                + """
                   filter_options.value::text
              FROM filter_options
            """),
                        statement -> {
                            int index = 1;
                            statement.setObject(index++, workspaceUuid);
                            statement.setString(index++, key);
                            statement.setString(index++, category);
                            statement.setString(index++, safe.type());
                            statement.setString(index++, like(safe.name()));
                            statement.setString(index++, like(safe.code()));
                            statement.setString(index++, like(safe.legalName()));
                            statement.setString(index++, like(safe.unifiedSocialCreditCode()));
                            statement.setString(index++, safe.status());
                            statement.setString(index++, safe.source());
                            statement.setObject(index++, safe.projectId());
                            statement.setObject(index++, safe.brandId());
                            statement.setObject(index++, safe.tenantId());
                            statement.setObject(index++, safe.headCompanyId());
                            statement.setObject(index++, safe.scopeNodeId());
                            statement.setInt(index++, safeSize);
                            statement.setLong(index, offset);
                        },
                        result -> {
                            if (!result.next()) throw new BusinessEntityService.OrganizationNotFoundException();
                            long total = result.getLong(1);
                            long asOf = result.getLong(2);
                            return new Page(
                                    new Metadata(
                                            key, category, safePage, safeSize, total, safe.sort(), safe.direction()),
                                    jsonOverviewItems(key, result.getString(3)),
                                    "AVAILABLE",
                                    asOf,
                                    List.of(),
                                    jsonFilterOptions(result.getString(4)),
                                    "AVAILABLE",
                                    asOf,
                                    List.of());
                        }));
    }

    @Transactional(readOnly = true)
    public Item detail(UUID workspaceUuid, String key, String category, UUID itemId) {
        return switch (category) {
            case "HIERARCHY" -> hierarchyDetail(workspaceUuid, key, itemId);
            case "BUSINESS_ENTITY" -> entityDetail(workspaceUuid, key, itemId);
            case ServiceNodeTypes.STORE -> storeDetail(workspaceUuid, key, itemId);
            default -> throw new IllegalArgumentException("unsupported overview category");
        };
    }

    /** Organization-owned typed command readback; it does not expose an application task-view type. */
    @Override
    @Transactional(readOnly = true)
    public OperationsStoreCommandApi.StoreOrganizationDetailReadback readStoreDetail(
            OperationsStoreCommandApi.StoreDetailQuery query) {
        Item item = detail(query.workspaceUuid(), query.groupWorkspaceKey(), ServiceNodeTypes.STORE, query.storeId());
        return new OperationsStoreCommandApi.StoreOrganizationDetailReadback(
                reference(item.project()),
                reference(item.brand()),
                reference(item.tenant()),
                reference(item.headCompany()));
    }

    /**
     * Platform detail's organization-owner half. It intentionally does not load the extension definition: that fact
     * belongs to extension and is composed by the caller as the second, explicitly bounded owner projection.
     */
    @Transactional(readOnly = true)
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
        String sql = "WITH RECURSIVE target AS (SELECT id, parent_id, node_type, code, name, status, version, "
                + "created_at_epoch_millis, updated_at_epoch_millis, notes, extension_values::text AS "
                + "extension_values FROM organization.organization_node WHERE workspace_uuid=? AND "
                + "group_workspace_key=? AND id=? AND node_type IN ('REGION','PROJECT')), ancestry AS (SELECT id, "
                + "parent_id, code, name, 0 AS depth FROM target UNION ALL SELECT parent.id, parent.parent_id, "
                + "parent.code, parent.name, ancestry.depth+1 FROM organization.organization_node parent JOIN "
                + "ancestry ON ancestry.parent_id=parent.id WHERE parent.workspace_uuid=? AND "
                + "parent.group_workspace_key=?) SELECT target.id, target.parent_id, target.node_type, target.code, "
                + "target.name, target.status, target.version, target.created_at_epoch_millis, "
                + "target.updated_at_epoch_millis, target.notes, target.extension_values, "
                + "array_agg(ancestry.id ORDER BY ancestry.depth "
                + "DESC) AS path_ids, array_agg(ancestry.code ORDER BY ancestry.depth DESC) AS path_codes, "
                + "array_agg(ancestry.name ORDER BY ancestry.depth DESC) AS path_names FROM target JOIN ancestry "
                + "ON true GROUP BY target.id, target.parent_id, target.node_type, target.code, target.name, "
                + "target.status, target.version, target.created_at_epoch_millis, target.updated_at_epoch_millis, "
                + "target.notes, target.extension_values";
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
        String sql = "WITH target AS (SELECT id, 'BRAND'::text AS entity_type, code, name, NULL::text AS legal_name, "
                + "NULL::text AS credit_code, alias, remark AS notes, status, version, created_at_epoch_millis, "
                + "updated_at_epoch_millis, extension_values::text AS extension_values FROM organization.brand "
                + "WHERE workspace_uuid=? AND group_workspace_key=? AND id=? UNION ALL SELECT id, 'TENANT', code, "
                + "name, legal_name, credit_code, NULL, remark, status, version, created_at_epoch_millis, "
                + "updated_at_epoch_millis, extension_values::text FROM organization.tenant WHERE workspace_uuid=? "
                + "AND group_workspace_key=? AND id=? UNION ALL SELECT id, 'HEAD_COMPANY', code, name, legal_name, "
                + "credit_code, NULL, remark, status, version, created_at_epoch_millis, updated_at_epoch_millis, "
                + "extension_values::text FROM organization.head_company WHERE workspace_uuid=? AND "
                + "group_workspace_key=? AND id=?) SELECT target.id, target.entity_type, target.code, target.name, "
                + "target.legal_name, target.credit_code, target.alias, target.notes, target.status, target.version, "
                + "target.created_at_epoch_millis, target.updated_at_epoch_millis, target.extension_values FROM target";
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
        String sql = "WITH RECURSIVE target AS (SELECT s.id, s.code, s.name, s.status, s.version, "
                + "s.created_at_epoch_millis, s.updated_at_epoch_millis, s.notes, s.extension_values::text AS "
                + "extension_values, p.id AS project_id, p.code AS project_code, p.name AS project_name, b.id AS "
                + "brand_id, b.code AS brand_code, b.name AS brand_name, t.id AS tenant_id, t.code AS tenant_code, "
                + "t.name AS tenant_name, h.id AS head_id, h.code AS head_code, h.name AS head_name FROM "
                + "organization.store s JOIN organization.organization_node p ON p.id=s.project_id JOIN "
                + "organization.brand b ON b.id=s.brand_id JOIN organization.tenant t ON t.id=s.tenant_id LEFT "
                + "JOIN organization.head_company h ON h.id=s.head_company_id WHERE s.workspace_uuid=? AND "
                + "s.group_workspace_key=? AND s.id=?), ancestry AS (SELECT target.project_id AS target_id, "
                + "node.id, node.parent_id, node.code, node.name, 0 AS depth FROM target JOIN "
                + "organization.organization_node node ON node.id=target.project_id UNION ALL SELECT "
                + "ancestry.target_id, parent.id, parent.parent_id, parent.code, parent.name, ancestry.depth+1 "
                + "FROM organization.organization_node parent JOIN ancestry ON ancestry.parent_id=parent.id WHERE "
                + "parent.workspace_uuid=? AND parent.group_workspace_key=?) "
                + "SELECT target.id, target.code, target.name, "
                + "target.status, target.version, target.created_at_epoch_millis, target.updated_at_epoch_millis, "
                + "target.notes, target.extension_values, target.project_id, target.project_code, target.project_name, "
                + "target.brand_id, target.brand_code, target.brand_name, target.tenant_id, target.tenant_code, "
                + "target.tenant_name, target.head_id, target.head_code, target.head_name, "
                + "array_agg(ancestry.id ORDER BY ancestry.depth DESC) AS path_ids, array_agg(ancestry.code ORDER "
                + "BY ancestry.depth DESC) AS path_codes, array_agg(ancestry.name ORDER BY ancestry.depth DESC) AS "
                + "path_names FROM target JOIN ancestry ON ancestry.target_id=target.project_id GROUP BY "
                + "target.id, target.code, target.name, target.status, target.version, "
                + "target.created_at_epoch_millis, target.updated_at_epoch_millis, target.notes, "
                + "target.extension_values, target.project_id, target.project_code, target.project_name, "
                + "target.brand_id, target.brand_code, target.brand_name, target.tenant_id, target.tenant_code, "
                + "target.tenant_name, target.head_id, target.head_code, target.head_name";
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
    @Transactional(readOnly = true)
    public HierarchyTree hierarchyTree(UUID workspaceUuid, String key) {
        return platformHierarchyTree(workspaceUuid, key);
    }

    /** Platform hierarchy tree is one organization-owner projection, including project phases. */
    @Transactional(readOnly = true)
    public HierarchyTree platformHierarchyTree(UUID workspaceUuid, String key) {
        List<PlatformHierarchyRow> source = jdbc.query(
                "SELECT commercial_group.commercial_group_code, commercial_group.commercial_group_name, node.id, "
                        + "node.parent_id, node.node_type, node.code, node.name, node.status, node.notes, "
                        + "node.updated_at_epoch_millis, "
                        + "COALESCE(phases.phase_names, ARRAY[]::varchar[]) AS phase_names FROM "
                        + "organization.commercial_group commercial_group "
                        + "LEFT JOIN organization.organization_node node ON node.workspace_uuid=? AND "
                        + "node.group_workspace_key=? AND node.node_type IN ('REGION','PROJECT') "
                        + "LEFT JOIN LATERAL (SELECT array_agg(phase_name ORDER BY display_order) AS phase_names FROM "
                        + "organization.project_phase_name WHERE project_id=node.id) phases ON true "
                        + "WHERE commercial_group.group_workspace_key=? ORDER BY node.node_type, node.code, node.id",
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

    private List<Item> storePage(UUID workspaceUuid, String key, Query query, int size, long offset) {
        String scopePredicate = visibleStorePredicate(query.scopeNodeId(), "s.id", "s.project_id");
        String where = baseFilters("s.", null, query) + scopePredicate
                + " AND (?::uuid IS NULL OR s.project_id=?) AND (?::uuid IS NULL OR s.brand_id=?) AND (?::uuid IS NULL "
                + "OR s.tenant_id=?) AND (?::uuid IS NULL OR s.head_company_id=?)";
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
        values.add(size);
        values.add(offset);
        List<Item> rows = jdbc.query(
                storeRowsSql() + where + " ORDER BY " + storeOrder(query) + " " + query.direction()
                        + ", s.id DESC LIMIT ? OFFSET ?",
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
                "BRAND".equals(type) ? entity.alias() : null);
    }

    private Item storeDetail(UUID workspaceUuid, String key, UUID itemId) {
        String sql = "WITH RECURSIVE target AS (" + storeRowsSql() + " AND s.id=?), ancestry AS ("
                + "SELECT target.project_id AS target_id, node.id, node.parent_id, node.code, node.name, 0 AS depth "
                + "FROM target JOIN organization.organization_node node ON node.id=target.project_id "
                + "UNION ALL SELECT ancestry.target_id, parent.id, parent.parent_id, parent.code, parent.name, "
                + "ancestry.depth + 1 FROM organization.organization_node parent JOIN ancestry ON "
                + "ancestry.parent_id=parent.id"
                + "), paths AS (SELECT target_id, array_agg(id ORDER BY depth DESC) AS path_ids, array_agg(code ORDER "
                + "BY depth DESC) AS path_codes, array_agg(name ORDER BY depth DESC) AS path_names FROM ancestry "
                + "GROUP BY target_id) "
                + "SELECT target.id, target.code, target.name, target.status, target.version, "
                + "target.created_at_epoch_millis, target.updated_at_epoch_millis, target.notes, "
                + "target.project_id, target.project_code, target.project_name, target.brand_id, "
                + "target.brand_code, target.brand_name, target.tenant_id, target.tenant_code, target.tenant_name, "
                + "target.head_id, target.head_code, target.head_name, paths.path_ids, paths.path_codes, "
                + "paths.path_names FROM target JOIN paths ON paths.target_id=target.project_id";
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

    private long count(UUID workspaceUuid, String key, String category, Query query) {
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
                yield jdbc.queryForObject(
                        "SELECT count(*)"
                                + storeRowsSql().substring(storeRowsSql().indexOf(" FROM"))
                                + baseFilters("s.", null, query)
                                + visibleStorePredicate(query.scopeNodeId(), "s.id", "s.project_id")
                                + " AND (?::uuid IS NULL OR s.project_id=?) AND (?::uuid IS NULL OR s.brand_id=?) AND "
                                + "(?::uuid IS NULL OR s.tenant_id=?) AND (?::uuid IS NULL OR s.head_company_id=?)",
                        Long.class,
                        values.toArray());
            }
            default -> throw new IllegalArgumentException("unsupported overview category");
        };
    }

    private static String baseFilters(String prefix, String typeColumn, Query query) {
        return " AND (?::text IS NULL OR " + prefix + "name ILIKE ? ESCAPE '!') AND (?::text IS NULL OR " + prefix
                + "code ILIKE ? ESCAPE '!') AND (?::text IS NULL OR " + prefix + "status=?)"
                + (query.type() == null || typeColumn == null ? "" : " AND " + typeColumn + "=?")
                + ("SYSTEM".equals(query.source()) ? " AND 1=0" : "");
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
                : " AND (" + storeColumn + "=?::uuid OR " + projectColumn
                        + " IN (WITH RECURSIVE visible_scope(id, parent_id, node_type) AS (SELECT id, parent_id, "
                        + "node_type FROM organization.organization_node WHERE workspace_uuid=? AND "
                        + "group_workspace_key=? AND id=? UNION ALL SELECT child.id, child.parent_id, "
                        + "child.node_type FROM organization.organization_node child JOIN visible_scope parent ON "
                        + "child.parent_id=parent.id WHERE child.workspace_uuid=? AND child.group_workspace_key=?) "
                        + "SELECT id FROM visible_scope WHERE node_type='PROJECT'))";
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
            case "NAME" -> "s.name";
            case "CODE" -> "s.code";
            default -> "s.updated_at_epoch_millis";
        };
    }

    private static String like(String value) {
        return value == null || value.isBlank()
                ? null
                : "%" + value.trim().replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
    }

    private Map<UUID, List<Reference>> nodePaths(UUID workspaceUuid, String key, List<UUID> ids) {
        if (ids.isEmpty()) return Map.of();
        String sql = "WITH RECURSIVE ancestry AS ("
                + "SELECT node.id AS target_id, node.id, node.parent_id, node.code, node.name, 0 AS depth FROM "
                + "organization.organization_node node WHERE node.workspace_uuid=? AND node.group_workspace_key=? "
                + "AND node.id IN ("
                + placeholders(ids.size()) + ") "
                + "UNION ALL SELECT ancestry.target_id, parent.id, parent.parent_id, parent.code, parent.name, "
                + "ancestry.depth + 1 FROM organization.organization_node parent JOIN ancestry ON "
                + "ancestry.parent_id=parent.id WHERE parent.workspace_uuid=? AND parent.group_workspace_key=?"
                + ") SELECT target_id, array_agg(id ORDER BY depth DESC) AS path_ids, array_agg(code ORDER BY depth "
                + "DESC) AS path_codes, array_agg(name ORDER BY depth DESC) AS path_names FROM ancestry GROUP BY "
                + "target_id";
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
                "SELECT kind, id, code, name FROM (SELECT 'PROJECT' AS kind, id, code, name FROM "
                        + "organization.organization_node WHERE workspace_uuid=? AND group_workspace_key=? AND "
                        + "node_type='PROJECT' UNION ALL SELECT 'BRAND', id, code, name FROM organization.brand WHERE "
                        + "workspace_uuid=? AND group_workspace_key=? UNION ALL SELECT 'TENANT', id, code, name FROM "
                        + "organization.tenant WHERE workspace_uuid=? AND group_workspace_key=? UNION ALL SELECT "
                        + "'HEAD_COMPANY', id, code, name FROM organization.head_company WHERE workspace_uuid=? AND "
                        + "group_workspace_key=?) options ORDER BY kind, code",
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
        return "SELECT s.id, s.code, s.name, s.status, s.version, s.created_at_epoch_millis, "
                + "s.updated_at_epoch_millis, s.notes, p.id AS project_id, p.code AS project_code, p.name AS "
                + "project_name, "
                + "b.id AS brand_id, b.code AS brand_code, b.name AS brand_name, t.id AS tenant_id, t.code AS "
                + "tenant_code, "
                + "t.name AS tenant_name, h.id AS head_id, h.code AS head_code, h.name AS head_name FROM "
                + "organization.store s JOIN organization.organization_node p ON p.id=s.project_id JOIN "
                + "organization.brand "
                + "b ON b.id=s.brand_id JOIN organization.tenant t ON t.id=s.tenant_id LEFT JOIN "
                + "organization.head_company "
                + "h ON h.id=s.head_company_id WHERE s.workspace_uuid=? AND s.group_workspace_key=?";
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
                null);
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
                item.alias());
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
                item.alias());
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
                "SELECT extension_values::text FROM organization." + table
                        + " WHERE id=? AND workspace_uuid=? AND group_workspace_key=?",
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
            case "NAME" -> "name " + query.direction() + ", id DESC";
            case "CODE" -> "code " + query.direction() + ", id DESC";
            default -> "updated_at " + query.direction() + ", id DESC";
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
        return String.join(",", java.util.Collections.nCopies(count, "?"));
    }

    private static Item required(Item item) {
        if (item == null) throw new BusinessEntityService.OrganizationNotFoundException();
        return item;
    }

    private static Item missing() {
        throw new BusinessEntityService.OrganizationNotFoundException();
    }

    public record Query(
            String type,
            String name,
            String code,
            String legalName,
            String unifiedSocialCreditCode,
            String status,
            String source,
            UUID projectId,
            UUID brandId,
            UUID tenantId,
            UUID headCompanyId,
            String sort,
            String direction,
            UUID scopeNodeId) {
        public Query(
                String type,
                String name,
                String code,
                String legalName,
                String unifiedSocialCreditCode,
                String status,
                String source,
                UUID projectId,
                UUID brandId,
                UUID tenantId,
                String sort,
                String direction) {
            this(
                    type,
                    name,
                    code,
                    legalName,
                    unifiedSocialCreditCode,
                    status,
                    source,
                    projectId,
                    brandId,
                    tenantId,
                    null,
                    sort,
                    direction,
                    null);
        }

        public Query(
                String type,
                String name,
                String code,
                String legalName,
                String unifiedSocialCreditCode,
                String status,
                String source,
                UUID projectId,
                UUID brandId,
                UUID tenantId,
                String sort,
                String direction,
                UUID scopeNodeId) {
            this(
                    type,
                    name,
                    code,
                    legalName,
                    unifiedSocialCreditCode,
                    status,
                    source,
                    projectId,
                    brandId,
                    tenantId,
                    null,
                    sort,
                    direction,
                    scopeNodeId);
        }

        static Query empty() {
            return new Query(
                    null, null, null, null, null, null, null, null, null, null, null, "UPDATED_AT", "DESC", null);
        }

        Query validated(String category) {
            String safeSort = sort == null ? "UPDATED_AT" : sort;
            String safeDirection = direction == null ? "DESC" : direction;
            if (!List.of("NAME", "CODE", "UPDATED_AT").contains(safeSort)
                    || !List.of("ASC", "DESC").contains(safeDirection)
                    || (status != null && !List.of("ENABLED", "DISABLED").contains(status))
                    || (source != null && !List.of("MANUAL", "SYSTEM").contains(source)))
                throw new IllegalArgumentException("invalid overview query");
            if ("HIERARCHY".equals(category)) {
                if (type != null
                                && !List.of(OrganizationNodeTypes.REGION, OrganizationNodeTypes.PROJECT)
                                        .contains(type)
                        || brandId != null
                        || tenantId != null
                        || headCompanyId != null) throw new IllegalArgumentException("invalid hierarchy query");
            } else if ("BUSINESS_ENTITY".equals(category)) {
                if (type != null
                                && !List.of("BRAND", "TENANT", BusinessEntityTypes.HEAD_COMPANY)
                                        .contains(type)
                        || projectId != null
                        || brandId != null
                        || tenantId != null
                        || headCompanyId != null) throw new IllegalArgumentException("invalid entity query");
            } else if (ServiceNodeTypes.STORE.equals(category)) {
                if (type != null && !ServiceNodeTypes.STORE.equals(type))
                    throw new IllegalArgumentException("invalid store query");
            } else throw new IllegalArgumentException("unsupported overview category");
            if (!"BUSINESS_ENTITY".equals(category) && (legalName != null || unifiedSocialCreditCode != null))
                throw new IllegalArgumentException("invalid overview query");
            if ("BUSINESS_ENTITY".equals(category)
                    && ("BRAND".equals(type) && (legalName != null || unifiedSocialCreditCode != null)))
                throw new IllegalArgumentException("invalid brand legal query");
            return new Query(
                    type,
                    name,
                    code,
                    legalName,
                    unifiedSocialCreditCode,
                    status,
                    source,
                    projectId,
                    brandId,
                    tenantId,
                    headCompanyId,
                    safeSort,
                    safeDirection,
                    scopeNodeId);
        }
    }

    public record HierarchyTree(String groupCode, String groupName, List<TreeNode> regions) {}

    public record TreeNode(
            UUID id,
            String type,
            String code,
            String name,
            String status,
            String notes,
            long updatedAt,
            List<TreeNode> children,
            List<String> phases) {}

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

    public record Page(
            Metadata metadata,
            List<Item> items,
            String itemsSourceStatus,
            long itemsAsOf,
            List<String> itemsUnresolved,
            List<FilterOption> filterOptions,
            String filterOptionsSourceStatus,
            long filterOptionsAsOf,
            List<String> filterOptionsUnresolved) {}

    public record Metadata(
            String groupWorkspaceKey,
            String category,
            int page,
            int pageSize,
            long total,
            String sort,
            String direction) {}

    public record Item(
            UUID id,
            String groupWorkspaceKey,
            String category,
            String type,
            String code,
            String name,
            List<Reference> path,
            String status,
            String source,
            long version,
            long createdAt,
            long updatedAt,
            String notes,
            String legalName,
            String unifiedSocialCreditCode,
            Reference project,
            Reference brand,
            Reference tenant,
            Reference headCompany,
            List<String> unresolvedReferences,
            List<ExtensionDisplayField> extensionFields,
            String alias) {}

    public record PlatformManagementBaseDetail(Item item, Map<String, String> extensionValues) {}

    public record ExtensionDisplayField(String name, String value) {}

    public record Reference(UUID id, String code, String name, boolean resolved) {}

    public record FilterOption(String kind, UUID id, String code, String name) {}
}
