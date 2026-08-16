package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import java.util.Set;

final class AssetAcceptanceScenarios {
    private final BackendAcceptanceTest host;

    AssetAcceptanceScenarios(BackendAcceptanceTest host) {
        this.host = host;
    }

    @AcceptanceScenario(id = "asset.catalog-stage-release", module = "ASSET", operation = "catalogAssetLifecycle")
    void catalogAssetStageAndRelease(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = host.login(context, fixture);
        String digest = BackendAcceptanceTest.sha256(PNG);
        String wrongTarget = fixture.projectId().toString();
        BackendAcceptanceTest.Response denied = context.multipartAsset(
                OPERATIONS_ASSET_STAGE, fixture, session.cookie(), wrongTarget, digest, Set.of(403));
        assertTrue(
                denied.problemCode().contains("SCOPE") || denied.problemCode().contains("ACCESS"),
                "CONTRACT: asset stage rejects a data node outside the selected store");
        BackendAcceptanceTest.Response staged = context.multipartAsset(
                OPERATIONS_ASSET_STAGE,
                fixture,
                session.cookie(),
                fixture.storeId().toString(),
                digest,
                Set.of(200));
        JsonNode stagedResult = staged.json().path("result");
        String assetRef = stagedResult.path("assetRef").asText();
        assertTrue(!assetRef.isBlank(), "BUSINESS: staged asset returns an opaque asset reference");
        assertEquals("STAGED", stagedResult.path("status").asText(), "BUSINESS: asset lifecycle starts at STAGED");
        assertEquals("image/png", stagedResult.path("mediaType").asText(), "BUSINESS: media type is read back");
        assertEquals(digest, stagedResult.path("contentDigest").asText(), "BUSINESS: content digest is read back");
        assertEquals(1, stagedResult.path("version").asInt(), "BUSINESS: staged asset starts at version one");
        String bindGrant = stagedResult.path("bindGrant").asText();
        assertTrue(!bindGrant.isBlank(), "BUSINESS: transient bind proof is returned only to the uploader");
        BackendAcceptanceTest.Response released = context.post(
                OPERATIONS_ASSET_RELEASE,
                "/api/operations/catalog-inventory/assets/" + assetRef + "/release",
                session.cookie(),
                Map.of(
                        "assetRef",
                        assetRef,
                        "expectedVersion",
                        1,
                        "dataNodeRef",
                        fixture.storeId().toString()),
                Set.of(200));
        assertEquals(
                "RELEASED",
                released.json().path("result").path("disposition").asText(),
                "BUSINESS: unreferenced staged asset releases");
        assertEquals(
                2,
                released.json().path("result").path("version").asInt(),
                "BUSINESS: release advances the asset version");
    }

    @AcceptanceScenario(
            id = "asset.release-scope-denial-preserves-staged-claim",
            module = "ASSET",
            operation = "assetReleaseScopeDenial")
    void assetReleaseScopeDenialPreservesStagedClaim(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = host.login(context, fixture);
        String digest = BackendAcceptanceTest.sha256(PNG);
        BackendAcceptanceTest.Response staged = context.multipartAsset(
                OPERATIONS_ASSET_STAGE,
                fixture,
                session.cookie(),
                fixture.storeId().toString(),
                digest,
                Set.of(200));
        JsonNode stagedResult = staged.json().path("result");
        String assetRef = stagedResult.path("assetRef").asText();
        long stagedVersion = stagedResult.path("version").asLong();
        assertTrue(
                !assetRef.isBlank() && stagedVersion > 0,
                "BUSINESS: staged asset readback supplies the current opaque reference and lifecycle version");
        BackendAcceptanceTest.Response denied = context.post(
                OPERATIONS_ASSET_RELEASE,
                "/api/operations/catalog-inventory/assets/" + assetRef + "/release",
                session.cookie(),
                Map.of(
                        "assetRef",
                        assetRef,
                        "expectedVersion",
                        stagedVersion,
                        "dataNodeRef",
                        fixture.projectId().toString()),
                Set.of(403));
        assertTrue(
                denied.problemCode().contains("SCOPE") || denied.problemCode().contains("ACCESS"),
                "BUSINESS: release rechecks the explicit target scope");
        BackendAcceptanceTest.Response released = context.post(
                OPERATIONS_ASSET_RELEASE,
                "/api/operations/catalog-inventory/assets/" + assetRef + "/release",
                session.cookie(),
                Map.of(
                        "assetRef",
                        assetRef,
                        "expectedVersion",
                        stagedVersion,
                        "dataNodeRef",
                        fixture.storeId().toString()),
                Set.of(200));
        assertEquals(
                "RELEASED",
                released.json().path("result").path("disposition").asText(),
                "BUSINESS: a denied release leaves the staged claim releasable");
        assertEquals(
                stagedVersion + 1,
                released.json().path("result").path("version").asLong(),
                "BUSINESS: only the authorized release advances the asset version");
    }
}
