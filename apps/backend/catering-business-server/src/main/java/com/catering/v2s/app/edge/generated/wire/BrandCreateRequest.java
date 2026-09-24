// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = BrandCreateRequest.Deserializer.class)
public record BrandCreateRequest(
    String code,
    String name,
    String alias,
    String remark,
    tools.jackson.databind.JsonNode extensionValues,
    Long expectedExtensionRuleRevision
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<BrandCreateRequest> {
    @Override
    public BrandCreateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (BrandCreateRequest) context.handleUnexpectedToken(BrandCreateRequest.class, parser);
      String code = null;
      String name = null;
      String alias = null;
      String remark = null;
      tools.jackson.databind.JsonNode extensionValues = null;
      Long expectedExtensionRuleRevision = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(BrandCreateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(BrandCreateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(BrandCreateRequest.class, "property value is required");
        switch (property) {
          case "code" -> code = context.readValue(parser, String.class);
          case "name" -> name = context.readValue(parser, String.class);
          case "alias" -> alias = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "remark" -> remark = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "extensionValues" -> extensionValues = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "expectedExtensionRuleRevision" -> expectedExtensionRuleRevision = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, Long.class));
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(BrandCreateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(BrandCreateRequest.class, "object must end with END_OBJECT");
      if (code == null) return context.reportInputMismatch(BrandCreateRequest.class, "missing required property code");
      if (name == null) return context.reportInputMismatch(BrandCreateRequest.class, "missing required property name");
      return new BrandCreateRequest(code, name, alias, remark, extensionValues, expectedExtensionRuleRevision);
    }
  }
}
