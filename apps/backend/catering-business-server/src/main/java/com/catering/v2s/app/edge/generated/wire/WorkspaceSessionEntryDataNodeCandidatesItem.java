// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceSessionEntryDataNodeCandidatesItem(
    ServiceNodeType dataNodeType,
    String dataNodeRef,
    String dataNodeName,
    java.util.List<String> ancestorPath,
    String regionRef,
    String projectRef,
    String storeRef
) {}
