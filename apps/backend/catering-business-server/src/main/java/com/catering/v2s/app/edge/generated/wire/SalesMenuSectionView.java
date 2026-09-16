// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuSectionView(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "salesSectionRef", required = true) java.util.UUID salesSectionRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "displayOrder", required = true) Long displayOrder,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "itemCount", required = true) Long itemCount,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "canMoveUp", required = true) Boolean canMoveUp,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "canMoveDown", required = true) Boolean canMoveDown
) {}
