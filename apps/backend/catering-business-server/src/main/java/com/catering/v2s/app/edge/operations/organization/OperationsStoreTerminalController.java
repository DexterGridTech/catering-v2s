package com.catering.v2s.app.edge.operations.organization;

import com.catering.v2s.app.edge.generated.backendperformancem1.BackendPerformanceM1CommandExecutionBindings;
import com.catering.v2s.app.edge.generated.wire.StoreTerminalAreaCandidate;
import com.catering.v2s.app.edge.generated.wire.StoreTerminalAreaCandidatePage;
import com.catering.v2s.app.edge.generated.wire.StoreTerminalAreaReference;
import com.catering.v2s.app.edge.generated.wire.StoreTerminalConfiguration;
import com.catering.v2s.app.edge.generated.wire.StoreTerminalConfigurationInput;
import com.catering.v2s.app.edge.generated.wire.StoreTerminalCreateRequest;
import com.catering.v2s.app.edge.generated.wire.StoreTerminalDetail;
import com.catering.v2s.app.edge.generated.wire.StoreTerminalFunctionInput;
import com.catering.v2s.app.edge.generated.wire.StoreTerminalMutation;
import com.catering.v2s.app.edge.generated.wire.StoreTerminalPage;
import com.catering.v2s.app.edge.generated.wire.StoreTerminalPrinterBinding;
import com.catering.v2s.app.edge.generated.wire.StoreTerminalPrinterInput;
import com.catering.v2s.app.edge.generated.wire.StoreTerminalRangeSelection;
import com.catering.v2s.app.edge.generated.wire.StoreTerminalReplaceRequest;
import com.catering.v2s.app.edge.generated.wire.StoreTerminalSceneSelection;
import com.catering.v2s.app.edge.generated.wire.StoreTerminalStatus;
import com.catering.v2s.app.edge.generated.wire.StoreTerminalStatusRequest;
import com.catering.v2s.app.edge.generated.wire.StoreTerminalSummary;
import com.catering.v2s.app.edge.generated.wire.StoreTerminalTagCandidate;
import com.catering.v2s.app.edge.generated.wire.StoreTerminalTagCandidatePage;
import com.catering.v2s.app.edge.generated.wire.StoreTerminalTagReference;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi;
import com.catering.v2s.storeterminal.domain.ActivationCode;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationService;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

/** Operations-admin edge for the store terminal management surface. */
@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals")
public class OperationsStoreTerminalController {
    private static final String CAPABILITY = "EDIT_STORE_TERMINAL";
    private static final String REQ_CREATE = "REQ_POST_OPERATIONS_STORE_TERMINAL";
    private static final String REQ_REPLACE = "REQ_PUT_OPERATIONS_STORE_TERMINAL";
    private static final String REQ_STATUS = "REQ_POST_OPERATIONS_STORE_TERMINAL_STATUS";
    private static final int PAGE_SIZE = 20;
    private static final ObjectMapper OWNER_JSON = new ObjectMapper();
    private static final tools.jackson.databind.ObjectMapper WIRE_JSON = new tools.jackson.databind.ObjectMapper();

    private final OperationsSessionResolver sessions;
    private final WorkspaceUserService user;
    private final WorkspaceCapabilityScopeResolver capabilityScopes;
    private final StoreTerminalOwnerApi owner;
    private final BackendPerformanceM1CommandExecutionBindings m1Bindings;

    public OperationsStoreTerminalController(
            OperationsSessionResolver sessions,
            WorkspaceUserService user,
            WorkspaceCapabilityScopeResolver capabilityScopes,
            StoreTerminalOwnerApi owner,
            BackendPerformanceM1CommandExecutionBindings m1Bindings) {
        this.sessions = sessions;
        this.user = user;
        this.capabilityScopes = capabilityScopes;
        this.owner = owner;
        this.m1Bindings = m1Bindings;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public StoreTerminalPage list(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false, defaultValue = "20") int pageSize) {
        WorkspaceSessionReadback session = readSession(request, groupWorkspaceKey, storeRef);
        return page(owner.listTerminalPage(
                session.workspaceUuid(), groupWorkspaceKey, storeRef, query, cursor, pageSize20(pageSize)));
    }

    @GetMapping("/{terminalRef}")
    @Transactional(readOnly = true)
    public StoreTerminalDetail detail(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID terminalRef) {
        WorkspaceSessionReadback session = readSession(request, groupWorkspaceKey, storeRef);
        StoreTerminalOwnerApi.TerminalDetail value = owner.readTerminalDetail(
                session.workspaceUuid(), groupWorkspaceKey, storeRef, terminalRef);
        return detail(value);
    }

    @GetMapping("/area-candidates")
    @Transactional(readOnly = true)
    public StoreTerminalAreaCandidatePage areaCandidates(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false, defaultValue = "20") int pageSize) {
        WorkspaceSessionReadback session = readSession(request, groupWorkspaceKey, storeRef);
        return areaCandidates(owner.listAreaCandidates(
                session.workspaceUuid(), groupWorkspaceKey, storeRef, query, cursor, pageSize20(pageSize)));
    }

    @GetMapping("/tag-candidates")
    @Transactional(readOnly = true)
    public StoreTerminalTagCandidatePage tagCandidates(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false, defaultValue = "20") int pageSize) {
        WorkspaceSessionReadback session = readSession(request, groupWorkspaceKey, storeRef);
        return tagCandidates(owner.listTagCandidates(
                session.workspaceUuid(), groupWorkspaceKey, storeRef, query, cursor, pageSize20(pageSize)));
    }

    @PostMapping
    public ResponseEntity<StoreTerminalMutation> create(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody tools.jackson.databind.JsonNode body) {
        WorkspaceSessionReadback session = commandSession(request, groupWorkspaceKey);
        StoreTerminalCreateRequest input = strictBody(
                body,
                StoreTerminalCreateRequest.class,
                Set.of("name", "deviceType", "activationCode", "configuration"));
        StoreTerminalOwnerApi.TerminalMutation value = m1Bindings.bindPostOperationsStoreTerminal(
                new StoreTerminalOwnerApi.CreateCommand(
                        session.workspaceUuid(),
                        groupWorkspaceKey,
                        storeRef,
                        input.name(),
                        input.deviceType(),
                        activationCode(input.activationCode()),
                        configuration(input.configuration()),
                        idempotencyKey,
                        sessions.actor(session),
                        grant(session, REQ_CREATE, storeRef)));
        return ResponseEntity.status(HttpStatus.CREATED).body(mutation(value));
    }

    @PutMapping("/{terminalRef}")
    public StoreTerminalMutation replace(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID terminalRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody tools.jackson.databind.JsonNode body) {
        WorkspaceSessionReadback session = commandSession(request, groupWorkspaceKey);
        StoreTerminalReplaceRequest input = strictBody(
                body,
                StoreTerminalReplaceRequest.class,
                Set.of("name", "deviceType", "configuration", "expectedVersion"));
        StoreTerminalOwnerApi.TerminalMutation value = m1Bindings.bindPutOperationsStoreTerminal(
                new StoreTerminalOwnerApi.ReplaceCommand(
                        session.workspaceUuid(),
                        groupWorkspaceKey,
                        storeRef,
                        terminalRef,
                        input.name(),
                        input.deviceType(),
                        configuration(input.configuration()),
                        required(input.expectedVersion(), "expectedVersion"),
                        idempotencyKey,
                        sessions.actor(session),
                        grant(session, REQ_REPLACE, storeRef)));
        return mutation(value);
    }

    @PostMapping("/{terminalRef}/status")
    public StoreTerminalMutation status(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID terminalRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody tools.jackson.databind.JsonNode body) {
        WorkspaceSessionReadback session = commandSession(request, groupWorkspaceKey);
        StoreTerminalStatusRequest input = strictBody(
                body,
                StoreTerminalStatusRequest.class,
                Set.of("status", "expectedVersion"));
        StoreTerminalOwnerApi.TerminalMutation value = m1Bindings.bindPostOperationsStoreTerminalStatus(
                new StoreTerminalOwnerApi.StatusCommand(
                        session.workspaceUuid(),
                        groupWorkspaceKey,
                        storeRef,
                        terminalRef,
                        input.status().wire(),
                        required(input.expectedVersion(), "expectedVersion"),
                        idempotencyKey,
                        sessions.actor(session),
                        grant(session, REQ_STATUS, storeRef)));
        return mutation(value);
    }

    private WorkspaceSessionReadback readSession(EdgeRequestContext request, String groupWorkspaceKey, UUID storeRef) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceRead(request, groupWorkspaceKey);
        user.resolveTaskScope(session, ServiceNodeTypes.STORE, storeRef);
        return session;
    }

    private WorkspaceSessionReadback commandSession(EdgeRequestContext request, String groupWorkspaceKey) {
        return sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
    }

    private com.catering.v2s.organization.api.OperationsOwnerScopeGrant grant(
            WorkspaceSessionReadback session, String requirementId, UUID storeRef) {
        var resolution = capabilityScopes.resolveGeneratedOperation(
                session,
                requirementId,
                CAPABILITY,
                new WorkspaceCapabilityScopeResolver.ServerResolvedResource(ServiceNodeTypes.STORE, storeRef));
        if (resolution.decision() != WorkspaceCapabilityScopeResolver.Decision.ALLOW)
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        return resolution.ownerScopeGrant(requirementId);
    }

    private static StoreTerminalPage page(StoreTerminalOwnerApi.TerminalPage value) {
        return new StoreTerminalPage(
                value.items().stream().map(OperationsStoreTerminalController::summary).toList(),
                json(value.nextCursor()),
                value.total());
    }

    private static StoreTerminalSummary summary(StoreTerminalOwnerApi.TerminalSummary value) {
        return new StoreTerminalSummary(
                value.terminalRef(), value.name(), value.deviceType(), status(value.status()), value.version(), value.updatedAt());
    }

    private static StoreTerminalDetail detail(StoreTerminalOwnerApi.TerminalDetail value) {
        return new StoreTerminalDetail(
                value.terminalRef(),
                value.storeRef(),
                value.name(),
                value.deviceType(),
                status(value.status()),
                value.version(),
                value.createdAt(),
                value.updatedAt(),
                value.activationCode(),
                configuration(value.configuration()),
                value.areaReferences().stream()
                        .map(item -> new StoreTerminalAreaReference(
                                item.areaRef(), item.name(), item.code(), item.areaType(), status(item.status())))
                        .toList(),
                value.tagReferences().stream()
                        .map(item -> new StoreTerminalTagReference(
                                item.tagRef(), item.name(), item.code(), status(item.status())))
                        .toList());
    }

    private static StoreTerminalMutation mutation(StoreTerminalOwnerApi.TerminalMutation value) {
        return new StoreTerminalMutation(value.terminalRef(), value.version(), status(value.status()));
    }

    private static StoreTerminalAreaCandidatePage areaCandidates(StoreTerminalOwnerApi.CandidatePage<StoreTerminalOwnerApi.AreaCandidate> value) {
        return new StoreTerminalAreaCandidatePage(
                value.items().stream().map(item -> new StoreTerminalAreaCandidate(item.areaRef(), item.name(), item.code())).toList(),
                json(value.nextCursor()),
                value.total());
    }

    private static StoreTerminalTagCandidatePage tagCandidates(StoreTerminalOwnerApi.CandidatePage<StoreTerminalOwnerApi.TagCandidate> value) {
        return new StoreTerminalTagCandidatePage(
                value.items().stream().map(item -> new StoreTerminalTagCandidate(
                        item.tagRef(), item.name(), item.code(), status(item.status()))).toList(),
                json(value.nextCursor()),
                value.total());
    }

    private static StoreTerminalStatus status(String value) {
        try {
            return StoreTerminalStatus.valueOf(value);
        } catch (RuntimeException failure) {
            throw new IllegalStateException("owner returned unsupported terminal status", failure);
        }
    }

    private static tools.jackson.databind.JsonNode json(String value) {
        return value == null ? null : WIRE_JSON.valueToTree(value);
    }

    private static StoreTerminalConfiguration configuration(com.fasterxml.jackson.databind.JsonNode value) {
        try {
            return WIRE_JSON.treeToValue(WIRE_JSON.readTree(value == null ? "{}" : value.toString()), StoreTerminalConfiguration.class);
        } catch (Exception failure) {
            throw new IllegalStateException("owner returned invalid terminal configuration", failure);
        }
    }

    private static com.fasterxml.jackson.databind.JsonNode configuration(StoreTerminalConfigurationInput input) {
        StoreTerminalConfigurationInput value = Objects.requireNonNull(input, "configuration");
        ObjectNode root = OWNER_JSON.createObjectNode();
        ArrayNode printers = root.putArray("printers");
        for (StoreTerminalPrinterInput printer : requiredList(value.printers(), "printers")) {
            if (printer == null) throw new InvalidEdgeRequestException("printer is required");
            ObjectNode node = printers.addObject();
            childIdentity(node, printer.ref(), printer.clientKey());
            node.put("name", requiredText(printer.name(), "printer.name"));
            node.put("brandKey", requiredText(printer.brandKey(), "printer.brandKey"));
            node.put("modelKey", requiredText(printer.modelKey(), "printer.modelKey"));
            node.put("paperSpecKey", requiredText(printer.paperSpecKey(), "printer.paperSpecKey"));
            node.put("connectionMethodKey", requiredText(printer.connectionMethodKey(), "printer.connectionMethodKey"));
            putOptional(node, "connectionParameter", printer.connectionParameter());
        }

        ArrayNode functions = root.putArray("functions");
        for (StoreTerminalFunctionInput function : requiredList(value.functions(), "functions")) {
            if (function == null) throw new InvalidEdgeRequestException("function is required");
            ObjectNode node = functions.addObject();
            childIdentity(node, function.ref(), function.clientKey());
            node.put("functionKey", requiredText(function.functionKey(), "function.functionKey"));
            ArrayNode ranges = node.putArray("ranges");
            for (StoreTerminalRangeSelection range : requiredList(function.ranges(), "function.ranges")) {
                if (range == null) throw new InvalidEdgeRequestException("range is required");
                ObjectNode rangeNode = ranges.addObject()
                        .put("key", requiredText(range.key(), "range.key"))
                        .put("all", Boolean.TRUE.equals(range.all()));
                ArrayNode refs = rangeNode.putArray("refs");
                for (UUID ref : requiredList(range.refs(), "range.refs")) {
                    if (ref == null) throw new InvalidEdgeRequestException("range ref is required");
                    refs.add(ref.toString());
                }
            }
            ArrayNode scenes = node.putArray("scenes");
            for (StoreTerminalSceneSelection scene : requiredList(function.scenes(), "function.scenes")) {
                if (scene == null) throw new InvalidEdgeRequestException("scene is required");
                ObjectNode sceneNode = scenes.addObject()
                        .put("sceneKey", requiredText(scene.sceneKey(), "scene.sceneKey"));
                ArrayNode orderTypes = sceneNode.putArray("orderTypes");
                for (String orderType : requiredList(scene.orderTypes(), "scene.orderTypes"))
                    orderTypes.add(requiredText(orderType, "scene.orderType"));
                ArrayNode bindings = sceneNode.putArray("printers");
                for (StoreTerminalPrinterBinding binding : requiredList(scene.printers(), "scene.printers")) {
                    if (binding == null) throw new InvalidEdgeRequestException("printer binding is required");
                    ObjectNode bindingNode = bindings.addObject();
                    childIdentity(bindingNode, binding.printerRef(), binding.printerClientKey(), "printerRef", "printerClientKey");
                }
            }
        }
        return root;
    }

    private static void childIdentity(ObjectNode node, UUID ref, String clientKey) {
        childIdentity(node, ref, clientKey, "ref", "clientKey");
    }

    private static void childIdentity(ObjectNode node, UUID ref, String clientKey, String refName, String clientKeyName) {
        if ((ref == null) == (clientKey == null || clientKey.isBlank()))
            throw new InvalidEdgeRequestException("child identity is invalid");
        if (ref != null) node.put(refName, ref.toString());
        else node.put(clientKeyName, clientKey);
    }

    private static void putOptional(ObjectNode node, String field, JsonNode value) {
        if (value == null || value.isNull()) return;
        if (!value.isTextual()) throw new InvalidEdgeRequestException(field + " is invalid");
        node.put(field, value.textValue());
    }

    private static <T> List<T> requiredList(List<T> value, String field) {
        if (value == null) throw new InvalidEdgeRequestException(field + " is required");
        return value;
    }

    private static String requiredText(String value, String field) {
        if (value == null || value.isBlank()) throw new InvalidEdgeRequestException(field + " is invalid");
        return value;
    }

    private static ActivationCode activationCode(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return ActivationCode.of(value);
        } catch (IllegalArgumentException failure) {
            throw new InvalidEdgeRequestException("activationCode is invalid", failure);
        }
    }

    private static int pageSize20(int value) {
        if (value != PAGE_SIZE) throw new InvalidEdgeRequestException("pageSize must be 20");
        return value;
    }

    private static long required(Long value, String field) {
        if (value == null) throw new InvalidEdgeRequestException(field + " is required");
        return value;
    }

    private static <T> T strictBody(
            tools.jackson.databind.JsonNode body, Class<T> type, Set<String> allowedProperties) {
        if (body == null || !body.isObject()) throw new InvalidEdgeRequestException("request body is required");
        for (var entry : body.properties()) {
            String field = entry.getKey();
            if (!allowedProperties.contains(field))
                throw new InvalidEdgeRequestException("unknown request property " + field);
        }
        try {
            return WIRE_JSON.treeToValue(body, type);
        } catch (Exception failure) {
            throw new InvalidEdgeRequestException("request body is invalid", failure);
        }
    }
}
