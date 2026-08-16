package com.catering.v2s.platform.asset.application;

import java.io.InputStream;

/**
 * The platform-asset owner is the only business layer allowed to move static display bytes. Database tables retain
 * metadata only; this port deliberately has no business-owner dependency.
 */
public interface AssetObjectStorage {
    String bucketName();

    String objectKey(String suffix);

    boolean ownsObjectKey(String objectKey);

    void put(String objectKey, String contentType, long sizeBytes, InputStream bytes);

    boolean exists(String objectKey);

    String publicUrl(String objectKey);

    void delete(String objectKey);
}
