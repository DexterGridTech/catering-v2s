package com.catering.v2s.platform.asset.api;

import java.io.InputStream;

/** Private bucket port; it exposes no public URL or anonymous-read operation. */
public interface TerminalUpdatePrivateObjectStorage {
    String privateBucketName();

    String privateObjectKey(String sha256);

    boolean privateExists(String objectKey);

    boolean ownsPrivateObjectKey(String objectKey);

    void putPrivate(String objectKey, long sizeBytes, InputStream bytes);

    InputStream openPrivate(String objectKey);

    void deletePrivate(String objectKey);
}
