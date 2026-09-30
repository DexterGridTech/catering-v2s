// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = SalesMenuItemsAddRequest.Deserializer.class)
public record SalesMenuItemsAddRequest(
    java.util.List<java.util.UUID> catalogItemRefs,
    Long expectedVersion
) {

  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<SalesMenuItemsAddRequest> {
    @Override
    public SalesMenuItemsAddRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (SalesMenuItemsAddRequest) context.handleUnexpectedToken(SalesMenuItemsAddRequest.class, parser);
      java.util.List<java.util.UUID> catalogItemRefs = null;
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(SalesMenuItemsAddRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(SalesMenuItemsAddRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(SalesMenuItemsAddRequest.class, "property value is required");
        switch (property) {
          case "catalogItemRefs" -> catalogItemRefs = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<java.util.UUID>>() {});
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(SalesMenuItemsAddRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(SalesMenuItemsAddRequest.class, "object must end with END_OBJECT");
      if (catalogItemRefs == null) return context.reportInputMismatch(SalesMenuItemsAddRequest.class, "missing required property catalogItemRefs");
      if (expectedVersion == null) return context.reportInputMismatch(SalesMenuItemsAddRequest.class, "missing required property expectedVersion");
      return new SalesMenuItemsAddRequest(catalogItemRefs, expectedVersion);
    }
  }
}
