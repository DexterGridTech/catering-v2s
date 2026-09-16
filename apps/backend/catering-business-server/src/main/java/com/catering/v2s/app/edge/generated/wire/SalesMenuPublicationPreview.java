// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuPublicationPreview(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "salesMenuRef", required = true) java.util.UUID salesMenuRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "draftRevision", required = true) Long draftRevision,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "hasChanges", required = true) Boolean hasChanges,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "violations", required = true) java.util.List<SalesMenuPublicationBlocker> violations
) {}
