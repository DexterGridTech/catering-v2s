package com.catering.v2s.contract.application;

import com.catering.v2s.contract.api.OperationsStoreContractCommandApi;
import com.catering.v2s.contract.application.persistence.ContractDerivedStoreStatusPersistence;
import com.catering.v2s.contract.application.persistence.ContractTaskReadPersistence;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import java.time.LocalDate;
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
    private final ContractTaskReadPersistence persistence;
    private final ContractDerivedStoreStatusPersistence derivedStatusPersistence;
    private final BusinessDateProvider businessDate;

    public ContractTaskReadService(JdbcTemplate jdbc) {
        this(jdbc, null);
    }

    public ContractTaskReadService(JdbcTemplate jdbc, BusinessDateProvider businessDate) {
        this(
                new ContractTaskReadPersistence(jdbc),
                new ContractDerivedStoreStatusPersistence(jdbc),
                businessDate);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public ContractTaskReadService(
            ContractTaskReadPersistence persistence,
            ContractDerivedStoreStatusPersistence derivedStatusPersistence,
            BusinessDateProvider businessDate) {
        this.persistence = persistence;
        this.derivedStatusPersistence = derivedStatusPersistence;
        this.businessDate = businessDate;
    }

    /** Contract-owner task read for the current store status; no contract table is exposed to an edge adapter. */
    @Transactional(readOnly = true)
    public String derivedStoreStatus(UUID workspaceUuid, String key, UUID storeId) {
        if (businessDate == null) throw new IllegalStateException("business date provider is required");
        return derivedStatusPersistence
                .read(workspaceUuid, key, List.of(storeId), businessDate.today())
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
        return derivedStatusPersistence.read(workspaceUuid, key, storeIds, businessDate.today()).statuses();
    }

    /** Explicit task-read lookup; platform workspace remains the owner of workspace state. */
    @Transactional(readOnly = true)
    public UUID requireWorkspaceUuid(String key) {
        return persistence.requireWorkspaceUuid(key);
    }

    @Transactional(readOnly = true)
    public CandidatePage candidates(
            UUID workspaceUuid, String key, UUID projectId, String search, int page, int pageSize) {
        return candidates(workspaceUuid, key, projectId, null, search, page, pageSize);
    }

    /** Candidate read keeps the selected value visible even when it is outside the current page. */
    @Transactional(readOnly = true)
    public CandidatePage candidates(
            UUID workspaceUuid,
            String key,
            UUID projectId,
            UUID selectedStoreId,
            String search,
            int page,
            int pageSize) {
        return persistence.candidates(workspaceUuid, key, projectId, selectedStoreId, search, page, pageSize);
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
        return persistence.operationsTaskCandidates(
                workspaceUuid, key, projectId, selectedStoreId, search, page, pageSize);
    }

    @Transactional(readOnly = true)
    public List<StoreContractView> fixedStoreContracts(UUID workspaceUuid, String key, UUID storeId) {
        return persistence.fixedStoreContracts(workspaceUuid, key, storeId);
    }

    /** Contract-owner fixed-store profile query: one business-date predicate supplies both total and page. */
    @Transactional(readOnly = true)
    public FixedStoreContractPage fixedStoreContractPage(
            UUID workspaceUuid, String key, UUID storeId, FixedStoreContractViewState state, int page, int pageSize) {
        if (businessDate == null) throw new IllegalStateException("business date provider is required");
        return persistence.fixedStoreContractPage(
                workspaceUuid, key, storeId, state, page, pageSize, businessDate.today());
    }

    /** Explicit operations store-profile boundary; it remains wholly owned by the contract module. */
    @Transactional(readOnly = true)
    public FixedStoreContractPage operationsFixedStoreContractPage(
            UUID workspaceUuid, String key, UUID storeId, FixedStoreContractViewState state, int page, int pageSize) {
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> fixedStoreContractPage(workspaceUuid, key, storeId, state, page, pageSize));
    }

    /** Shared contract list vocabulary for both administrative faces. */
    @Transactional(readOnly = true)
    public ContractPage list(UUID workspaceUuid, String key, ContractListQuery query) {
        return persistence.list(workspaceUuid, key, query);
    }

    /** Shared one-statement page projection for operations contracts and platform overview pages. */
    @Transactional(readOnly = true)
    public ContractPage operationsTaskPage(UUID workspaceUuid, String key, ContractListQuery query) {
        return persistence.taskPage(workspaceUuid, key, query);
    }

    /** Shared one-statement page projection for platform contract overview pages. */
    @Transactional(readOnly = true)
    public ContractPage platformOverviewTaskPage(UUID workspaceUuid, String key, ContractListQuery query) {
        return persistence.taskPage(workspaceUuid, key, query);
    }

    @Transactional(readOnly = true)
    public StoreContractView view(UUID workspaceUuid, String key, UUID contractId) {
        return persistence.view(workspaceUuid, key, contractId);
    }

    /** Contract-owned typed command readback; it does not expose an application task-view type. */
    @Override
    @Transactional(readOnly = true)
    public OperationsStoreContractCommandApi.StoreContractTaskReadback readTaskView(
            OperationsStoreContractCommandApi.TaskViewQuery query) {
        return taskReadback(persistence.view(query.workspaceUuid(), query.groupWorkspaceKey(), query.contractId()));
    }

    @Transactional(readOnly = true)
    public StoreContractView operationsTaskView(UUID workspaceUuid, String key, UUID contractId) {
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> persistence.view(workspaceUuid, key, contractId));
    }

    @Transactional(readOnly = true)
    public StoreContractView platformOverviewTaskDetail(UUID workspaceUuid, String key, UUID contractId) {
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> persistence.view(workspaceUuid, key, contractId));
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
}
