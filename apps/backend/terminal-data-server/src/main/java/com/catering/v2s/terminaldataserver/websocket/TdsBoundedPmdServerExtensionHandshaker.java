package com.catering.v2s.terminaldataserver.websocket;

import io.netty.handler.codec.http.websocketx.extensions.WebSocketExtensionData;
import io.netty.handler.codec.http.websocketx.extensions.WebSocketServerExtension;
import io.netty.handler.codec.http.websocketx.extensions.WebSocketServerExtensionHandshaker;
import io.netty.handler.codec.http.websocketx.extensions.compression.PerMessageDeflateServerExtensionHandshaker;
import java.util.Objects;

/** Keeps Netty's RFC 7692 negotiation and encoder while enforcing the TDS limit during inflation. */
final class TdsBoundedPmdServerExtensionHandshaker implements WebSocketServerExtensionHandshaker {
    private final int maxMessageBytes;
    private final PerMessageDeflateServerExtensionHandshaker delegate;

    TdsBoundedPmdServerExtensionHandshaker(int maxMessageBytes) {
        if (maxMessageBytes < 1) throw new IllegalArgumentException("maxMessageBytes is invalid");
        this.maxMessageBytes = maxMessageBytes;
        this.delegate = new PerMessageDeflateServerExtensionHandshaker(
                6,
                false,
                PerMessageDeflateServerExtensionHandshaker.MAX_WINDOW_SIZE,
                true,
                true,
                PerMessageDeflateServerExtensionHandshaker.MAX_WINDOW_SIZE,
                PerMessageDeflateServerExtensionHandshaker.DEFAULT_MEM_LEVEL,
                new TdsPmdMessageFilterProvider(),
                maxMessageBytes);
    }

    @Override
    public WebSocketServerExtension handshakeExtension(WebSocketExtensionData extensionData) {
        WebSocketServerExtension negotiated = delegate.handshakeExtension(Objects.requireNonNull(extensionData));
        if (negotiated == null) return null;
        return new WebSocketServerExtension() {
            @Override
            public int rsv() {
                return negotiated.rsv();
            }

            @Override
            public io.netty.handler.codec.http.websocketx.extensions.WebSocketExtensionEncoder newExtensionEncoder() {
                return negotiated.newExtensionEncoder();
            }

            @Override
            public TdsBoundedPmdDecoder newExtensionDecoder() {
                return new TdsBoundedPmdDecoder(maxMessageBytes);
            }

            @Override
            public WebSocketExtensionData newReponseData() {
                return negotiated.newReponseData();
            }
        };
    }
}
