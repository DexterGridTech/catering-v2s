// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = SalesMenuDisplayMedia.Deserializer.class)
public record SalesMenuDisplayMedia(
    String mode,
    java.util.List<java.util.UUID> assetRefs,
    java.util.UUID primaryAssetRef
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<SalesMenuDisplayMedia> {
    @Override
    public SalesMenuDisplayMedia deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (SalesMenuDisplayMedia) context.handleUnexpectedToken(SalesMenuDisplayMedia.class, parser);
      String mode = null;
      java.util.List<java.util.UUID> assetRefs = null;
      java.util.UUID primaryAssetRef = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(SalesMenuDisplayMedia.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(SalesMenuDisplayMedia.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(SalesMenuDisplayMedia.class, "property value is required");
        switch (property) {
          case "mode" -> mode = context.readValue(parser, String.class);
          case "assetRefs" -> assetRefs = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<java.util.UUID>>() {});
          case "primaryAssetRef" -> primaryAssetRef = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, java.util.UUID.class));
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(SalesMenuDisplayMedia.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(SalesMenuDisplayMedia.class, "object must end with END_OBJECT");
      if (mode == null) return context.reportInputMismatch(SalesMenuDisplayMedia.class, "missing required property mode");
      if (assetRefs == null) return context.reportInputMismatch(SalesMenuDisplayMedia.class, "missing required property assetRefs");
      if (!seen.contains("primaryAssetRef")) return context.reportInputMismatch(SalesMenuDisplayMedia.class, "missing required property primaryAssetRef");
      return new SalesMenuDisplayMedia(mode, assetRefs, primaryAssetRef);
    }
  }
}
