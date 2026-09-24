// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = StoreTerminalSceneSelection.Deserializer.class)
public record StoreTerminalSceneSelection(
    String sceneKey,
    java.util.List<String> orderTypes,
    java.util.List<StoreTerminalPrinterBinding> printers
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<StoreTerminalSceneSelection> {
    @Override
    public StoreTerminalSceneSelection deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (StoreTerminalSceneSelection) context.handleUnexpectedToken(StoreTerminalSceneSelection.class, parser);
      String sceneKey = null;
      java.util.List<String> orderTypes = null;
      java.util.List<StoreTerminalPrinterBinding> printers = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(StoreTerminalSceneSelection.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(StoreTerminalSceneSelection.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(StoreTerminalSceneSelection.class, "property value is required");
        switch (property) {
          case "sceneKey" -> sceneKey = context.readValue(parser, String.class);
          case "orderTypes" -> orderTypes = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<String>>() {});
          case "printers" -> printers = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<StoreTerminalPrinterBinding>>() {});
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(StoreTerminalSceneSelection.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(StoreTerminalSceneSelection.class, "object must end with END_OBJECT");
      if (sceneKey == null) return context.reportInputMismatch(StoreTerminalSceneSelection.class, "missing required property sceneKey");
      if (orderTypes == null) return context.reportInputMismatch(StoreTerminalSceneSelection.class, "missing required property orderTypes");
      if (printers == null) return context.reportInputMismatch(StoreTerminalSceneSelection.class, "missing required property printers");
      return new StoreTerminalSceneSelection(sceneKey, orderTypes, printers);
    }
  }
}
