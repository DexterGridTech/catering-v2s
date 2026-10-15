package com.catering.v2s.platform.asset.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.platform.asset.api.TerminalUpdatePrivateObjectStorage;
import com.catering.v2s.platform.asset.application.persistence.PlatformAssetPersistence;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;

/** Focused public-wrapper checks that do not start PostgreSQL or Testcontainers. */
class PlatformAssetServiceMaterializationTest {
    private static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024;
    private static final UUID WORKSPACE_UUID = UUID.fromString("6a6bf584-7448-4fc5-9f4b-020ea8f72d10");
    private static final String WORKSPACE_KEY = "asset-materialization-test";

    @Test
    void imageReadFailureClosesSourceAndRemovesItsTemporaryFile() throws Exception {
        assertReadFailure(UploadKind.IMAGE);
    }

    @Test
    void packageReadFailureClosesSourceAndRemovesItsTemporaryFile() throws Exception {
        assertReadFailure(UploadKind.PACKAGE);
    }

    @Test
    void imageStorageFailureClosesSourceAndRemovesItsTemporaryFile() throws Exception {
        assertStorageFailure(UploadKind.IMAGE);
    }

    @Test
    void packageStorageFailureClosesSourceAndRemovesItsTemporaryFile() throws Exception {
        assertStorageFailure(UploadKind.PACKAGE);
    }

    @Test
    void imageMetadataFailureClosesSourceRemovesItsTemporaryFileAndDeletesOnlyUploadedObject() throws Exception {
        assertMetadataFailure(UploadKind.IMAGE);
    }

    @Test
    void packageMetadataFailureClosesSourceRemovesItsTemporaryFileAndDeletesOnlyUploadedObject() throws Exception {
        assertMetadataFailure(UploadKind.PACKAGE);
    }

    @Test
    void imageActualReadLimitRejectsBytesBeyondDeclaredAndMaximumSize() throws Exception {
        Fixture fixture = fixture();
        Set<Path> before = temporaryAssetUploads();
        GeneratedInputStream source = new GeneratedInputStream(MAX_IMAGE_BYTES + 1);

        assertThrows(
                PlatformAssetService.AssetInputInvalidException.class,
                () -> stage(fixture, UploadKind.IMAGE, source, MAX_IMAGE_BYTES, null));

        assertTrue(source.closed, "over-limit read must close the caller-owned stream");
        assertEquals(before, temporaryAssetUploads(), "over-limit image materialization must be removed");
    }

    private static void assertReadFailure(UploadKind kind) throws Exception {
        Fixture fixture = fixture();
        Set<Path> before = temporaryAssetUploads();
        IOException original =
                new IOException("fixture-read-failure-" + kind.name().toLowerCase());
        TrackingInputStream source = new TrackingInputStream(original);

        PlatformAssetService.AssetStorageUnavailableException failure = assertThrows(
                PlatformAssetService.AssetStorageUnavailableException.class,
                () -> stage(fixture, kind, source, 4, kind == UploadKind.PACKAGE ? sha256(zip()) : null));

        assertSame(original, rootCause(failure));
        assertTrue(source.closed, "failed read must close the caller-owned stream");
        assertEquals(before, temporaryAssetUploads(), "failed materialization must be removed");
    }

    private static void assertStorageFailure(UploadKind kind) throws Exception {
        Fixture fixture = fixture();
        Set<Path> before = temporaryAssetUploads();
        byte[] bytes = content(kind);
        TrackingInputStream source = new TrackingInputStream(bytes);
        IllegalStateException original = new IllegalStateException("fixture-storage-failure-" + kind.name());
        AssetObjectStorageUnavailableException storageFailure = new AssetObjectStorageUnavailableException(
                kind == UploadKind.PACKAGE ? "private-object.stat" : "object.stat", original);
        if (kind == UploadKind.PACKAGE) {
            when(fixture.privateObjects.privateExists(anyString())).thenThrow(storageFailure);
        } else {
            when(fixture.objects.exists(anyString())).thenThrow(storageFailure);
        }

        PlatformAssetService.AssetStorageUnavailableException failure = assertThrows(
                PlatformAssetService.AssetStorageUnavailableException.class,
                () -> stage(fixture, kind, source, bytes.length, kind == UploadKind.PACKAGE ? sha256(bytes) : null));

        assertSame(original, rootCause(failure));
        assertTrue(source.closed, "failed storage request must follow a closed source stream");
        assertEquals(before, temporaryAssetUploads(), "storage failure must not retain its materialized upload");
    }

    private static void assertMetadataFailure(UploadKind kind) throws Exception {
        Fixture fixture = fixture();
        Set<Path> before = temporaryAssetUploads();
        byte[] bytes = content(kind);
        TrackingInputStream source = new TrackingInputStream(bytes);
        DataAccessResourceFailureException original =
                new DataAccessResourceFailureException("fixture metadata failure");
        doThrow(original)
                .when(fixture.persistence)
                .insertStagedAsset(
                        any(UUID.class),
                        anyString(),
                        nullable(UUID.class),
                        nullable(String.class),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyLong(),
                        anyString(),
                        anyLong());

        assertSame(
                original,
                assertThrows(
                        DataAccessResourceFailureException.class,
                        () -> stage(
                                fixture,
                                kind,
                                source,
                                bytes.length,
                                kind == UploadKind.PACKAGE ? sha256(bytes) : null)));

        assertTrue(source.closed, "metadata failure must follow a closed source stream");
        assertEquals(before, temporaryAssetUploads(), "metadata failure must remove its materialized upload");
        if (kind == UploadKind.PACKAGE) verify(fixture.privateObjects).deletePrivate(anyString());
        else verify(fixture.objects).delete(anyString());
    }

    private static void stage(
            Fixture fixture, UploadKind kind, InputStream source, long declaredSize, String packageSha256) {
        if (kind == UploadKind.PACKAGE) {
            fixture.service.stageTerminalUpdatePackage(
                    WORKSPACE_UUID,
                    WORKSPACE_KEY,
                    "release.zip",
                    packageSha256,
                    declaredSize,
                    source,
                    "materialization-package-stage-001",
                    "materialization-package-request-001");
            return;
        }
        fixture.service.stageContent("GROUP_WORKSPACE_LOGO", "image/png", declaredSize, source);
    }

    private static Fixture fixture() {
        PlatformAssetPersistence persistence = mock(PlatformAssetPersistence.class);
        AssetObjectStorage objects = mock(AssetObjectStorage.class);
        TerminalUpdatePrivateObjectStorage privateObjects = mock(TerminalUpdatePrivateObjectStorage.class);
        PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
        when(transactions.getTransaction(any(TransactionDefinition.class))).thenReturn(new SimpleTransactionStatus());
        when(objects.bucketName()).thenReturn("asset-test-bucket");
        when(objects.objectKey(anyString())).thenReturn("tenant-prod/static/materialization.png");
        when(objects.exists(anyString())).thenReturn(false);
        when(privateObjects.privateBucketName()).thenReturn("terminal-update-test-bucket");
        when(privateObjects.privateObjectKey(anyString())).thenReturn("terminal-update/materialization.zip");
        when(privateObjects.privateExists(anyString())).thenReturn(false);
        PlatformAssetService service =
                new PlatformAssetService(persistence, () -> 1_800_000_000_000L, objects, privateObjects, transactions);
        return new Fixture(service, persistence, objects, privateObjects);
    }

    private static byte[] content(UploadKind kind) throws Exception {
        return kind == UploadKind.PACKAGE ? zip() : png();
    }

    private static byte[] zip() {
        return new byte[] {'P', 'K', 3, 4, 1, 2, 3, 4};
    }

    private static byte[] png() throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        BufferedImage image = new BufferedImage(1, 1, BufferedImage.TYPE_INT_ARGB);
        image.setRGB(0, 0, 0xff164e63);
        if (!javax.imageio.ImageIO.write(image, "png", output))
            throw new IllegalStateException("PNG_WRITER_UNAVAILABLE");
        return output.toByteArray();
    }

    private static Set<Path> temporaryAssetUploads() throws IOException {
        try (var paths = Files.list(Path.of(System.getProperty("java.io.tmpdir")))) {
            return paths.filter(path -> {
                        String name = path.getFileName().toString();
                        return name.startsWith("catering-v2s-asset-")
                                || name.startsWith("catering-v2s-terminal-update-");
                    })
                    .collect(Collectors.toUnmodifiableSet());
        }
    }

    private static String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    private static Throwable rootCause(Throwable failure) {
        Throwable current = failure;
        while (current.getCause() != null) current = current.getCause();
        return current;
    }

    private enum UploadKind {
        IMAGE,
        PACKAGE
    }

    private record Fixture(
            PlatformAssetService service,
            PlatformAssetPersistence persistence,
            AssetObjectStorage objects,
            TerminalUpdatePrivateObjectStorage privateObjects) {}

    private static class TrackingInputStream extends InputStream {
        private boolean closed;
        private final IOException readFailure;
        private final byte[] bytes;
        private int offset;

        private TrackingInputStream(IOException readFailure) {
            this.readFailure = readFailure;
            bytes = new byte[0];
        }

        private TrackingInputStream(byte[] bytes) {
            readFailure = null;
            this.bytes = bytes;
        }

        @Override
        public int read() throws IOException {
            if (readFailure != null) throw readFailure;
            return offset == bytes.length ? -1 : Byte.toUnsignedInt(bytes[offset++]);
        }

        @Override
        public int read(byte[] target, int start, int length) throws IOException {
            if (readFailure != null) throw readFailure;
            if (offset == bytes.length) return -1;
            int count = Math.min(length, bytes.length - offset);
            System.arraycopy(bytes, offset, target, start, count);
            offset += count;
            return count;
        }

        @Override
        public void close() throws IOException {
            closed = true;
        }
    }

    private static final class GeneratedInputStream extends InputStream {
        private long remaining;
        private boolean closed;

        private GeneratedInputStream(long size) {
            remaining = size;
        }

        @Override
        public int read() {
            if (remaining == 0) return -1;
            remaining--;
            return 0;
        }

        @Override
        public int read(byte[] bytes, int offset, int length) {
            if (remaining == 0) return -1;
            int read = (int) Math.min(remaining, length);
            java.util.Arrays.fill(bytes, offset, offset + read, (byte) 0);
            remaining -= read;
            return read;
        }

        @Override
        public void close() {
            closed = true;
        }
    }
}
