// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceScopeNode(
    String dataNodeType,
    java.util.UUID dataNodeRef,
    String dataNodeName,
    String dataNodeCode,
    java.util.List<String> ancestorPath,
    java.util.UUID regionRef,
    java.util.UUID projectRef,
    java.util.UUID storeRef,
    java.util.UUID headCompanyRef
) {}
