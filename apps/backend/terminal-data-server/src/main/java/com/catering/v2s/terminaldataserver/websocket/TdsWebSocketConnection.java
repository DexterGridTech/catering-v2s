package com.catering.v2s.terminaldataserver.websocket;

import com.catering.v2s.terminaldataserver.observability.TdsAsyncLog;
import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionProtocol;
import com.catering.v2s.terminaldataserver.session.TdsConnectionCapacityLimiter;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.SessionIdentity;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.reactive.socket.CloseStatus;
import org.springframework.web.reactive.socket.WebSocketMessage;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;
import reactor.core.scheduler.Scheduler;

/** Owns one socket's bounded outbound queue, close status and unauthenticated permit. */
public final class TdsWebSocketConnection {
    private static final Logger LOGGER = LoggerFactory.getLogger(TdsWebSocketConnection.class);

    private final WebSocketSession session;
    private final TerminalConnectionProtocol protocol;
    private final TdsConnectionCapacityLimiter.Permit unauthenticatedPermit;
    private final Scheduler logScheduler;
    private final String sessionId;
    private final Object outboundMonitor = new Object();
    private final Sinks.Many<WebSocketMessage> outbound =
            Sinks.many().unicast().onBackpressureBuffer(new ArrayBlockingQueue<>(1));
    private final AtomicBoolean closeStarted = new AtomicBoolean();
    private final AtomicBoolean outboundFinished = new AtomicBoolean();
    private final AtomicBoolean authenticationReady = new AtomicBoolean();
    private final AtomicBoolean releasePermitOnOutbound = new AtomicBoolean();
    private final AtomicReference<SessionIdentity> persistedSession = new AtomicReference<>();
    private volatile String closeReason;

    public TdsWebSocketConnection(
            WebSocketSession session,
            TerminalConnectionProtocol protocol,
            TdsConnectionCapacityLimiter.Permit unauthenticatedPermit,
            @Qualifier("tds-log-worker") Scheduler logScheduler) {
        this.session = session;
        this.protocol = protocol;
        this.unauthenticatedPermit = unauthenticatedPermit;
        this.logScheduler = logScheduler;
        this.sessionId = session.getId();
    }

    public String connectionId() {
        return session.getId();
    }

    public String sessionId() {
        return sessionId;
    }

    public Flux<WebSocketMessage> outboundMessages() {
        return outbound.asFlux()
                .doOnDiscard(WebSocketMessage.class, WebSocketMessage::release)
                .doOnNext(ignored -> {
                    if (releasePermitOnOutbound.compareAndSet(true, false)) unauthenticatedPermit.close();
                });
    }

    public boolean isOpen() {
        return session.isOpen() && !closeStarted.get();
    }

    public boolean isAuthenticationReady() {
        return authenticationReady.get();
    }

    public boolean sendSessionReady(String text, SessionIdentity identity) {
        persistedSession.set(identity);
        authenticationReady.set(true);
        releasePermitOnOutbound.set(true);
        boolean accepted = sendText(text);
        if (!accepted) {
            authenticationReady.set(false);
            releasePermitOnOutbound.set(false);
        }
        return accepted;
    }

    public boolean sendText(String text) {
        WebSocketMessage message = session.textMessage(text);
        Sinks.EmitResult result;
        synchronized (outboundMonitor) {
            result = outbound.tryEmitNext(message);
        }
        if (result.isSuccess()) return true;

        message.release();
        TdsAsyncLog.enqueue(
                logScheduler,
                () -> LOGGER.warn(
                        "event=tds_ws_outbound_rejected connectionId={} emitResult={}", connectionId(), result.name()));
        return false;
    }

    public SessionIdentity persistedSession() {
        return persistedSession.get();
    }

    public String closeReasonOr(String fallback) {
        String current = closeReason;
        return current == null ? fallback : current;
    }

    public void close(String reason) {
        closeAsync(reason).subscribe();
    }

    public Mono<Void> closeAsync(String reason) {
        return closeAsync(protocol.applicationClose(reason));
    }

    public void closeStandard(int code) {
        closeStandardAsync(code).subscribe();
    }

    public Mono<Void> closeStandardAsync(int code) {
        return closeAsync(protocol.standardClose(code));
    }

    private Mono<Void> closeAsync(TerminalConnectionProtocol.Close close) {
        if (!closeStarted.compareAndSet(false, true)) return Mono.empty();
        closeReason = close.reason();
        unauthenticatedPermit.close();
        TdsAsyncLog.enqueue(
                logScheduler,
                () -> LOGGER.info(
                        "event=tds_ws_close_started connectionId={} sessionId={} closeCode={} closeReason={}",
                        connectionId(),
                        sessionId,
                        close.code(),
                        close.reason()));
        return session.close(new CloseStatus(close.code(), close.reason()))
                .doOnError(failure -> TdsAsyncLog.enqueue(
                        logScheduler,
                        () -> LOGGER.warn(
                                "event=tds_ws_close_failed connectionId={} reason={} failureType={}",
                                connectionId(),
                                close.reason(),
                                failure.getClass().getSimpleName())))
                .onErrorComplete();
    }

    public void finish() {
        unauthenticatedPermit.close();
        if (!outboundFinished.compareAndSet(false, true)) return;
        Sinks.EmitResult result;
        synchronized (outboundMonitor) {
            result = outbound.tryEmitComplete();
        }
        if (result.isFailure() && result != Sinks.EmitResult.FAIL_TERMINATED) {
            TdsAsyncLog.enqueue(
                    logScheduler,
                    () -> LOGGER.warn(
                            "event=tds_ws_outbound_completion_rejected connectionId={} emitResult={}",
                            connectionId(),
                            result.name()));
        }
    }
}
