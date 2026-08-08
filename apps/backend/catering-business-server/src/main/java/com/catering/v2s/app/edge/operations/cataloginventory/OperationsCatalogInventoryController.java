package com.catering.v2s.app.edge.operations.cataloginventory;

import com.catering.v2s.app.application.cataloginventory.CatalogInventoryApplicationService;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.io.IOException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
    private final CatalogInventoryApplicationService application;
    private final OperationsSessionResolver sessions;
    private final CatalogScopeLookup catalogScopes;
    private final ObjectMapper mapper;
    private final CatalogInventoryOperationRegistry operationRegistry = new CatalogInventoryOperationRegistry();

    public OperationsCatalogInventoryController(CatalogInventoryApplicationService application, OperationsSessionResolver sessions, CatalogScopeLookup catalogScopes, ObjectMapper mapper) {
        this.application = application; this.sessions = sessions; this.catalogScopes = catalogScopes; this.mapper = mapper;
    }

    @GetMapping({"/workbench/context", "/navigation", "/items", "/items/{itemCode}", "/dictionaries/{dictionaryKind}", "/production-tags", "/copy/local/candidates", "/copy/brand/candidates", "/inventory-targets", "/inventory-targets/{targetRef}", "/inventory-targets/{targetRef}/changes", "/inventory-targets/{targetRef}/business-history", "/inventory-targets/{targetRef}/consumption-references", "/inventory-targets/{targetRef}/ledger", "/inventory-targets/{targetRef}/diagnostics", "/shape-manifest"})
    public ResponseEntity<Object> get(EdgeRequestContext context, HttpServletRequest http, @RequestParam Map<String, String> query, @PathVariable Map<String, String> path) {
        String operationId = operationRegistry.resolve("GET", http.getRequestURI()); ObjectNode request = mapper.createObjectNode(); query.forEach(request::put); path.forEach(request::put); return respond(operationId, context, http, request, null);
    }

    @PostMapping({"/items", "/items/{itemCode}/status", "/categories", "/categories/{categoryCode}/move", "/categories/{categoryCode}/status", "/dictionaries/{dictionaryKind}/entries", "/dictionaries/{dictionaryKind}/entries/reorder", "/dictionaries/{dictionaryKind}/entries/{entryCode}/status", "/production-tags", "/production-tags/{tagCode}/status", "/copy/local/preflight", "/copy/local/execute", "/items/{itemCode}/temporary-promotion/preflight", "/items/{itemCode}/temporary-promotion/execute", "/copy/brand/preflight", "/copy/brand/execute", "/inventory-targets/{targetRef}/count", "/inventory-targets/{targetRef}/increase", "/inventory-targets/{targetRef}/adjust", "/assets/{assetRef}/release"})
    public ResponseEntity<Object> post(EdgeRequestContext context, HttpServletRequest http, @RequestBody(required = false) Map<String, Object> body, @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey, @PathVariable Map<String, String> path) {
        ObjectNode request = body == null ? mapper.createObjectNode() : mapper.valueToTree(body); path.forEach(request::put); return respond(operationRegistry.resolve("POST", http.getRequestURI()), context, http, request, idempotencyKey);
    }

    @PostMapping(value = "/assets/stage", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Object> stageAsset(EdgeRequestContext context, HttpServletRequest http,
                                                @RequestPart("content") MultipartFile content,
                                                @RequestParam("fileName") String fileName,
                                                @RequestParam("mediaType") String mediaType,
                                                @RequestParam("contentDigest") String contentDigest,
                                                @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        var session = sessions.require(context);
        ObjectNode noPath = mapper.createObjectNode();
        String dataNodeRef = resolvedDataNode(session, noPath);
        resolvedBrand(http, session, dataNodeRef);
        if (idempotencyKey == null || idempotencyKey.isBlank()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "Idempotency-Key is required");
        final byte[] bytes;
        try { bytes = content.getBytes(); }
        catch (IOException failure) { throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "asset content could not be read"); }
        return ResponseEntity.<Object>ok(jsonBody(application.stageAsset(dataNodeRef, fileName, mediaType, contentDigest, bytes,
            first(http.getHeader("X-Request-Id"), UUID.randomUUID().toString()), idempotencyKey,
            http.getHeader("X-Catalog-Test-Failure-Point"))));
    }

    @PatchMapping({"/items/{itemCode}", "/categories/{categoryCode}", "/dictionaries/{dictionaryKind}/entries/{entryCode}", "/production-tags/{tagCode}", "/inventory-targets/{targetRef}/configuration"})
    public ResponseEntity<Object> patch(EdgeRequestContext context, HttpServletRequest http, @RequestBody(required = false) Map<String, Object> body, @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey, @PathVariable Map<String, String> path) {
        ObjectNode request = body == null ? mapper.createObjectNode() : mapper.valueToTree(body); path.forEach(request::put); return respond(operationRegistry.resolve("PATCH", http.getRequestURI()), context, http, request, idempotencyKey);
    }

    private ResponseEntity<Object> respond(String operationId, EdgeRequestContext context, HttpServletRequest http, ObjectNode request, String idempotencyKey) {
        var session = sessions.require(context);
        String dataNodeRef = resolvedDataNode(session, request);
        String brandRef = resolvedBrand(http, session, dataNodeRef);
        String requestId = first(http.getHeader("X-Request-Id"), UUID.randomUUID().toString());
        resolveBrandCandidateSource(operationId, request, session, dataNodeRef, brandRef);
        resolveBrandCopySource(operationId, request, session, dataNodeRef, brandRef);
        if (!"GET".equalsIgnoreCase(http.getMethod()) && (idempotencyKey == null || idempotencyKey.isBlank())) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "Idempotency-Key is required");
        boolean diagnosticsGranted = session.actionCapabilityKeys().contains("READ_INVENTORY_ADVANCED_DIAGNOSTICS");
        var scope = session.scopeContext();
        String dataNodeType = scope != null && scope.store() != null
            ? com.catering.v2s.platform.foundation.contract.ServiceNodeTypes.STORE
            : scope != null && scope.headCompany() != null
                ? com.catering.v2s.platform.foundation.contract.ServiceNodeTypes.HEAD_COMPANY : null;
        String headCompanyRef = scope != null && scope.headCompany() != null ? scope.headCompany().dataNodeId().toString() : null;
        return ResponseEntity.ok(jsonBody(application.dispatch(operationId, dataNodeRef, brandRef, request, requestId, idempotencyKey, diagnosticsGranted,
            session.workspaceUuid(), session.groupWorkspaceKey(), dataNodeType, headCompanyRef, http.getHeader("X-Catalog-Test-Failure-Point"))));
    }

    private Object jsonBody(JsonNode value) { return mapper.convertValue(value, Object.class); }

    private void resolveBrandCandidateSource(String operationId, ObjectNode request, com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback session, String targetDataNodeRef, String brandRef) {
        if (!"getOperationsBrandCatalogCopyCandidates".equals(operationId)) return;
        try {
            UUID source = catalogScopes.resolveCatalogCopySource(
                session.workspaceUuid(), session.groupWorkspaceKey(),
                com.catering.v2s.platform.foundation.contract.ServiceNodeTypes.STORE,
                UUID.fromString(targetDataNodeRef), brandRef
            );
            request.put("sourceDataNodeRef", source.toString());
        } catch (RuntimeException failure) {
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "当前门店没有可用的品牌商品复制来源");
        }
    }

    private void resolveBrandCopySource(String operationId, ObjectNode request, com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback session, String targetDataNodeRef, String brandRef) {
        if (!"preflightOperationsBrandCatalogCopy".equals(operationId) && !"executeOperationsBrandCatalogCopy".equals(operationId)) return;
        try {
            var scope = session.scopeContext();
            String targetType = scope != null && scope.store() != null ? com.catering.v2s.platform.foundation.contract.ServiceNodeTypes.STORE : null;
            if (targetType == null) throw new IllegalArgumentException("target is not a store");
            catalogScopes.resolveCatalogCopySource(session.workspaceUuid(), session.groupWorkspaceKey(), targetType, UUID.fromString(targetDataNodeRef), brandRef);
        } catch (RuntimeException failure) {
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "复制来源不属于当前品牌与目标门店的组织授权范围");
        }
    }

    private String resolvedDataNode(com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback session, ObjectNode request) {
        String selected = request.hasNonNull("dataNodeRef") ? request.path("dataNodeRef").asText() : null;
        var scope = session.scopeContext();
        String sessionNode = scope != null && scope.store() != null ? scope.store().dataNodeId().toString() : scope != null && scope.headCompany() != null ? scope.headCompany().dataNodeId().toString() : null;
        if (sessionNode == null) throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "当前会话没有商品或库存数据节点");
        if (selected != null && !selected.equals(sessionNode)) throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "请求数据节点不属于当前会话");
        return sessionNode;
    }

    private String resolvedBrand(HttpServletRequest request, com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback session, String dataNodeRef) {
        Object trusted = request.getAttribute("v2s.trusted.brandRef");
        String requested = trusted == null ? request.getHeader("X-Workspace-Brand-Ref") : trusted.toString();
        var scope = session.scopeContext();
        String dataNodeType = scope != null && scope.store() != null ? com.catering.v2s.platform.foundation.contract.ServiceNodeTypes.STORE : scope != null && scope.headCompany() != null ? com.catering.v2s.platform.foundation.contract.ServiceNodeTypes.HEAD_COMPANY : null;
        if (dataNodeType == null) throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "当前会话没有已解析品牌数据节点");
        try { return catalogScopes.requireCatalogBrand(session.workspaceUuid(), session.groupWorkspaceKey(), dataNodeType, UUID.fromString(dataNodeRef), requested); }
        catch (RuntimeException failure) { throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "当前会话没有已授权品牌"); }
    }

    private static String first(String value, String fallback) { return value == null || value.isBlank() ? fallback : value; }
}
