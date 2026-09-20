package com.catering.v2s.platform.workspace.application;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.application.persistence.WorkspaceCommandReceiptPersistence;
import java.sql.ResultSet;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;

class WorkspaceCommandReceiptServiceTest {
    @Test
    void conflictingRequestHashStopsBeforeCommandAndReceiptWrite() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ResultSet existing = mock(ResultSet.class);
        when(existing.next()).thenReturn(true);
        when(existing.getString(1)).thenReturn("different-request-hash");
        when(existing.getString(2)).thenReturn("{}");
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    ResultSetExtractor<?> extractor = invocation.getArgument(2);
                    return extractor.extractData(existing);
                });
        AtomicBoolean commandCalled = new AtomicBoolean();
        Supplier<WorkspaceAdministrationReadback> command = () -> {
            commandCalled.set(true);
            return new WorkspaceAdministrationReadback(
                    UUID.randomUUID(), "workspace-key", "Name", "Title", null, null, "ENABLED", 1, 1, 1, 1, false);
        };

        WorkspaceCommandReceiptService service = new WorkspaceCommandReceiptService(
                new WorkspaceCommandReceiptPersistence(jdbc), (TimeProvider) () -> 1L);

        assertThrows(
                WorkspaceCommandReceiptService.WorkspaceIdempotencyConflictException.class,
                () -> service.execute("workspace-key", "receipt-key-0001", "request", command));

        org.junit.jupiter.api.Assertions.assertFalse(commandCalled.get());
        verify(jdbc).queryForList(anyString(), any(Object[].class));
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

}
