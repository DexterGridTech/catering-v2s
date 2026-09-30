package com.catering.v2s.terminaldataserver.state;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.catering.v2s.terminaldataserver.config.TdsRuntimeSettings;
import com.catering.v2s.terminaldataserver.session.TdsConnectionCapacityLimiter;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.Heartbeat;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.SessionIdentity;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import reactor.core.scheduler.Scheduler;
import reactor.core.scheduler.Schedulers;

class TdsConnectionStateWriterTest {
    private final Scheduler scheduler = Schedulers.newBoundedElastic(1, 1, "tds-state-writer-test");

    @AfterEach
    void disposeScheduler() {
        scheduler.dispose();
    }

    @Test
    void coalescesHeartbeatsAndFlushesDisconnectsBeforeRemainingHeartbeats() {
        RecordingRepository repository = new RecordingRepository();
        TdsConnectionStateWriter writer = new TdsConnectionStateWriter(repository, settings(), scheduler, scheduler);
        SessionIdentity disconnected = identity("one");
        SessionIdentity active = identity("two");
        boolean[] disconnectPersisted = {false};

        writer.queueHeartbeat(disconnected, 2);
        writer.queueHeartbeat(disconnected, 8);
        writer.queueDisconnect(disconnected, "NETWORK_ERROR", () -> disconnectPersisted[0] = true);
        writer.queueHeartbeat(active, 1);
        writer.queueHeartbeat(active, 5);

        assertThat(writer.pendingHeartbeatCount()).isEqualTo(1);
        assertThat(writer.pendingDisconnectCount()).isEqualTo(1);
        assertThat(writer.queueHeartbeat(disconnected, 13)).isFalse();

        writer.flush();

        assertThat(repository.writes).containsExactly("disconnect:one", "heartbeat:two:5.0");
        assertThat(disconnectPersisted[0]).isTrue();
        assertThat(writer.pendingHeartbeatCount()).isZero();
        assertThat(writer.pendingDisconnectCount()).isZero();
    }

    @Test
    void preservesDisconnectAndSkipsHeartbeatsWhenDisconnectWriteFails() {
        RecordingRepository repository = new RecordingRepository();
        repository.failDisconnect = true;
        TdsRuntimeSettings settings = TdsRuntimeSettings.from(
                "2",
                "1",
                Duration.ofSeconds(30),
                Duration.ofSeconds(90),
                Duration.ofSeconds(15),
                Duration.ofSeconds(10));
        TdsConnectionStateWriter writer = new TdsConnectionStateWriter(repository, settings, scheduler, scheduler);
        TdsConnectionCapacityLimiter limiter = new TdsConnectionCapacityLimiter(2, 1);
        TdsConnectionCapacityLimiter.Permit trackedPermit = limiter.tryAcquireTrackedSession();
        boolean[] disconnectPersisted = {false};

        writer.queueDisconnect(identity("one"), "NETWORK_ERROR", () -> {
            disconnectPersisted[0] = true;
            trackedPermit.close();
        });
        writer.queueHeartbeat(identity("two"), 4);
        writer.flush();

        assertThat(repository.writes).containsExactly("disconnect:one");
        assertThat(writer.pendingDisconnectCount()).isEqualTo(1);
        assertThat(writer.pendingHeartbeatCount()).isEqualTo(1);
        assertThat(disconnectPersisted[0]).isFalse();
        assertThat(limiter.tryAcquireTrackedSession()).isNull();

        repository.failDisconnect = false;
        writer.flush();

        assertThat(repository.writes).containsExactly("disconnect:one", "disconnect:one", "heartbeat:two:4.0");
        assertThat(disconnectPersisted[0]).isTrue();
        TdsConnectionCapacityLimiter.Permit replacement = limiter.tryAcquireTrackedSession();
        assertThat(replacement).isNotNull();
        replacement.close();
    }

    @Test
    void extractsOnlySafeSqlFailureMetadataForRuntimeDiagnostics() {
        SQLException sqlFailure = new SQLException("do-not-log-sensitive-detail", "23503", 7);

        assertThat(TdsConnectionStateWriter.sqlFailure(new IllegalStateException("wrapper", sqlFailure)))
                .isEqualTo(new TdsConnectionStateWriter.SqlFailure("23503", 7));
        assertThat(TdsConnectionStateWriter.sqlFailure(new IllegalStateException("no-sql-cause")))
                .isEqualTo(new TdsConnectionStateWriter.SqlFailure("NONE", 0));
    }

    private static TdsRuntimeSettings settings() {
        return TdsRuntimeSettings.from(
                "2",
                "16",
                Duration.ofSeconds(30),
                Duration.ofSeconds(90),
                Duration.ofSeconds(15),
                Duration.ofSeconds(10));
    }

    private static SessionIdentity identity(String suffix) {
        return new SessionIdentity(
                UUID.fromString("9fd26ad8-56cf-4cf8-98b2-a0c78805a5a8"),
                "GROUP-1",
                UUID.nameUUIDFromBytes(suffix.getBytes(java.nio.charset.StandardCharsets.UTF_8)),
                "node-1",
                suffix,
                1,
                Instant.parse("2026-09-26T00:00:00Z"));
    }

    private static final class RecordingRepository extends TdsConnectionStateRepository {
        private final List<String> writes = new ArrayList<>();
        private boolean failDisconnect;

        private RecordingRepository() {
            super(mock(org.springframework.jdbc.core.JdbcTemplate.class));
        }

        @Override
        public boolean writeDisconnect(SessionIdentity session, String closeReason) {
            writes.add("disconnect:" + session.sessionId());
            if (failDisconnect) throw new IllegalStateException("database is unavailable");
            return true;
        }

        @Override
        public int writeHeartbeats(Collection<Heartbeat> heartbeats) {
            heartbeats.forEach(heartbeat ->
                    writes.add("heartbeat:" + heartbeat.session().sessionId() + ":" + heartbeat.lastRttMs()));
            return heartbeats.size();
        }
    }
}
