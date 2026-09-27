// Generated from contracts/registry/iam-org-governance-manifest.json; do not edit.
package com.catering.v2s.app.edge.generated;

import com.catering.v2s.workspace.iam.api.WorkspaceCapabilityRequirementCatalog;
import java.util.List;
import java.util.Optional;

public final class CapabilityResolverRegistry {
    private CapabilityResolverRegistry() { }
    public static List<ResolverDefinition> resolvers() { return List.of(
        resolver("AUTHENTICATED_WORKSPACE_ROLE_NODE_RANGE", AuthorizationMode.AUTHENTICATED_WORKSPACE, List.of("authenticatedWorkspaceSession", "serverResolvedResourceTypeAndId", "assignmentNode"), List.of("ALLOW", "DENY", "readScopePredicate"), false),
        resolver("AUTHENTICATED_WORKSPACE_SELF_SESSION", AuthorizationMode.AUTHENTICATED_WORKSPACE, List.of("authenticatedWorkspaceSession"), List.of("ALLOW", "DENY", "firstOwnerQueryPredicate"), false),
        resolver("AUTHENTICATED_WORKSPACE_TARGET_SCOPE", AuthorizationMode.AUTHENTICATED_WORKSPACE, List.of("authenticatedWorkspaceSession", "serverResolvedResourceTypeAndId", "assignmentNode"), List.of("ALLOW", "DENY", "firstOwnerQueryPredicate"), false),
        resolver("PLATFORM_SESSION_ENABLED_ADMIN", AuthorizationMode.AUTHENTICATED_PLATFORM_SUPER_ADMIN, List.of("activePlatformSession", "enabledPlatformAdministrator"), List.of("ALLOW", "DENY", "firstOwnerQueryPredicate"), true),
        resolver("PUBLIC_PROTOCOL_OWNER_FACT", AuthorizationMode.PUBLIC_PROTOCOL, List.of("ownerValidatedCredentialOrOtpOrBoundFlow", "serverResolvedResourceTypeAndId"), List.of("ALLOW", "DENY", "firstOwnerQueryPredicate"), true),
        resolver("PUBLIC_PROTOCOL_TOKEN", AuthorizationMode.PUBLIC_PROTOCOL, List.of("serverValidatedInvitationOrResetToken", "serverResolvedResourceTypeAndId"), List.of("ALLOW", "DENY", "firstOwnerQueryPredicate"), true),
        resolver("TERMINAL_CREDENTIAL_AUTHENTICATOR", AuthorizationMode.TERMINAL_CREDENTIAL, List.of("parsedTerminalCredential", "deviceId", "serverResolvedTerminalBinding"), List.of("ALLOW", "DENY", "terminalBindingIdentity"), true)
    ); }
    public static Optional<ResolverDefinition> resolver(String resolverId) { return resolvers().stream().filter(value -> value.resolverId().equals(resolverId)).findFirst(); }
    public static Optional<String> resolveCapabilityKey(String requirementId, String serverResolvedResourceType) { return WorkspaceCapabilityRequirementCatalog.resolveCapabilityKey(requirementId, serverResolvedResourceType); }
    private static ResolverDefinition resolver(String resolverId, AuthorizationMode authorizationMode, List<String> inputs, List<String> outputs, boolean authenticatedWorkspaceSessionForbidden) { return new ResolverDefinition(resolverId, authorizationMode, inputs, outputs, authenticatedWorkspaceSessionForbidden); }
    public enum AuthorizationMode { AUTHENTICATED_WORKSPACE, AUTHENTICATED_PLATFORM_SUPER_ADMIN, PUBLIC_PROTOCOL, TERMINAL_CREDENTIAL }
    public record ResolverDefinition(String resolverId, AuthorizationMode authorizationMode, List<String> inputs, List<String> outputs, boolean authenticatedWorkspaceSessionForbidden) { }
}
