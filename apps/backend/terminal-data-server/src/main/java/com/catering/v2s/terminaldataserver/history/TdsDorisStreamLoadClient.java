package com.catering.v2s.terminaldataserver.history;

import com.catering.v2s.terminaldataserver.config.TdsDorisProperties;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.Flow;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Synchronous Doris Stream Load client; callers must use the dedicated history writer thread. */
@Component
public final class TdsDorisStreamLoadClient {
    static final Duration CONNECT_TIMEOUT = Duration.ofMillis(500);
    static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);
    static final int MAX_RESPONSE_BYTES = 16 * 1024;
    private static final String COLUMNS =
            "event_id,event_time_epoch_millis,event_type,workspace_uuid,terminal_ref,node_id,session_id,"
                    + "session_sequence,rtt_ms,close_reason";

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final Duration requestTimeout;
    private final URI loadUri;
    private final String authorization;

    @Autowired
    public TdsDorisStreamLoadClient(
            TdsDorisProperties properties,
            @org.springframework.beans.factory.annotation.Qualifier("tds-wire-object-mapper")
                    ObjectMapper objectMapper) {
        this(
                properties,
                objectMapper,
                HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build(),
                REQUEST_TIMEOUT);
    }

    TdsDorisStreamLoadClient(
            TdsDorisProperties properties, ObjectMapper objectMapper, HttpClient httpClient, Duration requestTimeout) {
        this.objectMapper = objectMapper;
        this.httpClient = httpClient;
        this.requestTimeout = requestTimeout;
        String endpoint = properties.endpoint().endsWith("/")
                ? properties.endpoint().substring(0, properties.endpoint().length() - 1)
                : properties.endpoint();
        this.loadUri =
                URI.create(endpoint + "/api/" + properties.database() + "/" + properties.table() + "/_stream_load");
        this.authorization = basicAuthorization(properties);
    }

    private static String basicAuthorization(TdsDorisProperties properties) {
        String credentials = properties.username() + ":" + properties.password();
        return "Basic " + Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
    }

    public LoadResult load(String label, byte[] payload) {
        HttpRequest request = HttpRequest.newBuilder(loadUri)
                .timeout(requestTimeout)
                .expectContinue(true)
                .header("Authorization", authorization)
                .header("label", label)
                .header("format", "json")
                .header("read_json_by_line", "true")
                .header("columns", COLUMNS)
                .header("max_filter_ratio", "0")
                .header("Content-Type", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofByteArray(payload))
                .build();
        try {
            HttpResponse<byte[]> response = httpClient.send(request, TdsDorisStreamLoadClient::boundedBody);
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return response.statusCode() >= 500 || response.statusCode() == 429
                        ? LoadResult.retry("HTTP_" + response.statusCode())
                        : LoadResult.failed("HTTP_" + response.statusCode());
            }
            return interpret(response.body());
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            return LoadResult.retry("INTERRUPTED");
        } catch (IOException | RuntimeException failure) {
            return LoadResult.retry(failureCategory(failure));
        }
    }

    private static String failureCategory(Throwable failure) {
        for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
            if (cause instanceof BoundedResponseException) return "RESPONSE_LIMIT_EXCEEDED";
        }
        if (failure instanceof java.net.http.HttpTimeoutException) return "REQUEST_TIMEOUT";
        return failure.getClass().getSimpleName().toUpperCase(Locale.ROOT);
    }

    private LoadResult interpret(byte[] responseBody) {
        try {
            JsonNode response = objectMapper.readTree(responseBody);
            String status = response.path("Status").asString("");
            if ("Success".equals(status) || "Publish Timeout".equals(status)) return LoadResult.complete(status);
            if ("Label Already Exists".equals(status)) {
                String existingStatus = response.path("ExistingJobStatus").asString("");
                if ("FINISHED".equals(existingStatus)) return LoadResult.complete("LABEL_ALREADY_FINISHED");
                return LoadResult.retry("LABEL_" + safeStatus(existingStatus));
            }
            if ("Fail".equals(status)) return LoadResult.failed("DORIS_LOAD_FAILED");
            return LoadResult.retry("DORIS_STATUS_UNKNOWN");
        } catch (RuntimeException failure) {
            return LoadResult.retry("DORIS_RESPONSE_INVALID");
        }
    }

    private static String safeStatus(String status) {
        return status.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9_]+", "_");
    }

    static HttpResponse.BodySubscriber<byte[]> boundedBody(HttpResponse.ResponseInfo ignored) {
        return new BoundedResponseSubscriber(MAX_RESPONSE_BYTES);
    }

    private static final class BoundedResponseSubscriber implements HttpResponse.BodySubscriber<byte[]> {
        private final int maximumBytes;
        private final ByteArrayOutputStream bytes;
        private final CompletableFuture<byte[]> body = new CompletableFuture<>();
        private final AtomicReference<Flow.Subscription> subscription = new AtomicReference<>();

        private BoundedResponseSubscriber(int maximumBytes) {
            this.maximumBytes = maximumBytes;
            this.bytes = new ByteArrayOutputStream(Math.min(maximumBytes, 1024));
        }

        @Override
        public CompletionStage<byte[]> getBody() {
            return body;
        }

        @Override
        public void onSubscribe(Flow.Subscription candidate) {
            if (!subscription.compareAndSet(null, candidate)) {
                candidate.cancel();
                return;
            }
            candidate.request(1);
        }

        @Override
        public void onNext(List<ByteBuffer> buffers) {
            for (ByteBuffer buffer : buffers) {
                int count = buffer.remaining();
                if (bytes.size() + count > maximumBytes) {
                    Flow.Subscription active = subscription.get();
                    if (active != null) active.cancel();
                    body.completeExceptionally(new BoundedResponseException());
                    return;
                }
                byte[] chunk = new byte[count];
                buffer.get(chunk);
                bytes.writeBytes(chunk);
            }
            Flow.Subscription active = subscription.get();
            if (active != null) active.request(1);
        }

        @Override
        public void onError(Throwable failure) {
            body.completeExceptionally(failure);
        }

        @Override
        public void onComplete() {
            body.complete(bytes.toByteArray());
        }
    }

    private static final class BoundedResponseException extends IOException {
        private BoundedResponseException() {
            super("DORIS_RESPONSE_LIMIT_EXCEEDED");
        }
    }

    public enum Disposition {
        COMPLETE,
        RETRY,
        FAILED
    }

    public record LoadResult(Disposition disposition, String reason) {
        static LoadResult complete(String reason) {
            return new LoadResult(Disposition.COMPLETE, reason);
        }

        static LoadResult retry(String reason) {
            return new LoadResult(Disposition.RETRY, reason);
        }

        static LoadResult failed(String reason) {
            return new LoadResult(Disposition.FAILED, reason);
        }
    }
}
