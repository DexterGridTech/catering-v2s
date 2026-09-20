package com.catering.v2s.contract.application.persistence;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Contract-owned derived store status query; the result is request-scoped and never cached for later writes. */
@Repository
public class ContractDerivedStoreStatusPersistence {
    private final JdbcTemplate jdbc;

    public ContractDerivedStoreStatusPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public DerivedStoreStatusFacts read(UUID workspaceUuid, String key, List<UUID> storeIds, java.time.LocalDate today) {
        Map<UUID, String> statuses = new LinkedHashMap<>();
        for (UUID storeId : storeIds) statuses.put(storeId, "NOT_OPERATING");
        jdbc.query(
                ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_SELECT_STORE_ID_FILTER_STATUS_ACTIVE
                        + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_OPEN_PAREN_EFFECTIVE_TO_OPERATING_FILTER
                        + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_STATUS_ACTIVE_EFFECTIVE_FROM_PREPARING
                        + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_STORE_CONTRACT_DERIVED_STATUS_WORKSPACE_UUID
                        + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY
                        + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CONDITION_STORE_ID
                        + String.join(
                                ContractTaskReadServiceSql.PLACEHOLDER_SEPARATOR,
                                Collections.nCopies(
                                        storeIds.size(), ContractTaskReadServiceSql.PARAMETER_PLACEHOLDER))
                        + ContractTaskReadServiceSql.DERIVED_STORE_STATUS_GROUP_SUFFIX,
                (row, index) -> {
                    statuses.put(row.getObject("store_id", UUID.class), row.getString("derived_status"));
                    return row.getString("derived_status");
                },
                orderedParameters(workspaceUuid, key, storeIds, today).toArray());
        return new DerivedStoreStatusFacts(statuses);
    }

    public record DerivedStoreStatusFacts(Map<UUID, String> statuses) {
        public DerivedStoreStatusFacts {
            statuses = Map.copyOf(statuses);
        }

        public String statusOf(UUID storeId) {
            return statuses.getOrDefault(storeId, "NOT_OPERATING");
        }
    }

    private static List<Object> orderedParameters(
            UUID workspaceUuid, String key, List<UUID> storeIds, java.time.LocalDate today) {
        List<Object> values = new ArrayList<>();
        values.add(today);
        values.add(today);
        values.add(today);
        values.add(workspaceUuid);
        values.add(key);
        values.addAll(storeIds);
        return values;
    }
}
