package com.catering.v2s.app.configuration;

import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewItem;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewItemExtensionFieldsItem;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewPage;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.module.SimpleModule;
import java.io.IOException;
import java.util.List;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Keeps the unchanged hierarchy wire free of the optional flat-list projection fields. */
@Configuration
public class OrganizationOverviewWireSerializationConfiguration implements WebMvcConfigurer {
    @Override
    public void extendMessageConverters(List<HttpMessageConverter<?>> converters) {
        converters.stream()
                .filter(MappingJackson2HttpMessageConverter.class::isInstance)
                .map(MappingJackson2HttpMessageConverter.class::cast)
                .forEach(converter -> configure(converter.getObjectMapper()));
        converters.stream()
                .filter(JacksonJsonHttpMessageConverter.class::isInstance)
                .map(JacksonJsonHttpMessageConverter.class::cast)
                .forEach(OrganizationOverviewWireSerializationConfiguration::configure);
    }

    static void configure(ObjectMapper mapper) {
        SimpleModule legacyJsonNodeBridge = new SimpleModule("tools-jackson-json-node-bridge");
        legacyJsonNodeBridge.addSerializer(tools.jackson.databind.JsonNode.class, new JsonSerializer<>() {
            @Override
            public void serialize(
                    tools.jackson.databind.JsonNode value,
                    JsonGenerator generator,
                    com.fasterxml.jackson.databind.SerializerProvider serializers)
                    throws IOException {
                serializers.defaultSerializeValue(mapper.readTree(value.toString()), generator);
            }
        });
        mapper.registerModule(legacyJsonNodeBridge);
        mapper.addMixIn(OrganizationOverviewItem.class, OmitNullFlatProjectionFields.class);
    }

    static void configure(JacksonJsonHttpMessageConverter converter) {
        tools.jackson.databind.json.JsonMapper mapper = converter
                .getMapper()
                .rebuild()
                .addMixIn(OrganizationOverviewItem.class, OmitNullFlatProjectionFields.class)
                .build();
        converter.registerMappersForType(
                OrganizationOverviewPage.class, mappers -> mappers.put(MediaType.APPLICATION_JSON, mapper));
        converter.registerMappersForType(
                OrganizationOverviewItem.class, mappers -> mappers.put(MediaType.APPLICATION_JSON, mapper));
    }

    private abstract static class OmitNullFlatProjectionFields {
        @JsonInclude(JsonInclude.Include.NON_NULL)
        abstract tools.jackson.databind.JsonNode extensionValues();

        @JsonInclude(JsonInclude.Include.NON_NULL)
        abstract Long extensionRuleRevision();

        @JsonInclude(JsonInclude.Include.NON_NULL)
        abstract List<OrganizationOverviewItemExtensionFieldsItem> extensionFields();
    }
}
