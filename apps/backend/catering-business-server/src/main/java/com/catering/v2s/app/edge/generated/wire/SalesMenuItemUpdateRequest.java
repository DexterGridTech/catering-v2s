// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = SalesMenuItemUpdateRequest.Deserializer.class)
public record SalesMenuItemUpdateRequest(
    String displayNameOverride,
    SalesMenuItemUpdateRequestSaleContent saleContent,
    SalesMenuOrderingConstraints orderingConstraints,
    SalesMenuDisplayMedia displayMedia,
    Long expectedVersion
) {

  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<SalesMenuItemUpdateRequest> {
    @Override
    public SalesMenuItemUpdateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (SalesMenuItemUpdateRequest) context.handleUnexpectedToken(SalesMenuItemUpdateRequest.class, parser);
      String displayNameOverride = null;
      SalesMenuItemUpdateRequestSaleContent saleContent = null;
      SalesMenuOrderingConstraints orderingConstraints = null;
      SalesMenuDisplayMedia displayMedia = null;
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(SalesMenuItemUpdateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(SalesMenuItemUpdateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(SalesMenuItemUpdateRequest.class, "property value is required");
        switch (property) {
          case "displayNameOverride" -> displayNameOverride = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "saleContent" -> saleContent = context.readValue(parser, SalesMenuItemUpdateRequestSaleContent.class);
          case "orderingConstraints" -> orderingConstraints = context.readValue(parser, SalesMenuOrderingConstraints.class);
          case "displayMedia" -> displayMedia = context.readValue(parser, SalesMenuDisplayMedia.class);
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(SalesMenuItemUpdateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(SalesMenuItemUpdateRequest.class, "object must end with END_OBJECT");
      if (!seen.contains("displayNameOverride")) return context.reportInputMismatch(SalesMenuItemUpdateRequest.class, "missing required property displayNameOverride");
      if (saleContent == null) return context.reportInputMismatch(SalesMenuItemUpdateRequest.class, "missing required property saleContent");
      if (orderingConstraints == null) return context.reportInputMismatch(SalesMenuItemUpdateRequest.class, "missing required property orderingConstraints");
      if (displayMedia == null) return context.reportInputMismatch(SalesMenuItemUpdateRequest.class, "missing required property displayMedia");
      if (expectedVersion == null) return context.reportInputMismatch(SalesMenuItemUpdateRequest.class, "missing required property expectedVersion");
      return new SalesMenuItemUpdateRequest(displayNameOverride, saleContent, orderingConstraints, displayMedia, expectedVersion);
    }
  }
}
