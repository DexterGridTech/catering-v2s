package com.catering.v2s.contract.application.persistence;

import com.catering.v2s.contract.api.OperationsStoreContractCommandApi;
import com.catering.v2s.contract.application.ContractCommandService;
import com.catering.v2s.contract.application.ContractTaskReadService;
import com.catering.v2s.contract.application.ContractTaskReadService.CandidateMetadata;
import com.catering.v2s.contract.application.ContractTaskReadService.CandidatePage;
import com.catering.v2s.contract.application.ContractTaskReadService.ContractListQuery;
import com.catering.v2s.contract.application.ContractTaskReadService.ContractPage;
import com.catering.v2s.contract.application.ContractTaskReadService.ContractPageMetadata;
import com.catering.v2s.contract.application.ContractTaskReadService.FixedStoreContractPage;
import com.catering.v2s.contract.application.ContractTaskReadService.FixedStoreContractViewState;
import com.catering.v2s.contract.application.ContractTaskReadService.Item;
import com.catering.v2s.contract.application.ContractTaskReadService.Project;
import com.catering.v2s.contract.application.ContractTaskReadService.Reference;
import com.catering.v2s.contract.application.ContractTaskReadService.SelectedTenant;
import com.catering.v2s.contract.application.ContractTaskReadService.StoreCandidate;
import com.catering.v2s.contract.application.ContractTaskReadService.StoreContractView;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC execution boundary for contract task-read projections and their business filters. */
@Repository
public class ContractTaskReadPersistence {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String VIEW_SELECT =
            ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_SELECT_GROUP_WORKSPACE_KEY_CONTRACT_NO_CODE_NAME
                    + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CONTINUATION_TENANT_ID_CODE_NAME_PHASE_NAME_SNAPSHOT
                    + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CONTINUATION_STATUS
                    + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CONTINUATION_EXTENSION_VALUES_TEXT_EXTENSION_RULE_REVISION_ITEMS_JSON;
    private static final String VIEW_FROM =
            ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_FROM_CLAUSE_STORE_STORE_ID
                    + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_ALTERNATIVE_TENANT_ORGANIZATION_NODE_PROJECT_ID
                    + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CONTINUATION_TENANT_ID;
    private final JdbcTemplate jdbc;

    public ContractTaskReadPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public UUID requireWorkspaceUuid(String key) {
        return jdbc.query(
                ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_SELECT_GROUP_WORKSPACE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
                statement -> statement.setString(1, key),
                result -> {
                    if (!result.next()) throw new ContractCommandService.ContractNotFoundException();
                    return result.getObject(1, UUID.class);
                });
    }

    public CandidatePage candidates(
            UUID workspaceUuid, String key, UUID projectId, UUID selectedStoreId, String search, int page, int pageSize) {
        Project project = project(workspaceUuid, key, projectId);
        int safePage = Math.max(1, page);
        int safeSize = Math.min(100, Math.max(1, pageSize));
        String term = search == null ? "" : search.trim();
        String pattern = likeSearch(term);
        List<StoreCandidate> stores = jdbc.query(
                ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_SELECT_STORE_CODE_NAME_STATUS_WORKSPACE_UUID
                        + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_PROJECT_ID_CODE_ILIKE
                        + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CONTINUATION_ESCAPE_CODE,
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
                    ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_SELECT_STORE_CODE_NAME_STATUS_WORKSPACE_UUID_ALTERNATE_A
                            + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_PROJECT_ID,
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
                ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_SELECT_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CONTINUATION_PROJECT_ID_CODE_ILIKE_ESCAPE,
                Long.class,
                workspaceUuid,
                key,
                projectId,
                term,
                pattern,
                pattern);
        List<String> phases = jdbc.query(
                ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_SELECT_PROJECT_PHASE_NAME_PHASE_NAME_PROJECT_ID_DISPLAY_ORDER,
                (row, index) -> row.getString(1),
                projectId);
        return new CandidatePage(
                key,
                project,
                new CandidateMetadata(term.isBlank() ? null : term, safePage, safeSize, total),
                stores,
                phases);
    }

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
        String pattern = likeSearch(term);
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> jdbc.query(
                        ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CTE_SELECTED_CODE_NAME_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
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

    public List<StoreContractView> fixedStoreContracts(UUID workspaceUuid, String key, UUID storeId) {
        return jdbc.query(
                VIEW_SELECT + VIEW_FROM
                        + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STORE_ID
                        + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CONTINUATION_CONTRACT_NO,
                (row, index) -> readView(row),
                workspaceUuid,
                key,
                storeId);
    }

    public FixedStoreContractPage fixedStoreContractPage(
            UUID workspaceUuid, String key, UUID storeId, FixedStoreContractViewState state, int page, int pageSize,
            LocalDate today) {
        int safePage = Math.max(1, page);
        int safeSize = Math.min(100, Math.max(1, pageSize));
        String where = ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STORE_ID_ALTERNATE_A + fixedStoreViewPredicate(state);
        List<Object> values = fixedStoreViewParameters(workspaceUuid, key, storeId, state, today);
        long total = jdbc.queryForObject(
                ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_SELECT_SELECT_COUNT + VIEW_FROM + where,
                Long.class,
                values.toArray());
        List<Object> paged = new ArrayList<>(values);
        paged.add(safeSize);
        paged.add((safePage - 1) * safeSize);
        List<StoreContractView> items = jdbc.query(
                VIEW_SELECT + VIEW_FROM + where + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_ORDER_BY_CONTRACT_NO,
                (row, index) -> readView(row),
                paged.toArray());
        Project project = projectForStore(workspaceUuid, key, storeId);
        return new FixedStoreContractPage(key, project, safePage, safeSize, total, items);
    }

    public ContractPage list(UUID workspaceUuid, String key, ContractListQuery query) {
        ContractListQuery safe = query == null ? ContractListQuery.empty() : query;
        Project project = safe.projectId() == null ? null : project(workspaceUuid, key, safe.projectId());
        if (safe.status() != null && !List.of("VALID", "INVALID").contains(safe.status()))
            throw new ContractCommandService.ContractValidationException();
        String normalizedStatus = "VALID".equals(safe.status())
                ? "ACTIVE"
                : "INVALID".equals(safe.status()) ? "INVALID" : null;
        String sortKey = safe.sort() == null ? "UPDATED_AT" : safe.sort();
        if (!List.of("CONTRACT_NO", "EFFECTIVE_FROM", "UPDATED_AT").contains(sortKey)
                || (safe.direction() != null
                        && !List.of(
                                        ContractTaskReadServiceSql.SORT_DIRECTION_ASC,
                                        ContractTaskReadServiceSql.SORT_DIRECTION_DESC)
                                .contains(safe.direction())))
            throw new ContractCommandService.ContractValidationException();
        String order = switch (sortKey) {
            case "CONTRACT_NO" -> ContractTaskReadServiceSql.CONTRACT_NO_ORDER;
            case "EFFECTIVE_FROM" -> ContractTaskReadServiceSql.EFFECTIVE_FROM_ORDER;
            default -> ContractTaskReadServiceSql.UPDATED_AT_ORDER;
        };
        String orderDirection = ContractTaskReadServiceSql.SORT_DIRECTION_ASC.equals(safe.direction())
                ? ContractTaskReadServiceSql.SORT_DIRECTION_ASC
                : ContractTaskReadServiceSql.SORT_DIRECTION_DESC;
        int safePage = Math.max(1, safe.page());
        int safeSize = Math.min(100, Math.max(1, safe.pageSize()));
        String where = ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_PROJECT_ID
                + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CONDITION_STORE_ID_TENANT_ID_TEXT
                + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_ALTERNATIVE_CONTRACT_NO_ILIKE_ESCAPE
                + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CONDITION_TEXT_PHASE_NAME_SNAPSHOT_ILIKE_ESCAPE
                + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CONDITION_JSONB_ARRAY_ELEMENTS_TEXT_ITEMS_JSON
                + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CONTINUATION_CODE_ILIKE_ESCAPE
                + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CONDITION_DATE_EFFECTIVE_FROM_EFFECTIVE_TO
                + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CONTINUATION_EFFECTIVE_TO_TEXT_STATUS;
        String contractPattern = like(safe.contractNo());
        String phasePattern = like(safe.phaseName());
        String itemPattern = like(safe.itemCode());
        List<Object> values = Arrays.asList(
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
        String from = ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_FROM_CLAUSE_STORE_STORE_ID_ALTERNATE_A
                + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_ALTERNATIVE_TENANT_ORGANIZATION_NODE_PROJECT_ID_ALTERNATE_A
                + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CONTINUATION_TENANT_ID_ALTERNATE_A;
        long total = jdbc.queryForObject(
                ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_SELECT_SELECT_COUNT_ALTERNATE_A + from + where,
                Long.class,
                values.toArray());
        List<Object> paged = new ArrayList<>(values);
        paged.add(safeSize);
        paged.add((safePage - 1) * safeSize);
        List<StoreContractView> items = jdbc.query(
                VIEW_SELECT + from + where + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_ORDER_BY + order
                        + ContractTaskReadServiceSql.SQL_SPACE + orderDirection
                        + ContractTaskReadServiceSql.CONTRACT_PAGE_TIE_BREAKER_SUFFIX,
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

    public ContractPage taskPage(UUID workspaceUuid, String key, ContractListQuery query) {
        ContractListQuery safe = query == null ? ContractListQuery.empty() : query;
        if (safe.status() != null && !List.of("VALID", "INVALID").contains(safe.status()))
            throw new ContractCommandService.ContractValidationException();
        String status = "VALID".equals(safe.status()) ? "ACTIVE" : "INVALID".equals(safe.status()) ? "INVALID" : null;
        String sort = safe.sort() == null ? "UPDATED_AT" : safe.sort();
        String direction = ContractTaskReadServiceSql.SORT_DIRECTION_ASC.equals(safe.direction())
                ? ContractTaskReadServiceSql.SORT_DIRECTION_ASC
                : ContractTaskReadServiceSql.SORT_DIRECTION_DESC;
        String order = switch (sort) {
            case "CONTRACT_NO" -> ContractTaskReadServiceSql.CONTRACT_NO_COLUMN;
            case "EFFECTIVE_FROM" -> ContractTaskReadServiceSql.EFFECTIVE_FROM_COLUMN;
            case "UPDATED_AT" -> ContractTaskReadServiceSql.UPDATED_AT_COLUMN;
            default -> throw new ContractCommandService.ContractValidationException();
        };
        if (safe.direction() != null
                && !List.of(
                                ContractTaskReadServiceSql.SORT_DIRECTION_ASC,
                                ContractTaskReadServiceSql.SORT_DIRECTION_DESC)
                        .contains(safe.direction()))
            throw new ContractCommandService.ContractValidationException();
        int page = Math.max(1, safe.page());
        int size = Math.min(100, Math.max(1, safe.pageSize()));
        String contract = like(safe.contractNo());
        String phase = like(safe.phaseName());
        String item = like(safe.itemCode());
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> jdbc.query(
                        ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CTE_PROJECT_META_NAME_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_NODE_TYPE
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
                            List<StoreContractView> items = new ArrayList<>();
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

    public StoreContractView view(UUID workspaceUuid, String key, UUID contractId) {
        return jdbc.query(
                VIEW_SELECT + VIEW_FROM + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
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

    private Project project(UUID workspaceUuid, String key, UUID projectId) {
        return jdbc.query(
                ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_SELECT_ORGANIZATION_NODE_CODE_NAME_WORKSPACE_UUID
                        + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_NODE_TYPE_PROJECT,
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

    private Project projectForStore(UUID workspaceUuid, String key, UUID storeId) {
        return jdbc.query(
                ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_SELECT_ORGANIZATION_NODE_CODE_NAME
                        + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CONTINUATION_PROJECT_ID_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setObject(1, storeId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                },
                result -> {
                    if (!result.next()) throw new ContractCommandService.ContractNotFoundException();
                    return new Project(result.getObject(1, UUID.class), result.getString(2), result.getString(3));
                });
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

    private static String likeSearch(String term) {
        return "%" + term.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
    }

    private static String like(String value) {
        if (value == null || value.isBlank()) return null;
        return "%" + value.trim().replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
    }

    private static Map<String, String> jsonObject(String source) {
        try {
            JsonNode node = JSON.readTree(source);
            if (!node.isObject()) throw new ContractCommandService.ContractValidationException();
            Map<String, String> values = new LinkedHashMap<>();
            node.fields().forEachRemaining(entry -> values.put(entry.getKey(), entry.getValue().toString()));
            return values;
        } catch (java.io.IOException failure) {
            throw new ContractCommandService.ContractValidationException(failure);
        }
    }

    private static List<StoreCandidate> candidateStores(String source) {
        try {
            List<StoreCandidate> values = new ArrayList<>();
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
            List<String> values = new ArrayList<>();
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
            List<Item> values = new ArrayList<>();
            for (JsonNode item : node) values.add(new Item(item.path("code").asText(), item.path("name").asText()));
            return List.copyOf(values);
        } catch (java.io.IOException failure) {
            throw new ContractCommandService.ContractValidationException(failure);
        }
    }

    private static String fixedStoreViewPredicate(FixedStoreContractViewState state) {
        return switch (state) {
            case CURRENT -> ContractTaskReadServiceSql.FIXED_STORE_VIEW_CURRENT;
            case PENDING_EFFECTIVE -> ContractTaskReadServiceSql.FIXED_STORE_VIEW_PENDING;
            case HISTORY -> ContractTaskReadServiceSql.FIXED_STORE_VIEW_HISTORY;
            case INVALID -> ContractTaskReadServiceSql.FIXED_STORE_VIEW_INVALID;
        };
    }

    private static List<Object> fixedStoreViewParameters(
            UUID workspaceUuid, String key, UUID storeId, FixedStoreContractViewState state, LocalDate today) {
        List<Object> values = new ArrayList<>(List.of(workspaceUuid, key, storeId));
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
