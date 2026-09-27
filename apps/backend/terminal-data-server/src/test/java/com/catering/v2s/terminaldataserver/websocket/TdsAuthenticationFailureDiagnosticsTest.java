package com.catering.v2s.terminaldataserver.websocket;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.sql.SQLException;
import org.junit.jupiter.api.Test;

class TdsAuthenticationFailureDiagnosticsTest {
    @Test
    void describesFailureTypesAndSqlStateWithoutExposingExceptionMessages() {
        SQLException sqlFailure = new SQLException("credential-secret-must-not-be-logged", "08006");
        IllegalStateException failure = new IllegalStateException("raw-payload-must-not-be-logged", sqlFailure);

        var diagnostic = TdsAuthenticationFailureDiagnostics.describe(
                failure, TdsAuthenticationFailureDiagnostics.Stage.CREDENTIAL_VERIFICATION);

        assertEquals("CREDENTIAL_VERIFICATION", diagnostic.stage());
        assertEquals("IllegalStateException", diagnostic.failureType());
        assertEquals("SQLException", diagnostic.rootFailureType());
        assertEquals("08006", diagnostic.sqlState());
        assertFalse(diagnostic.toString().contains("credential-secret-must-not-be-logged"));
        assertFalse(diagnostic.toString().contains("raw-payload-must-not-be-logged"));
    }

    @Test
    void rejectsMalformedSqlStateAndHandlesNullThrowable() {
        var malformedState = TdsAuthenticationFailureDiagnostics.describe(
                new SQLException("ignored", "secret"), TdsAuthenticationFailureDiagnostics.Stage.UNKNOWN);
        var absent = TdsAuthenticationFailureDiagnostics.describe(null, null);

        assertEquals("NONE", malformedState.sqlState());
        assertEquals(
                new TdsAuthenticationFailureDiagnostics.Diagnostic("UNKNOWN", "UNKNOWN", "UNKNOWN", "NONE"), absent);
    }
}
