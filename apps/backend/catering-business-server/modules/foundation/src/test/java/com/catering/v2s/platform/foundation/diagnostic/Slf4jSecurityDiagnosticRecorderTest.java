package com.catering.v2s.platform.foundation.diagnostic;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class Slf4jSecurityDiagnosticRecorderTest {
    @Test
    void rendersTheClosedDiagnosticEnvelopeForPlainConsoleLayouts() {
        SecurityDiagnosticEvent event = new SecurityDiagnosticEvent(
                new RequestDiagnosticContext(
                        "corr-1",
                        "req-1",
                        "WORKSPACE_OTP_SEND",
                        "/api/operations/group-workspaces/{groupWorkspaceKey}/otp/send",
                        "workspace-iam"),
                "REQUEST_COMPLETED",
                "EDGE",
                "REJECTED",
                18,
                401,
                "WORKSPACE_IAM_INVALID_CREDENTIALS",
                2,
                9);

        assertEquals(
                "security-diagnostic correlationId=corr-1 requestId=req-1 operationId=WORKSPACE_OTP_SEND "
                        + "routeTemplate=/api/operations/group-workspaces/{groupWorkspaceKey}/otp/send "
                        + "owner=workspace-iam "
                        + "event=REQUEST_COMPLETED phase=EDGE outcome=REJECTED durationMillis=18 status=401 "
                        + "errorCode=WORKSPACE_IAM_INVALID_CREDENTIALS databaseOperationCount=2 "
                        + "databaseDurationMillis=9",
                Slf4jSecurityDiagnosticRecorder.render(event.fields()));
    }
}
