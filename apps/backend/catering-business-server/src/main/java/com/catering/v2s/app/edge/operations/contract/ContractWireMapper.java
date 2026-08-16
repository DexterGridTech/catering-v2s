package com.catering.v2s.app.edge.operations.contract;

import com.catering.v2s.app.edge.generated.wire.StoreContract;
import com.catering.v2s.app.edge.generated.wire.StoreContractCandidatePage;
import com.catering.v2s.app.edge.generated.wire.StoreContractCandidatePageMetadata;
import com.catering.v2s.app.edge.generated.wire.StoreContractCandidatePageProject;
import com.catering.v2s.app.edge.generated.wire.StoreContractItem;
import com.catering.v2s.app.edge.generated.wire.StoreContractPageMetadata;
import com.catering.v2s.app.edge.generated.wire.StoreContractProject;
import com.catering.v2s.app.edge.generated.wire.StoreContractSortDirection;
import com.catering.v2s.app.edge.generated.wire.StoreContractSortKey;
import com.catering.v2s.app.edge.generated.wire.StoreContractStatus;
import com.catering.v2s.app.edge.generated.wire.StoreContractStore;
import com.catering.v2s.app.edge.generated.wire.StoreContractStoreCandidate;
import com.catering.v2s.app.edge.generated.wire.StoreContractTenant;
import com.catering.v2s.contract.api.OperationsStoreContractCommandApi;
import com.catering.v2s.contract.application.ContractTaskReadService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

final class ContractWireMapper {
    private static final ObjectMapper JSON = new ObjectMapper();

    private ContractWireMapper() {}

    static StoreContract wire(ContractTaskReadService.StoreContractView value) {
        return wire(new OperationsStoreContractCommandApi.StoreContractTaskReadback(
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
                value.phaseNameSnapshot()));
    }

    static StoreContract wire(OperationsStoreContractCommandApi.StoreContractTaskReadback value) {
        return new StoreContract(
                value.id().toString(),
                value.groupWorkspaceKey(),
                project(value.project()),
                store(value.store()),
                tenant(value.tenant()),
                value.phaseName(),
                value.contractNo(),
                value.effectiveFrom().toString(),
                value.effectiveTo() == null ? null : value.effectiveTo().toString(),
                value.note(),
                extensionValues(value.extensionValues()),
                value.extensionRuleRevision(),
                StoreContractStatus.valueOf(value.status()),
                value.revision(),
                value.source(),
                value.createdAt(),
                value.updatedAt(),
                value.items().stream()
                        .map(item -> new StoreContractItem(item.code(), item.name()))
                        .toList(),
                value.phaseNameSnapshot());
    }

    static StoreContractCandidatePage candidates(ContractTaskReadService.CandidatePage value) {
        return new StoreContractCandidatePage(
                value.groupWorkspaceKey(),
                new StoreContractCandidatePageProject(
                        value.project().id().toString(),
                        value.project().code(),
                        value.project().name()),
                new StoreContractCandidatePageMetadata(
                        value.metadata().storeSearch(),
                        (long) value.metadata().page(),
                        (long) value.metadata().pageSize(),
                        value.metadata().total()),
                value.stores().stream()
                        .map(store -> new StoreContractStoreCandidate(
                                store.id().toString(), store.code(), store.name(), store.storeStatus()))
                        .toList(),
                value.phases(),
                null);
    }

    static StoreContractPageMetadata metadata(ContractTaskReadService.ContractPageMetadata value) {
        return new StoreContractPageMetadata(
                value.groupWorkspaceKey(),
                value.projectRef(),
                value.projectName(),
                (long) value.page(),
                (long) value.pageSize(),
                value.total(),
                StoreContractSortKey.valueOf(value.sort()),
                StoreContractSortDirection.valueOf(value.direction()));
    }

    private static StoreContractProject project(ContractTaskReadService.Reference value) {
        return new StoreContractProject(value.id().toString(), value.code(), value.name());
    }

    private static StoreContractStore store(ContractTaskReadService.Reference value) {
        return new StoreContractStore(value.id().toString(), value.code(), value.name());
    }

    private static StoreContractTenant tenant(ContractTaskReadService.Reference value) {
        return new StoreContractTenant(value.id().toString(), value.code(), value.name());
    }

    private static StoreContractProject project(OperationsStoreContractCommandApi.Reference value) {
        return new StoreContractProject(value.id().toString(), value.code(), value.name());
    }

    private static StoreContractStore store(OperationsStoreContractCommandApi.Reference value) {
        return new StoreContractStore(value.id().toString(), value.code(), value.name());
    }

    private static StoreContractTenant tenant(OperationsStoreContractCommandApi.Reference value) {
        return new StoreContractTenant(value.id().toString(), value.code(), value.name());
    }

    private static OperationsStoreContractCommandApi.Reference reference(ContractTaskReadService.Reference value) {
        return new OperationsStoreContractCommandApi.Reference(value.id(), value.code(), value.name());
    }

    static JsonNode extensionValues(List<OperationsStoreContractCommandApi.ExtensionValue> values) {
        ObjectNode result = JSON.createObjectNode();
        values.forEach(value -> {
            try {
                result.set(value.fieldKey(), JSON.readTree(value.valueJson()));
            } catch (Exception exception) {
                throw new IllegalStateException("contract owner emitted invalid extension JSON", exception);
            }
        });
        return result;
    }

    static JsonNode extensionValues(Map<String, String> values) {
        ObjectNode result = JSON.createObjectNode();
        values.forEach((key, raw) -> {
            try {
                result.set(key, JSON.readTree(raw));
            } catch (Exception exception) {
                throw new IllegalStateException("contract owner emitted invalid extension JSON", exception);
            }
        });
        return result;
    }

    static Map<String, String> requestValues(JsonNode values) {
        if (values == null || values.isNull()) return Map.of();
        if (!values.isObject()) throw new IllegalArgumentException("contract extension values must be a JSON object");
        Map<String, String> result = new LinkedHashMap<>();
        values.properties().forEach(entry -> {
            try {
                result.put(entry.getKey(), JSON.writeValueAsString(entry.getValue()));
            } catch (Exception exception) {
                throw new IllegalArgumentException("contract extension value is not JSON serializable", exception);
            }
        });
        return Map.copyOf(result);
    }
}
