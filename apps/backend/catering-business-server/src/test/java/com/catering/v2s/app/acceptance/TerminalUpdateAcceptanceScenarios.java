package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.HashSet;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/** Real platform HTTP oracles for package staging, publication, replay, scope, and rejection. */
final class TerminalUpdateAcceptanceScenarios {
    private final BackendAcceptanceTest host;

    TerminalUpdateAcceptanceScenarios(BackendAcceptanceTest host) {
        this.host = host;
    }

    static UUID createEnabledRuleForTopic(BackendAcceptanceTest host,
            BackendAcceptanceTest.ScenarioContext context, BackendAcceptanceTest.Fixture fixture) throws Exception {
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        String prefix = "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey();
        TerminalUpdateAcceptanceFixtures.Package full = TerminalUpdateAcceptanceFixtures.full();
        JsonNode staged = stage(context, prefix, platform.cookie(), full);
        JsonNode artifact = payload(context.post(PLATFORM_TERMINAL_UPDATE_ARTIFACT_REGISTER,
                prefix + "/terminal-update-artifacts", platform.cookie(),
                Map.of("stageRef", staged.path("stageRef").asText(),
                        "stageBindGrant", staged.path("stageBindGrant").asText(), "kind", "FULL"),
                Map.of("Idempotency-Key", "terminal-update-topic-full-" + UUID.randomUUID()), Set.of(201)).json());
        BackendAcceptanceTest.Fixture operator = host.projectUserFixture(fixture, Set.of("MANAGE_PROJECT_TERMINAL_VERSION"));
        host.completeInvitation(context, operator);
        BackendAcceptanceTest.Session operations = host.login(context, operator);
        String rulePath = "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey()
                + "/projects/" + fixture.projectId() + "/terminal-update-rules";
        return createRuleCoverageOnly(context, operator, operations, rulePath,
                artifact.path("artifactRef").asText(), fixture.storeId());
    }

    @AcceptanceScenario(
            id = "terminal-update.artifact-full-register-replay-and-scope",
            module = "TERMINAL_UPDATE",
            operation = "terminalUpdateArtifactLifecycle")
    void fullArtifactRegistrationReplayAndWorkspaceScope(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.WorkspaceFixture ownerWorkspace = host.workspaceOnly();
        BackendAcceptanceTest.WorkspaceFixture otherWorkspace = host.workspaceOnly();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        TerminalUpdateAcceptanceFixtures.Package full = TerminalUpdateAcceptanceFixtures.full();
        String ownerPrefix = "/api/platform/group-workspaces/" + ownerWorkspace.groupWorkspaceKey();
        String otherPrefix = "/api/platform/group-workspaces/" + otherWorkspace.groupWorkspaceKey();

        JsonNode staged = stage(context, ownerPrefix, platform.cookie(), full);
        String stageRef = staged.path("stageRef").asText();
        String bindGrant = staged.path("stageBindGrant").asText();
        assertDoesNotThrow(() -> UUID.fromString(stageRef), "BUSINESS: stage returns an opaque persisted stage identity");
        assertTrue(bindGrant.length() >= 32, "BUSINESS: uploader receives the one-time stage bind proof");
        assertEquals(full.sha256(), staged.path("sha256").asText(), "BUSINESS: stage confirms ZIP bytes and digest");
        assertEquals(full.bytes().length, staged.path("byteSize").asLong(), "BUSINESS: stage confirms exact byte count");

        String registerKey = "terminal-update-full-" + UUID.randomUUID();
        Map<String, Object> body = Map.of("stageRef", stageRef, "stageBindGrant", bindGrant, "kind", "FULL");
        BackendAcceptanceTest.Response crossWorkspace = context.post(
                PLATFORM_TERMINAL_UPDATE_ARTIFACT_REGISTER,
                otherPrefix + "/terminal-update-artifacts",
                platform.cookie(),
                body,
                Map.of("Idempotency-Key", registerKey),
                Set.of(404));
        assertEquals("PLATFORM_COMMON_RESOURCE_NOT_FOUND", crossWorkspace.problemCode(),
                "BUSINESS: stage reference and grant cannot move to another workspace");
        JsonNode otherPage = payload(context.get(
                PLATFORM_TERMINAL_UPDATE_ARTIFACT_PAGE,
                otherPrefix + "/terminal-update-artifacts?limit=100",
                platform.cookie(), Set.of(200)).json());
        assertEquals(0, otherPage.path("items").size(), "BUSINESS: rejected cross-workspace save creates no artifact");

        BackendAcceptanceTest.Response first = context.post(
                PLATFORM_TERMINAL_UPDATE_ARTIFACT_REGISTER,
                ownerPrefix + "/terminal-update-artifacts",
                platform.cookie(), body, Map.of("Idempotency-Key", registerKey), Set.of(201));
        JsonNode registered = payload(first.json());
        String artifactRef = registered.path("artifactRef").asText();
        assertTrue(!artifactRef.isBlank(), "BUSINESS: FULL registration returns its immutable artifact identity");
        assertEquals("FULL", registered.path("kind").asText(), "BUSINESS: registered kind comes from parsed APK facts");
        assertEquals(TerminalUpdateAcceptanceFixtures.APPLICATION_ID, registered.path("applicationId").asText(),
                "BUSINESS: registration reads application identity from the embedded package");
        assertEquals(full.publicationId(), registered.path("publicationId").asText(),
                "BUSINESS: registration preserves embedded publication identity");
        assertEquals(full.sha256(), registered.path("zipSha256").asText(), "BUSINESS: registration preserves ZIP digest");

        BackendAcceptanceTest.Response replay = context.post(
                PLATFORM_TERMINAL_UPDATE_ARTIFACT_REGISTER,
                ownerPrefix + "/terminal-update-artifacts",
                platform.cookie(), body, Map.of("Idempotency-Key", registerKey), Set.of(201));
        assertEquals(artifactRef, payload(replay.json()).path("artifactRef").asText(),
                "BUSINESS: same-key same-payload replay returns the original artifact");

        JsonNode detail = payload(context.get(
                PLATFORM_TERMINAL_UPDATE_ARTIFACT_DETAIL,
                ownerPrefix + "/terminal-update-artifacts/" + artifactRef,
                platform.cookie(), Set.of(200)).json());
        assertEquals(full.apkSha256(), detail.path("minimumFullFacts").path("apkSha256").asText(),
                "BUSINESS: FULL detail exposes only the validated APK identity facts");
        JsonNode audit = payload(context.get(
                PLATFORM_AUDIT_HISTORY,
                "/api/platform/audit-history?groupWorkspaceKey=" + ownerWorkspace.groupWorkspaceKey()
                        + "&entityType=TERMINAL_UPDATE_ARTIFACT&entityId=" + artifactRef,
                platform.cookie(), Set.of(200)).json());
        assertEquals(1, audit.path("items").size(), "BUSINESS: first registration writes one artifact audit event");
        assertEquals("REGISTER", audit.path("items").get(0).path("action").asText(),
                "BUSINESS: artifact audit records the register action");
        BackendAcceptanceTest.Response crossWorkspaceAudit = context.get(
                PLATFORM_AUDIT_HISTORY,
                "/api/platform/audit-history?groupWorkspaceKey=" + otherWorkspace.groupWorkspaceKey()
                        + "&entityType=TERMINAL_UPDATE_ARTIFACT&entityId=" + artifactRef,
                platform.cookie(), Set.of(404));
        assertEquals("PLATFORM_COMMON_RESOURCE_NOT_FOUND", crossWorkspaceAudit.problemCode(),
                "BUSINESS: artifact audit history is hidden outside its owner workspace");
    }

    @AcceptanceScenario(
            id = "terminal-update.artifact-hot-minimum-full",
            module = "TERMINAL_UPDATE",
            operation = "terminalUpdateHotArtifactPairing")
    void hotArtifactRequiresAndRetainsSelectedMinimumFull(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.WorkspaceFixture workspace = host.workspaceOnly();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        String prefix = "/api/platform/group-workspaces/" + workspace.groupWorkspaceKey();
        TerminalUpdateAcceptanceFixtures.Package full = TerminalUpdateAcceptanceFixtures.full();
        JsonNode stagedFull = stage(context, prefix, platform.cookie(), full);
        JsonNode savedFull = payload(context.post(
                PLATFORM_TERMINAL_UPDATE_ARTIFACT_REGISTER,
                prefix + "/terminal-update-artifacts",
                platform.cookie(),
                Map.of("stageRef", stagedFull.path("stageRef").asText(),
                        "stageBindGrant", stagedFull.path("stageBindGrant").asText(), "kind", "FULL"),
                Map.of("Idempotency-Key", "terminal-update-full-pair-" + UUID.randomUUID()), Set.of(201)).json());

        TerminalUpdateAcceptanceFixtures.Package hot = TerminalUpdateAcceptanceFixtures.hot(full);
        JsonNode stagedHot = stage(context, prefix, platform.cookie(), hot);
        BackendAcceptanceTest.Response saved = context.post(
                PLATFORM_TERMINAL_UPDATE_ARTIFACT_REGISTER,
                prefix + "/terminal-update-artifacts",
                platform.cookie(),
                Map.of("stageRef", stagedHot.path("stageRef").asText(),
                        "stageBindGrant", stagedHot.path("stageBindGrant").asText(),
                        "kind", "HOT", "minimumFullArtifactRef", savedFull.path("artifactRef").asText()),
                Map.of("Idempotency-Key", "terminal-update-hot-pair-" + UUID.randomUUID()), Set.of(201));
        JsonNode savedHot = payload(saved.json());
        assertEquals("HOT", savedHot.path("kind").asText(), "BUSINESS: HOT registration is parsed from its manifest");
        assertEquals(hot.publicationId(), savedHot.path("publicationId").asText(),
                "BUSINESS: HOT publication identity is derived from complete bundle bytes");
        assertEquals(savedFull.path("artifactRef").asText(), savedHot.path("minimumFullArtifactRef").asText(),
                "BUSINESS: HOT stores the exact selected minimum FULL reference");
        assertEquals(full.apkSha256(), savedHot.path("minimumFullFacts").path("apkSha256").asText(),
                "BUSINESS: HOT's required APK digest matches the selected FULL");
    }

    @AcceptanceScenario(
            id = "terminal-update.artifact-invalid-package-does-not-publish",
            module = "TERMINAL_UPDATE",
            operation = "terminalUpdateInvalidArtifact")
    void invalidPackageDoesNotBecomeAvailable(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.WorkspaceFixture workspace = host.workspaceOnly();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        String prefix = "/api/platform/group-workspaces/" + workspace.groupWorkspaceKey();
        BackendAcceptanceTest.Response rejected = context.multipartTerminalUpdatePackage(
                PLATFORM_TERMINAL_UPDATE_ARTIFACT_STAGE,
                prefix + "/terminal-update-artifact-stages", platform.cookie(),
                sha256(TerminalUpdateAcceptanceFixtures.invalidPackage()),
                TerminalUpdateAcceptanceFixtures.invalidPackage(),
                "terminal-update-invalid-" + UUID.randomUUID(), Set.of(422));
        assertEquals("TERMINAL_UPDATE_ARTIFACT_INVALID", rejected.problemCode(),
                "BUSINESS: non-ZIP input receives the package-invalid typed problem");
        JsonNode page = payload(context.get(
                PLATFORM_TERMINAL_UPDATE_ARTIFACT_PAGE,
                prefix + "/terminal-update-artifacts?limit=100", platform.cookie(), Set.of(200)).json());
        assertEquals(0, page.path("items").size(), "BUSINESS: rejected bytes do not create an available artifact");
    }

    @AcceptanceScenario(
            id = "terminal-update.rule-page-fixed-stores-and-stale-cursor",
            module = "TERMINAL_UPDATE",
            operation = "terminalUpdateRulePaging")
    void projectRulesPageFixedStoresAndRejectsStaleCursor(BackendAcceptanceTest.ScenarioContext context)
            throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("PROJECT",
                Set.of("PG-PROJECT-TERMINAL-VERSION-RULES"), Set.of("MANAGE_PROJECT_TERMINAL_VERSION"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session operations = host.login(context, fixture);
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        String workspacePrefix = "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey();
        TerminalUpdateAcceptanceFixtures.Package full = TerminalUpdateAcceptanceFixtures.full();
        JsonNode staged = stage(context, workspacePrefix, platform.cookie(), full);
        JsonNode artifact = payload(context.post(PLATFORM_TERMINAL_UPDATE_ARTIFACT_REGISTER,
                workspacePrefix + "/terminal-update-artifacts", platform.cookie(),
                Map.of("stageRef", staged.path("stageRef").asText(),
                        "stageBindGrant", staged.path("stageBindGrant").asText(), "kind", "FULL"),
                Map.of("Idempotency-Key", "terminal-update-rule-full-" + UUID.randomUUID()), Set.of(201)).json());

        UUID secondStore = host.createStoreCandidates(fixture, 1).getFirst();
        String rulePath = "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey()
                + "/projects/" + fixture.projectId() + "/terminal-update-rules";
        UUID firstRule = createRule(context, fixture, operations, rulePath, artifact.path("artifactRef").asText(),
                List.of(fixture.storeId(), secondStore), "DISABLED");
        UUID secondRule = createRule(context, fixture, operations, rulePath, artifact.path("artifactRef").asText(),
                List.of(fixture.storeId()), "DISABLED");

        String pageQuery = "?expectedContextVersion=" + operations.contextVersion() + "&limit=1";
        JsonNode firstPage = payload(context.get(OPERATIONS_TERMINAL_UPDATE_RULE_PAGE,
                rulePath + pageQuery, operations.cookie(), Set.of(200)).json());
        assertEquals(1, firstPage.path("items").size(), "BUSINESS: rule page returns only the requested page size");
        String cursor = firstPage.path("nextCursor").asText();
        assertFalse(cursor.isBlank(), "BUSINESS: two persisted rules produce a continuation cursor");

        String storesPath = rulePath + "/" + firstRule + "/stores";
        JsonNode firstStorePage = payload(context.get(OPERATIONS_TERMINAL_UPDATE_RULE_STORES,
                storesPath + "?expectedContextVersion=" + operations.contextVersion() + "&limit=1",
                operations.cookie(), Set.of(200)).json());
        assertEquals(1, firstStorePage.path("items").size(), "BUSINESS: fixed rule stores are server paged");
        assertFalse(firstStorePage.path("nextCursor").asText().isBlank(),
                "BUSINESS: two immutable store refs produce a continuation cursor");
        JsonNode secondStorePage = payload(context.get(OPERATIONS_TERMINAL_UPDATE_RULE_STORES,
                storesPath + "?expectedContextVersion=" + operations.contextVersion() + "&limit=1&cursor="
                        + java.net.URLEncoder.encode(firstStorePage.path("nextCursor").asText(),
                                java.nio.charset.StandardCharsets.UTF_8),
                operations.cookie(), Set.of(200)).json());
        assertEquals(1, secondStorePage.path("items").size(), "BUSINESS: fixed-ref cursor yields the remaining store");
        assertNotEquals(firstStorePage.path("items").get(0).path("storeRef").asText(),
                secondStorePage.path("items").get(0).path("storeRef").asText(),
                "BUSINESS: adjacent fixed-ref pages do not repeat a store");
        assertEquals(Set.of(fixture.storeId().toString(), secondStore.toString()),
                Set.of(firstStorePage.path("items").get(0).path("storeRef").asText(),
                        secondStorePage.path("items").get(0).path("storeRef").asText()),
                "BUSINESS: paged fixed-store readback equals the exact submitted store set");
        assertEquals("ENABLED", secondStorePage.path("items").get(0).path("status").asText(),
                "BUSINESS: fixed-ref page reads the current organization owner status");

        BackendAcceptanceTest.Response changed = context.post(
                OPERATIONS_TERMINAL_UPDATE_RULE_STATUS,
                rulePath + "/" + secondRule + "/status?expectedContextVersion=" + operations.contextVersion(),
                operations.cookie(), Map.of("revision", 1,
                        "status", "ENABLED", "reason", "acceptance enable"),
                Map.of("Idempotency-Key", "terminal-update-rule-status-" + UUID.randomUUID()), Set.of(200));
        assertEquals("ENABLED", payload(changed.json()).path("status").asText(),
                "BUSINESS: status mutation is persisted before a subsequent list read");
        BackendAcceptanceTest.Response stale = context.get(OPERATIONS_TERMINAL_UPDATE_RULE_PAGE,
                rulePath + pageQuery + "&cursor=" + java.net.URLEncoder.encode(cursor,
                        java.nio.charset.StandardCharsets.UTF_8), operations.cookie(), Set.of(409));
        assertEquals("PLATFORM_COMMON_VERSION_CONFLICT", stale.problemCode(),
                "BUSINESS: a cursor from the prior rule collection is rejected after mutation");
        JsonNode enabledPage = payload(context.get(OPERATIONS_TERMINAL_UPDATE_RULE_PAGE,
                rulePath + "?expectedContextVersion=" + operations.contextVersion() + "&status=ENABLED&limit=10",
                operations.cookie(), Set.of(200)).json());
        assertEquals(1, enabledPage.path("items").size(),
                "BUSINESS: status filter reflects the changed persisted rule and excludes disabled rules");
        assertEquals(secondRule.toString(), enabledPage.path("items").get(0).path("ruleRef").asText(),
                "BUSINESS: filtered page returns the rule whose owner status changed");
    }

    @AcceptanceScenario(
            id = "terminal-update.snapshot-grant-and-private-content",
            module = "TERMINAL_UPDATE",
            operation = "terminalUpdateDownloadAuthorization")
    void terminalSnapshotIssuesGrantAndRechecksBindingForPrivateContent(
            BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreTerminalAcceptanceScenarios.ConnectionFixture terminal =
                new StoreTerminalAcceptanceScenarios(host).createConnectionContractFixture(context);
        BackendAcceptanceTest.Fixture projectOperator = host.projectUserFixture(terminal.fixture(),
                Set.of("MANAGE_PROJECT_TERMINAL_VERSION"));
        host.completeInvitation(context, projectOperator);
        BackendAcceptanceTest.Session operations = host.login(context, projectOperator);
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        String workspacePrefix = "/api/platform/group-workspaces/" + terminal.fixture().groupWorkspaceKey();
        TerminalUpdateAcceptanceFixtures.Package full = TerminalUpdateAcceptanceFixtures.full();
        JsonNode staged = stage(context, workspacePrefix, platform.cookie(), full);
        JsonNode artifact = payload(context.post(PLATFORM_TERMINAL_UPDATE_ARTIFACT_REGISTER,
                workspacePrefix + "/terminal-update-artifacts", platform.cookie(),
                Map.of("stageRef", staged.path("stageRef").asText(),
                        "stageBindGrant", staged.path("stageBindGrant").asText(), "kind", "FULL"),
                Map.of("Idempotency-Key", "terminal-update-grant-full-" + UUID.randomUUID()), Set.of(201)).json());
        String rulePath = "/api/operations/group-workspaces/" + terminal.fixture().groupWorkspaceKey()
                + "/projects/" + terminal.fixture().projectId() + "/terminal-update-rules";
        UUID firstRule = createRule(context, projectOperator, operations, rulePath,
                artifact.path("artifactRef").asText(), List.of(terminal.fixture().storeId()), "ENABLED");
        Set<String> expectedRuleRefs = new HashSet<>();
        expectedRuleRefs.add(firstRule.toString());
        for (int index = 0; index < 100; index++) {
            expectedRuleRefs.add(createRuleCoverageOnly(context, projectOperator, operations, rulePath,
                    artifact.path("artifactRef").asText(), terminal.fixture().storeId()).toString());
        }

        Map<String, String> credentialHeaders = Map.of(
                "Authorization", "Terminal " + terminal.generation() + "." + terminal.credentialSecret(),
                "X-Terminal-Ref", terminal.terminalRef().toString(),
                "X-Terminal-Device-Id", terminal.deviceId());
        String snapshotBasePath = "/api/terminal/group-workspaces/" + terminal.fixture().groupWorkspaceKey()
                + "/update-rules/projects/" + terminal.fixture().projectId();
        String snapshotPath = snapshotBasePath + "?limit=100";
        JsonNode snapshot = payload(context.get(TERMINAL_UPDATE_RULE_SNAPSHOT, snapshotPath, null,
                credentialHeaders, Set.of(200)).json());
        assertEquals(100, snapshot.path("items").size(),
                "BUSINESS: terminal receives the first bounded page of the complete enabled project rule set");
        assertEquals(artifact.path("artifactRef").asText(), snapshot.path("items").get(0).path("full").path("artifactRef").asText(),
                "BUSINESS: snapshot fixes the persisted FULL artifact, not a local candidate");
        assertFalse(snapshot.path("items").get(0).has("revision"),
                "BUSINESS: terminal execution snapshot does not expose mutable administration CAS state");
        assertFalse(snapshot.path("items").get(0).has("updatedAtEpochMillis"),
                "BUSINESS: terminal execution snapshot does not expose mutable administration timestamps");
        assertTrue(snapshot.path("collectionHash").asText().matches("[a-f0-9]{64}"),
                "BUSINESS: snapshot exposes the owner membership hash used by continuation requests");
        String cursor = snapshot.path("nextCursor").asText();
        assertFalse(cursor.isBlank(), "BUSINESS: 101 enabled rules are not truncated at the first page");
        Set<String> observedRuleRefs = new HashSet<>();
        snapshot.path("items").forEach(item -> observedRuleRefs.add(item.path("ruleRef").asText()));
        String secondPagePath = snapshotBasePath + "?limit=100&cursor="
                + java.net.URLEncoder.encode(cursor, java.nio.charset.StandardCharsets.UTF_8)
                + "&collectionHash=" + snapshot.path("collectionHash").asText();
        JsonNode secondPage = payload(context.get(TERMINAL_UPDATE_RULE_SNAPSHOT, secondPagePath, null,
                credentialHeaders, Set.of(200)).json());
        assertEquals(1, secondPage.path("items").size(), "BUSINESS: continuation returns the 101st enabled rule");
        secondPage.path("items").forEach(item -> observedRuleRefs.add(item.path("ruleRef").asText()));
        assertEquals(expectedRuleRefs, observedRuleRefs,
                "BUSINESS: both snapshot pages equal the exact enabled rule identities without omissions");

        BackendAcceptanceTest.Response disabled = context.post(
                OPERATIONS_TERMINAL_UPDATE_RULE_STATUS,
                rulePath + "/" + firstRule + "/status?expectedContextVersion=" + operations.contextVersion(),
                operations.cookie(), Map.of("revision", 1, "status", "DISABLED", "reason", "snapshot stale proof"),
                Map.of("Idempotency-Key", "terminal-update-snapshot-stale-" + UUID.randomUUID()), Set.of(200));
        assertEquals("DISABLED", payload(disabled.json()).path("status").asText(),
                "BUSINESS: owner mutation changes enabled membership after page one was read");
        BackendAcceptanceTest.Response staleSnapshot = context.get(TERMINAL_UPDATE_RULE_SNAPSHOT, secondPagePath,
                null, credentialHeaders, Set.of(409));
        assertEquals("PLATFORM_COMMON_VERSION_CONFLICT", staleSnapshot.problemCode(),
                "BUSINESS: continuation cursor is rejected when enabled membership changes between pages");

        BackendAcceptanceTest.Response reenabled = context.post(
                OPERATIONS_TERMINAL_UPDATE_RULE_STATUS,
                rulePath + "/" + firstRule + "/status?expectedContextVersion=" + operations.contextVersion(),
                operations.cookie(), Map.of("revision", 2, "status", "ENABLED", "reason", "snapshot membership restored"),
                Map.of("Idempotency-Key", "terminal-update-snapshot-reenable-" + UUID.randomUUID()), Set.of(200));
        assertEquals("ENABLED", payload(reenabled.json()).path("status").asText(),
                "BUSINESS: the same immutable rule can return to the same enabled membership");
        JsonNode sameMembership = payload(context.get(TERMINAL_UPDATE_RULE_SNAPSHOT, snapshotPath, null,
                credentialHeaders, Set.of(200)).json());
        assertEquals(snapshot.path("collectionHash").asText(), sameMembership.path("collectionHash").asText(),
                "BUSINESS: terminal collection identity depends on enabled rule membership, not CAS revision");
        disabled = context.post(
                OPERATIONS_TERMINAL_UPDATE_RULE_STATUS,
                rulePath + "/" + firstRule + "/status?expectedContextVersion=" + operations.contextVersion(),
                operations.cookie(), Map.of("revision", 3, "status", "DISABLED", "reason", "snapshot stale proof"),
                Map.of("Idempotency-Key", "terminal-update-snapshot-stale-again-" + UUID.randomUUID()), Set.of(200));
        assertEquals("DISABLED", payload(disabled.json()).path("status").asText(),
                "BUSINESS: membership can change again before concurrent create proof");

        List<UUID> concurrentRuleRefs = createConcurrentRules(context, terminal.fixture(), operations, rulePath,
                artifact.path("artifactRef").asText(), terminal.fixture().storeId());
        expectedRuleRefs.remove(firstRule.toString());
        concurrentRuleRefs.forEach(ruleRef -> expectedRuleRefs.add(ruleRef.toString()));
        JsonNode refreshedSnapshot = payload(context.get(TERMINAL_UPDATE_RULE_SNAPSHOT, snapshotPath, null,
                credentialHeaders, Set.of(200)).json());
        Set<String> refreshedRuleRefs = new HashSet<>();
        refreshedSnapshot.path("items").forEach(item -> refreshedRuleRefs.add(item.path("ruleRef").asText()));
        String refreshedCursor = refreshedSnapshot.path("nextCursor").asText();
        String refreshedSecondPagePath = snapshotBasePath + "?limit=100&cursor="
                + java.net.URLEncoder.encode(refreshedCursor, java.nio.charset.StandardCharsets.UTF_8)
                + "&collectionHash=" + refreshedSnapshot.path("collectionHash").asText();
        JsonNode refreshedSecondPage = payload(context.get(TERMINAL_UPDATE_RULE_SNAPSHOT,
                refreshedSecondPagePath, null, credentialHeaders, Set.of(200)).json());
        refreshedSecondPage.path("items").forEach(item -> refreshedRuleRefs.add(item.path("ruleRef").asText()));
        assertEquals(expectedRuleRefs, refreshedRuleRefs,
                "BUSINESS: both barrier-released concurrent creates appear in the authoritative complete snapshot");

        String artifactRef = artifact.path("artifactRef").asText();
        String grantPath = "/api/terminal/group-workspaces/" + terminal.fixture().groupWorkspaceKey()
                + "/update-artifacts/" + artifactRef + "/download-grant";
        JsonNode grant = payload(context.postNoBodyCoverageOnly(TERMINAL_UPDATE_DOWNLOAD_GRANT, grantPath, null,
                credentialHeaders, Set.of(200)).json());
        assertEquals(artifactRef, grant.path("artifactRef").asText(),
                "BUSINESS: grant binds to the exact rule-associated artifact");
        assertEquals(full.sha256(), grant.path("zipSha256").asText(),
                "BUSINESS: grant returns the immutable ZIP digest from the artifact owner");
        assertEquals(full.bytes().length, grant.path("byteSize").asLong(),
                "BUSINESS: grant returns the immutable ZIP size from the artifact owner");
        for (int index = 1; index < 31; index++) {
            BackendAcceptanceTest.Response additional = context.postNoBodyCoverageOnly(
                    TERMINAL_UPDATE_DOWNLOAD_GRANT, grantPath, null, credentialHeaders, Set.of(200));
            assertEquals(artifact.path("artifactRef").asText(), payload(additional.json()).path("artifactRef").asText(),
                    "BUSINESS: each still-valid grant is bound to the same immutable artifact");
        }
        List<BackendAcceptanceTest.Response> concurrentGrants = issueTwoConcurrentGrants(
                context, grantPath, credentialHeaders);
        assertEquals(Set.of(200, 503), concurrentGrants.stream().map(response -> response.http().statusCode())
                .collect(java.util.stream.Collectors.toSet()),
                "BUSINESS: at 31 existing active grants, concurrent issuance admits exactly one additional token");
        BackendAcceptanceTest.Response capacity = concurrentGrants.stream()
                .filter(response -> response.http().statusCode() == 503).findFirst().orElseThrow();
        assertEquals("TERMINAL_UPDATE_BUSY", capacity.problemCode(),
                "BUSINESS: the bounded grant owner reports its typed full-capacity result");
        String contentPath = "/api/terminal/group-workspaces/" + terminal.fixture().groupWorkspaceKey()
                + "/update-artifacts/" + artifactRef + "/content";
        Map<String, String> grantHeader = Map.of("X-Terminal-Update-Grant", grant.path("grant").asText());
        java.net.http.HttpResponse<byte[]> content = context.getBinary(TERMINAL_UPDATE_ARTIFACT_CONTENT,
                contentPath, grantHeader, Set.of(200));
        assertEquals(full.bytes().length, content.headers().firstValueAsLong("content-length").orElse(-1),
                "BUSINESS: private stream advertises the exact stored ZIP length");
        assertEquals("application/zip", content.headers().firstValue("content-type").orElse(""),
                "BUSINESS: content is delivered as a private ZIP response");
        assertEquals(full.sha256(), sha256(content.body()),
                "BUSINESS: private stream bytes match the artifact owner's immutable ZIP digest");

        BackendAcceptanceTest.Response cancelled = context.post(TERMINAL_DEVICE_ACTIVATION_CANCEL,
                "/api/terminal/group-workspaces/" + terminal.fixture().groupWorkspaceKey() + "/terminals/"
                        + terminal.terminalRef() + "/activation/cancel",
                null, Map.of("deviceId", terminal.deviceId()), credentialHeaders, Set.of(200));
        assertEquals("CANCELLED", payload(cancelled.json()).path("outcome").asText(),
                "BUSINESS: fixture cancellation ends the current credential generation");
        BackendAcceptanceTest.Response revoked = context.get(TERMINAL_UPDATE_ARTIFACT_CONTENT,
                contentPath, null, grantHeader, Set.of(403));
        assertEquals("TERMINAL_UPDATE_ARTIFACT_NOT_AUTHORIZED", revoked.problemCode(),
                "BUSINESS: content grant cannot outlive the current active binding");
    }

    private static List<BackendAcceptanceTest.Response> issueTwoConcurrentGrants(
            BackendAcceptanceTest.ScenarioContext context, String path, Map<String, String> credentialHeaders)
            throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            Future<BackendAcceptanceTest.Response> first = executor.submit(() -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("grant race did not start");
                return context.postNoBodyCoverageOnly(TERMINAL_UPDATE_DOWNLOAD_GRANT, path, null,
                        credentialHeaders, Set.of(200, 503));
            });
            Future<BackendAcceptanceTest.Response> second = executor.submit(() -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("grant race did not start");
                return context.postNoBodyCoverageOnly(TERMINAL_UPDATE_DOWNLOAD_GRANT, path, null,
                        credentialHeaders, Set.of(200, 503));
            });
            assertTrue(ready.await(10, TimeUnit.SECONDS), "BUSINESS: both grant issuers reached the barrier");
            start.countDown();
            return List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS));
        } finally {
            executor.shutdownNow();
            assertTrue(executor.awaitTermination(10, TimeUnit.SECONDS), "CLEANUP: concurrent grant workers stopped");
        }
    }

    private static List<UUID> createConcurrentRules(BackendAcceptanceTest.ScenarioContext context,
            BackendAcceptanceTest.Fixture fixture, BackendAcceptanceTest.Session operations,
            String rulePath, String fullArtifactRef, UUID storeRef) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            Future<UUID> first = executor.submit(() -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("rule race did not start");
                return createRuleCoverageOnly(context, fixture, operations, rulePath, fullArtifactRef, storeRef);
            });
            Future<UUID> second = executor.submit(() -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("rule race did not start");
                return createRuleCoverageOnly(context, fixture, operations, rulePath, fullArtifactRef, storeRef);
            });
            assertTrue(ready.await(10, TimeUnit.SECONDS), "BUSINESS: both rule creators reached the barrier");
            start.countDown();
            return List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS));
        } finally {
            start.countDown();
            executor.shutdownNow();
            assertTrue(executor.awaitTermination(10, TimeUnit.SECONDS), "CLEANUP: concurrent rule workers stopped");
        }
    }

    private static UUID createRuleCoverageOnly(BackendAcceptanceTest.ScenarioContext context,
            BackendAcceptanceTest.Fixture fixture, BackendAcceptanceTest.Session operations,
            String rulePath, String fullArtifactRef, UUID storeRef) throws Exception {
        BackendAcceptanceTest.Response created = context.postCoverageOnly(OPERATIONS_TERMINAL_UPDATE_RULE_CREATE,
                rulePath + "?expectedContextVersion=" + operations.contextVersion(), operations.cookie(),
                Map.of("targetMode", "STORE_REFS", "storeRefs", List.of(storeRef.toString()),
                        "fullArtifactRef", fullArtifactRef, "status", "ENABLED", "nSeconds", 300,
                        "hotStrategy", "IMMEDIATE", "description", "snapshot paging coverage"),
                Map.of("Idempotency-Key", "terminal-update-rule-coverage-" + UUID.randomUUID()), Set.of(201));
        JsonNode rule = payload(created.json());
        assertEquals(fixture.projectId().toString(), rule.path("projectRef").asText(),
                "BUSINESS: coverage rule belongs to the exact project fixture");
        assertEquals("ENABLED", rule.path("status").asText(),
                "BUSINESS: coverage rule is included in the active terminal snapshot");
        return UUID.fromString(rule.path("ruleRef").asText());
    }

    private static UUID createRule(BackendAcceptanceTest.ScenarioContext context,
            BackendAcceptanceTest.Fixture fixture, BackendAcceptanceTest.Session operations,
            String rulePath, String fullArtifactRef, List<UUID> storeRefs, String status) throws Exception {
        BackendAcceptanceTest.Response created = context.post(OPERATIONS_TERMINAL_UPDATE_RULE_CREATE,
                rulePath + "?expectedContextVersion=" + operations.contextVersion(), operations.cookie(),
                Map.of("targetMode", "STORE_REFS",
                        "storeRefs", storeRefs.stream().map(UUID::toString).toList(),
                        "fullArtifactRef", fullArtifactRef, "status", status, "nSeconds", 300,
                        "hotStrategy", "IMMEDIATE", "description", "acceptance rule"),
                Map.of("Idempotency-Key", "terminal-update-rule-" + UUID.randomUUID()), Set.of(201));
        JsonNode rule = payload(created.json());
        assertEquals(fixture.projectId().toString(), rule.path("projectRef").asText(),
                "BUSINESS: rule creation is bound to the fixture project");
        assertEquals(status, rule.path("status").asText(), "BUSINESS: rule status is persisted from the command");
        return UUID.fromString(rule.path("ruleRef").asText());
    }

    private static JsonNode stage(
            BackendAcceptanceTest.ScenarioContext context,
            String workspacePrefix,
            String cookie,
            TerminalUpdateAcceptanceFixtures.Package value)
            throws Exception {
        BackendAcceptanceTest.Response response = context.multipartTerminalUpdatePackage(
                PLATFORM_TERMINAL_UPDATE_ARTIFACT_STAGE,
                workspacePrefix + "/terminal-update-artifact-stages", cookie, value.sha256(), value.bytes(),
                "terminal-update-stage-" + UUID.randomUUID(), Set.of(201));
        return payload(response.json());
    }

    private static JsonNode payload(JsonNode body) {
        return body.has("result") ? body.path("result") : body;
    }

    private static String sha256(byte[] bytes) throws Exception {
        return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes));
    }
}
