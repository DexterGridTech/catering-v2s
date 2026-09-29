package com.catering.v2s.terminaldataserver.config;

import com.catering.v2s.terminaldataserver.TerminalDataServerApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import reactor.blockhound.BlockHound;

/** Starts the real TDS application with the pinned BlockHound detector for managed V-S8 proof. */
public final class TdsAcceptanceBlockHoundLauncher {
    private TdsAcceptanceBlockHoundLauncher() {}

    public static void main(String[] args) {
        BlockHound.install();
        System.out.println("event=tds_acceptance_blockhound_installed version=1.0.17.RELEASE");
        new SpringApplicationBuilder(
                        TerminalDataServerApplication.class, TdsAcceptanceBlockHoundProbeConfiguration.class)
                .web(WebApplicationType.REACTIVE)
                .run(args);
    }
}
