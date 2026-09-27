package com.catering.v2s.terminaldataserver.websocket;

import io.netty.handler.codec.http.websocketx.BinaryWebSocketFrame;
import io.netty.handler.codec.http.websocketx.ContinuationWebSocketFrame;
import io.netty.handler.codec.http.websocketx.TextWebSocketFrame;
import io.netty.handler.codec.http.websocketx.WebSocketFrame;
import io.netty.handler.codec.http.websocketx.extensions.WebSocketExtensionFilter;
import io.netty.handler.codec.http.websocketx.extensions.WebSocketExtensionFilterProvider;

/** Keeps tiny server messages uncompressed while accepting every negotiated compressed client message. */
final class TdsPmdMessageFilterProvider implements WebSocketExtensionFilterProvider {
    static final int MIN_COMPRESSIBLE_MESSAGE_BYTES = 128;

    private static final WebSocketExtensionFilter ENCODER_FILTER = TdsPmdMessageFilterProvider::skipEncoding;
    private static final WebSocketExtensionFilter DECODER_FILTER = WebSocketExtensionFilter.NEVER_SKIP;

    @Override
    public WebSocketExtensionFilter encoderFilter() {
        return ENCODER_FILTER;
    }

    @Override
    public WebSocketExtensionFilter decoderFilter() {
        return DECODER_FILTER;
    }

    private static boolean skipEncoding(WebSocketFrame frame) {
        if (frame instanceof ContinuationWebSocketFrame) return false;
        if (frame instanceof TextWebSocketFrame || frame instanceof BinaryWebSocketFrame) {
            return frame.content().readableBytes() < MIN_COMPRESSIBLE_MESSAGE_BYTES;
        }
        return true;
    }
}
