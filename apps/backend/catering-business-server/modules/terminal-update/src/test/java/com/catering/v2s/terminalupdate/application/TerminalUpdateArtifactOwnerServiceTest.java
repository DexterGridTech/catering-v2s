package com.catering.v2s.terminalupdate.application;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditEventWriter;
import com.catering.v2s.platform.asset.api.TerminalUpdateAssetStorage;
import com.catering.v2s.platform.foundation.persistence.CommandReceiptSupport;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.ArtifactReadback;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.MinimumFull;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.RegisterArtifact;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.ValidatedStage;
import com.catering.v2s.terminalupdate.application.persistence.TerminalUpdateArtifactPersistence;
import com.catering.v2s.terminalupdate.application.persistence.TerminalUpdateDownloadGrantPersistence;
import com.catering.v2s.terminalupdate.application.persistence.TerminalUpdateRulePersistence;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi;
import com.catering.v2s.terminalupdate.application.persistence.TerminalUpdateArtifactPersistence.Receipt;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TerminalUpdateArtifactOwnerServiceTest {
    private static final UUID WORKSPACE = UUID.fromString("00000000-0000-0000-0000-000000000111");
    private static final String GROUP = "fixture-group";
    private static final UUID STAGE = UUID.fromString("00000000-0000-0000-0000-000000000222");
    private static final UUID ASSET = UUID.fromString("00000000-0000-0000-0000-000000000333");
    private static final String DIGEST = "a".repeat(64);
    private final TerminalUpdateArtifactPersistence persistence = mock(TerminalUpdateArtifactPersistence.class);
    private final TerminalUpdateAssetStorage assets = mock(TerminalUpdateAssetStorage.class);
    private final AuditEventWriter audit = mock(AuditEventWriter.class);
    private final TimeProvider time = () -> 2_000L;
    private final TerminalUpdateDownloadGrantPersistence grants = mock(TerminalUpdateDownloadGrantPersistence.class);
    private final TerminalUpdateRulePersistence rules = mock(TerminalUpdateRulePersistence.class);
    private final OrganizationTaskPathLookup organization = mock(OrganizationTaskPathLookup.class);
    private final TerminalCredentialVerificationApi credentials = mock(TerminalCredentialVerificationApi.class);
    private final TerminalUpdateArtifactOwnerService owner = new TerminalUpdateArtifactOwnerService(
            persistence, assets, audit, time, grants, rules, organization, credentials);

    @Test
    void stageReadbackDistinguishesFirstInsertFromAnIdenticalIdempotentReplay() {
        ValidatedStage canonicalizedReadback = stageWithFilesJson(null,
                "[{\"size\":64,\"sha256\":\"" + DIGEST + "\",\"path\":\"bundle.js\"}]");
        ValidatedStage stage = stageWithFilesJson(null,
                "[{\"path\":\"bundle.js\",\"sha256\":\"" + DIGEST + "\",\"size\":64}]");
        when(persistence.insertStage(stage, 2_000L)).thenReturn(1, 0);
        when(persistence.readStage(STAGE, false)).thenReturn(Optional.of(canonicalizedReadback));

        var first = owner.acceptValidatedStage(stage, actor());
        var replay = owner.acceptValidatedStage(stage, actor());

        assertTrue(first.inserted());
        assertFalse(replay.inserted());
        verify(persistence, times(2)).readStage(STAGE, false);
    }

    @Test
    void stageReplayRejectsDifferentManifestContent() {
        ValidatedStage requested = stageWithFilesJson(null, "[]");
        ValidatedStage stored = stageWithFilesJson(null,
                "[{\"path\":\"bundle.js\",\"sha256\":\"" + DIGEST + "\",\"size\":64}]");
        when(persistence.insertStage(requested, 2_000L)).thenReturn(0);
        when(persistence.readStage(STAGE, false)).thenReturn(Optional.of(stored));

        assertThrows(TerminalUpdateArtifactOwnerService.TerminalUpdateStageConflictException.class,
                () -> owner.acceptValidatedStage(requested, actor()));
        verify(audit, never()).write(any());
    }

    @Test
    void anotherActorCannotRegisterOrReleaseAStagedPackage() {
        ValidatedStage staged = stage(null);
        AuditActor other = new AuditActor("PLATFORM_ADMIN",
                UUID.fromString("00000000-0000-0000-0000-000000000556"), "Other admin");
        when(persistence.findReceipt(GROUP, "register", "idempotency-key-0001")).thenReturn(Optional.empty());
        when(persistence.readStage(STAGE, true)).thenReturn(Optional.of(staged));

        assertThrows(TerminalUpdateArtifactOwnerService.TerminalUpdateStageNotOwnedException.class,
                () -> owner.register(new RegisterArtifact(WORKSPACE, GROUP, STAGE, other, "grant", "FULL",
                        null, "idempotency-key-0001")));
        assertThrows(TerminalUpdateArtifactOwnerService.TerminalUpdateStageNotOwnedException.class,
                () -> owner.releaseStage(new com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.ReleaseStage(
                        WORKSPACE, GROUP, STAGE, other, "grant")));

        verify(assets, never()).claimTerminalUpdatePackage(any(), anyString(), any(), anyString(), anyString());
        verify(assets, never()).releaseTerminalUpdatePackage(any(), anyString(), any(), anyString());
        verify(persistence, never()).deleteStage(STAGE);
        verify(audit, never()).write(any());
    }

    @Test
    void stageReplayCannotChangeTheOriginalActor() {
        ValidatedStage staged = stage(null);
        AuditActor other = new AuditActor("PLATFORM_ADMIN",
                UUID.fromString("00000000-0000-0000-0000-000000000556"), "Other admin");
        when(persistence.insertStage(staged, 2_000L)).thenReturn(0);
        when(persistence.readStage(STAGE, false)).thenReturn(Optional.of(staged));

        assertThrows(TerminalUpdateArtifactOwnerService.TerminalUpdateStageNotOwnedException.class,
                () -> owner.acceptValidatedStage(staged, other));
        verify(audit, never()).write(any());
    }

    @Test
    void assetStageIdempotencyIsStableForItsOwnerAndIsolatedBetweenActors() {
        UUID actorId = actor().actorId();
        String first = StageTerminalUpdateArtifactOperation.actorScopedIdempotencyKey(
                WORKSPACE, GROUP, "PLATFORM_ADMIN", actorId, "same-request-key-0001");
        String retry = StageTerminalUpdateArtifactOperation.actorScopedIdempotencyKey(
                WORKSPACE, GROUP, "PLATFORM_ADMIN", actorId, "same-request-key-0001");
        String other = StageTerminalUpdateArtifactOperation.actorScopedIdempotencyKey(
                WORKSPACE, GROUP, "PLATFORM_ADMIN", UUID.fromString("00000000-0000-0000-0000-000000000556"),
                "same-request-key-0001");

        assertTrue(first.equals(retry), "BUSINESS: same actor retry keeps the asset owner receipt identity");
        assertFalse(first.equals(other), "BUSINESS: a different actor cannot replay or rotate the pending stage grant");
    }

    @Test
    void registerReceiptReplayIsBoundToTheOriginalActor() throws Exception {
        AuditActor ownerActor = actor();
        AuditActor otherActor = new AuditActor("PLATFORM_ADMIN",
                UUID.fromString("00000000-0000-0000-0000-000000000556"), "Other admin");
        String key = "idempotency-key-0001";
        var ownerCommand = new RegisterArtifact(WORKSPACE, GROUP, STAGE, ownerActor, "grant", "FULL", null, key);
        ArtifactReadback completed = new ArtifactReadback(
                UUID.fromString("00000000-0000-0000-0000-000000000777"), "FULL", "com.example.terminal",
                "android", "1.0", 1L, "1.0", "runtime-1", "index.android.bundle", "{}", DIGEST,
                ASSET, DIGEST, DIGEST, "app.apk", DIGEST, 64L, null, null, 2_000L);
        String ownerHash = CommandReceiptSupport.requestHash(
                WORKSPACE + "|" + GROUP + "|" + ownerActor.actorType() + "|" + ownerActor.actorId() + "|"
                        + STAGE + "|FULL|null|" + CommandReceiptSupport.requestHash("grant"));
        when(persistence.findReceipt(GROUP, "register", key))
                .thenReturn(Optional.of(new Receipt(ownerHash, new ObjectMapper().writeValueAsString(completed))));

        ArtifactReadback replay = owner.register(ownerCommand);
        assertEquals(completed.artifactRef(), replay.artifactRef(),
                "BUSINESS: the original actor receives its committed artifact on exact replay");

        RegisterArtifact otherActorReplay = new RegisterArtifact(
                WORKSPACE, GROUP, STAGE, otherActor, "grant", "FULL", null, key);
        assertThrows(TerminalUpdateArtifactOwnerService.TerminalUpdateIdempotencyConflictException.class,
                () -> owner.register(otherActorReplay));
        verify(persistence, times(2)).lockCommand(GROUP, "register", key);
        verify(persistence, never()).readStage(STAGE, true);
        verify(assets, never()).claimTerminalUpdatePackage(any(), anyString(), any(), anyString(), anyString());
    }

    @Test
    void hotRegistrationRejectsMinimumFullOutsideItsWorkspaceBeforeClaimingPrivateBytes() {
        MinimumFull minimum = new MinimumFull("com.example.terminal", 9, "terminal-main-v1", DIGEST, DIGEST);
        ValidatedStage hot = stage(minimum);
        when(persistence.findReceipt(GROUP, "register", "idempotency-key-0001")).thenReturn(Optional.empty());
        when(persistence.readStage(STAGE, true)).thenReturn(Optional.of(hot));
        when(persistence.readFull(WORKSPACE, GROUP, UUID.fromString("00000000-0000-0000-0000-000000000444")))
                .thenReturn(Optional.empty());

        assertThrows(TerminalUpdateArtifactOwnerService.TerminalUpdateMinimumFullInvalidException.class,
                () -> owner.register(new RegisterArtifact(WORKSPACE, GROUP, STAGE, actor(), "grant", "HOT",
                        UUID.fromString("00000000-0000-0000-0000-000000000444"), "idempotency-key-0001")));

        verify(assets, never()).claimTerminalUpdatePackage(any(), anyString(), any(), anyString(), anyString());
        verify(persistence, never()).registerPublication(anyString(), anyString(), anyString(), anyString(), anyString());
    }

    private static ValidatedStage stage(MinimumFull minimum) {
        return stageWithFilesJson(minimum, "[]");
    }

    private static ValidatedStage stageWithFilesJson(MinimumFull minimum, String filesJson) {
        return new ValidatedStage(STAGE, WORKSPACE, GROUP, ASSET, "terminal-hot.zip", 10_000L, 64L, DIGEST,
                "com.example.terminal", "android", "2.1.4", 9L, "3.2.1", "terminal-main-v1",
                "assets/index.android.bundle", filesJson, DIGEST, null, null, null, minimum,
                actor().actorType(), actor().actorId());
    }

    private static AuditActor actor() {
        return new AuditActor("PLATFORM_ADMIN", UUID.fromString("00000000-0000-0000-0000-000000000555"), "Admin");
    }
}
