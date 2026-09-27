package com.catering.v2s.terminaldataserver.state;

import static org.assertj.core.api.Assertions.assertThat;

import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionProtocol;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class TdsConnectionCloseReasonContractTest {
    private static final Pattern CLOSE_REASON_CHECK =
            Pattern.compile("close_reason\\s+IN\\s*\\(([^)]*)\\)", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern SQL_TEXT = Pattern.compile("'([A-Z_]+)'");

    @Test
    void databaseConstraintAcceptsEverySharedProtocolCloseReason() throws IOException {
        TerminalConnectionProtocol protocol =
                new TerminalConnectionProtocol(JsonMapper.builder().build());
        String migration = Files.readString(workspaceRoot()
                .resolve("apps/backend/catering-business-server/src/main/resources/db/migration/"
                        + "V20260926_000000_000__terminal_binding_owner.sql"));
        Matcher check = CLOSE_REASON_CHECK.matcher(migration);

        assertThat(check.find())
                .as("terminal latest_state close_reason check exists")
                .isTrue();
        Set<String> persistedReasons = new HashSet<>();
        Matcher reason = SQL_TEXT.matcher(check.group(1));
        while (reason.find()) persistedReasons.add(reason.group(1));

        Set<String> protocolReasons = new HashSet<>(protocol.applicationCloseReasons());
        protocol.standardCloseReasons().values().forEach(protocolReasons::add);
        assertThat(persistedReasons).containsAll(protocolReasons);
    }

    private static Path workspaceRoot() {
        Path candidate =
                Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        while (candidate != null) {
            if (Files.isRegularFile(candidate.resolve("AGENTS.md"))) return candidate;
            candidate = candidate.getParent();
        }
        throw new IllegalStateException("V2S_WORKSPACE_ROOT_NOT_FOUND");
    }
}
