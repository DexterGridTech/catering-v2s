// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuAssetTargetReadback(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupWorkspaceKey", required = true) String groupWorkspaceKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeRef", required = true) java.util.UUID storeRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "salesMenuRef", required = true) java.util.UUID salesMenuRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "salesItemRef", required = true) java.util.UUID salesItemRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "usage", required = true) String usage,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedDraftVersion", required = true) Long expectedDraftVersion
) {}
