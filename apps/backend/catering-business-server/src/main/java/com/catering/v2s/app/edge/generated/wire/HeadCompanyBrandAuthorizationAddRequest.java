// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = HeadCompanyBrandAuthorizationAddRequest.Deserializer.class)
public record HeadCompanyBrandAuthorizationAddRequest(
    java.util.UUID brandId
) {

  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<HeadCompanyBrandAuthorizationAddRequest> {
    @Override
    public HeadCompanyBrandAuthorizationAddRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (HeadCompanyBrandAuthorizationAddRequest) context.handleUnexpectedToken(HeadCompanyBrandAuthorizationAddRequest.class, parser);
      java.util.UUID brandId = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(HeadCompanyBrandAuthorizationAddRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(HeadCompanyBrandAuthorizationAddRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(HeadCompanyBrandAuthorizationAddRequest.class, "property value is required");
        switch (property) {
          case "brandId" -> brandId = context.readValue(parser, java.util.UUID.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(HeadCompanyBrandAuthorizationAddRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(HeadCompanyBrandAuthorizationAddRequest.class, "object must end with END_OBJECT");
      if (brandId == null) return context.reportInputMismatch(HeadCompanyBrandAuthorizationAddRequest.class, "missing required property brandId");
      return new HeadCompanyBrandAuthorizationAddRequest(brandId);
    }
  }
}
