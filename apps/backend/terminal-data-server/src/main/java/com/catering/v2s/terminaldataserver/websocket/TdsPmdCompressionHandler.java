package com.catering.v2s.terminaldataserver.websocket;

import com.catering.v2s.terminaldataserver.observability.TdsAsyncLog;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelPromise;
import io.netty.handler.codec.http.HttpResponse;
import io.netty.handler.codec.http.HttpResponseStatus;
import io.netty.handler.codec.http.websocketx.extensions.WebSocketServerExtensionHandler;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.scheduler.Scheduler;

/** Negotiates only bounded RFC 7692 permessage-deflate and records a safe handshake outcome. */
final class TdsPmdCompressionHandler extends WebSocketServerExtensionHandler {
    private static final Logger LOGGER = LoggerFactory.getLogger(TdsPmdCompressionHandler.class);
    private static final String EXTENSIONS_HEADER = "Sec-WebSocket-Extensions";
    private static final String PMD = "permessage-deflate";
    private static final String CLIENT_NO_CONTEXT = "client_no_context_takeover";
    private static final String SERVER_NO_CONTEXT = "server_no_context_takeover";
    private final Scheduler logScheduler;

    TdsPmdCompressionHandler(int maxDecompressionBytes, Scheduler logScheduler) {
        super(new TdsBoundedPmdServerExtensionHandshaker(maxDecompressionBytes));
        this.logScheduler = logScheduler;
    }

    @Override
    protected void onHttpResponseWrite(ChannelHandlerContext context, HttpResponse response, ChannelPromise promise)
            throws Exception {
        super.onHttpResponseWrite(context, response, promise);
        if (!HttpResponseStatus.SWITCHING_PROTOCOLS.equals(response.status())) return;

        String selectedHeader = response.headers().get(EXTENSIONS_HEADER);
        Set<String> parameters = selectedHeader == null
                ? Set.of()
                : Arrays.stream(selectedHeader.split(";"))
                        .map(String::trim)
                        .map(value -> value.toLowerCase(java.util.Locale.ROOT))
                        .collect(Collectors.toUnmodifiableSet());
        boolean pmdSelected = parameters.contains(PMD);
        String selected = pmdSelected ? "PERMESSAGE_DEFLATE" : (selectedHeader == null ? "NONE" : "UNSUPPORTED");
        String channelId = context.channel().id().asShortText();
        boolean clientNoContextTakeover = pmdSelected && parameters.contains(CLIENT_NO_CONTEXT);
        boolean serverNoContextTakeover = pmdSelected && parameters.contains(SERVER_NO_CONTEXT);
        TdsAsyncLog.enqueue(
                logScheduler,
                () -> LOGGER.info(
                        "event=tds_ws_handshake_extension_selected channelId={} selected={} clientNoContextTakeover={} "
                                + "serverNoContextTakeover={}",
                        channelId,
                        selected,
                        clientNoContextTakeover,
                        serverNoContextTakeover));
    }
}
