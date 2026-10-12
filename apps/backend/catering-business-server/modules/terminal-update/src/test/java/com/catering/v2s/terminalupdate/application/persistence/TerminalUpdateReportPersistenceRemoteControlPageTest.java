package com.catering.v2s.terminalupdate.application.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.VersionQuery;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.VersionRow;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

final class TerminalUpdateReportPersistenceRemoteControlPageTest {
    private static final UUID WORKSPACE = UUID.fromString("00000000-0000-0000-0000-000000000101");
    private static final UUID PROJECT = UUID.fromString("00000000-0000-0000-0000-000000000102");
    private static final String GROUP = "mixc";

    @Test
    void fiftyOneTerminalRowsCrossTwoPagesUsingOneJoinedCollectionQueryPerPage() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AtomicInteger queryIndex = new AtomicInteger();
        List<String> sqls = new ArrayList<>();
        List<VersionRow> ordered = new ArrayList<>();
        for (int number = 51; number >= 1; number--) {
            UUID terminalRef = UUID.fromString("00000000-0000-0000-0000-%012x".formatted(number));
            ordered.add(new VersionRow(terminalRef, "terminal-" + number, UUID.randomUUID(), "store",
                    false, null, null, false, null, "NOT_ACTIVATED", null, 1_000L));
        }
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
            sqls.add(invocation.getArgument(0));
            int call = queryIndex.getAndIncrement();
            return call == 0 ? ordered : List.of(ordered.getLast());
        });

        TerminalUpdateReportPersistence persistence = new TerminalUpdateReportPersistence(jdbc);
        VersionQuery firstQuery = new VersionQuery(WORKSPACE, GROUP, PROJECT, null, null, null, null, null, null, 50);
        var firstPage = persistence.page(firstQuery);
        assertEquals(50, firstPage.items().size());
        assertNotNull(firstPage.nextCursor());
        var secondPage = persistence.page(new VersionQuery(WORKSPACE, GROUP, PROJECT, null,
                null, null, null, null, firstPage.nextCursor(), 50));

        assertEquals(1, secondPage.items().size());
        List<UUID> all = new ArrayList<>(firstPage.items().stream().map(VersionRow::terminalRef).toList());
        all.addAll(secondPage.items().stream().map(VersionRow::terminalRef).toList());
        assertEquals(51, all.size());
        assertEquals(51, all.stream().distinct().count(), "BUSINESS: cursor pages retain every terminal exactly once");
        assertTrue(firstPage.items().stream().allMatch(row -> "NOT_ACTIVATED".equals(row.connectionStatus())));
        assertEquals(2, sqls.size(), "BUSINESS: one collection query is issued for each requested page");
        for (String sql : sqls) {
            assertEquals(1, occurrences(sql, "LEFT JOIN terminal_connection.latest_state"),
                    "CONTRACT: connection state is joined as one collection projection");
            assertEquals(1, occurrences(sql, "LEFT JOIN LATERAL"),
                    "CONTRACT: latest report data is projected in the same collection query");
            assertFalse(sql.contains("WHERE terminal_ref=?"), "CONTRACT: page query does not issue a per-terminal lookup");
        }
    }

    private static int occurrences(String value, String fragment) {
        int total = 0;
        int offset = 0;
        while ((offset = value.indexOf(fragment, offset)) >= 0) {
            total++;
            offset += fragment.length();
        }
        return total;
    }
}
