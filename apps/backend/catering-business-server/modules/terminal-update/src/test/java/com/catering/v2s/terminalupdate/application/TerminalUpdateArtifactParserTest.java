package com.catering.v2s.terminalupdate.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;

class TerminalUpdateArtifactParserTest {
    private static final String CERTIFICATE = "a".repeat(64);

    @Test
    void parsesHotPackageFromItsRootManifestAndVerifiesEveryPublishedFile() throws Exception {
        byte[] bundle = "bundle-bytes".getBytes(StandardCharsets.UTF_8);
        String bundleSha = sha256(bundle);
        String publicationId = sha256(("assets/index.android.bundle\0" + bundle.length + "\0" + bundleSha + "\n")
                .getBytes(StandardCharsets.UTF_8));
        String manifest = """
                {"schemaVersion":1,"platform":"android","applicationId":"com.example.terminal",
                "nativeVersion":"2.1.4","nativeBuildNumber":9,"bundleVersion":"3.2.1",
                "runtimeVersion":"terminal-main-v1","entry":"assets/index.android.bundle",
                "files":[{"path":"assets/index.android.bundle","sizeBytes":%d,"sha256":"%s"}],
                "publicationId":"%s","minimumFull":{"applicationId":"com.example.terminal",
                "nativeBuildNumber":9,"runtimeVersion":"terminal-main-v1","publicationId":"%s",
                "apkSha256":"%s"}}
                """.formatted(bundle.length, bundleSha, publicationId, CERTIFICATE, CERTIFICATE);
        byte[] zip = zipTextAndBytes("terminal-update-publication.json", manifest,
                "assets/index.android.bundle", bundle);

        var parsed = new TerminalUpdateArtifactParser("").parse(new ByteArrayInputStream(zip), zip.length, sha256(zip));

        assertEquals("HOT", parsed.candidateKind());
        assertEquals("com.example.terminal", parsed.applicationId());
        assertEquals(publicationId, parsed.publicationId());
        assertTrue(parsed.filesJson().contains(bundleSha));
        assertTrue(parsed.minimumFullJson().contains(CERTIFICATE));
        assertEquals(null, parsed.apkSha256());
    }

    @Test
    void rejectsHotPayloadWhoseBytesDifferFromDeclaredPublishedDigest() throws Exception {
        byte[] declared = "expected".getBytes(StandardCharsets.UTF_8);
        byte[] actual = "different".getBytes(StandardCharsets.UTF_8);
        String fileSha = sha256(declared);
        String publicationId = sha256(("assets/index.android.bundle\0" + declared.length + "\0" + fileSha + "\n")
                .getBytes(StandardCharsets.UTF_8));
        String manifest = """
                {"schemaVersion":1,"platform":"android","applicationId":"com.example.terminal",
                "nativeVersion":"2.1.4","nativeBuildNumber":9,"bundleVersion":"3.2.1",
                "runtimeVersion":"terminal-main-v1","entry":"assets/index.android.bundle",
                "files":[{"path":"assets/index.android.bundle","sizeBytes":%d,"sha256":"%s"}],
                "publicationId":"%s","minimumFull":{"applicationId":"com.example.terminal",
                "nativeBuildNumber":9,"runtimeVersion":"terminal-main-v1","publicationId":"%s",
                "apkSha256":"%s"}}
                """.formatted(declared.length, fileSha, publicationId, CERTIFICATE, CERTIFICATE);
        byte[] zip = zipTextAndBytes("terminal-update-publication.json", manifest,
                "assets/index.android.bundle", actual);

        var failure = assertThrows(TerminalUpdateArtifactParser.InvalidArtifactException.class,
                () -> new TerminalUpdateArtifactParser("").parse(new ByteArrayInputStream(zip), zip.length, sha256(zip)));

        assertEquals("PACKAGE_FILE_DIGEST_MISMATCH", failure.getMessage());
    }

    @Test
    void rejectsUnsafeManifestPathBeforeResolvingArchiveEntries() throws Exception {
        byte[] zip = hotPackage("../index.android.bundle");

        var failure = assertThrows(TerminalUpdateArtifactParser.InvalidArtifactException.class,
                () -> new TerminalUpdateArtifactParser("").parse(new ByteArrayInputStream(zip), zip.length, sha256(zip)));

        assertEquals("MANIFEST_FILE_INVALID", failure.getMessage());
    }

    @Test
    void rejectsHotEntryNotIncludedInThePublishedFileSet() throws Exception {
        byte[] zip = hotPackage("assets/unlisted.bundle", "assets/index.android.bundle", "assets/index.android.bundle");

        var failure = assertThrows(TerminalUpdateArtifactParser.InvalidArtifactException.class,
                () -> new TerminalUpdateArtifactParser("").parse(new ByteArrayInputStream(zip), zip.length, sha256(zip)));

        assertEquals("APK_BUNDLE_METADATA_MISSING", failure.getMessage());
    }

    @Test
    void rejectsDeclaredPackageSizeAboveThePublishedLimitBeforeReadingIt() {
        var failure = assertThrows(TerminalUpdateArtifactParser.InvalidArtifactException.class,
                () -> new TerminalUpdateArtifactParser("").parse(new ByteArrayInputStream(new byte[0]),
                        TerminalUpdateArtifactParser.MAX_PACKAGE_BYTES + 1, "a".repeat(64)));

        assertEquals("PACKAGE_BOUNDS_INVALID", failure.getMessage());
    }

    @Test
    void artifactManifestAcceptsTheSameFileCountAsTheParser() {
        List<TerminalUpdateArtifactOwnerApi.ArtifactFile> files = java.util.stream.IntStream.range(0, 129)
                .mapToObj(index -> new TerminalUpdateArtifactOwnerApi.ArtifactFile(
                        "assets/file-" + index, 1, CERTIFICATE))
                .toList();

        var manifest = new TerminalUpdateArtifactOwnerApi.ArtifactManifest(1, "android", "com.example.terminal",
                "2.1.4", 9, "3.2.1", "terminal-main-v1", "assets/file-0", files,
                CERTIFICATE, null, null);

        assertEquals(129, manifest.files().size());
        assertEquals(TerminalUpdateArtifactOwnerApi.MAX_MANIFEST_FILE_COUNT, 8_192);
    }

    @Test
    void parsesFullZipApkAndChecksTheEmbeddedPublicationIdentityUsingConfiguredAndroidTools() throws Exception {
        Path tools = Files.createTempDirectory("terminal-update-parser-tools-");
        try {
            executable(tools.resolve("apksigner"), "#!/bin/sh\nprintf '%s\\n' 'Signer #1 certificate SHA-256 digest: " + CERTIFICATE + "'\n");
            executable(tools.resolve("aapt2"), aaptScript(true));
            byte[] outer = fullPackage();
            byte[] apk = fullApk();

            var parsed = new TerminalUpdateArtifactParser(tools.toString())
                    .parse(new ByteArrayInputStream(outer), outer.length, sha256(outer));

            assertEquals("FULL", parsed.candidateKind());
            assertEquals("terminal.apk", parsed.apkPath());
            assertEquals(sha256(apk), parsed.apkSha256());
            assertEquals(CERTIFICATE, parsed.certificateSha256());
        } finally {
            try (var paths = Files.walk(tools)) {
                paths.sorted(java.util.Comparator.reverseOrder()).forEach(path -> {
                    try { Files.deleteIfExists(path); } catch (Exception ignored) { }
                });
            }
        }
    }

    @Test
    void rejectsFullApkWhenPublishedResourceIsAbsentFromTheAndroidResourceTable() throws Exception {
        Path tools = Files.createTempDirectory("terminal-update-parser-tools-");
        try {
            executable(tools.resolve("apksigner"), "#!/bin/sh\nprintf '%s\\n' 'Signer #1 certificate SHA-256 digest: " + CERTIFICATE + "'\n");
            executable(tools.resolve("aapt2"), aaptScript(false));
            byte[] outer = fullPackage();

            var failure = assertThrows(TerminalUpdateArtifactParser.InvalidArtifactException.class,
                    () -> new TerminalUpdateArtifactParser(tools.toString())
                            .parse(new ByteArrayInputStream(outer), outer.length, sha256(outer)));

            assertEquals("APK_PUBLISHED_RESOURCE_MISSING", failure.getMessage());
        } finally {
            deleteTree(tools);
        }
    }

    @Test
    void rejectsFullApkWhenAndroidSignatureVerificationFails() throws Exception {
        Path tools = Files.createTempDirectory("terminal-update-parser-tools-");
        try {
            executable(tools.resolve("apksigner"), "#!/bin/sh\nexit 1\n");
            executable(tools.resolve("aapt2"), aaptScript(true));
            byte[] outer = fullPackage();

            var failure = assertThrows(TerminalUpdateArtifactParser.InvalidArtifactException.class,
                    () -> new TerminalUpdateArtifactParser(tools.toString())
                            .parse(new ByteArrayInputStream(outer), outer.length, sha256(outer)));

            assertEquals("ANDROID_TOOL_REJECTED", failure.getMessage());
        } finally {
            deleteTree(tools);
        }
    }

    @Test
    void rejectsFullApkWhenDeclaredEntryIsAbsentFromTheArchive() throws Exception {
        Path tools = Files.createTempDirectory("terminal-update-parser-tools-");
        try {
            executable(tools.resolve("apksigner"), "#!/bin/sh\nprintf '%s\\n' 'Signer #1 certificate SHA-256 digest: " + CERTIFICATE + "'\n");
            executable(tools.resolve("aapt2"), aaptScript(true));
            byte[] outer = zipBytes("terminal.apk", fullApk("assets/missing.bundle"));

            var failure = assertThrows(TerminalUpdateArtifactParser.InvalidArtifactException.class,
                    () -> new TerminalUpdateArtifactParser(tools.toString())
                            .parse(new ByteArrayInputStream(outer), outer.length, sha256(outer)));

            assertEquals("PACKAGE_FILE_MISSING", failure.getMessage());
        } finally {
            deleteTree(tools);
        }
    }

    private static byte[] fullPackage() throws Exception {
        return zipBytes("terminal.apk", fullApk());
    }

    private static byte[] hotPackage(String path) throws Exception {
        return hotPackage(path, path, "assets/index.android.bundle");
    }

    private static byte[] hotPackage(String entryPath, String filePath, String actualPath) throws Exception {
        byte[] bundle = "bundle-bytes".getBytes(StandardCharsets.UTF_8);
        String bundleSha = sha256(bundle);
        String publicationId = sha256((filePath + "\0" + bundle.length + "\0" + bundleSha + "\n")
                .getBytes(StandardCharsets.UTF_8));
        String manifest = """
                {"schemaVersion":1,"platform":"android","applicationId":"com.example.terminal",
                "nativeVersion":"2.1.4","nativeBuildNumber":9,"bundleVersion":"3.2.1",
                "runtimeVersion":"terminal-main-v1","entry":"%s",
                "files":[{"path":"%s","sizeBytes":%d,"sha256":"%s"}],
                "publicationId":"%s","minimumFull":{"applicationId":"com.example.terminal",
                "nativeBuildNumber":9,"runtimeVersion":"terminal-main-v1","publicationId":"%s",
                "apkSha256":"%s"}}
                """.formatted(entryPath, filePath, bundle.length, bundleSha, publicationId, CERTIFICATE, CERTIFICATE);
        return zipTextAndBytes("terminal-update-publication.json", manifest, actualPath, bundle);
    }

    private static byte[] fullApk() throws Exception {
        return fullApk("assets/index.android.bundle");
    }

    private static byte[] fullApk(String entryPath) throws Exception {
        byte[] bundle = "bundle-bytes".getBytes(StandardCharsets.UTF_8);
        byte[] image = "image-bytes".getBytes(StandardCharsets.UTF_8);
        String bundleSha = sha256(bundle);
        String imageSha = sha256(image);
        String publicationId = sha256((entryPath + "\0" + bundle.length + "\0" + bundleSha + "\n"
                + "res/drawable-mdpi/logo.png\0" + image.length + "\0" + imageSha + "\n")
                .getBytes(StandardCharsets.UTF_8));
        String manifest = """
                {"schemaVersion":1,"platform":"android","applicationId":"com.example.terminal",
                "nativeVersion":"2.1.4","nativeBuildNumber":9,"bundleVersion":"3.2.1",
                "runtimeVersion":"terminal-main-v1","entry":"%s",
                "files":[{"path":"%s","sizeBytes":%d,"sha256":"%s"},
                {"path":"res/drawable-mdpi/logo.png","sizeBytes":%d,"sha256":"%s"}],
                "publicationId":"%s"}
                """.formatted(entryPath, entryPath, bundle.length, bundleSha, image.length, imageSha, publicationId);
        byte[] apk = zip("assets/terminal-update-publication.json", manifest,
                "assets/index.android.bundle", new String(bundle, StandardCharsets.UTF_8),
                "res/drawable-mdpi/logo.png", new String(image, StandardCharsets.UTF_8));
        return apk;
    }

    private static String aaptScript(boolean includeResource) {
        return "#!/bin/sh\ncase \"$2\" in badging) printf '%s\\n' \"package: name='com.example.terminal' versionCode='9' versionName='2.1.4'\" ;; "
                + "permissions) printf '%s\\n' 'android.permission.REQUEST_INSTALL_PACKAGES' ;; "
                + "resources) " + (includeResource
                        ? "printf '%s\\n' 'resource 0x7f070028 drawable/logo' '  (mdpi) (file) res/logo.png'"
                        : "printf '%s\\n' 'resource 0x7f070028 drawable/logo' '  (hdpi) (file) res/logo.png'")
                + " ;; esac\n";
    }

    private static byte[] zip(String... nameAndBytes) throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            for (int index = 0; index < nameAndBytes.length; index += 2) {
                zip.putNextEntry(new ZipEntry(nameAndBytes[index]));
                zip.write(nameAndBytes[index + 1].getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        }
        return bytes.toByteArray();
    }

    private static byte[] zipTextAndBytes(String name, String content, String secondName, byte[] secondContent)
            throws Exception {
        return zip(name, content.getBytes(StandardCharsets.UTF_8), secondName, secondContent);
    }

    private static byte[] zipBytes(String name, byte[] content) throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            zip.putNextEntry(new ZipEntry(name));
            zip.write(content);
            zip.closeEntry();
        }
        return bytes.toByteArray();
    }

    private static byte[] zip(String name, byte[] content, String secondName, byte[] secondContent) throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            zip.putNextEntry(new ZipEntry(name));
            zip.write(content);
            zip.closeEntry();
            if (secondName != null) {
                zip.putNextEntry(new ZipEntry(secondName));
                zip.write(secondContent);
                zip.closeEntry();
            }
        }
        return bytes.toByteArray();
    }

    private static String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    private static void executable(Path path, String body) throws Exception {
        Files.writeString(path, body, StandardCharsets.UTF_8);
        assertTrue(path.toFile().setExecutable(true));
    }

    private static void deleteTree(Path directory) throws Exception {
        try (var paths = Files.walk(directory)) {
            for (Path path : paths.sorted(java.util.Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
        }
    }
}
