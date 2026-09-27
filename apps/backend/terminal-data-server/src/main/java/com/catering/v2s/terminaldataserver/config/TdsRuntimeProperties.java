package com.catering.v2s.terminaldataserver.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Groups external runtime limits and timing under the TDS-owned configuration prefix. */
@ConfigurationProperties("v2s.tds")
public record TdsRuntimeProperties(
        String maxUnauthenticatedConnections,
        String maxTrackedSessions,
        @DefaultValue("30000") long heartbeatIntervalMs,
        @DefaultValue("90000") long heartbeatTimeoutMs,
        @DefaultValue("15000") long stateWriteIntervalMs,
        @DefaultValue("10000") long drainWindowMs) {}
