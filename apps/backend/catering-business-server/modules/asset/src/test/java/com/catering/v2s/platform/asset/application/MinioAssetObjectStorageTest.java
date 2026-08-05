package com.catering.v2s.platform.asset.application;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.minio.errors.ErrorResponseException;
import io.minio.messages.ErrorResponse;
import okhttp3.Protocol;
import okhttp3.Request;
import okhttp3.Response;
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
        assertThrows(MinioAssetObjectStorage.AssetObjectStorageUnavailableException.class, () -> MinioAssetObjectStorage.existsWith(() -> { throw error(404, "NoSuchBucket"); }));
        assertThrows(MinioAssetObjectStorage.AssetObjectStorageUnavailableException.class, () -> MinioAssetObjectStorage.existsWith(() -> { throw error(401, "AccessDenied"); }));
        assertThrows(MinioAssetObjectStorage.AssetObjectStorageUnavailableException.class, () -> MinioAssetObjectStorage.existsWith(() -> { throw error(500, "InternalError"); }));
        assertThrows(MinioAssetObjectStorage.AssetObjectStorageUnavailableException.class, () -> MinioAssetObjectStorage.existsWith(() -> { throw new java.io.IOException("network"); }));
    }

    private static ErrorResponseException error(int status, String code) {
        Response response = new Response.Builder()
                .request(new Request.Builder().url("https://assets.test/bucket/object").build())
                .protocol(Protocol.HTTP_1_1).code(status).message("response").build();
        return new ErrorResponseException(new ErrorResponse(code, "message", "bucket", "object", "resource", "request", "host"), response, "trace");
    }
}
