package com.catering.v2s.terminaldataserver.state;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

class TdsConnectionStateRepositoryTest {
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
