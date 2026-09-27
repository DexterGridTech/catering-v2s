package com.catering.v2s.terminaldataserver.websocket;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.netty.buffer.ByteBuf;
import io.netty.buffer.ByteBufAllocator;
import io.netty.buffer.Unpooled;
import io.netty.util.ReferenceCountUtil;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.buffer.NettyDataBufferFactory;
import org.springframework.web.reactive.socket.WebSocketMessage;

class TdsWebSocketMessageOwnershipTest {
    @Test
    void retainedPayloadRemainsReadableAfterReactorNettyReleasesTheFrame() throws Exception {
        ByteBuf frameContent = Unpooled.copiedBuffer("AUTHENTICATE", StandardCharsets.UTF_8);
        WebSocketMessage message = new WebSocketMessage(
                WebSocketMessage.Type.TEXT, new NettyDataBufferFactory(ByteBufAllocator.DEFAULT).wrap(frameContent));

        message.retain();
        ReferenceCountUtil.release(frameContent);
        assertEquals(1, frameContent.refCnt());

        CompletableFuture<String> asynchronousRead = CompletableFuture.supplyAsync(message::getPayloadAsText);
        try {
            assertEquals("AUTHENTICATE", asynchronousRead.get());
        } finally {
            message.release();
        }
        assertEquals(0, frameContent.refCnt());
    }
}
