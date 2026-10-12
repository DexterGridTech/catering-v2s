package com.catering.v2s.terminalcontrol.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.sun.net.httpserver.HttpServer;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.Failure;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.RemoteControlException;
import io.livekit.server.AccessToken;
import io.livekit.server.CanPublishData;
import io.livekit.server.CanPublishSources;
import io.livekit.server.CanSubscribe;
import io.livekit.server.RoomJoin;
import io.livekit.server.RoomName;
import java.net.InetSocketAddress;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import livekit.LivekitRoom;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;

class LiveKitServerSdkContractTest {
    private static final String API_KEY = "test-api-key";
    private static final String API_SECRET = "test-api-secret-with-at-least-32-characters";

    @Test
    void accessTokenUsesTheConfiguredRoomIdentityGrantAndShortTtl() {
        long startedAt = System.currentTimeMillis();
        AccessToken token = new AccessToken(API_KEY, API_SECRET);
        token.setTtl(30_000);
        token.setIdentity("ter-controller-proof");
        token.addGrants(
                new RoomJoin(true),
                new RoomName("ter-proof-room"),
                new CanPublishSources(List.of("screen_share")),
                new CanSubscribe(true),
                new CanPublishData(true));

        var decoded = JWT.require(Algorithm.HMAC256(API_SECRET))
                .withIssuer(API_KEY)
                .build()
                .verify(token.toJwt());
        Map<String, Object> video = decoded.getClaim("video").asMap();

        assertEquals("ter-controller-proof", decoded.getSubject());
        assertEquals(true, video.get("roomJoin"));
        assertEquals("ter-proof-room", video.get("room"));
        assertEquals(List.of("screen_share"), video.get("canPublishSources"));
        assertEquals(true, video.get("canSubscribe"));
        assertEquals(true, video.get("canPublishData"));
        long remainingTtlMs = decoded.getExpiresAt().getTime() - startedAt;
        assertTrue(remainingTtlMs > 25_000 && remainingTtlMs <= 30_000, "configured 30-second token TTL");
    }

    @Test
    void controllerGrantExplicitlyDisallowsMediaPublishing() {
        var decoded = JWT.require(Algorithm.HMAC256(API_SECRET))
                .withIssuer(API_KEY)
                .build()
                .verify(new LiveKitRemoteControlGrantSigner(API_KEY, API_SECRET, "ws://127.0.0.1:7880")
                        .sign("ter-controller-room", "ter-controller-proof", true));
        Map<String, Object> video = decoded.getClaim("video").asMap();

        assertEquals("ter-controller-proof", decoded.getSubject());
        assertEquals("ter-controller-room", video.get("room"));
        assertEquals(true, video.get("canSubscribe"));
        assertEquals(true, video.get("canPublishData"));
        assertEquals(false, video.get("canPublish"));
        assertTrue(video.get("canPublishSources") == null || List.of().equals(video.get("canPublishSources")));
    }

    @Test
    void endpointGrantAllowsOnlyScreenSharePublishing() {
        var decoded = JWT.require(Algorithm.HMAC256(API_SECRET))
                .withIssuer(API_KEY)
                .build()
                .verify(new LiveKitRemoteControlGrantSigner(API_KEY, API_SECRET, "ws://127.0.0.1:7880")
                        .sign("ter-endpoint-room", "ter-endpoint-proof", false));
        Map<String, Object> video = decoded.getClaim("video").asMap();

        assertEquals("ter-endpoint-proof", decoded.getSubject());
        assertEquals(true, video.get("roomJoin"));
        assertEquals("ter-endpoint-room", video.get("room"));
        assertEquals(true, video.get("canSubscribe"));
        assertEquals(true, video.get("canPublishData"));
        assertEquals(List.of("screen_share"), video.get("canPublishSources"));
    }

    @Test
    void missingSignalConfigurationIsATypedDependencyFailureForTheExistingOwnerBoundary() {
        LiveKitRemoteControlGrantSigner signer =
                new LiveKitRemoteControlGrantSigner(API_KEY, API_SECRET, null);

        RemoteControlException failure = assertThrows(RemoteControlException.class,
                () -> signer.sign("ter-room", "ter-endpoint", false));

        assertEquals(Failure.DEPENDENCY_UNAVAILABLE, failure.failure());
        assertEquals("LIVEKIT_REMOTE_CONTROL_CONFIGURATION_UNAVAILABLE", failure.getCause().getMessage());
        assertThrows(RemoteControlException.class, signer::signalUrl);
    }

    @Test
    void productionRoomTerminatorSendsRoomAndParticipantToOfficialServiceEndpoints() throws Exception {
        AtomicReference<String> participantPath = new AtomicReference<>();
        AtomicReference<String> deletePath = new AtomicReference<>();
        AtomicReference<byte[]> participantBody = new AtomicReference<>();
        AtomicReference<byte[]> deleteBody = new AtomicReference<>();
        AtomicReference<String> participantAuthorization = new AtomicReference<>();
        AtomicReference<String> deleteAuthorization = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/twirp/livekit.RoomService/RemoveParticipant", exchange -> {
            participantPath.set(exchange.getRequestURI().getPath());
            participantAuthorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            participantBody.set(exchange.getRequestBody().readAllBytes());
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
        });
        server.createContext("/twirp/livekit.RoomService/DeleteRoom", exchange -> {
            deletePath.set(exchange.getRequestURI().getPath());
            deleteAuthorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            deleteBody.set(exchange.getRequestBody().readAllBytes());
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
        });
        server.start();
        try {
            Environment environment = mock(Environment.class);
            when(environment.getProperty("V2S_LIVEKIT_API_URL"))
                    .thenReturn("http://127.0.0.1:" + server.getAddress().getPort());
            when(environment.getProperty("V2S_LIVEKIT_API_KEY")).thenReturn(API_KEY);
            when(environment.getProperty("V2S_LIVEKIT_API_SECRET")).thenReturn(API_SECRET);

            var result = new LiveKitRemoteControlRoomTerminator(environment)
                    .endRoom("ter-proof-room", List.of("ter-slave-proof"));

            assertEquals(1, result.participantsRemoved());
            assertTrue(result.roomDeleted());
            assertEquals(0, result.failures());
            assertEquals("/twirp/livekit.RoomService/RemoveParticipant", participantPath.get());
            assertEquals("/twirp/livekit.RoomService/DeleteRoom", deletePath.get());

            LivekitRoom.RoomParticipantIdentity removeRequest =
                    LivekitRoom.RoomParticipantIdentity.parseFrom(participantBody.get());
            assertEquals("ter-proof-room", removeRequest.getRoom());
            assertEquals("ter-slave-proof", removeRequest.getIdentity());
            LivekitRoom.DeleteRoomRequest deleteRequest = LivekitRoom.DeleteRoomRequest.parseFrom(deleteBody.get());
            assertEquals("ter-proof-room", deleteRequest.getRoom());

            String header = participantAuthorization.get();
            assertNotNull(header);
            assertTrue(header.startsWith("Bearer "));
            var decoded = JWT.require(Algorithm.HMAC256(API_SECRET))
                    .withIssuer(API_KEY)
                    .build()
                    .verify(header.substring("Bearer ".length()));
            Map<String, Object> video = decoded.getClaim("video").asMap();
            assertEquals(true, video.get("roomAdmin"));
            assertEquals("ter-proof-room", video.get("room"));

            String deleteHeader = deleteAuthorization.get();
            assertNotNull(deleteHeader);
            assertTrue(deleteHeader.startsWith("Bearer "));
            var deleteToken = JWT.require(Algorithm.HMAC256(API_SECRET))
                    .withIssuer(API_KEY)
                    .build()
                    .verify(deleteHeader.substring("Bearer ".length()));
            Map<String, Object> deleteVideo = deleteToken.getClaim("video").asMap();
            assertEquals(true, deleteVideo.get("roomCreate"));
        } finally {
            server.stop(0);
        }
    }
}
