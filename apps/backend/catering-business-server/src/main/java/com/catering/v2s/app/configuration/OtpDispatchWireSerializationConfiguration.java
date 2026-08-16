package com.catering.v2s.app.configuration;

import com.catering.v2s.app.edge.generated.wire.OperationsPasswordRecoveryOtpSendResponse;
import com.catering.v2s.app.edge.generated.wire.PlatformOtpDispatchResponse;
import com.catering.v2s.app.edge.generated.wire.PublicInvitationOtpSendResponse;
import com.catering.v2s.app.edge.generated.wire.WorkspaceOtpSendResponse;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Keeps debug OTP code omission local to public OTP dispatch wires; global mapper policy is unchanged. */
@Configuration
public class OtpDispatchWireSerializationConfiguration implements WebMvcConfigurer {
    @Override
    public void extendMessageConverters(List<HttpMessageConverter<?>> converters) {
        converters.stream()
                .filter(MappingJackson2HttpMessageConverter.class::isInstance)
                .map(MappingJackson2HttpMessageConverter.class::cast)
                .forEach(converter -> configure(converter.getObjectMapper()));
    }

    static void configure(ObjectMapper mapper) {
        mapper.addMixIn(PlatformOtpDispatchResponse.class, OmitNullFields.class);
        mapper.addMixIn(WorkspaceOtpSendResponse.class, OmitNullFields.class);
        mapper.addMixIn(PublicInvitationOtpSendResponse.class, OmitNullFields.class);
        mapper.addMixIn(OperationsPasswordRecoveryOtpSendResponse.class, OmitNullFields.class);
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    private abstract static class OmitNullFields {}
}
