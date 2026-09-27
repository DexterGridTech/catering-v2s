package com.catering.v2s.terminaldataserver.websocket;

import io.netty.channel.ChannelPipeline;
import io.netty.handler.codec.http.websocketx.WebSocketFrameAggregator;
import reactor.core.scheduler.Scheduler;
import reactor.netty.NettyPipeline;

/** Installs the offer and residual-RSV guards at the Reactor Netty HTTP/WebSocket boundary. */
final class TdsWebSocketPipelineInstaller {
    static final String PMD_OFFER_GATE = "tdsPmdOfferGate";
    static final String PMD_COMPRESSION_HANDLER = "tdsPmdCompressionHandler";
    static final String MESSAGE_AGGREGATOR = "tdsWebSocketMessageAggregator";
    static final String RESERVED_BITS_GATE = "tdsReservedBitsGate";

    private TdsWebSocketPipelineInstaller() {}

    static void install(ChannelPipeline pipeline, int maxMessageBytes, Scheduler logScheduler) {
        if (pipeline.get(NettyPipeline.HttpCodec) == null || pipeline.get(NettyPipeline.ReactiveBridge) == null) {
            throw new IllegalStateException("TDS_WEBSOCKET_PIPELINE_INVARIANT_VIOLATION");
        }
        if (pipeline.get(PMD_OFFER_GATE) == null) {
            pipeline.addAfter(NettyPipeline.HttpCodec, PMD_OFFER_GATE, new TdsPmdOfferGate(logScheduler));
        }
        if (pipeline.get(PMD_COMPRESSION_HANDLER) == null) {
            pipeline.addAfter(
                    PMD_OFFER_GATE,
                    PMD_COMPRESSION_HANDLER,
                    new TdsPmdCompressionHandler(maxMessageBytes, logScheduler));
        }
        if (pipeline.get(MESSAGE_AGGREGATOR) == null) {
            pipeline.addAfter(
                    PMD_COMPRESSION_HANDLER, MESSAGE_AGGREGATOR, new WebSocketFrameAggregator(maxMessageBytes));
        }
        if (pipeline.get(RESERVED_BITS_GATE) == null) {
            pipeline.addBefore(
                    NettyPipeline.ReactiveBridge,
                    RESERVED_BITS_GATE,
                    new TdsReservedBitsGate(maxMessageBytes, logScheduler));
        }
    }
}
