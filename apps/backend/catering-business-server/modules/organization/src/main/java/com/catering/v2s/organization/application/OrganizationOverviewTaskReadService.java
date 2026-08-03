package com.catering.v2s.organization.application;

import com.catering.v2s.extension.api.ExtensionDefinitionLookup;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
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
    public OrganizationOverviewTaskReadService(JdbcTemplate jdbc) { this(jdbc, null); }
    @org.springframework.beans.factory.annotation.Autowired
    public OrganizationOverviewTaskReadService(JdbcTemplate jdbc, ExtensionDefinitionLookup definitions) { this.jdbc = jdbc; this.definitions = definitions; }

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
        List<Item> items = switch (category) {
            case "HIERARCHY" -> hierarchyPage(workspaceUuid, key, safeQuery, safeSize, offset);
            case "BUSINESS_ENTITY" -> entityPage(workspaceUuid, key, safeQuery, safeSize, offset);
            case "STORE" -> storePage(workspaceUuid, key, safeQuery, safeSize, offset);
            default -> throw new IllegalArgumentException("unsupported overview category");
        };
        long total = count(workspaceUuid, key, category, safeQuery);
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
        TreeRoot root = jdbc.query("SELECT commercial_group_code, commercial_group_name FROM organization.commercial_group WHERE group_workspace_key=?", statement -> statement.setString(1, key), result -> {
            if (!result.next()) throw new BusinessEntityService.OrganizationNotFoundException();
            return new TreeRoot(result.getString(1), result.getString(2));
        });
        List<TreeRow> baseRows = jdbc.query("SELECT id, parent_id, node_type, code, name, status, notes, updated_at_epoch_millis FROM organization.organization_node WHERE workspace_uuid=? AND group_workspace_key=? AND node_type IN ('REGION','PROJECT') ORDER BY node_type, code, id", (row, index) -> new TreeRow(row.getObject(1, UUID.class), row.getObject(2, UUID.class), row.getString(3), row.getString(4), row.getString(5), row.getString(6), row.getString(7), row.getLong(8), List.of()), workspaceUuid, key);
        Map<UUID, List<String>> phases = new LinkedHashMap<>();
        List<UUID> projectIds = baseRows.stream().filter(row -> "PROJECT".equals(row.type())).map(TreeRow::id).toList();
        if (!projectIds.isEmpty()) {
            List<PhaseRow> phaseRows = jdbc.query(
                "SELECT project_id, phase_name FROM organization.project_phase_name WHERE project_id IN (" + placeholders(projectIds.size()) + ") ORDER BY project_id, display_order",
                (row, index) -> new PhaseRow(row.getObject("project_id", UUID.class), row.getString("phase_name")),
                projectIds.toArray()
            );
            phaseRows.forEach(row -> phases.computeIfAbsent(row.projectId(), ignored -> new ArrayList<>()).add(row.name()));
        }
        List<TreeRow> rows = baseRows.stream().map(row -> new TreeRow(row.id(), row.parentId(), row.type(), row.code(), row.name(), row.status(), row.notes(), row.updatedAt(), phases.getOrDefault(row.id(), List.of()))).toList();
        Map<UUID, List<TreeRow>> projectsByRegion = new LinkedHashMap<>();
        rows.stream().filter(row -> "PROJECT".equals(row.type())).forEach(row -> projectsByRegion.computeIfAbsent(row.parentId(), ignored -> new ArrayList<>()).add(row));
        List<TreeNode> regions = rows.stream().filter(row -> "REGION".equals(row.type())).map(row -> treeNode(row, projectsByRegion.getOrDefault(row.id(), List.of()))).toList();
        return new HierarchyTree(root.code(), root.name(), regions);
    }

    private List<Item> hierarchyPage(UUID workspaceUuid, String key, Query query, int size, long offset) {
        String where = " WHERE workspace_uuid=? AND group_workspace_key=?" + baseFilters("", "node_type", query) + (query.projectId() == null ? "" : " AND node_type='PROJECT' AND id=?");
        List<Object> values = baseValues(workspaceUuid, key, query); if (query.projectId() != null) values.add(query.projectId()); values.add(size); values.add(offset);
        List<Item> rows = jdbc.query("SELECT id, node_type, code, name, status, version, created_at_epoch_millis, updated_at_epoch_millis, notes FROM organization.organization_node" + where + " ORDER BY " + hierarchyOrder(query) + " " + query.direction() + ", id DESC LIMIT ? OFFSET ?", (row, index) -> new Item(row.getObject(1, UUID.class), key, "HIERARCHY", row.getString(2), row.getString(3), row.getString(4), List.of(), row.getString(5), "MANUAL", row.getLong(6), row.getLong(7), row.getLong(8), row.getString(9), null, null, null, null, List.of(), List.of()), values.toArray());
        Map<UUID, List<Reference>> paths = nodePaths(workspaceUuid, key, rows.stream().map(Item::id).toList());
        return rows.stream().map(item -> withPath(item, paths.get(item.id()))).toList();
    }

    private List<Item> entityPage(UUID workspaceUuid, String key, Query query, int size, long offset) {
        String where = baseFilters("", "entity_type", query);
        List<Object> values = entityBaseValues(workspaceUuid, key, query); values.add(size); values.add(offset);
        return jdbc.query(entityRowsSql() + where + " ORDER BY " + entityOrder(query) + " " + query.direction() + ", id DESC LIMIT ? OFFSET ?", (row, index) -> entityItem(key, row), values.toArray());
    }

    private List<Item> storePage(UUID workspaceUuid, String key, Query query, int size, long offset) {
        String scopePredicate = visibleStorePredicate(query.scopeNodeId(), "s.id", "s.project_id");
        String where = baseFilters("s.", null, query) + scopePredicate + " AND (?::uuid IS NULL OR s.project_id=?) AND (?::uuid IS NULL OR s.brand_id=?) AND (?::uuid IS NULL OR s.tenant_id=?)";
        List<Object> values = baseValues(workspaceUuid, key, query);
        addVisibleStoreValues(values, workspaceUuid, key, query.scopeNodeId());
        values.add(query.projectId()); values.add(query.projectId()); values.add(query.brandId()); values.add(query.brandId()); values.add(query.tenantId()); values.add(query.tenantId()); values.add(size); values.add(offset);
        List<Item> rows = jdbc.query(storeRowsSql() + where + " ORDER BY " + storeOrder(query) + " " + query.direction() + ", s.id DESC LIMIT ? OFFSET ?", (row, index) -> storeItem(key, row, List.of()), values.toArray());
        Map<UUID, List<Reference>> paths = nodePaths(workspaceUuid, key, rows.stream().map(item -> item.project().id()).toList());
        return rows.stream().map(item -> withPath(item, append(paths.get(item.project().id()), new Reference(item.id(), item.code(), item.name(), true)))).toList();
    }

    private Item hierarchyDetail(UUID workspaceUuid, String key, UUID itemId) {
        String sql = "WITH RECURSIVE ancestry AS (" +
            "SELECT node.id AS target_id, node.id, node.parent_id, node.node_type, node.code, node.name, node.status, node.version, node.created_at_epoch_millis, node.updated_at_epoch_millis, node.notes, 0 AS depth FROM organization.organization_node node WHERE node.workspace_uuid=? AND node.group_workspace_key=? AND node.id=? " +
            "UNION ALL SELECT ancestry.target_id, parent.id, parent.parent_id, parent.node_type, parent.code, parent.name, parent.status, parent.version, parent.created_at_epoch_millis, parent.updated_at_epoch_millis, parent.notes, ancestry.depth + 1 FROM organization.organization_node parent JOIN ancestry ON ancestry.parent_id=parent.id WHERE parent.workspace_uuid=? AND parent.group_workspace_key=?" +
            ") SELECT target_id, max(node_type) FILTER (WHERE depth=0) AS node_type, max(code) FILTER (WHERE depth=0) AS code, max(name) FILTER (WHERE depth=0) AS name, max(status) FILTER (WHERE depth=0) AS status, max(version) FILTER (WHERE depth=0) AS version, max(created_at_epoch_millis) FILTER (WHERE depth=0) AS created_at, max(updated_at_epoch_millis) FILTER (WHERE depth=0) AS updated_at, max(notes) FILTER (WHERE depth=0) AS notes, array_agg(id ORDER BY depth DESC) AS path_ids, array_agg(code ORDER BY depth DESC) AS path_codes, array_agg(name ORDER BY depth DESC) AS path_names FROM ancestry GROUP BY target_id";
        Item item = jdbc.query(sql, statement -> { statement.setObject(1, workspaceUuid); statement.setString(2, key); statement.setObject(3, itemId); statement.setObject(4, workspaceUuid); statement.setString(5, key); }, result -> {
            if (!result.next()) return null;
            return new Item(result.getObject("target_id", UUID.class), key, "HIERARCHY", result.getString("node_type"), result.getString("code"), result.getString("name"), references(result.getArray("path_ids"), result.getArray("path_codes"), result.getArray("path_names")), result.getString("status"), "MANUAL", result.getLong("version"), result.getLong("created_at"), result.getLong("updated_at"), result.getString("notes"), null, null, null, null, List.of(), List.of());
        });
        Item required = required(item);
        return withExtensionFields(required, extensionFields(workspaceUuid, key, required.type(), required.id()));
    }

    private Item entityDetail(UUID workspaceUuid, String key, UUID itemId) {
        List<Item> items = jdbc.query(entityRowsSql() + " AND id=?", (row, index) -> entityItem(key, row), workspaceUuid, key, workspaceUuid, key, workspaceUuid, key, itemId);
        Item item = items.isEmpty() ? missing() : items.getFirst();
        return withExtensionFields(item, extensionFields(workspaceUuid, key, item.type(), item.id()));
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
            case "HIERARCHY" -> { String where = " WHERE workspace_uuid=? AND group_workspace_key=?" + baseFilters("", "node_type", query) + (query.projectId() == null ? "" : " AND node_type='PROJECT' AND id=?"); List<Object> values = baseValues(workspaceUuid, key, query); if (query.projectId() != null) values.add(query.projectId()); yield jdbc.queryForObject("SELECT count(*) FROM organization.organization_node" + where, Long.class, values.toArray()); }
            case "BUSINESS_ENTITY" -> { List<Object> values = entityBaseValues(workspaceUuid, key, query); yield jdbc.queryForObject("SELECT count(*) FROM (" + entityRowsSql() + baseFilters("", "entity_type", query) + ") entities_count", Long.class, values.toArray()); }
            case "STORE" -> { List<Object> values = baseValues(workspaceUuid, key, query); addVisibleStoreValues(values, workspaceUuid, key, query.scopeNodeId()); values.add(query.projectId()); values.add(query.projectId()); values.add(query.brandId()); values.add(query.brandId()); values.add(query.tenantId()); values.add(query.tenantId()); yield jdbc.queryForObject("SELECT count(*)" + storeRowsSql().substring(storeRowsSql().indexOf(" FROM")) + baseFilters("s.", null, query) + visibleStorePredicate(query.scopeNodeId(), "s.id", "s.project_id") + " AND (?::uuid IS NULL OR s.project_id=?) AND (?::uuid IS NULL OR s.brand_id=?) AND (?::uuid IS NULL OR s.tenant_id=?)", Long.class, values.toArray()); }
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
    private static List<Object> entityBaseValues(UUID workspaceUuid, String key, Query query) { List<Object> values = new ArrayList<>(); values.add(workspaceUuid); values.add(key); values.add(workspaceUuid); values.add(key); values.add(workspaceUuid); values.add(key); values.add(like(query.name())); values.add(like(query.name())); values.add(like(query.code())); values.add(like(query.code())); values.add(query.status()); values.add(query.status()); if (query.type() != null) values.add(query.type()); return values; }
    private static String hierarchyOrder(Query query) { return switch (query.sort()) { case "NAME" -> "name"; case "CODE" -> "code"; default -> "updated_at_epoch_millis"; }; }
    private static String entityOrder(Query query) { return switch (query.sort()) { case "NAME" -> "name"; case "CODE" -> "code"; default -> "updated_at_epoch_millis"; }; }
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
        return jdbc.query("SELECT kind, id, code, name FROM (SELECT 'PROJECT' AS kind, id, code, name FROM organization.organization_node WHERE workspace_uuid=? AND group_workspace_key=? AND node_type='PROJECT' UNION ALL SELECT 'BRAND', id, code, name FROM organization.brand WHERE workspace_uuid=? AND group_workspace_key=? UNION ALL SELECT 'TENANT', id, code, name FROM organization.tenant WHERE workspace_uuid=? AND group_workspace_key=?) options ORDER BY kind, code", (row, index) -> new FilterOption(row.getString(1), row.getObject(2, UUID.class), row.getString(3), row.getString(4)), workspaceUuid, key, workspaceUuid, key, workspaceUuid, key);
    }

    private static String entityRowsSql() {
        return "SELECT id, entity_type, code, name, status, version, created_at_epoch_millis, updated_at_epoch_millis, notes FROM (SELECT id, 'BRAND' AS entity_type, code, name, status, version, created_at_epoch_millis, updated_at_epoch_millis, remark AS notes FROM organization.brand WHERE workspace_uuid=? AND group_workspace_key=? UNION ALL SELECT id, 'TENANT', code, name, status, version, created_at_epoch_millis, updated_at_epoch_millis, remark FROM organization.tenant WHERE workspace_uuid=? AND group_workspace_key=? UNION ALL SELECT id, 'HEAD_COMPANY', code, name, status, version, created_at_epoch_millis, updated_at_epoch_millis, remark FROM organization.head_company WHERE workspace_uuid=? AND group_workspace_key=?) entities WHERE true";
    }

    private static String storeRowsSql() {
        return "SELECT s.id, s.code, s.name, s.status, s.version, s.created_at_epoch_millis, s.updated_at_epoch_millis, s.notes, p.id AS project_id, p.code AS project_code, p.name AS project_name, b.id AS brand_id, b.code AS brand_code, b.name AS brand_name, t.id AS tenant_id, t.code AS tenant_code, t.name AS tenant_name, h.id AS head_id, h.code AS head_code, h.name AS head_name FROM organization.store s JOIN organization.organization_node p ON p.id=s.project_id JOIN organization.brand b ON b.id=s.brand_id JOIN organization.tenant t ON t.id=s.tenant_id LEFT JOIN organization.head_company h ON h.id=s.head_company_id WHERE s.workspace_uuid=? AND s.group_workspace_key=?";
    }

    private static Item entityItem(String key, ResultSet row) throws SQLException {
        Reference self = new Reference(row.getObject(1, UUID.class), row.getString(3), row.getString(4), true);
        return new Item(self.id(), key, "BUSINESS_ENTITY", row.getString(2), self.code(), self.name(), List.of(self), row.getString(5), "MANUAL", row.getLong(6), row.getLong(7), row.getLong(8), row.getString(9), null, null, null, null, List.of(), List.of());
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
        return new Item(row.getObject("id", UUID.class), key, "STORE", "STORE", row.getString("code"), row.getString("name"), path, row.getString("status"), "MANUAL", row.getLong("version"), row.getLong("created_at_epoch_millis"), row.getLong("updated_at_epoch_millis"), row.getString("notes"), project, brand, tenant, head, List.of(), List.of());
    }

    private static Item withPath(Item item, List<Reference> path) {
        if (path == null) throw new BusinessEntityService.OrganizationNotFoundException();
        return new Item(item.id(), item.groupWorkspaceKey(), item.category(), item.type(), item.code(), item.name(), path, item.status(), item.source(), item.version(), item.createdAt(), item.updatedAt(), item.notes(), item.project(), item.brand(), item.tenant(), item.headCompany(), item.unresolvedReferences(), item.extensionFields());
    }

    private Item withExtensionFields(Item item, List<ExtensionDisplayField> fields) {
        return new Item(item.id(), item.groupWorkspaceKey(), item.category(), item.type(), item.code(), item.name(), item.path(), item.status(), item.source(), item.version(), item.createdAt(), item.updatedAt(), item.notes(), item.project(), item.brand(), item.tenant(), item.headCompany(), item.unresolvedReferences(), fields);
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

    public record Query(String type, String name, String code, String status, String source, UUID projectId, UUID brandId, UUID tenantId, String sort, String direction, UUID scopeNodeId) {
        public Query(String type, String name, String code, String status, String source, UUID projectId, UUID brandId, UUID tenantId, String sort, String direction) { this(type, name, code, status, source, projectId, brandId, tenantId, sort, direction, null); }
        static Query empty() { return new Query(null, null, null, null, null, null, null, null, "UPDATED_AT", "DESC", null); }
        Query validated(String category) {
            String safeSort = sort == null ? "UPDATED_AT" : sort;
            String safeDirection = direction == null ? "DESC" : direction;
            if (!List.of("NAME", "CODE", "UPDATED_AT").contains(safeSort) || !List.of("ASC", "DESC").contains(safeDirection) || (status != null && !List.of("ENABLED", "DISABLED").contains(status)) || (source != null && !List.of("MANUAL", "SYSTEM").contains(source))) throw new IllegalArgumentException("invalid overview query");
            if ("HIERARCHY".equals(category)) { if (type != null && !List.of("GROUP", "REGION", "PROJECT").contains(type) || brandId != null || tenantId != null) throw new IllegalArgumentException("invalid hierarchy query"); }
            else if ("BUSINESS_ENTITY".equals(category)) { if (type != null && !List.of("BRAND", "TENANT", "HEAD_COMPANY").contains(type) || projectId != null || brandId != null || tenantId != null) throw new IllegalArgumentException("invalid entity query"); }
            else if ("STORE".equals(category)) { if (type != null && !"STORE".equals(type)) throw new IllegalArgumentException("invalid store query"); }
            else throw new IllegalArgumentException("unsupported overview category");
            return new Query(type, name, code, status, source, projectId, brandId, tenantId, safeSort, safeDirection, scopeNodeId);
        }
    }
    public record HierarchyTree(String groupCode, String groupName, List<TreeNode> regions) { }
    public record TreeNode(UUID id, String type, String code, String name, String status, String notes, long updatedAt, List<TreeNode> children, List<String> phases) { }
    private record TreeRoot(String code, String name) { }
    private record PhaseRow(UUID projectId, String name) { }
    private record TreeRow(UUID id, UUID parentId, String type, String code, String name, String status, String notes, long updatedAt, List<String> phases) { }
    public record Page(Metadata metadata, List<Item> items, String itemsSourceStatus, long itemsAsOf, List<String> itemsUnresolved, List<FilterOption> filterOptions, String filterOptionsSourceStatus, long filterOptionsAsOf, List<String> filterOptionsUnresolved) { }
    public record Metadata(String groupWorkspaceKey, String category, int page, int pageSize, long total, String sort, String direction) { }
    public record Item(UUID id, String groupWorkspaceKey, String category, String type, String code, String name, List<Reference> path, String status, String source, long version, long createdAt, long updatedAt, String notes, Reference project, Reference brand, Reference tenant, Reference headCompany, List<String> unresolvedReferences, List<ExtensionDisplayField> extensionFields) { }
    public record ExtensionDisplayField(String name, String value) { }
    public record Reference(UUID id, String code, String name, boolean resolved) { }
    public record FilterOption(String kind, UUID id, String code, String name) { }
}
