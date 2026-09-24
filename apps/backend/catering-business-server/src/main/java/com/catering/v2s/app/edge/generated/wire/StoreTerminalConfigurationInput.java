// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = StoreTerminalConfigurationInput.Deserializer.class)
public record StoreTerminalConfigurationInput(
    java.util.List<StoreTerminalPrinterInput> printers,
    java.util.List<StoreTerminalFunctionInput> functions
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<StoreTerminalConfigurationInput> {
    @Override
    public StoreTerminalConfigurationInput deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (StoreTerminalConfigurationInput) context.handleUnexpectedToken(StoreTerminalConfigurationInput.class, parser);
      java.util.List<StoreTerminalPrinterInput> printers = null;
      java.util.List<StoreTerminalFunctionInput> functions = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(StoreTerminalConfigurationInput.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(StoreTerminalConfigurationInput.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(StoreTerminalConfigurationInput.class, "property value is required");
        switch (property) {
          case "printers" -> printers = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<StoreTerminalPrinterInput>>() {});
          case "functions" -> functions = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<StoreTerminalFunctionInput>>() {});
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(StoreTerminalConfigurationInput.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(StoreTerminalConfigurationInput.class, "object must end with END_OBJECT");
      if (printers == null) return context.reportInputMismatch(StoreTerminalConfigurationInput.class, "missing required property printers");
      if (functions == null) return context.reportInputMismatch(StoreTerminalConfigurationInput.class, "missing required property functions");
      return new StoreTerminalConfigurationInput(printers, functions);
    }
  }
}
