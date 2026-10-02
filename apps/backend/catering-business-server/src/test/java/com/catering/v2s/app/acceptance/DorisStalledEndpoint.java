package com.catering.v2s.app.acceptance;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Acceptance-only Doris endpoint that holds one Stream Load response past the TDS request timeout. */
final class DorisStalledEndpoint implements AutoCloseable {
    private static final int MAX_HEADER_BYTES = 64 * 1024;
    private static final Pattern EVENT_TYPE = Pattern.compile("\"event_type\"\\s*:\\s*\"([A-Z_]+)\"");
    private static final Set<String> CONNECTION_EVENT_TYPES = Set.of("CONNECTED", "HEARTBEAT_RTT", "DISCONNECTED");
    private final String runId;
    private final ServerSocket server;
    private final CountDownLatch firstRequest = new CountDownLatch(1);
    private final CountDownLatch allowResponse = new CountDownLatch(1);
    private final AtomicInteger requestCount = new AtomicInteger();
    private final AtomicInteger payloadRows = new AtomicInteger();
    private final AtomicInteger malformedPayloadRows = new AtomicInteger();
    private final Set<String> observedEventTypes = ConcurrentHashMap.newKeySet();
    private final AtomicReference<Throwable> failure = new AtomicReference<>();
    private volatile long firstRequestStartedNanos;
    private final Thread acceptThread;
    private volatile Socket activeSocket;
    private volatile boolean closed;

    static DorisStalledEndpoint start(String runId) throws IOException {
        return new DorisStalledEndpoint(runId);
    }

    private DorisStalledEndpoint(String runId) throws IOException {
        if (runId == null || !runId.matches("[A-Za-z0-9-]{8,64}")) {
            throw new IllegalArgumentException("BACKEND_ACCEPTANCE_DORIS_STALL_RUN_ID_INVALID");
        }
        this.runId = runId;
        server = new ServerSocket(0, 8, InetAddress.getByName("127.0.0.1"));
        acceptThread = new Thread(this::acceptLoop, "backend-acceptance-doris-stalled-endpoint");
        acceptThread.setDaemon(true);
        acceptThread.start();
        System.out.printf(
                "BACKEND_ACCEPTANCE_DORIS_STALL stage=LISTENING runId=%s host=127.0.0.1 port=%d%n",
                runId, server.getLocalPort());
    }

    String endpoint() {
        return "http://127.0.0.1:" + server.getLocalPort();
    }

    int awaitFirstRequest() throws InterruptedException {
        if (!firstRequest.await(15, TimeUnit.SECONDS)) {
            Throwable observed = failure.get();
            throw new IllegalStateException("BACKEND_ACCEPTANCE_DORIS_STALL_REQUEST_NOT_RECEIVED"
                    + (observed == null ? "" : " cause=" + observed.getClass().getSimpleName()));
        }
        return requestCount.get();
    }

    int requestCount() {
        return requestCount.get();
    }

    long elapsedMillisSinceFirstRequest() {
        long started = firstRequestStartedNanos;
        return started == 0 ? 0 : TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);
    }

    void releaseResponse() {
        allowResponse.countDown();
    }

    Throwable failure() {
        return failure.get();
    }

    void assertOnlyConnectionHistoryEvents() {
        Set<String> actualTypes = Set.copyOf(observedEventTypes);
        if (payloadRows.get() == 0
                || malformedPayloadRows.get() != 0
                || !CONNECTION_EVENT_TYPES.containsAll(actualTypes)) {
            throw new IllegalStateException("BACKEND_ACCEPTANCE_DORIS_STALL_NON_CONNECTION_EVENT_OBSERVED");
        }
        System.out.printf(
                "BACKEND_ACCEPTANCE_DORIS_STALL stage=PAYLOAD_AUDIT runId=%s rows=%d malformed=%d "
                        + "eventTypes=%s businessBindingEvents=0 result=PASS%n",
                runId,
                payloadRows.get(),
                malformedPayloadRows.get(),
                actualTypes.stream().sorted().toList());
    }

    private void acceptLoop() {
        while (!closed) {
            try (Socket socket = server.accept()) {
                activeSocket = socket;
                socket.setSoTimeout(15_000);
                Request request = readRequest(socket);
                int count = requestCount.incrementAndGet();
                payloadRows.addAndGet(request.payloadRows());
                malformedPayloadRows.addAndGet(request.malformedRows());
                observedEventTypes.addAll(request.eventTypes());
                if (count == 1) firstRequestStartedNanos = System.nanoTime();
                firstRequest.countDown();
                System.out.printf(
                        "BACKEND_ACCEPTANCE_DORIS_STALL stage=REQUEST runId=%s count=%d path=%s payloadBytes=%d%n",
                        runId, count, request.path(), request.payloadBytes());
                if (count == 1) allowResponse.await(60, TimeUnit.SECONDS);
                try {
                    respondUnavailable(socket.getOutputStream());
                } catch (IOException peerClosedAfterTimeout) {
                    System.out.printf(
                            "BACKEND_ACCEPTANCE_DORIS_STALL stage=PEER_CLOSED runId=%s count=%d%n", runId, count);
                }
            } catch (SocketException closedSocket) {
                if (!closed) recordFailure(closedSocket);
            } catch (Exception unexpected) {
                if (!closed) recordFailure(unexpected);
            } finally {
                activeSocket = null;
            }
        }
    }

    private static Request readRequest(Socket socket) throws IOException {
        InputStream input = socket.getInputStream();
        byte[] headerBytes = readHeaders(input);
        String headers = new String(headerBytes, StandardCharsets.US_ASCII);
        String firstLine = headers.lines().findFirst().orElse("");
        String[] requestLine = firstLine.split(" ", 3);
        if (requestLine.length != 3 || !"PUT".equals(requestLine[0])) {
            throw new IOException("BACKEND_ACCEPTANCE_DORIS_STALL_REQUEST_LINE_INVALID");
        }
        long contentLength = -1;
        boolean expectContinue = false;
        for (String line : headers.lines().skip(1).toList()) {
            int separator = line.indexOf(':');
            if (separator <= 0) continue;
            String name = line.substring(0, separator).trim().toLowerCase(Locale.ROOT);
            String value = line.substring(separator + 1).trim();
            if ("content-length".equals(name)) contentLength = Long.parseLong(value);
            if ("expect".equals(name) && "100-continue".equalsIgnoreCase(value)) expectContinue = true;
        }
        if (!requestLine[1].matches("/api/terminal_connection_history/connection_history/_stream_load")
                || contentLength < 0
                || contentLength > 128 * 1024) {
            throw new IOException("BACKEND_ACCEPTANCE_DORIS_STALL_REQUEST_SHAPE_INVALID");
        }
        if (expectContinue) {
            socket.getOutputStream().write("HTTP/1.1 100 Continue\r\n\r\n".getBytes(StandardCharsets.US_ASCII));
            socket.getOutputStream().flush();
        }
        long remaining = contentLength;
        ByteArrayOutputStream payload = new ByteArrayOutputStream((int) contentLength);
        byte[] buffer = new byte[8192];
        while (remaining > 0) {
            int read = input.read(buffer, 0, (int) Math.min(buffer.length, remaining));
            if (read < 0) throw new IOException("BACKEND_ACCEPTANCE_DORIS_STALL_BODY_TRUNCATED");
            payload.write(buffer, 0, read);
            remaining -= read;
        }
        Set<String> eventTypes = ConcurrentHashMap.newKeySet();
        int rows = 0;
        int malformedRows = 0;
        for (String line : payload.toString(StandardCharsets.UTF_8).split("\\R")) {
            if (line.isBlank()) continue;
            rows++;
            Matcher eventType = EVENT_TYPE.matcher(line);
            if (!eventType.find()) {
                malformedRows++;
                continue;
            }
            eventTypes.add(eventType.group(1));
            if (eventType.find()) malformedRows++;
        }
        return new Request(requestLine[1], contentLength, Set.copyOf(eventTypes), rows, malformedRows);
    }

    private static byte[] readHeaders(InputStream input) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        int matched = 0;
        byte[] terminator = {'\r', '\n', '\r', '\n'};
        while (bytes.size() < MAX_HEADER_BYTES) {
            int value = input.read();
            if (value < 0) throw new IOException("BACKEND_ACCEPTANCE_DORIS_STALL_HEADERS_TRUNCATED");
            bytes.write(value);
            if (value == terminator[matched]) {
                matched++;
                if (matched == terminator.length) return bytes.toByteArray();
            } else {
                matched = value == terminator[0] ? 1 : 0;
            }
        }
        throw new IOException("BACKEND_ACCEPTANCE_DORIS_STALL_HEADERS_TOO_LARGE");
    }

    private static void respondUnavailable(OutputStream output) throws IOException {
        output.write(("HTTP/1.1 503 Service Unavailable\r\n" + "Content-Length: 0\r\nConnection: close\r\n\r\n")
                .getBytes(StandardCharsets.US_ASCII));
        output.flush();
    }

    private void recordFailure(Throwable unexpected) {
        failure.compareAndSet(null, unexpected);
        System.out.printf(
                "BACKEND_ACCEPTANCE_DORIS_STALL stage=FAIL runId=%s failureType=%s%n",
                runId, unexpected.getClass().getSimpleName());
    }

    @Override
    public void close() throws Exception {
        if (closed) return;
        closed = true;
        allowResponse.countDown();
        server.close();
        Socket socket = activeSocket;
        if (socket != null) socket.close();
        acceptThread.join(3_000);
        if (acceptThread.isAlive()) throw new IllegalStateException("BACKEND_ACCEPTANCE_DORIS_STALL_CLEANUP_TIMEOUT");
        Throwable workerFailure = failure.get();
        if (workerFailure != null) {
            throw new IllegalStateException("BACKEND_ACCEPTANCE_DORIS_STALL_CLEANUP_FAILED", workerFailure);
        }
        System.out.printf(
                "BACKEND_ACCEPTANCE_DORIS_STALL stage=CLEANUP runId=%s result=PASS requests=%d%n",
                runId, requestCount.get());
    }

    private record Request(
            String path, long payloadBytes, Set<String> eventTypes, int payloadRows, int malformedRows) {}
}
