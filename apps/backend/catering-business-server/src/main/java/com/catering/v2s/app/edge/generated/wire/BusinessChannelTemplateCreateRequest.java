// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = BusinessChannelTemplateCreateRequest.Deserializer.class)
public record BusinessChannelTemplateCreateRequest(
    java.util.UUID projectRef,
    String templateName,
    String templateCode,
    String accessKind,
    String operatorKind,
    String orderKind,
    String dineInForm,
    tools.jackson.databind.JsonNode providerCode,
    tools.jackson.databind.JsonNode urlRule,
    BusinessChannelTemplateStoreVisibilityScope storeVisibilityScope,
    java.util.List<java.util.UUID> visibleStoreRefs
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<BusinessChannelTemplateCreateRequest> {
    @Override
    public BusinessChannelTemplateCreateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (BusinessChannelTemplateCreateRequest) context.handleUnexpectedToken(BusinessChannelTemplateCreateRequest.class, parser);
      java.util.UUID projectRef = null;
      String templateName = null;
      String templateCode = null;
      String accessKind = null;
      String operatorKind = null;
      String orderKind = null;
      String dineInForm = null;
      tools.jackson.databind.JsonNode providerCode = null;
      tools.jackson.databind.JsonNode urlRule = null;
      BusinessChannelTemplateStoreVisibilityScope storeVisibilityScope = null;
      java.util.List<java.util.UUID> visibleStoreRefs = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(BusinessChannelTemplateCreateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(BusinessChannelTemplateCreateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(BusinessChannelTemplateCreateRequest.class, "property value is required");
        switch (property) {
          case "projectRef" -> projectRef = context.readValue(parser, java.util.UUID.class);
          case "templateName" -> templateName = context.readValue(parser, String.class);
          case "templateCode" -> templateCode = context.readValue(parser, String.class);
          case "accessKind" -> accessKind = context.readValue(parser, String.class);
          case "operatorKind" -> operatorKind = context.readValue(parser, String.class);
          case "orderKind" -> orderKind = context.readValue(parser, String.class);
          case "dineInForm" -> dineInForm = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "providerCode" -> providerCode = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "urlRule" -> urlRule = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "storeVisibilityScope" -> storeVisibilityScope = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, BusinessChannelTemplateStoreVisibilityScope.class));
          case "visibleStoreRefs" -> visibleStoreRefs = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<java.util.UUID>>() {});
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(BusinessChannelTemplateCreateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(BusinessChannelTemplateCreateRequest.class, "object must end with END_OBJECT");
      if (projectRef == null) return context.reportInputMismatch(BusinessChannelTemplateCreateRequest.class, "missing required property projectRef");
      if (templateName == null) return context.reportInputMismatch(BusinessChannelTemplateCreateRequest.class, "missing required property templateName");
      if (templateCode == null) return context.reportInputMismatch(BusinessChannelTemplateCreateRequest.class, "missing required property templateCode");
      if (accessKind == null) return context.reportInputMismatch(BusinessChannelTemplateCreateRequest.class, "missing required property accessKind");
      if (operatorKind == null) return context.reportInputMismatch(BusinessChannelTemplateCreateRequest.class, "missing required property operatorKind");
      if (orderKind == null) return context.reportInputMismatch(BusinessChannelTemplateCreateRequest.class, "missing required property orderKind");
      if (!seen.contains("storeVisibilityScope")) return context.reportInputMismatch(BusinessChannelTemplateCreateRequest.class, "missing required property storeVisibilityScope");
      if (visibleStoreRefs == null) return context.reportInputMismatch(BusinessChannelTemplateCreateRequest.class, "missing required property visibleStoreRefs");
      return new BusinessChannelTemplateCreateRequest(projectRef, templateName, templateCode, accessKind, operatorKind, orderKind, dineInForm, providerCode, urlRule, storeVisibilityScope, visibleStoreRefs);
    }
  }
}
