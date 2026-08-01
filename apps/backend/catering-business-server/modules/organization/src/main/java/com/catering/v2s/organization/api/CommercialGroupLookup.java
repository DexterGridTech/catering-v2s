package com.catering.v2s.organization.api;

import java.util.UUID;

/**
 * Owner judgment for the commercial-group logical root.  A commercial group is
 * deliberately not an {@code organization_node}; consumers must use this API
 * rather than inventing a synthetic GROUP node.
 */
public interface CommercialGroupLookup {
    UUID requireCommercialGroupRef(UUID workspaceUuid, String groupWorkspaceKey);

    boolean isEnterableCommercialGroup(UUID workspaceUuid, String groupWorkspaceKey, UUID commercialGroupRef);

    /** Display-only owner read for session and invitation task readbacks. */
    String describeCommercialGroup(UUID workspaceUuid, String groupWorkspaceKey, UUID commercialGroupRef);
}
