package com.catering.v2s.terminaldataserver.protocol;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import com.catering.v2s.terminalbinding.domain.TerminalCredentialDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class TerminalConnectionFrameCodecTest {
    private static final String GROUP_KEY = "group-example";
    private static final UUID TERMINAL_REF = UUID.fromString("2643118e-0f9b-47bb-82a4-f3d482d9a01d");
    private static final String SECRET = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[32]);

    private final TerminalConnectionFrameCodec codec = new TerminalConnectionFrameCodec(
            TdsWireJsonConfiguration.createWireObjectMapper(),
            new TerminalConnectionProtocol(JsonMapper.builder().build()));

    @Test
    void parsesTheAnonymousAuthenticateFrameIntoTheNarrowVerifierCredential() {
        TerminalConnectionFrameCodec.Authenticate authenticate = codec.authenticate(
                GROUP_KEY,
                "{\"type\":\"AUTHENTICATE\",\"terminalRef\":\"" + TERMINAL_REF
                        + "\",\"terminalCredential\":\"7." + SECRET
                        + "\",\"deviceId\":\"device-1\",\"appVersion\":\"1.2.3\"}");

        assertThat(authenticate.credential().groupWorkspaceKey()).isEqualTo(GROUP_KEY);
        assertThat(authenticate.credential().terminalRef()).isEqualTo(TERMINAL_REF);
        assertThat(authenticate.credential().generation()).isEqualTo(7);
        byte[] expectedDigest = TerminalCredentialDigest.sha256(new byte[32]);
        assertThat(authenticate.credential().secretDigest()).containsExactly(expectedDigest);
        assertThat(authenticate.appVersion()).isEqualTo("1.2.3");
        assertThat(authenticate.toString()).doesNotContain(SECRET);
    }

    @Test
    void rejectsCredentialAliasesExtraFieldsDuplicatesAndOversizedUtf8Text() {
        for (String credential : new String[] {"07." + SECRET, "+7." + SECRET, "7." + SECRET + "="}) {
            assertInvalid(authenticateFrame(credential, "device-1", "1.2.3"));
        }
        assertInvalid(authenticateFrame("7." + SECRET, "终".repeat(43), "1.2.3"));
        assertInvalid(authenticateFrame("7." + SECRET, "device-1", "1.2.3", ",\"extra\":true"));
        assertInvalid("{\"type\":\"AUTHENTICATE\",\"terminalRef\":\"" + TERMINAL_REF
                + "\",\"terminalCredential\":\"7." + SECRET
                + "\",\"deviceId\":\"device-1\",\"appVersion\":\"1\",\"appVersion\":\"2\"}");
    }

    @Test
    void acceptsOnlyClosedPingShapeWithSafeSequenceUtcTimeAndFiniteRtt() {
        TerminalConnectionFrameCodec.Ping ping =
                codec.ping("{\"type\":\"PING\",\"seq\":4,\"clientTs\":\"2026-09-26T12:00:00Z\",\"lastRttMs\":12.5}");

        assertThat(ping.sequence()).isEqualTo(4);
        assertThat(ping.clientTimestamp()).isEqualTo(Instant.parse("2026-09-26T12:00:00Z"));
        assertThat(ping.lastRttMs()).isEqualTo(12.5);
        for (String invalid : new String[] {
            "{\"type\":\"PING\",\"seq\":0,\"clientTs\":\"2026-09-26T12:00:00Z\",\"lastRttMs\":0}",
            "{\"type\":\"PING\",\"seq\":1.5,\"clientTs\":\"2026-09-26T12:00:00Z\",\"lastRttMs\":0}",
            "{\"type\":\"PING\",\"seq\":1,\"clientTs\":\"2026-09-26T12:00:00+00:00\",\"lastRttMs\":0}",
            "{\"type\":\"PING\",\"seq\":1,\"clientTs\":\"2026-09-26T12:00:00Z\",\"lastRttMs\":-1}"
        }) {
            assertInvalidPing(invalid);
        }
    }

    @Test
    void rejectsTrailingJsonAndInputsBeyondJacksonWireConstraints() {
        String validPing = "{\"type\":\"PING\",\"seq\":4,\"clientTs\":\"2026-09-26T12:00:00Z\",\"lastRttMs\":12.5}";
        assertInvalidPing(validPing + " {}");

        String manyUnknownFields = validPing.substring(0, validPing.length() - 1)
                + ",\"x1\":0,\"x2\":0,\"x3\":0,\"x4\":0,\"x5\":0,\"x6\":0,\"x7\":0,\"x8\":0,"
                + "\"x9\":0,\"x10\":0,\"x11\":0,\"x12\":0,\"x13\":0,\"x14\":0,\"x15\":0,\"x16\":0}";
        assertInvalidPing(manyUnknownFields);

        String nestedUnknownField = validPing.substring(0, validPing.length() - 1) + ",\"x\":{\"y\":{}}}";
        assertInvalidPing(nestedUnknownField);
    }

    @Test
    void serializesSessionReadyAndPongUsingTheSharedMessageNames() throws Exception {
        String ready = codec.sessionReady("session-1", "tds-1", Instant.parse("2026-09-26T12:00:00Z"), 30_000, 90_000);
        String pong = codec.pong(4, Instant.parse("2026-09-26T12:00:01Z"));
        var mapper = JsonMapper.builder().build();

        assertThat(mapper.readTree(ready).path("type").asString()).isEqualTo("SESSION_READY");
        assertThat(mapper.readTree(ready).path("heartbeatTimeoutMs").asLong()).isEqualTo(90_000);
        assertThat(mapper.readTree(pong).path("type").asString()).isEqualTo("PONG");
        assertThat(mapper.readTree(pong).path("seq").asLong()).isEqualTo(4);
    }

    private void assertInvalid(String frame) {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> codec.authenticate(GROUP_KEY, frame))
                .withMessage("TDS_WS_MESSAGE_INVALID");
    }

    private void assertInvalidPing(String frame) {
        assertThatIllegalArgumentException().isThrownBy(() -> codec.ping(frame)).withMessage("TDS_WS_MESSAGE_INVALID");
    }

    private static String authenticateFrame(String credential, String deviceId, String appVersion) {
        return "{\"type\":\"AUTHENTICATE\",\"terminalRef\":\"" + TERMINAL_REF
                + "\",\"terminalCredential\":\"" + credential + "\",\"deviceId\":\"" + deviceId
                + "\",\"appVersion\":\"" + appVersion + "\"}";
    }

    private static String authenticateFrame(String credential, String deviceId, String appVersion, String suffix) {
        return authenticateFrame(credential, deviceId, appVersion).replace("}", suffix + "}");
    }
}
