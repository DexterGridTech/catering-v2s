package com.catering.v2s.terminalupdate.application;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Outcome;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi;
import com.catering.v2s.terminalupdate.application.persistence.TerminalUpdateReportPersistence;
import java.util.UUID;
import org.junit.jupiter.api.Test;

final class TerminalUpdateReportOwnerServiceTest {
    @Test
    void staleBindingIsRejectedBeforeAnyReportLookupOrReceiptReplay() {
        TerminalUpdateReportPersistence persistence = mock(TerminalUpdateReportPersistence.class);
        TerminalCredentialVerificationApi credentials = mock(TerminalCredentialVerificationApi.class);
        TimeProvider time = mock(TimeProvider.class);
        var owner = new TerminalUpdateReportOwnerService(persistence, credentials, time);
        var binding = new Verification(Outcome.VERIFIED, UUID.randomUUID(), "group-1", UUID.randomUUID(),
                UUID.randomUUID(), 5, 1, "device-1");
        var report = new TerminalUpdateReportOwnerApi.ReportInput(UUID.randomUUID(), 1, null, "device-1",
                "{}", "{}", 1, "a".repeat(64));
        when(credentials.lockCurrentActiveBinding(binding)).thenReturn(false);

        assertThrows(TerminalUpdateReportOwnerApi.BindingNoLongerActiveException.class,
                () -> owner.record(binding, report));

        verify(credentials).lockCurrentActiveBinding(binding);
        verifyNoInteractions(persistence);
        verifyNoInteractions(time);
    }
}
