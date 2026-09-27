package com.catering.v2s.terminaldataserver.websocket;

import static org.assertj.core.api.Assertions.assertThat;

import io.netty.buffer.Unpooled;
import io.netty.channel.ChannelInboundHandlerAdapter;
import io.netty.channel.embedded.EmbeddedChannel;
import io.netty.handler.codec.http.websocketx.BinaryWebSocketFrame;
import io.netty.handler.codec.http.websocketx.CloseWebSocketFrame;
import io.netty.handler.codec.http.websocketx.ContinuationWebSocketFrame;
import io.netty.handler.codec.http.websocketx.PingWebSocketFrame;
import io.netty.handler.codec.http.websocketx.TextWebSocketFrame;
import io.netty.handler.codec.http.websocketx.WebSocketFrame;
import io.netty.handler.codec.http.websocketx.WebSocketFrameAggregator;
import java.util.List;
import org.junit.jupiter.api.Test;
import reactor.core.scheduler.Schedulers;
import reactor.netty.NettyPipeline;

class TdsReservedBitsGateTest {
    @Test
    void forwardsFramesWithoutReservedBits() {
        EmbeddedChannel channel = new EmbeddedChannel(new TdsReservedBitsGate(65_536, Schedulers.immediate()));
        TextWebSocketFrame text = new TextWebSocketFrame(true, 0, "message");

        assertThat(channel.writeInbound(text)).isTrue();
        WebSocketFrame forwarded = channel.readInbound();
        assertThat(forwarded).isSameAs(text);
        channel.finishAndReleaseAll();
    }

    @Test
    void closesDataAndControlFramesWithAnyResidualReservedBit() {
        for (int reservedBits : List.of(1, 2, 4)) {
            assertProtocolClose(new BinaryWebSocketFrame(true, reservedBits, Unpooled.EMPTY_BUFFER));
        }
        assertProtocolClose(new PingWebSocketFrame(true, 4, Unpooled.EMPTY_BUFFER));
    }

    @Test
    void installsTheOfferGateAfterHttpCodecAndReservedGateBeforeReactiveBridge() {
        EmbeddedChannel channel = new EmbeddedChannel();
        channel.pipeline().addLast(NettyPipeline.HttpCodec, new ChannelInboundHandlerAdapter());
        channel.pipeline().addLast(NettyPipeline.ReactiveBridge, new ChannelInboundHandlerAdapter());

        TdsWebSocketPipelineInstaller.install(channel.pipeline(), 65_536, Schedulers.immediate());

        List<String> names = channel.pipeline().names();
        assertThat(names.indexOf(TdsWebSocketPipelineInstaller.PMD_OFFER_GATE))
                .isEqualTo(names.indexOf(NettyPipeline.HttpCodec) + 1);
        assertThat(names.indexOf(TdsWebSocketPipelineInstaller.PMD_COMPRESSION_HANDLER))
                .isEqualTo(names.indexOf(TdsWebSocketPipelineInstaller.PMD_OFFER_GATE) + 1);
        assertThat(names.indexOf(TdsWebSocketPipelineInstaller.MESSAGE_AGGREGATOR))
                .isEqualTo(names.indexOf(TdsWebSocketPipelineInstaller.PMD_COMPRESSION_HANDLER) + 1);
        assertThat(names.indexOf(TdsWebSocketPipelineInstaller.RESERVED_BITS_GATE))
                .isEqualTo(names.indexOf(NettyPipeline.ReactiveBridge) - 1);
        assertThat(names.indexOf(TdsWebSocketPipelineInstaller.RESERVED_BITS_GATE))
                .isEqualTo(names.indexOf(TdsWebSocketPipelineInstaller.MESSAGE_AGGREGATOR) + 1);
        channel.finishAndReleaseAll();
    }

    @Test
    void rejectsOversizedCompleteAndFragmentedMessagesBeforeTheReactiveBridge() {
        EmbeddedChannel complete = boundedChannel();
        assertThat(complete.writeInbound(new TextWebSocketFrame(true, 0, Unpooled.wrappedBuffer(new byte[65_537]))))
                .isFalse();
        assertMessageTooBig(complete);

        EmbeddedChannel fragmented = boundedChannel();
        assertThat(fragmented.writeInbound(new TextWebSocketFrame(false, 0, Unpooled.wrappedBuffer(new byte[40_000]))))
                .isFalse();
        WebSocketFrame partialMessage = fragmented.readInbound();
        assertThat(partialMessage).isNull();
        assertThat(fragmented.writeInbound(new PingWebSocketFrame(Unpooled.wrappedBuffer(new byte[] {1}))))
                .isTrue();
        WebSocketFrame ping = fragmented.readInbound();
        assertThat(ping).isInstanceOf(PingWebSocketFrame.class);
        ping.release();
        assertThat(fragmented.writeInbound(
                        new ContinuationWebSocketFrame(true, 0, Unpooled.wrappedBuffer(new byte[25_536]))))
                .isTrue();
        WebSocketFrame exactBoundary = fragmented.readInbound();
        assertThat(exactBoundary).isInstanceOf(TextWebSocketFrame.class);
        assertThat(exactBoundary.isFinalFragment()).isTrue();
        assertThat(exactBoundary.content().readableBytes()).isEqualTo(65_536);
        exactBoundary.release();
        fragmented.finishAndReleaseAll();

        EmbeddedChannel oversized = boundedChannel();
        assertThat(oversized.writeInbound(new TextWebSocketFrame(false, 0, Unpooled.wrappedBuffer(new byte[40_000]))))
                .isFalse();
        assertThat(oversized.writeInbound(
                        new ContinuationWebSocketFrame(true, 0, Unpooled.wrappedBuffer(new byte[25_537]))))
                .isFalse();
        assertMessageTooBig(oversized);
    }

    private static EmbeddedChannel boundedChannel() {
        return new EmbeddedChannel(
                new WebSocketFrameAggregator(65_536), new TdsReservedBitsGate(65_536, Schedulers.immediate()));
    }

    private static void assertProtocolClose(WebSocketFrame invalidFrame) {
        EmbeddedChannel channel = new EmbeddedChannel(new TdsReservedBitsGate(65_536, Schedulers.immediate()));

        assertThat(channel.writeInbound(invalidFrame)).isFalse();
        CloseWebSocketFrame close = channel.readOutbound();
        assertThat(close).isNotNull();
        assertThat(close.statusCode()).isEqualTo(1002);
        assertThat(close.reasonText()).isEqualTo("PROTOCOL_ERROR");
        close.release();
        channel.finishAndReleaseAll();
    }

    private static void assertMessageTooBig(EmbeddedChannel channel) {
        CloseWebSocketFrame close = channel.readOutbound();
        assertThat(close).isNotNull();
        assertThat(close.statusCode()).isEqualTo(1009);
        assertThat(close.reasonText()).isEqualTo("MESSAGE_TOO_BIG");
        close.release();
        channel.finishAndReleaseAll();
    }
}
