package com.catering.v2s.app.edge.operations.cataloginventory;

import com.catering.v2s.catalog.application.CatalogInventoryCoordinator;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.LinkedHashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.io.IOException;
import java.util.function.Function;
import jakarta.servlet.http.HttpServletRequest;
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
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.RestController;

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

    public OperationsCatalogInventoryController(CatalogInventoryCoordinator application, OperationsSessionResolver sessions, CatalogScopeLookup catalogScopes, ObjectMapper mapper) {
        this.application = application; this.sessions = sessions; this.catalogScopes = catalogScopes; this.mapper = mapper;
    }

    @GetMapping("/workbench/context")
    public ResponseEntity<Object> workbenchContext(EdgeRequestContext context, HttpServletRequest http, @RequestParam Map<String, String> query, @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, http, query, path, CATALOG_SCOPE);
        return readResponse(application.readCatalogWorkbenchContext(read.dataNodeRef(), read.brandRef(), read.requestId(), read.dataNodeType(), read.headCompanyRef(), read.workspaceUuid(), read.groupWorkspaceKey()));
    }

    @GetMapping("/navigation")
    public ResponseEntity<Object> navigation(EdgeRequestContext context, HttpServletRequest http, @RequestParam Map<String, String> query, @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, http, query, path, CATALOG_SCOPE);
        return readResponse(application.readCatalogNavigation(read.dataNodeRef(), read.brandRef(), read.request(), read.requestId()));
    }

    @GetMapping("/items")
    public ResponseEntity<Object> items(EdgeRequestContext context, HttpServletRequest http, @RequestParam Map<String, String> query, @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, http, query, path, CATALOG_SCOPE);
        return readResponse(application.readCatalogItems(read.dataNodeRef(), read.brandRef(), read.request(), read.requestId(), read.dataNodeType()));
    }

    @GetMapping("/items/{itemCode}")
    public ResponseEntity<Object> item(EdgeRequestContext context, HttpServletRequest http, @RequestParam Map<String, String> query, @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, http, query, path, CATALOG_SCOPE);
        return readResponse(application.readCatalogItem(read.dataNodeRef(), read.brandRef(), required(read.request(), "itemCode"), read.request(), read.requestId()));
    }

    @GetMapping("/dictionaries/{dictionaryKind}")
    public ResponseEntity<Object> dictionary(EdgeRequestContext context, HttpServletRequest http, @RequestParam Map<String, String> query, @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, http, query, path, CATALOG_SCOPE);
        return readResponse(application.readCatalogDictionary(read.dataNodeRef(), read.brandRef(), required(read.request(), "dictionaryKind"), read.request(), read.requestId()));
    }

    @GetMapping("/production-tags")
    public ResponseEntity<Object> productionTags(EdgeRequestContext context, HttpServletRequest http, @RequestParam Map<String, String> query, @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, http, query, path, CATALOG_SCOPE);
        return readResponse(application.readProductionTags(read.dataNodeRef(), read.brandRef(), read.requestId()));
    }

    @GetMapping("/copy/local/candidates")
    public ResponseEntity<Object> localCopyCandidates(EdgeRequestContext context, HttpServletRequest http, @RequestParam Map<String, String> query, @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, http, query, path, STORE_SCOPE);
        return readResponse(application.readLocalCatalogCopyCandidates(read.dataNodeRef(), read.brandRef(), read.request(), read.requestId()));
    }

    @GetMapping("/copy/brand/candidates")
    public ResponseEntity<Object> brandCopyCandidates(EdgeRequestContext context, HttpServletRequest http, @RequestParam Map<String, String> query, @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, http, query, path, STORE_SCOPE);
        resolveBrandCandidateSource(read.request(), read.session(), read.scope(), read.brandRef());
        return readResponse(application.readBrandCatalogCopyCandidates(read.dataNodeRef(), read.brandRef(), read.request(), read.requestId()));
    }

    @GetMapping("/inventory-targets")
    public ResponseEntity<Object> inventoryTargets(EdgeRequestContext context, HttpServletRequest http, @RequestParam Map<String, String> query, @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, http, query, path, STORE_SCOPE);
        return readResponse(application.readInventoryTargets(read.dataNodeRef(), read.brandRef(), read.request(), read.requestId(), read.dataNodeType()));
    }

    @GetMapping("/inventory-targets/{targetRef}")
    public ResponseEntity<Object> inventoryTarget(EdgeRequestContext context, HttpServletRequest http, @RequestParam Map<String, String> query, @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, http, query, path, STORE_SCOPE);
        return readResponse(application.readInventoryTarget(read.dataNodeRef(), read.brandRef(), required(read.request(), "targetRef"), read.requestId(), read.dataNodeType()));
    }

    @GetMapping("/inventory-targets/{targetRef}/changes")
    public ResponseEntity<Object> inventoryTargetChanges(EdgeRequestContext context, HttpServletRequest http, @RequestParam Map<String, String> query, @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, http, query, path, STORE_SCOPE);
        return readResponse(application.readInventoryTargetChangeSummary(required(read.request(), "targetRef"), read.request().path("period").asText(null)));
    }

    @GetMapping("/inventory-targets/{targetRef}/business-history")
    public ResponseEntity<Object> inventoryTargetBusinessHistory(EdgeRequestContext context, HttpServletRequest http, @RequestParam Map<String, String> query, @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, http, query, path, STORE_SCOPE);
        return readResponse(application.readInventoryTargetBusinessHistory(required(read.request(), "targetRef"), read.request(), read.requestId()));
    }

    @GetMapping("/inventory-targets/{targetRef}/consumption-references")
    public ResponseEntity<Object> inventoryTargetConsumptionReferences(EdgeRequestContext context, HttpServletRequest http, @RequestParam Map<String, String> query, @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, http, query, path, STORE_SCOPE);
        return readResponse(application.readInventoryTargetConsumptionReferences(read.dataNodeRef(), read.brandRef(), required(read.request(), "targetRef"), read.request(), read.requestId()));
    }

    @GetMapping("/inventory-targets/{targetRef}/ledger")
    public ResponseEntity<Object> inventoryTargetLedger(EdgeRequestContext context, HttpServletRequest http, @RequestParam Map<String, String> query, @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, http, query, path, STORE_SCOPE);
        return readResponse(application.readInventoryTargetLedger(required(read.request(), "targetRef"), read.request(), read.requestId()));
    }

    @GetMapping("/inventory-targets/{targetRef}/diagnostics")
    public ResponseEntity<Object> inventoryTargetDiagnostics(EdgeRequestContext context, HttpServletRequest http, @RequestParam Map<String, String> query, @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, http, query, path, STORE_SCOPE);
        return readResponse(application.readInventoryTargetDiagnostics(required(read.request(), "targetRef"), read.requestId()));
    }

    @GetMapping("/shape-manifest")
    public ResponseEntity<Object> shapeManifest(EdgeRequestContext context, HttpServletRequest http, @RequestParam Map<String, String> query, @PathVariable Map<String, String> path) {
        ReadRequest read = readRequest(context, http, query, path, CATALOG_SCOPE);
        return readResponse(application.readCatalogShapeManifest(read.requestId()));
    }

    @PostMapping("/items") public ResponseEntity<Object> createCatalogItem(EdgeRequestContext c, HttpServletRequest h, @RequestBody(required=false) Map<String,Object> b, @RequestHeader(value="Idempotency-Key",required=false) String k, @PathVariable Map<String,String> p) { return command(c,h,b,k,p,false,application::createCatalogItem); }
    @PostMapping("/items/{itemCode}/status") public ResponseEntity<Object> transitionCatalogItemStatus(EdgeRequestContext c, HttpServletRequest h, @RequestBody(required=false) Map<String,Object> b, @RequestHeader(value="Idempotency-Key",required=false) String k, @PathVariable Map<String,String> p) { return command(c,h,b,k,p,false,application::transitionCatalogItemStatus); }
    @PostMapping("/categories") public ResponseEntity<Object> createCatalogCategory(EdgeRequestContext c, HttpServletRequest h, @RequestBody(required=false) Map<String,Object> b, @RequestHeader(value="Idempotency-Key",required=false) String k, @PathVariable Map<String,String> p) { return command(c,h,b,k,p,false,application::createCatalogCategory); }
    @PostMapping("/categories/{categoryRef}/move") public ResponseEntity<Object> moveCatalogCategory(EdgeRequestContext c, HttpServletRequest h, @RequestBody(required=false) Map<String,Object> b, @RequestHeader(value="Idempotency-Key",required=false) String k, @PathVariable Map<String,String> p) { return command(c,h,b,k,p,false,application::moveCatalogCategory); }
    @PostMapping("/dictionaries/{dictionaryKind}/entries") public ResponseEntity<Object> createCatalogDictionaryEntry(EdgeRequestContext c, HttpServletRequest h, @RequestBody(required=false) Map<String,Object> b, @RequestHeader(value="Idempotency-Key",required=false) String k, @PathVariable Map<String,String> p) { return command(c,h,b,k,p,false,application::createCatalogDictionaryEntry); }
    @PostMapping("/dictionaries/{dictionaryKind}/entries/reorder") public ResponseEntity<Object> reorderCatalogDictionaryEntry(EdgeRequestContext c, HttpServletRequest h, @RequestBody(required=false) Map<String,Object> b, @RequestHeader(value="Idempotency-Key",required=false) String k, @PathVariable Map<String,String> p) { return command(c,h,b,k,p,false,application::reorderCatalogDictionaryEntry); }
    @PostMapping("/dictionaries/{dictionaryKind}/entries/{entryCode}/status") public ResponseEntity<Object> transitionCatalogDictionaryEntryStatus(EdgeRequestContext c, HttpServletRequest h, @RequestBody(required=false) Map<String,Object> b, @RequestHeader(value="Idempotency-Key",required=false) String k, @PathVariable Map<String,String> p) { return command(c,h,b,k,p,false,application::transitionCatalogDictionaryEntryStatus); }
    @PostMapping("/production-tags") public ResponseEntity<Object> createProductionTag(EdgeRequestContext c, HttpServletRequest h, @RequestBody(required=false) Map<String,Object> b, @RequestHeader(value="Idempotency-Key",required=false) String k, @PathVariable Map<String,String> p) { return command(c,h,b,k,p,false,application::createProductionTag); }
    @PostMapping("/production-tags/{tagCode}/status") public ResponseEntity<Object> transitionProductionTagStatus(EdgeRequestContext c, HttpServletRequest h, @RequestBody(required=false) Map<String,Object> b, @RequestHeader(value="Idempotency-Key",required=false) String k, @PathVariable Map<String,String> p) { return command(c,h,b,k,p,false,application::transitionProductionTagStatus); }
    @PostMapping("/copy/local/preflight") public ResponseEntity<Object> preflightLocalCatalogCopy(EdgeRequestContext c, HttpServletRequest h, @RequestBody(required=false) Map<String,Object> b, @RequestHeader(value="Idempotency-Key",required=false) String k, @PathVariable Map<String,String> p) { return command(c,h,b,k,p,false,application::preflightLocalCatalogCopy); }
    @PostMapping("/copy/local/execute") public ResponseEntity<Object> executeLocalCatalogCopy(EdgeRequestContext c, HttpServletRequest h, @RequestBody(required=false) Map<String,Object> b, @RequestHeader(value="Idempotency-Key",required=false) String k, @PathVariable Map<String,String> p) { return command(c,h,b,k,p,false,application::executeLocalCatalogCopy); }
    @PostMapping("/items/{itemCode}/temporary-promotion/preflight") public ResponseEntity<Object> preflightTemporaryCatalogPromotion(EdgeRequestContext c, HttpServletRequest h, @RequestBody(required=false) Map<String,Object> b, @RequestHeader(value="Idempotency-Key",required=false) String k, @PathVariable Map<String,String> p) { return command(c,h,b,k,p,false,application::preflightTemporaryCatalogPromotion); }
    @PostMapping("/items/{itemCode}/temporary-promotion/execute") public ResponseEntity<Object> executeTemporaryCatalogPromotion(EdgeRequestContext c, HttpServletRequest h, @RequestBody(required=false) Map<String,Object> b, @RequestHeader(value="Idempotency-Key",required=false) String k, @PathVariable Map<String,String> p) { return command(c,h,b,k,p,false,application::executeTemporaryCatalogPromotion); }
    @PostMapping("/copy/brand/preflight") public ResponseEntity<Object> preflightBrandCatalogCopy(EdgeRequestContext c, HttpServletRequest h, @RequestBody(required=false) Map<String,Object> b, @RequestHeader(value="Idempotency-Key",required=false) String k, @PathVariable Map<String,String> p) { return command(c,h,b,k,p,false,application::preflightBrandCatalogCopy); }
    @PostMapping("/copy/brand/execute") public ResponseEntity<Object> executeBrandCatalogCopy(EdgeRequestContext c, HttpServletRequest h, @RequestBody(required=false) Map<String,Object> b, @RequestHeader(value="Idempotency-Key",required=false) String k, @PathVariable Map<String,String> p) { return command(c,h,b,k,p,false,application::executeBrandCatalogCopy); }
    @PostMapping("/inventory-targets/{targetRef}/count") public ResponseEntity<Object> countInventoryTarget(EdgeRequestContext c, HttpServletRequest h, @RequestBody(required=false) Map<String,Object> b, @RequestHeader(value="Idempotency-Key",required=false) String k, @PathVariable Map<String,String> p) { return command(c,h,b,k,p,false,application::countInventoryTarget); }
    @PostMapping("/inventory-targets/{targetRef}/increase") public ResponseEntity<Object> increaseInventoryTarget(EdgeRequestContext c, HttpServletRequest h, @RequestBody(required=false) Map<String,Object> b, @RequestHeader(value="Idempotency-Key",required=false) String k, @PathVariable Map<String,String> p) { return command(c,h,b,k,p,false,application::increaseInventoryTarget); }
    @PostMapping("/inventory-targets/{targetRef}/adjust") public ResponseEntity<Object> adjustInventoryTarget(EdgeRequestContext c, HttpServletRequest h, @RequestBody(required=false) Map<String,Object> b, @RequestHeader(value="Idempotency-Key",required=false) String k, @PathVariable Map<String,String> p) { return command(c,h,b,k,p,false,application::adjustInventoryTarget); }

    @PostMapping(value = "/assets/stage", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Object> stageAsset(EdgeRequestContext context, HttpServletRequest http,
                                                @RequestPart("content") MultipartFile content,
                                                @RequestParam("fileName") String fileName,
                                                @RequestParam("mediaType") String mediaType,
                                                @RequestParam("contentDigest") String contentDigest,
                                                @RequestParam("dataNodeRef") String dataNodeRef,
                                                @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "Idempotency-Key is required");
        final byte[] bytes;
        try { bytes = content.getBytes(); }
        catch (IOException failure) { throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "asset content could not be read"); }
        return ResponseEntity.<Object>ok(jsonBody(application.stageWorkspaceAsset(
            sessions.token(context), com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens.STAGE_OPERATIONS_CATALOG_ASSET, dataNodeRef, requestedBrandRef(http),
            context.correlationId(), requestId(http), fileName, mediaType, contentDigest, bytes, idempotencyKey,
            http.getHeader("X-Catalog-Test-Failure-Point")
        )));
    }

    @PatchMapping("/items/{itemCode}") public ResponseEntity<Object> saveCatalogItem(EdgeRequestContext c,HttpServletRequest h,@RequestBody(required=false) Map<String,Object>b,@RequestHeader(value="Idempotency-Key",required=false)String k,@PathVariable Map<String,String>p){return command(c,h,b,k,p,true,application::saveCatalogItem);}
    @PatchMapping("/categories/{categoryRef}") public ResponseEntity<Object> updateCatalogCategory(EdgeRequestContext c,HttpServletRequest h,@RequestBody(required=false) Map<String,Object>b,@RequestHeader(value="Idempotency-Key",required=false)String k,@PathVariable Map<String,String>p){return command(c,h,b,k,p,false,application::updateCatalogCategory);}
    @PatchMapping("/dictionaries/{dictionaryKind}/entries/{entryCode}") public ResponseEntity<Object> updateCatalogDictionaryEntry(EdgeRequestContext c,HttpServletRequest h,@RequestBody(required=false) Map<String,Object>b,@RequestHeader(value="Idempotency-Key",required=false)String k,@PathVariable Map<String,String>p){return command(c,h,b,k,p,false,application::updateCatalogDictionaryEntry);}
    @PatchMapping("/production-tags/{tagCode}") public ResponseEntity<Object> updateProductionTag(EdgeRequestContext c,HttpServletRequest h,@RequestBody(required=false) Map<String,Object>b,@RequestHeader(value="Idempotency-Key",required=false)String k,@PathVariable Map<String,String>p){return command(c,h,b,k,p,false,application::updateProductionTag);}
    @PatchMapping("/inventory-targets/{targetRef}/configuration") public ResponseEntity<Object> updateInventoryTargetConfiguration(EdgeRequestContext c,HttpServletRequest h,@RequestBody(required=false) Map<String,Object>b,@RequestHeader(value="Idempotency-Key",required=false)String k,@PathVariable Map<String,String>p){return command(c,h,b,k,p,false,application::updateInventoryTargetConfiguration);}
    @DeleteMapping("/categories/{categoryRef}") public ResponseEntity<Object> deleteCatalogCategory(EdgeRequestContext c,HttpServletRequest h,@RequestBody(required=false) Map<String,Object>b,@RequestHeader(value="Idempotency-Key",required=false)String k,@PathVariable Map<String,String>p){return command(c,h,b,k,p,false,application::deleteCatalogCategory);}
    @PostMapping("/assets/{assetRef}/release") public ResponseEntity<Object> releaseCatalogAsset(EdgeRequestContext c,HttpServletRequest h,@RequestBody(required=false) Map<String,Object>b,@RequestHeader(value="Idempotency-Key",required=false)String k,@PathVariable Map<String,String>p){return command(c,h,b,k,p,false,application::releaseCatalogAsset);}

    private ResponseEntity<Object> command(EdgeRequestContext context, HttpServletRequest http, Map<String,Object> body, String idempotencyKey, Map<String,String> path, boolean needsAssetBindGrants, Function<CatalogInventoryCoordinator.CommandRequest, JsonNode> directOperation) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "Idempotency-Key is required");
        ObjectNode request = body == null ? mapper.createObjectNode() : mapper.valueToTree(body);
        path.forEach(request::put);
        CatalogInventoryCoordinator.CommandRequest input = new CatalogInventoryCoordinator.CommandRequest(
            sessions.token(context), request.path("dataNodeRef").asText(""), requestedBrandRef(http), context.correlationId(), requestId(http), request,
            idempotencyKey, http.getHeader("X-Catalog-Test-Failure-Point"), needsAssetBindGrants ? catalogAssetBindGrants(http) : Map.of());
        return ResponseEntity.ok(jsonBody(directOperation.apply(input)));
    }

    private ResponseEntity<Object> readResponse(JsonNode body) { return ResponseEntity.ok(jsonBody(body)); }

    private ReadRequest readRequest(EdgeRequestContext context, HttpServletRequest http, Map<String, String> query,
                                    Map<String, String> path, Set<String> allowedDataNodeTypes) {
        ObjectNode request = mapper.createObjectNode();
        query.forEach(request::put); path.forEach(request::put);
        var session = sessions.requireRead(context);
        ResolvedCatalogScope scope = resolvedScope(allowedDataNodeTypes, session, request);
        String headCompanyRef = session.scopeContext() != null && session.scopeContext().headCompany() != null
            ? session.scopeContext().headCompany().dataNodeId().toString() : null;
        return new ReadRequest(request, session, scope, resolvedBrand(http, session, scope), requestId(http), headCompanyRef);
    }

    /** Transient proof header is deliberately excluded from the catalog request, persistence and logs. */
    private Map<String, String> catalogAssetBindGrants(HttpServletRequest http) {
        String encoded = http.getHeader("X-Catalog-Asset-Bind-Grants");
        if (encoded == null || encoded.isBlank()) return Map.of();
        try {
            JsonNode root = mapper.readTree(encoded);
            if (!root.isObject()) throw new IllegalArgumentException();
            Map<String, String> grants = new LinkedHashMap<>();
            root.fields().forEachRemaining(entry -> {
                if (!entry.getValue().isTextual() || entry.getValue().asText().isBlank()) throw new IllegalArgumentException();
                grants.put(entry.getKey(), entry.getValue().asText());
            });
            return Map.copyOf(grants);
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "X-Catalog-Asset-Bind-Grants is invalid");
        }
    }

    private Object jsonBody(JsonNode value) { return mapper.convertValue(value, Object.class); }

    private void resolveBrandCandidateSource(ObjectNode request, com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback session, ResolvedCatalogScope target, String brandRef) {
        if (!"STORE".equals(target.dataNodeType())) throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "品牌复制候选仅支持门店目标");
        try {
            UUID source = catalogScopes.resolveCatalogCopySource(
                session.workspaceUuid(), session.groupWorkspaceKey(),
                "STORE", UUID.fromString(target.dataNodeRef()), brandRef
            );
            request.put("sourceDataNodeRef", source.toString());
        } catch (RuntimeException failure) {
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "当前门店没有可用的品牌商品复制来源");
        }
    }

    private void resolveBrandCopySource(String operationId, ObjectNode request, com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback session, ResolvedCatalogScope target, String brandRef) {
        if (!"preflightOperationsBrandCatalogCopy".equals(operationId) && !"executeOperationsBrandCatalogCopy".equals(operationId)) return;
        if (!"STORE".equals(target.dataNodeType())) throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "品牌复制仅支持门店目标");
        try {
            catalogScopes.resolveCatalogCopySource(session.workspaceUuid(), session.groupWorkspaceKey(), "STORE", UUID.fromString(target.dataNodeRef()), brandRef);
        } catch (RuntimeException failure) {
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "复制来源不属于当前品牌与目标门店的组织授权范围");
        }
    }

    private ResolvedCatalogScope resolvedScope(java.util.Collection<String> allowedDataNodeTypes, com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback session, ObjectNode request) {
        String selected = request.hasNonNull("dataNodeRef") ? request.path("dataNodeRef").asText("").trim() : "";
        var scope = session.scopeContext();
        List<ResolvedCatalogScope> candidates = new ArrayList<>();
        if (scope != null && scope.store() != null && allowedDataNodeTypes.contains(ServiceNodeTypes.STORE)) {
            candidates.add(new ResolvedCatalogScope(ServiceNodeTypes.STORE, scope.store().dataNodeId().toString()));
        }
        if (scope != null && scope.headCompany() != null && allowedDataNodeTypes.contains(ServiceNodeTypes.HEAD_COMPANY)) {
            candidates.add(new ResolvedCatalogScope(ServiceNodeTypes.HEAD_COMPANY, scope.headCompany().dataNodeId().toString()));
        }
        if (candidates.isEmpty()) throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "当前会话没有该操作允许的数据节点");
        if (!selected.isBlank()) {
            List<ResolvedCatalogScope> matched = candidates.stream().filter(candidate -> selected.equals(candidate.dataNodeRef())).toList();
            if (matched.size() == 1) return matched.get(0);
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "请求数据节点不属于当前会话或当前操作范围");
        }
        if (candidates.size() == 1) return candidates.get(0);
        throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "当前会话存在多个可用数据节点，必须明确 dataNodeRef");
    }

    private String resolvedBrand(HttpServletRequest request, com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback session, ResolvedCatalogScope scope) {
        Object trusted = request.getAttribute("v2s.trusted.brandRef");
        String requested = trusted == null ? request.getHeader("X-Workspace-Brand-Ref") : trusted.toString();
        try { return catalogScopes.requireCatalogBrand(session.workspaceUuid(), session.groupWorkspaceKey(), scope.dataNodeType(), UUID.fromString(scope.dataNodeRef()), requested); }
        catch (RuntimeException failure) { throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "当前会话没有已授权品牌"); }
    }

    private record ResolvedCatalogScope(String dataNodeType, String dataNodeRef) { }
    private record ReadRequest(ObjectNode request, com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback session,
                               ResolvedCatalogScope scope, String brandRef, String requestId, String headCompanyRef) {
        String dataNodeRef() { return scope.dataNodeRef(); }
        String dataNodeType() { return scope.dataNodeType(); }
        UUID workspaceUuid() { return session.workspaceUuid(); }
        String groupWorkspaceKey() { return session.groupWorkspaceKey(); }
    }

    private static String requestedBrandRef(HttpServletRequest request) {
        Object trusted = request.getAttribute("v2s.trusted.brandRef");
        return trusted == null ? request.getHeader("X-Workspace-Brand-Ref") : trusted.toString();
    }

    private static String requestId(HttpServletRequest request) { return first(request.getHeader("X-Request-Id"), UUID.randomUUID().toString()); }

    private static String required(ObjectNode request, String field) {
        String value = request.path(field).asText("");
        if (value.isBlank()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, field + " is required");
        return value;
    }

    private static String first(String value, String fallback) { return value == null || value.isBlank() ? fallback : value; }
}
