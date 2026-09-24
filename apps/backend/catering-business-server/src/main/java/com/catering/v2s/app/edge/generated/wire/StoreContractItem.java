// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = StoreContractItem.Deserializer.class)
public record StoreContractItem(
    String code,
    String name
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<StoreContractItem> {
    @Override
    public StoreContractItem deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (StoreContractItem) context.handleUnexpectedToken(StoreContractItem.class, parser);
      String code = null;
      String name = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(StoreContractItem.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(StoreContractItem.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(StoreContractItem.class, "property value is required");
        switch (property) {
          case "code" -> code = context.readValue(parser, String.class);
          case "name" -> name = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(StoreContractItem.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(StoreContractItem.class, "object must end with END_OBJECT");
      if (code == null) return context.reportInputMismatch(StoreContractItem.class, "missing required property code");
      if (name == null) return context.reportInputMismatch(StoreContractItem.class, "missing required property name");
      return new StoreContractItem(code, name);
    }
  }
}
