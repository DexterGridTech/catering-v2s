// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = TerminalRemoteControlPeerIdentity.Deserializer.class)
public record TerminalRemoteControlPeerIdentity(
    String moduleName,
    String nodeId
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<TerminalRemoteControlPeerIdentity> {
    @Override
    public TerminalRemoteControlPeerIdentity deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (TerminalRemoteControlPeerIdentity) context.handleUnexpectedToken(TerminalRemoteControlPeerIdentity.class, parser);
      String moduleName = null;
      String nodeId = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(TerminalRemoteControlPeerIdentity.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(TerminalRemoteControlPeerIdentity.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(TerminalRemoteControlPeerIdentity.class, "property value is required");
        switch (property) {
          case "moduleName" -> moduleName = context.readValue(parser, String.class);
          case "nodeId" -> nodeId = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(TerminalRemoteControlPeerIdentity.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(TerminalRemoteControlPeerIdentity.class, "object must end with END_OBJECT");
      if (moduleName == null) return context.reportInputMismatch(TerminalRemoteControlPeerIdentity.class, "missing required property moduleName");
      if (nodeId == null) return context.reportInputMismatch(TerminalRemoteControlPeerIdentity.class, "missing required property nodeId");
      return new TerminalRemoteControlPeerIdentity(moduleName, nodeId);
    }
  }
}
