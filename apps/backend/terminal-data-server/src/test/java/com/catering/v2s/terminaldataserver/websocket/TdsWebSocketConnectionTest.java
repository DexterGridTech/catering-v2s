package com.catering.v2s.terminaldataserver.websocket;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionProtocol;
import com.catering.v2s.terminaldataserver.session.TdsConnectionCapacityLimiter;
import io.netty.buffer.ByteBuf;
import io.netty.buffer.ByteBufAllocator;
import io.netty.buffer.Unpooled;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.reactivestreams.Subscription;
import org.springframework.core.io.buffer.NettyDataBufferFactory;
import org.springframework.web.reactive.socket.CloseStatus;
import org.springframework.web.reactive.socket.WebSocketMessage;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.BaseSubscriber;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;
import tools.jackson.databind.json.JsonMapper;

class TdsWebSocketConnectionTest {
    @Test
    void closesOversizedMessagesWithTheSharedStandard1009Code() {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("oversized-session");
        when(session.close(any(CloseStatus.class))).thenReturn(Mono.empty());
        TdsConnectionCapacityLimiter limiter = new TdsConnectionCapacityLimiter(1, 1);
        TdsWebSocketConnection connection = new TdsWebSocketConnection(
                session,
                new TerminalConnectionProtocol(JsonMapper.builder().build()),
                limiter.tryAcquireUnauthenticated(),
                Schedulers.immediate());

        connection.closeStandardAsync(1009).block();

        verify(session).close(argThat(closeStatus -> closeStatus.getCode() == 1009));
    }

    @Test
    void releasesQueuedOutboundMessageWhenSubscriberCancelsBeforeDemand() {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("cancelled-outbound-session");
        ByteBuf payload = Unpooled.copiedBuffer("OUTBOUND", StandardCharsets.UTF_8);
        WebSocketMessage message = new WebSocketMessage(
                WebSocketMessage.Type.TEXT, new NettyDataBufferFactory(ByteBufAllocator.DEFAULT).wrap(payload));
        when(session.textMessage(anyString())).thenReturn(message);
        TdsConnectionCapacityLimiter limiter = new TdsConnectionCapacityLimiter(1, 1);
        TdsConnectionCapacityLimiter.Permit permit = limiter.tryAcquireUnauthenticated();
        TdsWebSocketConnection connection = new TdsWebSocketConnection(
                session, new TerminalConnectionProtocol(JsonMapper.builder().build()), permit, Schedulers.immediate());
        BaseSubscriber<WebSocketMessage> subscriber = new BaseSubscriber<>() {
            @Override
            protected void hookOnSubscribe(Subscription subscription) {
                // Keep the message queued so cancellation exercises the sink's discard path.
            }
        };

        try {
            connection.outboundMessages().subscribe(subscriber);
            assertThat(connection.sendText("OUTBOUND")).isTrue();
            assertThat(payload.refCnt()).isEqualTo(1);
        } finally {
            subscriber.cancel();
            permit.close();
        }

        assertThat(payload.refCnt()).isZero();
    }

    @Test
    void rejectsAndReleasesFrameWhenTheSingleOutboundSlotIsOccupied() {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("full-outbound-session");
        ByteBuf queuedPayload = Unpooled.copiedBuffer("QUEUED", StandardCharsets.UTF_8);
        ByteBuf rejectedPayload = Unpooled.copiedBuffer("REJECTED", StandardCharsets.UTF_8);
        WebSocketMessage queued = new WebSocketMessage(
                WebSocketMessage.Type.TEXT,
                new NettyDataBufferFactory(ByteBufAllocator.DEFAULT).wrap(queuedPayload));
        WebSocketMessage rejected = new WebSocketMessage(
                WebSocketMessage.Type.TEXT,
                new NettyDataBufferFactory(ByteBufAllocator.DEFAULT).wrap(rejectedPayload));
        when(session.textMessage(anyString())).thenReturn(queued, rejected);
        TdsConnectionCapacityLimiter limiter = new TdsConnectionCapacityLimiter(1, 1);
        TdsConnectionCapacityLimiter.Permit permit = limiter.tryAcquireUnauthenticated();
        TdsWebSocketConnection connection = new TdsWebSocketConnection(
                session, new TerminalConnectionProtocol(JsonMapper.builder().build()), permit, Schedulers.immediate());
        BaseSubscriber<WebSocketMessage> subscriber = new BaseSubscriber<>() {
            @Override
            protected void hookOnSubscribe(Subscription subscription) {
                // Keep the single outbound slot occupied until cancellation.
            }
        };

        try {
            connection.outboundMessages().subscribe(subscriber);
            assertThat(connection.sendText("QUEUED")).isTrue();
            assertThat(connection.sendText("REJECTED")).isFalse();
            assertThat(queuedPayload.refCnt()).isEqualTo(1);
            assertThat(rejectedPayload.refCnt()).isZero();
        } finally {
            subscriber.cancel();
            permit.close();
        }

        assertThat(queuedPayload.refCnt()).isZero();
    }
}
