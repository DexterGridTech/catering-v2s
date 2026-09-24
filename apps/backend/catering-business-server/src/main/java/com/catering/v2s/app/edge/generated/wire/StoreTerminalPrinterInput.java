// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = StoreTerminalPrinterInput.Deserializer.class)
public record StoreTerminalPrinterInput(
    java.util.UUID ref,
    String clientKey,
    String name,
    String brandKey,
    String modelKey,
    String paperSpecKey,
    String connectionMethodKey,
    tools.jackson.databind.JsonNode connectionParameter
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<StoreTerminalPrinterInput> {
    @Override
    public StoreTerminalPrinterInput deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (StoreTerminalPrinterInput) context.handleUnexpectedToken(StoreTerminalPrinterInput.class, parser);
      java.util.UUID ref = null;
      String clientKey = null;
      String name = null;
      String brandKey = null;
      String modelKey = null;
      String paperSpecKey = null;
      String connectionMethodKey = null;
      tools.jackson.databind.JsonNode connectionParameter = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(StoreTerminalPrinterInput.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(StoreTerminalPrinterInput.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(StoreTerminalPrinterInput.class, "property value is required");
        switch (property) {
          case "ref" -> ref = context.readValue(parser, java.util.UUID.class);
          case "clientKey" -> clientKey = context.readValue(parser, String.class);
          case "name" -> name = context.readValue(parser, String.class);
          case "brandKey" -> brandKey = context.readValue(parser, String.class);
          case "modelKey" -> modelKey = context.readValue(parser, String.class);
          case "paperSpecKey" -> paperSpecKey = context.readValue(parser, String.class);
          case "connectionMethodKey" -> connectionMethodKey = context.readValue(parser, String.class);
          case "connectionParameter" -> connectionParameter = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(StoreTerminalPrinterInput.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(StoreTerminalPrinterInput.class, "object must end with END_OBJECT");
      if (name == null) return context.reportInputMismatch(StoreTerminalPrinterInput.class, "missing required property name");
      if (brandKey == null) return context.reportInputMismatch(StoreTerminalPrinterInput.class, "missing required property brandKey");
      if (modelKey == null) return context.reportInputMismatch(StoreTerminalPrinterInput.class, "missing required property modelKey");
      if (paperSpecKey == null) return context.reportInputMismatch(StoreTerminalPrinterInput.class, "missing required property paperSpecKey");
      if (connectionMethodKey == null) return context.reportInputMismatch(StoreTerminalPrinterInput.class, "missing required property connectionMethodKey");
      return new StoreTerminalPrinterInput(ref, clientKey, name, brandKey, modelKey, paperSpecKey, connectionMethodKey, connectionParameter);
    }
  }
}
