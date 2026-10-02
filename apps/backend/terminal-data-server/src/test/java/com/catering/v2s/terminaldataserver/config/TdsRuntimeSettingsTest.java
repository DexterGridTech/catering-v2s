package com.catering.v2s.terminaldataserver.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.env.SystemEnvironmentPropertySource;

class TdsRuntimeSettingsTest {
    @ParameterizedTest
    @ValueSource(strings = {"1", "42", "2147483647"})
    void acceptsConfiguredConnectionLimitsWithinTheRequiredRange(String value) {
        assertThat(TdsRuntimeSettings.parseUnauthenticatedConnectionLimit(value))
                .isPositive();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "0", "-1", "+1", "01", "2147483648", "1.0", " 1"})
    void rejectsMissingMalformedAndOutOfRangeConnectionLimits(String value) {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> TdsRuntimeSettings.parseUnauthenticatedConnectionLimit(value))
                .withMessage("V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS is invalid");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "0", "-1", "+1", "01", "2147483648", "1.0", " 1"})
    void rejectsMissingMalformedAndOutOfRangeTrackedSessionLimits(String value) {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> TdsRuntimeSettings.parseTrackedSessionLimit(value))
                .withMessage("V2S_TDS_MAX_TRACKED_SESSIONS is invalid");
    }

    @ParameterizedTest
    @ValueSource(strings = {"1", "42", "2147483647"})
    void acceptsTrackedSessionLimitsWithinTheRequiredRange(String value) {
        assertThat(TdsRuntimeSettings.parseTrackedSessionLimit(value)).isPositive();
    }

    @Test
    void rejectsMissingRequiredLimitBeforeApplicationReadiness() {
        contextRunner(Map.of()).run(context -> assertThat(context).hasFailed());
    }

    @Test
    void rejectsMissingTrackedSessionLimitBeforeApplicationReadiness() {
        contextRunner(Map.of("V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS", "7"))
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void rejectsMalformedTrackedSessionLimitBeforeApplicationReadiness() {
        contextRunner(Map.of(
                        "V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS", "7",
                        "V2S_TDS_MAX_TRACKED_SESSIONS", "invalid"))
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void bindsRequiredLimitAndDefaultTiming() {
        contextRunner(Map.of(
                        "V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS", "7",
                        "V2S_TDS_MAX_TRACKED_SESSIONS", "11"))
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    TdsRuntimeSettings settings = context.getBean(TdsRuntimeSettings.class);
                    assertThat(settings.maxUnauthenticatedConnections()).isEqualTo(7);
                    assertThat(settings.maxTrackedSessions()).isEqualTo(11);
                    assertThat(settings.heartbeatInterval()).isEqualTo(Duration.ofSeconds(30));
                    assertThat(settings.heartbeatTimeout()).isEqualTo(Duration.ofSeconds(90));
                    assertThat(settings.stateWriteInterval()).isEqualTo(Duration.ofSeconds(15));
                    assertThat(settings.nodeId()).isEqualTo(TdsRuntimeSettings.SINGLE_NODE_ID);
                    assertThat(settings.readinessWithdrawalWait())
                            .isEqualTo(TdsRuntimeSettings.DEFAULT_READINESS_WITHDRAWAL_WAIT);
                });
    }

    @Test
    void bindsNodeIdentityAndReadinessWithdrawalWaitOverrides() {
        contextRunner(Map.of(
                        "V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS", "7",
                        "V2S_TDS_MAX_TRACKED_SESSIONS", "11",
                        "V2S_TDS_NODE_ID", "tds-test-node",
                        "V2S_TDS_READINESS_WITHDRAWAL_WAIT_MS", "4000"))
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    TdsRuntimeSettings settings = context.getBean(TdsRuntimeSettings.class);
                    assertThat(settings.nodeId()).isEqualTo("tds-test-node");
                    assertThat(settings.readinessWithdrawalWait()).isEqualTo(Duration.ofSeconds(4));
                });
    }

    private static ApplicationContextRunner contextRunner(Map<String, Object> environment) {
        Map<String, Object> configuredEnvironment = new java.util.HashMap<>(environment);
        configuredEnvironment.putIfAbsent("V2S_TDS_DORIS_ENDPOINT", "http://127.0.0.1:8040");
        configuredEnvironment.putIfAbsent("V2S_TDS_DORIS_DATABASE", "terminal_connection_history");
        configuredEnvironment.putIfAbsent("V2S_TDS_DORIS_TABLE", "connection_history");
        configuredEnvironment.putIfAbsent("V2S_TDS_DORIS_USERNAME", "tds");
        configuredEnvironment.putIfAbsent("V2S_TDS_DORIS_PASSWORD", "test-secret");
        return new ApplicationContextRunner()
                .withUserConfiguration(TdsSettingsConfiguration.class)
                .withInitializer(context -> context.getEnvironment()
                        .getPropertySources()
                        .addFirst(new SystemEnvironmentPropertySource("tds-test-environment", configuredEnvironment)));
    }

    @Test
    void rejectsInvalidHeartbeatAndDrainRelationships() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> TdsRuntimeSettings.from(
                        "1",
                        "1",
                        Duration.ofMillis(999),
                        Duration.ofSeconds(90),
                        Duration.ofSeconds(15),
                        Duration.ofSeconds(10)));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> TdsRuntimeSettings.from(
                        "1",
                        "1",
                        Duration.ofSeconds(30),
                        Duration.ofSeconds(59),
                        Duration.ofSeconds(15),
                        Duration.ofSeconds(10)));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> TdsRuntimeSettings.from(
                        "1",
                        "1",
                        Duration.ofSeconds(30),
                        Duration.ofSeconds(90),
                        Duration.ofSeconds(91),
                        Duration.ofSeconds(10)));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> TdsRuntimeSettings.from(
                        "1",
                        "1",
                        Duration.ofSeconds(30),
                        Duration.ofSeconds(90),
                        Duration.ofSeconds(15),
                        Duration.ofSeconds(11)));
    }

    @Test
    void rejectsInvalidNodeIdentityAndReadinessWithdrawalWait() {
        for (String nodeId : new String[] {null, "", "  ", "x".repeat(129)}) {
            assertThatIllegalArgumentException()
                    .isThrownBy(() -> TdsRuntimeSettings.from(
                            "1",
                            "1",
                            Duration.ofSeconds(30),
                            Duration.ofSeconds(90),
                            Duration.ofSeconds(15),
                            Duration.ofSeconds(10),
                            nodeId,
                            Duration.ofSeconds(3)));
        }
        for (Duration wait : new Duration[] {null, Duration.ofMillis(1_999), Duration.ofMillis(10_001)}) {
            assertThatIllegalArgumentException()
                    .isThrownBy(() -> TdsRuntimeSettings.from(
                            "1",
                            "1",
                            Duration.ofSeconds(30),
                            Duration.ofSeconds(90),
                            Duration.ofSeconds(15),
                            Duration.ofSeconds(10),
                            TdsRuntimeSettings.SINGLE_NODE_ID,
                            wait));
        }
    }
}
