// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = SalesMenuItemUpdateRequestSaleContent.Deserializer.class)
public record SalesMenuItemUpdateRequestSaleContent(
    String kind,
    Long listedPriceCents,
    java.util.List<SalesMenuSkuPrice> skuPrices,
    java.util.List<SalesMenuItemUpdateRequestSaleContentOrderOptionSelectionsItem> orderOptionSelections
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<SalesMenuItemUpdateRequestSaleContent> {
    @Override
    public SalesMenuItemUpdateRequestSaleContent deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (SalesMenuItemUpdateRequestSaleContent) context.handleUnexpectedToken(SalesMenuItemUpdateRequestSaleContent.class, parser);
      String kind = null;
      Long listedPriceCents = null;
      java.util.List<SalesMenuSkuPrice> skuPrices = null;
      java.util.List<SalesMenuItemUpdateRequestSaleContentOrderOptionSelectionsItem> orderOptionSelections = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(SalesMenuItemUpdateRequestSaleContent.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(SalesMenuItemUpdateRequestSaleContent.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(SalesMenuItemUpdateRequestSaleContent.class, "property value is required");
        switch (property) {
          case "kind" -> kind = context.readValue(parser, String.class);
          case "listedPriceCents" -> listedPriceCents = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, Long.class));
          case "skuPrices" -> skuPrices = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<SalesMenuSkuPrice>>() {});
          case "orderOptionSelections" -> orderOptionSelections = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<SalesMenuItemUpdateRequestSaleContentOrderOptionSelectionsItem>>() {});
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(SalesMenuItemUpdateRequestSaleContent.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(SalesMenuItemUpdateRequestSaleContent.class, "object must end with END_OBJECT");
      if (kind == null) return context.reportInputMismatch(SalesMenuItemUpdateRequestSaleContent.class, "missing required property kind");
      if (!seen.contains("listedPriceCents")) return context.reportInputMismatch(SalesMenuItemUpdateRequestSaleContent.class, "missing required property listedPriceCents");
      if (skuPrices == null) return context.reportInputMismatch(SalesMenuItemUpdateRequestSaleContent.class, "missing required property skuPrices");
      if (orderOptionSelections == null) return context.reportInputMismatch(SalesMenuItemUpdateRequestSaleContent.class, "missing required property orderOptionSelections");
      return new SalesMenuItemUpdateRequestSaleContent(kind, listedPriceCents, skuPrices, orderOptionSelections);
    }
  }
}
