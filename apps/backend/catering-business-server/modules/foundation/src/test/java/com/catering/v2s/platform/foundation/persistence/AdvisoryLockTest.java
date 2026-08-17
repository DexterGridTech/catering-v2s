package com.catering.v2s.platform.foundation.persistence;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class AdvisoryLockTest {
    private static final UUID FIXED_REF = UUID.fromString("01234567-89ab-cdef-0123-456789abcdef");

    @Test
    void preservesTheLegacyUuidLockKeyDerivationForEverySharedNamespace() {
        assertLegacyKey(0x43534B55, 1114639922);
        assertLegacyKey(0x4349544D, 1114247466);
        assertLegacyKey(0x43534156, 1114637361);
    }

    private static void assertLegacyKey(int namespaceTag, int expectedFirstKey) {
        RecordingJdbcTemplate jdbc = new RecordingJdbcTemplate();

        AdvisoryLock.acquire(jdbc, namespaceTag, FIXED_REF);

        assertEquals("SELECT pg_advisory_xact_lock(?, ?)", jdbc.sql);
        assertArrayEquals(new Object[] {expectedFirstKey, -1985229329}, jdbc.arguments);
    }

    private static final class RecordingJdbcTemplate extends JdbcTemplate {
        private String sql;
        private Object[] arguments;

        @Override
        public List<Map<String, Object>> queryForList(String sql, Object... args) {
            this.sql = sql;
            this.arguments = args;
            return List.of();
        }
    }
}
