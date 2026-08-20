package com.catering.v2s.collaboration.application;

import com.catering.v2s.collaboration.api.CollaborationCatalogSource;
import com.catering.v2s.collaboration.api.CollaborationCommandApi;
import java.util.Objects;

/** Pure binding invariants shared by platform, operations and adapter command paths. */
public final class CollaborationBindingPolicy {
    public static final String EXTERNAL_GRANT = "EXTERNAL_GRANT";
    public static final String INTERNAL_MAPPING = "INTERNAL_MAPPING";
    public static final String NO_MAPPING = "NO_MAPPING";
    public static final String PENDING_AUTHORIZATION = "PENDING_AUTHORIZATION";
    public static final String EFFECTIVE = "EFFECTIVE";

    private CollaborationBindingPolicy() {}

    public static CreateShape validateCreate(
            CollaborationCatalogSource.ProviderProfileDefinition provider,
            String capabilityClass,
            String nodeType,
            String nodeRef,
            String externalOwnerId) {
        Objects.requireNonNull(provider, "provider");
        String normalizedNodeType = required(nodeType, "nodeType");
        String normalizedNodeRef = required(nodeRef, "nodeRef");
        String normalizedCapability = optional(capabilityClass);
        String normalizedOwner = optional(externalOwnerId);
        if (!provider.bindableNodeTypes().contains(normalizedNodeType)) {
            throw problem("NODE_TYPE_NOT_BINDABLE", 422, "nodeType is not bindable for this provider");
        }
        if (EXTERNAL_GRANT.equals(provider.authenticationKind())) {
            if (normalizedCapability == null || !provider.businessScope().contains(normalizedCapability)) {
                throw problem("BUSINESS_SCOPE_EXCEEDED", 422, "capabilityClass is outside provider businessScope");
            }
            return new CreateShape(
                    normalizedCapability,
                    normalizedNodeType,
                    normalizedNodeRef,
                    normalizedOwner,
                    PENDING_AUTHORIZATION);
        }
        if (normalizedCapability != null) {
            throw problem("BUSINESS_SCOPE_EXCEEDED", 422, "capabilityClass is only valid for EXTERNAL_GRANT");
        }
        if (INTERNAL_MAPPING.equals(provider.authenticationKind())) {
            if (normalizedOwner == null) {
                throw problem("EXTERNAL_OWNER_ID_MISMATCH", 422, "externalOwnerId is required for INTERNAL_MAPPING");
            }
            return new CreateShape(null, normalizedNodeType, normalizedNodeRef, normalizedOwner, EFFECTIVE);
        }
        if (NO_MAPPING.equals(provider.authenticationKind())) {
            if (normalizedOwner != null) {
                throw problem("EXTERNAL_OWNER_ID_MISMATCH", 422, "externalOwnerId is forbidden for NO_MAPPING");
            }
            return new CreateShape(null, normalizedNodeType, normalizedNodeRef, null, EFFECTIVE);
        }
        throw problem("CATALOG_INVALID", 500, "provider authenticationKind is unsupported");
    }

    public static void validatePlatformCreate(CollaborationCatalogSource.ProviderProfileDefinition provider) {
        Objects.requireNonNull(provider, "provider");
        if (EXTERNAL_GRANT.equals(provider.authenticationKind())) {
            throw problem(
                    "BINDING_EDIT_NOT_ALLOWED",
                    403,
                    "EXTERNAL_GRANT bindings are created by the external authorization flow");
        }
    }

    public static String validateUpdate(
            CollaborationCatalogSource.ProviderProfileDefinition provider, String externalOwnerId) {
        Objects.requireNonNull(provider, "provider");
        String normalizedOwner = optional(externalOwnerId);
        if (EXTERNAL_GRANT.equals(provider.authenticationKind())) {
            throw problem("BINDING_EDIT_NOT_ALLOWED", 403, "EXTERNAL_GRANT bindings are callback-managed");
        }
        if (INTERNAL_MAPPING.equals(provider.authenticationKind()) && normalizedOwner == null) {
            throw problem("EXTERNAL_OWNER_ID_MISMATCH", 422, "externalOwnerId is required for INTERNAL_MAPPING");
        }
        if (NO_MAPPING.equals(provider.authenticationKind()) && normalizedOwner != null) {
            throw problem("EXTERNAL_OWNER_ID_MISMATCH", 422, "externalOwnerId is forbidden for NO_MAPPING");
        }
        return normalizedOwner;
    }

    public static String requiredOperationsCapability(String nodeType) {
        return switch (required(nodeType, "nodeType")) {
            case "PROJECT" -> "BC-BUSINESS-CHANNEL-PROJECT-EDIT";
            case "STORE" -> "BC-BUSINESS-CHANNEL-STORE-EDIT";
            default -> throw problem("AUTHORIZATION_REQUIRED", 409, "operations binding target is not a channel node");
        };
    }

    public static String required(String value, String name) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty()) throw problem("VALIDATION_ERROR", 422, name + " is required");
        return normalized;
    }

    public static String optional(String value) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static CollaborationCommandApi.Problem problem(String code, int status, String message) {
        return new CollaborationCommandApi.Problem(code, status, message);
    }

    public record CreateShape(
            String capabilityClass, String nodeType, String nodeRef, String externalOwnerId, String initialStatus) {}
}
