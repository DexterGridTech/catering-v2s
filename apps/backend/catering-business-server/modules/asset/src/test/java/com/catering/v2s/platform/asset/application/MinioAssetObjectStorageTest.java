package com.catering.v2s.platform.asset.application;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTimeout;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.SetBucketPolicyArgs;
import io.minio.StatObjectArgs;
import io.minio.errors.ErrorResponseException;
import io.minio.messages.ErrorResponse;
import okhttp3.Protocol;
import okhttp3.Request;
import okhttp3.Response;
import org.mockito.InOrder;
import org.junit.jupiter.api.Test;
import java.io.IOException;
import java.net.ServerSocket;
import java.net.Socket;
import java.time.Duration;
import java.nio.charset.StandardCharsets;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

class MinioAssetObjectStorageTest {
    @Test
    void blackholedConnectionMustFailFast() throws Exception {
        try (BlackholeEndpoint endpoint = BlackholeEndpoint.open()) {
            assertTimeout(Duration.ofMillis(5 * 250 + 1000), () -> {
                MinioAssetObjectStorage storage = new MinioAssetObjectStorage(
                    endpoint.url(), "access-key", "secret-key", "test-assets", "https://assets.test", "tenant/", Duration.ofMillis(250)
                );
                assertThrows(AssetObjectStorageUnavailableException.class,
                    () -> storage.exists("tenant/static/" + "a".repeat(64) + ".png"));
            });
        }
    }

    @Test
    void slowDripFailsByCallTimeoutEvenWhenEachReadStaysBelowSocketTimeout() throws Exception {
        try (SlowDripEndpoint endpoint = SlowDripEndpoint.open()) {
            assertTimeout(Duration.ofMillis(5 * 250 + 1000), () -> {
                MinioAssetObjectStorage storage = new MinioAssetObjectStorage(
                    endpoint.url(), "access-key", "secret-key", "test-assets", "https://assets.test", "tenant/", Duration.ofMillis(250)
                );
                assertThrows(AssetObjectStorageUnavailableException.class,
                    () -> storage.exists("tenant/static/" + "b".repeat(64) + ".png"));
            });
        }
    }

    @Test
    void productionClientUsesCallTimeoutInAdditionToSocketTimeouts() throws Exception {
        MinioAssetObjectStorage storage = new MinioAssetObjectStorage(
            "http://127.0.0.1:1", "access-key", "secret-key", "test-assets", "https://assets.test", "tenant/"
        );
        java.lang.reflect.Field clientField = MinioAssetObjectStorage.class.getDeclaredField("client");
        clientField.setAccessible(true);
        Object client = clientField.get(storage);
        java.lang.reflect.Field asyncClientField = findField(client.getClass(), "asyncClient");
        asyncClientField.setAccessible(true);
        Object asyncClient = asyncClientField.get(client);
        java.lang.reflect.Field httpClientField = findField(asyncClient.getClass(), "httpClient");
        httpClientField.setAccessible(true);
        okhttp3.OkHttpClient httpClient = (okhttp3.OkHttpClient) httpClientField.get(asyncClient);

        assertEquals(MinioAssetObjectStorage.DEFAULT_CONNECT_TIMEOUT.toMillis(), httpClient.connectTimeoutMillis());
        assertEquals(MinioAssetObjectStorage.DEFAULT_WRITE_TIMEOUT.toMillis(), httpClient.writeTimeoutMillis());
        assertEquals(MinioAssetObjectStorage.DEFAULT_READ_TIMEOUT.toMillis(), httpClient.readTimeoutMillis());
        assertEquals(MinioAssetObjectStorage.DEFAULT_CALL_TIMEOUT.toMillis(), httpClient.callTimeoutMillis());
    }

    private static java.lang.reflect.Field findField(Class<?> type, String name) throws NoSuchFieldException {
        for (Class<?> current = type; current != null; current = current.getSuperclass()) {
            try {
                return current.getDeclaredField(name);
            } catch (NoSuchFieldException ignored) {
                // Continue through the SDK's implementation hierarchy.
            }
        }
        throw new NoSuchFieldException(name);
    }

    @Test
    void onlyExplicitObjectNotFoundResponsesBecomeFalse() {
        assertTrue(MinioAssetObjectStorage.isObjectNotFound(error(404, "NoSuchKey")));
        assertTrue(MinioAssetObjectStorage.isObjectNotFound(error(404, "NoSuchObject")));
        assertFalse(MinioAssetObjectStorage.isObjectNotFound(error(404, "NoSuchBucket")));
        assertFalse(MinioAssetObjectStorage.isObjectNotFound(error(500, "InternalError")));
    }

    @Test
    void existsPropagatesEveryNonObjectNotFoundFailureAsUnavailable() {
        assertFalse(MinioAssetObjectStorage.existsWith(() -> { throw error(404, "NoSuchKey"); }));
        var noBucket = assertThrows(AssetObjectStorageUnavailableException.class, () -> MinioAssetObjectStorage.existsWith(() -> { throw error(404, "NoSuchBucket"); }));
        assertEquals("object.stat", noBucket.operation());
        assertEquals(404, noBucket.httpStatus());
        assertEquals("NoSuchBucket", noBucket.serviceErrorCode());
        var denied = assertThrows(AssetObjectStorageUnavailableException.class, () -> MinioAssetObjectStorage.existsWith(() -> { throw error(401, "AccessDenied"); }));
        assertEquals("object.stat", denied.operation());
        assertEquals(401, denied.httpStatus());
        assertEquals("AccessDenied", denied.serviceErrorCode());
        var internal = assertThrows(AssetObjectStorageUnavailableException.class, () -> MinioAssetObjectStorage.existsWith(() -> { throw error(500, "InternalError"); }));
        assertEquals("object.stat", internal.operation());
        assertEquals(500, internal.httpStatus());
        assertEquals("InternalError", internal.serviceErrorCode());
        var network = assertThrows(AssetObjectStorageUnavailableException.class, () -> MinioAssetObjectStorage.existsWith(() -> { throw new java.io.IOException("network"); }));
        assertEquals("object.stat", network.operation());
        assertEquals(null, network.httpStatus());
        assertEquals(null, network.serviceErrorCode());
    }

    @Test
    void existsPreparesBucketBeforeFirstObjectStat() throws Exception {
        MinioClient client = mock(MinioClient.class);
        org.mockito.Mockito.when(client.bucketExists(any(BucketExistsArgs.class))).thenReturn(false);
        org.mockito.Mockito.when(client.statObject(any(StatObjectArgs.class))).thenThrow(error(404, "NoSuchKey"));
        MinioAssetObjectStorage storage = new MinioAssetObjectStorage(client, "test-assets", "https://assets.test", "tenant/" );

        assertFalse(storage.exists("tenant/static/" + "a".repeat(64) + ".png"));

        InOrder order = inOrder(client);
        order.verify(client).bucketExists(any(BucketExistsArgs.class));
        order.verify(client).makeBucket(any(MakeBucketArgs.class));
        order.verify(client).setBucketPolicy(any(SetBucketPolicyArgs.class));
        order.verify(client).statObject(any(StatObjectArgs.class));
    }

    private static ErrorResponseException error(int status, String code) {
        Response response = new Response.Builder()
                .request(new Request.Builder().url("https://assets.test/bucket/object").build())
                .protocol(Protocol.HTTP_1_1).code(status).message("response").build();
        return new ErrorResponseException(new ErrorResponse(code, "message", "bucket", "object", "resource", "request", "host"), response, "trace");
    }

    private static final class BlackholeEndpoint implements AutoCloseable {
        private final ServerSocket server;
        private final ExecutorService executor = Executors.newSingleThreadExecutor();
        private volatile Socket accepted;

        private BlackholeEndpoint(ServerSocket server) {
            this.server = server;
            executor.submit(() -> {
                try {
                    accepted = server.accept();
                    Thread.sleep(Duration.ofSeconds(5));
                } catch (IOException | InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                }
            });
        }

        static BlackholeEndpoint open() throws IOException {
            return new BlackholeEndpoint(new ServerSocket(0));
        }

        String url() { return "http://127.0.0.1:" + server.getLocalPort(); }

        @Override public void close() throws IOException {
            Socket socket = accepted;
            if (socket != null) socket.close();
            server.close();
            executor.shutdownNow();
        }
    }

    private static final class SlowDripEndpoint implements AutoCloseable {
        private final ServerSocket server;
        private final ExecutorService executor = Executors.newSingleThreadExecutor();
        private volatile Socket accepted;

        private SlowDripEndpoint(ServerSocket server) {
            this.server = server;
            executor.submit(() -> {
                try {
                    accepted = server.accept();
                    OutputStream output = accepted.getOutputStream();
                    byte[] prefix = "HTTP/1.1 200 OK\r\nContent-Length: 1000\r\n\r\n".getBytes(StandardCharsets.US_ASCII);
                    for (byte value : prefix) {
                        output.write(value);
                        output.flush();
                        Thread.sleep(40);
                    }
                } catch (IOException | InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                }
            });
        }

        static SlowDripEndpoint open() throws IOException {
            return new SlowDripEndpoint(new ServerSocket(0));
        }

        String url() { return "http://127.0.0.1:" + server.getLocalPort(); }

        @Override public void close() throws IOException {
            Socket socket = accepted;
            if (socket != null) socket.close();
            server.close();
            executor.shutdownNow();
        }
    }
}
