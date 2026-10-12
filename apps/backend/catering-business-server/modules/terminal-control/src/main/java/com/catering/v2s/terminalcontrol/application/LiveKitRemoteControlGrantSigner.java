package com.catering.v2s.terminalcontrol.application;

import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.Failure;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.RemoteControlException;
import io.livekit.server.AccessToken;
import io.livekit.server.CanPublish;
import io.livekit.server.CanPublishData;
import io.livekit.server.CanPublishSources;
import io.livekit.server.CanSubscribe;
import io.livekit.server.RoomJoin;
import io.livekit.server.RoomName;
import java.util.List;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/** Mints only short-lived, room-scoped grants; credentials and tokens never enter persistence or logs. */
@Component
public final class LiveKitRemoteControlGrantSigner {
    private final String apiKey;
    private final String apiSecret;
    private final String signalUrl;

    @Autowired
    public LiveKitRemoteControlGrantSigner(Environment environment) {
        this(environment.getProperty("V2S_LIVEKIT_API_KEY"), environment.getProperty("V2S_LIVEKIT_API_SECRET"),
                environment.getProperty("V2S_LIVEKIT_SIGNAL_URL"));
    }

    LiveKitRemoteControlGrantSigner(String apiKey, String apiSecret, String signalUrl) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.signalUrl = signalUrl;
    }

    public String signalUrl() {
        requireConfiguration();
        return signalUrl;
    }

    public String sign(String roomName, String participantIdentity, boolean controller) {
        requireConfiguration();
        try {
            AccessToken token = new AccessToken(apiKey, apiSecret);
            token.setTtl(30_000);
            token.setIdentity(Objects.requireNonNull(participantIdentity, "participantIdentity"));
            token.addGrants(new RoomJoin(true), new RoomName(roomName), new CanSubscribe(true), new CanPublishData(true));
            if (controller) token.addGrants(new CanPublish(false));
            else token.addGrants(new CanPublishSources(List.of("screen_share")));
            return token.toJwt();
        } catch (RuntimeException failure) {
            throw new RemoteControlException(Failure.DEPENDENCY_UNAVAILABLE, failure);
        }
    }

    private void requireConfiguration() {
        if (apiKey == null || apiKey.isBlank() || apiSecret == null || apiSecret.length() < 32
                || signalUrl == null || signalUrl.isBlank()) {
            throw new RemoteControlException(Failure.DEPENDENCY_UNAVAILABLE,
                    new IllegalStateException("LIVEKIT_REMOTE_CONTROL_CONFIGURATION_UNAVAILABLE"));
        }
    }
}
