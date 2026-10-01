// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = StoreTerminalFunctionInput.Deserializer.class)
public record StoreTerminalFunctionInput(
    java.util.UUID ref,
    String clientKey,
    String functionKey,
    java.util.List<StoreTerminalRangeSelection> ranges,
    java.util.List<StoreTerminalSceneSelection> scenes
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<StoreTerminalFunctionInput> {
    @Override
    public StoreTerminalFunctionInput deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (StoreTerminalFunctionInput) context.handleUnexpectedToken(StoreTerminalFunctionInput.class, parser);
      java.util.UUID ref = null;
      String clientKey = null;
      String functionKey = null;
      java.util.List<StoreTerminalRangeSelection> ranges = null;
      java.util.List<StoreTerminalSceneSelection> scenes = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(StoreTerminalFunctionInput.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(StoreTerminalFunctionInput.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(StoreTerminalFunctionInput.class, "property value is required");
        switch (property) {
          case "ref" -> ref = context.readValue(parser, java.util.UUID.class);
          case "clientKey" -> clientKey = context.readValue(parser, String.class);
          case "functionKey" -> functionKey = context.readValue(parser, String.class);
          case "ranges" -> ranges = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<StoreTerminalRangeSelection>>() {});
          case "scenes" -> scenes = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<StoreTerminalSceneSelection>>() {});
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(StoreTerminalFunctionInput.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(StoreTerminalFunctionInput.class, "object must end with END_OBJECT");
      if (functionKey == null) return context.reportInputMismatch(StoreTerminalFunctionInput.class, "missing required property functionKey");
      if (ranges == null) return context.reportInputMismatch(StoreTerminalFunctionInput.class, "missing required property ranges");
      if (scenes == null) return context.reportInputMismatch(StoreTerminalFunctionInput.class, "missing required property scenes");
      return new StoreTerminalFunctionInput(ref, clientKey, functionKey, ranges, scenes);
    }
  }
}
