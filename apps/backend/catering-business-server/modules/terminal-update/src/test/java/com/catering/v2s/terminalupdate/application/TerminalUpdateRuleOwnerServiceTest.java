package com.catering.v2s.terminalupdate.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditEventWriter;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.ArtifactReadback;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi;
import com.catering.v2s.terminalupdate.application.persistence.TerminalUpdateRulePersistence;
import com.catering.v2s.terminalupdate.application.persistence.TerminalUpdateRuleSnapshotPersistence;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

final class TerminalUpdateRuleOwnerServiceTest {
    private static final UUID WORKSPACE = UUID.fromString("00000000-0000-0000-0000-000000000101");
    private static final UUID PROJECT = UUID.fromString("00000000-0000-0000-0000-000000000102");
    private static final UUID STORE = UUID.fromString("00000000-0000-0000-0000-000000000103");
    private static final UUID FULL = UUID.fromString("00000000-0000-0000-0000-000000000104");
    private static final UUID HOT = UUID.fromString("00000000-0000-0000-0000-000000000105");
    private static final String GROUP = "mixc";
    private static final String DIGEST = "a".repeat(64);

    private final TerminalUpdateRulePersistence persistence = org.mockito.Mockito.mock(TerminalUpdateRulePersistence.class);
    private final TerminalUpdateRuleSnapshotPersistence snapshots = org.mockito.Mockito.mock(TerminalUpdateRuleSnapshotPersistence.class);
    private final TerminalUpdateArtifactOwnerApi artifacts = org.mockito.Mockito.mock(TerminalUpdateArtifactOwnerApi.class);
    private final OrganizationTaskPathLookup organization = org.mockito.Mockito.mock(OrganizationTaskPathLookup.class);
    private final AuditEventWriter audit = org.mockito.Mockito.mock(AuditEventWriter.class);
    private final TimeProvider time = org.mockito.Mockito.mock(TimeProvider.class);
    private TerminalUpdateRuleOwnerService owner;

    @BeforeEach
    void setUp() {
        owner = new TerminalUpdateRuleOwnerService(persistence, snapshots, artifacts, organization, audit, time);
        when(persistence.receiptHash(eq(GROUP), any(), any())).thenReturn(Optional.empty());
        when(persistence.findReceipt(eq(GROUP), any(), any())).thenReturn(Optional.empty());
        when(persistence.insert(any(), eq(WORKSPACE), eq(GROUP))).thenReturn(1);
        when(time.currentEpochMillis()).thenReturn(1_000L);
    }

    @Test
    void createPersistsImmutablePairThenAuditsAndNotifiesWithinOwnerCommand() {
        stubScope();
        stubArtifactPair();

        var created = owner.create(command());

        assertEquals(PROJECT, created.projectRef());
        assertEquals("ENABLED", created.status());
        assertEquals(List.of(STORE), created.storeRefs());
        assertEquals("IMMEDIATE", created.hotStrategy());
        assertEquals(null, created.mSeconds());
        ArgumentCaptor<TerminalUpdateRuleOwnerApi.RuleReadback> row =
                ArgumentCaptor.forClass(TerminalUpdateRuleOwnerApi.RuleReadback.class);
        verify(persistence).insert(row.capture(), eq(WORKSPACE), eq(GROUP));
        assertEquals(FULL, row.getValue().fullArtifactRef());
        assertEquals(HOT, row.getValue().hotArtifactRef());
        verify(audit).write(any());
        verify(persistence).refreshTopic(WORKSPACE, GROUP, PROJECT, 1_000L);
        verify(persistence).insertReceipt(eq(GROUP), eq("create_rule"), eq("idempotency-key-0001"), any(),
                eq(created), eq(1_000L));
    }

    @Test
    void distinctMembershipChangesAtTheSameMillisecondEachRefreshTheTopic() {
        stubScope();
        stubArtifactPair();

        owner.create(command());
        owner.create(new TerminalUpdateRuleOwnerApi.CreateRule(WORKSPACE, GROUP, PROJECT, "STORE_REFS", List.of(STORE),
                FULL, HOT, "ENABLED", 300, "IMMEDIATE", null, "same-millisecond", 8,
                "idempotency-key-0003", actor()));

        verify(persistence, times(2)).lockProject(WORKSPACE, GROUP, PROJECT);
        verify(persistence, times(2)).refreshTopic(WORKSPACE, GROUP, PROJECT, 1_000L);
    }

    @Test
    void creationRejectsHotArtifactBoundToAnotherFullBeforeAnyRuleWrite() {
        stubScope();
        ArtifactReadback full = artifact(FULL, "FULL", DIGEST, null);
        ArtifactReadback mismatchedHot = artifact(HOT, "HOT", null,
                new TerminalUpdateArtifactOwnerApi.MinimumFull("com.example.terminal", 9,
                        "terminal-main-v1", DIGEST, "b".repeat(64)));
        when(artifacts.read(WORKSPACE, GROUP, FULL)).thenReturn(full);
        when(artifacts.read(WORKSPACE, GROUP, HOT)).thenReturn(mismatchedHot);

        assertThrows(TerminalUpdateRuleOwnerService.TerminalUpdateRuleTargetInvalidException.class,
                () -> owner.create(command()));

        verify(persistence, never()).insert(any(), any(), any());
        verifyNoInteractions(audit);
    }

    @Test
    void idleHotRuleRequiresAnIdleThresholdBeforeAnyRuleWrite() {
        stubScope();
        stubArtifactPair();
        var invalid = new TerminalUpdateRuleOwnerApi.CreateRule(WORKSPACE, GROUP, PROJECT, "STORE_REFS", List.of(STORE),
                FULL, HOT, "ENABLED", 300, "IDLE", null, "release", 8,
                "idempotency-key-0004", actor());

        assertThrows(TerminalUpdateRuleOwnerService.TerminalUpdateRuleInvalidException.class,
                () -> owner.create(invalid));

        verify(persistence, never()).insert(any(), any(), any());
        verifyNoInteractions(audit);
    }

    @Test
    void staleRevisionCannotChangeRuleOrEmitAuditAndTopic() {
        var command = new TerminalUpdateRuleOwnerApi.ChangeRuleStatus(
                WORKSPACE, GROUP, PROJECT, UUID.randomUUID(), 3, "DISABLED", "operator request", 8,
                "idempotency-key-0002", actor());
        stubScope();
        var current = new TerminalUpdateRuleOwnerApi.RuleReadback(UUID.randomUUID(), PROJECT, "ALL", List.of(), FULL,
                null, "ENABLED", 300, null, null, null, 10, 10, 4);
        when(persistence.read(WORKSPACE, GROUP, PROJECT, command.ruleRef(), true)).thenReturn(Optional.of(current));

        assertThrows(TerminalUpdateRuleOwnerService.TerminalUpdateRuleStaleStateException.class,
                () -> owner.changeStatus(command));

        verify(persistence, never()).changeStatus(any(), any(), any(), any(), anyLong(), any(), anyLong());
        verify(persistence, never()).refreshTopic(any(), any(), any(), anyLong());
        verifyNoInteractions(audit);
    }

    @Test
    void fixedStorePagePreservesDisabledFactsAndSurfacesMissingReferencesWithoutInventingNames() {
        UUID first = UUID.fromString("00000000-0000-0000-0000-000000000201");
        UUID second = UUID.fromString("00000000-0000-0000-0000-000000000202");
        var rule = new TerminalUpdateRuleOwnerApi.RuleReadback(UUID.randomUUID(), PROJECT, "STORE_REFS",
                List.of(second, first), FULL, null, "DISABLED", 300, "IMMEDIATE", null, null, 10, 10, 1);
        when(persistence.read(WORKSPACE, GROUP, PROJECT, rule.ruleRef(), false)).thenReturn(Optional.of(rule));
        when(organization.describePersistedStoresInProject(WORKSPACE, GROUP, PROJECT, List.of(first)))
                .thenReturn(Map.of(first, new OrganizationTaskPathLookup.PersistedStoreFact(
                        first, "S-201", "Closed Store", "DISABLED")));
        when(organization.describePersistedStoresInProject(WORKSPACE, GROUP, PROJECT, List.of(second)))
                .thenReturn(Map.of());

        var firstPage = owner.stores(WORKSPACE, GROUP, PROJECT, rule.ruleRef(), null, 1);
        assertEquals(1, firstPage.items().size());
        assertEquals("DISABLED", firstPage.items().getFirst().status());
        assertEquals("Closed Store", firstPage.items().getFirst().name());

        var secondPage = owner.stores(WORKSPACE, GROUP, PROJECT, rule.ruleRef(), firstPage.nextCursor(), 1);
        assertEquals(1, secondPage.items().size());
        assertEquals(second, secondPage.items().getFirst().storeRef());
        assertEquals("UNKNOWN", secondPage.items().getFirst().status());
        assertEquals("MISSING_OR_OUT_OF_PROJECT", secondPage.items().getFirst().unknownReason());
        assertEquals("", secondPage.items().getFirst().name());
        verify(organization).describePersistedStoresInProject(WORKSPACE, GROUP, PROJECT, List.of(second));
    }

    @Test
    void rulePageRejectsInvalidFiltersBeforeReadingOwnerRows() {
        assertThrows(TerminalUpdateRuleOwnerService.TerminalUpdateRuleInvalidException.class,
                () -> owner.page(WORKSPACE, GROUP, PROJECT,
                        new TerminalUpdateRuleOwnerApi.RulePageQuery("REMOVED", null, null, null, null, 10)));
        verifyNoInteractions(persistence);
    }

    @Test
    void terminalSnapshotCarriesAuthoritativeRuleCreationTime() {
        var full = new TerminalUpdateRuleSnapshotPersistence.Artifact(FULL, "FULL", "com.example.terminal",
                "terminal-main-v1", 9, "1.0", "1.0", DIGEST, DIGEST, 128, 900L);
        var row = new TerminalUpdateRuleSnapshotPersistence.Row("member", UUID.randomUUID(), "ALL", List.of(),
                "com.example.terminal", full, null, 300L, null, null, null, 700L);
        when(snapshots.page(WORKSPACE, GROUP, PROJECT, null, null, 11)).thenReturn(List.of(row));

        var page = owner.terminalSnapshot(WORKSPACE, GROUP, PROJECT, null, 10, null);

        assertEquals(700L, page.items().getFirst().createdAtEpochMillis());
    }

    private void stubScope() {
        when(organization.requireStoreProjectMemberships(WORKSPACE, GROUP, List.of(STORE)))
                .thenReturn(Map.of(STORE, PROJECT));
    }

    private void stubArtifactPair() {
        when(artifacts.read(WORKSPACE, GROUP, FULL)).thenReturn(artifact(FULL, "FULL", DIGEST, null));
        when(artifacts.read(WORKSPACE, GROUP, HOT)).thenReturn(artifact(HOT, "HOT", null,
                new TerminalUpdateArtifactOwnerApi.MinimumFull("com.example.terminal", 9,
                        "terminal-main-v1", DIGEST, DIGEST)));
    }

    private static ArtifactReadback artifact(UUID ref, String kind, String apkSha, 
            TerminalUpdateArtifactOwnerApi.MinimumFull minimumFull) {
        return new ArtifactReadback(ref, kind, "com.example.terminal", "android", "1.0", 9,
                "1.0", "terminal-main-v1", "index.android.bundle", "{}", DIGEST, UUID.randomUUID(),
                DIGEST, apkSha, kind.equals("HOT") ? null : "app.apk",
                kind.equals("HOT") ? null : DIGEST, 128, kind.equals("HOT") ? FULL : null, minimumFull, 10);
    }

    private static TerminalUpdateRuleOwnerApi.CreateRule command() {
        return new TerminalUpdateRuleOwnerApi.CreateRule(WORKSPACE, GROUP, PROJECT, "STORE_REFS", List.of(STORE),
                FULL, HOT, "ENABLED", 300, "IMMEDIATE", null, "release", 8,
                "idempotency-key-0001", actor());
    }

    private static AuditActor actor() {
        return new AuditActor("WORKSPACE_ACCOUNT", UUID.fromString("00000000-0000-0000-0000-000000000106"), "Ops");
    }
}
