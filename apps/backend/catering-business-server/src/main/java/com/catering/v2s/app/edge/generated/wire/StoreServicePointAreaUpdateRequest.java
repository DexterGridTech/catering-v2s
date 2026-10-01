// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = StoreServicePointAreaUpdateRequest.Deserializer.class)
public record StoreServicePointAreaUpdateRequest(
    String name,
    String code,
    StoreServicePointAreaType areaType,
    StoreServicePointStatus status,
    Long expectedVersion
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<StoreServicePointAreaUpdateRequest> {
    @Override
    public StoreServicePointAreaUpdateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (StoreServicePointAreaUpdateRequest) context.handleUnexpectedToken(StoreServicePointAreaUpdateRequest.class, parser);
      String name = null;
      String code = null;
      StoreServicePointAreaType areaType = null;
      StoreServicePointStatus status = null;
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(StoreServicePointAreaUpdateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(StoreServicePointAreaUpdateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(StoreServicePointAreaUpdateRequest.class, "property value is required");
        switch (property) {
          case "name" -> name = context.readValue(parser, String.class);
          case "code" -> code = context.readValue(parser, String.class);
          case "areaType" -> areaType = context.readValue(parser, StoreServicePointAreaType.class);
          case "status" -> status = context.readValue(parser, StoreServicePointStatus.class);
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(StoreServicePointAreaUpdateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(StoreServicePointAreaUpdateRequest.class, "object must end with END_OBJECT");
      if (name == null) return context.reportInputMismatch(StoreServicePointAreaUpdateRequest.class, "missing required property name");
      if (code == null) return context.reportInputMismatch(StoreServicePointAreaUpdateRequest.class, "missing required property code");
      if (areaType == null) return context.reportInputMismatch(StoreServicePointAreaUpdateRequest.class, "missing required property areaType");
      if (status == null) return context.reportInputMismatch(StoreServicePointAreaUpdateRequest.class, "missing required property status");
      if (expectedVersion == null) return context.reportInputMismatch(StoreServicePointAreaUpdateRequest.class, "missing required property expectedVersion");
      return new StoreServicePointAreaUpdateRequest(name, code, areaType, status, expectedVersion);
    }
  }
}
