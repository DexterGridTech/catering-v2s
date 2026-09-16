// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuSummary(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "salesMenuRef", required = true) java.util.UUID salesMenuRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeRef", required = true) java.util.UUID storeRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "archived", required = true) Boolean archived,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "version", required = true) Long version,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "draftRevision", required = true) Long draftRevision,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "latestPublishedRevision", required = true) Long latestPublishedRevision,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "draftDirty", required = true) Boolean draftDirty,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "activation", required = true) SalesMenuActivation activation,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "draftSchedule", required = true) SalesMenuSchedule draftSchedule
) {}
