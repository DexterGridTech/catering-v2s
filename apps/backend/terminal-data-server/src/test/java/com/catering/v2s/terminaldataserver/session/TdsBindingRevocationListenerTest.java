package com.catering.v2s.terminaldataserver.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.catering.v2s.terminaldataserver.protocol.TdsWireJsonConfiguration;
import com.catering.v2s.terminaldataserver.session.TdsBindingRevocationListener.Revocation;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class TdsBindingRevocationListenerTest {
    private static final UUID TERMINAL = UUID.fromString("95e948ef-2fe6-4b18-b6d5-509d023ea249");
    private final ObjectMapper objectMapper = TdsWireJsonConfiguration.createWireObjectMapper();

    @Test
    void parsesTheVersionedRevocationPayload() {
        assertThat(TdsBindingRevocationListener.parsePayload(
                        "{\"v\":1,\"terminalRef\":\"" + TERMINAL + "\",\"revokedGeneration\":2}", objectMapper))
                .isEqualTo(new Revocation(TERMINAL, 2));
    }

    @Test
    void rejectsMalformedOrOutOfContractPayloads() {
        List<String> invalidPayloads = List.of(
                "not-json",
                "{\"v\":2,\"terminalRef\":\"" + TERMINAL + "\",\"revokedGeneration\":2}",
                "{\"v\":1,\"terminalRef\":\"not-a-uuid\",\"revokedGeneration\":2}",
                "{\"v\":1,\"terminalRef\":\"" + TERMINAL + "\",\"revokedGeneration\":0}",
                "{\"v\":1,\"terminalRef\":\"" + TERMINAL + "\",\"revokedGeneration\":2,\"extra\":true}",
                "{\"v\":1,\"terminalRef\":\"" + TERMINAL + "\",\"revokedGeneration\":2} {}");

        for (String payload : invalidPayloads) {
            assertThatThrownBy(() -> TdsBindingRevocationListener.parsePayload(payload, objectMapper))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("TDS_NOTIFICATION_PAYLOAD_INVALID");
        }
    }
}
