// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = StoreTerminalPrinterBinding.Deserializer.class)
public record StoreTerminalPrinterBinding(
    java.util.UUID printerRef,
    String printerClientKey
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<StoreTerminalPrinterBinding> {
    @Override
    public StoreTerminalPrinterBinding deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (StoreTerminalPrinterBinding) context.handleUnexpectedToken(StoreTerminalPrinterBinding.class, parser);
      java.util.UUID printerRef = null;
      String printerClientKey = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(StoreTerminalPrinterBinding.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(StoreTerminalPrinterBinding.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(StoreTerminalPrinterBinding.class, "property value is required");
        switch (property) {
          case "printerRef" -> printerRef = context.readValue(parser, java.util.UUID.class);
          case "printerClientKey" -> printerClientKey = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(StoreTerminalPrinterBinding.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(StoreTerminalPrinterBinding.class, "object must end with END_OBJECT");

      return new StoreTerminalPrinterBinding(printerRef, printerClientKey);
    }
  }
}
