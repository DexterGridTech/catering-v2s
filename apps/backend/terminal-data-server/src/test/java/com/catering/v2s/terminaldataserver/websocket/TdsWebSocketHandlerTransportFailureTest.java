package com.catering.v2s.terminaldataserver.websocket;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi;
import com.catering.v2s.terminaldataserver.config.TdsRuntimeSettings;
import com.catering.v2s.terminaldataserver.protocol.TdsWireJsonConfiguration;
import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionFrameCodec;
import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionProtocol;
import com.catering.v2s.terminaldataserver.session.SessionRegistrationGate;
import com.catering.v2s.terminaldataserver.session.TdsBindingRevocationListener;
import com.catering.v2s.terminaldataserver.session.TdsTerminalSessionActors;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateWriter;
import io.netty.buffer.ByteBuf;
import io.netty.buffer.ByteBufAllocator;
import io.netty.buffer.Unpooled;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.Test;
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
                new UnauthenticatedConnectionLimiter(1),
                sessionActors,
                revocationListener,
                mock(TdsConnectionStateWriter.class),
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
                new UnauthenticatedConnectionLimiter(1),
                sessionActors,
                revocationListener,
                mock(TdsConnectionStateWriter.class),
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
                new UnauthenticatedConnectionLimiter(1),
                sessionActors,
                revocationListener,
                mock(TdsConnectionStateWriter.class),
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
}
