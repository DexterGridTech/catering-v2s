package com.catering.v2s.terminaldataserver.protocol;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import tools.jackson.core.StreamReadFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Runtime view of the repository-owned terminal WebSocket protocol contract. */
@Component
public final class TerminalConnectionProtocol {
    private static final String RESOURCE = "protocol/terminal-connection-protocol.json";

    private final Map<String, MessageDefinition> messages;
    private final int applicationCloseCode;
    private final Set<String> applicationCloseReasons;
    private final Set<Integer> standardCloseCodes;
    private final int maxFramePayloadBytes;
    private final int maxDecompressedMessageBytes;
    private final int maxCompleteDecompressedMessageBytes;

    @Autowired
    public TerminalConnectionProtocol(ObjectMapper objectMapper) {
        this(loadContract(objectMapper
                .rebuild()
                .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
                .build()));
    }

    private TerminalConnectionProtocol(JsonNode contract) {
        JsonNode messageNodes = requiredArray(contract, "messages");
        Map<String, MessageDefinition> loadedMessages = new HashMap<>();
        for (JsonNode messageNode : messageNodes) {
            String type = requiredText(messageNode, "type");
            JsonNode fields = requiredObject(messageNode, "fields");
            Set<String> fieldNames = new HashSet<>();
            fields.propertyNames().forEach(fieldNames::add);
            String additionalFields = requiredText(messageNode, "additionalFields");
            if (!"ignore".equals(additionalFields)) throw invalidContract("unknown additional-fields handling");
            MessageDefinition definition = new MessageDefinition(
                    type,
                    requiredText(messageNode, "direction"),
                    messageNode.path("firstMessage").asBoolean(false),
                    messageNode.path("maxSerializedUtf8Bytes").asInt(0),
                    Set.copyOf(fieldNames),
                    true);
            if (loadedMessages.putIfAbsent(type, definition) != null) {
                throw invalidContract("duplicate message type");
            }
        }
        if (loadedMessages.isEmpty()) throw invalidContract("messages are empty");
        messages = Map.copyOf(loadedMessages);

        JsonNode close = requiredObject(contract, "close");
        JsonNode application = requiredObject(close, "application");
        applicationCloseCode = requiredPositiveInteger(application, "code");
        applicationCloseReasons = readUniqueTextArray(application, "reasons");
        if (applicationCloseReasons.isEmpty()) throw invalidContract("application close reasons are empty");

        Set<Integer> loadedStandardCloseCodes = new HashSet<>();
        for (JsonNode exception : requiredArray(close, "standardExceptions")) {
            int code = requiredPositiveInteger(exception, "code");
            if (!loadedStandardCloseCodes.add(code)) {
                throw invalidContract("duplicate standard close code");
            }
        }
        standardCloseCodes = Set.copyOf(loadedStandardCloseCodes);

        JsonNode limits = requiredObject(requiredObject(contract, "compression"), "limits");
        maxFramePayloadBytes = requiredPositiveInteger(limits, "maxFramePayloadBytes");
        maxDecompressedMessageBytes = requiredPositiveInteger(limits, "maxDecompressedMessageBytes");
        maxCompleteDecompressedMessageBytes = requiredPositiveInteger(limits, "maxCompleteDecompressedMessageBytes");
    }

    public MessageDefinition message(String type) {
        MessageDefinition definition = messages.get(type);
        if (definition == null) throw new IllegalArgumentException("unknown terminal protocol message type");
        return definition;
    }

    public Set<String> messageTypes() {
        return messages.keySet();
    }

    public Close applicationClose(String reason) {
        if (!applicationCloseReasons.contains(reason)) {
            throw new IllegalArgumentException("unknown terminal application close reason");
        }
        return new Close(applicationCloseCode, reason);
    }

    public Close standardClose(int code) {
        if (!standardCloseCodes.contains(code)) {
            throw new IllegalArgumentException("unknown terminal standard close code");
        }
        return new Close(code, "");
    }

    public Set<String> applicationCloseReasons() {
        return applicationCloseReasons;
    }

    public Set<Integer> standardCloseCodes() {
        return standardCloseCodes;
    }

    public int maxFramePayloadBytes() {
        return maxFramePayloadBytes;
    }

    public int maxDecompressedMessageBytes() {
        return maxDecompressedMessageBytes;
    }

    public int maxCompleteDecompressedMessageBytes() {
        return maxCompleteDecompressedMessageBytes;
    }

    private static JsonNode loadContract(ObjectMapper objectMapper) {
        try (InputStream input =
                TerminalConnectionProtocol.class.getClassLoader().getResourceAsStream(RESOURCE)) {
            if (input == null) throw invalidContract("classpath resource is missing");
            JsonNode contract = objectMapper.readTree(input);
            if (contract == null || !contract.isObject()) throw invalidContract("root must be an object");
            return contract;
        } catch (IOException exception) {
            throw new IllegalStateException("TDS_PROTOCOL_RESOURCE_INVALID: cannot read shared protocol", exception);
        }
    }

    private static JsonNode requiredObject(JsonNode parent, String name) {
        JsonNode value = parent.get(name);
        if (value == null || !value.isObject()) throw invalidContract("object field is invalid: " + name);
        return value;
    }

    private static JsonNode requiredArray(JsonNode parent, String name) {
        JsonNode value = parent.get(name);
        if (value == null || !value.isArray()) throw invalidContract("array field is invalid: " + name);
        return value;
    }

    private static String requiredText(JsonNode parent, String name) {
        JsonNode value = parent.get(name);
        if (value == null || !value.isString() || value.asString().isBlank()) {
            throw invalidContract("text field is invalid: " + name);
        }
        return value.asString();
    }

    private static int requiredPositiveInteger(JsonNode parent, String name) {
        JsonNode value = parent.get(name);
        if (value == null || !value.isIntegralNumber() || !value.canConvertToInt() || value.asInt() < 1) {
            throw invalidContract("positive integer field is invalid: " + name);
        }
        return value.asInt();
    }

    private static Set<String> readUniqueTextArray(JsonNode parent, String name) {
        Set<String> values = new HashSet<>();
        for (JsonNode value : requiredArray(parent, name)) {
            if (!value.isString() || value.asString().isBlank() || !values.add(value.asString())) {
                throw invalidContract("text array is invalid: " + name);
            }
        }
        return Set.copyOf(values);
    }

    private static IllegalStateException invalidContract(String detail) {
        return new IllegalStateException("TDS_PROTOCOL_RESOURCE_INVALID: " + detail);
    }

    public record MessageDefinition(
            String type,
            String direction,
            boolean firstMessage,
            int maxSerializedUtf8Bytes,
            Set<String> fieldNames,
            boolean additionalFieldsAllowed) {}

    public record Close(int code, String reason) {}
}
