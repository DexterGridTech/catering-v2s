// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalStoreOrganizationPathRead(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "projectRef", required = true) java.util.UUID projectRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "projectName", required = true) String projectName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "regionRef", required = true) java.util.UUID regionRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "regionName", required = true) String regionName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "commercialGroupRef", required = true) java.util.UUID commercialGroupRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "commercialGroupName", required = true) String commercialGroupName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "projectUpdatedAtEpochMillis", required = true) Long projectUpdatedAtEpochMillis,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "regionUpdatedAtEpochMillis", required = true) Long regionUpdatedAtEpochMillis,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "commercialGroupUpdatedAtEpochMillis", required = true) Long commercialGroupUpdatedAtEpochMillis
) {}
