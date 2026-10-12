// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = TerminalRemoteControlRegisterRequest.Deserializer.class)
public record TerminalRemoteControlRegisterRequest(
    java.util.UUID sessionId,
    String topologyKind,
    tools.jackson.databind.JsonNode peerIdentity
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<TerminalRemoteControlRegisterRequest> {
    @Override
    public TerminalRemoteControlRegisterRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (TerminalRemoteControlRegisterRequest) context.handleUnexpectedToken(TerminalRemoteControlRegisterRequest.class, parser);
      java.util.UUID sessionId = null;
      String topologyKind = null;
      tools.jackson.databind.JsonNode peerIdentity = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(TerminalRemoteControlRegisterRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(TerminalRemoteControlRegisterRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(TerminalRemoteControlRegisterRequest.class, "property value is required");
        switch (property) {
          case "sessionId" -> sessionId = context.readValue(parser, java.util.UUID.class);
          case "topologyKind" -> topologyKind = context.readValue(parser, String.class);
          case "peerIdentity" -> peerIdentity = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(TerminalRemoteControlRegisterRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(TerminalRemoteControlRegisterRequest.class, "object must end with END_OBJECT");
      if (sessionId == null) return context.reportInputMismatch(TerminalRemoteControlRegisterRequest.class, "missing required property sessionId");
      if (topologyKind == null) return context.reportInputMismatch(TerminalRemoteControlRegisterRequest.class, "missing required property topologyKind");
      if (!seen.contains("peerIdentity")) return context.reportInputMismatch(TerminalRemoteControlRegisterRequest.class, "missing required property peerIdentity");
      return new TerminalRemoteControlRegisterRequest(sessionId, topologyKind, peerIdentity);
    }
  }
}
