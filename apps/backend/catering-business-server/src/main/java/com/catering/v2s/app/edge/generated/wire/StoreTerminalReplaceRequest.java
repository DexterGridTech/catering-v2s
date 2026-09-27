// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = StoreTerminalReplaceRequest.Deserializer.class)
public record StoreTerminalReplaceRequest(
    String name,
    StoreTerminalConfigurationInput configuration,
    Long expectedVersion
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<StoreTerminalReplaceRequest> {
    @Override
    public StoreTerminalReplaceRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (StoreTerminalReplaceRequest) context.handleUnexpectedToken(StoreTerminalReplaceRequest.class, parser);
      String name = null;
      StoreTerminalConfigurationInput configuration = null;
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(StoreTerminalReplaceRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(StoreTerminalReplaceRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(StoreTerminalReplaceRequest.class, "property value is required");
        switch (property) {
          case "name" -> name = context.readValue(parser, String.class);
          case "configuration" -> configuration = context.readValue(parser, StoreTerminalConfigurationInput.class);
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(StoreTerminalReplaceRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(StoreTerminalReplaceRequest.class, "object must end with END_OBJECT");
      if (name == null) return context.reportInputMismatch(StoreTerminalReplaceRequest.class, "missing required property name");
      if (configuration == null) return context.reportInputMismatch(StoreTerminalReplaceRequest.class, "missing required property configuration");
      if (expectedVersion == null) return context.reportInputMismatch(StoreTerminalReplaceRequest.class, "missing required property expectedVersion");
      return new StoreTerminalReplaceRequest(name, configuration, expectedVersion);
    }
  }
}
