// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = PlatformAssetStageMultipart.Deserializer.class)
public record PlatformAssetStageMultipart(
    String usage,
    String groupWorkspaceKey,
    String file
) {

  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<PlatformAssetStageMultipart> {
    @Override
    public PlatformAssetStageMultipart deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (PlatformAssetStageMultipart) context.handleUnexpectedToken(PlatformAssetStageMultipart.class, parser);
      String usage = null;
      String groupWorkspaceKey = null;
      String file = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(PlatformAssetStageMultipart.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(PlatformAssetStageMultipart.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(PlatformAssetStageMultipart.class, "property value is required");
        switch (property) {
          case "usage" -> usage = context.readValue(parser, String.class);
          case "groupWorkspaceKey" -> groupWorkspaceKey = context.readValue(parser, String.class);
          case "file" -> file = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(PlatformAssetStageMultipart.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(PlatformAssetStageMultipart.class, "object must end with END_OBJECT");
      if (usage == null) return context.reportInputMismatch(PlatformAssetStageMultipart.class, "missing required property usage");
      if (file == null) return context.reportInputMismatch(PlatformAssetStageMultipart.class, "missing required property file");
      return new PlatformAssetStageMultipart(usage, groupWorkspaceKey, file);
    }
  }
}
