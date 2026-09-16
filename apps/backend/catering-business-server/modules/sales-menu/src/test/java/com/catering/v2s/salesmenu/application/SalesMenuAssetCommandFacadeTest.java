package com.catering.v2s.salesmenu.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.salesmenu.api.SalesMenuAssetCommandApi;
import com.catering.v2s.salesmenu.api.SalesMenuReadback;
import com.catering.v2s.salesmenu.domain.SalesMenuAssetTarget;
import com.catering.v2s.salesmenu.domain.SalesMenuAssetUsage;
import java.io.ByteArrayInputStream;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SalesMenuAssetCommandFacadeTest {
    private static final UUID WORKSPACE = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final UUID STORE = UUID.fromString("22222222-2222-4222-8222-222222222222");
    private static final UUID MENU = UUID.fromString("44444444-4444-4444-8444-444444444444");
    private static final UUID ITEM = UUID.fromString("66666666-6666-4666-8666-666666666666");
    private static final UUID ASSET = UUID.fromString("99999999-9999-4999-8999-999999999999");

    @Test
    void mapsStageEnvelopeAndClaimReadbackWithoutMovingAssetOwnership() {
        var assetOwner = mock(com.catering.v2s.platform.asset.api.SalesMenuAssetCommandApi.class);
        var facade = new SalesMenuAssetCommandFacade(assetOwner, (workspace, group, targetType, storeId) -> {});
        var grant = grant();
        var target = target();
        var content = new ByteArrayInputStream(new byte[] {1, 2, 3});
        var stageCommand = new SalesMenuAssetCommandApi.StageCommand(
                target, grant, 7L, "menu.png", "image/png", "digest", 3L, content, "stage-key");
        var platformTarget = platformTarget();
        when(assetOwner.stageSalesMenuItemImage(
                        any(com.catering.v2s.platform.asset.api.SalesMenuAssetTarget.class),
                        any(OperationsOwnerScopeGrant.class),
                        anyLong(),
                        any(com.catering.v2s.platform.asset.api.SalesMenuAssetCommandApi.StageCommand.class)))
                .thenReturn(new com.catering.v2s.platform.asset.api.SalesMenuAssetCommandApi.StageReadback(
                        ASSET, platformTarget, "bind-grant", "STAGED", "image/png", "digest", 1L));

        SalesMenuReadback.AssetStage staged = facade.stageSalesMenuItemImage(target, grant, 7L, stageCommand);

        assertEquals(ASSET, staged.assetRef());
        assertEquals(target, staged.target());
        assertEquals("bind-grant", staged.bindGrant());
        assertEquals("STAGED", staged.status());
        verify(assetOwner)
                .stageSalesMenuItemImage(
                        platformTarget,
                        grant,
                        7L,
                        new com.catering.v2s.platform.asset.api.SalesMenuAssetCommandApi.StageCommand(
                                "menu.png", "image/png", "digest", 3L, content, "stage-key"));

        var binding = new SalesMenuAssetCommandApi.AssetBinding(ASSET, "bind-grant");
        when(assetOwner.claimSalesMenuItemImages(
                        any(com.catering.v2s.platform.asset.api.SalesMenuAssetTarget.class),
                        any(OperationsOwnerScopeGrant.class),
                        anyLong(),
                        any(List.class)))
                .thenReturn(new com.catering.v2s.platform.asset.api.SalesMenuAssetCommandApi.ClaimReadback(
                        platformTarget,
                        List.of(new com.catering.v2s.platform.asset.api.SalesMenuAssetCommandApi.AssetMetadata(
                                ASSET, "SALES_MENU_ITEM_IMAGE", "ACTIVE", 2L, 3L))));

        SalesMenuReadback.AssetClaim claim = facade.claimSalesMenuItemImages(target, grant, 7L, List.of(binding));

        assertEquals(target, claim.target());
        assertEquals(List.of(new SalesMenuReadback.ClaimedAsset(ASSET, "ACTIVE", 2L)), claim.assets());
        verify(assetOwner)
                .claimSalesMenuItemImages(
                        platformTarget,
                        grant,
                        7L,
                        List.of(new com.catering.v2s.platform.asset.api.SalesMenuAssetCommandApi.AssetBinding(
                                ASSET, "bind-grant")));
    }

    @Test
    void mapsPlatformReleaseClaimRejectionToSalesMenuClaimRejection() {
        var assetOwner = mock(com.catering.v2s.platform.asset.api.SalesMenuAssetCommandApi.class);
        var facade = new SalesMenuAssetCommandFacade(assetOwner, (workspace, group, targetType, storeId) -> {});
        var grant = grant();
        var target = target();
        var command = new SalesMenuAssetCommandApi.ReleaseCommand(target, grant, 7L, ASSET, 1L, "release-key");
        when(assetOwner.releaseStagedSalesMenuItemImage(
                        any(com.catering.v2s.platform.asset.api.SalesMenuAssetTarget.class),
                        any(OperationsOwnerScopeGrant.class),
                        anyLong(),
                        any(com.catering.v2s.platform.asset.api.SalesMenuAssetCommandApi.ReleaseCommand.class)))
                .thenThrow(new PlatformAssetService.AssetClaimRejectedException());

        var failure = assertThrows(
                SalesMenuAssetCommandApi.AssetClaimRejectedException.class,
                () -> facade.releaseStagedSalesMenuItemImage(target, grant, 7L, command));

        assertEquals(
                PlatformAssetService.AssetClaimRejectedException.class,
                failure.getCause().getClass());
    }

    @Test
    void mapsPlatformClaimRejectionToSalesMenuClaimRejection() {
        var assetOwner = mock(com.catering.v2s.platform.asset.api.SalesMenuAssetCommandApi.class);
        var facade = new SalesMenuAssetCommandFacade(assetOwner, (workspace, group, targetType, storeId) -> {});
        var grant = grant();
        var target = target();
        when(assetOwner.claimSalesMenuItemImages(
                        any(com.catering.v2s.platform.asset.api.SalesMenuAssetTarget.class),
                        any(OperationsOwnerScopeGrant.class),
                        anyLong(),
                        any(List.class)))
                .thenThrow(new PlatformAssetService.AssetClaimRejectedException());

        var failure = assertThrows(
                SalesMenuAssetCommandApi.AssetClaimRejectedException.class,
                () -> facade.claimSalesMenuItemImages(target, grant, 7L, List.of()));

        assertEquals(
                PlatformAssetService.AssetClaimRejectedException.class,
                failure.getCause().getClass());
    }

    private static OperationsOwnerScopeGrant grant() {
        return new OperationsOwnerScopeGrant(
                WORKSPACE,
                "group-1",
                "OWNER_RECHECK_SALES_MENU",
                "EDIT_STORE_SALES_MENU",
                "STORE",
                STORE,
                "STORE",
                STORE,
                List.of());
    }

    private static SalesMenuAssetTarget target() {
        return new SalesMenuAssetTarget("group-1", STORE, MENU, ITEM, SalesMenuAssetUsage.SALES_MENU_ITEM_IMAGE, 3L);
    }

    private static com.catering.v2s.platform.asset.api.SalesMenuAssetTarget platformTarget() {
        return new com.catering.v2s.platform.asset.api.SalesMenuAssetTarget(
                WORKSPACE,
                "group-1",
                STORE,
                MENU,
                ITEM,
                com.catering.v2s.platform.asset.api.SalesMenuAssetUsage.SALES_MENU_ITEM_IMAGE,
                3L);
    }
}
