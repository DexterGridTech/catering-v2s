package com.catering.v2s.terminalbinding.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;

import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Credential;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.BusinessCredential;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Outcome;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.catering.v2s.terminalbinding.persistence.TerminalBindingOwnerPersistence;
import com.catering.v2s.terminalbinding.persistence.TerminalBindingOwnerPersistence.AuthenticationFacts;
import com.catering.v2s.terminalbinding.persistence.TerminalBindingOwnerPersistence.LockedBinding;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TerminalCredentialVerificationServiceTest {
    private static final String GROUP_KEY = "group-1";
    private static final UUID TERMINAL_REF = UUID.randomUUID();
    private static final byte[] SECRET_DIGEST = new byte[32];
    private static final String DEVICE_ID = "device-1";

    @Test
    void currentCredentialIgnoresStoreDisabledButRequiresEnabledGroupAndTerminal() {
        TerminalBindingOwnerPersistence persistence = mock(TerminalBindingOwnerPersistence.class);
        AuthenticationFacts facts = facts("ENABLED", "ENABLED", "ACTIVE");
        when(persistence.readAuthenticationFacts(GROUP_KEY, TERMINAL_REF)).thenReturn(facts);
        var service = new TerminalCredentialVerificationService(persistence);

        Verification verified = service.verify(credential());

        assertEquals(Outcome.VERIFIED, verified.outcome());
        assertEquals(facts.workspaceUuid(), verified.workspaceUuid());
        assertEquals(facts.storeRef(), verified.storeRef());
        assertEquals(DEVICE_ID, verified.bindingDeviceId());
    }

    @Test
    void businessCredentialUsesTheSameBindingFactsWithoutADeviceInput() {
        TerminalBindingOwnerPersistence persistence = mock(TerminalBindingOwnerPersistence.class);
        AuthenticationFacts facts = facts("ENABLED", "ENABLED", "ACTIVE");
        when(persistence.readAuthenticationFacts(GROUP_KEY, TERMINAL_REF)).thenReturn(facts);
        var service = new TerminalCredentialVerificationService(persistence);

        Verification verified = service.verifyBusinessCredential(
                new BusinessCredential(GROUP_KEY, TERMINAL_REF, 5, SECRET_DIGEST));

        assertEquals(Outcome.VERIFIED, verified.outcome());
        assertEquals(facts.boundDeviceId(), verified.bindingDeviceId());
        verify(persistence).readAuthenticationFacts(GROUP_KEY, TERMINAL_REF);
    }

    @Test
    void currentCredentialIsRejectedForDisabledGroupOrTerminalOnlyAfterCredentialProof() {
        TerminalBindingOwnerPersistence persistence = mock(TerminalBindingOwnerPersistence.class);
        when(persistence.readAuthenticationFacts(GROUP_KEY, TERMINAL_REF))
                .thenReturn(
                        facts("DISABLED", "DISABLED", "ACTIVE"),
                        facts("ENABLED", "DISABLED", "ACTIVE"),
                        facts("ENABLED", "DISABLED", "ACTIVE"));
        var service = new TerminalCredentialVerificationService(persistence);

        assertEquals(
                Outcome.GROUP_WORKSPACE_DISABLED, service.verify(credential()).outcome());
        assertEquals(Outcome.TERMINAL_DISABLED, service.verify(credential()).outcome());
        assertEquals(
                Outcome.CREDENTIAL_INVALID,
                service.verify(credentialWithDigest(differentDigest())).outcome());
    }

    @Test
    void expiredGenerationWinsBeforeScopeStatusAndDoesNotReturnIdentity() {
        TerminalBindingOwnerPersistence persistence = mock(TerminalBindingOwnerPersistence.class);
        when(persistence.readAuthenticationFacts(GROUP_KEY, TERMINAL_REF))
                .thenReturn(facts("DISABLED", "VOIDED", "ACTIVE"));
        var service = new TerminalCredentialVerificationService(persistence);

        Verification result = service.verify(new Credential(GROUP_KEY, TERMINAL_REF, 4, SECRET_DIGEST, DEVICE_ID));

        assertEquals(Outcome.ACTIVATION_CANCELLED, result.outcome());
        assertNull(result.workspaceUuid());
        assertNull(result.terminalRef());
    }

    @Test
    void endedCurrentCredentialIsCancelledWithoutComparingDeviceId() {
        TerminalBindingOwnerPersistence persistence = mock(TerminalBindingOwnerPersistence.class);
        AuthenticationFacts ended = new AuthenticationFacts(
                UUID.randomUUID(),
                "DISABLED",
                UUID.randomUUID(),
                "DISABLED",
                "DISABLED",
                5L,
                SECRET_DIGEST,
                "ENDED",
                null,
                1L);
        when(persistence.readAuthenticationFacts(GROUP_KEY, TERMINAL_REF)).thenReturn(ended);
        var service = new TerminalCredentialVerificationService(persistence);

        Verification result =
                service.verify(new Credential(GROUP_KEY, TERMINAL_REF, 5L, SECRET_DIGEST, "different-device"));

        assertEquals(Outcome.ACTIVATION_CANCELLED, result.outcome());
        assertNull(result.workspaceUuid());
    }

    @Test
    void credentialTextRepresentationRedactsDigestAndDeviceId() {
        Credential credential = credential();

        String rendered = credential.toString();

        assertFalse(rendered.contains(DEVICE_ID));
        assertTrue(rendered.contains("secretDigest=redacted"));
    }

    @Test
    void reportOwnerBindingLockRequiresTheSameEnabledActiveBinding() {
        TerminalBindingOwnerPersistence persistence = mock(TerminalBindingOwnerPersistence.class);
        UUID workspace = UUID.randomUUID();
        UUID store = UUID.randomUUID();
        Verification verification = new Verification(Outcome.VERIFIED, workspace, GROUP_KEY, store,
                TERMINAL_REF, 5, 1, DEVICE_ID);
        when(persistence.lockLatest(workspace, GROUP_KEY, TERMINAL_REF)).thenReturn(new LockedBinding(
                "ACTIVE", 5, SECRET_DIGEST, DEVICE_ID, 1, null, null, null, null, null, null));
        when(persistence.readAuthenticationFacts(GROUP_KEY, TERMINAL_REF)).thenReturn(new AuthenticationFacts(
                workspace, "ENABLED", store, "ENABLED", "ENABLED", 5L, SECRET_DIGEST, "ACTIVE", DEVICE_ID, 1L));
        var service = new TerminalCredentialVerificationService(persistence);

        assertTrue(service.lockCurrentActiveBinding(verification));

        verify(persistence).lockLatest(workspace, GROUP_KEY, TERMINAL_REF);
        verify(persistence).readAuthenticationFacts(GROUP_KEY, TERMINAL_REF);
        assertFalse(service.lockCurrentActiveBinding(new Verification(
                Outcome.VERIFIED, workspace, GROUP_KEY, store, TERMINAL_REF, 4, 1, DEVICE_ID)));
        verify(persistence, times(1)).readAuthenticationFacts(GROUP_KEY, TERMINAL_REF);
    }

    private static AuthenticationFacts facts(String groupStatus, String terminalStatus, String bindingStatus) {
        return new AuthenticationFacts(
                UUID.randomUUID(),
                groupStatus,
                UUID.randomUUID(),
                "DISABLED",
                terminalStatus,
                5L,
                SECRET_DIGEST,
                bindingStatus,
                DEVICE_ID,
                1L);
    }

    private static Credential credential() {
        return credentialWithDigest(SECRET_DIGEST);
    }

    private static Credential credentialWithDigest(byte[] digest) {
        return new Credential(GROUP_KEY, TERMINAL_REF, 5L, digest, DEVICE_ID);
    }

    private static byte[] differentDigest() {
        byte[] digest = new byte[32];
        digest[0] = 1;
        return digest;
    }
}
