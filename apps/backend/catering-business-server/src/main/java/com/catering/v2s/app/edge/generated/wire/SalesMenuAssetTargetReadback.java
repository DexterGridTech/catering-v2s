// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuAssetTargetReadback(
    String groupWorkspaceKey,
    java.util.UUID storeRef,
    java.util.UUID salesMenuRef,
    java.util.UUID salesItemRef,
    String usage,
    Long expectedDraftVersion
) {}
