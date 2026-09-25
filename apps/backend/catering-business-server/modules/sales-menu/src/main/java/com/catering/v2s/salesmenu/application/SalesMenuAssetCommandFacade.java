package com.catering.v2s.salesmenu.application;

import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.StoreOperatingRuleGate;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.salesmenu.api.SalesMenuAssetCommandApi;
import com.catering.v2s.salesmenu.api.SalesMenuOwnerApi;
import com.catering.v2s.salesmenu.api.SalesMenuReadback;
import com.catering.v2s.salesmenu.domain.SalesMenuAssetTarget;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;

/** Adapts the sales-menu target boundary to the platform-asset owner API. */
@Service
public final class SalesMenuAssetCommandFacade implements SalesMenuAssetCommandApi {
    private static final String STORE_SALES_MENU_CAPABILITY = "EDIT_STORE_SALES_MENU";
    private final com.catering.v2s.platform.asset.api.SalesMenuAssetCommandApi assetOwner;
    private final StoreOperatingRuleGate storeOperatingRuleGate;

    public SalesMenuAssetCommandFacade(com.catering.v2s.platform.asset.api.SalesMenuAssetCommandApi assetOwner) {
        this(assetOwner, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public SalesMenuAssetCommandFacade(
            com.catering.v2s.platform.asset.api.SalesMenuAssetCommandApi assetOwner,
            StoreOperatingRuleGate storeOperatingRuleGate) {
        this.assetOwner = Objects.requireNonNull(assetOwner, "assetOwner");
        this.storeOperatingRuleGate = storeOperatingRuleGate;
    }

    @Override
    public SalesMenuReadback.AssetStage stageSalesMenuItemImage(
            SalesMenuAssetTarget target,
            OperationsOwnerScopeGrant ownerScopeGrant,
            long contextVersion,
            SalesMenuAssetCommandApi.StageCommand command) {
        requireEnvelope(
                target,
                ownerScopeGrant,
                contextVersion,
                command.target(),
                command.ownerScopeGrant(),
                command.contextVersion());
        requireCatalogManagement(target, ownerScopeGrant, contextVersion);
        var readback = assetOwner.stageSalesMenuItemImage(
                platformTarget(target, ownerScopeGrant),
                ownerScopeGrant,
                contextVersion,
                new com.catering.v2s.platform.asset.api.SalesMenuAssetCommandApi.StageCommand(
                        command.fileName(),
                        command.mediaType(),
                        command.contentDigest(),
                        command.contentLength(),
                        command.content(),
                        command.idempotencyKey()));
        return new SalesMenuReadback.AssetStage(
                readback.assetRef(),
                target,
                readback.bindGrant(),
                readback.status(),
                readback.mediaType(),
                readback.contentDigest(),
                readback.version());
    }

    @Override
    public SalesMenuReadback.AssetRelease releaseStagedSalesMenuItemImage(
            SalesMenuAssetTarget target,
            OperationsOwnerScopeGrant ownerScopeGrant,
            long contextVersion,
            SalesMenuAssetCommandApi.ReleaseCommand command) {
        requireEnvelope(
                target,
                ownerScopeGrant,
                contextVersion,
                command.target(),
                command.ownerScopeGrant(),
                command.contextVersion());
        requireCatalogManagement(target, ownerScopeGrant, contextVersion);
        com.catering.v2s.platform.asset.api.SalesMenuAssetCommandApi.ReleaseReadback readback;
        try {
            readback = assetOwner.releaseStagedSalesMenuItemImage(
                    platformTarget(target, ownerScopeGrant),
                    ownerScopeGrant,
                    contextVersion,
                    new com.catering.v2s.platform.asset.api.SalesMenuAssetCommandApi.ReleaseCommand(
                            command.assetRef(), command.expectedVersion(), command.idempotencyKey()));
        } catch (PlatformAssetService.AssetOwnerScopeForbiddenException failure) {
            throw new SalesMenuAssetCommandApi.AssetTargetRejectedException(failure);
        } catch (PlatformAssetService.AssetClaimRejectedException failure) {
            throw new SalesMenuAssetCommandApi.AssetClaimRejectedException(failure);
        }
        return new SalesMenuReadback.AssetRelease(
                domainTarget(readback.target()), readback.assetRef(), readback.releasedAt(), readback.version());
    }

    @Override
    public SalesMenuReadback.AssetClaim claimSalesMenuItemImages(
            SalesMenuAssetTarget target,
            OperationsOwnerScopeGrant ownerScopeGrant,
            long contextVersion,
            List<SalesMenuAssetCommandApi.AssetBinding> bindings) {
        var requested = bindings == null ? List.<SalesMenuAssetCommandApi.AssetBinding>of() : List.copyOf(bindings);
        com.catering.v2s.platform.asset.api.SalesMenuAssetCommandApi.ClaimReadback readback;
        try {
            readback = assetOwner.claimSalesMenuItemImages(
                    platformTarget(target, ownerScopeGrant),
                    ownerScopeGrant,
                    contextVersion,
                    requested.stream()
                            .map(SalesMenuAssetCommandFacade::platformBinding)
                            .toList());
        } catch (PlatformAssetService.AssetOwnerScopeForbiddenException failure) {
            throw new SalesMenuAssetCommandApi.AssetTargetRejectedException(failure);
        } catch (PlatformAssetService.AssetClaimRejectedException failure) {
            throw new SalesMenuAssetCommandApi.AssetClaimRejectedException(failure);
        }
        return new SalesMenuReadback.AssetClaim(
                target,
                readback.assets().stream()
                        .map(asset ->
                                new SalesMenuReadback.ClaimedAsset(asset.assetRef(), asset.status(), asset.version()))
                        .toList());
    }

    private static com.catering.v2s.platform.asset.api.SalesMenuAssetCommandApi.AssetBinding platformBinding(
            SalesMenuAssetCommandApi.AssetBinding binding) {
        return new com.catering.v2s.platform.asset.api.SalesMenuAssetCommandApi.AssetBinding(
                binding.assetRef(), binding.bindGrant());
    }

    private static com.catering.v2s.platform.asset.api.SalesMenuAssetTarget platformTarget(
            SalesMenuAssetTarget target, OperationsOwnerScopeGrant ownerScopeGrant) {
        Objects.requireNonNull(target, "target");
        Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
        return new com.catering.v2s.platform.asset.api.SalesMenuAssetTarget(
                ownerScopeGrant.workspaceUuid(),
                target.groupWorkspaceKey(),
                target.storeRef(),
                target.salesMenuRef(),
                target.salesItemRef(),
                com.catering.v2s.platform.asset.api.SalesMenuAssetUsage.valueOf(
                        target.usage().name()),
                target.expectedDraftVersion());
    }

    private static SalesMenuAssetTarget domainTarget(com.catering.v2s.platform.asset.api.SalesMenuAssetTarget target) {
        Objects.requireNonNull(target, "target");
        return new SalesMenuAssetTarget(
                target.groupWorkspaceKey(),
                target.storeRef(),
                target.salesMenuRef(),
                target.salesItemRef(),
                com.catering.v2s.salesmenu.domain.SalesMenuAssetUsage.valueOf(
                        target.usage().name()),
                target.expectedDraftVersion());
    }

    private static void requireEnvelope(
            SalesMenuAssetTarget target,
            OperationsOwnerScopeGrant ownerScopeGrant,
            long contextVersion,
            SalesMenuAssetTarget commandTarget,
            OperationsOwnerScopeGrant commandGrant,
            long commandContextVersion) {
        if (!Objects.equals(target, commandTarget)
                || !Objects.equals(ownerScopeGrant, commandGrant)
                || contextVersion != commandContextVersion) {
            throw new IllegalArgumentException("asset command envelope does not match its target");
        }
    }

    private void requireCatalogManagement(
            SalesMenuAssetTarget target, OperationsOwnerScopeGrant grant, long contextVersion) {
        if (!grant.matchesCapability(
                        grant.workspaceUuid(),
                        target.groupWorkspaceKey(),
                        "STORE",
                        target.storeRef(),
                        STORE_SALES_MENU_CAPABILITY)
                || (grant.expectedContextVersion() >= 0 && !grant.matchesExpectedContextVersion(contextVersion))) {
            throw new SalesMenuOwnerApi.Problem("GRANT_INVALID", 403, "销售菜单授权无效");
        }
        if (storeOperatingRuleGate == null) {
            throw new IllegalStateException("store operating-rule gate is not wired");
        }
        storeOperatingRuleGate.requireCatalogManagementForStoreTarget(
                grant.workspaceUuid(), target.groupWorkspaceKey(), "STORE", target.storeRef());
    }
}
