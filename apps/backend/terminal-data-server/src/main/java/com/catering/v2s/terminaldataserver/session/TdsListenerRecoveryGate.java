package com.catering.v2s.terminaldataserver.session;

import java.io.IOException;
import java.net.StandardProtocolFamily;
import java.net.UnixDomainSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.SocketChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Objects;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Acceptance-only barriers for listener recovery and exact revocation-delivery timing. */
@Component
public final class TdsListenerRecoveryGate {
    public static final String CONTROL_SOCKET_PROPERTY = "v2s.tds.acceptance.listener-gate-socket";
    private static final int MAX_CONTROL_LINE_BYTES = 160;

    private final Path controlSocket;

    public TdsListenerRecoveryGate(
            @Value("${" + CONTROL_SOCKET_PROPERTY + ":}") String controlSocket,
            @Value("${V2S_BACKEND_ACCEPTANCE_RUN_ID:}") String acceptanceRunId,
            @Value("${V2S_TESTCONTAINERS_EXECUTION_PLANE:}") String executionPlane) {
        if (controlSocket != null
                && !controlSocket.isBlank()
                && ((acceptanceRunId == null || acceptanceRunId.isBlank()) || !"remote".equals(executionPlane))) {
            throw new IllegalArgumentException("TDS_LISTENER_RECOVERY_GATE_REQUIRES_MANAGED_REMOTE_ACCEPTANCE");
        }
        this.controlSocket = controlSocket == null || controlSocket.isBlank()
                ? null
                : Path.of(controlSocket).toAbsolutePath().normalize();
    }

    public void beforeReconnect(int backendPid) {
        if (controlSocket == null) return;
        if (backendPid < 1) throw new IllegalArgumentException("TDS_LISTENER_BACKEND_PID_INVALID");
        String attemptId = UUID.randomUUID().toString();
        try (SocketChannel channel = SocketChannel.open(StandardProtocolFamily.UNIX)) {
            channel.connect(UnixDomainSocketAddress.of(controlSocket));
            writeLine(channel, "LISTENER_DISCONNECTED\t" + backendPid + "\t" + attemptId);
            if (!("RELEASE\t" + attemptId).equals(readLine(channel))) {
                throw new IOException("TDS_LISTENER_RECOVERY_GATE_RELEASE_INVALID");
            }
        } catch (IOException failure) {
            throw new IllegalStateException("TDS_LISTENER_RECOVERY_GATE_CONTROL_FAILED", failure);
        }
    }

    public void beforeRevocationDispatch(UUID terminalRef, long revokedGeneration) {
        if (controlSocket == null) return;
        Objects.requireNonNull(terminalRef, "terminalRef");
        if (revokedGeneration < 1) throw new IllegalArgumentException("TDS_REVOKED_GENERATION_INVALID");
        String attemptId = UUID.randomUUID().toString();
        try (SocketChannel channel = SocketChannel.open(StandardProtocolFamily.UNIX)) {
            channel.connect(UnixDomainSocketAddress.of(controlSocket));
            writeLine(channel, "REVOCATION_RECEIVED\t" + terminalRef + "\t" + revokedGeneration + "\t" + attemptId);
            if (!("RELEASE\t" + attemptId).equals(readLine(channel))) {
                throw new IOException("TDS_LISTENER_REVOCATION_GATE_RELEASE_INVALID");
            }
        } catch (IOException failure) {
            throw new IllegalStateException("TDS_LISTENER_REVOCATION_GATE_CONTROL_FAILED", failure);
        }
    }

    private static void writeLine(SocketChannel channel, String value) throws IOException {
        ByteBuffer bytes = StandardCharsets.US_ASCII.encode(value + "\n");
        if (bytes.remaining() > MAX_CONTROL_LINE_BYTES) {
            throw new IOException("TDS_LISTENER_RECOVERY_GATE_CONTROL_LINE_TOO_LONG");
        }
        while (bytes.hasRemaining()) channel.write(bytes);
    }

    private static String readLine(SocketChannel channel) throws IOException {
        ByteBuffer bytes = ByteBuffer.allocate(MAX_CONTROL_LINE_BYTES);
        while (true) {
            int read = channel.read(bytes);
            if (read < 0) throw new IOException("TDS_LISTENER_RECOVERY_GATE_CONTROL_EOF");
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
                throw new IOException("TDS_LISTENER_RECOVERY_GATE_CONTROL_LINE_TOO_LONG");
            }
        }
    }
}
