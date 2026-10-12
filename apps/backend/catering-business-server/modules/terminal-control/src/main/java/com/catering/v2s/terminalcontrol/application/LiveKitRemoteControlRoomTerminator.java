package com.catering.v2s.terminalcontrol.application;

import io.livekit.server.RoomServiceClient;
import io.livekit.server.okhttp.OkHttpFactory;
import java.io.IOException;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/** Performs bounded, best-effort LiveKit cleanup after the owner has committed ENDED. */
@Component
public final class LiveKitRemoteControlRoomTerminator {
    private static final Logger log = LoggerFactory.getLogger(LiveKitRemoteControlRoomTerminator.class);
    private static final long CALL_TIMEOUT_SECONDS = 3;

    private final RoomServiceClient client;

    public LiveKitRemoteControlRoomTerminator(Environment environment) {
        String apiUrl = environment.getProperty("V2S_LIVEKIT_API_URL");
        String apiKey = environment.getProperty("V2S_LIVEKIT_API_KEY");
        String apiSecret = environment.getProperty("V2S_LIVEKIT_API_SECRET");
        this.client = apiUrl == null || apiUrl.isBlank()
                || apiKey == null || apiKey.isBlank()
                || apiSecret == null || apiSecret.length() < 32
                ? null
                : RoomServiceClient.createClient(apiUrl, apiKey, apiSecret,
                        new OkHttpFactory(false, builder -> builder.callTimeout(CALL_TIMEOUT_SECONDS, TimeUnit.SECONDS)),
                        false);
        if (this.client == null) {
            log.atWarn().addKeyValue("event", "TERMINAL_REMOTE_CONTROL_ROOM_CLEANUP_UNAVAILABLE")
                    .addKeyValue("reason", "LIVEKIT_CONFIGURATION_MISSING")
                    .log("event=TERMINAL_REMOTE_CONTROL_ROOM_CLEANUP_UNAVAILABLE");
        }
    }

    public CleanupResult endRoom(String roomName, List<String> participantIdentities) {
        if (client == null) return new CleanupResult(0, false, 1);
        int removed = 0;
        int failures = 0;
        for (String identity : participantIdentities) {
            try {
                var response = client.removeParticipant(roomName, identity).execute();
                if (response.isSuccessful()) removed++;
                else if (response.code() == 404) {
                    // End/replay is idempotent: an already absent participant needs no further action.
                }
                else {
                    failures++;
                    log.atWarn().addKeyValue("event", "TERMINAL_REMOTE_CONTROL_ROOM_CLEANUP_FAILED")
                            .addKeyValue("operation", "REMOVE_PARTICIPANT")
                            .addKeyValue("httpStatus", response.code())
                            .log("event=TERMINAL_REMOTE_CONTROL_ROOM_CLEANUP_FAILED");
                }
            } catch (IOException | RuntimeException failure) {
                failures++;
                log.atWarn().addKeyValue("event", "TERMINAL_REMOTE_CONTROL_ROOM_CLEANUP_FAILED")
                        .addKeyValue("operation", "REMOVE_PARTICIPANT")
                        .addKeyValue("failureType", failure.getClass().getSimpleName())
                        .log("event=TERMINAL_REMOTE_CONTROL_ROOM_CLEANUP_FAILED");
            }
        }
        boolean deleted = false;
        try {
            var response = client.deleteRoom(roomName).execute();
            deleted = response.isSuccessful() || response.code() == 404;
            if (!deleted) {
                failures++;
                log.atWarn().addKeyValue("event", "TERMINAL_REMOTE_CONTROL_ROOM_CLEANUP_FAILED")
                        .addKeyValue("operation", "DELETE_ROOM")
                        .addKeyValue("httpStatus", response.code())
                        .log("event=TERMINAL_REMOTE_CONTROL_ROOM_CLEANUP_FAILED");
            }
        } catch (IOException | RuntimeException failure) {
            failures++;
            log.atWarn().addKeyValue("event", "TERMINAL_REMOTE_CONTROL_ROOM_CLEANUP_FAILED")
                    .addKeyValue("operation", "DELETE_ROOM")
                    .addKeyValue("failureType", failure.getClass().getSimpleName())
                    .log("event=TERMINAL_REMOTE_CONTROL_ROOM_CLEANUP_FAILED");
        }
        return new CleanupResult(removed, deleted, failures);
    }

    public record CleanupResult(int participantsRemoved, boolean roomDeleted, int failures) {}
}
