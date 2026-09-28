package com.catering.v2s.terminaldataserver.protocol;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import tools.jackson.databind.json.JsonMapper;

class TerminalConnectionProtocolTest {
    private final TerminalConnectionProtocol protocol =
            new TerminalConnectionProtocol(JsonMapper.builder().build());

    @Test
    void selectsTheProtocolResourceConstructorWhenManagedBySpring() {
        new ApplicationContextRunner()
                .withBean(tools.jackson.databind.ObjectMapper.class, () -> JsonMapper.builder()
                        .build())
                .withUserConfiguration(TerminalConnectionProtocol.class)
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(TerminalConnectionProtocol.class);
                });
    }

    @Test
    void loadsMessageTypesAndFieldClosureFromTheSharedResource() {
        assertThat(protocol.messageTypes()).containsExactlyInAnyOrder("AUTHENTICATE", "SESSION_READY", "PING", "PONG");
        assertThat(protocol.message("AUTHENTICATE").fieldNames())
                .containsExactlyInAnyOrder("terminalRef", "terminalCredential", "deviceId", "appVersion");
        assertThat(protocol.message("AUTHENTICATE").additionalFieldsAllowed()).isTrue();
        assertThat(protocol.message("AUTHENTICATE").firstMessage()).isTrue();
    }

    @Test
    void loadsApplicationAndStandardCloseTuplesFromTheSharedResource() {
        assertThat(protocol.applicationCloseReasons())
                .containsExactlyInAnyOrder(
                        "ACTIVATION_CANCELLED",
                        "CREDENTIAL_INVALID",
                        "GROUP_WORKSPACE_DISABLED",
                        "TERMINAL_DISABLED",
                        "SESSION_REPLACED",
                        "REDIRECT_TO_NEXT_NODE",
                        "NODE_BUSY",
                        "AUTHENTICATION_TIMEOUT",
                        "HEARTBEAT_TIMEOUT",
                        "SERVER_ERROR",
                        "NETWORK_ERROR",
                        "UNKNOWN");
        assertThat(protocol.applicationClose("SESSION_REPLACED"))
                .isEqualTo(new TerminalConnectionProtocol.Close(4000, "SESSION_REPLACED"));
        assertThat(protocol.standardClose(1002)).isEqualTo(new TerminalConnectionProtocol.Close(1002, ""));
        assertThat(protocol.standardClose(1009)).isEqualTo(new TerminalConnectionProtocol.Close(1009, ""));
        assertThatIllegalArgumentException().isThrownBy(() -> protocol.applicationClose("LOGIN_REQUIRED"));
    }

    @Test
    void loadsFrameAndDecompressionBoundsFromTheSharedResource() {
        assertThat(protocol.maxFramePayloadBytes()).isEqualTo(65_536);
        assertThat(protocol.maxDecompressedMessageBytes()).isEqualTo(65_536);
        assertThat(protocol.maxCompleteDecompressedMessageBytes()).isEqualTo(65_536);
        assertThat(protocol.standardCloseCodes()).containsExactlyInAnyOrder(1002, 1009);
    }
}
