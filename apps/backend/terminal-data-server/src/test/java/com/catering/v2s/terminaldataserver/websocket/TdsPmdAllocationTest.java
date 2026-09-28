package com.catering.v2s.terminaldataserver.websocket;

import static org.assertj.core.api.Assertions.assertThat;

import io.netty.buffer.ByteBuf;
import io.netty.buffer.ByteBufAllocatorMetric;
import io.netty.buffer.UnpooledByteBufAllocator;
import io.netty.channel.ChannelInboundHandlerAdapter;
import io.netty.channel.embedded.EmbeddedChannel;
import io.netty.handler.codec.http.DefaultHttpRequest;
import io.netty.handler.codec.http.DefaultHttpResponse;
import io.netty.handler.codec.http.HttpHeaderNames;
import io.netty.handler.codec.http.HttpMethod;
import io.netty.handler.codec.http.HttpRequest;
import io.netty.handler.codec.http.HttpResponse;
import io.netty.handler.codec.http.HttpResponseStatus;
import io.netty.handler.codec.http.HttpVersion;
import io.netty.handler.codec.http.websocketx.CloseWebSocketFrame;
import io.netty.handler.codec.http.websocketx.TextWebSocketFrame;
import io.netty.handler.codec.http.websocketx.WebSocketFrame;
import java.io.ByteArrayOutputStream;
import java.util.Arrays;
import java.util.zip.Deflater;
import org.junit.jupiter.api.Test;
import reactor.core.scheduler.Schedulers;
import reactor.netty.NettyPipeline;

class TdsPmdAllocationTest {
    private static final int MAX_MESSAGE_BYTES = 65_536;
    private static final long MAX_LOGICAL_CONNECTION_BYTES = 1_048_576;
    private static final long DECODER_SCRATCH_BYTES = 65_540L + 8_192L;
    private static final long ZLIB_STATE_ESTIMATE_BYTES = 268_288L + 39_936L;

    @Test
    void boundsUnpooledPipelineAllocationsAndRetainsAtMostOneMessagePerDirection() {
        UnpooledByteBufAllocator allocator = new UnpooledByteBufAllocator(false);
        EmbeddedChannel channel = negotiatedChannel(allocator);
        long peakByteBufBytes = allocatedByteBufBytes(allocator);
        TextWebSocketFrame decoded = null;
        WebSocketFrame encoded = null;

        try {
            byte[] plaintext = new byte[MAX_MESSAGE_BYTES];
            Arrays.fill(plaintext, (byte) 'x');
            byte[] compressed = perMessageDeflate(plaintext);
            ByteBuf wirePayload =
                    allocator.buffer(compressed.length, compressed.length).writeBytes(compressed);
            peakByteBufBytes = Math.max(peakByteBufBytes, allocatedByteBufBytes(allocator));

            assertThat(channel.writeInbound(new TextWebSocketFrame(true, 4, wirePayload)))
                    .isTrue();
            decoded = channel.readInbound();
            assertThat(decoded).isInstanceOf(TextWebSocketFrame.class);
            assertThat(decoded.rsv()).isZero();
            assertThat(decoded.content().readableBytes()).isEqualTo(MAX_MESSAGE_BYTES);
            assertThat(decoded.content().capacity()).isLessThanOrEqualTo(MAX_MESSAGE_BYTES);
            assertThat(decoded.refCnt()).isEqualTo(1);
            Object extraInbound = channel.readInbound();
            assertThat(extraInbound).isNull();
            peakByteBufBytes = Math.max(peakByteBufBytes, allocatedByteBufBytes(allocator));

            byte[] serverMessage = new byte[16_384];
            Arrays.fill(serverMessage, (byte) 'y');
            ByteBuf serverPayload =
                    allocator.buffer(serverMessage.length, serverMessage.length).writeBytes(serverMessage);
            peakByteBufBytes = Math.max(peakByteBufBytes, allocatedByteBufBytes(allocator));

            assertThat(channel.writeOutbound(new TextWebSocketFrame(serverPayload)))
                    .isTrue();
            encoded = channel.readOutbound();
            assertThat(encoded).isInstanceOf(TextWebSocketFrame.class);
            assertThat(encoded.rsv()).isEqualTo(4);
            assertThat(encoded.refCnt()).isEqualTo(1);
            Object extraOutbound = channel.readOutbound();
            assertThat(extraOutbound).isNull();
            peakByteBufBytes = Math.max(peakByteBufBytes, allocatedByteBufBytes(allocator));

            long boundedLogicalBytes =
                    peakByteBufBytes + MAX_MESSAGE_BYTES + DECODER_SCRATCH_BYTES + ZLIB_STATE_ESTIMATE_BYTES;
            assertThat(boundedLogicalBytes).isLessThanOrEqualTo(MAX_LOGICAL_CONNECTION_BYTES);
        } finally {
            if (encoded != null) encoded.release();
            if (decoded != null) decoded.release();
            channel.finishAndReleaseAll();
        }

        assertThat(allocatedByteBufBytes(allocator)).isZero();
    }

    @Test
    void stopsInflatingAnOversizedCompressedMessageAtTheDecodedLimit() {
        UnpooledByteBufAllocator allocator = new UnpooledByteBufAllocator(false);
        EmbeddedChannel channel = negotiatedChannel(allocator);
        byte[] plaintext = new byte[MAX_MESSAGE_BYTES * 64 + 1];
        Arrays.fill(plaintext, (byte) 'x');
        byte[] compressed = perMessageDeflate(plaintext);
        long boundedLogicalBytes =
                compressed.length + MAX_MESSAGE_BYTES + DECODER_SCRATCH_BYTES + ZLIB_STATE_ESTIMATE_BYTES;

        try {
            assertThat(compressed.length).isLessThan(MAX_MESSAGE_BYTES);
            assertThat(channel.writeInbound(new TextWebSocketFrame(
                            true,
                            4,
                            allocator
                                    .buffer(compressed.length, compressed.length)
                                    .writeBytes(compressed))))
                    .isFalse();
            Object overflowInbound = channel.readInbound();
            assertThat(overflowInbound).isNull();
            CloseWebSocketFrame close = channel.readOutbound();
            assertThat(close).isNotNull();
            assertThat(close.statusCode()).isEqualTo(1009);
            close.release();
            assertThat(channel.isOpen()).isFalse();
            assertThat(allocatedByteBufBytes(allocator) + boundedLogicalBytes)
                    .isLessThanOrEqualTo(MAX_LOGICAL_CONNECTION_BYTES);
        } finally {
            channel.finishAndReleaseAll();
        }

        assertThat(allocatedByteBufBytes(allocator)).isZero();
    }

    private static long allocatedByteBufBytes(UnpooledByteBufAllocator allocator) {
        ByteBufAllocatorMetric metric = allocator.metric();
        long heapBytes = metric.usedHeapMemory();
        long directBytes = metric.usedDirectMemory();
        assertThat(heapBytes).isGreaterThanOrEqualTo(0);
        assertThat(directBytes).isGreaterThanOrEqualTo(0);
        return heapBytes + directBytes;
    }

    private static EmbeddedChannel negotiatedChannel(UnpooledByteBufAllocator allocator) {
        EmbeddedChannel channel = new EmbeddedChannel();
        channel.config().setAllocator(allocator);
        channel.pipeline().addLast(NettyPipeline.HttpCodec, new ChannelInboundHandlerAdapter());
        channel.pipeline().addLast(NettyPipeline.ReactiveBridge, new ChannelInboundHandlerAdapter());
        TdsWebSocketPipelineInstaller.install(channel.pipeline(), MAX_MESSAGE_BYTES, Schedulers.immediate());

        HttpRequest request = new DefaultHttpRequest(HttpVersion.HTTP_1_1, HttpMethod.GET, "/tdp/test/ws");
        request.headers().set(HttpHeaderNames.UPGRADE, "websocket");
        request.headers().set(HttpHeaderNames.CONNECTION, "Upgrade");
        request.headers().set("Sec-WebSocket-Extensions", "permessage-deflate");
        assertThat(channel.writeInbound(request)).isTrue();
        Object forwardedRequest = channel.readInbound();
        assertThat(forwardedRequest).isSameAs(request);

        HttpResponse response = new DefaultHttpResponse(HttpVersion.HTTP_1_1, HttpResponseStatus.SWITCHING_PROTOCOLS);
        response.headers().set(HttpHeaderNames.UPGRADE, "websocket");
        response.headers().set(HttpHeaderNames.CONNECTION, "Upgrade");
        assertThat(channel.writeOutbound(response)).isTrue();
        HttpResponse negotiated = channel.readOutbound();
        assertThat(negotiated.headers().get("Sec-WebSocket-Extensions")).contains("permessage-deflate");
        return channel;
    }

    private static byte[] perMessageDeflate(byte[] plaintext) {
        Deflater deflater = new Deflater(6, true);
        deflater.setInput(plaintext);
        ByteArrayOutputStream compressed = new ByteArrayOutputStream();
        byte[] chunk = new byte[8_192];
        try {
            for (int written; (written = deflater.deflate(chunk, 0, chunk.length, Deflater.SYNC_FLUSH)) > 0; ) {
                compressed.write(chunk, 0, written);
            }
        } finally {
            deflater.end();
        }

        byte[] withSyncFlushTail = compressed.toByteArray();
        assertThat(withSyncFlushTail).endsWith((byte) 0, (byte) 0, (byte) 0xff, (byte) 0xff);
        return Arrays.copyOf(withSyncFlushTail, withSyncFlushTail.length - 4);
    }
}
