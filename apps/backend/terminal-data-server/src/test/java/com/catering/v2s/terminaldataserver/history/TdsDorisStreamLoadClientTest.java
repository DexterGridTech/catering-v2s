package com.catering.v2s.terminaldataserver.history;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.terminaldataserver.config.TdsDorisProperties;
import com.catering.v2s.terminaldataserver.protocol.TdsWireJsonConfiguration;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CompletionException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Flow;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class TdsDorisStreamLoadClientTest {
    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    void streamsLabeledJsonLinesDirectlyToTheConfiguredBackendEndpoint() throws Exception {
        AtomicReference<String> path = new AtomicReference<>();
        AtomicReference<String> method = new AtomicReference<>();
        AtomicReference<String> authorization = new AtomicReference<>();
        AtomicReference<String> label = new AtomicReference<>();
        AtomicReference<String> format = new AtomicReference<>();
        AtomicReference<String> payload = new AtomicReference<>();
        startServer(exchange -> {
            path.set(exchange.getRequestURI().getPath());
            method.set(exchange.getRequestMethod());
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            label.set(exchange.getRequestHeaders().getFirst("label"));
            format.set(exchange.getRequestHeaders().getFirst("format"));
            payload.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            respond(exchange, 200, "{\"Status\":\"Success\"}");
        });
        TdsDorisStreamLoadClient client = client(Duration.ofSeconds(2));

        TdsDorisStreamLoadClient.LoadResult result =
                client.load("batch-1", "{\"event_id\":\"x\"}".getBytes(StandardCharsets.UTF_8));

        assertThat(result.disposition()).isEqualTo(TdsDorisStreamLoadClient.Disposition.COMPLETE);
        assertThat(method.get()).isEqualTo("PUT");
        assertThat(path.get()).isEqualTo("/api/terminal_connection_history/connection_history/_stream_load");
        assertThat(authorization.get()).startsWith("Basic ");
        assertThat(authorization.get()).doesNotContain("tds-test-secret");
        assertThat(label.get()).isEqualTo("batch-1");
        assertThat(format.get()).isEqualTo("json");
        assertThat(payload.get()).isEqualTo("{\"event_id\":\"x\"}");
    }

    @Test
    void treatsPublishTimeoutAndFinishedDuplicateAsCompletedButRetriesRunningLabel() throws Exception {
        AtomicReference<String> response = new AtomicReference<>();
        startServer(exchange -> respond(exchange, 200, response.get()));
        TdsDorisStreamLoadClient client = client(Duration.ofSeconds(2));
        byte[] body = "{}".getBytes(StandardCharsets.UTF_8);

        response.set("{\"Status\":\"Publish Timeout\"}");
        assertThat(client.load("label-1", body).disposition()).isEqualTo(TdsDorisStreamLoadClient.Disposition.COMPLETE);
        response.set("{\"Status\":\"Label Already Exists\",\"ExistingJobStatus\":\"FINISHED\"}");
        assertThat(client.load("label-2", body).disposition()).isEqualTo(TdsDorisStreamLoadClient.Disposition.COMPLETE);
        response.set("{\"Status\":\"Label Already Exists\",\"ExistingJobStatus\":\"RUNNING\"}");
        assertThat(client.load("label-3", body).disposition()).isEqualTo(TdsDorisStreamLoadClient.Disposition.RETRY);
    }

    @Test
    void enforcesTheRequestDeadlineAndBoundsResponseAllocation() throws Exception {
        startServer(exchange -> {
            try {
                Thread.sleep(500);
                respond(exchange, 200, "{\"Status\":\"Success\"}");
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
            }
        });
        TdsDorisStreamLoadClient client = client(Duration.ofMillis(100));

        assertThat(client.load("slow-label", new byte[] {'{', '}'}).reason()).isEqualTo("REQUEST_TIMEOUT");

        HttpResponseStub response = new HttpResponseStub();
        var subscriber = TdsDorisStreamLoadClient.boundedBody(response);
        subscriber.onSubscribe(new Flow.Subscription() {
            @Override
            public void request(long n) {}

            @Override
            public void cancel() {
                response.cancelled = true;
            }
        });
        subscriber.onNext(List.of(ByteBuffer.wrap(new byte[TdsDorisStreamLoadClient.MAX_RESPONSE_BYTES + 1])));
        assertThat(response.cancelled).isTrue();
        assertThat(subscriber.getBody().toCompletableFuture()).isCompletedExceptionally();
    }

    @Test
    void requestDeadlineCancelsAStalledResponseBodyAndAllowsTheNextBatch() throws Exception {
        CountDownLatch bodyStarted = new CountDownLatch(1);
        CountDownLatch releaseBody = new CountDownLatch(1);
        CountDownLatch firstHandlerFinished = new CountDownLatch(1);
        AtomicLong bodyStartedNanos = new AtomicLong();
        AtomicReference<java.util.concurrent.CompletableFuture<?>> responseFuture = new AtomicReference<>();
        AtomicInteger requests = new AtomicInteger();
        startServer(exchange -> {
            if (requests.incrementAndGet() > 1) {
                respond(exchange, 200, "{\"Status\":\"Success\"}");
                return;
            }
            try {
                exchange.sendResponseHeaders(200, 64);
                exchange.getResponseBody().write("{".getBytes(StandardCharsets.UTF_8));
                exchange.getResponseBody().flush();
                bodyStartedNanos.set(System.nanoTime());
                bodyStarted.countDown();
                releaseBody.await(3, TimeUnit.SECONDS);
            } catch (IOException failure) {
                throw new IllegalStateException("test response setup failed", failure);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
            } finally {
                exchange.close();
                firstHandlerFinished.countDown();
            }
        });
        HttpClient delegate =
                HttpClient.newBuilder().connectTimeout(Duration.ofMillis(100)).build();
        HttpClient httpClient = mock(HttpClient.class);
        when(httpClient.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenAnswer(invocation -> {
                    HttpRequest request = invocation.getArgument(0);
                    @SuppressWarnings("unchecked")
                    HttpResponse.BodyHandler<byte[]> handler = invocation.getArgument(1);
                    java.util.concurrent.CompletableFuture<HttpResponse<byte[]>> future =
                            delegate.sendAsync(request, handler);
                    responseFuture.set(future);
                    return future;
                });
        TdsDorisStreamLoadClient client = client(Duration.ofMillis(500), httpClient);
        ExecutorService caller = Executors.newSingleThreadExecutor();
        try {
            long loadStartedNanos = System.nanoTime();
            Future<TdsDorisStreamLoadClient.LoadResult> firstBatch =
                    caller.submit(() -> client.load("stalled-body-label", new byte[] {'{', '}'}));
            assertThat(bodyStarted.await(2, TimeUnit.SECONDS)).isTrue();

            TdsDorisStreamLoadClient.LoadResult timedOut = firstBatch.get(2, TimeUnit.SECONDS);
            long returnedNanos = System.nanoTime();
            assertThat(timedOut.disposition()).isEqualTo(TdsDorisStreamLoadClient.Disposition.RETRY);
            assertThat(timedOut.reason()).isEqualTo("REQUEST_TIMEOUT");
            assertThat(returnedNanos - bodyStartedNanos.get())
                    .isGreaterThanOrEqualTo(TimeUnit.MILLISECONDS.toNanos(300));
            assertThat(returnedNanos - loadStartedNanos).isLessThan(TimeUnit.SECONDS.toNanos(2));
            java.util.concurrent.CompletableFuture<?> cancelledResponse = responseFuture.get();
            assertThat(cancelledResponse.isCompletedExceptionally()).isTrue();
            assertThatThrownBy(cancelledResponse::join)
                    .isInstanceOf(CompletionException.class)
                    .hasCauseInstanceOf(CancellationException.class)
                    .hasRootCauseMessage("Request cancelled");

            releaseBody.countDown();
            assertThat(firstHandlerFinished.await(2, TimeUnit.SECONDS)).isTrue();
            TdsDorisStreamLoadClient.LoadResult nextBatch = client.load("next-batch-label", new byte[] {'{', '}'});
            assertThat(nextBatch.disposition()).isEqualTo(TdsDorisStreamLoadClient.Disposition.COMPLETE);
            assertThat(requests.get()).isEqualTo(2);
        } finally {
            releaseBody.countDown();
            caller.shutdownNow();
            assertThat(caller.awaitTermination(2, TimeUnit.SECONDS)).isTrue();
        }
    }

    private TdsDorisStreamLoadClient client(Duration requestTimeout) {
        return client(
                requestTimeout,
                HttpClient.newBuilder().connectTimeout(Duration.ofMillis(100)).build());
    }

    private TdsDorisStreamLoadClient client(Duration requestTimeout, HttpClient httpClient) {
        return new TdsDorisStreamLoadClient(
                new TdsDorisProperties(
                        "http://127.0.0.1:" + server.getAddress().getPort(),
                        "terminal_connection_history",
                        "connection_history",
                        "tds",
                        "tds-test-secret"),
                mapper(),
                httpClient,
                requestTimeout);
    }

    private void startServer(com.sun.net.httpserver.HttpHandler handler) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", handler);
        server.start();
    }

    private static void respond(com.sun.net.httpserver.HttpExchange exchange, int status, String body)
            throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private static ObjectMapper mapper() {
        return TdsWireJsonConfiguration.createWireObjectMapper();
    }

    private static final class HttpResponseStub implements java.net.http.HttpResponse.ResponseInfo {
        private boolean cancelled;

        @Override
        public int statusCode() {
            return 200;
        }

        @Override
        public java.net.http.HttpHeaders headers() {
            return java.net.http.HttpHeaders.of(java.util.Map.of(), (a, b) -> true);
        }

        @Override
        public java.net.http.HttpClient.Version version() {
            return java.net.http.HttpClient.Version.HTTP_1_1;
        }
    }
}
