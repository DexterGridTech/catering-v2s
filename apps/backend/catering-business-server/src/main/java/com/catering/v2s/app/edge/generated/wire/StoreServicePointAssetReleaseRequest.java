// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = StoreServicePointAssetReleaseRequest.Deserializer.class)
public record StoreServicePointAssetReleaseRequest(
    Long expectedAssetVersion
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<StoreServicePointAssetReleaseRequest> {
    @Override
    public StoreServicePointAssetReleaseRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (StoreServicePointAssetReleaseRequest) context.handleUnexpectedToken(StoreServicePointAssetReleaseRequest.class, parser);
      Long expectedAssetVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(StoreServicePointAssetReleaseRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(StoreServicePointAssetReleaseRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(StoreServicePointAssetReleaseRequest.class, "property value is required");
        switch (property) {
          case "expectedAssetVersion" -> expectedAssetVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(StoreServicePointAssetReleaseRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(StoreServicePointAssetReleaseRequest.class, "object must end with END_OBJECT");
      if (expectedAssetVersion == null) return context.reportInputMismatch(StoreServicePointAssetReleaseRequest.class, "missing required property expectedAssetVersion");
      return new StoreServicePointAssetReleaseRequest(expectedAssetVersion);
    }
  }
}
