package com.catering.v2s.app.acceptance;

import java.io.IOException;
import java.net.StandardProtocolFamily;
import java.net.UnixDomainSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.ServerSocketChannel;
import java.nio.channels.SocketChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.time.Duration;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.regex.Pattern;

/** Run-owned UDS broker for deterministic registration and PostgreSQL listener timing controls. */
final class TdsRegistrationGateBroker implements AutoCloseable {
    private static final int MAX_LINE_BYTES = 128;
    private static final Pattern ATTEMPT_ID =
            Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    private static final Pattern TERMINAL_REF =
            Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");

    private final Path socketPath;
    private final ServerSocketChannel server;
    private final Set<SocketChannel> clients = ConcurrentHashMap.newKeySet();
    private final Object attemptLock = new Object();
    private ArmedAttempt armed;
    private ArmedAttempt held;
    private ArmedAttempt armedListenerRecovery;
    private ArmedAttempt heldListenerRecovery;
    private ArmedAttempt armedListenerRevocation;
    private ArmedAttempt heldListenerRevocation;
    private final Thread acceptThread;
    private volatile boolean closed;

    private TdsRegistrationGateBroker(Path socketPath, ServerSocketChannel server) throws IOException {
        this.socketPath = socketPath;
        this.server = server;
        acceptThread = new Thread(this::acceptLoop, "backend-acceptance-tds-registration-gate");
        acceptThread.setDaemon(true);
        acceptThread.start();
    }

    static TdsRegistrationGateBroker start(Path directory) throws IOException {
        Path socketPath =
                directory.resolve("registration-gate.sock").toAbsolutePath().normalize();
        if (Files.exists(socketPath)) throw new IllegalStateException("TDS_REGISTRATION_GATE_SOCKET_ALREADY_EXISTS");
        ServerSocketChannel server = ServerSocketChannel.open(StandardProtocolFamily.UNIX);
        try {
            server.bind(UnixDomainSocketAddress.of(socketPath));
            Files.setPosixFilePermissions(
                    socketPath, EnumSet.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE));
            return new TdsRegistrationGateBroker(socketPath, server);
        } catch (Exception failure) {
            server.close();
            Files.deleteIfExists(socketPath);
            throw failure;
        }
    }

    Path socketPath() {
        return socketPath;
    }

    ArmedAttempt armNextAttempt() {
        ArmedAttempt next = new ArmedAttempt();
        synchronized (attemptLock) {
            if (armed != null || held != null) {
                throw new IllegalStateException("TDS_REGISTRATION_GATE_ALREADY_ARMED");
            }
            armed = next;
            return next;
        }
    }

    ArmedAttempt armNextListenerRecovery() {
        ArmedAttempt next = new ArmedAttempt();
        synchronized (attemptLock) {
            if (armedListenerRecovery != null || heldListenerRecovery != null) {
                throw new IllegalStateException("TDS_LISTENER_RECOVERY_GATE_ALREADY_ARMED");
            }
            armedListenerRecovery = next;
            return next;
        }
    }

    ArmedAttempt armNextListenerRevocation(UUID terminalRef, long generation) {
        if (terminalRef == null || generation < 1) {
            throw new IllegalArgumentException("TDS_LISTENER_REVOCATION_GATE_TARGET_INVALID");
        }
        ArmedAttempt next = new ArmedAttempt(terminalRef.toString(), Long.toString(generation));
        synchronized (attemptLock) {
            if (armedListenerRevocation != null || heldListenerRevocation != null) {
                throw new IllegalStateException("TDS_LISTENER_REVOCATION_GATE_ALREADY_ARMED");
            }
            armedListenerRevocation = next;
            return next;
        }
    }

    void cancel(ArmedAttempt attempt) {
        synchronized (attemptLock) {
            IllegalStateException cancelled = new IllegalStateException("GATE_ATTEMPT_CANCELLED");
            if (armed == attempt) {
                armed = null;
                attempt.release.completeExceptionally(cancelled);
            }
            if (held == attempt) attempt.release.completeExceptionally(cancelled);
            if (armedListenerRecovery == attempt) {
                armedListenerRecovery = null;
                attempt.release.completeExceptionally(cancelled);
            }
            if (heldListenerRecovery == attempt) attempt.release.completeExceptionally(cancelled);
            if (armedListenerRevocation == attempt) {
                armedListenerRevocation = null;
                attempt.release.completeExceptionally(cancelled);
            }
            if (heldListenerRevocation == attempt) attempt.release.completeExceptionally(cancelled);
        }
    }

    private void acceptLoop() {
        while (!closed) {
            try {
                SocketChannel client = server.accept();
                if (client == null) continue;
                clients.add(client);
                Thread handler = new Thread(() -> handle(client), "backend-acceptance-tds-registration-gate-client");
                handler.setDaemon(true);
                handler.start();
            } catch (IOException failure) {
                if (!closed) System.out.println("BACKEND_ACCEPTANCE_REGISTRATION_GATE=FAIL");
                return;
            }
        }
    }

    private void handle(SocketChannel client) {
        try (client) {
            String request = readLine(client);
            String[] fields = request.split("\\t", -1);
            boolean registration =
                    fields.length == 2 && "CREDENTIAL_VERIFICATION_RETURNED_BEFORE_REGISTER".equals(fields[0]);
            boolean listenerRecovery = fields.length == 3
                    && "LISTENER_DISCONNECTED".equals(fields[0])
                    && fields[1].matches("[1-9][0-9]{0,9}");
            boolean listenerRevocation = fields.length == 4
                    && "REVOCATION_RECEIVED".equals(fields[0])
                    && TERMINAL_REF.matcher(fields[1]).matches()
                    && positiveLong(fields[2]);
            String attemptId = fields.length == 0 ? "" : fields[fields.length - 1];
            if ((!registration && !listenerRecovery && !listenerRevocation)
                    || !ATTEMPT_ID.matcher(attemptId).matches()) {
                throw new IOException("TDS_REGISTRATION_GATE_REQUEST_INVALID");
            }
            ArmedAttempt hold = registration
                    ? claimNextAttempt()
                    : listenerRecovery
                            ? claimNextListenerRecovery()
                            : claimNextListenerRevocation(fields[1], fields[2]);
            if (hold != null) {
                hold.claim(attemptId);
                try {
                    CompletableFuture<Boolean> disconnected = watchDisconnect(client);
                    String released = hold.awaitRelease(disconnected);
                    if (released == null) return;
                    if (!attemptId.equals(released)) {
                        throw new IOException("TDS_REGISTRATION_GATE_RELEASE_INVALID");
                    }
                    if (!disconnected.isDone()) {
                        try {
                            writeLine(client, "RELEASE\t" + attemptId);
                        } catch (IOException closedByTdsAfterRelease) {
                            if (!disconnected.isDone()) throw closedByTdsAfterRelease;
                        }
                    }
                } finally {
                    clearHeldAttempt(hold);
                }
                return;
            }
            writeLine(client, "RELEASE\t" + attemptId);
        } catch (Exception failure) {
            if (!closed) System.out.println("BACKEND_ACCEPTANCE_REGISTRATION_GATE=FAIL");
        } finally {
            clients.remove(client);
        }
    }

    private ArmedAttempt claimNextAttempt() {
        synchronized (attemptLock) {
            ArmedAttempt next = armed;
            armed = null;
            held = next;
            return next;
        }
    }

    private ArmedAttempt claimNextListenerRecovery() {
        synchronized (attemptLock) {
            ArmedAttempt next = armedListenerRecovery;
            armedListenerRecovery = null;
            heldListenerRecovery = next;
            return next;
        }
    }

    private ArmedAttempt claimNextListenerRevocation(String terminalRef, String generation) {
        synchronized (attemptLock) {
            ArmedAttempt next = armedListenerRevocation;
            if (next == null || !next.matchesRevocation(terminalRef, generation)) return null;
            armedListenerRevocation = null;
            heldListenerRevocation = next;
            return next;
        }
    }

    private void clearHeldAttempt(ArmedAttempt attempt) {
        synchronized (attemptLock) {
            if (held == attempt) held = null;
            if (heldListenerRecovery == attempt) heldListenerRecovery = null;
            if (heldListenerRevocation == attempt) heldListenerRevocation = null;
        }
    }

    private static CompletableFuture<Boolean> watchDisconnect(SocketChannel client) {
        CompletableFuture<Boolean> disconnected = new CompletableFuture<>();
        Thread watcher = new Thread(
                () -> {
                    try {
                        ByteBuffer unexpected = ByteBuffer.allocate(1);
                        int read = client.read(unexpected);
                        if (read < 0) disconnected.complete(true);
                        else disconnected.completeExceptionally(new IOException("TDS_REGISTRATION_GATE_EXTRA_INPUT"));
                    } catch (IOException closed) {
                        disconnected.complete(true);
                    }
                },
                "backend-acceptance-tds-registration-gate-disconnect");
        watcher.setDaemon(true);
        watcher.start();
        return disconnected;
    }

    private static String readLine(SocketChannel channel) throws IOException {
        ByteBuffer buffer = ByteBuffer.allocate(MAX_LINE_BYTES);
        while (true) {
            int read = channel.read(buffer);
            if (read < 0) throw new IOException("TDS_REGISTRATION_GATE_CONTROL_EOF");
            for (int index = buffer.position() - read; index < buffer.position(); index++) {
                if (buffer.get(index) == '\n') {
                    buffer.flip();
                    buffer.limit(index + 1);
                    byte[] line = new byte[buffer.remaining() - 1];
                    buffer.get(line);
                    return new String(line, StandardCharsets.US_ASCII);
                }
            }
            if (!buffer.hasRemaining()) throw new IOException("TDS_REGISTRATION_GATE_CONTROL_LINE_TOO_LONG");
        }
    }

    private static void writeLine(SocketChannel channel, String line) throws IOException {
        ByteBuffer bytes = StandardCharsets.US_ASCII.encode(line + "\n");
        if (bytes.remaining() > MAX_LINE_BYTES) throw new IOException("TDS_REGISTRATION_GATE_CONTROL_LINE_TOO_LONG");
        while (bytes.hasRemaining()) channel.write(bytes);
    }

    @Override
    public void close() throws Exception {
        if (closed) return;
        closed = true;
        synchronized (attemptLock) {
            IllegalStateException closedFailure = new IllegalStateException("GATE_CLOSED");
            if (armed != null) armed.release.completeExceptionally(closedFailure);
            if (held != null) held.release.completeExceptionally(closedFailure);
            if (armedListenerRecovery != null) armedListenerRecovery.release.completeExceptionally(closedFailure);
            if (heldListenerRecovery != null) heldListenerRecovery.release.completeExceptionally(closedFailure);
            if (armedListenerRevocation != null) armedListenerRevocation.release.completeExceptionally(closedFailure);
            if (heldListenerRevocation != null) heldListenerRevocation.release.completeExceptionally(closedFailure);
            armed = null;
            held = null;
            armedListenerRecovery = null;
            heldListenerRecovery = null;
            armedListenerRevocation = null;
            heldListenerRevocation = null;
        }
        for (SocketChannel client : clients) client.close();
        server.close();
        acceptThread.join(Duration.ofSeconds(2).toMillis());
        Files.deleteIfExists(socketPath);
    }

    private static boolean positiveLong(String value) {
        if (value == null || !value.matches("[1-9][0-9]{0,18}")) return false;
        try {
            return Long.parseLong(value) > 0;
        } catch (NumberFormatException invalid) {
            return false;
        }
    }

    static final class ArmedAttempt {
        private final CompletableFuture<String> observed = new CompletableFuture<>();
        private final CompletableFuture<String> release = new CompletableFuture<>();
        private final String expectedTerminalRef;
        private final String expectedGeneration;

        private ArmedAttempt() {
            this(null, null);
        }

        private ArmedAttempt(String expectedTerminalRef, String expectedGeneration) {
            this.expectedTerminalRef = expectedTerminalRef;
            this.expectedGeneration = expectedGeneration;
        }

        private boolean matchesRevocation(String terminalRef, String generation) {
            return expectedTerminalRef != null
                    && expectedTerminalRef.equals(terminalRef)
                    && expectedGeneration.equals(generation);
        }

        private void claim(String attemptId) {
            observed.complete(attemptId);
        }

        String awaitObserved(Duration timeout) throws Exception {
            return observed.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
        }

        String awaitObserved(Duration timeout, CompletableFuture<?> competingCompletion) throws Exception {
            try {
                Object completion = CompletableFuture.anyOf(observed, competingCompletion)
                        .get(timeout.toMillis(), TimeUnit.MILLISECONDS);
                if (completion instanceof String attemptId) return attemptId;
                throw new IllegalStateException("TDS_REGISTRATION_GATE_CLIENT_EXITED_BEFORE_OBSERVED");
            } catch (TimeoutException expired) {
                throw new IllegalStateException("TDS_REGISTRATION_GATE_OBSERVATION_DEADLINE_EXCEEDED", expired);
            }
        }

        private String awaitRelease(CompletableFuture<Boolean> disconnected) throws Exception {
            try {
                CompletableFuture.anyOf(release, disconnected)
                        .get(Duration.ofSeconds(14).toMillis(), TimeUnit.MILLISECONDS);
                if (disconnected.isCompletedExceptionally()) {
                    throw new IOException("TDS_REGISTRATION_GATE_EXTRA_INPUT");
                }
                if (disconnected.isDone()) return null;
                return release.getNow(null);
            } catch (TimeoutException expired) {
                throw new IOException("TDS_REGISTRATION_GATE_RELEASE_DEADLINE_EXCEEDED", expired);
            }
        }

        void release(String attemptId) {
            if (!observed.isDone() || observed.isCompletedExceptionally()) {
                throw new IllegalStateException("TDS_REGISTRATION_GATE_ATTEMPT_NOT_OBSERVED");
            }
            if (!attemptId.equals(observed.getNow(null))) {
                throw new IllegalArgumentException("TDS_REGISTRATION_GATE_ATTEMPT_ID_MISMATCH");
            }
            if (!release.complete(attemptId))
                throw new IllegalStateException("TDS_REGISTRATION_GATE_RELEASE_DUPLICATE");
        }
    }
}
