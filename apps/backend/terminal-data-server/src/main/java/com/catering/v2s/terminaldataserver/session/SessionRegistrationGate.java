package com.catering.v2s.terminaldataserver.session;

import java.io.IOException;
import java.net.StandardProtocolFamily;
import java.net.UnixDomainSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.SocketChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import reactor.core.Disposable;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Scheduler;

/** Production timing seam between a real credential result and per-terminal registration. */
@Component
public final class SessionRegistrationGate {
    public static final String CONTROL_SOCKET_PROPERTY = "v2s.tds.acceptance.registration-gate-socket";
    public static final String BEFORE_REGISTER_STAGE = "CREDENTIAL_VERIFICATION_RETURNED_BEFORE_REGISTER";
    public static final String AFTER_POSTGRES_OPEN_STAGE = "PG_OPEN_COMMITTED_BEFORE_LOCAL_REGISTER";
    private static final int MAX_CONTROL_LINE_BYTES = 128;

    private final Path controlSocket;
    private final Scheduler identityScheduler;

    public SessionRegistrationGate(
            @Value("${" + CONTROL_SOCKET_PROPERTY + ":}") String controlSocket,
            @Value("${V2S_BACKEND_ACCEPTANCE_RUN_ID:}") String acceptanceRunId,
            @Value("${V2S_TESTCONTAINERS_EXECUTION_PLANE:}") String executionPlane,
            @Qualifier("tds-identity-worker") Scheduler identityScheduler) {
        if (controlSocket != null
                && !controlSocket.isBlank()
                && ((acceptanceRunId == null || acceptanceRunId.isBlank()) || !"remote".equals(executionPlane))) {
            throw new IllegalArgumentException("TDS_REGISTRATION_GATE_REQUIRES_MANAGED_REMOTE_ACCEPTANCE");
        }
        this.controlSocket = controlSocket == null || controlSocket.isBlank()
                ? null
                : Path.of(controlSocket).toAbsolutePath().normalize();
        this.identityScheduler = Objects.requireNonNull(identityScheduler, "identityScheduler");
    }

    public Mono<Void> beforeRegistration(String attemptId) {
        return awaitControl(BEFORE_REGISTER_STAGE, attemptId);
    }

    /** Acceptance-only barrier after the PG open transaction commits and before local install. */
    public Mono<Void> afterPostgresOpen(String attemptId) {
        return awaitControl(AFTER_POSTGRES_OPEN_STAGE, attemptId);
    }

    private Mono<Void> awaitControl(String stage, String attemptId) {
        if (controlSocket == null) return Mono.empty();
        if (attemptId == null || !attemptId.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")) {
            return Mono.error(new IllegalArgumentException("TDS_REGISTRATION_GATE_ATTEMPT_ID_INVALID"));
        }

        return Mono.create(sink -> {
            AtomicBoolean cancelled = new AtomicBoolean();
            AtomicReference<SocketChannel> activeChannel = new AtomicReference<>();
            AtomicReference<Disposable> activeTask = new AtomicReference<>();
            sink.onCancel(() -> {
                cancelled.set(true);
                SocketChannel channel = activeChannel.getAndSet(null);
                if (channel != null) {
                    try {
                        channel.close();
                    } catch (IOException ignored) {
                        // Cancellation is already the terminal signal for this gate attempt.
                    }
                }
                Disposable task = activeTask.getAndSet(null);
                if (task != null) task.dispose();
            });

            Disposable task = identityScheduler.schedule(() -> {
                try (SocketChannel channel = SocketChannel.open(StandardProtocolFamily.UNIX)) {
                    activeChannel.set(channel);
                    if (cancelled.get()) return;
                    channel.connect(UnixDomainSocketAddress.of(controlSocket));
                    if (cancelled.get()) return;
                    writeLine(channel, stage + "\t" + attemptId);
                    String response = readLine(channel);
                    if (!("RELEASE\t" + attemptId).equals(response)) {
                        throw new IOException("TDS_REGISTRATION_GATE_RELEASE_INVALID");
                    }
                    if (!cancelled.get()) sink.success();
                } catch (Exception failure) {
                    if (!cancelled.get()) {
                        sink.error(new IllegalStateException("TDS_REGISTRATION_GATE_CONTROL_FAILED", failure));
                    }
                } finally {
                    activeChannel.set(null);
                }
            });
            activeTask.set(task);
            if (cancelled.get()) task.dispose();
        });
    }

    private static void writeLine(SocketChannel channel, String value) throws IOException {
        ByteBuffer bytes = StandardCharsets.US_ASCII.encode(value + "\n");
        if (bytes.remaining() > MAX_CONTROL_LINE_BYTES) {
            throw new IOException("TDS_REGISTRATION_GATE_CONTROL_LINE_TOO_LONG");
        }
        while (bytes.hasRemaining()) channel.write(bytes);
    }

    private static String readLine(SocketChannel channel) throws IOException {
        ByteBuffer bytes = ByteBuffer.allocate(MAX_CONTROL_LINE_BYTES);
        while (true) {
            int read = channel.read(bytes);
            if (read < 0) throw new IOException("TDS_REGISTRATION_GATE_CONTROL_EOF");
            if (read == 0) continue;
            for (int index = bytes.position() - read; index < bytes.position(); index++) {
                if (bytes.get(index) == '\n') {
                    bytes.flip();
                    bytes.limit(index + 1);
                    byte[] line = new byte[bytes.remaining() - 1];
                    bytes.get(line);
                    return new String(line, StandardCharsets.US_ASCII);
                }
            }
            if (!bytes.hasRemaining()) {
                throw new IOException("TDS_REGISTRATION_GATE_CONTROL_LINE_TOO_LONG");
            }
        }
    }
}
