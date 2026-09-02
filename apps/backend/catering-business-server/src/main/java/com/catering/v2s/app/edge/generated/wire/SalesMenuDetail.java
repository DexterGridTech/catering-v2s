// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuDetail(
    java.util.UUID salesMenuRef,
    String groupWorkspaceKey,
    java.util.UUID storeRef,
    String name,
    Boolean archived,
    Long version,
    Long draftRevision,
    Long latestPublishedRevision,
    Boolean draftDirty,
    SalesMenuActivation activation,
    SalesMenuSchedule draftSchedule,
    SalesMenuSchedule latestPublishedSchedule
) {}
