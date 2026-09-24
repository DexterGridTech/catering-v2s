// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = SalesMenuSkuPrice.Deserializer.class)
public record SalesMenuSkuPrice(
    java.util.UUID skuRef,
    String skuName,
    String skuCode,
    Long standardPriceCents,
    Long listedPriceCents
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<SalesMenuSkuPrice> {
    @Override
    public SalesMenuSkuPrice deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (SalesMenuSkuPrice) context.handleUnexpectedToken(SalesMenuSkuPrice.class, parser);
      java.util.UUID skuRef = null;
      String skuName = null;
      String skuCode = null;
      Long standardPriceCents = null;
      Long listedPriceCents = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(SalesMenuSkuPrice.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(SalesMenuSkuPrice.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(SalesMenuSkuPrice.class, "property value is required");
        switch (property) {
          case "skuRef" -> skuRef = context.readValue(parser, java.util.UUID.class);
          case "skuName" -> skuName = context.readValue(parser, String.class);
          case "skuCode" -> skuCode = context.readValue(parser, String.class);
          case "standardPriceCents" -> standardPriceCents = context.readValue(parser, Long.class);
          case "listedPriceCents" -> listedPriceCents = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(SalesMenuSkuPrice.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(SalesMenuSkuPrice.class, "object must end with END_OBJECT");
      if (skuRef == null) return context.reportInputMismatch(SalesMenuSkuPrice.class, "missing required property skuRef");
      if (skuName == null) return context.reportInputMismatch(SalesMenuSkuPrice.class, "missing required property skuName");
      if (skuCode == null) return context.reportInputMismatch(SalesMenuSkuPrice.class, "missing required property skuCode");
      if (standardPriceCents == null) return context.reportInputMismatch(SalesMenuSkuPrice.class, "missing required property standardPriceCents");
      if (listedPriceCents == null) return context.reportInputMismatch(SalesMenuSkuPrice.class, "missing required property listedPriceCents");
      return new SalesMenuSkuPrice(skuRef, skuName, skuCode, standardPriceCents, listedPriceCents);
    }
  }
}
