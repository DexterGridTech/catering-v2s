package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogDictionaryEntryCreateRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogDictionaryEntryReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogInventoryWireEnums;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for catalog dictionary creation. */
@Component
public class CreateOperationsCatalogDictionaryEntryOperation {
    public static final String OPERATION_ID = "createOperationsCatalogDictionaryEntry";
    static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private final CommandExecutionContextResolver contexts;
    private final CatalogOwnerApi catalog;

    public CreateOperationsCatalogDictionaryEntryOperation(
            CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) {
        this.contexts = contexts;
        this.catalog = catalog;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogDictionaryEntryReadback execute(Invocation invocation) {
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.CREATE_OPERATIONS_CATALOG_DICTIONARY_ENTRY,
                invocation.request().dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        var request = invocation.request();
        return response(
                context.requestId(),
                catalog.createDictionaryEntry(
                        context,
                        new CatalogOwnerApi.DictionaryEntryCreateCommand(
                                invocation.dictionaryKind(), request.code(), request.name(), request.parentEntryRef()),
                        invocation.idempotencyKey()));
    }

    public record Invocation(
            CatalogDictionaryEntryCreateRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String dictionaryKind,
            String idempotencyKey) {}

    static CatalogDictionaryEntryReadback response(String requestId, CatalogOwnerApi.DictionaryCommandReadback value) {
        return new CatalogDictionaryEntryReadback(
                REVISION,
                requestId,
                new CatalogDictionaryEntryReadback.Result(
                        value.entryRef(),
                        value.dictionaryKind(),
                        value.code(),
                        value.name(),
                        CatalogInventoryWireEnums.DictionaryEntryStatus.valueOf(value.status()),
                        value.parentEntryRef(),
                        value.version()),
                value.version());
    }
}
