// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = TerminalRemoteControlStatusReportRequest.Deserializer.class)
public record TerminalRemoteControlStatusReportRequest(
    java.util.UUID sessionId,
    String state,
    String reason,
    java.util.List<TerminalRemoteControlStatusReportRequestReadyScreensItem> readyScreens
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<TerminalRemoteControlStatusReportRequest> {
    @Override
    public TerminalRemoteControlStatusReportRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (TerminalRemoteControlStatusReportRequest) context.handleUnexpectedToken(TerminalRemoteControlStatusReportRequest.class, parser);
      java.util.UUID sessionId = null;
      String state = null;
      String reason = null;
      java.util.List<TerminalRemoteControlStatusReportRequestReadyScreensItem> readyScreens = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(TerminalRemoteControlStatusReportRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(TerminalRemoteControlStatusReportRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(TerminalRemoteControlStatusReportRequest.class, "property value is required");
        switch (property) {
          case "sessionId" -> sessionId = context.readValue(parser, java.util.UUID.class);
          case "state" -> state = context.readValue(parser, String.class);
          case "reason" -> reason = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "readyScreens" -> readyScreens = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<TerminalRemoteControlStatusReportRequestReadyScreensItem>>() {});
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(TerminalRemoteControlStatusReportRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(TerminalRemoteControlStatusReportRequest.class, "object must end with END_OBJECT");
      if (sessionId == null) return context.reportInputMismatch(TerminalRemoteControlStatusReportRequest.class, "missing required property sessionId");
      if (state == null) return context.reportInputMismatch(TerminalRemoteControlStatusReportRequest.class, "missing required property state");
      if (!seen.contains("reason")) return context.reportInputMismatch(TerminalRemoteControlStatusReportRequest.class, "missing required property reason");
      if (readyScreens == null) return context.reportInputMismatch(TerminalRemoteControlStatusReportRequest.class, "missing required property readyScreens");
      return new TerminalRemoteControlStatusReportRequest(sessionId, state, reason, readyScreens);
    }
  }
}
