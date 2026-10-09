package com.catering.v2s.app.edge.terminal;

import com.catering.v2s.app.edge.generated.wire.TerminalUpdateArtifactSummary;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateRuleSnapshotItem;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateRuleSnapshotPage;
import com.catering.v2s.organization.application.OperationsOrganizationTaskReadService;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi.RuleSnapshotItem;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Terminal-only project rule snapshot; it returns owner facts without exposing mutable administration state. */
@RestController
@RequestMapping("/api/terminal/group-workspaces/{groupWorkspaceKey}/update-rules/projects/{projectRef}")
public final class TerminalUpdateRuleReadController {
    private static final Logger log = LoggerFactory.getLogger(TerminalUpdateRuleReadController.class);
    private static final tools.jackson.databind.ObjectMapper JSON = new tools.jackson.databind.ObjectMapper();
    private final TerminalCredentialVerificationApi credentials;
    private final OperationsOrganizationTaskReadService organization;
    private final TerminalUpdateRuleOwnerApi rules;

    public TerminalUpdateRuleReadController(TerminalCredentialVerificationApi credentials,
            OperationsOrganizationTaskReadService organization, TerminalUpdateRuleOwnerApi rules) {
        this.credentials = credentials;
        this.organization = organization;
        this.rules = rules;
    }

    @GetMapping
    public TerminalUpdateRuleSnapshotPage snapshot(@PathVariable String groupWorkspaceKey,
            @PathVariable UUID projectRef,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-Terminal-Ref", required = false) String terminalRef,
            @RequestHeader(value = "X-Terminal-Device-Id", required = false) String deviceId,
            @RequestParam(required = false) String cursor,
            @RequestParam int limit,
            @RequestParam(required = false) String collectionHash) {
        Verification binding = TerminalCredentialEdgeVerifier.verify(credentials, groupWorkspaceKey,
                authorization, terminalRef, deviceId);
        var store = organization.store(binding.workspaceUuid(), groupWorkspaceKey, binding.storeRef());
        if (!store.project().id().equals(projectRef)) throw TerminalDataReadProblem.denied();
        var page = rules.terminalSnapshot(binding.workspaceUuid(), groupWorkspaceKey, projectRef,
                cursor, limit, collectionHash);
        log.atInfo().addKeyValue("event", "TERMINAL_UPDATE_RULE_SNAPSHOT_READ")
                .addKeyValue("terminalRef", binding.terminalRef()).addKeyValue("projectRef", projectRef)
                .addKeyValue("itemCount", page.items().size()).log("Terminal update rules read");
        return new TerminalUpdateRuleSnapshotPage(page.items().stream()
                .map(TerminalUpdateRuleReadController::wire).toList(), page.collectionHash(), nullable(page.nextCursor()));
    }

    private static TerminalUpdateRuleSnapshotItem wire(RuleSnapshotItem item) {
        return new TerminalUpdateRuleSnapshotItem(item.ruleRef(), item.targetMode(), item.storeRefs(),
                item.applicationId(), item.createdAtEpochMillis(), artifact(item.full()), item.hot() == null ? nullable((String) null)
                        : JSON.valueToTree(artifact(item.hot())),
                item.nSeconds(), item.hotStrategy(), nullable(item.mSeconds()), nullable(item.description()));
    }

    private static TerminalUpdateArtifactSummary artifact(TerminalUpdateRuleOwnerApi.SnapshotArtifact artifact) {
        return new TerminalUpdateArtifactSummary(artifact.artifactRef(), artifact.kind(), artifact.applicationId(),
                artifact.runtimeVersion(), artifact.nativeBuildNumber(), artifact.apkVersion(), artifact.jsVersion(),
                artifact.publicationId(), artifact.zipSha256(), artifact.byteSize(), artifact.createdAtEpochMillis());
    }

    private static tools.jackson.databind.JsonNode nullable(String value) {
        return value == null ? tools.jackson.databind.node.NullNode.getInstance()
                : tools.jackson.databind.node.JsonNodeFactory.instance.textNode(value);
    }

    private static tools.jackson.databind.JsonNode nullable(Long value) {
        return value == null ? tools.jackson.databind.node.NullNode.getInstance()
                : tools.jackson.databind.node.JsonNodeFactory.instance.numberNode(value);
    }
}
