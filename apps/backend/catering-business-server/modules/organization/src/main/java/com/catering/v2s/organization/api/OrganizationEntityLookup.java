package com.catering.v2s.organization.api;

import java.util.UUID;

public interface OrganizationEntityLookup {
    boolean isEnterableEntity(UUID workspaceUuid, String groupWorkspaceKey, String entityType, UUID entityId);

    /** Display-only owner read for a task readback; this grants no entity command authority. */
    String describeEntityPath(UUID workspaceUuid, String groupWorkspaceKey, String entityType, UUID entityId);
}
