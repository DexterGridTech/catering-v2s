package com.catering.v2s.terminaldataserver.websocket;

import java.sql.SQLException;
import java.util.regex.Pattern;

/** Extracts only bounded exception metadata safe for authentication-failure logs. */
final class TdsAuthenticationFailureDiagnostics {
    private static final Pattern SAFE_TYPE = Pattern.compile("[A-Za-z_$][A-Za-z0-9_$]{0,63}");
    private static final Pattern SQL_STATE = Pattern.compile("[A-Z0-9]{5}");
    private static final int MAX_CAUSE_DEPTH = 16;

    private TdsAuthenticationFailureDiagnostics() {}

    static Diagnostic describe(Throwable failure, Stage stage) {
        String safeStage = stage == null ? Stage.UNKNOWN.name() : stage.name();
        if (failure == null) return new Diagnostic(safeStage, "UNKNOWN", "UNKNOWN", "NONE");

        Throwable root = failure;
        Throwable current = failure;
        String sqlState = "NONE";
        for (int depth = 0; current != null && depth < MAX_CAUSE_DEPTH; depth++) {
            root = current;
            if (current instanceof SQLException sqlException) {
                String candidate = sqlException.getSQLState();
                if (candidate != null && SQL_STATE.matcher(candidate).matches()) sqlState = candidate;
            }
            Throwable cause = current.getCause();
            if (cause == null || cause == current) break;
            current = cause;
        }
        return new Diagnostic(safeStage, typeName(failure), typeName(root), sqlState);
    }

    private static String typeName(Throwable failure) {
        String name = failure.getClass().getSimpleName();
        return name != null && SAFE_TYPE.matcher(name).matches() ? name : "UNKNOWN";
    }

    enum Stage {
        AUTHENTICATION_FRAME_DECODE,
        SESSION_ATTEMPT_ID_GENERATION,
        SESSION_ATTEMPT_BEGIN,
        CREDENTIAL_VERIFICATION,
        VERIFICATION_RECORD,
        REGISTRATION_GATE,
        SESSION_REGISTER,
        UNKNOWN
    }

    record Diagnostic(String stage, String failureType, String rootFailureType, String sqlState) {}
}
