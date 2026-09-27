// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = TerminalActivationCancellationRequest.Deserializer.class)
public record TerminalActivationCancellationRequest(
    String deviceId
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<TerminalActivationCancellationRequest> {
    @Override
    public TerminalActivationCancellationRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (TerminalActivationCancellationRequest) context.handleUnexpectedToken(TerminalActivationCancellationRequest.class, parser);
      String deviceId = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(TerminalActivationCancellationRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(TerminalActivationCancellationRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(TerminalActivationCancellationRequest.class, "property value is required");
        switch (property) {
          case "deviceId" -> deviceId = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(TerminalActivationCancellationRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(TerminalActivationCancellationRequest.class, "object must end with END_OBJECT");
      if (deviceId == null) return context.reportInputMismatch(TerminalActivationCancellationRequest.class, "missing required property deviceId");
      return new TerminalActivationCancellationRequest(deviceId);
    }
  }
}
