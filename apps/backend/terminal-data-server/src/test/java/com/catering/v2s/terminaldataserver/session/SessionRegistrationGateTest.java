package com.catering.v2s.terminaldataserver.session;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.StandardProtocolFamily;
import java.net.UnixDomainSocketAddress;
import java.nio.channels.Channels;
import java.nio.channels.ServerSocketChannel;
import java.nio.channels.SocketChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Scheduler;
import reactor.core.scheduler.Schedulers;

class SessionRegistrationGateTest {
    private final Scheduler identityScheduler = Schedulers.newBoundedElastic(2, 16, "session-registration-test");

    @AfterEach
    void disposeIdentityScheduler() {
        identityScheduler.dispose();
    }

    @Test
    void productionBindingReturnsImmediatelyWhenNoAcceptanceSocketIsConfigured() {
        new SessionRegistrationGate("", "", "", identityScheduler)
                .beforeRegistration(UUID.randomUUID().toString())
                .block(Duration.ofSeconds(1));
    }

    @Test
    void acceptanceGateSignalsVerifiedAttemptAndWaitsForMatchingRelease() throws Exception {
        Path socketPath = Path.of("/tmp", "tds-registration-gate-" + UUID.randomUUID() + ".sock");
        String attemptId = UUID.randomUUID().toString();
        try (ServerSocketChannel server = ServerSocketChannel.open(StandardProtocolFamily.UNIX)) {
            server.bind(UnixDomainSocketAddress.of(socketPath));
            Mono<Void> gate = new SessionRegistrationGate(
                            socketPath.toString(), "backend-acceptance-test", "remote", identityScheduler)
                    .beforeRegistration(attemptId);
            var result = gate.toFuture();

            try (SocketChannel client = server.accept();
                    BufferedReader reader = new BufferedReader(
                            new InputStreamReader(Channels.newInputStream(client), StandardCharsets.US_ASCII));
                    BufferedWriter writer = new BufferedWriter(
                            new OutputStreamWriter(Channels.newOutputStream(client), StandardCharsets.US_ASCII))) {
                assertEquals("CREDENTIAL_VERIFICATION_RETURNED_BEFORE_REGISTER\t" + attemptId, reader.readLine());
                assertFalse(result.isDone(), "registration must remain held until the matching release arrives");
                writer.write("RELEASE\t" + attemptId);
                writer.newLine();
                writer.flush();
            }

            result.get(1, TimeUnit.SECONDS);
        } finally {
            Files.deleteIfExists(socketPath);
        }
    }

    @Test
    void postgresOpenGateSignalsCommittedCandidateBeforeLocalRegistration() throws Exception {
        Path socketPath = Path.of("/tmp", "tds-registration-gate-" + UUID.randomUUID() + ".sock");
        String attemptId = UUID.randomUUID().toString();
        try (ServerSocketChannel server = ServerSocketChannel.open(StandardProtocolFamily.UNIX)) {
            server.bind(UnixDomainSocketAddress.of(socketPath));
            var result = new SessionRegistrationGate(
                            socketPath.toString(), "backend-acceptance-test", "remote", identityScheduler)
                    .afterPostgresOpen(attemptId)
                    .toFuture();

            try (SocketChannel client = server.accept();
                    BufferedReader reader = new BufferedReader(
                            new InputStreamReader(Channels.newInputStream(client), StandardCharsets.US_ASCII));
                    BufferedWriter writer = new BufferedWriter(
                            new OutputStreamWriter(Channels.newOutputStream(client), StandardCharsets.US_ASCII))) {
                assertEquals("PG_OPEN_COMMITTED_BEFORE_LOCAL_REGISTER\t" + attemptId, reader.readLine());
                assertFalse(result.isDone(), "the committed candidate must remain provisional before release");
                writer.write("RELEASE\t" + attemptId);
                writer.newLine();
                writer.flush();
            }

            result.get(1, TimeUnit.SECONDS);
        } finally {
            Files.deleteIfExists(socketPath);
        }
    }

    @Test
    void acceptanceGateRejectsAReleaseForAnotherAttempt() throws Exception {
        Path socketPath = Path.of("/tmp", "tds-registration-gate-" + UUID.randomUUID() + ".sock");
        String attemptId = UUID.randomUUID().toString();
        try (ServerSocketChannel server = ServerSocketChannel.open(StandardProtocolFamily.UNIX)) {
            server.bind(UnixDomainSocketAddress.of(socketPath));
            var result = new SessionRegistrationGate(
                            socketPath.toString(), "backend-acceptance-test", "remote", identityScheduler)
                    .beforeRegistration(attemptId)
                    .toFuture();

            try (SocketChannel client = server.accept();
                    BufferedReader reader = new BufferedReader(
                            new InputStreamReader(Channels.newInputStream(client), StandardCharsets.US_ASCII));
                    BufferedWriter writer = new BufferedWriter(
                            new OutputStreamWriter(Channels.newOutputStream(client), StandardCharsets.US_ASCII))) {
                assertEquals("CREDENTIAL_VERIFICATION_RETURNED_BEFORE_REGISTER\t" + attemptId, reader.readLine());
                writer.write("RELEASE\t" + UUID.randomUUID());
                writer.newLine();
                writer.flush();
            }

            ExecutionException failure = assertThrows(ExecutionException.class, () -> result.get(1, TimeUnit.SECONDS));
            assertEquals(
                    "TDS_REGISTRATION_GATE_CONTROL_FAILED", failure.getCause().getMessage());
        } finally {
            Files.deleteIfExists(socketPath);
        }
    }

    @Test
    void acceptanceGateCannotBeEnabledOutsideManagedRemoteAcceptance() {
        IllegalArgumentException failure = assertThrows(
                IllegalArgumentException.class,
                () -> new SessionRegistrationGate("/tmp/registration-gate.sock", "", "local", identityScheduler));
        assertEquals("TDS_REGISTRATION_GATE_REQUIRES_MANAGED_REMOTE_ACCEPTANCE", failure.getMessage());
    }

    @Test
    void cancellationClosesAnAttemptWaitingForTheControlRelease() throws Exception {
        Path socketPath = Path.of("/tmp", "tds-registration-gate-" + UUID.randomUUID() + ".sock");
        String attemptId = UUID.randomUUID().toString();
        try (ServerSocketChannel server = ServerSocketChannel.open(StandardProtocolFamily.UNIX);
                var acceptor = Executors.newSingleThreadExecutor()) {
            server.bind(UnixDomainSocketAddress.of(socketPath));
            var accepted = acceptor.submit(server::accept);
            var subscription = new SessionRegistrationGate(
                            socketPath.toString(), "backend-acceptance-test", "remote", identityScheduler)
                    .beforeRegistration(attemptId)
                    .subscribe();

            try (SocketChannel client = accepted.get(1, TimeUnit.SECONDS);
                    BufferedReader reader = new BufferedReader(
                            new InputStreamReader(Channels.newInputStream(client), StandardCharsets.US_ASCII))) {
                assertEquals("CREDENTIAL_VERIFICATION_RETURNED_BEFORE_REGISTER\t" + attemptId, reader.readLine());
                subscription.dispose();
                assertEquals(-1, reader.read(), "cancellation must close the blocked control channel");
            } finally {
                subscription.dispose();
                Files.deleteIfExists(socketPath);
            }
        }
    }
}
