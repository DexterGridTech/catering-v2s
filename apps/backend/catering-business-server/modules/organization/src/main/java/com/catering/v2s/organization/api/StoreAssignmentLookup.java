package com.catering.v2s.organization.api;

import java.util.UUID;

/** Owner judgment used by workspace-IAM during invitation completion and context switching. */
public interface StoreAssignmentLookup {
    boolean isEnterableStore(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId);
}
