// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = SalesMenuItemUpdateRequestSaleContentOrderOptionSelectionsItem.Deserializer.class)
public record SalesMenuItemUpdateRequestSaleContentOrderOptionSelectionsItem(
    java.util.UUID definitionRef,
    java.util.List<java.util.UUID> selectedValueRefs
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<SalesMenuItemUpdateRequestSaleContentOrderOptionSelectionsItem> {
    @Override
    public SalesMenuItemUpdateRequestSaleContentOrderOptionSelectionsItem deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (SalesMenuItemUpdateRequestSaleContentOrderOptionSelectionsItem) context.handleUnexpectedToken(SalesMenuItemUpdateRequestSaleContentOrderOptionSelectionsItem.class, parser);
      java.util.UUID definitionRef = null;
      java.util.List<java.util.UUID> selectedValueRefs = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(SalesMenuItemUpdateRequestSaleContentOrderOptionSelectionsItem.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(SalesMenuItemUpdateRequestSaleContentOrderOptionSelectionsItem.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(SalesMenuItemUpdateRequestSaleContentOrderOptionSelectionsItem.class, "property value is required");
        switch (property) {
          case "definitionRef" -> definitionRef = context.readValue(parser, java.util.UUID.class);
          case "selectedValueRefs" -> selectedValueRefs = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<java.util.UUID>>() {});
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(SalesMenuItemUpdateRequestSaleContentOrderOptionSelectionsItem.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(SalesMenuItemUpdateRequestSaleContentOrderOptionSelectionsItem.class, "object must end with END_OBJECT");
      if (definitionRef == null) return context.reportInputMismatch(SalesMenuItemUpdateRequestSaleContentOrderOptionSelectionsItem.class, "missing required property definitionRef");
      if (selectedValueRefs == null) return context.reportInputMismatch(SalesMenuItemUpdateRequestSaleContentOrderOptionSelectionsItem.class, "missing required property selectedValueRefs");
      return new SalesMenuItemUpdateRequestSaleContentOrderOptionSelectionsItem(definitionRef, selectedValueRefs);
    }
  }
}
