// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = TerminalRemoteControlStartRequest.Deserializer.class)
public record TerminalRemoteControlStartRequest(
    java.util.UUID requestId
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<TerminalRemoteControlStartRequest> {
    @Override
    public TerminalRemoteControlStartRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (TerminalRemoteControlStartRequest) context.handleUnexpectedToken(TerminalRemoteControlStartRequest.class, parser);
      java.util.UUID requestId = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(TerminalRemoteControlStartRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(TerminalRemoteControlStartRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(TerminalRemoteControlStartRequest.class, "property value is required");
        switch (property) {
          case "requestId" -> requestId = context.readValue(parser, java.util.UUID.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(TerminalRemoteControlStartRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(TerminalRemoteControlStartRequest.class, "object must end with END_OBJECT");
      if (requestId == null) return context.reportInputMismatch(TerminalRemoteControlStartRequest.class, "missing required property requestId");
      return new TerminalRemoteControlStartRequest(requestId);
    }
  }
}
