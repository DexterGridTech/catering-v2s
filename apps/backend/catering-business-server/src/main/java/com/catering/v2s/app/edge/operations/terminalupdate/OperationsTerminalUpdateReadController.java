package com.catering.v2s.app.edge.operations.terminalupdate;

import com.catering.v2s.app.edge.generated.wire.TerminalUpdateArtifactCandidatePage;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateArtifactCandidateQuery;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateArtifactSummary;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateReportHistoryPage;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateReportHistoryPageItemsItem;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateReportHistoryPageItemsItemReferences;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateVersionDetail;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateVersionPage;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateVersionPageQuery;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateVersionReportItem;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.problem.ContractProblemAdvice;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.ArtifactQuery;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.ReportHistoryPage;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.VersionPage;
import com.catering.v2s.workspace.iam.api.WorkspaceAuthorizationCatalog;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationService;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Operations-admin read adapters for project candidates and committed terminal update reports. */
@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}")
public final class OperationsTerminalUpdateReadController {
    private static final tools.jackson.databind.ObjectMapper JSON = new tools.jackson.databind.ObjectMapper();

    private final OperationsSessionResolver sessions;
    private final OrganizationTaskPathLookup organization;
    private final TerminalUpdateArtifactOwnerApi artifacts;
    private final TerminalUpdateReportOwnerApi reports;

    public OperationsTerminalUpdateReadController(OperationsSessionResolver sessions,
            OrganizationTaskPathLookup organization, TerminalUpdateArtifactOwnerApi artifacts,
            TerminalUpdateReportOwnerApi reports) {
        this.sessions = sessions;
        this.organization = organization;
        this.artifacts = artifacts;
        this.reports = reports;
    }

    @GetMapping("/terminal-update-artifact-candidates")
    TerminalUpdateArtifactCandidatePage candidates(EdgeRequestContext request, @PathVariable String groupWorkspaceKey,
            @RequestParam long expectedContextVersion, @RequestParam UUID projectRef,
            @RequestParam(required = false) String queryText, @RequestParam(required = false) String kind,
            @RequestParam(required = false) String applicationId, @RequestParam(required = false) String runtimeVersion,
            @RequestParam(required = false) UUID minimumFullArtifactRef, @RequestParam(required = false) String cursor,
            @RequestParam int limit) {
        WorkspaceSessionReadback session = projectReadSession(request, groupWorkspaceKey, projectRef, expectedContextVersion);
        if (limit < 1 || limit > 100 || (cursor != null && cursor.length() > 512)) throw new InvalidQuery();
        UUID before = parseCursor(cursor);
        Long minBuild = null;
        String minPublication = null;
        String minApkHash = null;
        String candidateApplicationId = applicationId;
        String candidateRuntimeVersion = runtimeVersion;
        if (minimumFullArtifactRef != null) {
            var minimum = artifacts.read(session.workspaceUuid(), groupWorkspaceKey, minimumFullArtifactRef);
            if (!"HOT".equals(kind) || !"FULL".equals(minimum.kind()) || minimum.apkSha256() == null
                    || (applicationId != null && !applicationId.equals(minimum.applicationId()))
                    || (runtimeVersion != null && !runtimeVersion.equals(minimum.runtimeVersion())))
                throw new InvalidQuery();
            minBuild = minimum.nativeBuildNumber();
            minPublication = minimum.publicationId();
            minApkHash = minimum.apkSha256();
            candidateApplicationId = minimum.applicationId();
            candidateRuntimeVersion = minimum.runtimeVersion();
        }
        List<TerminalUpdateArtifactOwnerApi.ArtifactReadback> values = artifacts.readPage(session.workspaceUuid(),
                groupWorkspaceKey, limit + 1, before,
                new ArtifactQuery(kind, candidateApplicationId, candidateRuntimeVersion, queryText,
                        minBuild, minPublication, minApkHash));
        boolean more = values.size() > limit;
        List<TerminalUpdateArtifactOwnerApi.ArtifactReadback> page = more ? values.subList(0, limit) : values;
        tools.jackson.databind.JsonNode next = more
                ? JSON.valueToTree(page.getLast().artifactRef().toString())
                : tools.jackson.databind.node.NullNode.getInstance();
        return new TerminalUpdateArtifactCandidatePage(page.stream().map(OperationsTerminalUpdateReadController::summary).toList(), next);
    }

    @GetMapping("/projects/{projectRef}/terminal-versions")
    TerminalUpdateVersionPage versions(EdgeRequestContext request, @PathVariable String groupWorkspaceKey,
            @PathVariable UUID projectRef, @RequestParam long expectedContextVersion,
            @RequestParam(required = false) UUID storeRef, @RequestParam(required = false) String queryText,
            @RequestParam(required = false) String currentApkVersion, @RequestParam(required = false) String currentJsVersion,
            @RequestParam(required = false) String runtimeVersion, @RequestParam(required = false) String cursor,
            @RequestParam int limit) {
        WorkspaceSessionReadback session = projectReadSession(request, groupWorkspaceKey, projectRef, expectedContextVersion);
        if (storeRef != null) requireStoreInProject(session, groupWorkspaceKey, projectRef, storeRef);
        VersionPage page = reports.readVersionPage(new TerminalUpdateReportOwnerApi.VersionQuery(session.workspaceUuid(),
                groupWorkspaceKey, projectRef, storeRef, queryText, currentApkVersion, currentJsVersion, runtimeVersion,
                cursor, limit));
        return new TerminalUpdateVersionPage(page.items().stream().map(item -> new TerminalUpdateVersionReportItem(
                item.terminalRef(), item.terminalName(), item.storeRef(), item.storeName(), item.hasReport(),
                item.oldBinding(), json(item.actualJson()), json(item.recentJson()),
                nullable(item.receivedAtEpochMillis()))).toList(), nullable(page.nextCursor()));
    }

    @GetMapping("/projects/{projectRef}/terminal-versions/{terminalRef}")
    TerminalUpdateVersionDetail versionDetail(EdgeRequestContext request, @PathVariable String groupWorkspaceKey,
            @PathVariable UUID projectRef, @PathVariable UUID terminalRef,
            @RequestParam long expectedContextVersion) {
        WorkspaceSessionReadback session = projectReadSession(request, groupWorkspaceKey, projectRef, expectedContextVersion);
        var detail = reports.readVersionDetail(session.workspaceUuid(), groupWorkspaceKey, projectRef, terminalRef);
        tools.jackson.databind.JsonNode latest = null;
        boolean hasReport = detail.actualJson() != null;
        if (hasReport) {
            var object = JSON.createObjectNode();
            object.set("actual", json(detail.actualJson()));
            object.set("recent", json(detail.recentJson()));
            object.put("oldBinding", detail.oldBinding());
            latest = object;
        }
        return new TerminalUpdateVersionDetail(detail.terminalRef(), detail.terminalName(), detail.storeRef(),
                detail.storeName(), hasReport, latest, JSON.valueToTree(reportReferences(detail.latestReferences())),
                nullable(detail.historyCursor()), nullable(detail.receivedAtEpochMillis()));
    }

    @GetMapping("/projects/{projectRef}/terminal-versions/{terminalRef}/update-reports")
    TerminalUpdateReportHistoryPage history(EdgeRequestContext request, @PathVariable String groupWorkspaceKey,
            @PathVariable UUID projectRef, @PathVariable UUID terminalRef,
            @RequestParam long expectedContextVersion, @RequestParam(required = false) String cursor,
            @RequestParam int limit) {
        WorkspaceSessionReadback session = projectReadSession(request, groupWorkspaceKey, projectRef, expectedContextVersion);
        ReportHistoryPage page = reports.readHistory(session.workspaceUuid(), groupWorkspaceKey, projectRef,
                terminalRef, cursor, limit);
        return new TerminalUpdateReportHistoryPage(page.items().stream().map(item -> new TerminalUpdateReportHistoryPageItemsItem(
                item.reportId(), item.taskId(), item.reportSequence(),
                JSON.readValue(item.actualJson(), com.catering.v2s.app.edge.generated.wire.TerminalUpdateReportActual.class),
                JSON.readValue(item.recentJson(), com.catering.v2s.app.edge.generated.wire.TerminalUpdateReportRecent.class),
                reportReferences(item.references()), item.receivedAtEpochMillis())).toList(), nullable(page.nextCursor()));
    }

    @ExceptionHandler({InvalidQuery.class, TerminalUpdateReportOwnerApi.InvalidQueryException.class,
            com.catering.v2s.terminalupdate.application.persistence.TerminalUpdateReportPersistence.InvalidCursorException.class})
    ResponseEntity<ContractProblemAdvice.Problem> invalid(EdgeRequestContext request) {
        return ContractProblemAdvice.problem(HttpStatus.UNPROCESSABLE_ENTITY,
                "PLATFORM_COMMON_VALIDATION_FAILED", "终端更新查询条件无效", request);
    }

    @ExceptionHandler(TerminalUpdateReportOwnerApi.TargetNotFoundException.class)
    ResponseEntity<ContractProblemAdvice.Problem> notFound(EdgeRequestContext request) {
        return ContractProblemAdvice.problem(HttpStatus.NOT_FOUND,
                "PLATFORM_COMMON_RESOURCE_NOT_FOUND", "终端或项目不存在", request);
    }

    @ExceptionHandler(TerminalUpdateScopeMismatchException.class)
    ResponseEntity<ContractProblemAdvice.Problem> scopeMismatch(TerminalUpdateScopeMismatchException failure,
            EdgeRequestContext request) {
        return ContractProblemAdvice.problem(HttpStatus.FORBIDDEN,
                "TERMINAL_UPDATE_SCOPE_MISMATCH", "门店不属于当前项目", request);
    }

    @ExceptionHandler({IllegalArgumentException.class})
    ResponseEntity<ContractProblemAdvice.Problem> invalidArgument(IllegalArgumentException failure,
            EdgeRequestContext request) {
        return ContractProblemAdvice.problem(HttpStatus.UNPROCESSABLE_ENTITY,
                "PLATFORM_COMMON_VALIDATION_FAILED", "终端更新查询条件无效", request);
    }

    private WorkspaceSessionReadback projectReadSession(EdgeRequestContext request, String groupWorkspaceKey,
            UUID projectRef, long expectedContextVersion) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceReadAtContextVersion(
                request, groupWorkspaceKey, expectedContextVersion);
        if (!session.pageAccessKeys().contains(WorkspaceAuthorizationCatalog.PageDesignKeys.PG_PROJECT_TERMINAL_VERSION_RULES))
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        var path = organization.requireTaskPath(session.workspaceUuid(), groupWorkspaceKey, "PROJECT", projectRef);
        if (!organization.isScopeAllowed(session.workspaceUuid(), groupWorkspaceKey,
                session.assignmentNodeType(), session.assignmentNodeId(), path))
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        return session;
    }

    private void requireStoreInProject(WorkspaceSessionReadback session, String groupWorkspaceKey,
            UUID projectRef, UUID storeRef) {
        var memberships = organization.requireStoreProjectMemberships(session.workspaceUuid(), groupWorkspaceKey, List.of(storeRef));
        if (!projectRef.equals(memberships.get(storeRef))) throw new TerminalUpdateScopeMismatchException();
    }

    private static TerminalUpdateArtifactSummary summary(TerminalUpdateArtifactOwnerApi.ArtifactReadback value) {
        return new TerminalUpdateArtifactSummary(value.artifactRef(), value.kind(), value.applicationId(),
                value.runtimeVersion(), value.nativeBuildNumber(), value.nativeVersion(), value.bundleVersion(),
                value.publicationId(), nullable(value.apkSha256()), value.zipSha256(), value.byteSize(),
                value.createdAtEpochMillis());
    }

    private static TerminalUpdateReportHistoryPageItemsItemReferences reportReferences(
            TerminalUpdateReportOwnerApi.ReportReferences references) {
        return new TerminalUpdateReportHistoryPageItemsItemReferences(JSON.valueToTree(references.ruleTarget()),
                JSON.valueToTree(references.fullArtifactIdentity()), JSON.valueToTree(references.hotArtifactIdentity()));
    }

    private static tools.jackson.databind.JsonNode json(String value) {
        return value == null ? tools.jackson.databind.node.NullNode.getInstance() : JSON.readTree(value);
    }

    private static tools.jackson.databind.JsonNode nullable(String value) {
        return value == null ? tools.jackson.databind.node.NullNode.getInstance() : JSON.valueToTree(value);
    }

    private static tools.jackson.databind.JsonNode nullable(Long value) {
        return value == null ? tools.jackson.databind.node.NullNode.getInstance()
                : tools.jackson.databind.node.JsonNodeFactory.instance.numberNode(value);
    }

    private static UUID parseCursor(String cursor) {
        if (cursor == null) return null;
        try { return UUID.fromString(cursor); }
        catch (RuntimeException invalid) { throw new InvalidQuery(); }
    }

    public static final class InvalidQuery extends RuntimeException {}
    public static final class TerminalUpdateScopeMismatchException extends RuntimeException {}
}
