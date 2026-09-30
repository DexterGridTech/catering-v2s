package com.catering.v2s.terminaldataserver.websocket;

import io.netty.channel.ChannelPipeline;
import io.netty.handler.codec.http.websocketx.WebSocketFrameAggregator;
import reactor.core.scheduler.Scheduler;
import reactor.netty.NettyPipeline;

/** Places the complete-message bound after Reactor Netty's negotiated frame extensions. */
final class TdsWebSocketPipelineInstaller {
    static final String MESSAGE_AGGREGATOR = "tdsWebSocketMessageAggregator";
    static final String MESSAGE_SIZE_CLOSE_HANDLER = "tdsMessageSizeCloseHandler";

    private TdsWebSocketPipelineInstaller() {}

    static void install(ChannelPipeline pipeline, int maxMessageBytes, int overflowCloseCode, Scheduler logScheduler) {
        if (pipeline.get(NettyPipeline.HttpCodec) == null || pipeline.get(NettyPipeline.ReactiveBridge) == null) {
            throw new IllegalStateException("TDS_WEBSOCKET_PIPELINE_INVARIANT_VIOLATION");
        }
        if (pipeline.get(MESSAGE_AGGREGATOR) == null) {
            // Reactor Netty inserts negotiated extension decoders after HttpCodec during upgrade.
            // Keeping aggregation immediately before ReactiveBridge puts it after those decoders.
            pipeline.addBefore(
                    NettyPipeline.ReactiveBridge, MESSAGE_AGGREGATOR, new WebSocketFrameAggregator(maxMessageBytes));
        }
        if (pipeline.get(MESSAGE_SIZE_CLOSE_HANDLER) == null) {
            pipeline.addAfter(
                    MESSAGE_AGGREGATOR,
                    MESSAGE_SIZE_CLOSE_HANDLER,
                    new TdsMessageSizeCloseHandler(maxMessageBytes, overflowCloseCode, logScheduler));
        }
    }
}
