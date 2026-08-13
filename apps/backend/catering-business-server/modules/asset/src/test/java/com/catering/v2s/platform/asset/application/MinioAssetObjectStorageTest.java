package com.catering.v2s.platform.asset.application;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
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

class MinioAssetObjectStorageTest {
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
}
