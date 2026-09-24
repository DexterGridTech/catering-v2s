// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = SalesMenuOrderingConstraints.Deserializer.class)
public record SalesMenuOrderingConstraints(
    Long minItemQuantity,
    Long quantityStep
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<SalesMenuOrderingConstraints> {
    @Override
    public SalesMenuOrderingConstraints deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (SalesMenuOrderingConstraints) context.handleUnexpectedToken(SalesMenuOrderingConstraints.class, parser);
      Long minItemQuantity = null;
      Long quantityStep = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(SalesMenuOrderingConstraints.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(SalesMenuOrderingConstraints.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(SalesMenuOrderingConstraints.class, "property value is required");
        switch (property) {
          case "minItemQuantity" -> minItemQuantity = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, Long.class));
          case "quantityStep" -> quantityStep = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, Long.class));
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(SalesMenuOrderingConstraints.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(SalesMenuOrderingConstraints.class, "object must end with END_OBJECT");
      if (!seen.contains("minItemQuantity")) return context.reportInputMismatch(SalesMenuOrderingConstraints.class, "missing required property minItemQuantity");
      if (!seen.contains("quantityStep")) return context.reportInputMismatch(SalesMenuOrderingConstraints.class, "missing required property quantityStep");
      return new SalesMenuOrderingConstraints(minItemQuantity, quantityStep);
    }
  }
}
