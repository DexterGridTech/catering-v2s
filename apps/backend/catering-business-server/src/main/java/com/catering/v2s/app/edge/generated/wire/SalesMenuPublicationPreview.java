// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuPublicationPreview(
    java.util.UUID salesMenuRef,
    Long draftRevision,
    Boolean hasChanges,
    java.util.List<SalesMenuPublicationBlocker> violations
) {}
