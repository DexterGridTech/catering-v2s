package com.catering.v2s.terminaldataserver.state;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.OptionalLong;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

class TdsTerminalTopicRepositoryTest {
    private static final UUID WORKSPACE = UUID.fromString("667d0c56-90a4-4bf4-b0fa-08d7f3b653ba");
    private static final UUID STORE = UUID.fromString("66abf394-3b77-487a-a344-5a8209dfd573");
    private static final UUID OWNER = UUID.fromString("95e948ef-2fe6-4b18-b6d5-509d023ea249");

    @Test
    void routesEachExactTopicOnlyToItsOwningRawTimeFunctionWithFullIdentity() {
        for (String topic : List.of(
                "STORE",
                "PROJECT",
                "REGION",
                "COMMERCIAL_GROUP",
                "STORE_OPERATING_RULE",
                "SERVICE_POINT_AREA",
                "SERVICE_POINT")) {
            CapturingJdbcTemplate jdbc = new CapturingJdbcTemplate();
            assertThat(new TdsTerminalTopicRepository(jdbc).readTime(WORKSPACE, "GROUP-1", STORE, topic, OWNER))
                    .isEqualTo(OptionalLong.of(123));
            assertThat(jdbc.sql).contains("organization.read_terminal_topic_time");
            assertThat(jdbc.arguments).containsExactly(WORKSPACE, "GROUP-1", STORE, topic, OWNER);
        }

        CapturingJdbcTemplate terminalUpdateJdbc = new CapturingJdbcTemplate();
        assertThat(new TdsTerminalTopicRepository(terminalUpdateJdbc)
                        .readTime(WORKSPACE, "GROUP-1", STORE, "TERMINAL_UPDATE_RULES", OWNER))
                .isEqualTo(OptionalLong.of(123));
        assertThat(terminalUpdateJdbc.sql).contains("terminal_update.read_rule_topic_time");
        assertThat(terminalUpdateJdbc.arguments).containsExactly(WORKSPACE, "GROUP-1", STORE, OWNER);

        CapturingJdbcTemplate contractJdbc = new CapturingJdbcTemplate();
        assertThat(new TdsTerminalTopicRepository(contractJdbc)
                        .readTime(WORKSPACE, "GROUP-1", STORE, "CONTRACT", OWNER))
                .isEqualTo(OptionalLong.of(123));
        assertThat(contractJdbc.sql).contains("contract.read_terminal_topic_time");
        assertThat(contractJdbc.arguments).containsExactly(WORKSPACE, "GROUP-1", STORE, "CONTRACT", OWNER);
    }

    @Test
    void routesTheThreeCollectionsOnlyToTheirOwnerSnapshots() {
        for (String topic :
                List.of("VALID_CONTRACT_COLLECTION", "SERVICE_POINT_AREA_COLLECTION", "SERVICE_POINT_COLLECTION")) {
            CapturingJdbcTemplate jdbc = new CapturingJdbcTemplate();
            assertThat(new TdsTerminalTopicRepository(jdbc).readTime(WORKSPACE, "GROUP-1", STORE, topic, STORE))
                    .isEqualTo(OptionalLong.of(123));
            assertThat(jdbc.sql)
                    .contains(
                            topic.equals("VALID_CONTRACT_COLLECTION")
                                    ? "contract.terminal_topic_snapshot"
                                    : "organization.terminal_topic_snapshot");
            assertThat(jdbc.arguments).containsExactly(WORKSPACE, "GROUP-1", STORE, topic);
        }
    }

    @Test
    void missingContractCollectionSnapshotIsTheInitialEmptySetBaselineOnly() {
        CapturingJdbcTemplate contractJdbc = new CapturingJdbcTemplate();
        contractJdbc.value = null;
        assertThat(new TdsTerminalTopicRepository(contractJdbc)
                        .readTime(WORKSPACE, "GROUP-1", STORE, "VALID_CONTRACT_COLLECTION", STORE))
                .isEqualTo(OptionalLong.of(0));

        CapturingJdbcTemplate areaJdbc = new CapturingJdbcTemplate();
        areaJdbc.value = null;
        assertThat(new TdsTerminalTopicRepository(areaJdbc)
                        .readTime(WORKSPACE, "GROUP-1", STORE, "SERVICE_POINT_AREA_COLLECTION", STORE))
                .isEmpty();

        CapturingJdbcTemplate exactJdbc = new CapturingJdbcTemplate();
        exactJdbc.value = null;
        assertThat(new TdsTerminalTopicRepository(exactJdbc).readTime(WORKSPACE, "GROUP-1", STORE, "CONTRACT", OWNER))
                .isEmpty();

        CapturingJdbcTemplate terminalUpdateJdbc = new CapturingJdbcTemplate();
        terminalUpdateJdbc.value = null;
        assertThat(new TdsTerminalTopicRepository(terminalUpdateJdbc)
                        .readTime(WORKSPACE, "GROUP-1", STORE, "TERMINAL_UPDATE_RULES", OWNER))
                .isEmpty();
    }

    private static final class CapturingJdbcTemplate extends JdbcTemplate {
        private String sql;
        private Object[] arguments;
        private Long value = 123L;

        @Override
        @SuppressWarnings("unchecked")
        public <T> T query(String sql, ResultSetExtractor<T> resultSetExtractor, Object... arguments) {
            this.sql = sql;
            this.arguments = arguments;
            return (T) value;
        }
    }
}
