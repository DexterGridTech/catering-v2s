// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceScopeContext(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "region", required = true) WorkspaceScopeNode region,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "project", required = true) WorkspaceScopeNode project,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "store", required = true) WorkspaceScopeNode store,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "headCompany", required = true) WorkspaceScopeNode headCompany
) {}
