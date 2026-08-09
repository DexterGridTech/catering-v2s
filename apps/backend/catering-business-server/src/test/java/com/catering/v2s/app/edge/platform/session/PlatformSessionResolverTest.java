package com.catering.v2s.app.edge.platform.session;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.platform.iam.api.PlatformSessionReadback;
import com.catering.v2s.platform.iam.application.PlatformAuthenticationService;
import com.catering.v2s.platform.foundation.persistence.CountingDataSource;
import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import java.sql.Connection;
import java.sql.Statement;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;

class PlatformSessionResolverTest {
    @Test
    void readFactsRequireThePlatformSessionBeforeDerivingEnabledSelectedWorkspace() throws Exception {
        PlatformAuthenticationService authentication = mock(PlatformAuthenticationService.class);
        WorkspaceAdministrationService workspaces = mock(WorkspaceAdministrationService.class);
        PlatformSessionReadback session = new PlatformSessionReadback(UUID.randomUUID(), 1L, UUID.randomUUID(), "平台管理员", Long.MAX_VALUE);
        WorkspaceAdministrationReadback workspace = new WorkspaceAdministrationReadback(
            UUID.randomUUID(), "platform-read", "平台读取空间", "运营空间", null, null,
            "ENABLED", 1L, 1L, 1L, 1L, true);
        when(authentication.requireActiveSession("platform-session")).thenAnswer(invocation -> {
            executeObservedStatement();
            return session;
        });
        when(workspaces.requireEnabled("platform-read")).thenAnswer(invocation -> {
            executeObservedStatement();
            return workspace;
        });
        PlatformSessionResolver resolver = new PlatformSessionResolver(authentication);
        EdgeRequestContext request = new EdgeRequestContext("fingerprint", "correlation",
            PlatformSessionCookie.fromCookie("platform-session"), null, null, null, null);

        PlatformSessionResolver.EnabledSelectedWorkspaceFact selected;
        ReadBudgetComponent.Snapshot budget;
        try (var database = DatabaseOperationTracker.open(); var readBudget = ReadBudgetComponent.open()) {
            selected = resolver.requireRead(request).requireEnabledSelectedWorkspace(workspaces, "platform-read");
            budget = readBudget.snapshot(DatabaseOperationTracker.snapshot());
        }

        assertEquals(workspace.workspaceUuid(), selected.workspaceUuid());
        assertEquals(workspace.groupWorkspaceKey(), selected.groupWorkspaceKey());
        assertEquals(2L, budget.counts().get(ReadBudgetComponent.Component.CONTEXT_PLATFORM_IAM));
        assertEquals(2L, budget.counts().get(ReadBudgetComponent.Component.CONTEXT_PLATFORM_WORKSPACE));
        assertEquals(1L, budget.logicalStatementCounts().get(ReadBudgetComponent.Component.CONTEXT_PLATFORM_IAM));
        assertEquals(1L, budget.logicalStatementCounts().get(ReadBudgetComponent.Component.CONTEXT_PLATFORM_WORKSPACE));
        assertEquals(0L, budget.unclassifiedCount());
        assertEquals(0L, budget.unclassifiedLogicalStatementCount());
        verify(authentication).requireActiveSession("platform-session");
        verify(workspaces).requireEnabled("platform-read");
    }

    private static void executeObservedStatement() throws Exception {
        DataSource delegate = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        Statement statement = mock(Statement.class);
        when(delegate.getConnection()).thenReturn(connection);
        when(connection.createStatement()).thenReturn(statement);
        try (Connection observed = new CountingDataSource(delegate).getConnection(); Statement observedStatement = observed.createStatement()) {
            observedStatement.execute("SELECT 1");
        }
    }
}
