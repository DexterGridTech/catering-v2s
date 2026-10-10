package com.catering.v2s.app.edge.platform.terminalupdate;

import com.catering.v2s.app.edge.generated.wire.TerminalUpdateArtifactDetail;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateArtifactPage;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateArtifactRegisterRequest;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateArtifactSummary;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateStageResult;
import com.catering.v2s.app.edge.problem.ContractProblemAdvice;
import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.ArtifactReadback;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.ArtifactQuery;
import com.catering.v2s.terminalupdate.application.StageTerminalUpdateArtifactOperation;
import com.catering.v2s.terminalupdate.application.TerminalUpdateArtifactOwnerService;
import com.catering.v2s.terminalupdate.application.TerminalUpdateArtifactParser;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Platform-admin HTTP edge for validated immutable FULL/HOT publication artifacts. */
@RestController
@RequestMapping("/api/platform/group-workspaces/{groupWorkspaceKey}")
public final class PlatformTerminalUpdateArtifactController {
    private static final String USAGE = "TERMINAL_UPDATE_ARTIFACT";
    private static final tools.jackson.databind.ObjectMapper JSON = new tools.jackson.databind.ObjectMapper();

    private final PlatformSessionResolver sessions;
    private final WorkspaceAdministrationService workspaces;
    private final TerminalUpdateArtifactOwnerApi owner;
    private final StageTerminalUpdateArtifactOperation stageOperation;

    public PlatformTerminalUpdateArtifactController(
            PlatformSessionResolver sessions,
            WorkspaceAdministrationService workspaces,
            TerminalUpdateArtifactOwnerApi owner,
            StageTerminalUpdateArtifactOperation stageOperation) {
        this.sessions = sessions;
        this.workspaces = workspaces;
        this.owner = owner;
        this.stageOperation = stageOperation;
    }

    @PostMapping(value = "/terminal-update-artifact-stages", consumes = "multipart/form-data")
    ResponseEntity<TerminalUpdateStageResult> stage(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestPart("usage") String usage,
            @RequestPart("sha256") String sha256,
            @RequestPart("file") MultipartFile file) throws IOException {
        requireIdempotencyKey(idempotencyKey);
        if (!USAGE.equals(usage) || file == null || file.isEmpty() || file.getOriginalFilename() == null)
            throw new PlatformTerminalUpdateRequestInvalidException();
        var workspace = sessions.requireRead(request).requireEnabledSelectedWorkspace(workspaces, groupWorkspaceKey);
        var result = stageOperation.execute(workspace.workspaceUuid(), groupWorkspaceKey, file.getOriginalFilename(),
                sha256, file.getSize(), file.getInputStream(), idempotencyKey, sessions.requireActor(request));
        return ResponseEntity.status(HttpStatus.CREATED).body(new TerminalUpdateStageResult(
                result.stageRef(), result.stageBindGrant(), result.expiresAtEpochMillis(), result.fileName(),
                result.sha256(), result.byteSize(), result.candidateKind(), result.applicationId(), result.platform(),
                result.nativeVersion(), result.nativeBuildNumber(), result.bundleVersion(), result.runtimeVersion(),
                result.publicationId(), result.apkSha256(), result.minimumFull() == null
                        ? tools.jackson.databind.node.NullNode.getInstance()
                        : JSON.valueToTree(result.minimumFull())));
    }

    @PostMapping("/terminal-update-artifacts")
    ResponseEntity<TerminalUpdateArtifactDetail> register(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody TerminalUpdateArtifactRegisterRequest body) {
        requireIdempotencyKey(idempotencyKey);
        if (body == null || body.stageRef() == null || body.stageBindGrant() == null || body.kind() == null)
            throw new PlatformTerminalUpdateRequestInvalidException();
        var workspace = sessions.requireRead(request).requireEnabledSelectedWorkspace(workspaces, groupWorkspaceKey);
        ArtifactReadback result = owner.register(new TerminalUpdateArtifactOwnerApi.RegisterArtifact(
                workspace.workspaceUuid(), groupWorkspaceKey, body.stageRef(), sessions.requireActor(request),
                body.stageBindGrant(), body.kind(), body.minimumFullArtifactRef(), idempotencyKey));
        return ResponseEntity.status(HttpStatus.CREATED).body(detail(result));
    }

    @PostMapping("/terminal-update-artifact-stages/{stageRef}/release")
    ResponseEntity<Void> release(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID stageRef,
            @RequestHeader("X-Asset-Bind-Grant") String bindGrant) {
        var workspace = sessions.requireRead(request).requireEnabledSelectedWorkspace(workspaces, groupWorkspaceKey);
        owner.releaseStage(new TerminalUpdateArtifactOwnerApi.ReleaseStage(
                workspace.workspaceUuid(), groupWorkspaceKey, stageRef, sessions.requireActor(request), bindGrant));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/terminal-update-artifacts")
    TerminalUpdateArtifactPage page(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestParam(required = false) String kind,
            @RequestParam(required = false) String appId,
            @RequestParam(required = false) String runtimeVersion,
            @RequestParam(required = false) String queryText,
            @RequestParam(required = false) Long minimumFullNativeBuildNumber,
            @RequestParam(required = false) String minimumFullPublicationId,
            @RequestParam(required = false) String minimumFullApkSha256,
            @RequestParam(required = false) String cursor,
            @RequestParam int limit) {
        if (limit < 1 || limit > 100) throw new PlatformTerminalUpdateRequestInvalidException();
        UUID before = cursor == null ? null : parseCursor(cursor);
        ArtifactQuery filter;
        try {
            filter = new ArtifactQuery(kind, appId, runtimeVersion, queryText, minimumFullNativeBuildNumber,
                    minimumFullPublicationId, minimumFullApkSha256);
        } catch (IllegalArgumentException invalid) {
            throw new PlatformTerminalUpdateRequestInvalidException();
        }
        var workspace = sessions.requireRead(request).requireEnabledSelectedWorkspace(workspaces, groupWorkspaceKey);
        List<ArtifactReadback> values = owner
                .readPage(workspace.workspaceUuid(), groupWorkspaceKey, limit + 1, before, filter);
        boolean hasNext = values.size() > limit;
        List<ArtifactReadback> page = hasNext ? values.subList(0, limit) : values;
        tools.jackson.databind.JsonNode nextCursor = hasNext
                ? JSON.valueToTree(page.getLast().artifactRef().toString())
                : tools.jackson.databind.node.NullNode.getInstance();
        return new TerminalUpdateArtifactPage(page.stream().map(PlatformTerminalUpdateArtifactController::summary).toList(), nextCursor);
    }

    @GetMapping("/terminal-update-artifacts/{artifactRef}")
    TerminalUpdateArtifactDetail detail(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID artifactRef) {
        var workspace = sessions.requireRead(request).requireEnabledSelectedWorkspace(workspaces, groupWorkspaceKey);
        return detail(owner.read(workspace.workspaceUuid(), groupWorkspaceKey, artifactRef));
    }

    @ExceptionHandler(TerminalUpdateArtifactParser.InvalidArtifactException.class)
    ResponseEntity<ContractProblemAdvice.Problem> invalidPackage(
            TerminalUpdateArtifactParser.InvalidArtifactException failure, EdgeRequestContext request) {
        boolean dependency = failure.getMessage() != null && (failure.getMessage().startsWith("ANDROID_BUILD_TOOLS_")
                || failure.getMessage().startsWith("ANDROID_TOOL_UNAVAILABLE")
                || failure.getMessage().startsWith("ANDROID_TOOL_TIMEOUT"));
        return problem(dependency ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.UNPROCESSABLE_ENTITY,
                dependency ? "PLATFORM_DEPENDENCY_UNAVAILABLE" : "TERMINAL_UPDATE_ARTIFACT_INVALID", request);
    }

    @ExceptionHandler({PlatformTerminalUpdateRequestInvalidException.class,
            StageTerminalUpdateArtifactOperation.InvalidStagedArtifactException.class,
            PlatformAssetService.AssetInputInvalidException.class,
            TerminalUpdateArtifactOwnerService.TerminalUpdateArtifactInvalidException.class,
            TerminalUpdateArtifactOwnerService.TerminalUpdateMinimumFullInvalidException.class})
    ResponseEntity<ContractProblemAdvice.Problem> validation(RuntimeException failure, EdgeRequestContext request) {
        String code = failure instanceof TerminalUpdateArtifactOwnerService.TerminalUpdateMinimumFullInvalidException
                ? "TERMINAL_UPDATE_MINIMUM_FULL_INVALID"
                : "TERMINAL_UPDATE_ARTIFACT_INVALID";
        return problem(HttpStatus.UNPROCESSABLE_ENTITY, code, request);
    }

    @ExceptionHandler(TerminalUpdateArtifactOwnerService.TerminalUpdateStageExpiredException.class)
    ResponseEntity<ContractProblemAdvice.Problem> stageExpired(EdgeRequestContext request) {
        return problem(HttpStatus.CONFLICT, "TERMINAL_UPDATE_STAGE_EXPIRED", request);
    }

    @ExceptionHandler({TerminalUpdateArtifactOwnerService.TerminalUpdateStageNotFoundException.class,
            TerminalUpdateArtifactOwnerService.TerminalUpdateArtifactNotFoundException.class})
    ResponseEntity<ContractProblemAdvice.Problem> notFound(EdgeRequestContext request) {
        return problem(HttpStatus.NOT_FOUND, "PLATFORM_COMMON_RESOURCE_NOT_FOUND", request);
    }

    @ExceptionHandler(TerminalUpdateArtifactOwnerService.TerminalUpdateStageNotOwnedException.class)
    ResponseEntity<ContractProblemAdvice.Problem> stageNotOwned(EdgeRequestContext request) {
        return problem(HttpStatus.FORBIDDEN, "TERMINAL_UPDATE_STAGE_NOT_OWNED", request);
    }

    @ExceptionHandler({TerminalUpdateArtifactOwnerService.TerminalUpdateIdempotencyConflictException.class,
            TerminalUpdateArtifactOwnerService.TerminalUpdateStageConflictException.class})
    ResponseEntity<ContractProblemAdvice.Problem> conflict(EdgeRequestContext request) {
        return problem(HttpStatus.CONFLICT, "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT", request);
    }

    @ExceptionHandler(TerminalUpdateArtifactOwnerService.TerminalUpdatePublicationConflictException.class)
    ResponseEntity<ContractProblemAdvice.Problem> publicationConflict(EdgeRequestContext request) {
        return problem(HttpStatus.CONFLICT, "TERMINAL_UPDATE_PUBLICATION_CONFLICT", request);
    }

    @ExceptionHandler({PlatformAssetService.AssetStorageUnavailableException.class})
    ResponseEntity<ContractProblemAdvice.Problem> unavailable(EdgeRequestContext request) {
        return problem(HttpStatus.SERVICE_UNAVAILABLE, "PLATFORM_DEPENDENCY_UNAVAILABLE", request);
    }

    @ExceptionHandler(TerminalUpdateArtifactOwnerService.TerminalUpdateOwnerInvariantException.class)
    ResponseEntity<ContractProblemAdvice.Problem> invariant(EdgeRequestContext request) {
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION", request);
    }

    private static ResponseEntity<ContractProblemAdvice.Problem> problem(
            HttpStatus status, String code, EdgeRequestContext request) {
        return ContractProblemAdvice.problem(status, code, "终端更新工件请求未能完成", request);
    }

    private static void requireIdempotencyKey(String value) {
        if (value == null || value.length() < 16 || value.length() > 128)
            throw new PlatformTerminalUpdateRequestInvalidException();
    }

    private static UUID parseCursor(String cursor) {
        try { return UUID.fromString(cursor); }
        catch (RuntimeException invalid) { throw new PlatformTerminalUpdateRequestInvalidException(); }
    }

    private static TerminalUpdateArtifactDetail detail(ArtifactReadback value) {
        return new TerminalUpdateArtifactDetail(value.artifactRef(), value.kind(), value.applicationId(),
                value.runtimeVersion(), value.nativeBuildNumber(), value.nativeVersion(), value.bundleVersion(),
                value.publicationId(), value.apkSha256() == null
                        ? tools.jackson.databind.node.NullNode.getInstance() : JSON.valueToTree(value.apkSha256()),
                value.zipSha256(), value.byteSize(), value.createdAtEpochMillis(),
                value.minimumFullArtifactRef(), value.minimumFull() == null
                        ? tools.jackson.databind.node.NullNode.getInstance()
                        : JSON.valueToTree(value.minimumFull()));
    }

    private static TerminalUpdateArtifactSummary summary(ArtifactReadback value) {
        return new TerminalUpdateArtifactSummary(value.artifactRef(), value.kind(), value.applicationId(),
                value.runtimeVersion(), value.nativeBuildNumber(), value.nativeVersion(), value.bundleVersion(),
                value.publicationId(), value.apkSha256() == null
                        ? tools.jackson.databind.node.NullNode.getInstance() : JSON.valueToTree(value.apkSha256()),
                value.zipSha256(), value.byteSize(), value.createdAtEpochMillis());
    }

    public static final class PlatformTerminalUpdateRequestInvalidException extends RuntimeException {}
}
