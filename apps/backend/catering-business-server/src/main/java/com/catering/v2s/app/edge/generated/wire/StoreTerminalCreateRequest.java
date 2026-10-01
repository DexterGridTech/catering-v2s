// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = StoreTerminalCreateRequest.Deserializer.class)
public record StoreTerminalCreateRequest(
    String name,
    String deviceType,
    String activationCode,
    StoreTerminalConfigurationInput configuration
) {
  @Override
  public String toString() {
    return "StoreTerminalCreateRequest["
        + "name=" + name
        + ", deviceType=" + deviceType
        + ", redacted=" + "[REDACTED]"
        + ", configuration=" + configuration
        + "]";
  }



  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<StoreTerminalCreateRequest> {
    @Override
    public StoreTerminalCreateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (StoreTerminalCreateRequest) context.handleUnexpectedToken(StoreTerminalCreateRequest.class, parser);
      String name = null;
      String deviceType = null;
      String activationCode = null;
      StoreTerminalConfigurationInput configuration = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(StoreTerminalCreateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(StoreTerminalCreateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(StoreTerminalCreateRequest.class, "property value is required");
        switch (property) {
          case "name" -> name = context.readValue(parser, String.class);
          case "deviceType" -> deviceType = context.readValue(parser, String.class);
          case "activationCode" -> activationCode = context.readValue(parser, String.class);
          case "configuration" -> configuration = context.readValue(parser, StoreTerminalConfigurationInput.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(StoreTerminalCreateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(StoreTerminalCreateRequest.class, "object must end with END_OBJECT");
      if (name == null) return context.reportInputMismatch(StoreTerminalCreateRequest.class, "missing required property name");
      if (deviceType == null) return context.reportInputMismatch(StoreTerminalCreateRequest.class, "missing required property deviceType");
      if (configuration == null) return context.reportInputMismatch(StoreTerminalCreateRequest.class, "missing required property configuration");
      return new StoreTerminalCreateRequest(name, deviceType, activationCode, configuration);
    }
  }
}
