package com.catering.v2s.terminaldataserver.websocket;

import com.catering.v2s.terminaldataserver.observability.TdsAsyncLog;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelOutboundHandlerAdapter;
import io.netty.channel.ChannelPipeline;
import io.netty.channel.ChannelPromise;
import io.netty.handler.codec.http.websocketx.CloseWebSocketFrame;
import io.netty.handler.codec.http.websocketx.WebSocketFrameAggregator;
import io.netty.util.ReferenceCountUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.scheduler.Scheduler;
import reactor.netty.NettyPipeline;

/** Installs the offer and residual-RSV guards at the Reactor Netty HTTP/WebSocket boundary. */
final class TdsWebSocketPipelineInstaller {
    static final String PMD_OFFER_GATE = "tdsPmdOfferGate";
    static final String CLOSE_REASON_NORMALIZER = "tdsCloseReasonNormalizer";
    static final String PMD_COMPRESSION_HANDLER = "tdsPmdCompressionHandler";
    static final String MESSAGE_AGGREGATOR = "tdsWebSocketMessageAggregator";
    static final String RESERVED_BITS_GATE = "tdsReservedBitsGate";
    private static final Logger LOGGER = LoggerFactory.getLogger(TdsWebSocketPipelineInstaller.class);

    private TdsWebSocketPipelineInstaller() {}

    static void install(ChannelPipeline pipeline, int maxMessageBytes, Scheduler logScheduler) {
        if (pipeline.get(NettyPipeline.HttpCodec) == null || pipeline.get(NettyPipeline.ReactiveBridge) == null) {
            throw new IllegalStateException("TDS_WEBSOCKET_PIPELINE_INVARIANT_VIOLATION");
        }
        if (pipeline.get(CLOSE_REASON_NORMALIZER) == null) {
            // Netty's WebSocket handshaker inserts its frame decoder during the upgrade. Keep
            // the outbound normalizer at the pipeline head so decoder-originated 1009 closes
            // cannot bypass it when the HTTP codec is replaced.
            pipeline.addFirst(CLOSE_REASON_NORMALIZER, new OversizeCloseReasonNormalizer(logScheduler));
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

    private static final class OversizeCloseReasonNormalizer extends ChannelOutboundHandlerAdapter {
        private static final int MESSAGE_TOO_BIG = 1009;
        private static final String CLOSE_REASON = "MESSAGE_TOO_BIG";
        private final Scheduler logScheduler;

        private OversizeCloseReasonNormalizer(Scheduler logScheduler) {
            this.logScheduler = logScheduler;
        }

        @Override
        public void write(ChannelHandlerContext context, Object message, ChannelPromise promise) throws Exception {
            if (message instanceof CloseWebSocketFrame closeFrame
                    && closeFrame.statusCode() == MESSAGE_TOO_BIG
                    && !CLOSE_REASON.equals(closeFrame.reasonText())) {
                ReferenceCountUtil.release(message);
                TdsAsyncLog.enqueue(
                        logScheduler,
                        () -> LOGGER.info(
                                "event=tds_ws_close_reason_normalized closeCode={} source=netty_frame_decoder",
                                MESSAGE_TOO_BIG));
                context.write(new CloseWebSocketFrame(MESSAGE_TOO_BIG, CLOSE_REASON), promise);
                return;
            }
            context.write(message, promise);
        }
    }
}
