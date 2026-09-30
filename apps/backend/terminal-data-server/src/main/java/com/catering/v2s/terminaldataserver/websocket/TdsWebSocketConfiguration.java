package com.catering.v2s.terminaldataserver.websocket;

import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionProtocol;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.reactor.netty.NettyServerCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.config.WebFluxConfigurer;
import org.springframework.web.reactive.handler.SimpleUrlHandlerMapping;
import org.springframework.web.reactive.socket.server.WebSocketService;
import org.springframework.web.reactive.socket.server.support.HandshakeWebSocketService;
import org.springframework.web.reactive.socket.server.upgrade.ReactorNettyRequestUpgradeStrategy;
import reactor.core.scheduler.Scheduler;
import reactor.netty.http.server.WebsocketServerSpec;

/** Owns the TDS WebSocket route, native compression bounds, and message-limit close mapping. */
@Configuration(proxyBeanMethods = false)
public class TdsWebSocketConfiguration implements WebFluxConfigurer {
    private final TerminalConnectionProtocol protocol;
    private final WebSocketService webSocketService;
    private final Scheduler logScheduler;

    public TdsWebSocketConfiguration(
            TerminalConnectionProtocol protocol,
            @Qualifier("tds-log-worker") Scheduler logScheduler) {
        this.protocol = protocol;
        this.logScheduler = logScheduler;
        ReactorNettyRequestUpgradeStrategy upgradeStrategy =
                new ReactorNettyRequestUpgradeStrategy(() -> WebsocketServerSpec.builder()
                        .compress(true)
                        .maxDecompressionBufferSize(protocol.maxDecompressedMessageBytes())
                        .maxFramePayloadLength(protocol.maxFramePayloadBytes()));
        this.webSocketService = new HandshakeWebSocketService(upgradeStrategy);
    }

    @Override
    public WebSocketService getWebSocketService() {
        return webSocketService;
    }

    @Bean
    SimpleUrlHandlerMapping tdsWebSocketHandlerMapping(TdsWebSocketHandler handler) {
        return new SimpleUrlHandlerMapping(Map.of(protocol.webSocketRoutePattern(), handler), -1);
    }

    @Bean
    NettyServerCustomizer tdsWebSocketPipelineCustomizer() {
        return server -> server.doOnChannelInit((observer, channel, remoteAddress) ->
                TdsWebSocketPipelineInstaller.install(
                        channel.pipeline(),
                        protocol.maxCompleteDecompressedMessageBytes(),
                        protocol.oversizedMessageCloseCode(),
                        logScheduler));
    }
}
