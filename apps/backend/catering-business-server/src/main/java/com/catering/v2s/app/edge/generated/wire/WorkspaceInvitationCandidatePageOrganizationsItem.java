// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceInvitationCandidatePageOrganizationsItem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "serviceNodeType", required = true) String serviceNodeType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "organizationRef", required = true) java.util.UUID organizationRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "path", required = true) String path,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "pathNodes", required = true) java.util.List<OrganizationPathNode> pathNodes
) {}
