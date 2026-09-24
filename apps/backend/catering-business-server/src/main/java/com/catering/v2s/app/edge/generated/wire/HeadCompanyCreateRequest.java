// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = HeadCompanyCreateRequest.Deserializer.class)
public record HeadCompanyCreateRequest(
    String code,
    String name,
    String legalName,
    String unifiedSocialCreditCode,
    String remark,
    tools.jackson.databind.JsonNode extensionValues,
    Long expectedExtensionRuleRevision
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<HeadCompanyCreateRequest> {
    @Override
    public HeadCompanyCreateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (HeadCompanyCreateRequest) context.handleUnexpectedToken(HeadCompanyCreateRequest.class, parser);
      String code = null;
      String name = null;
      String legalName = null;
      String unifiedSocialCreditCode = null;
      String remark = null;
      tools.jackson.databind.JsonNode extensionValues = null;
      Long expectedExtensionRuleRevision = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(HeadCompanyCreateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(HeadCompanyCreateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(HeadCompanyCreateRequest.class, "property value is required");
        switch (property) {
          case "code" -> code = context.readValue(parser, String.class);
          case "name" -> name = context.readValue(parser, String.class);
          case "legalName" -> legalName = context.readValue(parser, String.class);
          case "unifiedSocialCreditCode" -> unifiedSocialCreditCode = context.readValue(parser, String.class);
          case "remark" -> remark = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "extensionValues" -> extensionValues = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "expectedExtensionRuleRevision" -> expectedExtensionRuleRevision = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, Long.class));
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(HeadCompanyCreateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(HeadCompanyCreateRequest.class, "object must end with END_OBJECT");
      if (code == null) return context.reportInputMismatch(HeadCompanyCreateRequest.class, "missing required property code");
      if (name == null) return context.reportInputMismatch(HeadCompanyCreateRequest.class, "missing required property name");
      if (legalName == null) return context.reportInputMismatch(HeadCompanyCreateRequest.class, "missing required property legalName");
      if (unifiedSocialCreditCode == null) return context.reportInputMismatch(HeadCompanyCreateRequest.class, "missing required property unifiedSocialCreditCode");
      return new HeadCompanyCreateRequest(code, name, legalName, unifiedSocialCreditCode, remark, extensionValues, expectedExtensionRuleRevision);
    }
  }
}
