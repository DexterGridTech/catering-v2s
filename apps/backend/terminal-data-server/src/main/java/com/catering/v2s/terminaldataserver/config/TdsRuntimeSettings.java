package com.catering.v2s.terminaldataserver.config;

import java.time.Duration;

/** Validated TDS limits and fixed single-node session timing. */
public record TdsRuntimeSettings(
        int maxUnauthenticatedConnections,
        int maxTrackedSessions,
        Duration heartbeatInterval,
        Duration heartbeatTimeout,
        Duration stateWriteInterval,
        Duration authenticationFirstFrameTimeout,
        Duration authenticationOverallTimeout,
        Duration drainWindow,
        Duration readinessWithdrawalWait,
        String nodeId) {

    public static final Duration AUTHENTICATION_FIRST_FRAME_TIMEOUT = Duration.ofSeconds(10);
    public static final Duration AUTHENTICATION_OVERALL_TIMEOUT = Duration.ofSeconds(15);
    public static final Duration MAX_DRAIN_WINDOW = Duration.ofSeconds(10);
    public static final Duration MIN_READINESS_WITHDRAWAL_WAIT = Duration.ofSeconds(2);
    public static final Duration MAX_READINESS_WITHDRAWAL_WAIT = Duration.ofSeconds(10);
    public static final Duration DEFAULT_READINESS_WITHDRAWAL_WAIT = Duration.ofSeconds(3);
    public static final Duration DEFAULT_HEARTBEAT_INTERVAL = Duration.ofSeconds(30);
    public static final Duration DEFAULT_HEARTBEAT_TIMEOUT = Duration.ofSeconds(90);
    public static final Duration DEFAULT_STATE_WRITE_INTERVAL = Duration.ofSeconds(15);
    public static final String SINGLE_NODE_ID = "terminal-data-server";

    public TdsRuntimeSettings {
        if (maxUnauthenticatedConnections < 1) {
            throw new IllegalArgumentException("maxUnauthenticatedConnections is invalid");
        }
        if (maxTrackedSessions < 1) {
            throw new IllegalArgumentException("maxTrackedSessions is invalid");
        }
        if (heartbeatInterval == null || heartbeatInterval.compareTo(Duration.ofSeconds(1)) < 0) {
            throw new IllegalArgumentException("heartbeatInterval is invalid");
        }
        if (heartbeatTimeout == null || heartbeatTimeout.compareTo(heartbeatInterval.multipliedBy(2)) < 0) {
            throw new IllegalArgumentException("heartbeatTimeout is invalid");
        }
        if (stateWriteInterval == null
                || stateWriteInterval.isNegative()
                || stateWriteInterval.isZero()
                || stateWriteInterval.compareTo(heartbeatTimeout) > 0) {
            throw new IllegalArgumentException("stateWriteInterval is invalid");
        }
        if (authenticationFirstFrameTimeout == null
                || !authenticationFirstFrameTimeout.equals(AUTHENTICATION_FIRST_FRAME_TIMEOUT)
                || authenticationOverallTimeout == null
                || !authenticationOverallTimeout.equals(AUTHENTICATION_OVERALL_TIMEOUT)) {
            throw new IllegalArgumentException("authentication deadlines are invalid");
        }
        if (drainWindow == null
                || drainWindow.isNegative()
                || drainWindow.isZero()
                || drainWindow.compareTo(MAX_DRAIN_WINDOW) > 0) {
            throw new IllegalArgumentException("drainWindow is invalid");
        }
        if (readinessWithdrawalWait == null
                || readinessWithdrawalWait.compareTo(MIN_READINESS_WITHDRAWAL_WAIT) < 0
                || readinessWithdrawalWait.compareTo(MAX_READINESS_WITHDRAWAL_WAIT) > 0) {
            throw new IllegalArgumentException("readinessWithdrawalWait is invalid");
        }
        if (nodeId == null || nodeId.isBlank() || nodeId.length() > 128) {
            throw new IllegalArgumentException("nodeId is invalid");
        }
    }

    public static int parseUnauthenticatedConnectionLimit(String value) {
        if (value == null || !value.matches("[1-9][0-9]{0,9}")) {
            throw new IllegalArgumentException("V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS is invalid");
        }
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS is invalid", exception);
        }
    }

    public static int parseTrackedSessionLimit(String value) {
        if (value == null || !value.matches("[1-9][0-9]{0,9}")) {
            throw new IllegalArgumentException("V2S_TDS_MAX_TRACKED_SESSIONS is invalid");
        }
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("V2S_TDS_MAX_TRACKED_SESSIONS is invalid", exception);
        }
    }

    public static TdsRuntimeSettings from(
            String maxUnauthenticatedConnections,
            String maxTrackedSessions,
            Duration heartbeatInterval,
            Duration heartbeatTimeout,
            Duration stateWriteInterval,
            Duration drainWindow) {
        return from(
                maxUnauthenticatedConnections,
                maxTrackedSessions,
                heartbeatInterval,
                heartbeatTimeout,
                stateWriteInterval,
                drainWindow,
                SINGLE_NODE_ID,
                DEFAULT_READINESS_WITHDRAWAL_WAIT);
    }

    public static TdsRuntimeSettings from(
            String maxUnauthenticatedConnections,
            String maxTrackedSessions,
            Duration heartbeatInterval,
            Duration heartbeatTimeout,
            Duration stateWriteInterval,
            Duration drainWindow,
            String nodeId,
            Duration readinessWithdrawalWait) {
        return new TdsRuntimeSettings(
                parseUnauthenticatedConnectionLimit(maxUnauthenticatedConnections),
                parseTrackedSessionLimit(maxTrackedSessions),
                heartbeatInterval,
                heartbeatTimeout,
                stateWriteInterval,
                AUTHENTICATION_FIRST_FRAME_TIMEOUT,
                AUTHENTICATION_OVERALL_TIMEOUT,
                drainWindow,
                readinessWithdrawalWait,
                nodeId);
    }
}
