package com.catering.v2s.terminaldataserver.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.WebFilter;
import reactor.blockhound.BlockingOperationError;

/** Acceptance-only event-loop probe; this configuration is absent from the production boot jar. */
@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(prefix = "v2s.tds.acceptance", name = "blockhound-probe-enabled", havingValue = "true")
public class TdsAcceptanceBlockHoundProbeConfiguration {
    public static final String PATH = "/__acceptance/blockhound-probe";
    public static final String RESULT_HEADER = "X-TDS-BlockHound-Probe";

    @Bean
    WebFilter tdsAcceptanceBlockHoundProbe() {
        return (exchange, chain) -> {
            if (!PATH.equals(exchange.getRequest().getPath().value())) return chain.filter(exchange);
            var response = exchange.getResponse();
            try {
                Thread.sleep(1);
                response.setStatusCode(HttpStatus.INTERNAL_SERVER_ERROR);
                response.getHeaders().set(RESULT_HEADER, "NOT_DETECTED");
                System.out.println("event=tds_acceptance_blockhound_probe result=NOT_DETECTED");
            } catch (BlockingOperationError detected) {
                response.setStatusCode(HttpStatus.NO_CONTENT);
                response.getHeaders().set(RESULT_HEADER, "DETECTED");
                System.out.println("event=tds_acceptance_blockhound_probe result=DETECTED");
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                response.setStatusCode(HttpStatus.INTERNAL_SERVER_ERROR);
                response.getHeaders().set(RESULT_HEADER, "INTERRUPTED");
                System.out.println("event=tds_acceptance_blockhound_probe result=INTERRUPTED");
            }
            return response.setComplete();
        };
    }
}
