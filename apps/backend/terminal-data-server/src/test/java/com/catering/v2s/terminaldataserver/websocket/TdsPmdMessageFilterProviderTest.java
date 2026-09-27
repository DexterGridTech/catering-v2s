package com.catering.v2s.terminaldataserver.websocket;

import static org.assertj.core.api.Assertions.assertThat;

import io.netty.buffer.Unpooled;
import io.netty.handler.codec.http.websocketx.BinaryWebSocketFrame;
import io.netty.handler.codec.http.websocketx.ContinuationWebSocketFrame;
import io.netty.handler.codec.http.websocketx.PingWebSocketFrame;
import io.netty.handler.codec.http.websocketx.TextWebSocketFrame;
import io.netty.util.ReferenceCountUtil;
import org.junit.jupiter.api.Test;

class TdsPmdMessageFilterProviderTest {
    private final TdsPmdMessageFilterProvider provider = new TdsPmdMessageFilterProvider();

    @Test
    void leavesMessagesBelowTheThresholdPlainAndCompressesAtTheThreshold() {
        TextWebSocketFrame small = new TextWebSocketFrame("x".repeat(127));
        TextWebSocketFrame boundary = new TextWebSocketFrame("x".repeat(128));
        BinaryWebSocketFrame smallBinary = new BinaryWebSocketFrame(Unpooled.wrappedBuffer(new byte[1]));
        try {
            assertThat(provider.encoderFilter().mustSkip(small)).isTrue();
            assertThat(provider.encoderFilter().mustSkip(boundary)).isFalse();
            assertThat(provider.encoderFilter().mustSkip(smallBinary)).isTrue();
        } finally {
            ReferenceCountUtil.release(small);
            ReferenceCountUtil.release(boundary);
            ReferenceCountUtil.release(smallBinary);
        }
    }

    @Test
    void continuesAnAlreadySelectedCompressedMessageAndAlwaysDecodesClientFrames() {
        ContinuationWebSocketFrame continuation =
                new ContinuationWebSocketFrame(true, 0, Unpooled.wrappedBuffer(new byte[] {1}));
        TextWebSocketFrame smallCompressedClientMessage = new TextWebSocketFrame("x");
        PingWebSocketFrame control = new PingWebSocketFrame(Unpooled.wrappedBuffer(new byte[] {1}));
        try {
            assertThat(provider.encoderFilter().mustSkip(continuation)).isFalse();
            assertThat(provider.encoderFilter().mustSkip(control)).isTrue();
            assertThat(provider.decoderFilter().mustSkip(smallCompressedClientMessage))
                    .isFalse();
        } finally {
            ReferenceCountUtil.release(continuation);
            ReferenceCountUtil.release(smallCompressedClientMessage);
            ReferenceCountUtil.release(control);
        }
    }
}
