package com.catering.v2s.platform.asset.api;

import java.util.UUID;

public interface WorkspaceLogoAssetCommand {
    void claim(UUID assetRef, UUID workspaceUuid, String groupWorkspaceKey, String bindGrant);

    void release(UUID assetRef, UUID workspaceUuid);

    void releaseStaged(UUID assetRef, String bindGrant);
}
