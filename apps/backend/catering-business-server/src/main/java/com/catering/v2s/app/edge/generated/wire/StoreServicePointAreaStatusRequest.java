// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = StoreServicePointAreaStatusRequest.Deserializer.class)
public record StoreServicePointAreaStatusRequest(
    StoreServicePointStatus status,
    Long expectedVersion
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<StoreServicePointAreaStatusRequest> {
    @Override
    public StoreServicePointAreaStatusRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (StoreServicePointAreaStatusRequest) context.handleUnexpectedToken(StoreServicePointAreaStatusRequest.class, parser);
      StoreServicePointStatus status = null;
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(StoreServicePointAreaStatusRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(StoreServicePointAreaStatusRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(StoreServicePointAreaStatusRequest.class, "property value is required");
        switch (property) {
          case "status" -> status = context.readValue(parser, StoreServicePointStatus.class);
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(StoreServicePointAreaStatusRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(StoreServicePointAreaStatusRequest.class, "object must end with END_OBJECT");
      if (status == null) return context.reportInputMismatch(StoreServicePointAreaStatusRequest.class, "missing required property status");
      if (expectedVersion == null) return context.reportInputMismatch(StoreServicePointAreaStatusRequest.class, "missing required property expectedVersion");
      return new StoreServicePointAreaStatusRequest(status, expectedVersion);
    }
  }
}
