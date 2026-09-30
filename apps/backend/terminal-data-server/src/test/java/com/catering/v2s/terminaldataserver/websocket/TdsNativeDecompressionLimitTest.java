package com.catering.v2s.terminaldataserver.websocket;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import io.netty.channel.embedded.EmbeddedChannel;
import io.netty.handler.codec.compression.DecompressionException;
import io.netty.handler.codec.compression.JdkZlibDecoder;
import io.netty.handler.codec.compression.ZlibWrapper;
import io.netty.util.ReferenceCountUtil;
import java.util.zip.Deflater;
import org.junit.jupiter.api.Test;

class TdsNativeDecompressionLimitTest {
    private static final int MAX_DECOMPRESSED_BYTES = 65_536;

    @Test
    void nativeNettyInflaterStopsAtItsConfiguredOutputAllocationLimit() {
        byte[] compressed = compress(new byte[MAX_DECOMPRESSED_BYTES + 1]);
        EmbeddedChannel channel = new EmbeddedChannel(new JdkZlibDecoder(ZlibWrapper.NONE, MAX_DECOMPRESSED_BYTES));
        try {
            assertThatThrownBy(() -> channel.writeInbound(Unpooled.wrappedBuffer(compressed)))
                    .isInstanceOf(DecompressionException.class)
                    .hasMessageContaining("Decompression buffer has reached maximum size: 65536");

            long emittedBytes = 0;
            ByteBuf output;
            while ((output = channel.readInbound()) != null) {
                emittedBytes += output.readableBytes();
                ReferenceCountUtil.release(output);
            }
            assertThat(emittedBytes).isLessThanOrEqualTo(MAX_DECOMPRESSED_BYTES);
        } finally {
            channel.finishAndReleaseAll();
        }
    }

    private static byte[] compress(byte[] input) {
        Deflater deflater = new Deflater(Deflater.DEFAULT_COMPRESSION, true);
        try {
            deflater.setInput(input);
            deflater.finish();
            byte[] compressed = new byte[input.length + 512];
            int size = 0;
            while (!deflater.finished()) size += deflater.deflate(compressed, size, compressed.length - size);
            return java.util.Arrays.copyOf(compressed, size);
        } finally {
            deflater.end();
        }
    }
}
