package com.catering.v2s.terminaldataserver;

import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApiConfiguration;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.annotation.Import;

/** Starts the separately managed single-node terminal WebSocket runtime. */
@SpringBootApplication(scanBasePackages = "com.catering.v2s.terminaldataserver")
@Import(TerminalCredentialVerificationApiConfiguration.class)
public class TerminalDataServerApplication {
    public static void main(String[] args) {
        new SpringApplicationBuilder(TerminalDataServerApplication.class)
                .web(WebApplicationType.REACTIVE)
                .run(args);
    }
}
