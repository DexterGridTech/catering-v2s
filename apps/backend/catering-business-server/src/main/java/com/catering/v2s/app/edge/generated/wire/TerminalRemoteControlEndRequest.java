// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = TerminalRemoteControlEndRequest.Deserializer.class)
public record TerminalRemoteControlEndRequest(
    String reason
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<TerminalRemoteControlEndRequest> {
    @Override
    public TerminalRemoteControlEndRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (TerminalRemoteControlEndRequest) context.handleUnexpectedToken(TerminalRemoteControlEndRequest.class, parser);
      String reason = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(TerminalRemoteControlEndRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(TerminalRemoteControlEndRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(TerminalRemoteControlEndRequest.class, "property value is required");
        switch (property) {
          case "reason" -> reason = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(TerminalRemoteControlEndRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(TerminalRemoteControlEndRequest.class, "object must end with END_OBJECT");
      if (reason == null) return context.reportInputMismatch(TerminalRemoteControlEndRequest.class, "missing required property reason");
      return new TerminalRemoteControlEndRequest(reason);
    }
  }
}
