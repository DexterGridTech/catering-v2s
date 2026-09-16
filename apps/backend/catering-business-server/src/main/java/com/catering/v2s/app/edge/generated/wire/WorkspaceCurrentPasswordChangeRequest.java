// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceCurrentPasswordChangeRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "currentPassword", required = true) String currentPassword,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "newPassword", required = true) String newPassword,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedSessionVersion", required = true) Long expectedSessionVersion
) {}
