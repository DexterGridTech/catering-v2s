// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = StoreServicePointAreaCreateRequest.Deserializer.class)
public record StoreServicePointAreaCreateRequest(
    String name,
    String code,
    StoreServicePointAreaType areaType
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<StoreServicePointAreaCreateRequest> {
    @Override
    public StoreServicePointAreaCreateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (StoreServicePointAreaCreateRequest) context.handleUnexpectedToken(StoreServicePointAreaCreateRequest.class, parser);
      String name = null;
      String code = null;
      StoreServicePointAreaType areaType = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(StoreServicePointAreaCreateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(StoreServicePointAreaCreateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(StoreServicePointAreaCreateRequest.class, "property value is required");
        switch (property) {
          case "name" -> name = context.readValue(parser, String.class);
          case "code" -> code = context.readValue(parser, String.class);
          case "areaType" -> areaType = context.readValue(parser, StoreServicePointAreaType.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(StoreServicePointAreaCreateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(StoreServicePointAreaCreateRequest.class, "object must end with END_OBJECT");
      if (name == null) return context.reportInputMismatch(StoreServicePointAreaCreateRequest.class, "missing required property name");
      if (code == null) return context.reportInputMismatch(StoreServicePointAreaCreateRequest.class, "missing required property code");
      if (areaType == null) return context.reportInputMismatch(StoreServicePointAreaCreateRequest.class, "missing required property areaType");
      return new StoreServicePointAreaCreateRequest(name, code, areaType);
    }
  }
}
