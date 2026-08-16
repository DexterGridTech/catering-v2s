package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogDictionaryEntryReorderRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogDictionaryView;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for catalog dictionary reorder. */
@Component
public class ReorderOperationsCatalogDictionaryEntryOperation {
    public static final String OPERATION_ID = "reorderOperationsCatalogDictionaryEntry";
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private final CommandExecutionContextResolver contexts;
    private final CatalogOwnerApi catalog;

    public ReorderOperationsCatalogDictionaryEntryOperation(
            CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) {
        this.contexts = contexts;
        this.catalog = catalog;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogDictionaryView execute(Invocation invocation) {
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.REORDER_OPERATIONS_CATALOG_DICTIONARY_ENTRY,
                invocation.request().dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        var value = catalog.reorderDictionaryEntries(
                context,
                new CatalogOwnerApi.DictionaryEntryReorderCommand(
                        invocation.dictionaryKind(),
                        List.copyOf(invocation.request().orderedCodes())),
                invocation.idempotencyKey());
        return response(context.requestId(), value);
    }

    public record Invocation(
            CatalogDictionaryEntryReorderRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String dictionaryKind,
            String idempotencyKey) {}

    private static CatalogDictionaryView response(String requestId, CatalogOwnerApi.DictionaryViewReadback value) {
        return new CatalogDictionaryView(
                REVISION,
                requestId,
                new CatalogDictionaryView.Data(
                        value.dictionaryKind(),
                        value.entries().stream()
                                .map(ReorderOperationsCatalogDictionaryEntryOperation::entry)
                                .toList(),
                        value.cursor(),
                        value.total(),
                        value.generation()));
    }

    private static CatalogDictionaryView.Data.EntriesItem entry(CatalogOwnerApi.DictionaryEntryView value) {
        var availability = value.voidAvailability();
        return new CatalogDictionaryView.Data.EntriesItem(
                uuid(value.entryRef()),
                value.code(),
                value.name(),
                value.parentEntryRef(),
                value.status(),
                value.ownerType(),
                uuid(value.ownerRef()),
                uuid(value.brandRef()),
                value.version(),
                value.updatedAt(),
                new CatalogDictionaryView.Data.EntriesItem.VoidAvailability(
                        availability.canVoid(),
                        availability.blockingReferences().stream()
                                .map(reference ->
                                        new CatalogDictionaryView.Data.EntriesItem.VoidAvailability
                                                .BlockingReferencesItem(
                                                reference.referenceKind(), uuid(reference.referenceRef())))
                                .toList(),
                        availability.dependentFacts().stream()
                                .map(fact ->
                                        new CatalogDictionaryView.Data.EntriesItem.VoidAvailability.DependentFactsItem(
                                                fact.factKind(), uuid(fact.factRef())))
                                .toList()));
    }

    private static UUID uuid(String value) {
        return value == null || value.isBlank() ? null : UUID.fromString(value);
    }
}
