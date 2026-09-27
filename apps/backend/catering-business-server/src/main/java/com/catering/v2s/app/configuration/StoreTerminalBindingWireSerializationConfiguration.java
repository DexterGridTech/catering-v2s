package com.catering.v2s.app.configuration;

import com.catering.v2s.app.edge.generated.wire.StoreTerminalBinding;
import com.catering.v2s.app.edge.generated.wire.StoreTerminalDetail;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Omits absent binding fields so the wire retains the exact inactive and active shapes. */
@Configuration
public class StoreTerminalBindingWireSerializationConfiguration implements WebMvcConfigurer {
    @Override
    public void extendMessageConverters(List<HttpMessageConverter<?>> converters) {
        converters.stream()
                .filter(MappingJackson2HttpMessageConverter.class::isInstance)
                .map(MappingJackson2HttpMessageConverter.class::cast)
                .forEach(converter ->
                        converter.getObjectMapper().addMixIn(StoreTerminalBinding.class, OmitNullFields.class));
        converters.stream()
                .filter(JacksonJsonHttpMessageConverter.class::isInstance)
                .map(JacksonJsonHttpMessageConverter.class::cast)
                .forEach(converter -> {
                    tools.jackson.databind.json.JsonMapper mapper = converter
                            .getMapper()
                            .rebuild()
                            .addMixIn(StoreTerminalBinding.class, OmitNullFields.class)
                            .build();
                    converter.registerMappersForType(
                            StoreTerminalDetail.class, mappers -> mappers.put(MediaType.APPLICATION_JSON, mapper));
                });
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    private abstract static class OmitNullFields {}
}
