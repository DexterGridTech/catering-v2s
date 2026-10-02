package com.catering.v2s.terminaldataserver.history;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.terminaldataserver.history.TdsConnectionHistoryEvent.EventType;
import com.catering.v2s.terminaldataserver.history.TdsDorisStreamLoadClient.Disposition;
import com.catering.v2s.terminaldataserver.history.TdsDorisStreamLoadClient.LoadResult;
import com.catering.v2s.terminaldataserver.protocol.TdsWireJsonConfiguration;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.SessionIdentity;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import reactor.core.scheduler.Schedulers;
import tools.jackson.databind.ObjectMapper;

class TdsConnectionHistoryWriterTest {
    private final ObjectMapper objectMapper = TdsWireJsonConfiguration.createWireObjectMapper();

    @Test
    void keepsQueueBoundedAndDoesNotWaitForAnInFlightDorisRequest() throws Exception {
        TdsDorisStreamLoadClient client = mock(TdsDorisStreamLoadClient.class);
        CountDownLatch requestEntered = new CountDownLatch(1);
        CountDownLatch releaseRequest = new CountDownLatch(1);
        when(client.load(anyString(), any(byte[].class))).thenAnswer(invocation -> {
            requestEntered.countDown();
            releaseRequest.await(5, TimeUnit.SECONDS);
            return new LoadResult(Disposition.COMPLETE, "Success");
        });
        TdsConnectionHistoryWriter writer = writer(client);
        writer.recordConnected(event(EventType.CONNECTED));

        Thread worker = new Thread(writer::flushOneBatch, "writer-test-request");
        worker.start();
        assertThat(requestEntered.await(1, TimeUnit.SECONDS)).isTrue();

        long startedNanos = System.nanoTime();
        for (int index = 1; index < TdsConnectionHistoryWriter.MAX_QUEUE_EVENTS; index++) {
            assertThat(writer.recordHeartbeat(event(EventType.HEARTBEAT_RTT))).isTrue();
        }
        assertThat(writer.recordHeartbeat(event(EventType.HEARTBEAT_RTT))).isFalse();
        long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedNanos);

        assertThat(elapsedMillis).isLessThan(1_000);
        assertThat(writer.pendingEventCount()).isEqualTo(TdsConnectionHistoryWriter.MAX_QUEUE_EVENTS);
        assertThat(writer.pendingByteCount()).isBetween(1, TdsConnectionHistoryWriter.MAX_QUEUE_BYTES);
        assertThat(writer.droppedCount()).isEqualTo(1);

        releaseRequest.countDown();
        worker.join(2_000);
        assertThat(worker.isAlive()).isFalse();
        assertThat(writer.pendingEventCount()).isEqualTo(TdsConnectionHistoryWriter.MAX_QUEUE_EVENTS - 1);
    }

    @Test
    void retriesTheSameBatchWithTheSameLabelAndPayload() {
        TdsDorisStreamLoadClient client = mock(TdsDorisStreamLoadClient.class);
        List<String> labels = new ArrayList<>();
        List<byte[]> payloads = new ArrayList<>();
        when(client.load(anyString(), any(byte[].class))).thenAnswer(invocation -> {
            labels.add(invocation.getArgument(0));
            payloads.add(invocation.getArgument(1));
            return labels.size() == 1
                    ? new LoadResult(Disposition.RETRY, "LABEL_RUNNING")
                    : new LoadResult(Disposition.COMPLETE, "LABEL_ALREADY_FINISHED");
        });
        TdsConnectionHistoryWriter writer = writer(client);
        writer.recordDisconnected(event(EventType.DISCONNECTED));

        writer.flushOneBatch();

        assertThat(labels).hasSize(2).allMatch(labels.getFirst()::equals);
        assertThat(payloads).hasSize(2);
        assertThat(payloads.get(0)).containsExactly(payloads.get(1));
        assertThat(new String(payloads.getFirst(), StandardCharsets.UTF_8)).contains("DISCONNECTED", "NETWORK_ERROR");
        assertThat(writer.pendingEventCount()).isZero();
        assertThat(writer.loadedCount()).isEqualTo(1);
        assertThat(writer.retryCount()).isEqualTo(1);
    }

    @Test
    void eventWireShapeExcludesCredentialsAndDeviceIdentity() throws Exception {
        TdsConnectionHistoryEvent event = TdsConnectionHistoryEvent.connected(identity());
        byte[] json = objectMapper.writeValueAsBytes(event.toDorisRow());

        assertThat(new String(json, StandardCharsets.UTF_8))
                .contains("event_id", "event_time_epoch_millis", "workspace_uuid", "terminal_ref", "session_sequence")
                .doesNotContain("credential", "deviceId", "device_id", "activationCode", "secret");
    }

    private TdsConnectionHistoryWriter writer(TdsDorisStreamLoadClient client) {
        return new TdsConnectionHistoryWriter(client, objectMapper, Schedulers.immediate(), Schedulers.immediate());
    }

    private static TdsConnectionHistoryEvent event(EventType type) {
        return switch (type) {
            case CONNECTED -> TdsConnectionHistoryEvent.connected(identity());
            case DISCONNECTED -> TdsConnectionHistoryEvent.disconnected(identity(), "NETWORK_ERROR");
            case HEARTBEAT_RTT -> TdsConnectionHistoryEvent.heartbeat(identity(), 9.5);
        };
    }

    private static SessionIdentity identity() {
        return new SessionIdentity(
                UUID.fromString("667d0c56-90a4-4bf4-b0fa-08d7f3b653ba"),
                "GROUP-1",
                UUID.fromString("95e948ef-2fe6-4b18-b6d5-509d023ea249"),
                "node-1",
                "session-1",
                7,
                Instant.parse("2026-10-02T00:00:00Z"));
    }
}
