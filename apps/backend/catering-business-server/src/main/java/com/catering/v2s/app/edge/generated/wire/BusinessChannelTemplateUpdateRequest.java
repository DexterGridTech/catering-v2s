// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = BusinessChannelTemplateUpdateRequest.Deserializer.class)
public record BusinessChannelTemplateUpdateRequest(
    String templateName,
    Long expectedVersion,
    BusinessChannelTemplateStoreVisibilityScope storeVisibilityScope,
    tools.jackson.databind.JsonNode urlRule,
    java.util.List<java.util.UUID> visibleStoreRefs
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<BusinessChannelTemplateUpdateRequest> {
    @Override
    public BusinessChannelTemplateUpdateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (BusinessChannelTemplateUpdateRequest) context.handleUnexpectedToken(BusinessChannelTemplateUpdateRequest.class, parser);
      String templateName = null;
      Long expectedVersion = null;
      BusinessChannelTemplateStoreVisibilityScope storeVisibilityScope = null;
      tools.jackson.databind.JsonNode urlRule = null;
      java.util.List<java.util.UUID> visibleStoreRefs = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(BusinessChannelTemplateUpdateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(BusinessChannelTemplateUpdateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(BusinessChannelTemplateUpdateRequest.class, "property value is required");
        switch (property) {
          case "templateName" -> templateName = context.readValue(parser, String.class);
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          case "storeVisibilityScope" -> storeVisibilityScope = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, BusinessChannelTemplateStoreVisibilityScope.class));
          case "urlRule" -> urlRule = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "visibleStoreRefs" -> visibleStoreRefs = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<java.util.UUID>>() {});
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(BusinessChannelTemplateUpdateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(BusinessChannelTemplateUpdateRequest.class, "object must end with END_OBJECT");
      if (templateName == null) return context.reportInputMismatch(BusinessChannelTemplateUpdateRequest.class, "missing required property templateName");
      if (expectedVersion == null) return context.reportInputMismatch(BusinessChannelTemplateUpdateRequest.class, "missing required property expectedVersion");
      if (!seen.contains("storeVisibilityScope")) return context.reportInputMismatch(BusinessChannelTemplateUpdateRequest.class, "missing required property storeVisibilityScope");
      if (visibleStoreRefs == null) return context.reportInputMismatch(BusinessChannelTemplateUpdateRequest.class, "missing required property visibleStoreRefs");
      return new BusinessChannelTemplateUpdateRequest(templateName, expectedVersion, storeVisibilityScope, urlRule, visibleStoreRefs);
    }
  }
}
