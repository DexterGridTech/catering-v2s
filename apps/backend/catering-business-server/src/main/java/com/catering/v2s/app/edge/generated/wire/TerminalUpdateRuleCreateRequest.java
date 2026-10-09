// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = TerminalUpdateRuleCreateRequest.Deserializer.class)
public record TerminalUpdateRuleCreateRequest(
    String targetMode,
    java.util.List<java.util.UUID> storeRefs,
    java.util.UUID fullArtifactRef,
    java.util.UUID hotArtifactRef,
    String status,
    Long nSeconds,
    String hotStrategy,
    Long mSeconds,
    String description
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<TerminalUpdateRuleCreateRequest> {
    @Override
    public TerminalUpdateRuleCreateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (TerminalUpdateRuleCreateRequest) context.handleUnexpectedToken(TerminalUpdateRuleCreateRequest.class, parser);
      String targetMode = null;
      java.util.List<java.util.UUID> storeRefs = null;
      java.util.UUID fullArtifactRef = null;
      java.util.UUID hotArtifactRef = null;
      String status = null;
      Long nSeconds = null;
      String hotStrategy = null;
      Long mSeconds = null;
      String description = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(TerminalUpdateRuleCreateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(TerminalUpdateRuleCreateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(TerminalUpdateRuleCreateRequest.class, "property value is required");
        switch (property) {
          case "targetMode" -> targetMode = context.readValue(parser, String.class);
          case "storeRefs" -> storeRefs = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<java.util.UUID>>() {});
          case "fullArtifactRef" -> fullArtifactRef = context.readValue(parser, java.util.UUID.class);
          case "hotArtifactRef" -> hotArtifactRef = context.readValue(parser, java.util.UUID.class);
          case "status" -> status = context.readValue(parser, String.class);
          case "nSeconds" -> nSeconds = context.readValue(parser, Long.class);
          case "hotStrategy" -> hotStrategy = context.readValue(parser, String.class);
          case "mSeconds" -> mSeconds = context.readValue(parser, Long.class);
          case "description" -> description = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(TerminalUpdateRuleCreateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(TerminalUpdateRuleCreateRequest.class, "object must end with END_OBJECT");
      if (targetMode == null) return context.reportInputMismatch(TerminalUpdateRuleCreateRequest.class, "missing required property targetMode");
      if (fullArtifactRef == null) return context.reportInputMismatch(TerminalUpdateRuleCreateRequest.class, "missing required property fullArtifactRef");
      if (status == null) return context.reportInputMismatch(TerminalUpdateRuleCreateRequest.class, "missing required property status");
      if (nSeconds == null) return context.reportInputMismatch(TerminalUpdateRuleCreateRequest.class, "missing required property nSeconds");
      if (hotStrategy == null) return context.reportInputMismatch(TerminalUpdateRuleCreateRequest.class, "missing required property hotStrategy");
      return new TerminalUpdateRuleCreateRequest(targetMode, storeRefs, fullArtifactRef, hotArtifactRef, status, nSeconds, hotStrategy, mSeconds, description);
    }
  }
}
