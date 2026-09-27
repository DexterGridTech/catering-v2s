package com.catering.v2s.app.acceptance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class AcceptanceRepositoryPathsTest {
    private static final String REPOSITORY_ROOT_PROPERTY = "v2s.acceptance.repository-root";

    @TempDir
    Path temporaryDirectory;

    @Test
    void resolvesExplicitRootInputsAndRejectsTraversalAndSymlinkEscape() throws IOException {
        Path repositoryRoot = Files.createDirectory(temporaryDirectory.resolve("repository"));
        Path workerDirectory = Files.createDirectories(repositoryRoot.resolve("apps/backend/catering-business-server"));
        Path input =
                Files.createDirectories(repositoryRoot.resolve("scripts/test")).resolve("terminal-ws-wire-client.mjs");
        Files.createFile(input);
        Path externalInput = Files.createFile(temporaryDirectory.resolve("external.mjs"));
        Path symlink = repositoryRoot.resolve("scripts/test/external.mjs");
        Files.createSymbolicLink(symlink, externalInput);

        String previousRoot = System.getProperty(REPOSITORY_ROOT_PROPERTY);
        String previousWorkingDirectory = System.getProperty("user.dir");
        try {
            System.setProperty(REPOSITORY_ROOT_PROPERTY, repositoryRoot.toString());
            System.setProperty("user.dir", workerDirectory.toString());

            assertEquals(
                    input.toRealPath(),
                    AcceptanceRepositoryPaths.resolveRegularFile(
                            "scripts/test/terminal-ws-wire-client.mjs", "INPUT_MISSING", "INPUT_ESCAPE"));
            assertEquals(
                    "INPUT_ESCAPE",
                    assertThrows(
                                    IllegalStateException.class,
                                    () -> AcceptanceRepositoryPaths.resolveRegularFile(
                                            "../external.mjs", "INPUT_MISSING", "INPUT_ESCAPE"))
                            .getMessage());
            assertEquals(
                    "INPUT_ESCAPE",
                    assertThrows(
                                    IllegalStateException.class,
                                    () -> AcceptanceRepositoryPaths.resolveRegularFile(
                                            "scripts/test/external.mjs", "INPUT_MISSING", "INPUT_ESCAPE"))
                            .getMessage());
        } finally {
            restoreSystemProperty(REPOSITORY_ROOT_PROPERTY, previousRoot);
            restoreSystemProperty("user.dir", previousWorkingDirectory);
        }
    }

    private static void restoreSystemProperty(String key, String value) {
        if (value == null) System.clearProperty(key);
        else System.setProperty(key, value);
    }
}
