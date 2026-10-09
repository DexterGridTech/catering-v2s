package com.catering.v2s.terminalupdate.application;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Enumeration;
import java.util.HexFormat;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Parses only the ordinary FULL/HOT packages emitted by the TER artifact builder. */
@Component
public final class TerminalUpdateArtifactParser {
    public static final long MAX_PACKAGE_BYTES = 256L * 1024 * 1024;
    private static final long MAX_UNPACKED_BYTES = 512L * 1024 * 1024;
    private static final int MAX_FILES = 8_192;
    private static final int MAX_MANIFEST_BYTES = 256 * 1024;
    private static final String MANIFEST = "terminal-update-publication.json";
    private static final ObjectMapper JSON = new ObjectMapper()
            .enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);

    private final Path buildToolsDirectory;

    public TerminalUpdateArtifactParser(
            @Value("${catering.terminal-update.android-build-tools-directory:}") String buildToolsDirectory) {
        this.buildToolsDirectory = resolveBuildToolsDirectory(buildToolsDirectory);
    }

    private static Path resolveBuildToolsDirectory(String configuredDirectory) {
        if (configuredDirectory != null && !configuredDirectory.isBlank())
            return Path.of(configuredDirectory).toAbsolutePath().normalize();
        String sdkRoot = System.getenv("ANDROID_SDK_ROOT");
        if (sdkRoot == null || sdkRoot.isBlank()) sdkRoot = System.getenv("ANDROID_HOME");
        return sdkRoot == null || sdkRoot.isBlank() ? null
                : Path.of(sdkRoot).resolve("build-tools/36.0.0").toAbsolutePath().normalize();
    }

    public record ParsedArtifact(
            String candidateKind,
            String applicationId,
            String platform,
            String nativeVersion,
            long nativeBuildNumber,
            String bundleVersion,
            String runtimeVersion,
            String entryPath,
            String filesJson,
            String publicationId,
            String apkPath,
            String apkSha256,
            String certificateSha256,
            String minimumFullJson) {}

    public ParsedArtifact parse(InputStream source, long declaredSizeBytes, String declaredSha256) {
        if (source == null || declaredSizeBytes < 4 || declaredSizeBytes > MAX_PACKAGE_BYTES
                || declaredSha256 == null || !declaredSha256.matches("[a-f0-9]{64}"))
            throw new InvalidArtifactException("PACKAGE_BOUNDS_INVALID");
        Path directory = null;
        RuntimeException primaryFailure = null;
        try {
            directory = Files.createTempDirectory("ter-update-parse-");
            Path archive = directory.resolve("package.zip");
            StreamDigest stream = copyBounded(source, archive, MAX_PACKAGE_BYTES);
            if (stream.size() != declaredSizeBytes || !stream.sha256().equals(declaredSha256))
                throw new InvalidArtifactException("PACKAGE_DIGEST_MISMATCH");
            return parseArchive(archive, directory);
        } catch (InvalidArtifactException failure) {
            primaryFailure = failure;
            throw failure;
        } catch (IOException failure) {
            InvalidArtifactException wrapped = new InvalidArtifactException("PACKAGE_READ_FAILED", failure);
            primaryFailure = wrapped;
            throw wrapped;
        } catch (RuntimeException failure) {
            primaryFailure = failure;
            throw failure;
        } finally {
            try {
                deleteTree(directory);
            } catch (IOException cleanupFailure) {
                if (primaryFailure != null) primaryFailure.addSuppressed(cleanupFailure);
                else throw new InvalidArtifactException("PARSER_TEMP_CLEANUP_FAILED", cleanupFailure);
            }
        }
    }

    private ParsedArtifact parseArchive(Path archive, Path temporaryDirectory) throws IOException {
        try (ZipFile zip = new ZipFile(archive.toFile())) {
            Map<String, ZipEntry> entries = entries(zip);
            ZipEntry manifestEntry = entries.get(MANIFEST);
            if (manifestEntry != null) return parseHot(zip, entries, manifestEntry);
            List<ZipEntry> apks = entries.values().stream()
                    .filter(entry -> !entry.isDirectory() && entry.getName().endsWith(".apk"))
                    .toList();
            if (entries.size() != 1 || apks.size() != 1)
                throw new InvalidArtifactException("PACKAGE_KIND_UNRECOGNIZED");
            return parseFull(zip, apks.getFirst(), temporaryDirectory);
        }
    }

    private ParsedArtifact parseHot(ZipFile zip, Map<String, ZipEntry> entries, ZipEntry manifestEntry)
            throws IOException {
        JsonNode manifest = readManifest(zip, manifestEntry);
        requireBaseManifest(manifest);
        if (!manifest.hasNonNull("minimumFull") || manifest.has("apk"))
            throw new InvalidArtifactException("HOT_METADATA_INVALID");
        List<FileFact> files = fileFacts(manifest.get("files"));
        if (entries.size() != files.size() + 1) throw new InvalidArtifactException("PACKAGE_FILE_SET_MISMATCH");
        long unpacked = 0;
        for (FileFact fact : files) {
            ZipEntry entry = entries.get(fact.path());
            if (entry == null || entry.isDirectory()) throw new InvalidArtifactException("PACKAGE_FILE_MISSING");
            StreamDigest actual;
            try (InputStream input = zip.getInputStream(entry)) {
                actual = digestBounded(input, MAX_UNPACKED_BYTES - unpacked);
            }
            unpacked = Math.addExact(unpacked, actual.size());
            if (actual.size() != fact.sizeBytes() || !actual.sha256().equals(fact.sha256()))
                throw new InvalidArtifactException("PACKAGE_FILE_DIGEST_MISMATCH");
        }
        String calculatedPublication = publicationId(files);
        if (!calculatedPublication.equals(text(manifest, "publicationId")))
            throw new InvalidArtifactException("PUBLICATION_ID_MISMATCH");
        JsonNode minimumFull = manifest.get("minimumFull");
        requireFields(minimumFull, Set.of(
                "applicationId", "nativeBuildNumber", "runtimeVersion", "publicationId", "apkSha256"));
        String minimumFullJson = JSON.writeValueAsString(minimumFull);
        return parsed("HOT", manifest, files, null, null, null, minimumFullJson);
    }

    private ParsedArtifact parseFull(ZipFile packageZip, ZipEntry apkEntry, Path temporaryDirectory)
            throws IOException {
        Path apk = temporaryDirectory.resolve("candidate.apk");
        StreamDigest apkDigest;
        try (InputStream input = packageZip.getInputStream(apkEntry);
                OutputStream output = Files.newOutputStream(apk)) {
            apkDigest = copyBounded(input, output, MAX_UNPACKED_BYTES);
        }
        try (ZipFile apkZip = new ZipFile(apk.toFile())) {
            ZipEntry embeddedEntry = apkZip.getEntry("assets/" + MANIFEST);
            if (embeddedEntry == null) throw new InvalidArtifactException("APK_METADATA_MISSING");
            JsonNode manifest = readManifest(apkZip, embeddedEntry);
            requireBaseManifest(manifest);
            if (manifest.has("minimumFull") || manifest.has("apk"))
                throw new InvalidArtifactException("FULL_METADATA_INVALID");
            List<FileFact> files = fileFacts(manifest.get("files"));
            ZipEntry bundleEntry = apkZip.getEntry(text(manifest, "entry"));
            FileFact bundleFact = files.stream().filter(fact -> fact.path().equals(text(manifest, "entry")))
                    .findFirst().orElseThrow(() -> new InvalidArtifactException("APK_BUNDLE_METADATA_MISSING"));
            StreamDigest bundleDigest;
            try (InputStream input = apkZip.getInputStream(bundleEntry)) {
                bundleDigest = digestBounded(input, MAX_UNPACKED_BYTES);
            }
            if (bundleDigest.size() != bundleFact.sizeBytes() || !bundleDigest.sha256().equals(bundleFact.sha256()))
                throw new InvalidArtifactException("APK_BUNDLE_DIGEST_MISMATCH");
            verifyAndroidApk(apk, manifest, temporaryDirectory);
            String certificateSha256 = verifySignature(apk);
            return parsed("FULL", manifest, files, apkEntry.getName(), apkDigest.sha256(), certificateSha256, null);
        }
    }

    private void verifyAndroidApk(Path apk, JsonNode manifest, Path temporaryDirectory) throws IOException {
        String badging = runTool(temporaryDirectory, "aapt2", List.of("dump", "badging", apk.toString()), 30, 128 * 1024);
        String expectedId = text(manifest, "applicationId");
        String expectedVersion = text(manifest, "nativeVersion");
        long expectedBuild = number(manifest, "nativeBuildNumber");
        if (!badging.contains("package: name='" + expectedId + "'")
                || !badging.contains("versionCode='" + expectedBuild + "'")
                || !badging.contains("versionName='" + expectedVersion + "'"))
            throw new InvalidArtifactException("APK_VERSION_IDENTITY_MISMATCH");
        String permissions = runTool(temporaryDirectory, "aapt2", List.of("dump", "permissions", apk.toString()), 30, 128 * 1024);
        if (!permissions.contains("android.permission.REQUEST_INSTALL_PACKAGES"))
            throw new InvalidArtifactException("APK_INSTALL_PERMISSION_MISSING");
        Map<String, ResourceFact> actualResources = androidResources(runTool(temporaryDirectory, "aapt2",
                List.of("dump", "resources", apk.toString()), 30, 16 * 1024 * 1024));
        for (FileFact file : fileFacts(manifest.get("files"))) {
            if (!file.path().startsWith("res/")) continue;
            ResourcePath expected = resourcePath(file.path());
            ResourceFact actual = actualResources.values().stream()
                    .filter(resource -> resource.type().equals(expected.type()) && resource.name().equals(expected.name()))
                    .findFirst().orElse(null);
            if (actual == null || !actual.qualifiers().contains(expected.qualifier()))
                throw new InvalidArtifactException("APK_PUBLISHED_RESOURCE_MISSING");
        }
    }

    private String verifySignature(Path apk) throws IOException {
        String output = runTool(apk.getParent(), "apksigner", List.of("verify", "--verbose", "--print-certs", apk.toString()), 30, 128 * 1024);
        java.util.regex.Matcher matcher = java.util.regex.Pattern
                .compile("Signer #1 certificate SHA-256 digest: ([a-f0-9]{64})", java.util.regex.Pattern.CASE_INSENSITIVE)
                .matcher(output);
        if (!matcher.find()) throw new InvalidArtifactException("APK_CERTIFICATE_UNAVAILABLE");
        return matcher.group(1).toLowerCase(java.util.Locale.ROOT);
    }

    private static Map<String, ZipEntry> entries(ZipFile zip) {
        Map<String, ZipEntry> result = new HashMap<>();
        Set<String> directories = new HashSet<>();
        Enumeration<? extends ZipEntry> enumeration = zip.entries();
        int count = 0;
        while (enumeration.hasMoreElements()) {
            ZipEntry entry = enumeration.nextElement();
            String name = entry.getName();
            if (++count > MAX_FILES || entry.isDirectory() || !safePath(name) || result.putIfAbsent(name, entry) != null)
                throw new InvalidArtifactException("PACKAGE_ENTRY_INVALID");
            for (int slash = name.indexOf('/'); slash >= 0; slash = name.indexOf('/', slash + 1))
                directories.add(name.substring(0, slash));
        }
        if (result.keySet().stream().anyMatch(directories::contains))
            throw new InvalidArtifactException("PACKAGE_ENTRY_CONFLICT");
        return result;
    }

    private static boolean safePath(String name) {
        if (name == null || name.isBlank() || name.startsWith("/") || name.indexOf('\\') >= 0 || name.indexOf('\0') >= 0)
            return false;
        for (String segment : name.split("/", -1)) if (segment.isBlank() || segment.equals(".") || segment.equals("..")) return false;
        return true;
    }

    private static JsonNode readManifest(ZipFile zip, ZipEntry entry) throws IOException {
        if (entry.getSize() < 2 || entry.getSize() > MAX_MANIFEST_BYTES)
            throw new InvalidArtifactException("MANIFEST_SIZE_INVALID");
        byte[] bytes;
        try (InputStream input = zip.getInputStream(entry)) {
            bytes = readBounded(input, MAX_MANIFEST_BYTES);
        }
        JsonNode node = JSON.readTree(bytes);
        if (node == null || !node.isObject()) throw new InvalidArtifactException("MANIFEST_INVALID");
        Set<String> allowed = Set.of("schemaVersion", "platform", "applicationId", "nativeVersion", "nativeBuildNumber",
                "bundleVersion", "runtimeVersion", "entry", "files", "publicationId", "minimumFull", "apk");
        node.fieldNames().forEachRemaining(field -> {
            if (!allowed.contains(field)) throw new InvalidArtifactException("MANIFEST_FIELD_INVALID");
        });
        return node;
    }

    private static void requireBaseManifest(JsonNode manifest) {
        if (number(manifest, "schemaVersion") != 1 || !"android".equals(text(manifest, "platform")))
            throw new InvalidArtifactException("MANIFEST_VERSION_INVALID");
        text(manifest, "applicationId");
        text(manifest, "nativeVersion");
        if (number(manifest, "nativeBuildNumber") < 1) throw new InvalidArtifactException("MANIFEST_BUILD_INVALID");
        text(manifest, "bundleVersion");
        text(manifest, "runtimeVersion");
        text(manifest, "entry");
        if (!text(manifest, "publicationId").matches("[a-f0-9]{64}"))
            throw new InvalidArtifactException("MANIFEST_PUBLICATION_INVALID");
    }

    private static List<FileFact> fileFacts(JsonNode files) {
        if (files == null || !files.isArray() || files.isEmpty() || files.size() > MAX_FILES)
            throw new InvalidArtifactException("MANIFEST_FILES_INVALID");
        List<FileFact> result = new ArrayList<>();
        Set<String> paths = new HashSet<>();
        for (JsonNode file : files) {
            requireFields(file, Set.of("path", "sizeBytes", "sha256"));
            String path = text(file, "path");
            long size = number(file, "sizeBytes");
            String sha = text(file, "sha256");
            if (!safePath(path) || !paths.add(path) || size < 0 || !sha.matches("[a-f0-9]{64}"))
                throw new InvalidArtifactException("MANIFEST_FILE_INVALID");
            result.add(new FileFact(path, size, sha));
        }
        result.sort(Comparator.comparing(FileFact::path));
        return List.copyOf(result);
    }

    private static void requireFields(JsonNode node, Set<String> required) {
        if (node == null || !node.isObject()) throw new InvalidArtifactException("MANIFEST_OBJECT_INVALID");
        Set<String> actual = new HashSet<>();
        node.fieldNames().forEachRemaining(actual::add);
        if (!actual.equals(required)) throw new InvalidArtifactException("MANIFEST_FIELDS_INVALID");
    }

    private static ParsedArtifact parsed(
            String kind, JsonNode manifest, List<FileFact> files, String apkPath, String apkSha, String certSha,
            String minimumFullJson) throws IOException {
        String filesJson = JSON.writeValueAsString(files);
        return new ParsedArtifact(kind, text(manifest, "applicationId"), text(manifest, "platform"),
                text(manifest, "nativeVersion"), number(manifest, "nativeBuildNumber"),
                text(manifest, "bundleVersion"), text(manifest, "runtimeVersion"), text(manifest, "entry"),
                filesJson, text(manifest, "publicationId"), apkPath, apkSha, certSha, minimumFullJson);
    }

    private static String publicationId(List<FileFact> files) throws IOException {
        MessageDigest digest = sha256();
        for (FileFact file : files) digest.update((file.path() + "\0" + file.sizeBytes() + "\0" + file.sha256() + "\n")
                .getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(digest.digest());
    }

    private static Map<String, ResourceFact> androidResources(String output) {
        Map<String, ResourceFact> resources = new HashMap<>();
        java.util.regex.Pattern resourcePattern = java.util.regex.Pattern.compile(
                "^\\s*resource (0x[0-9a-f]+) ([a-z][a-z0-9_]*)/([a-z0-9_$]+)\\s*$",
                java.util.regex.Pattern.CASE_INSENSITIVE);
        java.util.regex.Pattern fileVariantPattern = java.util.regex.Pattern.compile(
                "^\\s*\\(([^)]*)\\) \\(file\\)\\s+.*$",
                java.util.regex.Pattern.CASE_INSENSITIVE);
        String currentId = null;
        for (String line : output.split("\\n")) {
            java.util.regex.Matcher resource = resourcePattern.matcher(line);
            if (resource.find()) {
                currentId = resource.group(1).toLowerCase(java.util.Locale.ROOT);
                resources.putIfAbsent(currentId, new ResourceFact(resource.group(2), resource.group(3), Set.of()));
                continue;
            }
            if (currentId != null) {
                java.util.regex.Matcher fileVariant = fileVariantPattern.matcher(line);
                if (!fileVariant.matches()) continue;
                String qualifier = fileVariant.group(1).trim();
                if (qualifier.isEmpty() || qualifier.equalsIgnoreCase("default")) qualifier = "default";
                ResourceFact previous = resources.get(currentId);
                Set<String> qualifiers = new HashSet<>(previous.qualifiers());
                qualifiers.add(qualifier);
                resources.put(currentId, new ResourceFact(previous.type(), previous.name(), Set.copyOf(qualifiers)));
            }
        }
        return Map.copyOf(resources);
    }

    private static ResourcePath resourcePath(String path) {
        java.util.regex.Matcher match = java.util.regex.Pattern
                .compile("^res/(drawable(?:-([a-z0-9-]+))?|raw)/([^/]+)$", java.util.regex.Pattern.CASE_INSENSITIVE)
                .matcher(path);
        if (!match.matches()) throw new InvalidArtifactException("ANDROID_RESOURCE_PATH_UNSUPPORTED");
        String type = match.group(1).equalsIgnoreCase("raw") ? "raw" : "drawable";
        String name = match.group(3).replaceFirst("\\.[^.]+$", "").toLowerCase(java.util.Locale.ROOT);
        if (!name.matches("[a-z0-9_]+")) throw new InvalidArtifactException("ANDROID_RESOURCE_NAME_INVALID");
        String qualifier = "default";
        if (match.group(2) != null) {
            for (String segment : match.group(2).split("-")) {
                if (Set.of("ldpi", "mdpi", "tvdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi", "nodpi").contains(segment)) {
                    qualifier = segment;
                    break;
                }
            }
        }
        return new ResourcePath(type, name, qualifier);
    }

    private String runTool(Path workingDirectory, String tool, List<String> arguments, int timeoutSeconds,
            int maxOutputBytes) throws IOException {
        if (buildToolsDirectory == null || !Files.isDirectory(buildToolsDirectory))
            throw new InvalidArtifactException("ANDROID_BUILD_TOOLS_UNAVAILABLE");
        Path executable = buildToolsDirectory.resolve(tool);
        if (!Files.isRegularFile(executable) || !Files.isExecutable(executable))
            throw new InvalidArtifactException("ANDROID_TOOL_UNAVAILABLE");
        List<String> command = new ArrayList<>();
        command.add(executable.toString());
        command.addAll(arguments);
        Path outputFile = workingDirectory.resolve(tool + "-output.txt");
        Process process = new ProcessBuilder(command).redirectErrorStream(true).redirectOutput(outputFile.toFile()).start();
        try {
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(timeoutSeconds);
            while (true) {
                long remaining = deadline - System.nanoTime();
                if (remaining <= 0) {
                    process.destroyForcibly();
                    process.waitFor();
                    throw new InvalidArtifactException("ANDROID_TOOL_TIMEOUT");
                }
                if (process.waitFor(Math.min(remaining, TimeUnit.MILLISECONDS.toNanos(100)), TimeUnit.NANOSECONDS)) break;
                if (Files.size(outputFile) > maxOutputBytes) {
                    process.destroyForcibly();
                    process.waitFor();
                    throw new InvalidArtifactException("ANDROID_TOOL_OUTPUT_LIMIT");
                }
            }
            if (Files.size(outputFile) > maxOutputBytes) throw new InvalidArtifactException("ANDROID_TOOL_OUTPUT_LIMIT");
            if (process.exitValue() != 0) throw new InvalidArtifactException("ANDROID_TOOL_REJECTED");
            return Files.readString(outputFile, StandardCharsets.UTF_8);
        } catch (InterruptedException failure) {
            process.destroyForcibly();
            Thread.currentThread().interrupt();
            throw new InvalidArtifactException("ANDROID_TOOL_INTERRUPTED", failure);
        }
    }

    private static StreamDigest copyBounded(InputStream input, Path path, long maxBytes) throws IOException {
        try (OutputStream output = Files.newOutputStream(path)) {
            return copyBounded(input, output, maxBytes);
        }
    }

    private static StreamDigest copyBounded(InputStream input, OutputStream output, long maxBytes) throws IOException {
        MessageDigest digest = sha256();
        byte[] buffer = new byte[16 * 1024];
        long size = 0;
        for (int read; (read = input.read(buffer)) != -1;) {
            size += read;
            if (size > maxBytes) throw new InvalidArtifactException("PACKAGE_UNPACKED_LIMIT");
            digest.update(buffer, 0, read);
            output.write(buffer, 0, read);
        }
        return new StreamDigest(size, HexFormat.of().formatHex(digest.digest()));
    }

    private static StreamDigest digestBounded(InputStream input, long maxBytes) throws IOException {
        MessageDigest digest = sha256();
        byte[] buffer = new byte[16 * 1024];
        long size = 0;
        for (int read; (read = input.read(buffer)) != -1;) {
            size += read;
            if (size > maxBytes) throw new InvalidArtifactException("PACKAGE_UNPACKED_LIMIT");
            digest.update(buffer, 0, read);
        }
        return new StreamDigest(size, HexFormat.of().formatHex(digest.digest()));
    }

    private static byte[] readBounded(InputStream input, int maxBytes) throws IOException {
        java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream(Math.min(maxBytes, 32 * 1024));
        byte[] buffer = new byte[8 * 1024];
        for (int read; (read = input.read(buffer)) != -1;) {
            if (output.size() + read > maxBytes) throw new InvalidArtifactException("MANIFEST_SIZE_INVALID");
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    private static MessageDigest sha256() {
        try { return MessageDigest.getInstance("SHA-256"); }
        catch (Exception failure) { throw new IllegalStateException("SHA-256 unavailable", failure); }
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        if (value == null || !value.isTextual() || value.textValue().isBlank())
            throw new InvalidArtifactException("MANIFEST_FIELD_INVALID");
        return value.textValue();
    }

    private static long number(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        if (value == null || !value.isIntegralNumber() || !value.canConvertToLong())
            throw new InvalidArtifactException("MANIFEST_FIELD_INVALID");
        return value.longValue();
    }

    private static void deleteTree(Path directory) throws IOException {
        if (directory == null || !Files.exists(directory)) return;
        try (var paths = Files.walk(directory)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
        }
    }

    private record FileFact(String path, long sizeBytes, String sha256) {}
    private record StreamDigest(long size, String sha256) {}
    private record ResourcePath(String type, String name, String qualifier) {}
    private record ResourceFact(String type, String name, Set<String> qualifiers) {}

    public static final class InvalidArtifactException extends RuntimeException {
        public InvalidArtifactException(String reason) { super(reason); }
        public InvalidArtifactException(String reason, Throwable cause) { super(reason, cause); }
    }
}
