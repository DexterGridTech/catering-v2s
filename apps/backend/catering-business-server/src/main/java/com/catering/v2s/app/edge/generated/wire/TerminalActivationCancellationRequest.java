// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = TerminalActivationCancellationRequest.Deserializer.class)
public record TerminalActivationCancellationRequest(
    String deviceId
) {

  private static boolean skipUnknownJsonValue(tools.jackson.core.JsonParser parser)
          throws tools.jackson.core.JacksonException {
    tools.jackson.core.JsonToken token = parser.currentToken();
    if (token == tools.jackson.core.JsonToken.START_OBJECT) {
      java.util.Set<String> names = new java.util.HashSet<>();
      token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME || !names.add(parser.currentName())) return false;
        token = parser.nextToken();
        if (token == null || !skipUnknownJsonValue(parser)) return false;
        token = parser.nextToken();
      }
      return token == tools.jackson.core.JsonToken.END_OBJECT;
    }
    if (token == tools.jackson.core.JsonToken.START_ARRAY) {
      token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_ARRAY) {
        if (!skipUnknownJsonValue(parser)) return false;
        token = parser.nextToken();
      }
      return token == tools.jackson.core.JsonToken.END_ARRAY;
    }
    return token != null;
  }


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
            if (!skipUnknownJsonValue(parser))
              return context.reportInputMismatch(TerminalActivationCancellationRequest.class, "unknown property contains malformed or duplicate JSON");
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
