package com.catering.v2s.terminaldataserver.websocket;

import io.netty.buffer.ByteBuf;
import io.netty.channel.ChannelHandlerContext;
import io.netty.handler.codec.CorruptedFrameException;
import io.netty.handler.codec.TooLongFrameException;
import io.netty.handler.codec.http.websocketx.BinaryWebSocketFrame;
import io.netty.handler.codec.http.websocketx.CloseWebSocketFrame;
import io.netty.handler.codec.http.websocketx.ContinuationWebSocketFrame;
import io.netty.handler.codec.http.websocketx.PingWebSocketFrame;
import io.netty.handler.codec.http.websocketx.PongWebSocketFrame;
import io.netty.handler.codec.http.websocketx.TextWebSocketFrame;
import io.netty.handler.codec.http.websocketx.WebSocketFrame;
import io.netty.handler.codec.http.websocketx.extensions.WebSocketExtension;
import io.netty.handler.codec.http.websocketx.extensions.WebSocketExtensionDecoder;
import java.util.List;
import java.util.zip.DataFormatException;
import java.util.zip.Inflater;

/** Inflates each PMD fragment into a bounded output buffer before WebSocket aggregation. */
final class TdsBoundedPmdDecoder extends WebSocketExtensionDecoder {
    private static final byte[] DEFLATE_TAIL = {0x00, 0x00, (byte) 0xff, (byte) 0xff};
    private static final int OUTPUT_CHUNK_BYTES = 8 * 1024;

    private final int maxMessageBytes;
    private final byte[] compressedInput;
    private final byte[] inflatedChunk;
    private Inflater inflater;
    private boolean compressedMessageOpen;
    private int inflatedMessageBytes;

    TdsBoundedPmdDecoder(int maxMessageBytes) {
        if (maxMessageBytes < 1) throw new IllegalArgumentException("maxMessageBytes is invalid");
        this.maxMessageBytes = maxMessageBytes;
        this.compressedInput = new byte[Math.addExact(maxMessageBytes, DEFLATE_TAIL.length)];
        this.inflatedChunk = new byte[Math.min(OUTPUT_CHUNK_BYTES, maxMessageBytes + 1)];
    }

    @Override
    protected void decode(ChannelHandlerContext context, WebSocketFrame frame, List<Object> output) {
        if (isControlFrame(frame)) {
            if (frame.rsv() != 0) throw protocolError("control frame has reserved bits");
            output.add(frame.retain());
            return;
        }

        if (frame instanceof TextWebSocketFrame || frame instanceof BinaryWebSocketFrame) {
            if (compressedMessageOpen) throw protocolError("new data frame before compressed message completed");
            if (frame.rsv() == 0) {
                output.add(frame.retain());
                return;
            }
            if (frame.rsv() != WebSocketExtension.RSV1) throw protocolError("unexpected reserved bits");
            compressedMessageOpen = true;
            inflatedMessageBytes = 0;
            if (inflater == null) inflater = new Inflater(true);
            else inflater.reset();
            output.add(inflateFrame(context, frame));
            return;
        }

        if (frame instanceof ContinuationWebSocketFrame) {
            if (frame.rsv() != 0) throw protocolError("continuation frame has reserved bits");
            if (!compressedMessageOpen) {
                output.add(frame.retain());
                return;
            }
            output.add(inflateFrame(context, frame));
            return;
        }

        throw protocolError("unexpected WebSocket frame type");
    }

    @Override
    public void handlerRemoved(ChannelHandlerContext context) throws Exception {
        releaseInflater();
        super.handlerRemoved(context);
    }

    @Override
    public void channelInactive(ChannelHandlerContext context) throws Exception {
        releaseInflater();
        super.channelInactive(context);
    }

    private WebSocketFrame inflateFrame(ChannelHandlerContext context, WebSocketFrame frame) {
        int payloadBytes = frame.content().readableBytes();
        if (payloadBytes > maxMessageBytes) throw messageTooLarge();

        int inputBytes = payloadBytes;
        frame.content().getBytes(frame.content().readerIndex(), compressedInput, 0, payloadBytes);
        if (frame.isFinalFragment()) {
            System.arraycopy(DEFLATE_TAIL, 0, compressedInput, inputBytes, DEFLATE_TAIL.length);
            inputBytes += DEFLATE_TAIL.length;
        }

        ByteBuf decompressed = null;
        try {
            if (inputBytes > 0) inflater.setInput(compressedInput, 0, inputBytes);
            while (true) {
                int remaining = maxMessageBytes - inflatedMessageBytes;
                int outputCapacity = Math.min(inflatedChunk.length, remaining + 1);
                int inflatedBytes = inflater.inflate(inflatedChunk, 0, outputCapacity);
                if (inflatedBytes > remaining) throw messageTooLarge();
                if (inflater.needsDictionary() || inflater.finished()) {
                    throw protocolError("invalid permessage-deflate stream state");
                }
                if (inflatedBytes > 0) {
                    if (decompressed == null) {
                        decompressed =
                                context.alloc().buffer(Math.min(inflatedBytes, OUTPUT_CHUNK_BYTES), maxMessageBytes);
                    }
                    decompressed.writeBytes(inflatedChunk, 0, inflatedBytes);
                    inflatedMessageBytes += inflatedBytes;
                }
                if (inflatedBytes == 0) {
                    if (inflater.needsInput()) break;
                    throw protocolError("permessage-deflate decoder made no progress");
                }
            }
            if (inflater.getRemaining() != 0) throw protocolError("trailing permessage-deflate input");

            if (decompressed == null) decompressed = context.alloc().buffer(0, 0);
            WebSocketFrame decoded = withInflatedPayload(frame, decompressed);
            decompressed = null;
            if (frame.isFinalFragment()) {
                compressedMessageOpen = false;
                inflatedMessageBytes = 0;
                inflater.reset();
            }
            return decoded;
        } catch (DataFormatException malformed) {
            throw new CorruptedFrameException("TDS_WEBSOCKET_COMPRESSED_PAYLOAD_INVALID", malformed);
        } finally {
            if (decompressed != null) decompressed.release();
        }
    }

    private static WebSocketFrame withInflatedPayload(WebSocketFrame source, ByteBuf payload) {
        if (source instanceof TextWebSocketFrame) {
            return new TextWebSocketFrame(source.isFinalFragment(), 0, payload);
        }
        if (source instanceof BinaryWebSocketFrame) {
            return new BinaryWebSocketFrame(source.isFinalFragment(), 0, payload);
        }
        if (source instanceof ContinuationWebSocketFrame) {
            return new ContinuationWebSocketFrame(source.isFinalFragment(), 0, payload);
        }
        payload.release();
        throw new CorruptedFrameException("TDS_WEBSOCKET_COMPRESSED_FRAME_TYPE_INVALID");
    }

    private static boolean isControlFrame(WebSocketFrame frame) {
        return frame instanceof PingWebSocketFrame
                || frame instanceof PongWebSocketFrame
                || frame instanceof CloseWebSocketFrame;
    }

    private static CorruptedFrameException protocolError(String detail) {
        return new CorruptedFrameException("TDS_WEBSOCKET_PROTOCOL_ERROR: " + detail);
    }

    private static TooLongFrameException messageTooLarge() {
        return new TooLongFrameException("TDS_WEBSOCKET_MESSAGE_TOO_LARGE");
    }

    private void releaseInflater() {
        if (inflater != null) {
            inflater.end();
            inflater = null;
        }
        compressedMessageOpen = false;
        inflatedMessageBytes = 0;
    }
}
