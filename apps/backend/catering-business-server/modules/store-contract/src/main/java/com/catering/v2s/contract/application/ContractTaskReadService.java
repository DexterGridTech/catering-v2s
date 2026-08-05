package com.catering.v2s.contract.application;

import java.time.LocalDate;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read adapter for contract-owned screens.  It may join organization facts, but
 * intentionally owns neither those facts nor their write invariants.
 */
@Service
public class ContractTaskReadService {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String VIEW_SELECT = "SELECT c.id, c.group_workspace_key, c.contract_no, p.id, p.code, p.name, c.store_id, s.code, s.name, c.tenant_id, t.code, t.name, c.phase_name_snapshot, c.notes, c.effective_from, c.effective_to, c.status, c.version, c.created_at_epoch_millis, c.updated_at_epoch_millis, c.extension_values::text, c.extension_rule_revision, c.items_json::text";
    private static final String VIEW_FROM = " FROM contract.store_contract c JOIN organization.store s ON s.id=c.store_id JOIN organization.organization_node p ON p.id=s.project_id JOIN organization.tenant t ON t.id=c.tenant_id";
    private final JdbcTemplate jdbc;
    private final BusinessDateProvider businessDate;

    public ContractTaskReadService(JdbcTemplate jdbc) { this(jdbc, null); }
    @org.springframework.beans.factory.annotation.Autowired
    public ContractTaskReadService(JdbcTemplate jdbc, BusinessDateProvider businessDate) { this.jdbc = jdbc; this.businessDate = businessDate; }

    /** Contract-owner task read for the current store status; no contract table is exposed to an edge adapter. */
    @Transactional(readOnly = true)
    public String derivedStoreStatus(UUID workspaceUuid, String key, UUID storeId) {
        if (businessDate == null) throw new IllegalStateException("business date provider is required");
        LocalDate today = businessDate.today();
        int operating = jdbc.queryForObject("SELECT COUNT(*) FROM contract.store_contract WHERE workspace_uuid=? AND group_workspace_key=? AND store_id=? AND status='ACTIVE' AND effective_from<=? AND (effective_to IS NULL OR effective_to>=?)", Integer.class, workspaceUuid, key, storeId, today, today);
        if (operating > 0) return "OPERATING";
        int preparing = jdbc.queryForObject("SELECT COUNT(*) FROM contract.store_contract WHERE workspace_uuid=? AND group_workspace_key=? AND store_id=? AND status='ACTIVE' AND effective_from>?", Integer.class, workspaceUuid, key, storeId, today);
        return preparing > 0 ? "PREPARING" : "NOT_OPERATING";
    }

    /** Contract-owner bounded batch status read for a caller's already paged stores. */
    @Transactional(readOnly = true)
    public Map<UUID, String> derivedStoreStatuses(UUID workspaceUuid, String key, List<UUID> requestedStoreIds) {
        if (businessDate == null) throw new IllegalStateException("business date provider is required");
        List<UUID> storeIds = requestedStoreIds == null ? List.of() : requestedStoreIds.stream().distinct().toList();
        if (storeIds.isEmpty()) return Map.of();
        Map<UUID, String> statuses = new LinkedHashMap<>();
        for (UUID storeId : storeIds) statuses.put(storeId, "NOT_OPERATING");
        LocalDate today = businessDate.today();
        List<Object> parameters = new java.util.ArrayList<>();
        parameters.add(workspaceUuid); parameters.add(key); parameters.addAll(storeIds); parameters.add(today); parameters.add(today); parameters.add(today);
        jdbc.query(
            "SELECT store_id, CASE WHEN COUNT(*) FILTER (WHERE status='ACTIVE' AND effective_from<=? AND (effective_to IS NULL OR effective_to>=?))>0 THEN 'OPERATING' WHEN COUNT(*) FILTER (WHERE status='ACTIVE' AND effective_from>?)>0 THEN 'PREPARING' ELSE 'NOT_OPERATING' END AS derived_status FROM contract.store_contract WHERE workspace_uuid=? AND group_workspace_key=? AND store_id IN (" + String.join(",", java.util.Collections.nCopies(storeIds.size(), "?")) + ") GROUP BY store_id",
            (row, index) -> {
                statuses.put(row.getObject("store_id", UUID.class), row.getString("derived_status"));
                return row.getString("derived_status");
            },
            orderedStatusParameters(workspaceUuid, key, storeIds, today).toArray()
        );
        return Map.copyOf(statuses);
    }

    /** Explicit task-read lookup; platform workspace remains the owner of workspace state. */
    @Transactional(readOnly = true)
    public UUID requireWorkspaceUuid(String key) {
        return jdbc.query("SELECT workspace_uuid FROM platform_workspace.group_workspace WHERE group_workspace_key=?", statement -> statement.setString(1, key), result -> {
            if (!result.next()) throw new ContractCommandService.ContractNotFoundException();
            return result.getObject(1, UUID.class);
        });
    }

    @Transactional(readOnly = true)
    public CandidatePage candidates(UUID workspaceUuid, String key, UUID projectId, String search, int page, int pageSize) {
        return candidates(workspaceUuid, key, projectId, null, search, page, pageSize);
    }

    /**
     * Candidate read keeps the selected value visible even when pagination or a
     * transient search term would otherwise place it outside the current page.
     * The selected row remains constrained by the same workspace/project owner
     * boundary; it is not a client-side fabricated option.
     */
    @Transactional(readOnly = true)
    public CandidatePage candidates(UUID workspaceUuid, String key, UUID projectId, UUID selectedStoreId, String search, int page, int pageSize) {
        Project project = jdbc.query("SELECT id, code, name FROM organization.organization_node WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND node_type='PROJECT'", statement -> { statement.setObject(1, projectId); statement.setObject(2, workspaceUuid); statement.setString(3, key); }, result -> {
            if (!result.next()) throw new ContractCommandService.ContractNotFoundException();
            return new Project(result.getObject(1, UUID.class), result.getString(2), result.getString(3));
        });
        int safePage = Math.max(1, page); int safeSize = Math.min(100, Math.max(1, pageSize));
        String term = search == null ? "" : search.trim(); String pattern = "%" + term.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
        List<StoreCandidate> stores = jdbc.query("SELECT id, code, name, status FROM organization.store WHERE workspace_uuid=? AND group_workspace_key=? AND project_id=? AND (?='' OR code ILIKE ? ESCAPE '!' OR name ILIKE ? ESCAPE '!') ORDER BY code LIMIT ? OFFSET ?", (row, index) -> new StoreCandidate(row.getObject(1, UUID.class), row.getString(2), row.getString(3), row.getString(4)), workspaceUuid, key, projectId, term, pattern, pattern, safeSize, (safePage - 1) * safeSize);
        if (selectedStoreId != null && stores.stream().noneMatch(store -> selectedStoreId.equals(store.id()))) {
            List<StoreCandidate> selected = jdbc.query("SELECT id, code, name, status FROM organization.store WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND project_id=?", (row, index) -> new StoreCandidate(row.getObject(1, UUID.class), row.getString(2), row.getString(3), row.getString(4)), selectedStoreId, workspaceUuid, key, projectId);
            if (!selected.isEmpty()) stores = java.util.stream.Stream.concat(selected.stream(), stores.stream()).distinct().toList();
        }
        long total = jdbc.queryForObject("SELECT COUNT(*) FROM organization.store WHERE workspace_uuid=? AND group_workspace_key=? AND project_id=? AND (?='' OR code ILIKE ? ESCAPE '!' OR name ILIKE ? ESCAPE '!')", Long.class, workspaceUuid, key, projectId, term, pattern, pattern);
        List<String> phases = jdbc.query("SELECT phase_name FROM organization.project_phase_name WHERE project_id=? ORDER BY display_order", (row, index) -> row.getString(1), projectId);
        return new CandidatePage(key, project, new CandidateMetadata(term.isBlank() ? null : term, safePage, safeSize, total), stores, phases);
    }

    @Transactional(readOnly = true)
    public List<StoreContractView> fixedStoreContracts(UUID workspaceUuid, String key, UUID storeId) {
        return jdbc.query(VIEW_SELECT + VIEW_FROM + " WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.store_id=? ORDER BY c.contract_no", (row, index) -> readView(row), workspaceUuid, key, storeId);
    }

    /** Contract-owner fixed-store profile query: one business-date predicate supplies both total and page. */
    @Transactional(readOnly = true)
    public FixedStoreContractPage fixedStoreContractPage(UUID workspaceUuid, String key, UUID storeId, FixedStoreContractViewState state, int page, int pageSize) {
        if (businessDate == null) throw new IllegalStateException("business date provider is required");
        int safePage = Math.max(1, page); int safeSize = Math.min(100, Math.max(1, pageSize));
        LocalDate today = businessDate.today();
        String where = " WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.store_id=? AND " + fixedStoreViewPredicate(state);
        List<Object> values = fixedStoreViewParameters(workspaceUuid, key, storeId, state, today);
        long total = jdbc.queryForObject("SELECT COUNT(*)" + VIEW_FROM + where, Long.class, values.toArray());
        List<Object> paged = new java.util.ArrayList<>(values); paged.add(safeSize); paged.add((safePage - 1) * safeSize);
        List<StoreContractView> items = jdbc.query(VIEW_SELECT + VIEW_FROM + where + " ORDER BY c.contract_no LIMIT ? OFFSET ?", (row, index) -> readView(row), paged.toArray());
        Project project = jdbc.query("SELECT p.id, p.code, p.name FROM organization.store s JOIN organization.organization_node p ON p.id=s.project_id WHERE s.id=? AND s.workspace_uuid=? AND s.group_workspace_key=?", statement -> { statement.setObject(1, storeId); statement.setObject(2, workspaceUuid); statement.setString(3, key); }, result -> {
            if (!result.next()) throw new ContractCommandService.ContractNotFoundException();
            return new Project(result.getObject(1, UUID.class), result.getString(2), result.getString(3));
        });
        return new FixedStoreContractPage(key, project, safePage, safeSize, total, items);
    }

    /**
     * The sole contract list query for both administrative faces.  Edges adapt
     * their own request DTOs into this owner vocabulary; they never recreate a
     * second list predicate or count query.
     */
    @Transactional(readOnly = true)
    public ContractPage list(UUID workspaceUuid, String key, ContractListQuery query) {
        ContractListQuery safe = query == null ? ContractListQuery.empty() : query;
        Project project = safe.projectId() == null ? null : project(workspaceUuid, key, safe.projectId());
        if (safe.status() != null && !List.of("VALID", "INVALID").contains(safe.status())) throw new ContractCommandService.ContractValidationException();
        String normalizedStatus = "VALID".equals(safe.status()) ? "ACTIVE" : "INVALID".equals(safe.status()) ? "INVALID" : null;
        String sortKey = safe.sort() == null ? "UPDATED_AT" : safe.sort();
        if (!List.of("CONTRACT_NO", "EFFECTIVE_FROM", "UPDATED_AT").contains(sortKey) || (safe.direction() != null && !List.of("ASC", "DESC").contains(safe.direction()))) throw new ContractCommandService.ContractValidationException();
        String order = switch (sortKey) { case "CONTRACT_NO" -> "c.contract_no"; case "EFFECTIVE_FROM" -> "c.effective_from"; default -> "c.updated_at_epoch_millis"; };
        String orderDirection = "ASC".equals(safe.direction()) ? "ASC" : "DESC";
        int safePage = Math.max(1, safe.page()); int safeSize = Math.min(100, Math.max(1, safe.pageSize()));
        String where = " WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND (?::uuid IS NULL OR s.project_id=?)"
                + " AND (?::uuid IS NULL OR c.store_id=?) AND (?::uuid IS NULL OR c.tenant_id=?) AND (?::text IS NULL OR c.contract_no ILIKE ? ESCAPE '!')"
                + " AND (?::text IS NULL OR c.phase_name_snapshot ILIKE ? ESCAPE '!')"
                + " AND (?::text IS NULL OR EXISTS (SELECT 1 FROM jsonb_array_elements(c.items_json) ci WHERE ci->>'code' ILIKE ? ESCAPE '!'))"
                + " AND (?::date IS NULL OR c.effective_from>=?) AND (?::date IS NULL OR c.effective_to IS NULL OR c.effective_to<=?) AND (?::text IS NULL OR c.status=?)";
        String contractPattern = like(safe.contractNo()); String phasePattern = like(safe.phaseName()); String itemPattern = like(safe.itemCode());
        List<Object> values = java.util.Arrays.asList(workspaceUuid, key, safe.projectId(), safe.projectId(), safe.storeId(), safe.storeId(), safe.tenantId(), safe.tenantId(), contractPattern, contractPattern, phasePattern, phasePattern, itemPattern, itemPattern, safe.dateFrom(), safe.dateFrom(), safe.dateTo(), safe.dateTo(), normalizedStatus, normalizedStatus);
        String from = " FROM contract.store_contract c JOIN organization.store s ON s.id=c.store_id JOIN organization.organization_node p ON p.id=s.project_id JOIN organization.tenant t ON t.id=c.tenant_id";
        long total = jdbc.queryForObject("SELECT COUNT(*)" + from + where, Long.class, values.toArray());
        List<Object> paged = new java.util.ArrayList<>(values); paged.add(safeSize); paged.add((safePage - 1) * safeSize);
        List<StoreContractView> items = jdbc.query(VIEW_SELECT + from + where + " ORDER BY " + order + " " + orderDirection + ", c.id ASC LIMIT ? OFFSET ?", (row, index) -> readView(row), paged.toArray());
        return new ContractPage(new ContractPageMetadata(key, project == null ? null : project.id(), project == null ? null : project.name(), safePage, safeSize, total, sortKey, orderDirection), items);
    }

    @Transactional(readOnly = true)
    public StoreContractView view(UUID workspaceUuid, String key, UUID contractId) {
        return jdbc.query(VIEW_SELECT + VIEW_FROM + " WHERE c.id=? AND c.workspace_uuid=? AND c.group_workspace_key=?", statement -> { statement.setObject(1, contractId); statement.setObject(2, workspaceUuid); statement.setString(3, key); }, result -> {
            if (!result.next()) throw new ContractCommandService.ContractNotFoundException();
            return readView(result);
        });
    }

    private static StoreContractView readView(java.sql.ResultSet result) throws java.sql.SQLException {
        List<Item> items = jsonItems(result.getString(23));
        return new StoreContractView(result.getObject(1, UUID.class), result.getString(2), new Reference(result.getObject(4, UUID.class), result.getString(5), result.getString(6)), new Reference(result.getObject(7, UUID.class), result.getString(8), result.getString(9)), new Reference(result.getObject(10, UUID.class), result.getString(11), result.getString(12)), result.getString(13), result.getString(3), result.getObject(15, LocalDate.class), result.getObject(16, LocalDate.class), result.getString(14), jsonObject(result.getString(21)), result.getLong(22), "ACTIVE".equals(result.getString(17)) ? "VALID" : "INVALID", result.getLong(18), "MANUAL", result.getLong(19), result.getLong(20), items, result.getString(13));
    }

    public record CandidatePage(String groupWorkspaceKey, Project project, CandidateMetadata metadata, List<StoreCandidate> stores, List<String> phases) { }
    public record Project(UUID id, String code, String name) { }
    public record CandidateMetadata(String storeSearch, int page, int pageSize, long total) { }
    public record StoreCandidate(UUID id, String code, String name, String storeStatus) { }
    public enum FixedStoreContractViewState { CURRENT, PENDING_EFFECTIVE, HISTORY, INVALID }
    public record FixedStoreContractPage(String groupWorkspaceKey, Project project, int page, int pageSize, long total, List<StoreContractView> items) { }
    public record StoreContractView(UUID id, String groupWorkspaceKey, Reference project, Reference store, Reference tenant, String phaseName, String contractNo, LocalDate effectiveFrom, LocalDate effectiveTo, String note, Map<String, String> extensionValues, long extensionRuleRevision, String status, long revision, String source, long createdAt, long updatedAt, List<Item> items, String phaseNameSnapshot) { }
    public record Reference(UUID id, String code, String name) { }
    public record Item(String code, String name) { }
    /** Complete owner filter vocabulary shared by platform and operations list adapters. */
    public record ContractListQuery(UUID projectId, UUID storeId, UUID tenantId, String contractNo, String phaseName, String itemCode, LocalDate dateFrom, LocalDate dateTo, String status, String sort, String direction, int page, int pageSize) {
        public static ContractListQuery empty() { return new ContractListQuery(null, null, null, null, null, null, null, null, null, "UPDATED_AT", "DESC", 1, 50); }
    }
    public record ContractPage(ContractPageMetadata metadata, List<StoreContractView> items) { }
    public record ContractPageMetadata(String groupWorkspaceKey, UUID projectRef, String projectName, int page, int pageSize, long total, String sort, String direction) { }
    private Project project(UUID workspaceUuid, String key, UUID projectId) { return jdbc.query("SELECT id, code, name FROM organization.organization_node WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND node_type='PROJECT'", statement -> { statement.setObject(1, projectId); statement.setObject(2, workspaceUuid); statement.setString(3, key); }, result -> { if (!result.next()) throw new ContractCommandService.ContractNotFoundException(); return new Project(result.getObject(1, UUID.class), result.getString(2), result.getString(3)); }); }
    private static Map<String, String> jsonObject(String source) { try { JsonNode node = JSON.readTree(source); if (!node.isObject()) throw new ContractCommandService.ContractValidationException(); Map<String, String> values = new LinkedHashMap<>(); node.fields().forEachRemaining(entry -> values.put(entry.getKey(), entry.getValue().toString())); return values; } catch (java.io.IOException failure) { throw new ContractCommandService.ContractValidationException(); } }
    private static List<Item> jsonItems(String source) { try { JsonNode node = JSON.readTree(source); if (!node.isArray()) throw new ContractCommandService.ContractValidationException(); java.util.ArrayList<Item> values = new java.util.ArrayList<>(); for (JsonNode item : node) values.add(new Item(item.path("code").asText(), item.path("name").asText())); return List.copyOf(values); } catch (java.io.IOException failure) { throw new ContractCommandService.ContractValidationException(); } }
    private static String like(String value) { if (value == null || value.isBlank()) return null; return "%" + value.trim().replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%"; }
    private static String fixedStoreViewPredicate(FixedStoreContractViewState state) { return switch (state) {
        case CURRENT -> "c.status='ACTIVE' AND c.effective_from<=? AND (c.effective_to IS NULL OR c.effective_to>=?)";
        case PENDING_EFFECTIVE -> "c.status='ACTIVE' AND c.effective_from>?";
        case HISTORY -> "c.status='ACTIVE' AND c.effective_to<?";
        case INVALID -> "c.status='INVALID'";
    }; }
    private static List<Object> fixedStoreViewParameters(UUID workspaceUuid, String key, UUID storeId, FixedStoreContractViewState state, LocalDate today) {
        List<Object> values = new java.util.ArrayList<>(List.of(workspaceUuid, key, storeId));
        switch (state) { case CURRENT -> { values.add(today); values.add(today); } case PENDING_EFFECTIVE, HISTORY -> values.add(today); case INVALID -> { } }
        return values;
    }
    private static List<Object> orderedStatusParameters(UUID workspaceUuid, String key, List<UUID> storeIds, LocalDate today) {
        List<Object> values = new java.util.ArrayList<>();
        values.add(today); values.add(today); values.add(today); values.add(workspaceUuid); values.add(key); values.addAll(storeIds);
        return values;
    }
}
