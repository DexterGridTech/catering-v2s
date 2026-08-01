package com.catering.v2s.extension.api;

import java.util.UUID;

public interface ExtensionDefinitionLookup {
    default long requireDefinitionVersion(UUID workspaceUuid, String groupWorkspaceKey, String hostType) {
        return requireDefinition(workspaceUuid, groupWorkspaceKey, hostType).version();
    }

    ExtensionDefinitionReadback requireDefinition(UUID workspaceUuid, String groupWorkspaceKey, String hostType);
}
