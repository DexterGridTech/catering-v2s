// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record ExtensionDefinition(
    String groupWorkspaceKey,
    ExtensionEntityType entityType,
    java.util.List<ExtensionDefinitionDefinitionsItem> definitions,
    Long revision,
    Long updatedAt,
    GroupWorkspaceStatus workspaceStatus,
    java.util.List<ExtensionDefinitionBlocker> blockers
) {}
