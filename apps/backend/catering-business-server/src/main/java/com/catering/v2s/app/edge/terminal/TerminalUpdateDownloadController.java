package com.catering.v2s.app.edge.terminal;

import com.catering.v2s.app.edge.generated.wire.TerminalUpdateDownloadGrantResult;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateDownloadGrantResultArtifact;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateDownloadGrantResultArtifactFilesItem;
import com.catering.v2s.app.edge.problem.ContractProblemAdvice;
import com.catering.v2s.platform.asset.api.TerminalUpdateAssetStorage;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi;
import com.catering.v2s.terminalupdate.application.TerminalUpdateArtifactOwnerService;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Short-lived grant issuance and grant-only streaming for immutable private update bytes. */
@RestController
@RequestMapping("/api/terminal/group-workspaces/{groupWorkspaceKey}/update-artifacts/{artifactRef}")
public final class TerminalUpdateDownloadController {
    private static final tools.jackson.databind.ObjectMapper JSON = new tools.jackson.databind.ObjectMapper();
    private static final Logger log = LoggerFactory.getLogger(TerminalUpdateDownloadController.class);
    private final TerminalCredentialVerificationApi credentials;
    private final TerminalUpdateArtifactOwnerApi artifacts;
    private final TerminalUpdateAssetStorage storage;

    public TerminalUpdateDownloadController(TerminalCredentialVerificationApi credentials,
            TerminalUpdateArtifactOwnerApi artifacts, TerminalUpdateAssetStorage storage) {
        this.credentials = credentials;
        this.artifacts = artifacts;
        this.storage = storage;
    }

    @PostMapping("/download-grant")
    public TerminalUpdateDownloadGrantResult issue(@PathVariable String groupWorkspaceKey,
            @PathVariable UUID artifactRef,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-Terminal-Ref", required = false) String terminalRef,
            @RequestHeader(value = "X-Terminal-Device-Id", required = false) String deviceId) {
        Verification binding = TerminalCredentialEdgeVerifier.verify(credentials, groupWorkspaceKey,
                authorization, terminalRef, deviceId);
        var grant = artifacts.issueDownloadGrant(binding, artifactRef);
        log.atInfo().addKeyValue("event", "TERMINAL_UPDATE_DOWNLOAD_GRANT_ISSUED")
                .addKeyValue("terminalRef", binding.terminalRef()).addKeyValue("artifactRef", artifactRef)
                .log("Terminal update download grant issued");
        return new TerminalUpdateDownloadGrantResult(grant.relativeContentPath(), grant.grant(),
                grant.expiresAtEpochMillis(), grant.artifactRef(), grant.zipSha256(), grant.byteSize(), artifact(grant.artifact()));
    }

    private static TerminalUpdateDownloadGrantResultArtifact artifact(
            TerminalUpdateArtifactOwnerApi.ArtifactManifest value) {
        return new TerminalUpdateDownloadGrantResultArtifact((long) value.schemaVersion(), value.platform(),
                value.applicationId(), value.nativeVersion(), value.nativeBuildNumber(), value.bundleVersion(),
                value.runtimeVersion(), value.entry(), value.files().stream().map(file ->
                        new TerminalUpdateDownloadGrantResultArtifactFilesItem(file.path(), file.sizeBytes(), file.sha256()))
                        .toList(), value.publicationId(), nullableTree(value.minimumFull()), nullableTree(value.apk()));
    }

    private static tools.jackson.databind.JsonNode nullableTree(Object value) {
        return value == null ? tools.jackson.databind.node.NullNode.getInstance() : JSON.valueToTree(value);
    }

    @GetMapping("/content")
    public ResponseEntity<StreamingResponseBody> content(@PathVariable String groupWorkspaceKey,
            @PathVariable UUID artifactRef,
            @RequestHeader("X-Terminal-Update-Grant") String grant) {
        TerminalUpdateArtifactOwnerApi.AuthorizedPackage authorized = artifacts.authorizeDownload(grant);
        if (!groupWorkspaceKey.equals(authorized.groupWorkspaceKey()) || !artifactRef.equals(authorized.artifactRef()))
            throw new TerminalUpdateArtifactOwnerService.TerminalUpdateArtifactNotAuthorizedException();
        StreamingResponseBody body = output -> {
            try (var content = storage.openTerminalUpdatePackage(authorized.workspaceUuid(),
                    authorized.groupWorkspaceKey(), authorized.assetRef(), false)) {
                if (content.sizeBytes() != authorized.byteSize() || !content.sha256().equals(authorized.zipSha256()))
                    throw new IOException("authorized terminal update package facts changed");
                content.content().transferTo(output);
                output.flush();
                log.atInfo().addKeyValue("event", "TERMINAL_UPDATE_DOWNLOAD_STREAMED")
                        .addKeyValue("artifactRef", artifactRef).addKeyValue("byteSize", authorized.byteSize())
                        .log("Terminal update package streamed");
            }
        };
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("application/zip"))
                .contentLength(authorized.byteSize()).header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(body);
    }

    @ExceptionHandler(TerminalUpdateArtifactOwnerService.TerminalUpdateArtifactNotAuthorizedException.class)
    ResponseEntity<ContractProblemAdvice.Problem> unauthorized(com.catering.v2s.app.edge.session.EdgeRequestContext request) {
        return problem(HttpStatus.FORBIDDEN, "TERMINAL_UPDATE_ARTIFACT_NOT_AUTHORIZED", request);
    }

    @ExceptionHandler(TerminalUpdateArtifactOwnerService.TerminalUpdateDownloadGrantExpiredException.class)
    ResponseEntity<ContractProblemAdvice.Problem> expired(com.catering.v2s.app.edge.session.EdgeRequestContext request) {
        return problem(HttpStatus.FORBIDDEN, "TERMINAL_UPDATE_GRANT_EXPIRED", request);
    }

    @ExceptionHandler(TerminalUpdateArtifactOwnerService.TerminalUpdateDownloadBusyException.class)
    ResponseEntity<ContractProblemAdvice.Problem> busy(com.catering.v2s.app.edge.session.EdgeRequestContext request) {
        return problem(HttpStatus.SERVICE_UNAVAILABLE, "TERMINAL_UPDATE_BUSY", request);
    }

    @ExceptionHandler(TerminalUpdateArtifactOwnerService.TerminalUpdateArtifactNotFoundException.class)
    ResponseEntity<ContractProblemAdvice.Problem> notFound(com.catering.v2s.app.edge.session.EdgeRequestContext request) {
        return problem(HttpStatus.NOT_FOUND, "PLATFORM_COMMON_RESOURCE_NOT_FOUND", request);
    }

    private static ResponseEntity<ContractProblemAdvice.Problem> problem(HttpStatus status, String code,
            com.catering.v2s.app.edge.session.EdgeRequestContext request) {
        return ContractProblemAdvice.problem(status, code, "终端更新工件请求未能完成", request);
    }
}
