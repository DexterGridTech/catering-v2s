package com.catering.v2s.businesschannel.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class BusinessChannelPolicyTest {
    @Test
    void dineInIsInternalAndRequiresExactlyOneDineInForm() {
        assertProblem(
                "DINE_IN_MUST_BE_INTERNAL",
                () -> BusinessChannelPolicy.validateTemplate(
                        BusinessChannelPolicy.EXTERNAL,
                        BusinessChannelPolicy.PROJECT,
                        BusinessChannelPolicy.DINE_IN,
                        "POS",
                        "PROVIDER",
                        provider(List.of("DINE_IN"), "ENABLED", "AVAILABLE")));
        assertProblem(
                "DINE_IN_FORM_MISMATCH",
                () -> BusinessChannelPolicy.validateTemplate(
                        BusinessChannelPolicy.INTERNAL,
                        BusinessChannelPolicy.PROJECT,
                        BusinessChannelPolicy.TAKEAWAY,
                        "POS",
                        null,
                        null));
    }

    @Test
    void nonDineInTemplateAcceptsNullDineInForm() {
        BusinessChannelPolicy.validateTemplate(
                BusinessChannelPolicy.INTERNAL,
                BusinessChannelPolicy.PROJECT,
                BusinessChannelPolicy.TAKEAWAY,
                null,
                null,
                null);
    }

    @Test
    void plannedCatalogueStatusDoesNotBlockAnEnabledProvider() {
        BusinessChannelPolicy.validateTemplate(
                BusinessChannelPolicy.EXTERNAL,
                BusinessChannelPolicy.PROJECT,
                BusinessChannelPolicy.GROUP_BUY,
                null,
                "PLANNED_PROVIDER",
                provider(List.of("GROUP_BUY"), "ENABLED", "PLANNED"));
    }

    @Test
    void disabledProviderIsRejectedEvenWhenItsCatalogueStatusIsAvailable() {
        assertProblem(
                "PROVIDER_NOT_ENABLED",
                () -> BusinessChannelPolicy.validateTemplate(
                        BusinessChannelPolicy.EXTERNAL,
                        BusinessChannelPolicy.PROJECT,
                        BusinessChannelPolicy.TAKEAWAY,
                        null,
                        "DISABLED_PROVIDER",
                        provider(List.of("TAKEAWAY"), "DISABLED", "AVAILABLE")));
    }

    @Test
    void channelCodeIsRequiredAndOnlySurroundingWhitespaceIsTrimmed() {
        assertProblem("VALIDATION_ERROR", () -> BusinessChannelPolicy.preserveChannelCode(null));
        assertEquals("business-code", BusinessChannelPolicy.preserveChannelCode("  business-code  "));
    }

    @Test
    void effectiveExternalChannelRequiresMatchingEffectiveBinding() {
        String nodeRef = UUID.randomUUID().toString();
        CollaborationReadback.OwnerBinding pending = new CollaborationReadback.OwnerBinding(
                UUID.randomUUID(),
                "PROVIDER",
                "Provider",
                "TAKEAWAY",
                "Takeaway",
                List.of("Takeaway"),
                "STORE",
                "Store",
                nodeRef,
                "binding",
                null,
                1L,
                1L,
                "PENDING_AUTHORIZATION",
                "Pending authorization",
                1);
        assertProblem(
                "BINDING_NOT_EFFECTIVE",
                () -> BusinessChannelPolicy.validateBinding(
                        BusinessChannelPolicy.EXTERNAL,
                        BusinessChannelPolicy.TAKEAWAY,
                        "PROVIDER",
                        pending,
                        "STORE",
                        nodeRef,
                        true));
    }

    private static CollaborationReadback.ProviderProfile provider(
            List<String> businessScope, String enablementStatus, String catalogStatus) {
        return new CollaborationReadback.ProviderProfile(
                "PROVIDER",
                "Provider",
                "SYSTEM",
                "System",
                businessScope,
                businessScope,
                List.of("PROJECT", "STORE"),
                List.of("PROJECT", "STORE"),
                "EXTERNAL_GRANT",
                "External grant",
                "LOCAL_ONLY",
                "Local only",
                catalogStatus,
                catalogStatus,
                enablementStatus,
                1);
    }

    private static void assertProblem(String code, Runnable action) {
        BusinessChannelCommandApi.Problem problem = assertThrows(BusinessChannelCommandApi.Problem.class, action::run);
        assertEquals(code, problem.code());
    }
}
