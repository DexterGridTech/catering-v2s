package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogDictionaryEntryReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogDictionaryEntryTransitionRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for catalog dictionary transition. */
@Component
public class TransitionOperationsCatalogDictionaryEntryStatusOperation {
    public static final String OPERATION_ID = "transitionOperationsCatalogDictionaryEntryStatus";
    private final CommandExecutionContextResolver contexts;
    private final CatalogOwnerApi catalog;

    public TransitionOperationsCatalogDictionaryEntryStatusOperation(
            CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) {
        this.contexts = contexts;
        this.catalog = catalog;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogDictionaryEntryReadback execute(Invocation invocation) {
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.TRANSITION_OPERATIONS_CATALOG_DICTIONARY_ENTRY_STATUS,
                invocation.request().dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        var request = invocation.request();
        return CreateOperationsCatalogDictionaryEntryOperation.response(
                context.requestId(),
                catalog.transitionDictionaryEntry(
                        context,
                        new CatalogOwnerApi.DictionaryEntryTransitionCommand(
                                invocation.dictionaryKind(),
                                invocation.entryCode(),
                                CreateOperationsCatalogCategoryOperation.requiredLong(
                                        request.expectedVersion(), "expectedVersion"),
                                request.targetStatus().name()),
                        invocation.idempotencyKey()));
    }

    public record Invocation(
            CatalogDictionaryEntryTransitionRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String dictionaryKind,
            String entryCode,
            String idempotencyKey) {}
}
