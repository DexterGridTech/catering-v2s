// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = StoreTerminalRangeSelection.Deserializer.class)
public record StoreTerminalRangeSelection(
    String key,
    Boolean all,
    java.util.List<java.util.UUID> refs
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<StoreTerminalRangeSelection> {
    @Override
    public StoreTerminalRangeSelection deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (StoreTerminalRangeSelection) context.handleUnexpectedToken(StoreTerminalRangeSelection.class, parser);
      String key = null;
      Boolean all = null;
      java.util.List<java.util.UUID> refs = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(StoreTerminalRangeSelection.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(StoreTerminalRangeSelection.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(StoreTerminalRangeSelection.class, "property value is required");
        switch (property) {
          case "key" -> key = context.readValue(parser, String.class);
          case "all" -> all = context.readValue(parser, Boolean.class);
          case "refs" -> refs = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<java.util.UUID>>() {});
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(StoreTerminalRangeSelection.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(StoreTerminalRangeSelection.class, "object must end with END_OBJECT");
      if (key == null) return context.reportInputMismatch(StoreTerminalRangeSelection.class, "missing required property key");
      if (all == null) return context.reportInputMismatch(StoreTerminalRangeSelection.class, "missing required property all");
      if (refs == null) return context.reportInputMismatch(StoreTerminalRangeSelection.class, "missing required property refs");
      return new StoreTerminalRangeSelection(key, all, refs);
    }
  }
}
