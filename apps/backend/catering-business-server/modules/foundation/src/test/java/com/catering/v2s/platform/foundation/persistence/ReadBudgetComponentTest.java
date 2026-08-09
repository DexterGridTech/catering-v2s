package com.catering.v2s.platform.foundation.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.Test;

class ReadBudgetComponentTest {
    @Test
    void physicalCountsReconcileWhileLogicalStatementCountsExcludeConnectionMechanics() throws Exception {
        try (var request = DatabaseOperationTracker.open(); var budget = ReadBudgetComponent.open()) {
            ReadBudgetComponent.measure(ReadBudgetComponent.Component.CONTEXT_WORKSPACE_IAM, () -> {
                executeConnectionBorrow();
                executeObservedStatement();
                return null;
            });

            var snapshot = budget.snapshot(DatabaseOperationTracker.snapshot());
            assertEquals(2L, snapshot.databaseOperationCount());
            assertEquals(1L, snapshot.logicalStatementCount());
            assertEquals(2L, snapshot.counts().get(ReadBudgetComponent.Component.CONTEXT_WORKSPACE_IAM));
            assertEquals(1L, snapshot.logicalStatementCounts().get(ReadBudgetComponent.Component.CONTEXT_WORKSPACE_IAM));
            assertEquals(0L, snapshot.unclassifiedCount());
            assertEquals(0L, snapshot.unclassifiedLogicalStatementCount());
        }
    }

    @Test
    void unwrappedPhysicalAndLogicalWorkRemainVisibleInTheirOwnDimensions() throws Exception {
        try (var request = DatabaseOperationTracker.open(); var budget = ReadBudgetComponent.open()) {
            executeConnectionBorrow();
            executeObservedStatement();

            var snapshot = budget.snapshot(DatabaseOperationTracker.snapshot());
            assertEquals(2L, snapshot.databaseOperationCount());
            assertEquals(1L, snapshot.logicalStatementCount());
            assertEquals(2L, snapshot.unclassifiedCount());
            assertEquals(1L, snapshot.unclassifiedLogicalStatementCount());
        }
    }

    private static void executeConnectionBorrow() { DatabaseOperationTracker.record("CONNECTION", 0L); }
    private static void executeObservedStatement() { DatabaseOperationTracker.record("QUERY", 0L); }
}
