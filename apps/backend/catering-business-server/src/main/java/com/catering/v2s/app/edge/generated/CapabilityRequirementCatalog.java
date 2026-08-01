// Generated from contracts/registry/iam-org-governance-manifest.json; do not edit.
package com.catering.v2s.app.edge.generated;

import com.catering.v2s.workspace.iam.api.WorkspaceCapabilityRequirementCatalog;
import java.util.List;
import java.util.Optional;

public final class CapabilityRequirementCatalog {
    private CapabilityRequirementCatalog() { }
    public static List<WorkspaceCapabilityRequirementCatalog.CapabilityRequirement> requirements() { return WorkspaceCapabilityRequirementCatalog.requirements(); }
    public static Optional<WorkspaceCapabilityRequirementCatalog.CapabilityRequirement> requirement(String requirementId) { return WorkspaceCapabilityRequirementCatalog.requirement(requirementId); }
    public static Optional<String> resolveCapabilityKey(String requirementId, String serverResolvedResourceType) { return WorkspaceCapabilityRequirementCatalog.resolveCapabilityKey(requirementId, serverResolvedResourceType); }
}
