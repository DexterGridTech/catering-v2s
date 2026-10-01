// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = StoreServicePointOrderRequest.Deserializer.class)
public record StoreServicePointOrderRequest(
    StoreServicePointOrderDirection direction,
    Long expectedVersion
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<StoreServicePointOrderRequest> {
    @Override
    public StoreServicePointOrderRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (StoreServicePointOrderRequest) context.handleUnexpectedToken(StoreServicePointOrderRequest.class, parser);
      StoreServicePointOrderDirection direction = null;
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(StoreServicePointOrderRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(StoreServicePointOrderRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(StoreServicePointOrderRequest.class, "property value is required");
        switch (property) {
          case "direction" -> direction = context.readValue(parser, StoreServicePointOrderDirection.class);
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(StoreServicePointOrderRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(StoreServicePointOrderRequest.class, "object must end with END_OBJECT");
      if (direction == null) return context.reportInputMismatch(StoreServicePointOrderRequest.class, "missing required property direction");
      if (expectedVersion == null) return context.reportInputMismatch(StoreServicePointOrderRequest.class, "missing required property expectedVersion");
      return new StoreServicePointOrderRequest(direction, expectedVersion);
    }
  }
}
