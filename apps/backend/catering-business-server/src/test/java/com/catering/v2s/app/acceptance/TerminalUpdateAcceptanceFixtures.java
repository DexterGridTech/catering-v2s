package com.catering.v2s.app.acceptance;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** Small valid package bytes and matching Android tool outputs for real HTTP acceptance paths. */
final class TerminalUpdateAcceptanceFixtures {
    static final String APPLICATION_ID = "com.example.terminal";
    static final String NATIVE_VERSION = "2.1.4";
    static final long NATIVE_BUILD = 9;
    static final String RUNTIME = "terminal-main-v1";
    static final String BUNDLE_VERSION = "3.2.1";
    private static final String CERTIFICATE = "a".repeat(64);
    private static final byte[] BUNDLE = "acceptance-bundle".getBytes(StandardCharsets.UTF_8);
    private static final String ENTRY = "assets/index.android.bundle";
    private static final Path TOOLS = createTools();

    private TerminalUpdateAcceptanceFixtures() {}

    static Path androidBuildToolsDirectory() {
        return TOOLS;
    }

    static Package full() {
        try {
            String bundleDigest = sha256(BUNDLE);
            String publicationId = sha256((ENTRY + "\0" + BUNDLE.length + "\0" + bundleDigest + "\n")
                    .getBytes(StandardCharsets.UTF_8));
            String manifest = """
                    {"schemaVersion":1,"platform":"android","applicationId":"%s",
                    "nativeVersion":"%s","nativeBuildNumber":%d,"bundleVersion":"%s",
                    "runtimeVersion":"%s","entry":"%s",
                    "files":[{"path":"%s","sizeBytes":%d,"sha256":"%s"}],
                    "publicationId":"%s"}
                    """.formatted(APPLICATION_ID, NATIVE_VERSION, NATIVE_BUILD, BUNDLE_VERSION,
                    RUNTIME, ENTRY, ENTRY, BUNDLE.length, bundleDigest, publicationId);
            byte[] apk = zip(new Entry("assets/terminal-update-publication.json", manifest.getBytes(StandardCharsets.UTF_8)),
                    new Entry(ENTRY, BUNDLE));
            return new Package(zip(new Entry("terminal.apk", apk)), apk, publicationId,
                    sha256(apk), BUNDLE_VERSION);
        } catch (Exception failure) {
            throw new IllegalStateException("TERMINAL_UPDATE_ACCEPTANCE_FULL_FIXTURE_FAILED", failure);
        }
    }

    static Package hot(Package minimumFull) {
        try {
            String bundleVersion = "3.2.2";
            byte[] nextBundle = "acceptance-hot-bundle".getBytes(StandardCharsets.UTF_8);
            String bundleDigest = sha256(nextBundle);
            String publicationId = sha256((ENTRY + "\0" + nextBundle.length + "\0" + bundleDigest + "\n")
                    .getBytes(StandardCharsets.UTF_8));
            String manifest = """
                    {"schemaVersion":1,"platform":"android","applicationId":"%s",
                    "nativeVersion":"%s","nativeBuildNumber":%d,"bundleVersion":"%s",
                    "runtimeVersion":"%s","entry":"%s",
                    "files":[{"path":"%s","sizeBytes":%d,"sha256":"%s"}],
                    "publicationId":"%s","minimumFull":{"applicationId":"%s",
                    "nativeBuildNumber":%d,"runtimeVersion":"%s","publicationId":"%s",
                    "apkSha256":"%s"}}
                    """.formatted(APPLICATION_ID, NATIVE_VERSION, NATIVE_BUILD, bundleVersion,
                    RUNTIME, ENTRY, ENTRY, nextBundle.length, bundleDigest, publicationId,
                    APPLICATION_ID, NATIVE_BUILD, RUNTIME, minimumFull.publicationId(), minimumFull.apkSha256());
            return new Package(zip(new Entry("terminal-update-publication.json", manifest.getBytes(StandardCharsets.UTF_8)),
                    new Entry(ENTRY, nextBundle)), null, publicationId, null, bundleVersion);
        } catch (Exception failure) {
            throw new IllegalStateException("TERMINAL_UPDATE_ACCEPTANCE_HOT_FIXTURE_FAILED", failure);
        }
    }

    static byte[] invalidPackage() {
        return "not-a-terminal-update-package".getBytes(StandardCharsets.UTF_8);
    }

    private static Path createTools() {
        try {
            Path directory = Files.createTempDirectory("terminal-update-acceptance-tools-");
            executable(directory.resolve("apksigner"), "#!/bin/sh\nprintf '%s\\n' 'Signer #1 certificate SHA-256 digest: "
                    + CERTIFICATE + "'\n");
            executable(directory.resolve("aapt2"), "#!/bin/sh\ncase \"$2\" in "
                    + "badging) printf '%s\\n' \"package: name='" + APPLICATION_ID + "' versionCode='"
                    + NATIVE_BUILD + "' versionName='" + NATIVE_VERSION + "'\" ;; "
                    + "permissions) printf '%s\\n' 'android.permission.REQUEST_INSTALL_PACKAGES' ;; "
                    + "resources) : ;; esac\n");
            return directory;
        } catch (Exception failure) {
            throw new IllegalStateException("TERMINAL_UPDATE_ACCEPTANCE_TOOL_FIXTURE_FAILED", failure);
        }
    }

    private static void executable(Path path, String content) throws Exception {
        Files.writeString(path, content, StandardCharsets.UTF_8);
        if (!path.toFile().setExecutable(true)) throw new IllegalStateException("ACCEPTANCE_TOOL_NOT_EXECUTABLE");
    }

    static void cleanup() throws Exception {
        try (var paths = Files.walk(TOOLS)) {
            for (Path path : paths.sorted(java.util.Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
        }
    }

    private static byte[] zip(Entry... entries) throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream output = new ZipOutputStream(bytes)) {
            for (Entry entry : entries) {
                output.putNextEntry(new ZipEntry(entry.name()));
                output.write(entry.bytes());
                output.closeEntry();
            }
        }
        return bytes.toByteArray();
    }

    private static String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    private record Entry(String name, byte[] bytes) {}

    record Package(byte[] bytes, byte[] apkBytes, String publicationId, String apkSha256, String bundleVersion) {
        String sha256() {
            try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
            catch (Exception failure) { throw new IllegalStateException(failure); }
        }
    }
}
