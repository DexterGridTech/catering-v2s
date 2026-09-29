package com.catering.v2s.terminaldataserver.protocol;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.core.StreamReadConstraints;
import tools.jackson.core.StreamReadFeature;
import tools.jackson.core.json.JsonFactory;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/** Builds the bounded mapper used only for untrusted terminal and PostgreSQL notification JSON. */
@Configuration(proxyBeanMethods = false)
public class TdsWireJsonConfiguration {
    static final int MAX_WIRE_JSON_DOCUMENT_CHARS = 65_536;
    static final int MAX_WIRE_JSON_TOKENS = MAX_WIRE_JSON_DOCUMENT_CHARS;
    static final int MAX_WIRE_JSON_DEPTH = 64;
    static final int MAX_WIRE_JSON_STRING_CHARS = MAX_WIRE_JSON_DOCUMENT_CHARS;
    static final int MAX_WIRE_JSON_NAME_CHARS = MAX_WIRE_JSON_DOCUMENT_CHARS;
    static final int MAX_WIRE_JSON_NUMBER_CHARS = MAX_WIRE_JSON_DOCUMENT_CHARS;

    @Bean("tds-wire-object-mapper")
    ObjectMapper tdsWireObjectMapper() {
        return createWireObjectMapper();
    }

    public static ObjectMapper createWireObjectMapper() {
        JsonFactory factory = JsonFactory.builder()
                .streamReadConstraints(StreamReadConstraints.builder()
                        .maxDocumentLength(MAX_WIRE_JSON_DOCUMENT_CHARS)
                        .maxTokenCount(MAX_WIRE_JSON_TOKENS)
                        .maxNestingDepth(MAX_WIRE_JSON_DEPTH)
                        .maxStringLength(MAX_WIRE_JSON_STRING_CHARS)
                        .maxNameLength(MAX_WIRE_JSON_NAME_CHARS)
                        .maxNumberLength(MAX_WIRE_JSON_NUMBER_CHARS)
                        .build())
                .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
                .build();
        return JsonMapper.builder(factory)
                .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
                .build();
    }
}
