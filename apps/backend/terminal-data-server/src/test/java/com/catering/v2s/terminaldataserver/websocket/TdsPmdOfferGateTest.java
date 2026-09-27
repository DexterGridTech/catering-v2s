package com.catering.v2s.terminaldataserver.websocket;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.netty.buffer.Unpooled;
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
import java.io.ByteArrayOutputStream;
import java.util.Arrays;
import java.util.Random;
import java.util.zip.Deflater;
import org.junit.jupiter.api.Test;
import reactor.core.scheduler.Schedulers;
import reactor.netty.NettyPipeline;

class TdsPmdOfferGateTest {
    @Test
    void removesCompressionWhenTheClientDoesNotOfferAnExtension() {
        HttpRequest request = request(null);

        assertThat(normalize(request).headers().get("Sec-WebSocket-Extensions")).isNull();
    }

    @Test
    void stripsLegacyAndUnsupportedExtensionsButKeepsAValidPmdOffer() {
        HttpRequest request = request("deflate-frame, x-example; value=\"a,b\", permessage-deflate");

        assertThat(normalize(request).headers().get("Sec-WebSocket-Extensions"))
                .isEqualTo("permessage-deflate; client_no_context_takeover; server_no_context_takeover");
    }

    @Test
    void addsBothNoContextFlagsAndPreservesClientWindowOffers() {
        String withoutWindowValue = "permessage-deflate; client_no_context_takeover; "
                + "server_no_context_takeover; client_max_window_bits";
        String withWindowValue = "permessage-deflate; client_no_context_takeover; "
                + "server_no_context_takeover; client_max_window_bits=12";
        assertThat(normalize(request("permessage-deflate; client_max_window_bits"))
                        .headers()
                        .get("Sec-WebSocket-Extensions"))
                .isEqualTo(withoutWindowValue);
        assertThat(normalize(request("permessage-deflate; client_max_window_bits=12"))
                        .headers()
                        .get("Sec-WebSocket-Extensions"))
                .isEqualTo(withWindowValue);
    }

    @Test
    void preservesAValidOfferThatAlreadyContainsBothNoContextFlags() {
        HttpRequest request = request("permessage-deflate; client_no_context_takeover; server_no_context_takeover");

        assertThat(normalize(request).headers().get("Sec-WebSocket-Extensions"))
                .isEqualTo("permessage-deflate; client_no_context_takeover; server_no_context_takeover");
    }

    @Test
    void removesMalformedDuplicateAndUnsupportedPmdOffers() {
        for (String offer : new String[] {
            "permessage-deflate; client_no_context_takeover=1",
            "permessage-deflate; client_max_window_bits=16",
            "permessage-deflate; client_max_window_bits; client_max_window_bits",
            "permessage-deflate, permessage-deflate"
        }) {
            assertThat(normalize(request(offer)).headers().get("Sec-WebSocket-Extensions"))
                    .as(offer)
                    .isNull();
        }
    }

    @Test
    void negotiatesOnlyPmdWithBothNoContextFlagsForSupportedOffers() {
        assertThat(negotiate(null)).isNull();
        assertThat(extensionParameters(negotiate("permessage-deflate")))
                .containsExactlyInAnyOrder(
                        "permessage-deflate", "client_no_context_takeover", "server_no_context_takeover");
        assertThat(extensionParameters(negotiate("permessage-deflate; client_max_window_bits")))
                .containsExactlyInAnyOrder(
                        "permessage-deflate", "client_no_context_takeover", "server_no_context_takeover");
        assertThat(extensionParameters(
                        negotiate("permessage-deflate; client_no_context_takeover; server_no_context_takeover")))
                .containsExactlyInAnyOrder(
                        "permessage-deflate", "client_no_context_takeover", "server_no_context_takeover");
        assertThat(extensionParameters(negotiate("deflate-frame, permessage-deflate")))
                .containsExactlyInAnyOrder(
                        "permessage-deflate", "client_no_context_takeover", "server_no_context_takeover");
    }

    @Test
    void doesNotSelectCompressionForLegacyOrMalformedOffers() {
        assertThat(negotiate("deflate-frame")).isNull();
        assertThat(negotiate("permessage-deflate, permessage-deflate")).isNull();
    }

    @Test
    void closesSingleCompressedMessageAtTheDecompressionLimitWith1009() {
        EmbeddedChannel channel = negotiatedChannel();
        byte[] plaintext = new byte[65_537];
        Arrays.fill(plaintext, (byte) 'x');

        assertThat(channel.writeInbound(
                        new TextWebSocketFrame(true, 4, Unpooled.wrappedBuffer(perMessageDeflate(plaintext)))))
                .isFalse();
        CloseWebSocketFrame close = channel.readOutbound();
        assertThat(close).isNotNull();
        assertThat(close.statusCode()).isEqualTo(1009);
        assertThat(close.reasonText()).isEqualTo("MESSAGE_TOO_BIG");
        assertThat(channel.isOpen()).isFalse();
        close.release();
        channel.finishAndReleaseAll();
    }

    @Test
    void acceptsACompressedMessageAtTheExactDecodedByteLimit() {
        EmbeddedChannel channel = negotiatedChannel();
        byte[] plaintext = new byte[65_536];
        Arrays.fill(plaintext, (byte) 'x');

        assertThat(channel.writeInbound(
                        new TextWebSocketFrame(true, 4, Unpooled.wrappedBuffer(perMessageDeflate(plaintext)))))
                .isTrue();
        TextWebSocketFrame decoded = channel.readInbound();
        assertThat(decoded).isNotNull();
        assertThat(decoded.rsv()).isZero();
        assertThat(decoded.content().readableBytes()).isEqualTo(65_536);
        decoded.release();
        channel.finishAndReleaseAll();
    }

    @Test
    void drainsAllDecodedChunksBeforeWaitingForMoreCompressedInput() {
        EmbeddedChannel channel = negotiatedChannel();
        byte[] plaintext = new byte[30_000];
        new Random(7).nextBytes(plaintext);

        assertThat(channel.writeInbound(
                        new TextWebSocketFrame(true, 4, Unpooled.wrappedBuffer(perMessageDeflate(plaintext)))))
                .isTrue();
        TextWebSocketFrame decoded = channel.readInbound();
        assertThat(decoded).isNotNull();
        byte[] actual = new byte[decoded.content().readableBytes()];
        decoded.content().getBytes(decoded.content().readerIndex(), actual);
        assertThat(actual).containsExactly(plaintext);
        decoded.release();
        channel.finishAndReleaseAll();
    }

    @Test
    void enforcesTheDecodedLimitAcrossCompressedFragmentsBeforeAggregationCompletes() {
        EmbeddedChannel channel = negotiatedChannel();
        byte[] plaintext = new byte[65_537];
        Arrays.fill(plaintext, (byte) 'x');
        byte[] compressed = perMessageDeflate(plaintext);
        int split = compressed.length / 2;

        channel.writeInbound(
                new TextWebSocketFrame(false, 4, Unpooled.wrappedBuffer(Arrays.copyOfRange(compressed, 0, split))));
        assertThat(channel.writeInbound(new io.netty.handler.codec.http.websocketx.ContinuationWebSocketFrame(
                        true, 0, Unpooled.wrappedBuffer(Arrays.copyOfRange(compressed, split, compressed.length)))))
                .isFalse();
        CloseWebSocketFrame close = channel.readOutbound();
        assertThat(close).isNotNull();
        assertThat(close.statusCode()).isEqualTo(1009);
        assertThat(close.reasonText()).isEqualTo("MESSAGE_TOO_BIG");
        assertThat(channel.isOpen()).isFalse();
        close.release();
        channel.finishAndReleaseAll();
    }

    @Test
    void closesWhenUnansweredHttpPipeliningReachesNettysExtensionQueueLimit() {
        EmbeddedChannel channel = new EmbeddedChannel();
        channel.pipeline().addLast(NettyPipeline.HttpCodec, new ChannelInboundHandlerAdapter());
        channel.pipeline().addLast(NettyPipeline.ReactiveBridge, new ChannelInboundHandlerAdapter());
        TdsWebSocketPipelineInstaller.install(channel.pipeline(), 65_536, Schedulers.immediate());

        for (int requestIndex = 0; requestIndex < 128; requestIndex++) {
            channel.writeInbound(plainRequest());
            HttpRequest forwarded = channel.readInbound();
            assertThat(forwarded).isNotNull();
        }

        assertThatThrownBy(() -> channel.writeInbound(plainRequest()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("maxPipelineDepth exceeded: 128");
        assertThat(channel.isOpen()).isFalse();
        channel.finishAndReleaseAll();
    }

    private static HttpRequest normalize(HttpRequest request) {
        EmbeddedChannel channel = new EmbeddedChannel(new TdsPmdOfferGate(Schedulers.immediate()));
        channel.writeInbound(request);
        Object inbound = channel.readInbound();
        HttpRequest forwarded = (HttpRequest) inbound;
        assertThat(forwarded).isSameAs(request);
        channel.finishAndReleaseAll();
        return forwarded;
    }

    private static HttpRequest request(String extension) {
        HttpRequest request = new DefaultHttpRequest(HttpVersion.HTTP_1_1, HttpMethod.GET, "/tdp/test/ws");
        request.headers().set(HttpHeaderNames.UPGRADE, "websocket");
        request.headers().set(HttpHeaderNames.CONNECTION, "Upgrade");
        if (extension != null) request.headers().add("Sec-WebSocket-Extensions", extension);
        return request;
    }

    private static HttpRequest plainRequest() {
        return new DefaultHttpRequest(HttpVersion.HTTP_1_1, HttpMethod.GET, "/not-a-websocket-route");
    }

    private static String negotiate(String offer) {
        EmbeddedChannel channel = new EmbeddedChannel();
        channel.pipeline().addLast(NettyPipeline.HttpCodec, new ChannelInboundHandlerAdapter());
        channel.pipeline().addLast(NettyPipeline.ReactiveBridge, new ChannelInboundHandlerAdapter());
        TdsWebSocketPipelineInstaller.install(channel.pipeline(), 65_536, Schedulers.immediate());

        HttpRequest request = request(offer);
        channel.writeInbound(request);
        Object inbound = channel.readInbound();
        HttpRequest forwarded = (HttpRequest) inbound;
        assertThat(forwarded).isSameAs(request);

        HttpResponse response = new DefaultHttpResponse(HttpVersion.HTTP_1_1, HttpResponseStatus.SWITCHING_PROTOCOLS);
        response.headers().set(HttpHeaderNames.UPGRADE, "websocket");
        response.headers().set(HttpHeaderNames.CONNECTION, "Upgrade");
        channel.writeOutbound(response);
        HttpResponse negotiated = channel.readOutbound();
        String selected = negotiated.headers().get("Sec-WebSocket-Extensions");
        channel.finishAndReleaseAll();
        return selected;
    }

    private static EmbeddedChannel negotiatedChannel() {
        EmbeddedChannel channel = new EmbeddedChannel();
        channel.pipeline().addLast(NettyPipeline.HttpCodec, new ChannelInboundHandlerAdapter());
        channel.pipeline().addLast(NettyPipeline.ReactiveBridge, new ChannelInboundHandlerAdapter());
        TdsWebSocketPipelineInstaller.install(channel.pipeline(), 65_536, Schedulers.immediate());

        HttpRequest request = request("permessage-deflate");
        channel.writeInbound(request);
        Object inbound = channel.readInbound();
        assertThat(inbound).isSameAs(request);

        HttpResponse response = new DefaultHttpResponse(HttpVersion.HTTP_1_1, HttpResponseStatus.SWITCHING_PROTOCOLS);
        response.headers().set(HttpHeaderNames.UPGRADE, "websocket");
        response.headers().set(HttpHeaderNames.CONNECTION, "Upgrade");
        channel.writeOutbound(response);
        HttpResponse negotiated = channel.readOutbound();
        assertThat(negotiated.headers().get("Sec-WebSocket-Extensions"))
                .contains("client_no_context_takeover")
                .contains("server_no_context_takeover");
        return channel;
    }

    private static byte[] perMessageDeflate(byte[] plaintext) {
        Deflater deflater = new Deflater(6, true);
        deflater.setInput(plaintext);
        ByteArrayOutputStream compressed = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        try {
            for (int written; (written = deflater.deflate(buffer, 0, buffer.length, Deflater.SYNC_FLUSH)) > 0; ) {
                compressed.write(buffer, 0, written);
            }
        } finally {
            deflater.end();
        }

        byte[] withSyncFlushTail = compressed.toByteArray();
        assertThat(withSyncFlushTail).endsWith((byte) 0, (byte) 0, (byte) 0xff, (byte) 0xff);
        return Arrays.copyOf(withSyncFlushTail, withSyncFlushTail.length - 4);
    }

    private static String[] extensionParameters(String extension) {
        assertThat(extension).isNotNull();
        return Arrays.stream(extension.split(";")).map(String::trim).toArray(String[]::new);
    }
}
