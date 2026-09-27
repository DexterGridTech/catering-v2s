#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRelative = "contracts/catalog/store-operating-rule-switches.json";
const schemaRelative = "contracts/catalog/store-operating-rule-switches.schema.json";
const openApiRelative = "contracts/openapi/components/organization/store-operating-rule-schemas.generated.json";
const javaRelative = "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/domain/generated/StoreOperatingRuleCatalog.java";
const tsRelative = "apps/frontend/operations-admin/src/app/api/generated/storeOperatingRuleCatalog.ts";
const allowedTypes = new Set(["BOOLEAN", "NUMBER", "STRING"]);

function read(relative) { return fs.readFileSync(path.join(root, relative), "utf8"); }
function readJson(relative) { return JSON.parse(read(relative)); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function write(relative, value) {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), {recursive: true});
  fs.writeFileSync(absolute, value.endsWith("\n") ? value : `${value}\n`);
}
function fail(message) { throw new Error(`STORE_OPERATING_RULE_CATALOG_INVALID:${message}`); }

function validate(source) {
  if (source.schemaVersion !== 1 || source.kind !== "store-operating-rule-switch-catalog") fail("header");
  if (JSON.stringify(source.valueTypes) !== JSON.stringify(["BOOLEAN", "NUMBER", "STRING"])) fail("valueTypes");
  if (!Array.isArray(source.definitions) || source.definitions.length === 0) fail("definitions");
  const keys = new Set();
  const orders = new Set();
  for (const definition of source.definitions) {
    if (!definition || typeof definition !== "object") fail("definition-shape");
    const {key, label, type, defaultValue, parentKey, displayOrder} = definition;
    if (typeof key !== "string" || !/^[A-Za-z][A-Za-z0-9]{0,119}$/.test(key) || keys.has(key)) fail(`duplicate-key:${key}`);
    if (typeof label !== "string" || label.length === 0 || label.length > 120) fail(`label:${key}`);
    if (!allowedTypes.has(type)) fail(`type:${key}`);
    if (!Number.isInteger(displayOrder) || displayOrder < 1 || orders.has(displayOrder)) fail(`display-order:${key}`);
    if (parentKey !== null && (typeof parentKey !== "string" || parentKey === key)) fail(`parent:${key}`);
    const validDefault = type === "BOOLEAN" ? typeof defaultValue === "boolean"
      : type === "NUMBER" ? typeof defaultValue === "number" && Number.isFinite(defaultValue)
      : typeof defaultValue === "string";
    if (!validDefault) fail(`default:${key}`);
    keys.add(key); orders.add(displayOrder);
  }
  for (const definition of source.definitions) {
    if (definition.parentKey !== null) {
      const parent = source.definitions.find((candidate) => candidate.key === definition.parentKey);
      if (!parent) fail(`missing-parent:${definition.key}`);
      if (parent.type !== "BOOLEAN") fail(`non-boolean-parent:${definition.key}`);
    }
  }
  const byKey = new Map(source.definitions.map((definition) => [definition.key, definition]));
  for (const definition of source.definitions) {
    const seen = new Set([definition.key]);
    let parentKey = definition.parentKey;
    while (parentKey !== null) {
      if (seen.has(parentKey)) fail(`cycle:${definition.key}`);
      seen.add(parentKey);
      parentKey = byKey.get(parentKey).parentKey;
    }
  }
  return [...source.definitions].sort((left, right) => left.displayOrder - right.displayOrder);
}

function javaLiteral(definition) {
  if (definition.type === "BOOLEAN") return definition.defaultValue ? "Boolean.TRUE" : "Boolean.FALSE";
  if (definition.type === "NUMBER") return `Integer.valueOf(${definition.defaultValue})`;
  return `"${definition.defaultValue.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}
function javaString(value) { return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`; }
function tsLiteral(definition) {
  if (definition.type === "BOOLEAN") return definition.defaultValue ? "true" : "false";
  if (definition.type === "NUMBER") return String(definition.defaultValue);
  return JSON.stringify(definition.defaultValue);
}

function openApi(definitions, hash) {
  const properties = Object.fromEntries(definitions.map((definition) => [definition.key, {
    type: definition.type === "BOOLEAN" ? "boolean" : definition.type === "NUMBER" ? "number" : "string",
    default: definition.defaultValue,
    description: definition.label
  }]));
  return `${JSON.stringify({
    generated: true,
    sourceSha256: hash,
    components: {schemas: {
      OrganizationStoreOperatingRuleValues: {
        type: "object",
        description: "门店经营规则开关的完整值集合；由 store-operating-rule-switches.json 生成。",
        additionalProperties: false,
        required: definitions.map((definition) => definition.key),
        properties
      }
    }}
  }, null, 2)}\n`;
}

function java(definitions, hash) {
  const rows = definitions.map((definition) => {
    const values = [
      javaString(definition.key),
      javaString(definition.label),
      `ValueType.${definition.type}`,
      javaLiteral(definition),
      definition.parentKey === null ? "null" : javaString(definition.parentKey),
      String(definition.displayOrder),
    ];
    return `        new Definition(\n            ${values.join(",\n            ")}\n        )`;
  }).join(",\n");
  const keys = definitions.map((definition) => `            ${javaString(definition.key)}`).join(",\n");
  return `// GENERATED FILE. DO NOT EDIT. sourceSha256=${hash}\npackage com.catering.v2s.organization.domain.generated;\n\nimport java.util.LinkedHashMap;\nimport java.util.List;\nimport java.util.Map;\n\npublic final class StoreOperatingRuleCatalog {\n    public static final String SOURCE_SHA256 = ${javaString(hash)};\n\n    public enum ValueType { BOOLEAN, NUMBER, STRING }\n\n    public record Definition(\n            String key,\n            String label,\n            ValueType type,\n            Object defaultValue,\n            String parentKey,\n            int displayOrder) {}\n\n    /** Closed rule-value boundary shared by organization commands and readbacks. */\n    public record Values(Map<String, ?> entries) {\n        public Values {\n            if (entries == null) throw new IllegalArgumentException("operating rule values are required");\n            entries = Map.copyOf(entries);\n        }\n\n        public Object get(String key) { return entries.get(key); }\n\n        public boolean containsKey(String key) { return entries.containsKey(key); }\n\n        public Map<String, ?> asMap() { return entries; }\n    }\n\n    private static final List<Definition> DEFINITIONS = List.of(\n${rows}\n    );\n\n    private StoreOperatingRuleCatalog() {}\n\n    public static List<Definition> definitions() { return DEFINITIONS; }\n\n    public static Definition definition(String key) {\n        return DEFINITIONS.stream().filter(value -> value.key().equals(key)).findFirst().orElse(null);\n    }\n\n    public static Map<String, ?> defaults() {\n        var result = new LinkedHashMap<String, Object>();\n        for (Definition definition : DEFINITIONS) {\n            result.put(definition.key(), definition.defaultValue());\n        }\n        return result;\n    }\n\n    public static Values values(Map<String, ?> values, boolean requireComplete) {\n        validate(values, requireComplete);\n        return new Values(values == null || values.isEmpty() ? defaults() : values);\n    }\n\n    public static void validate(Map<String, ?> values, boolean requireComplete) {\n        if (values == null || values.isEmpty()) {\n            if (requireComplete) throw new IllegalArgumentException("operating rule values must be complete");\n            return;\n        }\n        if (values.size() != DEFINITIONS.size()) {\n            throw new IllegalArgumentException("operating rule keys are incomplete");\n        }\n        for (Definition definition : DEFINITIONS) {\n            if (!values.containsKey(definition.key())) throw new IllegalArgumentException("missing operating rule key");\n            Object value = values.get(definition.key());\n            if (value == null || !matches(definition.type(), value)) {\n                throw new IllegalArgumentException("operating rule value type is invalid");\n            }\n        }\n        if (values.keySet().stream().anyMatch(key -> definition(key) == null))\n            throw new IllegalArgumentException("unknown operating rule key");\n    }\n\n    private static boolean matches(ValueType type, Object value) {\n        return switch (type) {\n            case BOOLEAN -> value instanceof Boolean;\n            case NUMBER -> value instanceof Number;\n            case STRING -> value instanceof String;\n        };\n    }\n\n    public static Map<String, ?> resolved(Map<String, ?> values) {\n        var result = new LinkedHashMap<String, Object>(defaults());\n        if (values == null || values.isEmpty()) return result;\n        validate(values, true);\n        for (Definition definition : DEFINITIONS) {\n            result.put(definition.key(), values.get(definition.key()));\n        }\n        return result;\n    }\n\n    public static boolean applicable(Map<String, ?> values, String key) {\n        Definition definition = definition(key);\n        if (definition == null) throw new IllegalArgumentException("unknown operating rule key");\n        return definition.parentKey() == null || effective(values, definition.parentKey()).equals(Boolean.TRUE);\n    }\n\n    public static Object effective(Map<String, ?> values, String key) {\n        Definition definition = definition(key);\n        if (definition == null) throw new IllegalArgumentException("unknown operating rule key");\n        Object value = resolved(values).get(key);\n        return definition.type() == ValueType.BOOLEAN && !applicable(values, key) ? Boolean.FALSE : value;\n    }\n\n    public static List<String> keys() {\n        return List.of(\n${keys}\n        );\n    }\n}\n`; 
}

function ts(definitions, hash) {
  const rows = definitions.map((definition) => `  { key: ${JSON.stringify(definition.key)}, label: ${JSON.stringify(definition.label)}, type: ${JSON.stringify(definition.type)}, defaultValue: ${tsLiteral(definition)}, parentKey: ${definition.parentKey === null ? "null" : JSON.stringify(definition.parentKey)}, displayOrder: ${definition.displayOrder} }`).join(",\n");
  const keyUnion = definitions.map((definition) => JSON.stringify(definition.key)).join(" | ");
  return `// GENERATED FILE. DO NOT EDIT. sourceSha256=${hash}\n\nexport type StoreOperatingRuleValueType = 'BOOLEAN' | 'NUMBER' | 'STRING';\nexport type StoreOperatingRuleKey = ${keyUnion};\nexport type StoreOperatingRuleValue = boolean | number | string;\nexport type StoreOperatingRuleValues = Record<StoreOperatingRuleKey, StoreOperatingRuleValue>;\n\nexport type StoreOperatingRuleDefinition = {\n  key: StoreOperatingRuleKey;\n  label: string;\n  type: StoreOperatingRuleValueType;\n  defaultValue: StoreOperatingRuleValue;\n  parentKey: StoreOperatingRuleKey | null;\n  displayOrder: number;\n};\n\nexport const STORE_OPERATING_RULE_SOURCE_SHA256 = ${JSON.stringify(hash)} as const;\nexport const STORE_OPERATING_RULE_DEFINITIONS: readonly StoreOperatingRuleDefinition[] = [\n${rows}\n] as const;\n\nconst definitionByKey = new Map(STORE_OPERATING_RULE_DEFINITIONS.map((definition) => [definition.key, definition]));\n\nexport function storeOperatingRuleDefaults(): StoreOperatingRuleValues {\n  return Object.fromEntries(STORE_OPERATING_RULE_DEFINITIONS.map((definition) => [definition.key, definition.defaultValue])) as StoreOperatingRuleValues;\n}\n\nexport function storeOperatingRuleApplicable(values: StoreOperatingRuleValues, key: StoreOperatingRuleKey): boolean {\n  const definition = definitionByKey.get(key);\n  if (!definition?.parentKey) return true;\n  return storeOperatingRuleEffective(values, definition.parentKey) === true;\n}\n\nexport function storeOperatingRuleEffective(values: StoreOperatingRuleValues, key: StoreOperatingRuleKey): boolean | StoreOperatingRuleValue {\n  const definition = definitionByKey.get(key);\n  if (!definition) throw new Error('unknown store operating rule key');\n  const value = values[key] ?? definition.defaultValue;\n  if (definition.type !== 'BOOLEAN') return value;\n  return storeOperatingRuleApplicable(values, key) && value === true;\n}\n`;
}

function javaSource(definitions, hash) {
  return java(definitions, hash)
    .replace(
      "import java.util.LinkedHashMap;\n",
      "import java.io.Serializable;\nimport java.util.LinkedHashMap;\n",
    )
    .replace(
      "var result = new LinkedHashMap<String, Object>();",
      "var result = new LinkedHashMap<String, Serializable>();",
    )
    .replace(
      "public static Map<String, ?> defaults()",
      "public static Map<String, Serializable> defaults()",
    )
    .replace(
      "result.put(definition.key(), definition.defaultValue());",
      "result.put(definition.key(), (Serializable) definition.defaultValue());",
    )
    .replace(
      "var result = new LinkedHashMap<String, Object>(defaults());",
      "var result = new LinkedHashMap<String, Serializable>(defaults());",
    )
    .replace(
      "public static Map<String, ?> resolved(Map<String, ?> values)",
      "public static Map<String, Serializable> resolved(Map<String, ?> values)",
    )
    .replace(
      "result.put(definition.key(), values.get(definition.key()));",
      "result.put(definition.key(), (Serializable) values.get(definition.key()));",
    );
}

function outputs() {
  const sourceText = read(sourceRelative);
  const source = JSON.parse(sourceText);
  const definitions = validate(source);
  const hash = sha256(sourceText);
  return new Map([
    [openApiRelative, openApi(definitions, hash)],
    [javaRelative, javaSource(definitions, hash)],
    [tsRelative, ts(definitions, hash)]
  ]);
}
function check() {
  for (const [relative, expected] of outputs()) {
    const actual = fs.existsSync(path.join(root, relative)) ? read(relative) : null;
    if (actual !== expected) fail(`generated-output-drift:${relative}`);
  }
}
function selfTest() {
  const source = readJson(sourceRelative);
  const cases = [
    ["missing-default", (copy) => { delete copy.definitions[0].defaultValue; }],
    ["missing-parent", (copy) => { copy.definitions[2].parentKey = "doesNotExist"; }],
    ["cycle", (copy) => { copy.definitions[0].parentKey = "receivableEnabled"; copy.definitions[11].parentKey = "catalogManagementEnabled"; }],
    ["non-boolean-parent", (copy) => { copy.definitions[2].parentKey = "openPlatformDeveloperCode"; }],
    ["number-default", (copy) => { copy.definitions[0].defaultValue = "false"; }]
  ];
  for (const [name, mutate] of cases) {
    const copy = structuredClone(source);
    mutate(copy);
    let rejected = false;
    try { validate(copy); } catch { rejected = true; }
    if (!rejected) fail(`self-test-not-rejected:${name}`);
  }
  const validDefinitions = validate(source);
  const generated = outputs();
  if (validDefinitions.length !== 12 || generated.size !== 3
    || [...generated.values()].some((value) => typeof value !== "string" || value.length === 0)) {
    fail("self-test-legal-positive-generation");
  }
  console.log(`STORE_OPERATING_RULE_CATALOG_SELF_TEST=PASS cases=${cases.length + 1} LEGAL_POSITIVE=PASS outputs=${generated.size}`);
}

const args = new Set(process.argv.slice(2));
if (args.has("--self-test")) selfTest();
if (args.has("--check")) check();
if (!args.has("--check") && !args.has("--self-test")) {
  for (const [relative, value] of outputs()) write(relative, value);
  console.log(`STORE_OPERATING_RULE_CATALOG_GENERATED=PASS outputs=3`);
}
