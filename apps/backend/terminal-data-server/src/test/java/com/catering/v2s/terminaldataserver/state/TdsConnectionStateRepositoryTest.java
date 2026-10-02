package com.catering.v2s.terminaldataserver.state;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Outcome;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.BindingKey;
import java.sql.Array;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class TdsConnectionStateRepositoryTest {
    @Test
    void latestSessionWriteAndWakeupUseOnePostgresStatement() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(any(String.class), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of());
        TdsConnectionStateRepository repository = new TdsConnectionStateRepository(jdbc);
        Verification verification = new Verification(
                Outcome.VERIFIED,
                UUID.fromString("667d0c56-90a4-4bf4-b0fa-08d7f3b653ba"),
                "GROUP-A",
                UUID.fromString("66abf394-3b77-487a-a344-5a8209dfd573"),
                UUID.fromString("95e948ef-2fe6-4b18-b6d5-509d023ea249"),
                3,
                1_798_387_200_000L);

        assertThat(repository.open(verification, "node-a", "session-a")).isEmpty();

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), any(RowMapper.class), any(Object[].class));
        assertThat(sql.getValue())
                .contains("WITH next_state AS", "written AS", "pg_notify(", "'SESSION_OPEN'", "CROSS JOIN notified");
    }

    @Test
    void currentBindingReconciliationUsesTwoParametersBeyondTheJdbcParameterLimit() throws Exception {
        Connection connection = mock(Connection.class);
        PreparedStatement statement = mock(PreparedStatement.class);
        ResultSet rows = mock(ResultSet.class);
        Array workspaceKeys = mock(Array.class);
        Array terminalRefs = mock(Array.class);
        when(connection.createArrayOf(any(String.class), any(Object[].class))).thenReturn(workspaceKeys, terminalRefs);
        when(connection.prepareStatement(any(String.class))).thenReturn(statement);
        when(statement.executeQuery()).thenReturn(rows);
        when(rows.next()).thenReturn(false);
        List<BindingKey> keys = IntStream.rangeClosed(1, 32_768)
                .mapToObj(index -> new BindingKey("GROUP-A", new UUID(0, index)))
                .toList();
        TdsConnectionStateRepository repository = new TdsConnectionStateRepository(mock(JdbcTemplate.class));

        assertThat(repository.readCurrentBindings(connection, keys)).isEmpty();

        ArgumentCaptor<String> elementTypes = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> elements = ArgumentCaptor.forClass(Object[].class);
        verify(connection, times(2)).createArrayOf(elementTypes.capture(), elements.capture());
        assertThat(elementTypes.getAllValues()).containsExactly("varchar", "uuid");
        Object[] groupWorkspaceKeyValues = elements.getAllValues().getFirst();
        assertThat(groupWorkspaceKeyValues).hasSize(32_768);
        assertThat(Arrays.stream(groupWorkspaceKeyValues).allMatch("GROUP-A"::equals))
                .isTrue();
        assertThat(elements.getAllValues().getLast())
                .hasSize(32_768)
                .containsExactlyElementsOf(
                        keys.stream().map(BindingKey::terminalRef).toList());
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(connection).prepareStatement(sql.capture());
        assertThat(sql.getValue().chars().filter(character -> character == '?').count())
                .isEqualTo(2);
        verify(statement).setArray(1, workspaceKeys);
        verify(statement).setArray(2, terminalRefs);
        verify(statement, times(2)).setArray(anyInt(), any(Array.class));
        verify(statement, never()).setObject(anyInt(), any(Object.class));
        verify(workspaceKeys).free();
        verify(terminalRefs).free();
    }
}
