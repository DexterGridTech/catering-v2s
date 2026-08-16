package com.catering.v2s.contract.application;

import com.catering.v2s.contract.api.OperationsStoreContractCommandApi;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read adapter for contract-owned screens. It may join organization facts, but intentionally owns neither those facts
 * nor their write invariants.
 */
@Service
public class ContractTaskReadService
        implements OperationsStoreContractCommandApi.TaskReadbackApi,
                OperationsStoreContractCommandApi.StoreStatusReadbackApi {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String VIEW_SELECT =
            "SELECT c.id, c.group_workspace_key, c.contract_no, p.id, p.code, p.name, c.store_id, s.code, s.name, "
                    + "c.tenant_id, t.code, t.name, c.phase_name_snapshot, c.notes, c.effective_from, c.effective_to, "
                    + "c.status, c.version, c.created_at_epoch_millis, c.updated_at_epoch_millis, "
                    + "c.extension_values::text, c.extension_rule_revision, c.items_json::text";
    private static final String VIEW_FROM =
            " FROM contract.store_contract c JOIN organization.store s ON s.id=c.store_id JOIN "
                    + "organization.organization_node p ON p.id=s.project_id JOIN organization.tenant t ON "
                    + "t.id=c.tenant_id";
    private final JdbcTemplate jdbc;
    private final BusinessDateProvider businessDate;

    public ContractTaskReadService(JdbcTemplate jdbc) {
        this(jdbc, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public ContractTaskReadService(JdbcTemplate jdbc, BusinessDateProvider businessDate) {
        this.jdbc = jdbc;
        this.businessDate = businessDate;
    }

    /** Contract-owner task read for the current store status; no contract table is exposed to an edge adapter. */
    @Transactional(readOnly = true)
    public String derivedStoreStatus(UUID workspaceUuid, String key, UUID storeId) {
        if (businessDate == null) throw new IllegalStateException("business date provider is required");
        return loadDerivedStoreStatusFacts(workspaceUuid, key, List.of(storeId), businessDate.today())
                .statusOf(storeId);
    }

    @Override
    @Transactional(readOnly = true)
    public OperationsStoreContractCommandApi.StoreDerivedStatusReadback readDerivedStoreStatus(
            OperationsStoreContractCommandApi.StoreStatusQuery query) {
        return new OperationsStoreContractCommandApi.StoreDerivedStatusReadback(
                derivedStoreStatus(query.workspaceUuid(), query.groupWorkspaceKey(), query.storeId()));
    }

    /** Contract-owner bounded batch status read for a caller's already paged stores. */
    @Transactional(readOnly = true)
    public Map<UUID, String> derivedStoreStatuses(UUID workspaceUuid, String key, List<UUID> requestedStoreIds) {
        if (businessDate == null) throw new IllegalStateException("business date provider is required");
        List<UUID> storeIds = requestedStoreIds == null
                ? List.of()
                : requestedStoreIds.stream().distinct().toList();
        if (storeIds.isEmpty()) return Map.of();
        return loadDerivedStoreStatusFacts(workspaceUuid, key, storeIds, businessDate.today())
                .statuses();
    }

    /**
     * A bounded contract-owner fact for one request's store ids. It keeps the three legal statuses in one CASE/FILTER
     * statement; callers cannot reuse it across a later write.
     */
    private DerivedStoreStatusFacts loadDerivedStoreStatusFacts(
            UUID workspaceUuid, String key, List<UUID> storeIds, LocalDate today) {
        return DerivedStoreStatusFacts.load(jdbc, workspaceUuid, key, storeIds, today);
    }

    /** Explicit task-read lookup; platform workspace remains the owner of workspace state. */
    @Transactional(readOnly = true)
    public UUID requireWorkspaceUuid(String key) {
        return jdbc.query(
                "SELECT workspace_uuid FROM platform_workspace.group_workspace WHERE group_workspace_key=?",
                statement -> statement.setString(1, key),
                result -> {
                    if (!result.next()) throw new ContractCommandService.ContractNotFoundException();
                    return result.getObject(1, UUID.class);
                });
    }

    @Transactional(readOnly = true)
    public CandidatePage candidates(
            UUID workspaceUuid, String key, UUID projectId, String search, int page, int pageSize) {
        return candidates(workspaceUuid, key, projectId, null, search, page, pageSize);
    }

    /**
     * Candidate read keeps the selected value visible even when pagination or a transient search term would otherwise
     * place it outside the current page. The selected row remains constrained by the same workspace/project owner
     * boundary; it is not a client-side fabricated option.
     */
    @Transactional(readOnly = true)
    public CandidatePage candidates(
            UUID workspaceUuid,
            String key,
            UUID projectId,
            UUID selectedStoreId,
            String search,
            int page,
            int pageSize) {
        Project project = jdbc.query(
                "SELECT id, code, name FROM organization.organization_node WHERE id=? AND workspace_uuid=? AND "
                        + "group_workspace_key=? AND node_type='PROJECT'",
                statement -> {
                    statement.setObject(1, projectId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                },
                result -> {
                    if (!result.next()) throw new ContractCommandService.ContractNotFoundException();
                    return new Project(result.getObject(1, UUID.class), result.getString(2), result.getString(3));
                });
        int safePage = Math.max(1, page);
        int safeSize = Math.min(100, Math.max(1, pageSize));
        String term = search == null ? "" : search.trim();
        String pattern = "%" + term.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
        List<StoreCandidate> stores = jdbc.query(
                "SELECT id, code, name, status FROM organization.store WHERE workspace_uuid=? AND "
                        + "group_workspace_key=? AND project_id=? AND (?='' OR code ILIKE ? ESCAPE '!' OR name ILIKE ? "
                        + "ESCAPE '!') ORDER BY code LIMIT ? OFFSET ?",
                (row, index) -> new StoreCandidate(
                        row.getObject(1, UUID.class), row.getString(2), row.getString(3), row.getString(4)),
                workspaceUuid,
                key,
                projectId,
                term,
                pattern,
                pattern,
                safeSize,
                (safePage - 1) * safeSize);
        if (selectedStoreId != null && stores.stream().noneMatch(store -> selectedStoreId.equals(store.id()))) {
            List<StoreCandidate> selected = jdbc.query(
                    "SELECT id, code, name, status FROM organization.store WHERE id=? AND workspace_uuid=? AND "
                            + "group_workspace_key=? AND project_id=?",
                    (row, index) -> new StoreCandidate(
                            row.getObject(1, UUID.class), row.getString(2), row.getString(3), row.getString(4)),
                    selectedStoreId,
                    workspaceUuid,
                    key,
                    projectId);
            if (!selected.isEmpty())
                stores = java.util.stream.Stream.concat(selected.stream(), stores.stream())
                        .distinct()
                        .toList();
        }
        long total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM organization.store WHERE workspace_uuid=? AND group_workspace_key=? AND "
                        + "project_id=? AND (?='' OR code ILIKE ? ESCAPE '!' OR name ILIKE ? ESCAPE '!')",
                Long.class,
                workspaceUuid,
                key,
                projectId,
                term,
                pattern,
                pattern);
        List<String> phases = jdbc.query(
                "SELECT phase_name FROM organization.project_phase_name WHERE project_id=? ORDER BY display_order",
                (row, index) -> row.getString(1),
                projectId);
        return new CandidatePage(
                key,
                project,
                new CandidateMetadata(term.isBlank() ? null : term, safePage, safeSize, total),
                stores,
                phases);
    }

    /** One contract-owner projection for the operations form; selected tenant is carried in the same statement. */
    @Transactional(readOnly = true)
    public CandidatePage operationsTaskCandidates(
            UUID workspaceUuid,
            String key,
            UUID projectId,
            UUID selectedStoreId,
            String search,
            int page,
            int pageSize) {
        int safePage = Math.max(1, page);
        int safeSize = Math.min(100, Math.max(1, pageSize));
        String term = search == null ? "" : search.trim();
        String pattern = "%" + term.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> jdbc.query(
                        """
            WITH project AS (SELECT id, code, name FROM organization.organization_node WHERE id=? AND workspace_uuid=? \
            AND group_workspace_key=? AND node_type='PROJECT'),
            filtered AS MATERIALIZED (SELECT s.id, s.code, s.name, s.status, COUNT(*) OVER () AS total FROM \
            organization.store s JOIN project p ON p.id=s.project_id WHERE s.workspace_uuid=? AND \
            s.group_workspace_key=? AND (?='' OR s.code ILIKE ? ESCAPE '!' OR s.name ILIKE ? ESCAPE '!')),
            paged AS (SELECT * FROM filtered ORDER BY code, id LIMIT ? OFFSET ?),
            selected AS (SELECT s.id, t.id AS tenant_id, t.code AS tenant_code, t.name AS tenant_name FROM \
            organization.store s JOIN organization.tenant t ON t.id=s.tenant_id JOIN project p ON p.id=s.project_id \
            WHERE s.id=? AND s.workspace_uuid=? AND s.group_workspace_key=?),
            phases AS (SELECT COALESCE(jsonb_agg(phase_name ORDER BY display_order), '[]'::jsonb)::text AS value FROM \
            organization.project_phase_name WHERE project_id=?)
            SELECT p.id, p.code, p.name, COALESCE((SELECT MAX(total) FROM paged), (SELECT COUNT(*) FROM filtered)),
                   selected.tenant_id, selected.tenant_code, selected.tenant_name,
                   COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'code', code, 'name', name, 'status', \
                   status) ORDER BY code, id) FROM paged), '[]'::jsonb)::text,
                   phases.value
            FROM project p CROSS JOIN phases LEFT JOIN selected ON TRUE
            """,
                        statement -> {
                            statement.setObject(1, projectId);
                            statement.setObject(2, workspaceUuid);
                            statement.setString(3, key);
                            statement.setObject(4, workspaceUuid);
                            statement.setString(5, key);
                            statement.setString(6, term);
                            statement.setString(7, pattern);
                            statement.setString(8, pattern);
                            statement.setInt(9, safeSize);
                            statement.setInt(10, (safePage - 1) * safeSize);
                            statement.setObject(11, selectedStoreId);
                            statement.setObject(12, workspaceUuid);
                            statement.setString(13, key);
                            statement.setObject(14, projectId);
                        },
                        result -> {
                            if (!result.next()) throw new ContractCommandService.ContractNotFoundException();
                            Project project = new Project(
                                    result.getObject(1, UUID.class), result.getString(2), result.getString(3));
                            SelectedTenant tenant = result.getObject(5) == null
                                    ? null
                                    : new SelectedTenant(
                                            result.getObject(5, UUID.class), result.getString(6), result.getString(7));
                            return new CandidatePage(
                                    key,
                                    project,
                                    new CandidateMetadata(
                                            term.isBlank() ? null : term, safePage, safeSize, result.getLong(4)),
                                    candidateStores(result.getString(8)),
                                    jsonStrings(result.getString(9)),
                                    tenant);
                        }));
    }

    @Transactional(readOnly = true)
    public List<StoreContractView> fixedStoreContracts(UUID workspaceUuid, String key, UUID storeId) {
        return jdbc.query(
                VIEW_SELECT + VIEW_FROM
                        + " WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.store_id=? ORDER BY "
                        + "c.contract_no",
                (row, index) -> readView(row),
                workspaceUuid,
                key,
                storeId);
    }

    /** Contract-owner fixed-store profile query: one business-date predicate supplies both total and page. */
    @Transactional(readOnly = true)
    public FixedStoreContractPage fixedStoreContractPage(
            UUID workspaceUuid, String key, UUID storeId, FixedStoreContractViewState state, int page, int pageSize) {
        if (businessDate == null) throw new IllegalStateException("business date provider is required");
        int safePage = Math.max(1, page);
        int safeSize = Math.min(100, Math.max(1, pageSize));
        LocalDate today = businessDate.today();
        String where = " WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.store_id=? AND "
                + fixedStoreViewPredicate(state);
        List<Object> values = fixedStoreViewParameters(workspaceUuid, key, storeId, state, today);
        long total = jdbc.queryForObject("SELECT COUNT(*)" + VIEW_FROM + where, Long.class, values.toArray());
        List<Object> paged = new java.util.ArrayList<>(values);
        paged.add(safeSize);
        paged.add((safePage - 1) * safeSize);
        List<StoreContractView> items = jdbc.query(
                VIEW_SELECT + VIEW_FROM + where + " ORDER BY c.contract_no LIMIT ? OFFSET ?",
                (row, index) -> readView(row),
                paged.toArray());
        Project project = jdbc.query(
                "SELECT p.id, p.code, p.name FROM organization.store s JOIN organization.organization_node p ON "
                        + "p.id=s.project_id WHERE s.id=? AND s.workspace_uuid=? AND s.group_workspace_key=?",
                statement -> {
                    statement.setObject(1, storeId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                },
                result -> {
                    if (!result.next()) throw new ContractCommandService.ContractNotFoundException();
                    return new Project(result.getObject(1, UUID.class), result.getString(2), result.getString(3));
                });
        return new FixedStoreContractPage(key, project, safePage, safeSize, total, items);
    }

    /** Explicit operations store-profile boundary; it remains wholly owned by the contract module. */
    @Transactional(readOnly = true)
    public FixedStoreContractPage operationsFixedStoreContractPage(
            UUID workspaceUuid, String key, UUID storeId, FixedStoreContractViewState state, int page, int pageSize) {
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> fixedStoreContractPage(workspaceUuid, key, storeId, state, page, pageSize));
    }

    /**
     * The sole contract list query for both administrative faces. Edges adapt their own request DTOs into this owner
     * vocabulary; they never recreate a second list predicate or count query.
     */
    @Transactional(readOnly = true)
    public ContractPage list(UUID workspaceUuid, String key, ContractListQuery query) {
        ContractListQuery safe = query == null ? ContractListQuery.empty() : query;
        Project project = safe.projectId() == null ? null : project(workspaceUuid, key, safe.projectId());
        if (safe.status() != null && !List.of("VALID", "INVALID").contains(safe.status()))
            throw new ContractCommandService.ContractValidationException();
        String normalizedStatus =
                "VALID".equals(safe.status()) ? "ACTIVE" : "INVALID".equals(safe.status()) ? "INVALID" : null;
        String sortKey = safe.sort() == null ? "UPDATED_AT" : safe.sort();
        if (!List.of("CONTRACT_NO", "EFFECTIVE_FROM", "UPDATED_AT").contains(sortKey)
                || (safe.direction() != null && !List.of("ASC", "DESC").contains(safe.direction())))
            throw new ContractCommandService.ContractValidationException();
        String order =
                switch (sortKey) {
                    case "CONTRACT_NO" -> "c.contract_no";
                    case "EFFECTIVE_FROM" -> "c.effective_from";
                    default -> "c.updated_at_epoch_millis";
                };
        String orderDirection = "ASC".equals(safe.direction()) ? "ASC" : "DESC";
        int safePage = Math.max(1, safe.page());
        int safeSize = Math.min(100, Math.max(1, safe.pageSize()));
        String where = " WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND (?::uuid IS NULL OR s.project_id=?)"
                + " AND (?::uuid IS NULL OR c.store_id=?) AND (?::uuid IS NULL OR c.tenant_id=?) AND (?::text IS NULL "
                + "OR c.contract_no ILIKE ? ESCAPE '!')"
                + " AND (?::text IS NULL OR c.phase_name_snapshot ILIKE ? ESCAPE '!')"
                + " AND (?::text IS NULL OR EXISTS (SELECT 1 FROM jsonb_array_elements(c.items_json) ci WHERE "
                + "ci->>'code' ILIKE ? ESCAPE '!'))"
                + " AND (?::date IS NULL OR c.effective_from>=?) AND (?::date IS NULL OR c.effective_to IS NULL OR "
                + "c.effective_to<=?) AND (?::text IS NULL OR c.status=?)";
        String contractPattern = like(safe.contractNo());
        String phasePattern = like(safe.phaseName());
        String itemPattern = like(safe.itemCode());
        List<Object> values = java.util.Arrays.asList(
                workspaceUuid,
                key,
                safe.projectId(),
                safe.projectId(),
                safe.storeId(),
                safe.storeId(),
                safe.tenantId(),
                safe.tenantId(),
                contractPattern,
                contractPattern,
                phasePattern,
                phasePattern,
                itemPattern,
                itemPattern,
                safe.dateFrom(),
                safe.dateFrom(),
                safe.dateTo(),
                safe.dateTo(),
                normalizedStatus,
                normalizedStatus);
        String from = " FROM contract.store_contract c JOIN organization.store s ON s.id=c.store_id JOIN "
                + "organization.organization_node p ON p.id=s.project_id JOIN organization.tenant t ON "
                + "t.id=c.tenant_id";
        long total = jdbc.queryForObject("SELECT COUNT(*)" + from + where, Long.class, values.toArray());
        List<Object> paged = new java.util.ArrayList<>(values);
        paged.add(safeSize);
        paged.add((safePage - 1) * safeSize);
        List<StoreContractView> items = jdbc.query(
                VIEW_SELECT + from + where + " ORDER BY " + order + " " + orderDirection
                        + ", c.id ASC LIMIT ? OFFSET ?",
                (row, index) -> readView(row),
                paged.toArray());
        return new ContractPage(
                new ContractPageMetadata(
                        key,
                        project == null ? null : project.id(),
                        project == null ? null : project.name(),
                        safePage,
                        safeSize,
                        total,
                        sortKey,
                        orderDirection),
                items);
    }

    /** Shared one-statement page projection for operations contracts and platform overview pages. */
    @Transactional(readOnly = true)
    public ContractPage operationsTaskPage(UUID workspaceUuid, String key, ContractListQuery query) {
        return taskPage(workspaceUuid, key, query);
    }

    /** Shared one-statement page projection for platform contract overview pages. */
    @Transactional(readOnly = true)
    public ContractPage platformOverviewTaskPage(UUID workspaceUuid, String key, ContractListQuery query) {
        return taskPage(workspaceUuid, key, query);
    }

    private ContractPage taskPage(UUID workspaceUuid, String key, ContractListQuery query) {
        ContractListQuery safe = query == null ? ContractListQuery.empty() : query;
        if (safe.status() != null && !List.of("VALID", "INVALID").contains(safe.status()))
            throw new ContractCommandService.ContractValidationException();
        String status = "VALID".equals(safe.status()) ? "ACTIVE" : "INVALID".equals(safe.status()) ? "INVALID" : null;
        String sort = safe.sort() == null ? "UPDATED_AT" : safe.sort();
        String direction = "ASC".equals(safe.direction()) ? "ASC" : "DESC";
        String order =
                switch (sort) {
                    case "CONTRACT_NO" -> "contract_no";
                    case "EFFECTIVE_FROM" -> "effective_from";
                    case "UPDATED_AT" -> "updated_at_epoch_millis";
                    default -> throw new ContractCommandService.ContractValidationException();
                };
        if (safe.direction() != null && !List.of("ASC", "DESC").contains(safe.direction()))
            throw new ContractCommandService.ContractValidationException();
        int page = Math.max(1, safe.page());
        int size = Math.min(100, Math.max(1, safe.pageSize()));
        String contract = like(safe.contractNo());
        String phase = like(safe.phaseName());
        String item = like(safe.itemCode());
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> jdbc.query(
                        ("""
            WITH project_meta AS (SELECT id, name FROM organization.organization_node WHERE ?::uuid IS NOT NULL AND \
            id=? AND workspace_uuid=? AND group_workspace_key=? AND node_type='PROJECT'),
            filtered AS MATERIALIZED (SELECT c.id AS contract_id, c.group_workspace_key, c.contract_no, p.id AS \
            project_id, p.code, p.name, c.store_id, s.code, s.name, c.tenant_id, t.code, t.name, \
            c.phase_name_snapshot, c.notes, c.effective_from, c.effective_to, c.status, c.version, \
            c.created_at_epoch_millis, c.updated_at_epoch_millis, c.extension_values::text, c.extension_rule_revision, \
            c.items_json::text, COUNT(*) OVER () AS total
            FROM contract.store_contract c JOIN organization.store s ON s.id=c.store_id JOIN \
            organization.organization_node p ON p.id=s.project_id JOIN organization.tenant t ON t.id=c.tenant_id
            WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND (?::uuid IS NULL OR s.project_id=?) AND (?::uuid \
            IS NULL OR c.store_id=?) AND (?::uuid IS NULL OR c.tenant_id=?) AND (?::text IS NULL OR c.contract_no \
            ILIKE ? ESCAPE '!') AND (?::text IS NULL OR c.phase_name_snapshot ILIKE ? ESCAPE '!') AND (?::text IS NULL \
            OR EXISTS (SELECT 1 FROM jsonb_array_elements(c.items_json) ci WHERE ci->>'code' ILIKE ? ESCAPE '!')) AND \
            (?::date IS NULL OR c.effective_from>=?) AND (?::date IS NULL OR c.effective_to IS NULL OR \
            c.effective_to<=?) AND (?::text IS NULL OR c.status=?)),
            paged AS (SELECT * FROM filtered ORDER BY __ORDER__ __DIRECTION__, contract_id ASC LIMIT ? OFFSET ?), \
            page_total AS (SELECT COALESCE(MAX(total), (SELECT COUNT(*) FROM filtered)) AS total FROM paged)
            SELECT paged.*, page_total.total, project_meta.id, project_meta.name FROM page_total LEFT JOIN paged ON \
            TRUE LEFT JOIN project_meta ON TRUE ORDER BY paged.__ORDER__ __DIRECTION__, paged.contract_id ASC
            """)
                                .replace("__ORDER__", order)
                                .replace("__DIRECTION__", direction),
                        statement -> {
                            statement.setObject(1, safe.projectId());
                            statement.setObject(2, safe.projectId());
                            statement.setObject(3, workspaceUuid);
                            statement.setString(4, key);
                            statement.setObject(5, workspaceUuid);
                            statement.setString(6, key);
                            statement.setObject(7, safe.projectId());
                            statement.setObject(8, safe.projectId());
                            statement.setObject(9, safe.storeId());
                            statement.setObject(10, safe.storeId());
                            statement.setObject(11, safe.tenantId());
                            statement.setObject(12, safe.tenantId());
                            statement.setString(13, contract);
                            statement.setString(14, contract);
                            statement.setString(15, phase);
                            statement.setString(16, phase);
                            statement.setString(17, item);
                            statement.setString(18, item);
                            statement.setObject(19, safe.dateFrom());
                            statement.setObject(20, safe.dateFrom());
                            statement.setObject(21, safe.dateTo());
                            statement.setObject(22, safe.dateTo());
                            statement.setString(23, status);
                            statement.setString(24, status);
                            statement.setInt(25, size);
                            statement.setInt(26, (page - 1) * size);
                        },
                        result -> {
                            List<StoreContractView> items = new java.util.ArrayList<>();
                            long total = 0;
                            UUID projectId = null;
                            String projectName = null;
                            while (result.next()) {
                                total = result.getLong(25);
                                projectId = result.getObject(26, UUID.class);
                                projectName = result.getString(27);
                                if (result.getObject(1) != null) items.add(readView(result));
                            }
                            if (safe.projectId() != null && projectId == null)
                                throw new ContractCommandService.ContractNotFoundException();
                            return new ContractPage(
                                    new ContractPageMetadata(
                                            key, projectId, projectName, page, size, total, sort, direction),
                                    List.copyOf(items));
                        }));
    }

    @Transactional(readOnly = true)
    public StoreContractView view(UUID workspaceUuid, String key, UUID contractId) {
        return queryView(workspaceUuid, key, contractId);
    }

    /** Contract-owned typed command readback; it does not expose an application task-view type. */
    @Override
    @Transactional(readOnly = true)
    public OperationsStoreContractCommandApi.StoreContractTaskReadback readTaskView(
            OperationsStoreContractCommandApi.TaskViewQuery query) {
        return taskReadback(queryView(query.workspaceUuid(), query.groupWorkspaceKey(), query.contractId()));
    }

    private StoreContractView queryView(UUID workspaceUuid, String key, UUID contractId) {
        return jdbc.query(
                VIEW_SELECT + VIEW_FROM + " WHERE c.id=? AND c.workspace_uuid=? AND c.group_workspace_key=?",
                statement -> {
                    statement.setObject(1, contractId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                },
                result -> {
                    if (!result.next()) throw new ContractCommandService.ContractNotFoundException();
                    return readView(result);
                });
    }

    @Transactional(readOnly = true)
    public StoreContractView operationsTaskView(UUID workspaceUuid, String key, UUID contractId) {
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY, () -> queryView(workspaceUuid, key, contractId));
    }

    @Transactional(readOnly = true)
    public StoreContractView platformOverviewTaskDetail(UUID workspaceUuid, String key, UUID contractId) {
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY, () -> queryView(workspaceUuid, key, contractId));
    }

    private static StoreContractView readView(java.sql.ResultSet result) throws java.sql.SQLException {
        List<Item> items = jsonItems(result.getString(23));
        return new StoreContractView(
                result.getObject(1, UUID.class),
                result.getString(2),
                new Reference(result.getObject(4, UUID.class), result.getString(5), result.getString(6)),
                new Reference(result.getObject(7, UUID.class), result.getString(8), result.getString(9)),
                new Reference(result.getObject(10, UUID.class), result.getString(11), result.getString(12)),
                result.getString(13),
                result.getString(3),
                result.getObject(15, LocalDate.class),
                result.getObject(16, LocalDate.class),
                result.getString(14),
                jsonObject(result.getString(21)),
                result.getLong(22),
                "ACTIVE".equals(result.getString(17)) ? "VALID" : "INVALID",
                result.getLong(18),
                "MANUAL",
                result.getLong(19),
                result.getLong(20),
                items,
                result.getString(13));
    }

    private static OperationsStoreContractCommandApi.StoreContractTaskReadback taskReadback(StoreContractView value) {
        return new OperationsStoreContractCommandApi.StoreContractTaskReadback(
                value.id(),
                value.groupWorkspaceKey(),
                reference(value.project()),
                reference(value.store()),
                reference(value.tenant()),
                value.phaseName(),
                value.contractNo(),
                value.effectiveFrom(),
                value.effectiveTo(),
                value.note(),
                value.extensionValues().entrySet().stream()
                        .map(entry ->
                                new OperationsStoreContractCommandApi.ExtensionValue(entry.getKey(), entry.getValue()))
                        .toList(),
                value.extensionRuleRevision(),
                value.status(),
                value.revision(),
                value.source(),
                value.createdAt(),
                value.updatedAt(),
                value.items().stream()
                        .map(item -> new OperationsStoreContractCommandApi.ItemReadback(item.code(), item.name()))
                        .toList(),
                value.phaseNameSnapshot());
    }

    private static OperationsStoreContractCommandApi.Reference reference(Reference value) {
        return new OperationsStoreContractCommandApi.Reference(value.id(), value.code(), value.name());
    }

    public record CandidatePage(
            String groupWorkspaceKey,
            Project project,
            CandidateMetadata metadata,
            List<StoreCandidate> stores,
            List<String> phases,
            SelectedTenant selectedTenant) {
        public CandidatePage(
                String groupWorkspaceKey,
                Project project,
                CandidateMetadata metadata,
                List<StoreCandidate> stores,
                List<String> phases) {
            this(groupWorkspaceKey, project, metadata, stores, phases, null);
        }
    }

    public record Project(UUID id, String code, String name) {}

    public record CandidateMetadata(String storeSearch, int page, int pageSize, long total) {}

    public record StoreCandidate(UUID id, String code, String name, String storeStatus) {}

    public record SelectedTenant(UUID id, String code, String name) {}

    public enum FixedStoreContractViewState {
        CURRENT,
        PENDING_EFFECTIVE,
        HISTORY,
        INVALID
    }

    public record FixedStoreContractPage(
            String groupWorkspaceKey,
            Project project,
            int page,
            int pageSize,
            long total,
            List<StoreContractView> items) {}

    public record StoreContractView(
            UUID id,
            String groupWorkspaceKey,
            Reference project,
            Reference store,
            Reference tenant,
            String phaseName,
            String contractNo,
            LocalDate effectiveFrom,
            LocalDate effectiveTo,
            String note,
            Map<String, String> extensionValues,
            long extensionRuleRevision,
            String status,
            long revision,
            String source,
            long createdAt,
            long updatedAt,
            List<Item> items,
            String phaseNameSnapshot) {}

    public record Reference(UUID id, String code, String name) {}

    public record Item(String code, String name) {}
    /** Complete owner filter vocabulary shared by platform and operations list adapters. */
    public record ContractListQuery(
            UUID projectId,
            UUID storeId,
            UUID tenantId,
            String contractNo,
            String phaseName,
            String itemCode,
            LocalDate dateFrom,
            LocalDate dateTo,
            String status,
            String sort,
            String direction,
            int page,
            int pageSize) {
        public static ContractListQuery empty() {
            return new ContractListQuery(
                    null, null, null, null, null, null, null, null, null, "UPDATED_AT", "DESC", 1, 50);
        }
    }

    public record ContractPage(ContractPageMetadata metadata, List<StoreContractView> items) {}

    public record ContractPageMetadata(
            String groupWorkspaceKey,
            UUID projectRef,
            String projectName,
            int page,
            int pageSize,
            long total,
            String sort,
            String direction) {}

    private Project project(UUID workspaceUuid, String key, UUID projectId) {
        return jdbc.query(
                "SELECT id, code, name FROM organization.organization_node WHERE id=? AND workspace_uuid=? AND "
                        + "group_workspace_key=? AND node_type='PROJECT'",
                statement -> {
                    statement.setObject(1, projectId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                },
                result -> {
                    if (!result.next()) throw new ContractCommandService.ContractNotFoundException();
                    return new Project(result.getObject(1, UUID.class), result.getString(2), result.getString(3));
                });
    }

    private static Map<String, String> jsonObject(String source) {
        try {
            JsonNode node = JSON.readTree(source);
            if (!node.isObject()) throw new ContractCommandService.ContractValidationException();
            Map<String, String> values = new LinkedHashMap<>();
            node.fields()
                    .forEachRemaining(
                            entry -> values.put(entry.getKey(), entry.getValue().toString()));
            return values;
        } catch (java.io.IOException failure) {
            throw new ContractCommandService.ContractValidationException(failure);
        }
    }

    private static List<StoreCandidate> candidateStores(String source) {
        try {
            List<StoreCandidate> values = new java.util.ArrayList<>();
            for (JsonNode node : JSON.readTree(source))
                values.add(new StoreCandidate(
                        UUID.fromString(node.path("id").asText()),
                        node.path("code").asText(),
                        node.path("name").asText(),
                        node.path("status").asText()));
            return List.copyOf(values);
        } catch (Exception failure) {
            throw new ContractCommandService.ContractValidationException(failure);
        }
    }

    private static List<String> jsonStrings(String source) {
        try {
            List<String> values = new java.util.ArrayList<>();
            for (JsonNode node : JSON.readTree(source)) values.add(node.asText());
            return List.copyOf(values);
        } catch (Exception failure) {
            throw new ContractCommandService.ContractValidationException(failure);
        }
    }

    private static List<Item> jsonItems(String source) {
        try {
            JsonNode node = JSON.readTree(source);
            if (!node.isArray()) throw new ContractCommandService.ContractValidationException();
            java.util.ArrayList<Item> values = new java.util.ArrayList<>();
            for (JsonNode item : node)
                values.add(
                        new Item(item.path("code").asText(), item.path("name").asText()));
            return List.copyOf(values);
        } catch (java.io.IOException failure) {
            throw new ContractCommandService.ContractValidationException(failure);
        }
    }

    private static String like(String value) {
        if (value == null || value.isBlank()) return null;
        return "%" + value.trim().replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
    }

    private static String fixedStoreViewPredicate(FixedStoreContractViewState state) {
        return switch (state) {
            case CURRENT -> "c.status='ACTIVE' AND c.effective_from<=? AND (c.effective_to IS NULL OR "
                    + "c.effective_to>=?)";
            case PENDING_EFFECTIVE -> "c.status='ACTIVE' AND c.effective_from>?";
            case HISTORY -> "c.status='ACTIVE' AND c.effective_to<?";
            case INVALID -> "c.status='INVALID'";
        };
    }

    private static List<Object> fixedStoreViewParameters(
            UUID workspaceUuid, String key, UUID storeId, FixedStoreContractViewState state, LocalDate today) {
        List<Object> values = new java.util.ArrayList<>(List.of(workspaceUuid, key, storeId));
        switch (state) {
            case CURRENT -> {
                values.add(today);
                values.add(today);
            }
            case PENDING_EFFECTIVE, HISTORY -> values.add(today);
            case INVALID -> {}
        }
        return values;
    }
}

/**
 * Bounded contract-owner fact: one CASE/FILTER statement resolves the three legal states for a fixed store-id set and
 * business date. It is never cached or shared across a later write.
 */
final class DerivedStoreStatusFacts {
    private final Map<UUID, String> statuses;

    private DerivedStoreStatusFacts(Map<UUID, String> statuses) {
        this.statuses = Map.copyOf(statuses);
    }

    static DerivedStoreStatusFacts load(
            JdbcTemplate jdbc, UUID workspaceUuid, String key, List<UUID> storeIds, LocalDate today) {
        Map<UUID, String> statuses = new LinkedHashMap<>();
        for (UUID storeId : storeIds) statuses.put(storeId, "NOT_OPERATING");
        jdbc.query(
                "SELECT store_id, CASE WHEN COUNT(*) FILTER (WHERE status='ACTIVE' AND effective_from<=? AND "
                        + "(effective_to IS NULL OR effective_to>=?))>0 THEN 'OPERATING' WHEN COUNT(*) FILTER (WHERE "
                        + "status='ACTIVE' AND effective_from>?)>0 THEN 'PREPARING' ELSE 'NOT_OPERATING' END AS "
                        + "derived_status FROM contract.store_contract WHERE workspace_uuid=? AND "
                        + "group_workspace_key=? "
                        + "AND store_id IN ("
                        + String.join(",", java.util.Collections.nCopies(storeIds.size(), "?")) + ") GROUP BY store_id",
                (row, index) -> {
                    statuses.put(row.getObject("store_id", UUID.class), row.getString("derived_status"));
                    return row.getString("derived_status");
                },
                orderedParameters(workspaceUuid, key, storeIds, today).toArray());
        return new DerivedStoreStatusFacts(statuses);
    }

    String statusOf(UUID storeId) {
        return statuses.getOrDefault(storeId, "NOT_OPERATING");
    }

    Map<UUID, String> statuses() {
        return statuses;
    }

    private static List<Object> orderedParameters(
            UUID workspaceUuid, String key, List<UUID> storeIds, LocalDate today) {
        List<Object> values = new java.util.ArrayList<>();
        values.add(today);
        values.add(today);
        values.add(today);
        values.add(workspaceUuid);
        values.add(key);
        values.addAll(storeIds);
        return values;
    }
}
