package com.catering.v2s.terminaldataserver.websocket;

import com.catering.v2s.terminaldataserver.observability.TdsAsyncLog;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInboundHandlerAdapter;
import io.netty.handler.codec.http.HttpHeaderNames;
import io.netty.handler.codec.http.HttpRequest;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.scheduler.Scheduler;

/** Keeps the Netty handshake offer within the supported RFC 7692 subset. */
final class TdsPmdOfferGate extends ChannelInboundHandlerAdapter {
    private static final Logger LOGGER = LoggerFactory.getLogger(TdsPmdOfferGate.class);
    private static final String EXTENSIONS_HEADER = "Sec-WebSocket-Extensions";
    private static final String PMD = "permessage-deflate";
    private final Scheduler logScheduler;

    TdsPmdOfferGate(Scheduler logScheduler) {
        this.logScheduler = logScheduler;
    }

    @Override
    public void channelRead(ChannelHandlerContext context, Object message) {
        if (message instanceof HttpRequest request && isWebSocketUpgrade(request)) {
            OfferResult result = normalizeOffer(request);
            String channelId = context.channel().id().asShortText();
            TdsAsyncLog.enqueue(
                    logScheduler,
                    () -> LOGGER.info(
                            "event=tds_ws_extension_offer channelId={} offerClass={} action={}",
                            channelId,
                            result.offerClass(),
                            result.action()));
        }
        context.fireChannelRead(message);
    }

    private static boolean isWebSocketUpgrade(HttpRequest request) {
        String upgrade = request.headers().get(HttpHeaderNames.UPGRADE);
        String connection = request.headers().get(HttpHeaderNames.CONNECTION);
        if (upgrade == null || !"websocket".equalsIgnoreCase(upgrade.trim()) || connection == null) return false;
        for (String token : connection.split(",")) {
            if ("upgrade".equalsIgnoreCase(token.trim())) return true;
        }
        return false;
    }

    private static OfferResult normalizeOffer(HttpRequest request) {
        List<String> headers = request.headers().getAll(EXTENSIONS_HEADER);
        if (headers.isEmpty()) return new OfferResult("NONE", "UNCHANGED");

        ParsedOffer accepted = null;
        boolean invalid = false;
        boolean containsUnsupported = false;
        for (String header : headers) {
            List<String> extensions = splitOutsideQuotes(header, ',');
            if (extensions == null) {
                invalid = true;
                break;
            }
            for (String extension : extensions) {
                String name = extensionName(extension);
                if (!PMD.equalsIgnoreCase(name)) {
                    containsUnsupported = true;
                    continue;
                }
                if (accepted != null) {
                    invalid = true;
                    break;
                }
                accepted = parseOffer(extension);
                if (accepted == null) {
                    invalid = true;
                    break;
                }
            }
            if (invalid) break;
        }

        if (invalid || accepted == null) {
            request.headers().remove(EXTENSIONS_HEADER);
            String offerClass = invalid ? "INVALID" : (containsUnsupported ? "LEGACY_OR_UNSUPPORTED" : "UNSUPPORTED");
            return new OfferResult(offerClass, "DROPPED");
        }
        request.headers().set(EXTENSIONS_HEADER, accepted.asHeaderValue());
        String offerClass = containsUnsupported
                ? "MIXED"
                : (accepted.clientMaxWindowBitsPresent() ? "PMD_WITH_CLIENT_WINDOW" : "PMD");
        return new OfferResult(offerClass, "NORMALIZED");
    }

    private static ParsedOffer parseOffer(String value) {
        List<String> parts = splitOutsideQuotes(value, ';');
        if (parts == null
                || parts.isEmpty()
                || !PMD.equalsIgnoreCase(parts.getFirst().trim())) return null;

        Set<String> parameters = new HashSet<>();
        Integer clientMaxWindowBits = null;
        boolean clientMaxWindowBitsPresent = false;
        for (String rawParameter : parts.subList(1, parts.size())) {
            String parameter = rawParameter.trim();
            if (parameter.isEmpty()) return null;
            List<String> assignment = splitOutsideQuotes(parameter, '=');
            if (assignment == null || assignment.isEmpty() || assignment.size() > 2) return null;
            String name = assignment.getFirst().trim().toLowerCase(Locale.ROOT);
            if (!isToken(name) || !parameters.add(name)) return null;
            String parameterValue =
                    assignment.size() == 2 ? unquote(assignment.get(1).trim()) : null;
            if (assignment.size() == 2 && parameterValue == null) return null;

            switch (name) {
                case "client_no_context_takeover", "server_no_context_takeover" -> {
                    if (parameterValue != null) return null;
                }
                case "client_max_window_bits" -> {
                    clientMaxWindowBitsPresent = true;
                    if (parameterValue != null) {
                        if (!parameterValue.matches("(?:8|9|1[0-5])")) return null;
                        clientMaxWindowBits = Integer.valueOf(parameterValue);
                    }
                }
                default -> {
                    return null;
                }
            }
        }
        return new ParsedOffer(clientMaxWindowBitsPresent, clientMaxWindowBits);
    }

    private static String extensionName(String extension) {
        List<String> parts = splitOutsideQuotes(extension, ';');
        return parts == null || parts.isEmpty() ? "" : parts.getFirst().trim();
    }

    private static List<String> splitOutsideQuotes(String value, char delimiter) {
        List<String> parts = new ArrayList<>();
        boolean quoted = false;
        boolean escaped = false;
        int start = 0;
        for (int index = 0; index < value.length(); index++) {
            char current = value.charAt(index);
            if (escaped) {
                escaped = false;
            } else if (quoted && current == '\\') {
                escaped = true;
            } else if (current == '"') {
                quoted = !quoted;
            } else if (!quoted && current == delimiter) {
                parts.add(value.substring(start, index));
                start = index + 1;
            }
        }
        if (quoted || escaped) return null;
        parts.add(value.substring(start));
        return parts;
    }

    private static String unquote(String value) {
        if (value.length() >= 2 && value.charAt(0) == '"' && value.charAt(value.length() - 1) == '"') {
            String content = value.substring(1, value.length() - 1);
            if (content.indexOf('"') >= 0 || content.indexOf('\\') >= 0) return null;
            return content;
        }
        if (value.indexOf('"') >= 0 || value.indexOf('\\') >= 0) return null;
        return value;
    }

    private static boolean isToken(String value) {
        return value.matches("[!#$%&'*+.^_`|~0-9A-Za-z-]+");
    }

    private record ParsedOffer(boolean clientMaxWindowBitsPresent, Integer clientMaxWindowBits) {
        String asHeaderValue() {
            StringBuilder result =
                    new StringBuilder(PMD).append("; client_no_context_takeover; server_no_context_takeover");
            if (clientMaxWindowBitsPresent) {
                result.append("; client_max_window_bits");
                if (clientMaxWindowBits != null) result.append('=').append(clientMaxWindowBits);
            }
            return result.toString();
        }
    }

    private record OfferResult(String offerClass, String action) {}
}
