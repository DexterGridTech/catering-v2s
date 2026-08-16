package com.catering.v2s.app.configuration;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.app.edge.generated.wire.OperationsPasswordRecoveryOtpSendResponse;
import com.catering.v2s.app.edge.generated.wire.PlatformOtpDispatchResponse;
import com.catering.v2s.app.edge.generated.wire.PublicInvitationOtpSendResponse;
import com.catering.v2s.app.edge.generated.wire.WorkspaceOtpSendResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class OtpDispatchWireSerializationConfigurationTest {
    @Test
    void productionDispatchesOmitAbsentDebugCodeWithoutChangingOtherFields() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        OtpDispatchWireSerializationConfiguration.configure(mapper);

        String platform = mapper.writeValueAsString(new PlatformOtpDispatchResponse(123L, null));
        String workspace = mapper.writeValueAsString(new WorkspaceOtpSendResponse(123L, null));
        String invitation = mapper.writeValueAsString(new PublicInvitationOtpSendResponse("verification", 123L, null));
        String operationsRecovery =
                mapper.writeValueAsString(new OperationsPasswordRecoveryOtpSendResponse(123L, null));

        for (String value : new String[] {platform, workspace, invitation, operationsRecovery})
            assertFalse(value.contains("debugVerificationCode"));
        assertTrue(invitation.contains("verificationId"));
        assertTrue(platform.contains("expiresAt"));
    }

    @Test
    void workspaceDebugEnabledResponseUsesTheApprovedPublicFieldName() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        OtpDispatchWireSerializationConfiguration.configure(mapper);

        String workspace = mapper.writeValueAsString(new WorkspaceOtpSendResponse(123L, "123456"));

        assertTrue(workspace.contains("debugVerificationCode"));
        assertTrue(workspace.contains("123456"));
        assertFalse(workspace.contains("testCode"));
    }
}
