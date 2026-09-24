// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = SalesMenuAssetStageRequest.Deserializer.class)
public record SalesMenuAssetStageRequest(
    Long expectedDraftVersion,
    String fileName,
    String mediaType,
    String contentDigest,
    String content
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<SalesMenuAssetStageRequest> {
    @Override
    public SalesMenuAssetStageRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (SalesMenuAssetStageRequest) context.handleUnexpectedToken(SalesMenuAssetStageRequest.class, parser);
      Long expectedDraftVersion = null;
      String fileName = null;
      String mediaType = null;
      String contentDigest = null;
      String content = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(SalesMenuAssetStageRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(SalesMenuAssetStageRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(SalesMenuAssetStageRequest.class, "property value is required");
        switch (property) {
          case "expectedDraftVersion" -> expectedDraftVersion = context.readValue(parser, Long.class);
          case "fileName" -> fileName = context.readValue(parser, String.class);
          case "mediaType" -> mediaType = context.readValue(parser, String.class);
          case "contentDigest" -> contentDigest = context.readValue(parser, String.class);
          case "content" -> content = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(SalesMenuAssetStageRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(SalesMenuAssetStageRequest.class, "object must end with END_OBJECT");
      if (expectedDraftVersion == null) return context.reportInputMismatch(SalesMenuAssetStageRequest.class, "missing required property expectedDraftVersion");
      if (fileName == null) return context.reportInputMismatch(SalesMenuAssetStageRequest.class, "missing required property fileName");
      if (mediaType == null) return context.reportInputMismatch(SalesMenuAssetStageRequest.class, "missing required property mediaType");
      if (contentDigest == null) return context.reportInputMismatch(SalesMenuAssetStageRequest.class, "missing required property contentDigest");
      if (content == null) return context.reportInputMismatch(SalesMenuAssetStageRequest.class, "missing required property content");
      return new SalesMenuAssetStageRequest(expectedDraftVersion, fileName, mediaType, contentDigest, content);
    }
  }
}
