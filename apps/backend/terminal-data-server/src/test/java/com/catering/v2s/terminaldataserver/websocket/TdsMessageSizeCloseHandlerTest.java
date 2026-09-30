package com.catering.v2s.terminaldataserver.websocket;

import static org.assertj.core.api.Assertions.assertThat;

import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionProtocol;
import io.netty.channel.embedded.EmbeddedChannel;
import io.netty.handler.codec.TooLongFrameException;
import io.netty.handler.codec.compression.DecompressionException;
import io.netty.handler.codec.http.websocketx.CloseWebSocketFrame;
import org.junit.jupiter.api.Test;
import reactor.core.scheduler.Schedulers;
import tools.jackson.databind.json.JsonMapper;

class TdsMessageSizeCloseHandlerTest {
    private final TerminalConnectionProtocol protocol =
            new TerminalConnectionProtocol(JsonMapper.builder().build());

    @Test
    void mapsNativeDecompressionAndAggregateLimitFailuresToTheSharedCloseCode() {
        assertOverflowClosesWithProtocolCode(
                new DecompressionException("Decompression buffer has reached maximum size: 65536"));
        assertOverflowClosesWithProtocolCode(new TooLongFrameException("message length exceeds 65536"));
    }

    private void assertOverflowClosesWithProtocolCode(Throwable failure) {
        EmbeddedChannel channel = new EmbeddedChannel(new TdsMessageSizeCloseHandler(
                protocol.maxCompleteDecompressedMessageBytes(),
                protocol.oversizedMessageCloseCode(),
                Schedulers.immediate()));
        try {
            channel.pipeline().fireExceptionCaught(failure);
            CloseWebSocketFrame close = channel.readOutbound();
            assertThat(close).isNotNull();
            assertThat(close.statusCode()).isEqualTo(protocol.oversizedMessageCloseCode());
            assertThat(close.reasonText()).isEmpty();
            close.release();
        } finally {
            channel.finishAndReleaseAll();
        }
    }
}
