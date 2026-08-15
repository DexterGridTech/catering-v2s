package com.catering.v2s.platform.asset.application;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.SetBucketPolicyArgs;
import io.minio.StatObjectArgs;
import io.minio.errors.ErrorResponseException;
import java.io.InputStream;
import java.net.URI;
import java.time.Duration;
import okhttp3.OkHttpClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** S3-compatible object adapter; callers receive public URLs but never manufacture them. */
@Component
final class MinioAssetObjectStorage implements AssetObjectStorage {
    static final Duration DEFAULT_CONNECT_TIMEOUT = Duration.ofSeconds(10);
    static final Duration DEFAULT_WRITE_TIMEOUT = Duration.ofSeconds(30);
    static final Duration DEFAULT_READ_TIMEOUT = Duration.ofSeconds(30);
    static final Duration DEFAULT_CALL_TIMEOUT = Duration.ofSeconds(60);
    private final MinioClient client;
    private final String bucket;
    private final String publicBaseUrl;
    private final String objectPrefix;
    private boolean bucketPrepared;

    @Autowired
    MinioAssetObjectStorage(
        @Value("${catering.asset.object-storage.endpoint}") String endpoint,
        @Value("${catering.asset.object-storage.access-key}") String accessKey,
        @Value("${catering.asset.object-storage.secret-key}") String secretKey,
        @Value("${catering.asset.object-storage.bucket}") String bucket,
        @Value("${catering.asset.public-base-url}") String publicBaseUrl,
        @Value("${catering.asset.object-storage.object-prefix}") String objectPrefix
    ) {
        this(endpoint, accessKey, secretKey, bucket, publicBaseUrl, objectPrefix, DEFAULT_CALL_TIMEOUT);
    }

    MinioAssetObjectStorage(
        String endpoint,
        String accessKey,
        String secretKey,
        String bucket,
        String publicBaseUrl,
        String objectPrefix,
        Duration callTimeout
    ) {
        this(boundedClient(endpoint, accessKey, secretKey, callTimeout), bucket, publicBaseUrl, objectPrefix);
    }

    MinioAssetObjectStorage(MinioClient client, String bucket, String publicBaseUrl, String objectPrefix) {
        this.client = client;
        this.bucket = requiredBucket(bucket);
        this.publicBaseUrl = normalizeBase(publicBaseUrl);
        this.objectPrefix = requiredPrefix(objectPrefix);
    }

    private static MinioClient boundedClient(String endpoint, String accessKey, String secretKey, Duration callTimeout) {
        if (callTimeout == null || callTimeout.isZero() || callTimeout.isNegative()) throw new IllegalArgumentException("asset object storage call timeout must be positive");
        OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(DEFAULT_CONNECT_TIMEOUT)
            .writeTimeout(DEFAULT_WRITE_TIMEOUT)
            .readTimeout(DEFAULT_READ_TIMEOUT)
            .callTimeout(callTimeout)
            .build();
        return MinioClient.builder().endpoint(endpoint).credentials(accessKey, secretKey).httpClient(httpClient).build();
    }

    private synchronized void ensureBucket() {
        if (bucketPrepared) return;
        try {
            if (!client.bucketExists(BucketExistsArgs.builder().bucket(this.bucket).build())) {
                client.makeBucket(MakeBucketArgs.builder().bucket(this.bucket).build());
            }
            client.setBucketPolicy(SetBucketPolicyArgs.builder().bucket(this.bucket).config(publicDownloadPolicy(this.bucket)).build());
            bucketPrepared = true;
        } catch (Exception failure) {
            throw unavailable("bucket.prepare", failure);
        }
    }

    @Override public String bucketName() { return bucket; }
    @Override public String objectKey(String suffix) {
        if (suffix == null || !suffix.matches("static/[a-f0-9]{64}(?:\\.[a-z0-9]{2,5})?")) throw new IllegalArgumentException("invalid asset object suffix");
        return objectPrefix + suffix;
    }
    @Override public boolean ownsObjectKey(String value) {
        return value != null && value.startsWith(objectPrefix) && value.substring(objectPrefix.length()).matches("static/[a-f0-9]{64}(?:\\.[a-z0-9]{2,5})?");
    }

    @Override public void put(String objectKey, String contentType, long sizeBytes, InputStream bytes) {
        try {
            ensureBucket();
            client.putObject(PutObjectArgs.builder().bucket(bucket).object(validKey(objectKey)).contentType(contentType).stream(bytes, sizeBytes, -1).build());
        } catch (Exception failure) { throw unavailable("object.put", failure); }
    }

    @Override public boolean exists(String objectKey) {
        // The first stage attempt probes content-addressed storage before it uploads.  Bucket
        // readiness therefore belongs to the common stat path, not only to put; otherwise a
        // fresh runtime turns a missing bucket into a generic upload failure before put can create it.
        ensureBucket();
        return existsWith(() -> client.statObject(StatObjectArgs.builder().bucket(bucket).object(validKey(objectKey)).build()));
    }

    static boolean existsWith(StatLookup lookup) {
        try { lookup.stat(); return true; }
        catch (ErrorResponseException failure) {
            if (isObjectNotFound(failure)) return false;
            throw unavailable("object.stat", failure);
        } catch (Exception failure) { throw unavailable("object.stat", failure); }
    }

    static boolean isObjectNotFound(ErrorResponseException failure) {
        if (failure == null || failure.response() == null || failure.response().code() != 404 || failure.errorResponse() == null) return false;
        return java.util.Set.of("NoSuchKey", "NoSuchObject", "NoSuchVersion").contains(failure.errorResponse().code());
    }

    @FunctionalInterface
    interface StatLookup { void stat() throws Exception; }

    @Override public String publicUrl(String objectKey) { return publicBaseUrl + "/" + bucket + "/" + validKey(objectKey); }

    @Override public void delete(String objectKey) {
        try { client.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(validKey(objectKey)).build()); }
        catch (Exception failure) { throw unavailable("object.delete", failure); }
    }

    private static String requiredBucket(String value) {
        if (value == null || !value.matches("[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]")) throw new IllegalArgumentException("invalid asset object bucket");
        return value;
    }
    private static String normalizeBase(String value) {
        try {
            URI uri = URI.create(value);
            if (!"http".equals(uri.getScheme()) && !"https".equals(uri.getScheme())) throw new IllegalArgumentException();
            return value.replaceAll("/+$", "");
        } catch (Exception failure) { throw new IllegalArgumentException("invalid asset public base URL", failure); }
    }
    private static String requiredPrefix(String value) {
        if (value == null || !value.matches("[a-z0-9][a-z0-9._/-]{2,255}/") || value.contains("//") || value.contains("..")) throw new IllegalArgumentException("invalid asset object prefix");
        return value;
    }
    private static String publicDownloadPolicy(String bucket) {
        return "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"AWS\":[\"*\"]},\"Action\":[\"s3:GetObject\"],\"Resource\":[\"arn:aws:s3:::" + bucket + "/*\"]}]}";
    }
    private String validKey(String value) {
        if (value == null || !value.startsWith(objectPrefix) || !value.substring(objectPrefix.length()).matches("static/[a-f0-9]{64}(?:\\.[a-z0-9]{2,5})?")) throw new IllegalArgumentException("invalid asset object key");
        return value;
    }
    private static AssetObjectStorageUnavailableException unavailable(String operation, Throwable failure) {
        if (failure instanceof AssetObjectStorageUnavailableException existing) return existing;
        if (failure instanceof ErrorResponseException responseFailure) {
            Integer status = responseFailure.response() == null ? null : responseFailure.response().code();
            String serviceCode = responseFailure.errorResponse() == null ? null : responseFailure.errorResponse().code();
            return new AssetObjectStorageUnavailableException(operation, failure, status, serviceCode);
        }
        return new AssetObjectStorageUnavailableException(operation, failure);
    }
}
