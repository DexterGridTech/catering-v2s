package com.catering.v2s.terminaldataserver.protocol;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import com.catering.v2s.terminalbinding.domain.TerminalCredentialDigest;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class TerminalConnectionFrameCodecTest {
    private static final String GROUP_KEY = "group-example";
    private static final UUID TERMINAL_REF = UUID.fromString("2643118e-0f9b-47bb-82a4-f3d482d9a01d");
    private static final String SECRET = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[32]);

    private final JsonMapper mapper = JsonMapper.builder().build();
    private final TerminalConnectionProtocol protocol = new TerminalConnectionProtocol(mapper);
    private final TerminalConnectionFrameCodec codec =
            new TerminalConnectionFrameCodec(TdsWireJsonConfiguration.createWireObjectMapper(), protocol);

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
    void rejectsCredentialAliasesDuplicatesAndOversizedUtf8Text() {
        for (String credential : new String[] {
            "07." + SECRET,
            "+7." + SECRET,
            "9223372036854775808." + SECRET,
            "7." + SECRET + "=",
            "7." + "A".repeat(42) + "B"
        }) {
            assertInvalid(authenticateFrame(credential, "device-1", "1.2.3"));
        }
        assertInvalid(authenticateFrame("7." + SECRET, "终".repeat(43), "1.2.3"));
        assertInvalid(authenticateFrame("7." + SECRET, "device-1", "终".repeat(22)));
        assertInvalid("{\"type\":\"AUTHENTICATE\",\"terminalRef\":\"" + TERMINAL_REF
                + "\",\"terminalCredential\":\"7." + SECRET
                + "\",\"deviceId\":\"device-1\",\"appVersion\":\"1\",\"appVersion\":\"2\"}");
    }

    @Test
    void ignoresUnknownAuthenticateFieldsWhileStillReadingTheKnownFields() {
        TerminalConnectionFrameCodec.Authenticate authenticate = codec.authenticate(
                GROUP_KEY, authenticateFrame("7." + SECRET, "device-1", "1.2.3", ",\"futureField\":true"));

        assertThat(authenticate.credential().terminalRef()).isEqualTo(TERMINAL_REF);
        assertThat(authenticate.credential().generation()).isEqualTo(7);
        assertThat(authenticate.appVersion()).isEqualTo("1.2.3");
    }

    @Test
    void ignoresUnknownPingFieldsAndStrictlyValidatesKnownFields() {
        TerminalConnectionFrameCodec.Ping ping =
                codec.ping("{\"type\":\"PING\",\"seq\":4,\"clientTs\":\"2026-09-26T12:00:00Z\","
                        + "\"lastRttMs\":12.5,\"futureField\":true}");

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
    void ignoresUnknownStructuredFieldsWithinTheWireLimit() {
        String validPing = "{\"type\":\"PING\",\"seq\":4,\"clientTs\":\"2026-09-26T12:00:00Z\",\"lastRttMs\":12.5}";
        String unknownFieldValue = "{\"items\":[" + "1,".repeat(63) + "1],"
                + "\"nested\":{\"first\":{\"second\":{\"third\":{\"enabled\":true}}}},"
                + "\"longText\":\"" + "x".repeat(4_096) + "\","
                + "\"longNumber\":" + "7".repeat(256) + "}";
        String frame = validPing.substring(0, validPing.length() - 1)
                + ",\"futureField\":" + unknownFieldValue + "}";

        assertThat(frame.getBytes(StandardCharsets.UTF_8).length)
                .isLessThanOrEqualTo(TdsWireJsonConfiguration.MAX_WIRE_JSON_DOCUMENT_CHARS);
        assertThat(codec.ping(frame).sequence()).isEqualTo(4);
    }

    @Test
    void keepsTrailingJsonNestingAndMessageSizeBounds() {
        String validPing = "{\"type\":\"PING\",\"seq\":4,\"clientTs\":\"2026-09-26T12:00:00Z\",\"lastRttMs\":12.5}";
        assertInvalidPing(validPing + " {}");

        String overDepthValue = "[".repeat(TdsWireJsonConfiguration.MAX_WIRE_JSON_DEPTH)
                + "0" + "]".repeat(TdsWireJsonConfiguration.MAX_WIRE_JSON_DEPTH);
        String overDepth = validPing.substring(0, validPing.length() - 1)
                + ",\"futureField\":" + overDepthValue + "}";
        assertInvalidPing(overDepth);

        String oversized = validPing.substring(0, validPing.length() - 1)
                + ",\"futureField\":\"" + "x".repeat(TdsWireJsonConfiguration.MAX_WIRE_JSON_DOCUMENT_CHARS) + "\"}";
        assertThatIllegalArgumentException().isThrownBy(() -> codec.ping(oversized));
    }

    @Test
    void serializesSessionReadyAndPongUsingTheSharedMessageNames() throws Exception {
        String ready = codec.sessionReady("session-1", "tds-1", Instant.parse("2026-09-26T12:00:00Z"), 30_000, 90_000);
        String pong = codec.pong(4, Instant.parse("2026-09-26T12:00:01Z"));
        JsonNode readyNode = mapper.readTree(ready);
        JsonNode pongNode = mapper.readTree(pong);

        assertFieldsMatchProtocol("SESSION_READY", readyNode);
        assertFieldsMatchProtocol("PONG", pongNode);
        assertThat(readyNode)
                .isEqualTo(
                        mapper.readTree(
                                """
                        {"type":"SESSION_READY","sessionId":"session-1","nodeId":"tds-1",
                         "serverTime":"2026-09-26T12:00:00Z","heartbeatIntervalMs":30000,
                         "heartbeatTimeoutMs":90000}
                        """));
        assertThat(pongNode)
                .isEqualTo(
                        mapper.readTree(
                                """
                        {"type":"PONG","seq":4,"serverTs":"2026-09-26T12:00:01Z"}
                        """));
    }

    private void assertFieldsMatchProtocol(String messageType, JsonNode message) {
        Set<String> actual = new HashSet<>();
        message.propertyNames().forEach(actual::add);
        Set<String> expected = new HashSet<>(protocol.message(messageType).fieldNames());
        expected.add("type");
        assertThat(actual).containsExactlyInAnyOrderElementsOf(expected);
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
