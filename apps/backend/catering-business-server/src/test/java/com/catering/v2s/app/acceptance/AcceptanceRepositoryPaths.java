package com.catering.v2s.app.acceptance;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/** Resolves acceptance inputs from the root Gradle explicitly passes to its test worker. */
final class AcceptanceRepositoryPaths {
    private static final String REPOSITORY_ROOT_PROPERTY = "v2s.acceptance.repository-root";

    private AcceptanceRepositoryPaths() {}

    static Path repositoryRoot() throws IOException {
        String configuredRoot = System.getProperty(REPOSITORY_ROOT_PROPERTY);
        if (configuredRoot == null || configuredRoot.isBlank()) {
            throw new IllegalStateException("BACKEND_ACCEPTANCE_REPOSITORY_ROOT_REQUIRED");
        }
        Path repositoryRoot = Path.of(configuredRoot).toRealPath();
        if (!Files.isDirectory(repositoryRoot)) {
            throw new IllegalStateException("BACKEND_ACCEPTANCE_REPOSITORY_ROOT_INVALID");
        }
        return repositoryRoot;
    }

    static Path resolveRegularFile(String repositoryRelativePath, String missingFailure, String escapeFailure)
            throws IOException {
        Path repositoryRoot = repositoryRoot();
        Path suppliedPath = Path.of(repositoryRelativePath);
        if (suppliedPath.isAbsolute()) throw new IllegalStateException(escapeFailure);
        Path candidate = repositoryRoot.resolve(suppliedPath).normalize();
        if (!candidate.startsWith(repositoryRoot)) throw new IllegalStateException(escapeFailure);
        if (!Files.isRegularFile(candidate)) throw new IllegalStateException(missingFailure);
        Path resolved = candidate.toRealPath();
        if (!resolved.startsWith(repositoryRoot)) throw new IllegalStateException(escapeFailure);
        return resolved;
    }
}
