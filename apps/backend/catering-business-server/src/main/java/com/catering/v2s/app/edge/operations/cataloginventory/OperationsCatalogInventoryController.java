package com.catering.v2s.app.edge.operations.cataloginventory;

import com.catering.v2s.app.edge.generated.backendperformancem1.BackendPerformanceM1CommandExecutionBindings;
import com.catering.v2s.app.edge.generated.wire.BrandCatalogCopyPreflight;
import com.catering.v2s.app.edge.generated.wire.BrandCatalogCopyReadback;
import com.catering.v2s.app.edge.generated.wire.BrandCopyExecuteRequest;
import com.catering.v2s.app.edge.generated.wire.BrandCopyPreflightRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogAssetReleaseReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogAssetReleaseRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogAssetStageRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogAttributeDefinitionCreateRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogAttributeDefinitionDeleteReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogAttributeDefinitionDeleteRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogAttributeDefinitionList;
import com.catering.v2s.app.edge.generated.wire.CatalogAttributeDefinitionReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogAttributeDefinitionUpdateRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogCategoryCreateRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogCategoryDeleteReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogCategoryDeleteRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogCategoryMoveRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogCategoryReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogCategoryUpdateRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogDictionaryEntryCreateRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogDictionaryEntryReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogDictionaryEntryReorderRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogDictionaryEntryTransitionRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogDictionaryEntryUpdateRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogDictionaryView;
import com.catering.v2s.app.edge.generated.wire.CatalogItemBatchStatusTransitionReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogItemBatchStatusTransitionRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogItemCommandReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogItemCreateRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogItemSaveReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogItemSaveRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogItemTransitionRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogOrderOptionDefinitionCreateRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogOrderOptionDefinitionDeleteReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogOrderOptionDefinitionDeleteRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogOrderOptionDefinitionList;
import com.catering.v2s.app.edge.generated.wire.CatalogOrderOptionDefinitionReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogOrderOptionDefinitionUpdateRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogUnitCreateRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogUnitDeleteReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogUnitDeleteRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogUnitDisableRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogUnitList;
import com.catering.v2s.app.edge.generated.wire.CatalogUnitReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogUnitUpdateRequest;
import com.catering.v2s.app.edge.generated.wire.InventoryAdjustmentRequest;
import com.catering.v2s.app.edge.generated.wire.InventoryCountRequest;
import com.catering.v2s.app.edge.generated.wire.InventoryIncreaseRequest;
import com.catering.v2s.app.edge.generated.wire.InventoryTargetConfigurationRequest;
import com.catering.v2s.app.edge.generated.wire.InventoryTargetCurrentView;
import com.catering.v2s.app.edge.generated.wire.InventoryWriteReadback;
import com.catering.v2s.app.edge.generated.wire.LocalCopyExecuteRequest;
import com.catering.v2s.app.edge.generated.wire.LocalCopyPreflight;
import com.catering.v2s.app.edge.generated.wire.LocalCopyPreflightRequest;
import com.catering.v2s.app.edge.generated.wire.LocalCopyReadback;
import com.catering.v2s.app.edge.generated.wire.ProductionTagCreateRequest;
import com.catering.v2s.app.edge.generated.wire.ProductionTagReadback;
import com.catering.v2s.app.edge.generated.wire.ProductionTagTransitionRequest;
import com.catering.v2s.app.edge.generated.wire.ProductionTagUpdateRequest;
import com.catering.v2s.app.edge.generated.wire.TemporaryPromotionExecuteRequest;
import com.catering.v2s.app.edge.generated.wire.TemporaryPromotionPreflight;
import com.catering.v2s.app.edge.generated.wire.TemporaryPromotionPreflightRequest;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.application.CatalogInventoryCoordinator;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.platform.asset.api.CatalogAssetCommandApi;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Operations edge for catalog, production-tag and light-inventory surfaces. */
@RestController
@RequestMapping("/api/operations/catalog-inventory")
public final class OperationsCatalogInventoryController {
    private static final Set<String> CATALOG_SCOPE = Set.of(ServiceNodeTypes.STORE, ServiceNodeTypes.HEAD_COMPANY);
    private static final Set<String> STORE_SCOPE = Set.of(ServiceNodeTypes.STORE);
    private final CatalogInventoryCoordinator application;
    private final OperationsSessionResolver sessions;
    private final CatalogScopeLookup catalogScopes;
    private final ObjectMapper mapper;
    private final BackendPerformanceM1CommandExecutionBindings m1Bindings;

    public OperationsCatalogInventoryController(
            CatalogInventoryCoordinator application,
            OperationsSessionResolver sessions,
            CatalogScopeLookup catalogScopes,
            ObjectMapper mapper,
            BackendPerformanceM1CommandExecutionBindings m1Bindings) {
        this.application = application;
        this.sessions = sessions;
        this.catalogScopes = catalogScopes;
        this.mapper = mapper;
        this.m1Bindings = m1Bindings;
    }

    @GetMapping("/workbench/context")
    public ResponseEntity<Object> workbenchContext(
            EdgeRequestContext context,
            @RequestParam Map<String, String> query,
            @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, query, path, CATALOG_SCOPE);
        return readResponse(application.readCatalogWorkbenchContext(
                read.dataNodeRef(),
                read.brandRef(),
                read.requestId(),
                read.dataNodeType(),
                read.headCompanyRef(),
                read.workspaceUuid(),
                read.groupWorkspaceKey()));
    }

    @GetMapping("/navigation")
    public ResponseEntity<Object> navigation(
            EdgeRequestContext context,
            @RequestParam Map<String, String> query,
            @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, query, path, CATALOG_SCOPE);
        return readResponse(application.readCatalogNavigation(
                read.dataNodeRef(), read.brandRef(), read.request(), read.requestId()));
    }

    @GetMapping("/items")
    public ResponseEntity<Object> items(
            EdgeRequestContext context,
            @RequestParam Map<String, String> query,
            @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, query, path, CATALOG_SCOPE);
        return readResponse(application.readCatalogItems(
                read.dataNodeRef(), read.brandRef(), read.request(), read.requestId(), read.dataNodeType()));
    }

    @GetMapping("/items/{itemCode}")
    public ResponseEntity<Object> item(
            EdgeRequestContext context,
            @RequestParam Map<String, String> query,
            @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, query, path, CATALOG_SCOPE);
        return readResponse(application.readCatalogItem(
                read.dataNodeRef(),
                read.brandRef(),
                required(read.request(), "itemCode"),
                read.request(),
                read.requestId()));
    }

    @GetMapping("/dictionaries/{dictionaryKind}")
    public ResponseEntity<Object> dictionary(
            EdgeRequestContext context,
            @RequestParam Map<String, String> query,
            @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, query, path, CATALOG_SCOPE);
        return readResponse(application.readCatalogDictionary(
                read.dataNodeRef(),
                read.brandRef(),
                required(read.request(), "dictionaryKind"),
                read.request(),
                read.requestId()));
    }

    @GetMapping("/production-tags")
    public ResponseEntity<Object> productionTags(
            EdgeRequestContext context,
            @RequestParam Map<String, String> query,
            @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, query, path, CATALOG_SCOPE);
        return readResponse(
                application.readProductionTags(read.dataNodeRef(), read.brandRef(), read.request(), read.requestId()));
    }

    @GetMapping("/copy/local/candidates")
    public ResponseEntity<Object> localCopyCandidates(
            EdgeRequestContext context,
            @RequestParam Map<String, String> query,
            @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, query, path, STORE_SCOPE);
        return readResponse(application.readLocalCatalogCopyCandidates(
                read.dataNodeRef(), read.brandRef(), read.request(), read.requestId()));
    }

    @GetMapping("/copy/brand/candidates")
    public ResponseEntity<Object> brandCopyCandidates(
            EdgeRequestContext context,
            @RequestParam Map<String, String> query,
            @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, query, path, STORE_SCOPE);
        resolveBrandCandidateSource(read.request(), read.session(), read.scope(), read.brandRef());
        return readResponse(application.readBrandCatalogCopyCandidates(
                read.dataNodeRef(), read.brandRef(), read.request(), read.requestId()));
    }

    @GetMapping("/inventory-targets")
    public ResponseEntity<Object> inventoryTargets(
            EdgeRequestContext context,
            @RequestParam Map<String, String> query,
            @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, query, path, STORE_SCOPE);
        return readResponse(application.readInventoryTargets(
                read.dataNodeRef(), read.brandRef(), read.request(), read.requestId(), read.dataNodeType()));
    }

    @GetMapping("/inventory-consumption-target-candidates")
    public ResponseEntity<Object> inventoryConsumptionTargetCandidates(
            EdgeRequestContext context,
            @RequestParam Map<String, String> query,
            @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, query, path, CATALOG_SCOPE);
        return readResponse(application.readInventoryConsumptionTargetCandidates(
                read.dataNodeRef(), read.brandRef(), read.request(), read.requestId(), read.dataNodeType()));
    }

    @GetMapping("/inventory-targets/{targetRef}")
    public ResponseEntity<Object> inventoryTarget(
            EdgeRequestContext context,
            @RequestParam Map<String, String> query,
            @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, query, path, STORE_SCOPE);
        return readResponse(application.readInventoryTarget(
                read.dataNodeRef(),
                read.brandRef(),
                required(read.request(), "targetRef"),
                read.requestId(),
                read.dataNodeType()));
    }

    @GetMapping("/inventory-targets/{targetRef}/changes")
    public ResponseEntity<Object> inventoryTargetChanges(
            EdgeRequestContext context,
            @RequestParam Map<String, String> query,
            @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, query, path, STORE_SCOPE);
        return readResponse(application.readInventoryTargetChangeSummary(
                read.dataNodeRef(),
                read.brandRef(),
                required(read.request(), "targetRef"),
                read.request().path("period").asText(null),
                read.dataNodeType()));
    }

    @GetMapping("/inventory-targets/{targetRef}/business-history")
    public ResponseEntity<Object> inventoryTargetBusinessHistory(
            EdgeRequestContext context,
            @RequestParam Map<String, String> query,
            @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, query, path, STORE_SCOPE);
        return readResponse(application.readInventoryTargetBusinessHistory(
                read.dataNodeRef(),
                read.brandRef(),
                required(read.request(), "targetRef"),
                read.request(),
                read.requestId(),
                read.dataNodeType()));
    }

    @GetMapping("/inventory-targets/{targetRef}/consumption-references")
    public ResponseEntity<Object> inventoryTargetConsumptionReferences(
            EdgeRequestContext context,
            @RequestParam Map<String, String> query,
            @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, query, path, STORE_SCOPE);
        return readResponse(application.readInventoryTargetConsumptionReferences(
                read.dataNodeRef(),
                read.brandRef(),
                required(read.request(), "targetRef"),
                read.request(),
                read.requestId()));
    }

    @GetMapping("/inventory-targets/{targetRef}/ledger")
    public ResponseEntity<Object> inventoryTargetLedger(
            EdgeRequestContext context,
            @RequestParam Map<String, String> query,
            @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, query, path, STORE_SCOPE);
        return readResponse(application.readInventoryTargetLedger(
                read.dataNodeRef(),
                read.brandRef(),
                required(read.request(), "targetRef"),
                read.request(),
                read.requestId(),
                read.dataNodeType()));
    }

    @GetMapping("/inventory-targets/{targetRef}/diagnostics")
    public ResponseEntity<Object> inventoryTargetDiagnostics(
            EdgeRequestContext context,
            @RequestParam Map<String, String> query,
            @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, query, path, STORE_SCOPE);
        return readResponse(
                application.readInventoryTargetDiagnostics(required(read.request(), "targetRef"), read.requestId()));
    }

    @GetMapping("/shape-manifest")
    public ResponseEntity<Object> shapeManifest(
            EdgeRequestContext context,
            @RequestParam Map<String, String> query,
            @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, query, path, CATALOG_SCOPE);
        return readResponse(application.readCatalogShapeManifest(read.requestId()));
    }

    @GetMapping("/attribute-definitions")
    public ResponseEntity<CatalogAttributeDefinitionList> attributeDefinitions(
            EdgeRequestContext context,
            @RequestParam Map<String, String> query,
            @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, query, path, CATALOG_SCOPE);
        return ResponseEntity.ok(attributeDefinitionList(
                read.requestId(), application.listAttributeDefinitions(read.dataNodeRef(), read.brandRef())));
    }

    @GetMapping("/units")
    public ResponseEntity<CatalogUnitList> catalogUnits(
            EdgeRequestContext context,
            @RequestParam Map<String, String> query,
            @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, query, path, CATALOG_SCOPE);
        return ResponseEntity.ok(catalogUnitList(
                read.requestId(),
                application.listUnitDefinitions(
                        read.dataNodeRef(),
                        read.brandRef(),
                        optionalBoolean(read.request(), "includeInactive"),
                        optionalUnitDimension(read.request().path("dimension").asText(null)))));
    }

    @PostMapping("/units")
    public ResponseEntity<CatalogUnitReadback> createCatalogUnit(
            EdgeRequestContext context,
            @RequestBody CatalogUnitCreateRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        requireIdempotencyKey(idempotencyKey);
        return ResponseEntity.ok(m1Bindings.bindCreateOperationsCatalogUnit(
                request,
                sessions.token(context),
                context.requestedBrandRef(),
                context.correlationId(),
                context.requestId(),
                idempotencyKey));
    }

    @GetMapping("/order-option-definitions")
    public ResponseEntity<CatalogOrderOptionDefinitionList> orderOptionDefinitions(
            EdgeRequestContext context,
            @RequestParam Map<String, String> query,
            @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, query, path, CATALOG_SCOPE);
        return ResponseEntity.ok(orderOptionDefinitionList(
                read.requestId(), application.listOrderOptionDefinitions(read.dataNodeRef(), read.brandRef())));
    }

    @PostMapping("/items")
    public ResponseEntity<CatalogItemCommandReadback> createCatalogItem(
            EdgeRequestContext c,
            @RequestBody CatalogItemCreateRequest r,
            @RequestHeader(value = "Idempotency-Key", required = false) String k) {
        requireIdempotencyKey(k);
        return ResponseEntity.ok(m1Bindings.bindCreateOperationsCatalogItem(
                r, sessions.token(c), c.requestedBrandRef(), c.correlationId(), c.requestId(), k));
    }

    @PostMapping("/attribute-definitions")
    public ResponseEntity<CatalogAttributeDefinitionReadback> createAttributeDefinition(
            EdgeRequestContext context,
            @RequestBody CatalogAttributeDefinitionCreateRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        requireIdempotencyKey(idempotencyKey);
        return ResponseEntity.ok(m1Bindings.bindCreateOperationsCatalogAttributeDefinition(
                request,
                sessions.token(context),
                context.requestedBrandRef(),
                context.correlationId(),
                context.requestId(),
                idempotencyKey));
    }

    @PostMapping("/order-option-definitions")
    public ResponseEntity<CatalogOrderOptionDefinitionReadback> createOrderOptionDefinition(
            EdgeRequestContext context,
            @RequestBody CatalogOrderOptionDefinitionCreateRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        requireIdempotencyKey(idempotencyKey);
        return ResponseEntity.ok(m1Bindings.bindCreateOperationsCatalogOrderOptionDefinition(
                request,
                sessions.token(context),
                context.requestedBrandRef(),
                context.correlationId(),
                context.requestId(),
                idempotencyKey));
    }

    @PostMapping("/items/{itemCode}/status")
    public ResponseEntity<CatalogItemCommandReadback> transitionCatalogItemStatus(
            EdgeRequestContext c,
            @RequestBody CatalogItemTransitionRequest r,
            @RequestHeader(value = "Idempotency-Key", required = false) String k,
            @PathVariable String itemCode) {
        requireIdempotencyKey(k);
        return ResponseEntity.ok(m1Bindings.bindTransitionOperationsCatalogItemStatus(
                r,
                sessions.token(c),
                c.requestedBrandRef(),
                c.correlationId(),
                c.requestId(),
                itemCode,
                c.catalogTestFailurePoint(),
                k));
    }

    @PostMapping("/items/status")
    public ResponseEntity<CatalogItemBatchStatusTransitionReadback> batchTransitionCatalogItemStatus(
            EdgeRequestContext c,
            @RequestBody CatalogItemBatchStatusTransitionRequest r,
            @RequestHeader(value = "Idempotency-Key", required = false) String k) {
        requireIdempotencyKey(k);
        return ResponseEntity.ok(m1Bindings.bindBatchTransitionOperationsCatalogItemStatus(
                r, sessions.token(c), c.requestedBrandRef(), c.correlationId(), c.requestId(), k));
    }

    @PostMapping("/categories")
    public ResponseEntity<CatalogCategoryReadback> createCatalogCategory(
            EdgeRequestContext c,
            @RequestBody CatalogCategoryCreateRequest r,
            @RequestHeader(value = "Idempotency-Key", required = false) String k) {
        requireIdempotencyKey(k);
        return ResponseEntity.ok(m1Bindings.bindCreateOperationsCatalogCategory(
                r, sessions.token(c), c.requestedBrandRef(), c.correlationId(), c.requestId(), k));
    }

    @PostMapping("/categories/{categoryRef}/move")
    public ResponseEntity<CatalogCategoryReadback> moveCatalogCategory(
            EdgeRequestContext c,
            @RequestBody CatalogCategoryMoveRequest r,
            @RequestHeader(value = "Idempotency-Key", required = false) String k,
            @PathVariable String categoryRef) {
        requireIdempotencyKey(k);
        return ResponseEntity.ok(m1Bindings.bindMoveOperationsCatalogCategory(
                r, sessions.token(c), c.requestedBrandRef(), c.correlationId(), c.requestId(), categoryRef, k));
    }

    @PostMapping("/dictionaries/{dictionaryKind}/entries")
    public ResponseEntity<CatalogDictionaryEntryReadback> createCatalogDictionaryEntry(
            EdgeRequestContext c,
            @RequestBody CatalogDictionaryEntryCreateRequest r,
            @RequestHeader(value = "Idempotency-Key", required = false) String k,
            @PathVariable String dictionaryKind) {
        requireIdempotencyKey(k);
        return ResponseEntity.ok(m1Bindings.bindCreateOperationsCatalogDictionaryEntry(
                r, sessions.token(c), c.requestedBrandRef(), c.correlationId(), c.requestId(), dictionaryKind, k));
    }

    @PostMapping("/dictionaries/{dictionaryKind}/entries/reorder")
    public ResponseEntity<CatalogDictionaryView> reorderCatalogDictionaryEntry(
            EdgeRequestContext c,
            @RequestBody CatalogDictionaryEntryReorderRequest r,
            @RequestHeader(value = "Idempotency-Key", required = false) String k,
            @PathVariable String dictionaryKind) {
        requireIdempotencyKey(k);
        return ResponseEntity.ok(m1Bindings.bindReorderOperationsCatalogDictionaryEntry(
                r, sessions.token(c), c.requestedBrandRef(), c.correlationId(), c.requestId(), dictionaryKind, k));
    }

    @PostMapping("/dictionaries/{dictionaryKind}/entries/{entryCode}/status")
    public ResponseEntity<CatalogDictionaryEntryReadback> transitionCatalogDictionaryEntryStatus(
            EdgeRequestContext c,
            @RequestBody CatalogDictionaryEntryTransitionRequest r,
            @RequestHeader(value = "Idempotency-Key", required = false) String k,
            @PathVariable String dictionaryKind,
            @PathVariable String entryCode) {
        requireIdempotencyKey(k);
        return ResponseEntity.ok(m1Bindings.bindTransitionOperationsCatalogDictionaryEntryStatus(
                r,
                sessions.token(c),
                c.requestedBrandRef(),
                c.correlationId(),
                c.requestId(),
                dictionaryKind,
                entryCode,
                k));
    }

    @PostMapping("/production-tags")
    public ResponseEntity<ProductionTagReadback> createProductionTag(
            EdgeRequestContext context,
            @RequestBody ProductionTagCreateRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        requireIdempotencyKey(idempotencyKey);
        return ResponseEntity.ok(m1Bindings.bindCreateOperationsProductionTag(
                request,
                sessions.token(context),
                context.requestedBrandRef(),
                context.correlationId(),
                context.requestId(),
                idempotencyKey));
    }

    @PostMapping("/production-tags/{tagCode}/status")
    public ResponseEntity<ProductionTagReadback> transitionProductionTagStatus(
            EdgeRequestContext context,
            @RequestBody ProductionTagTransitionRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @PathVariable String tagCode) {
        requireIdempotencyKey(idempotencyKey);
        return ResponseEntity.ok(m1Bindings.bindTransitionOperationsProductionTagStatus(
                request,
                sessions.token(context),
                context.requestedBrandRef(),
                context.correlationId(),
                context.requestId(),
                tagCode,
                idempotencyKey));
    }

    @PostMapping("/copy/local/preflight")
    public ResponseEntity<LocalCopyPreflight> preflightLocalCatalogCopy(
            EdgeRequestContext c,
            @RequestBody LocalCopyPreflightRequest r,
            @RequestHeader(value = "Idempotency-Key", required = false) String k) {
        requireIdempotencyKey(k);
        return ResponseEntity.ok(m1Bindings.bindPreflightOperationsLocalCatalogCopy(
                r, sessions.token(c), c.requestedBrandRef(), c.correlationId(), c.requestId(), k));
    }

    @PostMapping("/copy/local/execute")
    public ResponseEntity<LocalCopyReadback> executeLocalCatalogCopy(
            EdgeRequestContext c,
            @RequestBody LocalCopyExecuteRequest r,
            @RequestHeader(value = "Idempotency-Key", required = false) String k) {
        requireIdempotencyKey(k);
        return ResponseEntity.ok(m1Bindings.bindExecuteOperationsLocalCatalogCopy(
                r, sessions.token(c), c.requestedBrandRef(), c.correlationId(), c.requestId(), k));
    }

    @PostMapping("/items/{itemCode}/temporary-promotion/preflight")
    public ResponseEntity<TemporaryPromotionPreflight> preflightTemporaryCatalogPromotion(
            EdgeRequestContext c,
            @RequestBody TemporaryPromotionPreflightRequest r,
            @RequestHeader(value = "Idempotency-Key", required = false) String k,
            @PathVariable String itemCode) {
        requireIdempotencyKey(k);
        return ResponseEntity.ok(m1Bindings.bindPreflightOperationsTemporaryCatalogItemPromotion(
                r, sessions.token(c), c.requestedBrandRef(), c.correlationId(), c.requestId(), itemCode, k));
    }

    @PostMapping("/items/{itemCode}/temporary-promotion/execute")
    public ResponseEntity<CatalogItemCommandReadback> executeTemporaryCatalogPromotion(
            EdgeRequestContext c,
            @RequestBody TemporaryPromotionExecuteRequest r,
            @RequestHeader(value = "Idempotency-Key", required = false) String k,
            @PathVariable String itemCode) {
        requireIdempotencyKey(k);
        return ResponseEntity.ok(m1Bindings.bindExecuteOperationsTemporaryCatalogItemPromotion(
                r, sessions.token(c), c.requestedBrandRef(), c.correlationId(), c.requestId(), itemCode, k));
    }

    @PostMapping("/copy/brand/preflight")
    public ResponseEntity<BrandCatalogCopyPreflight> preflightBrandCatalogCopy(
            EdgeRequestContext c,
            @RequestBody BrandCopyPreflightRequest r,
            @RequestHeader(value = "Idempotency-Key", required = false) String k) {
        requireIdempotencyKey(k);
        return ResponseEntity.ok(m1Bindings.bindPreflightOperationsBrandCatalogCopy(
                r, sessions.token(c), c.requestedBrandRef(), c.correlationId(), c.requestId(), k));
    }

    @PostMapping("/copy/brand/execute")
    public ResponseEntity<BrandCatalogCopyReadback> executeBrandCatalogCopy(
            EdgeRequestContext c,
            @RequestBody BrandCopyExecuteRequest r,
            @RequestHeader(value = "Idempotency-Key", required = false) String k) {
        requireIdempotencyKey(k);
        return ResponseEntity.ok(m1Bindings.bindExecuteOperationsBrandCatalogCopy(
                r,
                sessions.token(c),
                c.requestedBrandRef(),
                c.correlationId(),
                c.requestId(),
                c.catalogTestFailurePoint(),
                k));
    }

    @PostMapping("/inventory-targets/{targetRef}/count")
    public ResponseEntity<InventoryWriteReadback> countInventoryTarget(
            EdgeRequestContext context,
            @RequestBody InventoryCountRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @PathVariable String targetRef) {
        if (idempotencyKey == null || idempotencyKey.isBlank())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "Idempotency-Key is required");
        return ResponseEntity.ok(m1Bindings.bindCountOperationsInventoryTarget(
                request,
                sessions.token(context),
                context.requestedBrandRef(),
                context.correlationId(),
                context.requestId(),
                targetRef,
                idempotencyKey));
    }

    @PostMapping("/inventory-targets/{targetRef}/increase")
    public ResponseEntity<InventoryWriteReadback> increaseInventoryTarget(
            EdgeRequestContext context,
            @RequestBody InventoryIncreaseRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @PathVariable String targetRef) {
        requireIdempotencyKey(idempotencyKey);
        return ResponseEntity.ok(m1Bindings.bindIncreaseOperationsInventoryTarget(
                request,
                sessions.token(context),
                context.requestedBrandRef(),
                context.correlationId(),
                context.requestId(),
                targetRef,
                idempotencyKey));
    }

    @PostMapping("/inventory-targets/{targetRef}/adjust")
    public ResponseEntity<InventoryWriteReadback> adjustInventoryTarget(
            EdgeRequestContext context,
            @RequestBody InventoryAdjustmentRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @PathVariable String targetRef) {
        requireIdempotencyKey(idempotencyKey);
        return ResponseEntity.ok(m1Bindings.bindAdjustOperationsInventoryTarget(
                request,
                sessions.token(context),
                context.requestedBrandRef(),
                context.correlationId(),
                context.requestId(),
                targetRef,
                idempotencyKey));
    }

    @PostMapping(value = "/assets/stage", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Object> stageAsset(
            EdgeRequestContext context,
            @RequestPart("content") MultipartFile content,
            @RequestParam("fileName") String fileName,
            @RequestParam("mediaType") String mediaType,
            @RequestParam("contentDigest") String contentDigest,
            @RequestParam("dataNodeRef") String dataNodeRef,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        requireIdempotencyKey(idempotencyKey);
        try (InputStream stream = content.getInputStream()) {
            return ResponseEntity.ok(m1Bindings.bindStageOperationsCatalogAsset(
                    new CatalogAssetStageRequest(
                            UUID.fromString(dataNodeRef), fileName, stream, mediaType, contentDigest),
                    content.getSize(),
                    sessions.token(context),
                    context.requestedBrandRef(),
                    context.correlationId(),
                    context.requestId(),
                    context.catalogTestFailurePoint(),
                    idempotencyKey));
        } catch (java.io.IOException failure) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "asset content could not be read", failure);
        }
    }

    @PatchMapping("/items/{itemCode}")
    public ResponseEntity<CatalogItemSaveReadback> saveCatalogItem(
            EdgeRequestContext context,
            @RequestBody CatalogItemSaveRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @PathVariable String itemCode) {
        requireIdempotencyKey(idempotencyKey);
        return ResponseEntity.ok(m1Bindings.bindSaveOperationsCatalogItem(
                request,
                sessions.token(context),
                context.requestedBrandRef(),
                context.correlationId(),
                context.requestId(),
                itemCode,
                idempotencyKey,
                catalogAssetBindings(context)));
    }

    @PatchMapping("/attribute-definitions/{definitionRef}")
    public ResponseEntity<CatalogAttributeDefinitionReadback> updateAttributeDefinition(
            EdgeRequestContext context,
            @RequestBody CatalogAttributeDefinitionUpdateRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @PathVariable String definitionRef) {
        requireIdempotencyKey(idempotencyKey);
        return ResponseEntity.ok(m1Bindings.bindUpdateOperationsCatalogAttributeDefinition(
                request,
                sessions.token(context),
                context.requestedBrandRef(),
                context.correlationId(),
                context.requestId(),
                definitionRef,
                idempotencyKey));
    }

    @PatchMapping("/order-option-definitions/{definitionRef}")
    public ResponseEntity<CatalogOrderOptionDefinitionReadback> updateOrderOptionDefinition(
            EdgeRequestContext context,
            @RequestBody CatalogOrderOptionDefinitionUpdateRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @PathVariable String definitionRef) {
        requireIdempotencyKey(idempotencyKey);
        return ResponseEntity.ok(m1Bindings.bindUpdateOperationsCatalogOrderOptionDefinition(
                request,
                sessions.token(context),
                context.requestedBrandRef(),
                context.correlationId(),
                context.requestId(),
                definitionRef,
                idempotencyKey));
    }

    @PatchMapping("/units/{unitRef}")
    public ResponseEntity<CatalogUnitReadback> updateCatalogUnit(
            EdgeRequestContext context,
            @RequestBody CatalogUnitUpdateRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @PathVariable String unitRef) {
        requireIdempotencyKey(idempotencyKey);
        return ResponseEntity.ok(m1Bindings.bindUpdateOperationsCatalogUnit(
                request,
                sessions.token(context),
                context.requestedBrandRef(),
                context.correlationId(),
                context.requestId(),
                unitRef,
                idempotencyKey));
    }

    @PostMapping("/units/{unitRef}/disable")
    public ResponseEntity<CatalogUnitReadback> disableCatalogUnit(
            EdgeRequestContext context,
            @RequestBody CatalogUnitDisableRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @PathVariable String unitRef) {
        requireIdempotencyKey(idempotencyKey);
        return ResponseEntity.ok(m1Bindings.bindDisableOperationsCatalogUnit(
                request,
                sessions.token(context),
                context.requestedBrandRef(),
                context.correlationId(),
                context.requestId(),
                unitRef,
                idempotencyKey));
    }

    @PatchMapping("/categories/{categoryRef}")
    public ResponseEntity<CatalogCategoryReadback> updateCatalogCategory(
            EdgeRequestContext c,
            @RequestBody CatalogCategoryUpdateRequest r,
            @RequestHeader(value = "Idempotency-Key", required = false) String k,
            @PathVariable String categoryRef) {
        requireIdempotencyKey(k);
        return ResponseEntity.ok(m1Bindings.bindUpdateOperationsCatalogCategory(
                r, sessions.token(c), c.requestedBrandRef(), c.correlationId(), c.requestId(), categoryRef, k));
    }

    @PatchMapping("/dictionaries/{dictionaryKind}/entries/{entryCode}")
    public ResponseEntity<CatalogDictionaryEntryReadback> updateCatalogDictionaryEntry(
            EdgeRequestContext c,
            @RequestBody CatalogDictionaryEntryUpdateRequest r,
            @RequestHeader(value = "Idempotency-Key", required = false) String k,
            @PathVariable String dictionaryKind,
            @PathVariable String entryCode) {
        requireIdempotencyKey(k);
        return ResponseEntity.ok(m1Bindings.bindUpdateOperationsCatalogDictionaryEntry(
                r,
                sessions.token(c),
                c.requestedBrandRef(),
                c.correlationId(),
                c.requestId(),
                dictionaryKind,
                entryCode,
                k));
    }

    @PatchMapping("/production-tags/{tagCode}")
    public ResponseEntity<ProductionTagReadback> updateProductionTag(
            EdgeRequestContext context,
            @RequestBody ProductionTagUpdateRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @PathVariable String tagCode) {
        requireIdempotencyKey(idempotencyKey);
        return ResponseEntity.ok(m1Bindings.bindUpdateOperationsProductionTag(
                request,
                sessions.token(context),
                context.requestedBrandRef(),
                context.correlationId(),
                context.requestId(),
                tagCode,
                idempotencyKey));
    }

    @PatchMapping("/inventory-targets/{targetRef}/configuration")
    public ResponseEntity<InventoryTargetCurrentView> updateInventoryTargetConfiguration(
            EdgeRequestContext context,
            @RequestBody InventoryTargetConfigurationRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @PathVariable String targetRef) {
        requireIdempotencyKey(idempotencyKey);
        return ResponseEntity.ok(m1Bindings.bindUpdateOperationsInventoryTargetConfiguration(
                request,
                sessions.token(context),
                context.requestedBrandRef(),
                context.correlationId(),
                context.requestId(),
                targetRef,
                idempotencyKey));
    }

    @DeleteMapping("/categories/{categoryRef}")
    public ResponseEntity<CatalogCategoryDeleteReadback> deleteCatalogCategory(
            EdgeRequestContext c,
            @RequestBody CatalogCategoryDeleteRequest r,
            @RequestHeader(value = "Idempotency-Key", required = false) String k,
            @PathVariable String categoryRef) {
        requireIdempotencyKey(k);
        return ResponseEntity.ok(m1Bindings.bindDeleteOperationsCatalogCategory(
                r, sessions.token(c), c.requestedBrandRef(), c.correlationId(), c.requestId(), categoryRef, k));
    }

    @DeleteMapping("/attribute-definitions/{definitionRef}")
    public ResponseEntity<CatalogAttributeDefinitionDeleteReadback> deleteAttributeDefinition(
            EdgeRequestContext context,
            @RequestBody CatalogAttributeDefinitionDeleteRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @PathVariable String definitionRef) {
        requireIdempotencyKey(idempotencyKey);
        return ResponseEntity.ok(m1Bindings.bindDeleteOperationsCatalogAttributeDefinition(
                request,
                sessions.token(context),
                context.requestedBrandRef(),
                context.correlationId(),
                context.requestId(),
                definitionRef,
                idempotencyKey));
    }

    @DeleteMapping("/order-option-definitions/{definitionRef}")
    public ResponseEntity<CatalogOrderOptionDefinitionDeleteReadback> deleteOrderOptionDefinition(
            EdgeRequestContext context,
            @RequestBody CatalogOrderOptionDefinitionDeleteRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @PathVariable String definitionRef) {
        requireIdempotencyKey(idempotencyKey);
        return ResponseEntity.ok(m1Bindings.bindDeleteOperationsCatalogOrderOptionDefinition(
                request,
                sessions.token(context),
                context.requestedBrandRef(),
                context.correlationId(),
                context.requestId(),
                definitionRef,
                idempotencyKey));
    }

    @DeleteMapping("/units/{unitRef}")
    public ResponseEntity<CatalogUnitDeleteReadback> deleteCatalogUnit(
            EdgeRequestContext context,
            @RequestBody CatalogUnitDeleteRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @PathVariable String unitRef) {
        requireIdempotencyKey(idempotencyKey);
        return ResponseEntity.ok(m1Bindings.bindDeleteOperationsCatalogUnit(
                request,
                sessions.token(context),
                context.requestedBrandRef(),
                context.correlationId(),
                context.requestId(),
                unitRef,
                idempotencyKey));
    }

    @PostMapping("/assets/{assetRef}/release")
    public ResponseEntity<CatalogAssetReleaseReadback> releaseCatalogAsset(
            EdgeRequestContext context,
            @RequestBody CatalogAssetReleaseRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @PathVariable String assetRef) {
        requireIdempotencyKey(idempotencyKey);
        return ResponseEntity.ok(m1Bindings.bindReleaseOperationsCatalogStagedAsset(
                request,
                sessions.token(context),
                context.requestedBrandRef(),
                context.correlationId(),
                context.requestId(),
                assetRef,
                idempotencyKey));
    }

    private static void requireIdempotencyKey(String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "Idempotency-Key is required");
    }

    private static CatalogAttributeDefinitionList attributeDefinitionList(
            String requestId, CatalogOwnerApi.AttributeDefinitionListReadback readback) {
        return new CatalogAttributeDefinitionList(
                "CATALOG_INVENTORY_P1_20260806",
                requestId,
                new CatalogAttributeDefinitionList.Data(readback.definitions().stream()
                        .map(definition -> new CatalogAttributeDefinitionList.Data.DefinitionsItem(
                                definition.definitionRef(),
                                definition.code(),
                                definition.name(),
                                definition.valueType(),
                                definition.options().stream()
                                        .map(option ->
                                                new CatalogAttributeDefinitionList.Data.DefinitionsItem.OptionsItem(
                                                        option.optionRef(), option.name(), (long)
                                                                option.displayOrder()))
                                        .toList(),
                                definition.version()))
                        .toList()));
    }

    private static CatalogUnitList catalogUnitList(
            String requestId, CatalogOwnerApi.UnitDefinitionListReadback readback) {
        return new CatalogUnitList(
                "CATALOG_INVENTORY_P1_20260806",
                requestId,
                new CatalogUnitList.Data(readback.units().stream()
                        .map(unit -> new CatalogUnitList.Data.UnitsItem(
                                unit.unitRef(),
                                unit.code(),
                                unit.name(),
                                unit.unitDimension().name(),
                                (long) unit.precision(),
                                unit.status(),
                                readback.referencedUnitRefs().contains(unit.unitRef()),
                                unit.version()))
                        .toList()));
    }

    private static CatalogOrderOptionDefinitionList orderOptionDefinitionList(
            String requestId, CatalogOwnerApi.OrderOptionDefinitionListReadback readback) {
        List<CatalogOrderOptionDefinitionList.Data.DefinitionsItem> definitions = readback.definitions().stream()
                .map(definition -> new CatalogOrderOptionDefinitionList.Data.DefinitionsItem(
                        definition.definitionRef(),
                        definition.code(),
                        definition.name(),
                        definition.selectionMode(),
                        orderOptionValues(definition.values()),
                        definition.version()))
                .toList();
        return new CatalogOrderOptionDefinitionList(
                "CATALOG_INVENTORY_P1_20260806", requestId, new CatalogOrderOptionDefinitionList.Data(definitions));
    }

    private static List<CatalogOrderOptionDefinitionList.Data.DefinitionsItem.ValuesItem> orderOptionValues(
            List<CatalogOwnerApi.OrderOptionValueReadback> values) {
        return values.stream()
                .map(value -> new CatalogOrderOptionDefinitionList.Data.DefinitionsItem.ValuesItem(
                        value.valueRef(),
                        value.code(),
                        value.name(),
                        (long) value.displayOrder(),
                        orderOptionMaterials(value.materials())))
                .toList();
    }

    private static List<CatalogOrderOptionDefinitionList.Data.DefinitionsItem.ValuesItem.MaterialsItem>
            orderOptionMaterials(List<CatalogOwnerApi.OrderOptionMaterialReadback> materials) {
        return materials.stream()
                .map(material -> new CatalogOrderOptionDefinitionList.Data.DefinitionsItem.ValuesItem.MaterialsItem(
                        material.materialRef(),
                        material.materialItemRef(),
                        material.materialItemName(),
                        material.stockTargetRef(),
                        consumptionUnitSnapshot(material.consumptionUnitSnapshot())))
                .toList();
    }

    private static CatalogOrderOptionDefinitionList.Data.DefinitionsItem.ValuesItem.MaterialsItem
                    .ConsumptionUnitSnapshot
            consumptionUnitSnapshot(InventoryOwnerApi.UnitSnapshot value) {
        return value == null
                ? null
                : new CatalogOrderOptionDefinitionList.Data.DefinitionsItem.ValuesItem.MaterialsItem
                        .ConsumptionUnitSnapshot(
                        value.unitRef(), value.code(), value.name(), value.unitDimension(), (long) value.precision());
    }

    private ResponseEntity<Object> readResponse(JsonNode body) {
        return ResponseEntity.ok(jsonBody(body));
    }

    private ReadRequest readRequest(
            EdgeRequestContext context,
            Map<String, String> query,
            Map<String, String> path,
            Set<String> allowedDataNodeTypes) {
        ObjectNode request = mapper.createObjectNode();
        query.forEach(request::put);
        path.forEach(request::put);
        var session = sessions.requireRead(context);
        ResolvedCatalogScope scope = resolvedScope(allowedDataNodeTypes, session, request);
        String headCompanyRef =
                session.scopeContext() != null && session.scopeContext().headCompany() != null
                        ? session.scopeContext().headCompany().dataNodeId().toString()
                        : null;
        return new ReadRequest(
                request, session, scope, resolvedBrand(context, session, scope), context.requestId(), headCompanyRef);
    }

    /** Transient proof header is deliberately excluded from the catalog request, persistence and logs. */
    private List<CatalogAssetCommandApi.AssetBinding> catalogAssetBindings(EdgeRequestContext context) {
        String encoded = context.catalogAssetBindGrants();
        if (encoded == null || encoded.isBlank()) return List.of();
        try {
            JsonNode root = mapper.readTree(encoded);
            if (!root.isObject()) throw new InvalidEdgeRequestException("asset binding grants must be an object");
            List<CatalogAssetCommandApi.AssetBinding> grants = new ArrayList<>();
            root.fields().forEachRemaining(entry -> {
                if (!entry.getValue().isTextual() || entry.getValue().asText().isBlank())
                    throw new InvalidEdgeRequestException("asset binding grant must be a non-blank text value");
                grants.add(new CatalogAssetCommandApi.AssetBinding(
                        UUID.fromString(entry.getKey()), entry.getValue().asText()));
            });
            return List.copyOf(grants);
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "X-Catalog-Asset-Bind-Grants is invalid", failure);
        }
    }

    private Object jsonBody(JsonNode value) {
        return mapper.convertValue(value, Object.class);
    }

    private void resolveBrandCandidateSource(
            ObjectNode request,
            com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback session,
            ResolvedCatalogScope target,
            String brandRef) {
        if (!"STORE".equals(target.dataNodeType()))
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "品牌复制候选仅支持门店目标");
        try {
            UUID source = catalogScopes.resolveCatalogCopySource(
                    session.workspaceUuid(),
                    session.groupWorkspaceKey(),
                    "STORE",
                    UUID.fromString(target.dataNodeRef()),
                    brandRef);
            request.put("sourceDataNodeRef", source.toString());
        } catch (IllegalArgumentException
                | IllegalStateException
                | BusinessEntityService.OrganizationNotFoundException
                | BusinessEntityService.OrganizationValidationException failure) {
            {
                throw new CatalogOwnerApi.Problem(
                        ("SCOPE_FORBIDDEN"),
                        (403),
                        ("当前门店没有可用的品牌商品复制来源"),
                        /* format-wrap */
                        (failure));
            }
        }
    }

    private ResolvedCatalogScope resolvedScope(
            java.util.Collection<String> allowedDataNodeTypes,
            com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback session,
            ObjectNode request) {
        String selected = request.hasNonNull("dataNodeRef")
                ? request.path("dataNodeRef").asText("").trim()
                : "";
        var scope = session.scopeContext();
        List<ResolvedCatalogScope> candidates = new ArrayList<>();
        if (scope != null && scope.store() != null && allowedDataNodeTypes.contains(ServiceNodeTypes.STORE)) {
            candidates.add(new ResolvedCatalogScope(
                    ServiceNodeTypes.STORE, scope.store().dataNodeId().toString()));
        }
        if (scope != null
                && scope.headCompany() != null
                && allowedDataNodeTypes.contains(ServiceNodeTypes.HEAD_COMPANY)) {
            candidates.add(new ResolvedCatalogScope(
                    ServiceNodeTypes.HEAD_COMPANY,
                    scope.headCompany().dataNodeId().toString()));
        }
        if (candidates.isEmpty()) {
            throw new CatalogOwnerApi.Problem(
                    ("SCOPE_FORBIDDEN"),
                    (403),
                    /* format-wrap */
                    ("当前会话没有该操作允许的数据节点"));
        }
        if (!selected.isBlank()) {
            List<ResolvedCatalogScope> matched = candidates.stream()
                    .filter(candidate -> selected.equals(candidate.dataNodeRef()))
                    .toList();
            if (matched.size() == 1) return matched.get(0);
            {
                throw new CatalogOwnerApi.Problem(
                        ("SCOPE_FORBIDDEN"),
                        (403),
                        /* format-wrap */
                        ("请求数据节点不属于当前会话或当前操作范围"));
            }
        }
        if (candidates.size() == 1) return candidates.get(0);
        {
            throw new CatalogOwnerApi.Problem(
                    ("SCOPE_FORBIDDEN"),
                    (403),
                    /* format-wrap */
                    ("当前会话存在多个可用数据节点，必须明确 dataNodeRef"));
        }
    }

    private String resolvedBrand(
            EdgeRequestContext context,
            com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback session,
            ResolvedCatalogScope scope) {
        try {
            return catalogScopes.requireCatalogBrand(
                    session.workspaceUuid(),
                    session.groupWorkspaceKey(),
                    scope.dataNodeType(),
                    UUID.fromString(scope.dataNodeRef()),
                    context.requestedBrandRef());
        } catch (IllegalArgumentException
                | IllegalStateException
                | BusinessEntityService.OrganizationNotFoundException
                | BusinessEntityService.OrganizationValidationException failure) {
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "当前会话没有已授权品牌", failure);
        }
    }

    private record ResolvedCatalogScope(String dataNodeType, String dataNodeRef) {}

    private record ReadRequest(
            ObjectNode request,
            com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback session,
            ResolvedCatalogScope scope,
            String brandRef,
            String requestId,
            String headCompanyRef) {
        String dataNodeRef() {
            return scope.dataNodeRef();
        }

        String dataNodeType() {
            return scope.dataNodeType();
        }

        UUID workspaceUuid() {
            return session.workspaceUuid();
        }

        String groupWorkspaceKey() {
            return session.groupWorkspaceKey();
        }
    }

    private static String required(ObjectNode request, String field) {
        String value = request.path(field).asText("");
        if (value.isBlank()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, field + " is required");
        return value;
    }

    private static boolean optionalBoolean(ObjectNode request, String field) {
        if (!request.has(field)) return false;
        JsonNode value = request.path(field);
        if (value.isBoolean()) return value.asBoolean();
        if (value.isTextual()
                && ("true".equalsIgnoreCase(value.asText()) || "false".equalsIgnoreCase(value.asText()))) {
            return Boolean.parseBoolean(value.asText());
        }
        throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, field + " must be boolean");
    }

    private static CatalogOwnerApi.UnitDimension optionalUnitDimension(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return CatalogOwnerApi.UnitDimension.valueOf(value);
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "dimension is not supported", failure);
        }
    }
}
