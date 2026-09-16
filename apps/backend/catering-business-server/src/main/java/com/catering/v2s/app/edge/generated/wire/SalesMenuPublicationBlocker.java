// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuPublicationBlocker(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "kind", required = true) String kind,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "salesItemRef", required = true) java.util.UUID salesItemRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "messageKey", required = true) String messageKey
) {}
