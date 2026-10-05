package com.catering.v2s.terminaldataserver.websocket;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi;
import com.catering.v2s.terminaldataserver.config.TdsRuntimeSettings;
import com.catering.v2s.terminaldataserver.history.TdsConnectionHistoryWriter;
import com.catering.v2s.terminaldataserver.protocol.TdsWireJsonConfiguration;
import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionFrameCodec;
import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionProtocol;
import com.catering.v2s.terminaldataserver.remote.TdsTerminalControlRepository;
import com.catering.v2s.terminaldataserver.session.SessionRegistrationGate;
import com.catering.v2s.terminaldataserver.session.TdsBindingRevocationListener;
import com.catering.v2s.terminaldataserver.session.TdsConnectionCapacityLimiter;
import com.catering.v2s.terminaldataserver.session.TdsTerminalSessionActors;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.SessionIdentity;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateWriter;
import io.netty.buffer.ByteBuf;
import io.netty.buffer.ByteBufAllocator;
import io.netty.buffer.Unpooled;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.reactivestreams.Publisher;
import org.springframework.core.io.buffer.NettyDataBufferFactory;
import org.springframework.web.reactive.socket.CloseStatus;
import org.springframework.web.reactive.socket.HandshakeInfo;
import org.springframework.web.reactive.socket.WebSocketMessage;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;
import reactor.core.scheduler.Schedulers;
import tools.jackson.databind.json.JsonMapper;

class TdsWebSocketHandlerTransportFailureTest {
    @Test
    void remoteReportPersistenceFailureClosesWithoutAcknowledgingReport() {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("remote-report-db-failure");
        when(session.isOpen()).thenReturn(true);
        when(session.textMessage(anyString())).thenReturn(mock(WebSocketMessage.class));
        when(session.close(any(CloseStatus.class))).thenReturn(Mono.empty());

        TerminalConnectionProtocol protocol =
                new TerminalConnectionProtocol(JsonMapper.builder().build());
        TdsRuntimeSettings settings = TdsRuntimeSettings.from(
                "1",
                "1",
                Duration.ofSeconds(30),
                Duration.ofSeconds(90),
                Duration.ofSeconds(15),
                Duration.ofSeconds(5));
        TdsTerminalControlRepository terminalControl = mock(TdsTerminalControlRepository.class);
        UUID operationId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        UUID reportId = UUID.randomUUID();
        SessionIdentity identity = new SessionIdentity(
                UUID.randomUUID(), "group-key", UUID.randomUUID(), "node-a", "session-a", 1, Instant.now());
        doThrow(new IllegalStateException("owner report write failed"))
                .when(terminalControl)
                .report(any(), any(), any(), anyLong(), anyString(), anyString(), anyString(), any(), any(), any());

        TdsWebSocketConnection connection = new TdsWebSocketConnection(
                session,
                protocol,
                new TdsConnectionCapacityLimiter(1, 1).tryAcquireUnauthenticated(),
                Schedulers.immediate());
        connection.outboundMessages().subscribe(ignored -> {});
        assertTrue(connection.sendSessionReady("SESSION_READY", identity, 3));

        TerminalConnectionFrameCodec codec =
                new TerminalConnectionFrameCodec(TdsWireJsonConfiguration.createWireObjectMapper(), protocol);
        TdsWebSocketHandler handler = new TdsWebSocketHandler(
                settings,
                codec,
                protocol,
                mock(TerminalCredentialVerificationApi.class),
                new TdsConnectionCapacityLimiter(1, 1),
                mock(TdsTerminalSessionActors.class),
                mock(TdsBindingRevocationListener.class),
                mock(TdsConnectionStateWriter.class),
                mock(TdsConnectionHistoryWriter.class),
                mock(SessionRegistrationGate.class),
                terminalControl,
                Schedulers.immediate(),
                Schedulers.immediate(),
                Schedulers.immediate(),
                Schedulers.immediate());

        String report =
                """
                {"type":"REMOTE_REPORT","reportId":"%s","remoteOperationId":"%s",
                 "requestId":"%s","phase":"COMPLETED","occurredAt":"2026-10-05T00:00:00Z",
                 "result":{"ok":true}}
                """
                        .formatted(reportId, operationId, requestId);
        ByteBuf payload = Unpooled.copiedBuffer(report, StandardCharsets.UTF_8);
        WebSocketMessage message = new WebSocketMessage(
                WebSocketMessage.Type.TEXT, new NettyDataBufferFactory(ByteBufAllocator.DEFAULT).wrap(payload));

        try {
            handler.receiveAuthenticatedMessage(
                            connection,
                            message,
                            new AtomicLong(),
                            Sinks.many().replay().latest())
                    .block(Duration.ofSeconds(2));

            verify(terminalControl)
                    .report(
                            eq(reportId),
                            eq(operationId),
                            eq(requestId),
                            eq(3L),
                            eq("session-a"),
                            eq("node-a"),
                            eq("COMPLETED"),
                            any(Instant.class),
                            any(),
                            isNull());
            ArgumentCaptor<String> frames = ArgumentCaptor.forClass(String.class);
            verify(session).textMessage(frames.capture());
            assertTrue(frames.getAllValues().stream().noneMatch(value -> value.contains("REMOTE_REPORT_ACK")));
            verify(session).close(new CloseStatus(4000, "SERVER_ERROR"));
        } finally {
            connection.finish();
            message.release();
        }
    }

    @Test
    void remoteReportOwnerRejectionClosesWithoutAcknowledgingReport() {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("remote-report-owner-rejected");
        when(session.isOpen()).thenReturn(true);
        when(session.textMessage(anyString())).thenReturn(mock(WebSocketMessage.class));
        when(session.close(any(CloseStatus.class))).thenReturn(Mono.empty());
        TerminalConnectionProtocol protocol =
                new TerminalConnectionProtocol(JsonMapper.builder().build());
        TdsRuntimeSettings settings = TdsRuntimeSettings.from(
                "1",
                "1",
                Duration.ofSeconds(30),
                Duration.ofSeconds(90),
                Duration.ofSeconds(15),
                Duration.ofSeconds(5));
        TdsTerminalControlRepository terminalControl = mock(TdsTerminalControlRepository.class);
        when(terminalControl.report(
                        any(), any(), any(), anyLong(), anyString(), anyString(), anyString(), any(), any(), any()))
                .thenReturn(false);
        SessionIdentity identity = new SessionIdentity(
                UUID.randomUUID(), "group-key", UUID.randomUUID(), "node-a", "session-a", 1, Instant.now());
        TdsConnectionCapacityLimiter limiter = new TdsConnectionCapacityLimiter(1, 1);
        TdsWebSocketConnection connection = new TdsWebSocketConnection(
                session, protocol, limiter.tryAcquireUnauthenticated(), Schedulers.immediate());
        connection.outboundMessages().subscribe(ignored -> {});
        assertTrue(connection.sendSessionReady("SESSION_READY", identity, 3));
        TdsWebSocketHandler handler = new TdsWebSocketHandler(
                settings,
                new TerminalConnectionFrameCodec(TdsWireJsonConfiguration.createWireObjectMapper(), protocol),
                protocol,
                mock(TerminalCredentialVerificationApi.class),
                limiter,
                mock(TdsTerminalSessionActors.class),
                mock(TdsBindingRevocationListener.class),
                mock(TdsConnectionStateWriter.class),
                mock(TdsConnectionHistoryWriter.class),
                mock(SessionRegistrationGate.class),
                terminalControl,
                Schedulers.immediate(),
                Schedulers.immediate(),
                Schedulers.immediate(),
                Schedulers.immediate());
        String report = "{\"type\":\"REMOTE_REPORT\",\"reportId\":\"%s\",".formatted(UUID.randomUUID())
                + "\"remoteOperationId\":\"%s\",\"requestId\":\"%s\",".formatted(UUID.randomUUID(), UUID.randomUUID())
                + "\"phase\":\"COMPLETED\",\"occurredAt\":\"2026-10-05T00:00:00Z\","
                + "\"result\":{\"ok\":true}}";
        WebSocketMessage message = textMessage(report);

        try {
            handler.receiveAuthenticatedMessage(
                            connection,
                            message,
                            new AtomicLong(),
                            Sinks.many().replay().latest())
                    .block(Duration.ofSeconds(2));

            ArgumentCaptor<String> frames = ArgumentCaptor.forClass(String.class);
            verify(session, times(1)).textMessage(frames.capture());
            assertEquals("SESSION_READY", frames.getValue());
            verify(session).close(new CloseStatus(4000, "UNKNOWN"));
        } finally {
            connection.finish();
            message.release();
        }
    }

    @Test
    void firstFrameDeadlineSendsApplicationCloseBeforeReceiveEnds() {
        WebSocketSession session = mock(WebSocketSession.class);
        HandshakeInfo handshakeInfo = mock(HandshakeInfo.class);
        TdsTerminalSessionActors sessionActors = mock(TdsTerminalSessionActors.class);
        TdsBindingRevocationListener revocationListener = mock(TdsBindingRevocationListener.class);
        Sinks.Many<WebSocketMessage> inbound = Sinks.many().unicast().onBackpressureBuffer();
        CopyOnWriteArrayList<String> events = new CopyOnWriteArrayList<>();
        when(session.getId()).thenReturn("first-frame-deadline-session");
        when(session.getHandshakeInfo()).thenReturn(handshakeInfo);
        when(handshakeInfo.getUri()).thenReturn(URI.create("ws://localhost/tdp/group-key/ws"));
        when(session.receive()).thenReturn(inbound.asFlux().doOnCancel(() -> events.add("receive-cancel")));
        when(session.close(any(CloseStatus.class))).thenAnswer(invocation -> {
            CloseStatus status = invocation.getArgument(0);
            events.add("close:" + status.getCode() + ":" + status.getReason());
            inbound.tryEmitComplete();
            return Mono.empty();
        });
        when(sessionActors.isDraining()).thenReturn(false);
        when(revocationListener.isReady()).thenReturn(true);
        when(session.send(any())).thenAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            Publisher<WebSocketMessage> outbound = invocation.getArgument(0);
            return Flux.from(outbound).then();
        });

        TerminalConnectionProtocol protocol =
                new TerminalConnectionProtocol(JsonMapper.builder().build());
        TdsRuntimeSettings settings = TdsRuntimeSettings.from(
                "1",
                "1",
                Duration.ofSeconds(30),
                Duration.ofSeconds(90),
                Duration.ofSeconds(15),
                Duration.ofSeconds(5));
        TdsWebSocketHandler handler = new TdsWebSocketHandler(
                settings,
                new TerminalConnectionFrameCodec(TdsWireJsonConfiguration.createWireObjectMapper(), protocol),
                protocol,
                mock(TerminalCredentialVerificationApi.class),
                new TdsConnectionCapacityLimiter(1, 1),
                sessionActors,
                revocationListener,
                mock(TdsConnectionStateWriter.class),
                mock(TdsConnectionHistoryWriter.class),
                mock(SessionRegistrationGate.class),
                Schedulers.immediate(),
                Schedulers.immediate(),
                Schedulers.immediate(),
                Schedulers.immediate());

        handler.handle(session).block(Duration.ofSeconds(12));

        assertEquals(List.of("close:4000:AUTHENTICATION_TIMEOUT"), events);
    }

    @Test
    void transportReceiveFailureDoesNotEmitApplicationNetworkErrorClose() {
        WebSocketSession session = mock(WebSocketSession.class);
        HandshakeInfo handshakeInfo = mock(HandshakeInfo.class);
        TdsTerminalSessionActors sessionActors = mock(TdsTerminalSessionActors.class);
        TdsBindingRevocationListener revocationListener = mock(TdsBindingRevocationListener.class);
        when(session.getId()).thenReturn("transport-failure-session");
        when(session.getHandshakeInfo()).thenReturn(handshakeInfo);
        when(handshakeInfo.getUri()).thenReturn(URI.create("ws://localhost/tdp/group-key/ws"));
        when(session.receive()).thenReturn(Flux.error(new IllegalStateException("peer transport ended")));
        when(session.close(any(CloseStatus.class))).thenReturn(Mono.empty());
        when(sessionActors.isDraining()).thenReturn(false);
        when(revocationListener.isReady()).thenReturn(true);
        when(session.send(any())).thenAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            Publisher<WebSocketMessage> outbound = invocation.getArgument(0);
            return Flux.from(outbound).then();
        });

        TerminalConnectionProtocol protocol =
                new TerminalConnectionProtocol(JsonMapper.builder().build());
        TdsRuntimeSettings settings = TdsRuntimeSettings.from(
                "1",
                "1",
                Duration.ofSeconds(30),
                Duration.ofSeconds(90),
                Duration.ofSeconds(15),
                Duration.ofSeconds(5));
        TdsWebSocketHandler handler = new TdsWebSocketHandler(
                settings,
                new TerminalConnectionFrameCodec(TdsWireJsonConfiguration.createWireObjectMapper(), protocol),
                protocol,
                mock(com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.class),
                new TdsConnectionCapacityLimiter(1, 1),
                sessionActors,
                revocationListener,
                mock(TdsConnectionStateWriter.class),
                mock(TdsConnectionHistoryWriter.class),
                mock(SessionRegistrationGate.class),
                Schedulers.immediate(),
                Schedulers.immediate(),
                Schedulers.immediate(),
                Schedulers.immediate());

        handler.handle(session).block(Duration.ofSeconds(2));

        verify(session, never()).close(any(CloseStatus.class));
    }

    @Test
    void credentialVerificationFailureClosesWithServerError() {
        UUID terminalRef = UUID.fromString("f15c23a1-e9f3-4f45-a120-77cc0a220001");
        String authenticate = "{\"type\":\"AUTHENTICATE\",\"terminalRef\":\"" + terminalRef
                + "\",\"deviceId\":\"device-1\",\"appVersion\":\"1.0\","
                + "\"terminalCredential\":\"1.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\"}";
        ByteBuf payload = Unpooled.copiedBuffer(authenticate, StandardCharsets.UTF_8);
        WebSocketMessage message = new WebSocketMessage(
                WebSocketMessage.Type.TEXT, new NettyDataBufferFactory(ByteBufAllocator.DEFAULT).wrap(payload));
        WebSocketSession session = mock(WebSocketSession.class);
        HandshakeInfo handshakeInfo = mock(HandshakeInfo.class);
        TdsTerminalSessionActors sessionActors = mock(TdsTerminalSessionActors.class);
        TdsBindingRevocationListener revocationListener = mock(TdsBindingRevocationListener.class);
        TerminalCredentialVerificationApi credentialVerification = mock(TerminalCredentialVerificationApi.class);
        when(session.getId()).thenReturn("credential-failure-session");
        when(session.getHandshakeInfo()).thenReturn(handshakeInfo);
        when(handshakeInfo.getUri()).thenReturn(URI.create("ws://localhost/tdp/group-key/ws"));
        when(session.receive()).thenReturn(Flux.just(message));
        when(session.close(any(CloseStatus.class))).thenReturn(Mono.empty());
        when(sessionActors.isDraining()).thenReturn(false);
        when(sessionActors.beginAttempt(any(UUID.class), any(String.class), any(String.class), anyLong(), any()))
                .thenReturn(Mono.just(true));
        when(sessionActors.reject(any(UUID.class), any(String.class), any(String.class)))
                .thenReturn(Mono.empty());
        when(revocationListener.isReady()).thenReturn(true);
        when(credentialVerification.verify(any(TerminalCredentialVerificationApi.Credential.class)))
                .thenThrow(new IllegalStateException("credential verification aborted"));
        when(session.send(any())).thenAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            Publisher<WebSocketMessage> outbound = invocation.getArgument(0);
            return Flux.from(outbound).then();
        });

        TerminalConnectionProtocol protocol =
                new TerminalConnectionProtocol(JsonMapper.builder().build());
        TdsRuntimeSettings settings = TdsRuntimeSettings.from(
                "1",
                "1",
                Duration.ofSeconds(30),
                Duration.ofSeconds(90),
                Duration.ofSeconds(15),
                Duration.ofSeconds(5));
        TdsWebSocketHandler handler = new TdsWebSocketHandler(
                settings,
                new TerminalConnectionFrameCodec(TdsWireJsonConfiguration.createWireObjectMapper(), protocol),
                protocol,
                credentialVerification,
                new TdsConnectionCapacityLimiter(1, 1),
                sessionActors,
                revocationListener,
                mock(TdsConnectionStateWriter.class),
                mock(TdsConnectionHistoryWriter.class),
                mock(SessionRegistrationGate.class),
                Schedulers.immediate(),
                Schedulers.immediate(),
                Schedulers.immediate(),
                Schedulers.immediate());

        try {
            handler.handle(session).block(Duration.ofSeconds(2));

            verify(sessionActors)
                    .reject(any(UUID.class), any(String.class), org.mockito.ArgumentMatchers.eq("SERVER_ERROR"));
            verify(session).close(new CloseStatus(4000, "SERVER_ERROR"));
            verify(session, never()).close(new CloseStatus(4000, "NETWORK_ERROR"));
        } finally {
            message.release();
        }
    }

    @Test
    void pingStillRepliesWhenTheCodecSchedulerRejectsWork() throws Exception {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("ping-codec-scheduler-rejected");
        when(session.isOpen()).thenReturn(true);
        when(session.textMessage(anyString())).thenReturn(mock(WebSocketMessage.class));
        when(session.close(any(CloseStatus.class))).thenReturn(Mono.empty());
        TerminalConnectionProtocol protocol =
                new TerminalConnectionProtocol(JsonMapper.builder().build());
        TdsRuntimeSettings settings = TdsRuntimeSettings.from(
                "1",
                "1",
                Duration.ofSeconds(30),
                Duration.ofSeconds(90),
                Duration.ofSeconds(15),
                Duration.ofSeconds(5));
        TdsWebSocketConnection connection = new TdsWebSocketConnection(
                session,
                protocol,
                new TdsConnectionCapacityLimiter(1, 1).tryAcquireUnauthenticated(),
                Schedulers.immediate());
        connection.outboundMessages().subscribe(ignored -> {});
        assertTrue(connection.sendSessionReady("SESSION_READY", null));
        var rejectingCodecScheduler = Schedulers.fromExecutor(command -> {
            throw new RejectedExecutionException("test codec scheduler rejection");
        });
        ByteBuf payload = Unpooled.copiedBuffer(
                "{\"type\":\"PING\",\"seq\":7,\"clientTs\":\"2026-09-29T00:00:00Z\",\"lastRttMs\":12.5}",
                StandardCharsets.UTF_8);
        WebSocketMessage ping = new WebSocketMessage(
                WebSocketMessage.Type.TEXT, new NettyDataBufferFactory(ByteBufAllocator.DEFAULT).wrap(payload));
        TdsWebSocketHandler handler = new TdsWebSocketHandler(
                settings,
                new TerminalConnectionFrameCodec(TdsWireJsonConfiguration.createWireObjectMapper(), protocol),
                protocol,
                mock(TerminalCredentialVerificationApi.class),
                new TdsConnectionCapacityLimiter(1, 1),
                mock(TdsTerminalSessionActors.class),
                mock(TdsBindingRevocationListener.class),
                mock(TdsConnectionStateWriter.class),
                mock(TdsConnectionHistoryWriter.class),
                mock(SessionRegistrationGate.class),
                Schedulers.immediate(),
                Schedulers.immediate(),
                rejectingCodecScheduler,
                Schedulers.immediate());

        try {
            handler.receivePing(
                            connection,
                            ping,
                            new AtomicLong(),
                            Sinks.many().replay().latest())
                    .block(Duration.ofSeconds(1));

            ArgumentCaptor<String> frames = ArgumentCaptor.forClass(String.class);
            verify(session, times(2)).textMessage(frames.capture());
            assertEquals("SESSION_READY", frames.getAllValues().getFirst());
            var pong =
                    JsonMapper.builder().build().readTree(frames.getAllValues().getLast());
            assertEquals("PONG", pong.path("type").asText());
            assertEquals(7, pong.path("seq").asLong());
            assertEquals("open", connection.closeReasonOr("open"));
            verify(session, never()).close(any(CloseStatus.class));
        } finally {
            connection.finish();
            ping.release();
            rejectingCodecScheduler.dispose();
        }
    }

    @Test
    void pingRoutesAheadOfQueuedBusinessFrames() throws Exception {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("ping-bypasses-business-queue");
        when(session.isOpen()).thenReturn(true);
        when(session.textMessage(anyString())).thenReturn(mock(WebSocketMessage.class));
        when(session.close(any(CloseStatus.class))).thenReturn(Mono.empty());
        TerminalConnectionProtocol protocol =
                new TerminalConnectionProtocol(JsonMapper.builder().build());
        TdsRuntimeSettings settings = TdsRuntimeSettings.from(
                "1",
                "1",
                Duration.ofSeconds(30),
                Duration.ofSeconds(90),
                Duration.ofSeconds(15),
                Duration.ofSeconds(5));
        TdsConnectionCapacityLimiter limiter = new TdsConnectionCapacityLimiter(1, 1);
        TdsWebSocketConnection connection = new TdsWebSocketConnection(
                session, protocol, limiter.tryAcquireUnauthenticated(), Schedulers.immediate());
        connection.outboundMessages().subscribe(ignored -> {});
        assertTrue(connection.sendSessionReady("SESSION_READY", null));
        TdsWebSocketHandler handler = new TdsWebSocketHandler(
                settings,
                new TerminalConnectionFrameCodec(TdsWireJsonConfiguration.createWireObjectMapper(), protocol),
                protocol,
                mock(TerminalCredentialVerificationApi.class),
                limiter,
                mock(TdsTerminalSessionActors.class),
                mock(TdsBindingRevocationListener.class),
                mock(TdsConnectionStateWriter.class),
                mock(TdsConnectionHistoryWriter.class),
                mock(SessionRegistrationGate.class),
                Schedulers.immediate(),
                Schedulers.immediate(),
                Schedulers.immediate(),
                Schedulers.immediate());
        Sinks.Many<String> businessFrames = Sinks.many().unicast().onBackpressureBuffer(new ArrayBlockingQueue<>(1));
        AtomicLong lastSequence = new AtomicLong();
        Sinks.Many<Long> heartbeatEvents = Sinks.many().replay().latest();
        String report = "{\"type\":\"REMOTE_REPORT\",\"reportId\":\"report-1\","
                + "\"remoteOperationId\":\"operation-1\",\"requestId\":\"request-1\","
                + "\"phase\":\"COMPLETED\",\"occurredAt\":\"2026-10-05T00:00:00Z\","
                + "\"result\":{\"ok\":true}}";
        WebSocketMessage reportMessage = textMessage(report);
        WebSocketMessage pingMessage =
                textMessage("{\"type\":\"PING\",\"seq\":7,\"clientTs\":\"2026-10-05T00:00:00Z\",\"lastRttMs\":12.5}");

        try {
            handler.routeAuthenticatedMessage(connection, reportMessage, lastSequence, heartbeatEvents, businessFrames)
                    .block(Duration.ofSeconds(1));
            handler.routeAuthenticatedMessage(connection, pingMessage, lastSequence, heartbeatEvents, businessFrames)
                    .block(Duration.ofSeconds(1));

            assertEquals(report, businessFrames.asFlux().next().block(Duration.ofSeconds(1)));
            ArgumentCaptor<String> frames = ArgumentCaptor.forClass(String.class);
            verify(session, times(2)).textMessage(frames.capture());
            assertEquals("SESSION_READY", frames.getAllValues().getFirst());
            var pong =
                    JsonMapper.builder().build().readTree(frames.getAllValues().getLast());
            assertEquals("PONG", pong.path("type").asText());
            assertEquals(7, pong.path("seq").asLong());
            verify(session, never()).close(any(CloseStatus.class));
        } finally {
            connection.finish();
            reportMessage.release();
            pingMessage.release();
            businessFrames.tryEmitComplete();
        }
    }

    private static WebSocketMessage textMessage(String text) {
        ByteBuf payload = Unpooled.copiedBuffer(text, StandardCharsets.UTF_8);
        return new WebSocketMessage(
                WebSocketMessage.Type.TEXT, new NettyDataBufferFactory(ByteBufAllocator.DEFAULT).wrap(payload));
    }
}
