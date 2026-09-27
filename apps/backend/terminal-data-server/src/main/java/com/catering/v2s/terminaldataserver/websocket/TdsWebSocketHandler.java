package com.catering.v2s.terminaldataserver.websocket;

import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Outcome;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.catering.v2s.terminaldataserver.config.TdsRuntimeSettings;
import com.catering.v2s.terminaldataserver.observability.TdsAsyncLog;
import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionFrameCodec;
import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionFrameCodec.Authenticate;
import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionFrameCodec.Ping;
import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionProtocol;
import com.catering.v2s.terminaldataserver.session.SessionRegistrationGate;
import com.catering.v2s.terminaldataserver.session.TdsBindingRevocationListener;
import com.catering.v2s.terminaldataserver.session.TdsTerminalSessionActors;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.SessionIdentity;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateWriter;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.CloseStatus;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketMessage;
import org.springframework.web.reactive.socket.WebSocketSession;
import org.springframework.web.util.UriUtils;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;
import reactor.core.scheduler.Scheduler;

/** Handles the public WebSocket handshake and the first-frame terminal credential exchange. */
@Component
public final class TdsWebSocketHandler implements WebSocketHandler {
    private static final Logger LOGGER = LoggerFactory.getLogger(TdsWebSocketHandler.class);
    private static final String GROUP_WORKSPACE_KEY = "[A-Za-z0-9][A-Za-z0-9-]{0,63}";

    private final TdsRuntimeSettings settings;
    private final TerminalConnectionFrameCodec codec;
    private final TerminalConnectionProtocol protocol;
    private final TerminalCredentialVerificationApi credentialVerification;
    private final UnauthenticatedConnectionLimiter limiter;
    private final TdsTerminalSessionActors sessionActors;
    private final TdsBindingRevocationListener revocationListener;
    private final TdsConnectionStateWriter stateWriter;
    private final SessionRegistrationGate registrationGate;
    private final Scheduler databaseScheduler;
    private final Scheduler identityScheduler;
    private final Scheduler codecScheduler;
    private final Scheduler logScheduler;

    public TdsWebSocketHandler(
            TdsRuntimeSettings settings,
            TerminalConnectionFrameCodec codec,
            TerminalConnectionProtocol protocol,
            TerminalCredentialVerificationApi credentialVerification,
            UnauthenticatedConnectionLimiter limiter,
            TdsTerminalSessionActors sessionActors,
            TdsBindingRevocationListener revocationListener,
            TdsConnectionStateWriter stateWriter,
            SessionRegistrationGate registrationGate,
            @Qualifier("tds-db-worker") Scheduler databaseScheduler,
            @Qualifier("tds-identity-worker") Scheduler identityScheduler,
            @Qualifier("tds-codec-worker") Scheduler codecScheduler,
            @Qualifier("tds-log-worker") Scheduler logScheduler) {
        this.settings = settings;
        this.codec = codec;
        this.protocol = protocol;
        this.credentialVerification = credentialVerification;
        this.limiter = limiter;
        this.sessionActors = sessionActors;
        this.revocationListener = revocationListener;
        this.stateWriter = stateWriter;
        this.registrationGate = registrationGate;
        this.databaseScheduler = databaseScheduler;
        this.identityScheduler = identityScheduler;
        this.codecScheduler = codecScheduler;
        this.logScheduler = logScheduler;
    }

    @Override
    public Mono<Void> handle(WebSocketSession session) {
        if (sessionActors.isDraining()) return close(session, "REDIRECT_TO_NEXT_NODE");
        if (!revocationListener.isReady()) return close(session, "SERVER_ERROR");
        UnauthenticatedConnectionLimiter.Permit permit = limiter.tryAcquire();
        if (permit == null) return close(session, "NODE_BUSY");

        String groupWorkspaceKey = groupWorkspaceKey(session.getHandshakeInfo().getUri());
        if (groupWorkspaceKey == null) {
            permit.close();
            return close(session, "CREDENTIAL_INVALID");
        }

        TdsWebSocketConnection connection = new TdsWebSocketConnection(session, protocol, permit, logScheduler);
        long acceptedAtNanos = System.nanoTime();
        AtomicReference<AttemptReference> attemptReference = new AtomicReference<>();
        AtomicReference<TdsAuthenticationFailureDiagnostics.Stage> authenticationStage =
                new AtomicReference<>(TdsAuthenticationFailureDiagnostics.Stage.AUTHENTICATION_FRAME_DECODE);
        AtomicLong lastPingSequence = new AtomicLong();
        Sinks.One<Void> stopHeartbeatWatch = Sinks.one();
        Sinks.Many<Long> heartbeatEvents = Sinks.many().replay().latest();

        Mono<Void> receive = session.receive()
                .timeout(
                        Mono.delay(settings.authenticationFirstFrameTimeout()),
                        ignored -> Flux.never(),
                        Flux.error(new AuthenticationTimeoutException()))
                .index()
                .concatMap(indexed -> {
                    WebSocketMessage message = indexed.getT2();
                    message.retain();
                    try {
                        if (indexed.getT1() == 0) {
                            int frameBytes = message.getPayload().readableByteCount();
                            WebSocketMessage.Type frameType = message.getType();
                            TdsAsyncLog.enqueue(
                                    logScheduler,
                                    () -> LOGGER.info(
                                            "event=tds_ws_first_frame_received "
                                                    + "connectionId={} frameType={} frameBytes={}",
                                            connection.connectionId(),
                                            frameType,
                                            frameBytes));
                        }
                        Mono<Void> handled = indexed.getT1() == 0
                                ? authenticate(
                                        connection,
                                        groupWorkspaceKey,
                                        message,
                                        acceptedAtNanos,
                                        attemptReference,
                                        authenticationStage,
                                        heartbeatEvents)
                                : receivePing(connection, message, lastPingSequence, heartbeatEvents);
                        return handled.doFinally(ignored -> message.release());
                    } catch (RuntimeException | Error setupFailure) {
                        message.release();
                        throw setupFailure;
                    }
                })
                .then()
                .onErrorResume(
                        AuthenticationTimeoutException.class, ignored -> close(connection, "AUTHENTICATION_TIMEOUT"))
                .onErrorResume(ignored -> close(connection, "NETWORK_ERROR"))
                .doFinally(ignored -> {
                    AttemptReference attempt = attemptReference.get();
                    if (attempt != null) {
                        sessionActors.connectionClosed(attempt.terminalRef(), attempt.attemptId(), connection);
                    }
                    connection.finish();
                    completeHeartbeatSinks(connection, heartbeatEvents, stopHeartbeatWatch);
                });

        Mono<Void> heartbeatTimeout = heartbeatEvents
                .asFlux()
                .switchMap(ignored -> Mono.delay(settings.heartbeatTimeout()))
                .take(1)
                .flatMap(ignored -> close(connection, "HEARTBEAT_TIMEOUT"))
                .takeUntilOther(stopHeartbeatWatch.asMono())
                .then();

        return Mono.when(session.send(connection.outboundMessages()), receive, heartbeatTimeout)
                .doOnSubscribe(ignored -> TdsAsyncLog.enqueue(
                        logScheduler, () -> LOGGER.info("event=tds_ws_accepted sessionId={}", connection.sessionId())))
                .doOnError(failure -> TdsAsyncLog.enqueue(
                        logScheduler,
                        () -> LOGGER.warn(
                                "event=tds_ws_io_failed connectionId={} failureType={}",
                                connection.connectionId(),
                                failure.getClass().getSimpleName())))
                .doFinally(ignored -> {
                    connection.finish();
                    completeHeartbeatSinks(connection, heartbeatEvents, stopHeartbeatWatch);
                });
    }

    private Mono<Void> authenticate(
            TdsWebSocketConnection connection,
            String groupWorkspaceKey,
            WebSocketMessage message,
            long acceptedAtNanos,
            AtomicReference<AttemptReference> attemptReference,
            AtomicReference<TdsAuthenticationFailureDiagnostics.Stage> authenticationStage,
            Sinks.Many<Long> heartbeatEvents) {
        if (message.getPayload().readableByteCount() > settings.maxMessageBytes()) {
            return closeStandard(connection, 1009);
        }
        if (message.getType() != WebSocketMessage.Type.TEXT) return close(connection, "UNKNOWN");

        long remainingNanos = settings.authenticationOverallTimeout().toNanos() - (System.nanoTime() - acceptedAtNanos);
        if (remainingNanos <= 0) return close(connection, "AUTHENTICATION_TIMEOUT");

        return Mono.fromCallable(() -> {
                    authenticationStage.set(TdsAuthenticationFailureDiagnostics.Stage.AUTHENTICATION_FRAME_DECODE);
                    return codec.authenticate(groupWorkspaceKey, message.getPayloadAsText(StandardCharsets.UTF_8));
                })
                .onErrorMap(IllegalArgumentException.class, MalformedAuthenticationException::new)
                .subscribeOn(codecScheduler)
                .flatMap(authenticate -> {
                    authenticationStage.set(TdsAuthenticationFailureDiagnostics.Stage.SESSION_ATTEMPT_ID_GENERATION);
                    return beginAuthentication(
                            connection, authenticate, attemptReference, authenticationStage, heartbeatEvents);
                })
                .timeout(Duration.ofNanos(remainingNanos))
                .onErrorResume(MalformedAuthenticationException.class, ignored -> close(connection, "UNKNOWN"))
                .onErrorResume(
                        TimeoutException.class,
                        ignored -> rejectCurrent(connection, attemptReference, "AUTHENTICATION_TIMEOUT"))
                .onErrorResume(failure -> rejectAfterAuthenticationFailure(
                        connection, attemptReference, authenticationStage.get(), failure));
    }

    private Mono<Void> rejectAfterAuthenticationFailure(
            TdsWebSocketConnection connection,
            AtomicReference<AttemptReference> attemptReference,
            TdsAuthenticationFailureDiagnostics.Stage stage,
            Throwable failure) {
        TdsAuthenticationFailureDiagnostics.Diagnostic diagnostic =
                TdsAuthenticationFailureDiagnostics.describe(failure, stage);
        TdsAsyncLog.enqueue(
                logScheduler,
                () -> LOGGER.warn(
                        "event=tds_ws_authentication_failed connectionId={} stage={} failureType={} "
                                + "rootFailureType={} sqlState={}",
                        connection.connectionId(),
                        diagnostic.stage(),
                        diagnostic.failureType(),
                        diagnostic.rootFailureType(),
                        diagnostic.sqlState()));
        return Mono.defer(() -> rejectCurrent(connection, attemptReference, "SERVER_ERROR"));
    }

    private Mono<Void> beginAuthentication(
            TdsWebSocketConnection connection,
            Authenticate authenticate,
            AtomicReference<AttemptReference> attemptReference,
            AtomicReference<TdsAuthenticationFailureDiagnostics.Stage> authenticationStage,
            Sinks.Many<Long> heartbeatEvents) {
        var credential = authenticate.credential();
        return Mono.fromCallable(() -> {
                    authenticationStage.set(TdsAuthenticationFailureDiagnostics.Stage.SESSION_ATTEMPT_ID_GENERATION);
                    return UUID.randomUUID().toString();
                })
                .subscribeOn(identityScheduler)
                .flatMap(attemptId -> {
                    AttemptReference attempt = new AttemptReference(credential.terminalRef(), attemptId);
                    if (!attemptReference.compareAndSet(null, attempt)) return close(connection, "UNKNOWN");
                    authenticationStage.set(TdsAuthenticationFailureDiagnostics.Stage.SESSION_ATTEMPT_BEGIN);
                    return sessionActors
                            .beginAttempt(
                                    credential.terminalRef(),
                                    credential.groupWorkspaceKey(),
                                    attemptId,
                                    credential.generation(),
                                    connection)
                            .flatMap(began -> {
                                if (!began) return Mono.empty();
                                return Mono.fromCallable(() -> {
                                            authenticationStage.set(
                                                    TdsAuthenticationFailureDiagnostics.Stage.CREDENTIAL_VERIFICATION);
                                            return credentialVerification.verify(credential);
                                        })
                                        .subscribeOn(databaseScheduler)
                                        .flatMap(verification -> {
                                            TdsAsyncLog.enqueue(
                                                    logScheduler,
                                                    () -> LOGGER.info(
                                                            "event=tds_ws_credential_verification_completed "
                                                                    + "connectionId={} outcome={}",
                                                            connection.connectionId(),
                                                            verification.outcome()));
                                            return registerVerifiedConnection(
                                                    connection,
                                                    attempt,
                                                    verification,
                                                    authenticationStage,
                                                    heartbeatEvents);
                                        });
                            });
                });
    }

    private Mono<Void> registerVerifiedConnection(
            TdsWebSocketConnection connection,
            AttemptReference attempt,
            Verification verification,
            AtomicReference<TdsAuthenticationFailureDiagnostics.Stage> authenticationStage,
            Sinks.Many<Long> heartbeatEvents) {
        if (verification.outcome() != Outcome.VERIFIED) {
            return rejectAttempt(connection, attempt, closeReason(verification.outcome()));
        }

        authenticationStage.set(TdsAuthenticationFailureDiagnostics.Stage.VERIFICATION_RECORD);
        return sessionActors
                .recordVerification(attempt.terminalRef(), attempt.attemptId(), verification)
                .flatMap(recorded -> {
                    TdsAsyncLog.enqueue(
                            logScheduler,
                            () -> LOGGER.info(
                                    "event=tds_ws_verification_recorded connectionId={} recorded={}",
                                    connection.connectionId(),
                                    recorded));
                    if (!recorded) return Mono.empty();
                    return Mono.defer(() -> {
                                authenticationStage.set(TdsAuthenticationFailureDiagnostics.Stage.REGISTRATION_GATE);
                                TdsAsyncLog.enqueue(
                                        logScheduler,
                                        () -> LOGGER.info(
                                                "event=tds_ws_pre_registration_gate_entered connectionId={}",
                                                connection.connectionId()));
                                return registrationGate.beforeRegistration(attempt.attemptId());
                            })
                            .then(Mono.defer(() -> {
                                authenticationStage.set(TdsAuthenticationFailureDiagnostics.Stage.SESSION_REGISTER);
                                return sessionActors.register(attempt.terminalRef(), attempt.attemptId(), verification);
                            }))
                            .flatMap(registered -> {
                                if (!registered) return Mono.empty();
                                if (!heartbeatEvents.tryEmitNext(0L).isSuccess()) {
                                    connection.close("SERVER_ERROR");
                                    return Mono.empty();
                                }
                                TdsAsyncLog.enqueue(
                                        logScheduler,
                                        () -> LOGGER.info(
                                                "event=tds_ws_credential_verified connectionId={} sessionId={}",
                                                connection.connectionId(),
                                                connection.sessionId()));
                                return Mono.empty();
                            });
                });
    }

    private Mono<Void> receivePing(
            TdsWebSocketConnection connection,
            WebSocketMessage message,
            AtomicLong lastSequence,
            Sinks.Many<Long> heartbeatEvents) {
        if (message.getPayload().readableByteCount() > settings.maxMessageBytes()) {
            return closeStandard(connection, 1009);
        }
        if (!connection.isAuthenticationReady() || message.getType() != WebSocketMessage.Type.TEXT)
            return close(connection, "UNKNOWN");
        return Mono.fromCallable(() -> {
                    Ping ping = codec.ping(message.getPayloadAsText(StandardCharsets.UTF_8));
                    String pong = codec.pong(ping.sequence(), Instant.now());
                    return new PingResponse(ping, pong);
                })
                .subscribeOn(codecScheduler)
                .flatMap(response -> {
                    Ping ping = response.ping();
                    long previous = lastSequence.get();
                    if (ping.sequence() <= previous || !lastSequence.compareAndSet(previous, ping.sequence())) {
                        return close(connection, "UNKNOWN");
                    }
                    if (!connection.sendText(response.pong())) return close(connection, "SERVER_ERROR");
                    SessionIdentity session = connection.persistedSession();
                    if (session != null) stateWriter.queueHeartbeat(session, ping.lastRttMs());
                    if (!heartbeatEvents.tryEmitNext(ping.sequence()).isSuccess()) {
                        return close(connection, "SERVER_ERROR");
                    }
                    return Mono.empty();
                })
                .onErrorResume(IllegalArgumentException.class, ignored -> close(connection, "UNKNOWN"))
                .onErrorResume(ignored -> close(connection, "SERVER_ERROR"));
    }

    private Mono<Void> rejectAttempt(TdsWebSocketConnection connection, AttemptReference attempt, String reason) {
        return sessionActors
                .reject(attempt.terminalRef(), attempt.attemptId(), reason)
                .doFinally(ignored -> connection.close(reason));
    }

    private Mono<Void> rejectCurrent(
            TdsWebSocketConnection connection, AtomicReference<AttemptReference> attemptReference, String reason) {
        AttemptReference attempt = attemptReference.get();
        return attempt == null ? close(connection, reason) : rejectAttempt(connection, attempt, reason);
    }

    private Mono<Void> close(TdsWebSocketConnection connection, String reason) {
        connection.close(reason);
        return Mono.empty();
    }

    private Mono<Void> closeStandard(TdsWebSocketConnection connection, int code) {
        connection.closeStandard(code);
        return Mono.empty();
    }

    private Mono<Void> close(WebSocketSession session, String reason) {
        TerminalConnectionProtocol.Close close = protocol.applicationClose(reason);
        return session.close(new CloseStatus(close.code(), close.reason())).onErrorResume(ignored -> Mono.empty());
    }

    private void completeHeartbeatSinks(
            TdsWebSocketConnection connection, Sinks.Many<Long> heartbeatEvents, Sinks.One<Void> stopHeartbeatWatch) {
        logUnexpectedCompletionResult(connection, "HEARTBEAT_EVENTS", heartbeatEvents.tryEmitComplete());
        logUnexpectedCompletionResult(connection, "STOP_HEARTBEAT_WATCH", stopHeartbeatWatch.tryEmitEmpty());
    }

    private void logUnexpectedCompletionResult(
            TdsWebSocketConnection connection, String signal, Sinks.EmitResult result) {
        if (result == Sinks.EmitResult.OK || result == Sinks.EmitResult.FAIL_TERMINATED) return;
        String connectionId = connection.connectionId();
        String resultName = result.name();
        TdsAsyncLog.enqueue(
                logScheduler,
                () -> LOGGER.warn(
                        "event=tds_ws_sink_completion_rejected connectionId={} signal={} emitResult={}",
                        connectionId,
                        signal,
                        resultName));
    }

    private static String closeReason(Outcome outcome) {
        return switch (outcome) {
            case CREDENTIAL_INVALID -> "CREDENTIAL_INVALID";
            case ACTIVATION_CANCELLED -> "ACTIVATION_CANCELLED";
            case GROUP_WORKSPACE_DISABLED -> "GROUP_WORKSPACE_DISABLED";
            case TERMINAL_DISABLED -> "TERMINAL_DISABLED";
            case VERIFIED -> throw new IllegalArgumentException("verified outcome has no close reason");
        };
    }

    private static String groupWorkspaceKey(URI uri) {
        String rawPath = uri.getRawPath();
        if (rawPath == null) return null;
        String[] segments = rawPath.split("/", -1);
        if (segments.length != 4 || !"tdp".equals(segments[1]) || !"ws".equals(segments[3])) return null;
        try {
            String decoded = UriUtils.decode(segments[2], StandardCharsets.UTF_8);
            if (!decoded.matches(GROUP_WORKSPACE_KEY)) return null;
            return decoded;
        } catch (IllegalArgumentException malformedPath) {
            return null;
        }
    }

    private record AttemptReference(UUID terminalRef, String attemptId) {}

    private record PingResponse(Ping ping, String pong) {}

    private static final class AuthenticationTimeoutException extends RuntimeException {
        private static final long serialVersionUID = 1L;
    }

    private static final class MalformedAuthenticationException extends RuntimeException {
        private static final long serialVersionUID = 1L;

        private MalformedAuthenticationException(IllegalArgumentException cause) {
            super(cause);
        }
    }
}
