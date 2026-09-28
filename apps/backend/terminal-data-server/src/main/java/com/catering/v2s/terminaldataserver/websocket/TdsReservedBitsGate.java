package com.catering.v2s.terminaldataserver.websocket;

import com.catering.v2s.terminaldataserver.observability.TdsAsyncLog;
import io.netty.channel.ChannelFutureListener;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInboundHandlerAdapter;
import io.netty.handler.codec.CorruptedFrameException;
import io.netty.handler.codec.PrematureChannelClosureException;
import io.netty.handler.codec.TooLongFrameException;
import io.netty.handler.codec.http.websocketx.BinaryWebSocketFrame;
import io.netty.handler.codec.http.websocketx.CloseWebSocketFrame;
import io.netty.handler.codec.http.websocketx.CorruptedWebSocketFrameException;
import io.netty.handler.codec.http.websocketx.TextWebSocketFrame;
import io.netty.handler.codec.http.websocketx.WebSocketFrame;
import io.netty.util.ReferenceCountUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.scheduler.Scheduler;

/** Enforces complete-frame limits and rejects residual reserved bits after bounded aggregation. */
final class TdsReservedBitsGate extends ChannelInboundHandlerAdapter {
    private static final Logger LOGGER = LoggerFactory.getLogger(TdsReservedBitsGate.class);
    private static final int PROTOCOL_ERROR = 1002;
    private static final int MESSAGE_TOO_BIG = 1009;
    private final int maxMessageBytes;
    private final Scheduler logScheduler;
    private boolean closing;
    private long rejectedMessageBytes;

    TdsReservedBitsGate(int maxMessageBytes, Scheduler logScheduler) {
        if (maxMessageBytes < 1) throw new IllegalArgumentException("maxMessageBytes is invalid");
        this.maxMessageBytes = maxMessageBytes;
        this.logScheduler = logScheduler;
    }

    @Override
    public void channelRead(ChannelHandlerContext context, Object message) {
        if (!(message instanceof WebSocketFrame frame)) {
            context.fireChannelRead(message);
            return;
        }
        if (closing) {
            ReferenceCountUtil.release(frame);
            return;
        }
        if (frame.rsv() == 0) {
            if (exceedsMessageLimit(frame)) {
                close(context, MESSAGE_TOO_BIG, "MESSAGE_TOO_BIG", frame);
            } else {
                context.fireChannelRead(frame);
            }
            return;
        }

        rejectedMessageBytes = frame.content().readableBytes();
        close(context, PROTOCOL_ERROR, "PROTOCOL_ERROR", frame);
    }

    @Override
    public void exceptionCaught(ChannelHandlerContext context, Throwable cause) {
        if (closing && cause instanceof PrematureChannelClosureException) return;
        Throwable classified = cause;
        while (classified != null) {
            if (classified instanceof CorruptedWebSocketFrameException websocketFailure) {
                int closeCode = websocketFailure.closeStatus().code();
                if (closeCode == MESSAGE_TOO_BIG) {
                    close(context, MESSAGE_TOO_BIG, "MESSAGE_TOO_BIG");
                    return;
                }
                if (closeCode == PROTOCOL_ERROR) {
                    close(context, PROTOCOL_ERROR, "PROTOCOL_ERROR");
                    return;
                }
                context.fireExceptionCaught(cause);
                return;
            }
            if (classified instanceof TooLongFrameException) {
                close(context, MESSAGE_TOO_BIG, "MESSAGE_TOO_BIG");
                return;
            }
            if (classified instanceof CorruptedFrameException) {
                close(context, PROTOCOL_ERROR, "PROTOCOL_ERROR");
                return;
            }
            classified = classified.getCause();
        }
        context.fireExceptionCaught(cause);
    }

    private boolean exceedsMessageLimit(WebSocketFrame frame) {
        if (!(frame instanceof TextWebSocketFrame || frame instanceof BinaryWebSocketFrame)) return false;
        rejectedMessageBytes = frame.content().readableBytes();
        return rejectedMessageBytes > maxMessageBytes;
    }

    private void close(ChannelHandlerContext context, int code, String reason) {
        if (closing) return;
        closing = true;
        String channelId = context.channel().id().asShortText();
        TdsAsyncLog.enqueue(
                logScheduler,
                () -> LOGGER.warn(
                        "event=tds_ws_message_rejected channelId={} closeCode={} closeReason={} maxMessageBytes={}",
                        channelId,
                        code,
                        reason,
                        maxMessageBytes));
        context.writeAndFlush(new CloseWebSocketFrame(code, reason)).addListener(ChannelFutureListener.CLOSE);
    }

    private void close(ChannelHandlerContext context, int code, String reason, WebSocketFrame frame) {
        if (closing) {
            ReferenceCountUtil.release(frame);
            return;
        }
        closing = true;
        String channelId = context.channel().id().asShortText();
        String frameType = frame.getClass().getSimpleName();
        int reservedBits = frame.rsv();
        int frameBytes = frame.content().readableBytes();
        long observedBytes = rejectedMessageBytes;
        TdsAsyncLog.enqueue(
                logScheduler,
                () -> LOGGER.warn(
                        "event=tds_ws_frame_rejected channelId={} closeCode={} closeReason={} frameType={} rsv={} "
                                + "frameBytes={} observedMessageBytes={}",
                        channelId,
                        code,
                        reason,
                        frameType,
                        reservedBits,
                        frameBytes,
                        observedBytes));
        ReferenceCountUtil.release(frame);
        context.writeAndFlush(new CloseWebSocketFrame(code, reason)).addListener(ChannelFutureListener.CLOSE);
    }
}
