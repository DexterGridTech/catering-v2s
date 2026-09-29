package com.catering.v2s.terminaldataserver.protocol;

import com.catering.v2s.terminalbinding.api.TerminalCredentialContext;
import com.catering.v2s.terminalbinding.api.TerminalCredentialParser;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Credential;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/** Validates and serializes the closed JSON message shapes declared by the shared protocol. */
@Component
public final class TerminalConnectionFrameCodec {
    private static final long MAX_SAFE_INTEGER = 9_007_199_254_740_991L;

    private final ObjectMapper objectMapper;
    private final TerminalConnectionProtocol protocol;

    public TerminalConnectionFrameCodec(
            @Qualifier("tds-wire-object-mapper") ObjectMapper objectMapper, TerminalConnectionProtocol protocol) {
        this.objectMapper = objectMapper;
        this.protocol = protocol;
    }

    public Authenticate authenticate(String groupWorkspaceKey, String serialized) {
        JsonNode message = readMessage("AUTHENTICATE", serialized);
        String terminalRefText = requiredUtf8Text(message, "terminalRef", 1, 128);
        UUID terminalRef;
        try {
            terminalRef = UUID.fromString(terminalRefText);
        } catch (IllegalArgumentException malformed) {
            throw invalidMessage();
        }
        if (!terminalRef.toString().equalsIgnoreCase(terminalRefText)) throw invalidMessage();
        String deviceId = requiredUtf8Text(message, "deviceId", 1, 128);
        String appVersion = requiredUtf8Text(message, "appVersion", 1, 64);
        String serializedCredential = requiredUtf8Text(message, "terminalCredential", 1, 128);
        TerminalCredentialContext parsed;
        try {
            parsed = TerminalCredentialParser.parseCredential(serializedCredential);
        } catch (IllegalArgumentException malformed) {
            throw invalidMessage();
        }
        try (parsed) {
            byte[] digest = parsed.secretDigest();
            try {
                return new Authenticate(
                        new Credential(groupWorkspaceKey, terminalRef, parsed.generation(), digest, deviceId),
                        appVersion);
            } finally {
                Arrays.fill(digest, (byte) 0);
            }
        }
    }

    public Ping ping(String serialized) {
        JsonNode message = readMessage("PING", serialized);
        JsonNode sequence = message.get("seq");
        if (sequence == null
                || !sequence.isIntegralNumber()
                || !sequence.canConvertToLong()
                || sequence.asLong() < 1
                || sequence.asLong() > MAX_SAFE_INTEGER) {
            throw invalidMessage();
        }
        String clientTimestamp = requiredUtf8Text(message, "clientTs", 1, 64);
        JsonNode rtt = message.get("lastRttMs");
        if (rtt == null || !rtt.isNumber() || !Double.isFinite(rtt.asDouble()) || rtt.asDouble() < 0) {
            throw invalidMessage();
        }
        return new Ping(sequence.asLong(), utcInstant(clientTimestamp), rtt.asDouble());
    }

    public String sessionReady(
            String sessionId, String nodeId, Instant serverTime, long heartbeatIntervalMs, long heartbeatTimeoutMs) {
        requireUtf8Length(sessionId, 1, 128);
        requireUtf8Length(nodeId, 1, 128);
        if (serverTime == null || heartbeatIntervalMs < 1_000 || heartbeatTimeoutMs < heartbeatIntervalMs * 2) {
            throw new IllegalArgumentException("TDS_SESSION_READY_INVALID");
        }
        ObjectNode message = objectMapper.createObjectNode();
        message.put("type", "SESSION_READY");
        message.put("sessionId", sessionId);
        message.put("nodeId", nodeId);
        message.put("serverTime", serverTime.toString());
        message.put("heartbeatIntervalMs", heartbeatIntervalMs);
        message.put("heartbeatTimeoutMs", heartbeatTimeoutMs);
        return serialize(message);
    }

    public String pong(long sequence, Instant serverTime) {
        if (sequence < 1 || sequence > MAX_SAFE_INTEGER || serverTime == null) {
            throw new IllegalArgumentException("TDS_PONG_INVALID");
        }
        ObjectNode message = objectMapper.createObjectNode();
        message.put("type", "PONG");
        message.put("seq", sequence);
        message.put("serverTs", serverTime.toString());
        return serialize(message);
    }

    private JsonNode readMessage(String type, String serialized) {
        if (serialized == null) throw invalidMessage();
        int serializedBytes = serialized.getBytes(StandardCharsets.UTF_8).length;
        if (serializedBytes > protocol.maxCompleteDecompressedMessageBytes()) {
            throw new IllegalArgumentException("TDS_WS_MESSAGE_TOO_BIG");
        }
        try {
            JsonNode message = objectMapper.readTree(serialized);
            if (message == null || !message.isObject()) throw invalidMessage();
            TerminalConnectionProtocol.MessageDefinition definition = protocol.message(type);
            JsonNode typeNode = message.get("type");
            if (typeNode == null || !typeNode.isString() || !type.equals(typeNode.asString())) {
                throw invalidMessage();
            }
            Set<String> expected = new HashSet<>(definition.fieldNames());
            expected.add("type");
            Set<String> actual = new HashSet<>();
            message.propertyNames().forEach(actual::add);
            if (!actual.containsAll(expected)) throw invalidMessage();
            return message;
        } catch (JacksonException malformed) {
            throw invalidMessage();
        }
    }

    private static String requiredUtf8Text(JsonNode parent, String name, int minimumBytes, int maximumBytes) {
        JsonNode value = parent.get(name);
        if (value == null || !value.isString()) throw invalidMessage();
        String text = value.asString();
        requireUtf8Length(text, minimumBytes, maximumBytes);
        return text;
    }

    private static void requireUtf8Length(String text, int minimumBytes, int maximumBytes) {
        if (text == null) throw invalidMessage();
        int byteLength = text.getBytes(StandardCharsets.UTF_8).length;
        if (byteLength < minimumBytes || byteLength > maximumBytes) throw invalidMessage();
    }

    private static Instant utcInstant(String value) {
        if (!value.endsWith("Z")) throw invalidMessage();
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException malformed) {
            throw invalidMessage();
        }
    }

    private String serialize(ObjectNode message) {
        try {
            String serialized = objectMapper.writeValueAsString(message);
            if (serialized.getBytes(StandardCharsets.UTF_8).length > protocol.maxCompleteDecompressedMessageBytes()) {
                throw new IllegalStateException("TDS_WS_MESSAGE_TOO_BIG");
            }
            return serialized;
        } catch (JacksonException failure) {
            throw new IllegalStateException("TDS_WS_SERIALIZATION_FAILED", failure);
        }
    }

    private static IllegalArgumentException invalidMessage() {
        return new IllegalArgumentException("TDS_WS_MESSAGE_INVALID");
    }

    public record Authenticate(Credential credential, String appVersion) {}

    public record Ping(long sequence, Instant clientTimestamp, double lastRttMs) {}
}
