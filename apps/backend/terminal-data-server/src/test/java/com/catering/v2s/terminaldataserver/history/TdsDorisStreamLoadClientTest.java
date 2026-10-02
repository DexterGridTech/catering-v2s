package com.catering.v2s.terminaldataserver.history;

import static org.assertj.core.api.Assertions.assertThat;

import com.catering.v2s.terminaldataserver.config.TdsDorisProperties;
import com.catering.v2s.terminaldataserver.protocol.TdsWireJsonConfiguration;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.Flow;
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

    private TdsDorisStreamLoadClient client(Duration requestTimeout) {
        return new TdsDorisStreamLoadClient(
                new TdsDorisProperties(
                        "http://127.0.0.1:" + server.getAddress().getPort(),
                        "terminal_connection_history",
                        "connection_history",
                        "tds",
                        "tds-test-secret"),
                mapper(),
                HttpClient.newBuilder().connectTimeout(Duration.ofMillis(100)).build(),
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
