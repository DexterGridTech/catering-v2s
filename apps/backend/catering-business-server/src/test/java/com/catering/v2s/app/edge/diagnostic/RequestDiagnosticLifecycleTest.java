package com.catering.v2s.app.edge.diagnostic;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.platform.foundation.diagnostic.RequestDiagnosticContext;
import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import java.util.List;
import org.junit.jupiter.api.Test;

class RequestDiagnosticLifecycleTest {
    @Test
    void nestedLifecyclesRestoreTheParentPhaseContext() {
        RequestDiagnosticContext outerContext = context("outer");
        RequestDiagnosticContext innerContext = context("inner");
        try (DatabaseOperationTracker.Scope ignored = DatabaseOperationTracker.open()) {
            RequestDiagnosticLifecycle.Lifecycle outer = RequestDiagnosticLifecycle.open(outerContext, "test");
            try {
                RequestDiagnosticLifecycle.Lifecycle inner = RequestDiagnosticLifecycle.open(innerContext, "test");
                try {
                    RequestDiagnosticLifecycle.mark(RequestDiagnosticLifecycle.Phase.OWNER_COMMAND_BEGIN);
                } finally {
                    RequestDiagnosticLifecycle.close(inner);
                }
                RequestDiagnosticLifecycle.mark(RequestDiagnosticLifecycle.Phase.READBACK_END);
                List<DatabaseOperationTracker.Phase> phases = DatabaseOperationTracker.snapshot().phaseCheckpoints().stream()
                        .map(DatabaseOperationTracker.PhaseCheckpoint::phase)
                        .toList();
                assertEquals(List.of(
                        DatabaseOperationTracker.Phase.EDGE_IN,
                        DatabaseOperationTracker.Phase.EDGE_IN,
                        DatabaseOperationTracker.Phase.OWNER_COMMAND_BEGIN,
                        DatabaseOperationTracker.Phase.READBACK_END), phases);
            } finally {
                RequestDiagnosticLifecycle.close(outer);
            }
        }
    }

    @Test
    void nullPhaseIsRejectedByTheClosedVocabulary() {
        assertThrows(IllegalArgumentException.class, () -> RequestDiagnosticLifecycle.mark(null));
    }

    private static RequestDiagnosticContext context(String suffix) {
        return new RequestDiagnosticContext("corr-" + suffix, "req-" + suffix, "op-" + suffix, "/api/test", "owner");
    }
}
