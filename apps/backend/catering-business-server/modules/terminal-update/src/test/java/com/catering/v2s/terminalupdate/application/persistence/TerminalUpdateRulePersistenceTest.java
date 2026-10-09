package com.catering.v2s.terminalupdate.application.persistence;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.platform.foundation.security.Sha256Hex;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

final class TerminalUpdateRulePersistenceTest {
    private static final UUID WORKSPACE = UUID.fromString("00000000-0000-0000-0000-000000000101");
    private static final UUID PROJECT = UUID.fromString("00000000-0000-0000-0000-000000000102");
    private static final String GROUP = "mixc";

    @Test
    void topicHashUsesOnlyTheOrderedEnabledRuleMembership() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        String members = "00000000-0000-0000-0000-000000000201\n"
                + "00000000-0000-0000-0000-000000000202\n";
        when(jdbc.queryForObject(anyString(), eq(String.class), eq(WORKSPACE), eq(GROUP), eq(PROJECT)))
                .thenReturn(members);
        when(jdbc.query(anyString(), any(RowMapper.class), eq(WORKSPACE), eq(GROUP), eq(PROJECT)))
                .thenReturn(List.of());

        new TerminalUpdateRulePersistence(jdbc).refreshTopic(WORKSPACE, GROUP, PROJECT, 1_000L);

        verify(jdbc).update(anyString(), eq(WORKSPACE), eq(GROUP), eq(PROJECT),
                eq(Sha256Hex.digest(members)), eq(1_000L));
    }
}
