// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = TerminalRemoteControlStatusReportRequestReadyScreensItem.Deserializer.class)
public record TerminalRemoteControlStatusReportRequestReadyScreensItem(
    java.util.UUID endpointId,
    String screen,
    java.util.UUID streamId,
    String trackSid
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<TerminalRemoteControlStatusReportRequestReadyScreensItem> {
    @Override
    public TerminalRemoteControlStatusReportRequestReadyScreensItem deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (TerminalRemoteControlStatusReportRequestReadyScreensItem) context.handleUnexpectedToken(TerminalRemoteControlStatusReportRequestReadyScreensItem.class, parser);
      java.util.UUID endpointId = null;
      String screen = null;
      java.util.UUID streamId = null;
      String trackSid = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(TerminalRemoteControlStatusReportRequestReadyScreensItem.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(TerminalRemoteControlStatusReportRequestReadyScreensItem.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(TerminalRemoteControlStatusReportRequestReadyScreensItem.class, "property value is required");
        switch (property) {
          case "endpointId" -> endpointId = context.readValue(parser, java.util.UUID.class);
          case "screen" -> screen = context.readValue(parser, String.class);
          case "streamId" -> streamId = context.readValue(parser, java.util.UUID.class);
          case "trackSid" -> trackSid = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(TerminalRemoteControlStatusReportRequestReadyScreensItem.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(TerminalRemoteControlStatusReportRequestReadyScreensItem.class, "object must end with END_OBJECT");
      if (endpointId == null) return context.reportInputMismatch(TerminalRemoteControlStatusReportRequestReadyScreensItem.class, "missing required property endpointId");
      if (screen == null) return context.reportInputMismatch(TerminalRemoteControlStatusReportRequestReadyScreensItem.class, "missing required property screen");
      if (streamId == null) return context.reportInputMismatch(TerminalRemoteControlStatusReportRequestReadyScreensItem.class, "missing required property streamId");
      if (trackSid == null) return context.reportInputMismatch(TerminalRemoteControlStatusReportRequestReadyScreensItem.class, "missing required property trackSid");
      return new TerminalRemoteControlStatusReportRequestReadyScreensItem(endpointId, screen, streamId, trackSid);
    }
  }
}
