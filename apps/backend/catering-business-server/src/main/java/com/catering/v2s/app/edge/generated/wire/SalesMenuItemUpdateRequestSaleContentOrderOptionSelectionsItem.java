// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuItemUpdateRequestSaleContentOrderOptionSelectionsItem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "definitionRef", required = true) java.util.UUID definitionRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "selectedValueRefs", required = true) java.util.List<java.util.UUID> selectedValueRefs
) {}
