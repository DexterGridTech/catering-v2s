package com.catering.v2s.collaboration.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.collaboration.api.CollaborationCatalogSource;
import com.catering.v2s.collaboration.api.CollaborationCommandApi;
import java.util.List;
import org.junit.jupiter.api.Test;

class CollaborationBindingPolicyTest {
    private static final CollaborationCatalogSource.ProviderProfileDefinition EXTERNAL =
            provider("EXTERNAL_GRANT", List.of("TAKEAWAY", "GROUP_BUY"), List.of("PROJECT", "STORE"));
    private static final CollaborationCatalogSource.ProviderProfileDefinition INTERNAL =
            provider("INTERNAL_MAPPING", List.of("ORDER_SYNC"), List.of("PROJECT"));
    private static final CollaborationCatalogSource.ProviderProfileDefinition NONE =
            provider("NO_MAPPING", List.of("MEMBER_BENEFIT"), List.of("STORE"));

    @Test
    void externalGrantCreateAcceptsNullExternalOwnerAndWaitsForCallback() {
        CollaborationBindingPolicy.CreateShape shape =
                CollaborationBindingPolicy.validateCreate(EXTERNAL, "TAKEAWAY", "STORE", "store-ref", null);

        assertNull(shape.externalOwnerId());
        assertEquals(CollaborationBindingPolicy.PENDING_AUTHORIZATION, shape.initialStatus());
    }

    @Test
    void platformCreateRejectsExternalGrantWhileSharedCreatePolicyRemainsAvailableToOperations() {
        CollaborationCommandApi.Problem problem = assertThrows(
                CollaborationCommandApi.Problem.class,
                () -> CollaborationBindingPolicy.validatePlatformCreate(EXTERNAL));

        assertEquals("BINDING_EDIT_NOT_ALLOWED", problem.code());
        assertEquals(403, problem.status());
    }

    @Test
    void internalMappingRequiresOwnerAndNoMappingRejectsOwner() {
        assertThrows(
                RuntimeException.class,
                () -> CollaborationBindingPolicy.validateCreate(INTERNAL, null, "PROJECT", "project-ref", null));
        assertThrows(
                RuntimeException.class,
                () -> CollaborationBindingPolicy.validateCreate(NONE, null, "STORE", "store-ref", "external-store"));
    }

    @Test
    void nonOpenBindingIsEffectiveImmediatelyAndCapabilityIsNotInvented() {
        CollaborationBindingPolicy.CreateShape shape =
                CollaborationBindingPolicy.validateCreate(NONE, null, "STORE", "store-ref", null);

        assertNull(shape.capabilityClass());
        assertEquals(CollaborationBindingPolicy.EFFECTIVE, shape.initialStatus());
    }

    @Test
    void providerScopeAndBindableNodeAreCheckedAgainstCheckedInDefinition() {
        assertThrows(
                RuntimeException.class,
                () -> CollaborationBindingPolicy.validateCreate(
                        EXTERNAL, "ORDER_SYNC", "PROJECT", "project-ref", null));
        assertThrows(
                RuntimeException.class,
                () -> CollaborationBindingPolicy.validateCreate(EXTERNAL, "TAKEAWAY", "REGION", "region-ref", null));
    }

    @Test
    void operationsCapabilityMappingIsClosedToProjectAndStore() {
        assertEquals(
                "BC-BUSINESS-CHANNEL-PROJECT-EDIT", CollaborationBindingPolicy.requiredOperationsCapability("PROJECT"));
        assertEquals(
                "BC-BUSINESS-CHANNEL-STORE-EDIT", CollaborationBindingPolicy.requiredOperationsCapability("STORE"));
        assertThrows(RuntimeException.class, () -> CollaborationBindingPolicy.requiredOperationsCapability("REGION"));
    }

    private static CollaborationCatalogSource.ProviderProfileDefinition provider(
            String authenticationKind, List<String> businessScope, List<String> bindableNodeTypes) {
        return new CollaborationCatalogSource.ProviderProfileDefinition(
                "TEST_PROVIDER",
                "Test provider",
                "TEST_SYSTEM",
                businessScope,
                bindableNodeTypes,
                authenticationKind,
                "LOCAL_ONLY",
                "AVAILABLE");
    }
}
