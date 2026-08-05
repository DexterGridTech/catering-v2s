package com.catering.v2s.organization.application;

import com.catering.v2s.extension.api.ExtensionDefinitionLookup;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
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
public class OrganizationOverviewTaskReadService {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final JdbcTemplate jdbc;
    private final ExtensionDefinitionLookup definitions;
    private final BusinessEntityService businessEntities;
    private final OrganizationHierarchyService hierarchy;
    private final OrganizationCommandService commercialGroups;
    public OrganizationOverviewTaskReadService(JdbcTemplate jdbc) { this(jdbc, null, null, null, null); }
    public OrganizationOverviewTaskReadService(JdbcTemplate jdbc, ExtensionDefinitionLookup definitions, BusinessEntityService businessEntities) { this(jdbc, definitions, businessEntities, null, null); }
    @org.springframework.beans.factory.annotation.Autowired
    public OrganizationOverviewTaskReadService(JdbcTemplate jdbc, ExtensionDefinitionLookup definitions, BusinessEntityService businessEntities, OrganizationHierarchyService hierarchy, OrganizationCommandService commercialGroups) { this.jdbc = jdbc; this.definitions = definitions; this.businessEntities = businessEntities; this.hierarchy = hierarchy; this.commercialGroups = commercialGroups; }

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
            ? requiredBusinessEntities().pageBusinessEntities(workspaceUuid, key, safeQuery.type(), safeQuery.name(), safeQuery.code(), safeQuery.legalName(), safeQuery.unifiedSocialCreditCode(), safeQuery.status(), safeQuery.sort(), safeQuery.direction(), safePage, safeSize)
            : null;
        OrganizationHierarchyService.HierarchyPage hierarchyPage = "HIERARCHY".equals(category)
            ? requiredHierarchy().page(workspaceUuid, key, new OrganizationHierarchyService.HierarchyQuery(safeQuery.type(), safeQuery.name(), safeQuery.code(), safeQuery.status(), safeQuery.projectId(), safeQuery.sort(), safeQuery.direction(), safePage, safeSize))
            : null;
        List<Item> items = switch (category) {
            case "HIERARCHY" -> hierarchyPage.items().stream().map(value -> hierarchyItem(key, value)).toList();
            case "BUSINESS_ENTITY" -> businessEntityPage.items().stream().map(item -> entityItem(key, item.entityType(), item.entity())).toList();
            case "STORE" -> storePage(workspaceUuid, key, safeQuery, safeSize, offset);
            default -> throw new IllegalArgumentException("unsupported overview category");
        };
        long total = businessEntityPage != null ? businessEntityPage.total() : hierarchyPage != null ? hierarchyPage.total() : count(workspaceUuid, key, category, safeQuery);
        long asOf = items.stream().mapToLong(Item::updatedAt).max().orElse(0L);
        return new Page(new Metadata(key, category, safePage, safeSize, total, safeQuery.sort(), safeQuery.direction()), items, "AVAILABLE", asOf, List.of(), filterOptions(workspaceUuid, key), "AVAILABLE", asOf, List.of());
    }

    @Transactional(readOnly = true)
    public Item detail(UUID workspaceUuid, String key, String category, UUID itemId) {
        return switch (category) {
            case "HIERARCHY" -> hierarchyDetail(workspaceUuid, key, itemId);
            case "BUSINESS_ENTITY" -> entityDetail(workspaceUuid, key, itemId);
            case "STORE" -> storeDetail(workspaceUuid, key, itemId);
            default -> throw new IllegalArgumentException("unsupported overview category");
        };
    }

    /** A hierarchy is a complete owner read, never a page that a consumer is asked to turn into a tree. */
    @Transactional(readOnly = true)
    public HierarchyTree hierarchyTree(UUID workspaceUuid, String key) {
        var root = requiredCommercialGroups().requireCommercialGroup(key);
        List<TreeRow> rows = requiredHierarchy().list(workspaceUuid, key).stream()
            .map(node -> new TreeRow(node.id(), node.parentId(), node.nodeType(), node.code(), node.name(), node.status(), node.notes(), node.updatedAtEpochMillis(), node.phaseNames()))
            .toList();
        Map<UUID, List<TreeRow>> projectsByRegion = new LinkedHashMap<>();
        rows.stream().filter(row -> "PROJECT".equals(row.type())).forEach(row -> projectsByRegion.computeIfAbsent(row.parentId(), ignored -> new ArrayList<>()).add(row));
        List<TreeNode> regions = rows.stream().filter(row -> "REGION".equals(row.type())).map(row -> treeNode(row, projectsByRegion.getOrDefault(row.id(), List.of()))).toList();
        return new HierarchyTree(root.commercialGroupCode(), root.commercialGroupName(), regions);
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
        String where = baseFilters("s.", null, query) + scopePredicate + " AND (?::uuid IS NULL OR s.project_id=?) AND (?::uuid IS NULL OR s.brand_id=?) AND (?::uuid IS NULL OR s.tenant_id=?) AND (?::uuid IS NULL OR s.head_company_id=?)";
        List<Object> values = baseValues(workspaceUuid, key, query);
        addVisibleStoreValues(values, workspaceUuid, key, query.scopeNodeId());
        values.add(query.projectId()); values.add(query.projectId()); values.add(query.brandId()); values.add(query.brandId()); values.add(query.tenantId()); values.add(query.tenantId()); values.add(query.headCompanyId()); values.add(query.headCompanyId()); values.add(size); values.add(offset);
        List<Item> rows = jdbc.query(storeRowsSql() + where + " ORDER BY " + storeOrder(query) + " " + query.direction() + ", s.id DESC LIMIT ? OFFSET ?", (row, index) -> storeItem(key, row, List.of()), values.toArray());
        Map<UUID, List<Reference>> paths = nodePaths(workspaceUuid, key, rows.stream().map(item -> item.project().id()).toList());
        return rows.stream().map(item -> withPath(item, append(paths.get(item.project().id()), new Reference(item.id(), item.code(), item.name(), true)))).toList();
    }

    private Item hierarchyDetail(UUID workspaceUuid, String key, UUID itemId) {
        Item required = hierarchyItem(key, requiredHierarchy().requireNodeWithPath(workspaceUuid, key, itemId));
        return withExtensionFields(required, extensionFields(workspaceUuid, key, required.type(), required.id()));
    }

    private Item entityDetail(UUID workspaceUuid, String key, UUID itemId) {
        BusinessEntityService.BusinessEntityPageItem readback = requiredBusinessEntities().requireBusinessEntity(workspaceUuid, key, itemId);
        Item item = entityItem(key, readback.entityType(), readback.entity());
        return withExtensionFields(item, extensionFields(workspaceUuid, key, item.type(), item.id()));
    }

    private static Item hierarchyItem(String key, OrganizationHierarchyService.HierarchyPageItem value) {
        var node = value.node();
        List<Reference> path = value.path().stream().map(part -> new Reference(part.id(), part.code(), part.name(), true)).toList();
        return new Item(node.id(), key, "HIERARCHY", node.nodeType(), node.code(), node.name(), path, node.status(), "MANUAL", node.version(), node.createdAtEpochMillis(), node.updatedAtEpochMillis(), node.notes(), null, null, null, null, null, null, List.of(), List.of(), null);
    }

    private static Item entityItem(String key, String type, OrganizationEntityReadback entity) {
        Reference self = new Reference(entity.id(), entity.code(), entity.name(), true);
        return new Item(entity.id(), key, "BUSINESS_ENTITY", type, entity.code(), entity.name(), List.of(self), entity.status(), "MANUAL", entity.version(), entity.createdAt(), entity.updatedAt(), entity.remark(), entity.legalName(), entity.creditCode(), null, null, null, null, List.of(), List.of(), "BRAND".equals(type) ? entity.alias() : null);
    }

    private Item storeDetail(UUID workspaceUuid, String key, UUID itemId) {
        String sql = "WITH RECURSIVE target AS (" + storeRowsSql() + " AND s.id=?" +
            "), ancestry AS (" +
            "SELECT target.project_id AS target_id, node.id, node.parent_id, node.code, node.name, 0 AS depth FROM target JOIN organization.organization_node node ON node.id=target.project_id " +
            "UNION ALL SELECT ancestry.target_id, parent.id, parent.parent_id, parent.code, parent.name, ancestry.depth + 1 FROM organization.organization_node parent JOIN ancestry ON ancestry.parent_id=parent.id" +
            "), paths AS (SELECT target_id, array_agg(id ORDER BY depth DESC) AS path_ids, array_agg(code ORDER BY depth DESC) AS path_codes, array_agg(name ORDER BY depth DESC) AS path_names FROM ancestry GROUP BY target_id) " +
            "SELECT target.*, paths.path_ids, paths.path_codes, paths.path_names FROM target JOIN paths ON paths.target_id=target.project_id";
        Item item = jdbc.query(sql, statement -> { statement.setObject(1, workspaceUuid); statement.setString(2, key); statement.setObject(3, itemId); }, result -> {
            if (!result.next()) return null;
            return storeItem(key, result, append(references(result.getArray("path_ids"), result.getArray("path_codes"), result.getArray("path_names")), new Reference(result.getObject("id", UUID.class), result.getString("code"), result.getString("name"), true)));
        });
        Item required = required(item);
        return withExtensionFields(required, extensionFields(workspaceUuid, key, "STORE", required.id()));
    }

    private long count(UUID workspaceUuid, String key, String category, Query query) {
        return switch (category) {
            case "HIERARCHY" -> throw new IllegalStateException("hierarchy count is owned by OrganizationHierarchyService");
            case "BUSINESS_ENTITY" -> throw new IllegalStateException("business-entity count is owned by BusinessEntityService");
            case "STORE" -> { List<Object> values = baseValues(workspaceUuid, key, query); addVisibleStoreValues(values, workspaceUuid, key, query.scopeNodeId()); values.add(query.projectId()); values.add(query.projectId()); values.add(query.brandId()); values.add(query.brandId()); values.add(query.tenantId()); values.add(query.tenantId()); values.add(query.headCompanyId()); values.add(query.headCompanyId()); yield jdbc.queryForObject("SELECT count(*)" + storeRowsSql().substring(storeRowsSql().indexOf(" FROM")) + baseFilters("s.", null, query) + visibleStorePredicate(query.scopeNodeId(), "s.id", "s.project_id") + " AND (?::uuid IS NULL OR s.project_id=?) AND (?::uuid IS NULL OR s.brand_id=?) AND (?::uuid IS NULL OR s.tenant_id=?) AND (?::uuid IS NULL OR s.head_company_id=?)", Long.class, values.toArray()); }
            default -> throw new IllegalArgumentException("unsupported overview category");
        };
    }

    private static String baseFilters(String prefix, String typeColumn, Query query) { return " AND (?::text IS NULL OR " + prefix + "name ILIKE ? ESCAPE '!') AND (?::text IS NULL OR " + prefix + "code ILIKE ? ESCAPE '!') AND (?::text IS NULL OR " + prefix + "status=?)" + (query.type() == null || typeColumn == null ? "" : " AND " + typeColumn + "=?") + ("SYSTEM".equals(query.source()) ? " AND 1=0" : ""); }
    private static List<Object> baseValues(UUID workspaceUuid, String key, Query query) { List<Object> values = new ArrayList<>(); values.add(workspaceUuid); values.add(key); values.add(like(query.name())); values.add(like(query.name())); values.add(like(query.code())); values.add(like(query.code())); values.add(query.status()); values.add(query.status()); if (query.type() != null && !"STORE".equals(query.type())) values.add(query.type()); return values; }
    private static String visibleStorePredicate(UUID scopeNodeId, String storeColumn, String projectColumn) {
        return scopeNodeId == null ? "" : " AND (" + storeColumn + "=?::uuid OR " + projectColumn + " IN (WITH RECURSIVE visible_scope(id, parent_id, node_type) AS (SELECT id, parent_id, node_type FROM organization.organization_node WHERE workspace_uuid=? AND group_workspace_key=? AND id=? UNION ALL SELECT child.id, child.parent_id, child.node_type FROM organization.organization_node child JOIN visible_scope parent ON child.parent_id=parent.id WHERE child.workspace_uuid=? AND child.group_workspace_key=?) SELECT id FROM visible_scope WHERE node_type='PROJECT'))";
    }
    private static void addVisibleStoreValues(List<Object> values, UUID workspaceUuid, String key, UUID scopeNodeId) {
        if (scopeNodeId == null) return;
        values.add(scopeNodeId);
        values.add(workspaceUuid); values.add(key); values.add(scopeNodeId); values.add(workspaceUuid); values.add(key);
    }
    private static String storeOrder(Query query) { return switch (query.sort()) { case "NAME" -> "s.name"; case "CODE" -> "s.code"; default -> "s.updated_at_epoch_millis"; }; }
    private static String like(String value) { return value == null || value.isBlank() ? null : "%" + value.trim().replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%"; }

    private Map<UUID, List<Reference>> nodePaths(UUID workspaceUuid, String key, List<UUID> ids) {
        if (ids.isEmpty()) return Map.of();
        String sql = "WITH RECURSIVE ancestry AS (" +
            "SELECT node.id AS target_id, node.id, node.parent_id, node.code, node.name, 0 AS depth FROM organization.organization_node node WHERE node.workspace_uuid=? AND node.group_workspace_key=? AND node.id IN (" + placeholders(ids.size()) + ") " +
            "UNION ALL SELECT ancestry.target_id, parent.id, parent.parent_id, parent.code, parent.name, ancestry.depth + 1 FROM organization.organization_node parent JOIN ancestry ON ancestry.parent_id=parent.id WHERE parent.workspace_uuid=? AND parent.group_workspace_key=?" +
            ") SELECT target_id, array_agg(id ORDER BY depth DESC) AS path_ids, array_agg(code ORDER BY depth DESC) AS path_codes, array_agg(name ORDER BY depth DESC) AS path_names FROM ancestry GROUP BY target_id";
        return jdbc.query(sql, statement -> {
            int index = 1;
            statement.setObject(index++, workspaceUuid); statement.setString(index++, key);
            for (UUID id : ids) statement.setObject(index++, id);
            statement.setObject(index++, workspaceUuid); statement.setString(index, key);
        }, result -> {
            Map<UUID, List<Reference>> paths = new LinkedHashMap<>();
            while (result.next()) paths.put(result.getObject("target_id", UUID.class), references(result.getArray("path_ids"), result.getArray("path_codes"), result.getArray("path_names")));
            return Map.copyOf(paths);
        });
    }

    private List<FilterOption> filterOptions(UUID workspaceUuid, String key) {
        return jdbc.query("SELECT kind, id, code, name FROM (SELECT 'PROJECT' AS kind, id, code, name FROM organization.organization_node WHERE workspace_uuid=? AND group_workspace_key=? AND node_type='PROJECT' UNION ALL SELECT 'BRAND', id, code, name FROM organization.brand WHERE workspace_uuid=? AND group_workspace_key=? UNION ALL SELECT 'TENANT', id, code, name FROM organization.tenant WHERE workspace_uuid=? AND group_workspace_key=? UNION ALL SELECT 'HEAD_COMPANY', id, code, name FROM organization.head_company WHERE workspace_uuid=? AND group_workspace_key=?) options ORDER BY kind, code", (row, index) -> new FilterOption(row.getString(1), row.getObject(2, UUID.class), row.getString(3), row.getString(4)), workspaceUuid, key, workspaceUuid, key, workspaceUuid, key, workspaceUuid, key);
    }

    private static String storeRowsSql() {
        return "SELECT s.id, s.code, s.name, s.status, s.version, s.created_at_epoch_millis, s.updated_at_epoch_millis, s.notes, p.id AS project_id, p.code AS project_code, p.name AS project_name, b.id AS brand_id, b.code AS brand_code, b.name AS brand_name, t.id AS tenant_id, t.code AS tenant_code, t.name AS tenant_name, h.id AS head_id, h.code AS head_code, h.name AS head_name FROM organization.store s JOIN organization.organization_node p ON p.id=s.project_id JOIN organization.brand b ON b.id=s.brand_id JOIN organization.tenant t ON t.id=s.tenant_id LEFT JOIN organization.head_company h ON h.id=s.head_company_id WHERE s.workspace_uuid=? AND s.group_workspace_key=?";
    }

    private static TreeNode treeNode(TreeRow row, List<TreeRow> children) {
        return new TreeNode(row.id(), row.type(), row.code(), row.name(), row.status(), row.notes(), row.updatedAt(), children.stream().map(child -> treeNode(child, List.of())).toList(), row.phases());
    }

    private static Item storeItem(String key, ResultSet row, List<Reference> path) throws SQLException {
        Reference project = new Reference(row.getObject("project_id", UUID.class), row.getString("project_code"), row.getString("project_name"), true);
        Reference brand = new Reference(row.getObject("brand_id", UUID.class), row.getString("brand_code"), row.getString("brand_name"), true);
        Reference tenant = new Reference(row.getObject("tenant_id", UUID.class), row.getString("tenant_code"), row.getString("tenant_name"), true);
        UUID headId = row.getObject("head_id", UUID.class);
        Reference head = headId == null ? null : new Reference(headId, row.getString("head_code"), row.getString("head_name"), true);
        return new Item(row.getObject("id", UUID.class), key, "STORE", "STORE", row.getString("code"), row.getString("name"), path, row.getString("status"), "MANUAL", row.getLong("version"), row.getLong("created_at_epoch_millis"), row.getLong("updated_at_epoch_millis"), row.getString("notes"), null, null, project, brand, tenant, head, List.of(), List.of(), null);
    }

    private static Item withPath(Item item, List<Reference> path) {
        if (path == null) throw new BusinessEntityService.OrganizationNotFoundException();
        return new Item(item.id(), item.groupWorkspaceKey(), item.category(), item.type(), item.code(), item.name(), path, item.status(), item.source(), item.version(), item.createdAt(), item.updatedAt(), item.notes(), item.legalName(), item.unifiedSocialCreditCode(), item.project(), item.brand(), item.tenant(), item.headCompany(), item.unresolvedReferences(), item.extensionFields(), item.alias());
    }

    private Item withExtensionFields(Item item, List<ExtensionDisplayField> fields) {
        return new Item(item.id(), item.groupWorkspaceKey(), item.category(), item.type(), item.code(), item.name(), item.path(), item.status(), item.source(), item.version(), item.createdAt(), item.updatedAt(), item.notes(), item.legalName(), item.unifiedSocialCreditCode(), item.project(), item.brand(), item.tenant(), item.headCompany(), item.unresolvedReferences(), fields, item.alias());
    }

    private List<ExtensionDisplayField> extensionFields(UUID workspaceUuid, String key, String hostType, UUID id) {
        if (definitions == null) return List.of();
        ExtensionDefinitionReadback definition;
        try { definition = definitions.requireDefinition(workspaceUuid, key, hostType); }
        catch (ExtensionDefinitionService.DefinitionNotFoundException absent) { return List.of(); }
        String table = switch (hostType) { case "BRAND" -> "brand"; case "TENANT" -> "tenant"; case "HEAD_COMPANY" -> "head_company"; case "STORE" -> "store"; case "REGION", "PROJECT" -> "organization_node"; default -> throw new BusinessEntityService.OrganizationNotFoundException(); };
        String raw = jdbc.query("SELECT extension_values::text FROM organization." + table + " WHERE id=? AND workspace_uuid=? AND group_workspace_key=?", statement -> { statement.setObject(1, id); statement.setObject(2, workspaceUuid); statement.setString(3, key); }, result -> result.next() ? result.getString(1) : null);
        Map<String, String> values = jsonObject(raw);
        return definition.fields().stream().filter(field -> "ENABLED".equals(field.status())).sorted(java.util.Comparator.comparingInt(ExtensionDefinitionReadback.Field::displayOrder)).map(field -> new ExtensionDisplayField(field.label(), displayValue(values.get(field.fieldKey())))).toList();
    }

    private static Map<String, String> jsonObject(String source) {
        if (source == null) return Map.of();
        try { JsonNode node = JSON.readTree(source); if (!node.isObject()) throw new BusinessEntityService.OrganizationNotFoundException(); Map<String, String> values = new LinkedHashMap<>(); node.fields().forEachRemaining(entry -> values.put(entry.getKey(), entry.getValue().toString())); return Map.copyOf(values); }
        catch (java.io.IOException failure) { throw new BusinessEntityService.OrganizationNotFoundException(); }
    }

    private static String displayValue(String encoded) {
        if (encoded == null) return null;
        try { JsonNode value = JSON.readTree(encoded); return value.isValueNode() ? value.asText() : value.toString(); }
        catch (java.io.IOException failure) { throw new BusinessEntityService.OrganizationNotFoundException(); }
    }

    private static List<Reference> references(Array ids, Array codes, Array names) throws SQLException {
        Object[] idValues = (Object[]) ids.getArray();
        Object[] codeValues = (Object[]) codes.getArray();
        Object[] nameValues = (Object[]) names.getArray();
        List<Reference> values = new ArrayList<>(idValues.length);
        for (int index = 0; index < idValues.length; index++) values.add(new Reference((UUID) idValues[index], (String) codeValues[index], (String) nameValues[index], true));
        return List.copyOf(values);
    }

    private static List<Reference> append(List<Reference> path, Reference leaf) {
        if (path == null) throw new BusinessEntityService.OrganizationNotFoundException();
        List<Reference> values = new ArrayList<>(path); values.add(leaf); return List.copyOf(values);
    }

    private static String placeholders(int count) { return String.join(",", java.util.Collections.nCopies(count, "?")); }
    private static Item required(Item item) { if (item == null) throw new BusinessEntityService.OrganizationNotFoundException(); return item; }
    private static Item missing() { throw new BusinessEntityService.OrganizationNotFoundException(); }

    public record Query(String type, String name, String code, String legalName, String unifiedSocialCreditCode, String status, String source, UUID projectId, UUID brandId, UUID tenantId, UUID headCompanyId, String sort, String direction, UUID scopeNodeId) {
        public Query(String type, String name, String code, String legalName, String unifiedSocialCreditCode, String status, String source, UUID projectId, UUID brandId, UUID tenantId, String sort, String direction) { this(type, name, code, legalName, unifiedSocialCreditCode, status, source, projectId, brandId, tenantId, null, sort, direction, null); }
        public Query(String type, String name, String code, String legalName, String unifiedSocialCreditCode, String status, String source, UUID projectId, UUID brandId, UUID tenantId, String sort, String direction, UUID scopeNodeId) { this(type, name, code, legalName, unifiedSocialCreditCode, status, source, projectId, brandId, tenantId, null, sort, direction, scopeNodeId); }
        static Query empty() { return new Query(null, null, null, null, null, null, null, null, null, null, null, "UPDATED_AT", "DESC", null); }
        Query validated(String category) {
            String safeSort = sort == null ? "UPDATED_AT" : sort;
            String safeDirection = direction == null ? "DESC" : direction;
            if (!List.of("NAME", "CODE", "UPDATED_AT").contains(safeSort) || !List.of("ASC", "DESC").contains(safeDirection) || (status != null && !List.of("ENABLED", "DISABLED").contains(status)) || (source != null && !List.of("MANUAL", "SYSTEM").contains(source))) throw new IllegalArgumentException("invalid overview query");
            if ("HIERARCHY".equals(category)) { if (type != null && !List.of("REGION", "PROJECT").contains(type) || brandId != null || tenantId != null || headCompanyId != null) throw new IllegalArgumentException("invalid hierarchy query"); }
            else if ("BUSINESS_ENTITY".equals(category)) { if (type != null && !List.of("BRAND", "TENANT", "HEAD_COMPANY").contains(type) || projectId != null || brandId != null || tenantId != null || headCompanyId != null) throw new IllegalArgumentException("invalid entity query"); }
            else if ("STORE".equals(category)) { if (type != null && !"STORE".equals(type)) throw new IllegalArgumentException("invalid store query"); }
            else throw new IllegalArgumentException("unsupported overview category");
            if (!"BUSINESS_ENTITY".equals(category) && (legalName != null || unifiedSocialCreditCode != null)) throw new IllegalArgumentException("invalid overview query");
            if ("BUSINESS_ENTITY".equals(category) && ("BRAND".equals(type) && (legalName != null || unifiedSocialCreditCode != null))) throw new IllegalArgumentException("invalid brand legal query");
            return new Query(type, name, code, legalName, unifiedSocialCreditCode, status, source, projectId, brandId, tenantId, headCompanyId, safeSort, safeDirection, scopeNodeId);
        }
    }
    public record HierarchyTree(String groupCode, String groupName, List<TreeNode> regions) { }
    public record TreeNode(UUID id, String type, String code, String name, String status, String notes, long updatedAt, List<TreeNode> children, List<String> phases) { }
    private record TreeRow(UUID id, UUID parentId, String type, String code, String name, String status, String notes, long updatedAt, List<String> phases) { }
    public record Page(Metadata metadata, List<Item> items, String itemsSourceStatus, long itemsAsOf, List<String> itemsUnresolved, List<FilterOption> filterOptions, String filterOptionsSourceStatus, long filterOptionsAsOf, List<String> filterOptionsUnresolved) { }
    public record Metadata(String groupWorkspaceKey, String category, int page, int pageSize, long total, String sort, String direction) { }
    public record Item(UUID id, String groupWorkspaceKey, String category, String type, String code, String name, List<Reference> path, String status, String source, long version, long createdAt, long updatedAt, String notes, String legalName, String unifiedSocialCreditCode, Reference project, Reference brand, Reference tenant, Reference headCompany, List<String> unresolvedReferences, List<ExtensionDisplayField> extensionFields, String alias) { }
    public record ExtensionDisplayField(String name, String value) { }
    public record Reference(UUID id, String code, String name, boolean resolved) { }
    public record FilterOption(String kind, UUID id, String code, String name) { }
}
