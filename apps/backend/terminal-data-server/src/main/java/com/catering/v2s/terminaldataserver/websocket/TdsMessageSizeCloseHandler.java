package com.catering.v2s.terminaldataserver.websocket;

import com.catering.v2s.terminaldataserver.observability.TdsAsyncLog;
import io.netty.channel.ChannelFutureListener;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInboundHandlerAdapter;
import io.netty.handler.codec.TooLongFrameException;
import io.netty.handler.codec.compression.DecompressionException;
import io.netty.handler.codec.http.websocketx.CloseWebSocketFrame;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.scheduler.Scheduler;

/** Maps native frame/decompression over-limit signals to the shared close code. */
final class TdsMessageSizeCloseHandler extends ChannelInboundHandlerAdapter {
    private static final Logger LOGGER = LoggerFactory.getLogger(TdsMessageSizeCloseHandler.class);
    private static final String NATIVE_DECOMPRESSION_LIMIT_PREFIX = "Decompression buffer has reached maximum size:";
    private final int maxMessageBytes;
    private final int overflowCloseCode;
    private final Scheduler logScheduler;

    TdsMessageSizeCloseHandler(int maxMessageBytes, int overflowCloseCode, Scheduler logScheduler) {
        this.maxMessageBytes = maxMessageBytes;
        this.overflowCloseCode = overflowCloseCode;
        this.logScheduler = logScheduler;
    }

    @Override
    public void exceptionCaught(ChannelHandlerContext context, Throwable failure) {
        if (!isMessageTooLarge(failure, maxMessageBytes)) {
            context.fireExceptionCaught(failure);
            return;
        }
        TdsAsyncLog.enqueue(
                logScheduler,
                () -> LOGGER.info(
                        "event=tds_ws_message_limit_exceeded closeCode={} maxMessageBytes={} source={}",
                        overflowCloseCode,
                        maxMessageBytes,
                        failure instanceof TooLongFrameException ? "message_aggregator" : "native_decompressor"));
        context.writeAndFlush(new CloseWebSocketFrame(overflowCloseCode, ""))
                .addListener(ChannelFutureListener.CLOSE);
    }

    static boolean isMessageTooLarge(Throwable failure, int maxMessageBytes) {
        for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
            if (cause instanceof TooLongFrameException) return true;
            if (cause instanceof DecompressionException
                    && cause.getMessage() != null
                    && cause.getMessage().startsWith(NATIVE_DECOMPRESSION_LIMIT_PREFIX + " " + maxMessageBytes)) {
                return true;
            }
        }
        return false;
    }
}
