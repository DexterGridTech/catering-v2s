package com.catering.v2s.app.acceptance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.net.StandardProtocolFamily;
import java.net.UnixDomainSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.SocketChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class TdsRegistrationGateBrokerTest {
    private static final UUID TERMINAL_REF = UUID.fromString("95e948ef-2fe6-4b18-b6d5-509d023ea249");

    @TempDir
    Path directory;

    @Test
    void unarmedRegistrationAttemptIsReleasedWithoutAHold() throws Exception {
        String attemptId = UUID.randomUUID().toString();
        try (TdsRegistrationGateBroker broker = TdsRegistrationGateBroker.start(directory)) {
            assertEquals("RELEASE\t" + attemptId, request(broker.socketPath(), attemptId));
        }
    }

    @Test
    void armedAttemptWaitsForTheExactObservedAttemptBeforeRelease() throws Exception {
        String attemptId = UUID.randomUUID().toString();
        try (TdsRegistrationGateBroker broker = TdsRegistrationGateBroker.start(directory)) {
            TdsRegistrationGateBroker.ArmedAttempt armed = broker.armNextAttempt();
            CompletableFuture<String> response = CompletableFuture.supplyAsync(() -> {
                try {
                    return request(broker.socketPath(), attemptId);
                } catch (IOException failure) {
                    throw new IllegalStateException(failure);
                }
            });

            assertEquals(attemptId, armed.awaitObserved(Duration.ofSeconds(2)));
            assertFalse(response.isDone(), "gate must hold before exact attempt release");
            armed.release(attemptId);
            assertEquals("RELEASE\t" + attemptId, response.get(2, TimeUnit.SECONDS));
        }
    }

    @Test
    void armedPostgresOpenGateWaitsUntilTheExactCommittedCandidateIsReleased() throws Exception {
        String attemptId = UUID.randomUUID().toString();
        try (TdsRegistrationGateBroker broker = TdsRegistrationGateBroker.start(directory)) {
            TdsRegistrationGateBroker.ArmedAttempt armed = broker.armNextPostgresOpen();
            CompletableFuture<String> response = CompletableFuture.supplyAsync(() -> {
                try {
                    return requestPostgresOpen(broker.socketPath(), attemptId);
                } catch (IOException failure) {
                    throw new IllegalStateException(failure);
                }
            });

            assertEquals(attemptId, armed.awaitObserved(Duration.ofSeconds(2)));
            assertFalse(response.isDone(), "the PG-open candidate must remain held before local registration");
            armed.release(attemptId);
            assertEquals("RELEASE\t" + attemptId, response.get(2, TimeUnit.SECONDS));
        }
    }

    @Test
    void clientExitBeforeTheRegistrationGateIsReportedImmediately() throws Exception {
        try (TdsRegistrationGateBroker broker = TdsRegistrationGateBroker.start(directory)) {
            TdsRegistrationGateBroker.ArmedAttempt armed = broker.armNextAttempt();
            CompletableFuture<?> clientExit = CompletableFuture.completedFuture("CLIENT_EXITED");

            IllegalStateException failure = assertThrows(
                    IllegalStateException.class, () -> armed.awaitObserved(Duration.ofSeconds(2), clientExit));

            assertEquals("TDS_REGISTRATION_GATE_CLIENT_EXITED_BEFORE_OBSERVED", failure.getMessage());
        }
    }

    @Test
    void anUnobservedRegistrationGateReportsItsOwnDeadlineWithoutChangingIt() throws Exception {
        try (TdsRegistrationGateBroker broker = TdsRegistrationGateBroker.start(directory)) {
            TdsRegistrationGateBroker.ArmedAttempt armed = broker.armNextAttempt();

            IllegalStateException failure = assertThrows(
                    IllegalStateException.class,
                    () -> armed.awaitObserved(Duration.ofMillis(10), new CompletableFuture<>()));

            assertEquals("TDS_REGISTRATION_GATE_OBSERVATION_DEADLINE_EXCEEDED", failure.getMessage());
        }
    }

    @Test
    void unarmedRevocationObservationIsReleasedWithoutAHold() throws Exception {
        String attemptId = UUID.randomUUID().toString();
        try (TdsRegistrationGateBroker broker = TdsRegistrationGateBroker.start(directory)) {
            assertEquals("RELEASE\t" + attemptId, requestRevocation(broker.socketPath(), TERMINAL_REF, 2, attemptId));
        }
    }

    @Test
    void armedRevocationGateHoldsOnlyTheExactTerminalAndGeneration() throws Exception {
        String attemptId = UUID.randomUUID().toString();
        try (TdsRegistrationGateBroker broker = TdsRegistrationGateBroker.start(directory)) {
            TdsRegistrationGateBroker.ArmedAttempt armed = broker.armNextListenerRevocation(TERMINAL_REF, 2);

            assertEquals(
                    "RELEASE\t" + attemptId,
                    requestRevocation(
                            broker.socketPath(),
                            UUID.fromString("835ed5a6-bef6-4e06-8478-6f740734e30c"),
                            2,
                            attemptId));
            assertEquals("RELEASE\t" + attemptId, requestRevocation(broker.socketPath(), TERMINAL_REF, 3, attemptId));

            CompletableFuture<String> response = CompletableFuture.supplyAsync(() -> {
                try {
                    return requestRevocation(broker.socketPath(), TERMINAL_REF, 2, attemptId);
                } catch (IOException failure) {
                    throw new IllegalStateException(failure);
                }
            });

            assertEquals(attemptId, armed.awaitObserved(Duration.ofSeconds(2)));
            assertFalse(response.isDone(), "only the exact revoked generation is held before actor dispatch");
            armed.release(attemptId);
            assertEquals("RELEASE\t" + attemptId, response.get(2, TimeUnit.SECONDS));
        }
    }

    @Test
    void closingBrokerUnblocksHeldAttemptAndRemovesRunOwnedSocket() throws Exception {
        String attemptId = UUID.randomUUID().toString();
        try (TdsRegistrationGateBroker broker = TdsRegistrationGateBroker.start(directory)) {
            TdsRegistrationGateBroker.ArmedAttempt armed = broker.armNextAttempt();
            CompletableFuture<String> response = CompletableFuture.supplyAsync(() -> {
                try {
                    return request(broker.socketPath(), attemptId);
                } catch (IOException failure) {
                    throw new IllegalStateException(failure);
                }
            });
            assertEquals(attemptId, armed.awaitObserved(Duration.ofSeconds(2)));
            Path socketPath = broker.socketPath();

            broker.close();

            assertThrows(ExecutionException.class, () -> response.get(2, TimeUnit.SECONDS));
            assertFalse(Files.exists(socketPath), "run-owned UDS must be removed during cleanup");
            assertTrue(Files.isDirectory(directory));
        }
    }

    private static String request(Path socketPath, String attemptId) throws IOException {
        return requestLine(socketPath, "CREDENTIAL_VERIFICATION_RETURNED_BEFORE_REGISTER\t" + attemptId + "\n");
    }

    private static String requestPostgresOpen(Path socketPath, String attemptId) throws IOException {
        return requestLine(socketPath, "PG_OPEN_COMMITTED_BEFORE_LOCAL_REGISTER\t" + attemptId + "\n");
    }

    private static String requestRevocation(Path socketPath, UUID terminalRef, long generation, String attemptId)
            throws IOException {
        return requestLine(
                socketPath, "REVOCATION_RECEIVED\t" + terminalRef + "\t" + generation + "\t" + attemptId + "\n");
    }

    private static String requestLine(Path socketPath, String line) throws IOException {
        try (SocketChannel client = SocketChannel.open(StandardProtocolFamily.UNIX)) {
            client.connect(UnixDomainSocketAddress.of(socketPath));
            ByteBuffer request = StandardCharsets.US_ASCII.encode(line);
            while (request.hasRemaining()) client.write(request);
            ByteBuffer response = ByteBuffer.allocate(128);
            while (client.read(response) >= 0) {
                for (int index = response.position() - 1; index >= 0; index--) {
                    if (response.get(index) == '\n') {
                        response.flip();
                        response.limit(index);
                        return StandardCharsets.US_ASCII.decode(response).toString();
                    }
                }
            }
            throw new IOException("TDS_REGISTRATION_GATE_RESPONSE_EOF");
        }
    }
}
